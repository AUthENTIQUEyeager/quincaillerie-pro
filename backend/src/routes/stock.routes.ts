import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCompany, requireRole } from "../middleware/auth";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import { pushNotification } from "../lib/notify";

const router = Router();
router.use(requireAuth, requireCompany);

function scope(req: any) {
  return req.auth.role === "SUPER_ADMIN" ? {} : { companyId: req.auth.companyId };
}

async function assertStoreInCompany(req: any, storeId: string) {
  const store = await prisma.store.findFirst({ where: { id: storeId, ...scope(req) } });
  if (!store) throw new AppError("Dépôt introuvable pour cette entreprise.", 404);
  return store;
}

// Vue d'ensemble du stock (par dépôt ou global)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { storeId } = req.query as Record<string, string>;
    const where: any = {};
    if (storeId) where.storeId = storeId;
    const companyFilter = req.auth!.role === "SUPER_ADMIN" ? {} : { companyId: req.auth!.companyId };
    const stocks = await prisma.stock.findMany({
      where: { ...where, product: companyFilter },
      include: { product: { select: { id: true, name: true, sku: true, minStock: true, unit: true, photoUrl: true } }, store: true },
      orderBy: { product: { name: "asc" } },
    });
    res.json(stocks);
  })
);

router.get(
  "/movements",
  asyncHandler(async (req, res) => {
    const { storeId, productId } = req.query as Record<string, string>;
    const where: any = {};
    if (storeId) where.storeId = storeId;
    if (productId) where.productId = productId;
    const companyFilter = req.auth!.role === "SUPER_ADMIN" ? {} : { product: { companyId: req.auth!.companyId } };
    const movements = await prisma.stockMovement.findMany({
      where: { ...where, ...companyFilter },
      include: { product: { select: { name: true, sku: true, unit: true } }, store: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(movements);
  })
);

// Entrée / sortie / correction manuelle de stock
const moveSchema = z.object({
  productId: z.string(),
  storeId: z.string(),
  type: z.enum(["ENTREE", "SORTIE", "CORRECTION", "DOMMAGE"]),
  quantity: z.number().int(),
  reason: z.string().optional(),
});
router.post(
  "/movements",
  requireRole("PROPRIETAIRE", "GERANT", "MAGASINIER"),
  asyncHandler(async (req, res) => {
    const data = moveSchema.parse(req.body);
    await assertStoreInCompany(req, data.storeId);
    const product = await prisma.product.findFirst({ where: { id: data.productId, ...scope(req) } });
    if (!product) throw new AppError("Produit introuvable.", 404);

    const delta = data.type === "SORTIE" || data.type === "DOMMAGE" ? -Math.abs(data.quantity) : Math.abs(data.quantity);

    const result = await prisma.$transaction(async (tx) => {
      const stock = await tx.stock.upsert({
        where: { productId_storeId: { productId: data.productId, storeId: data.storeId } },
        update: data.type === "DOMMAGE" ? { damaged: { increment: Math.abs(data.quantity) }, quantity: { increment: delta } } : { quantity: { increment: delta } },
        create: { productId: data.productId, storeId: data.storeId, quantity: Math.max(delta, 0) },
      });
      if (stock.quantity < 0) throw new AppError("Stock insuffisant pour cette opération.", 400);
      const movement = await tx.stockMovement.create({
        data: {
          productId: data.productId,
          storeId: data.storeId,
          type: data.type,
          quantity: data.quantity,
          reason: data.reason,
          userId: req.auth!.userId,
        },
      });
      return { stock, movement };
    });

    if (result.stock.quantity <= product.minStock) {
      await pushNotification(product.companyId, "STOCK_FAIBLE", "Stock faible", `${product.name} atteint le seuil minimum de stock.`);
    }

    res.status(201).json(result);
  })
);

// --- Inventaires ---
const inventoryStartSchema = z.object({ storeId: z.string(), note: z.string().optional() });
router.post(
  "/inventories",
  requireRole("PROPRIETAIRE", "GERANT", "MAGASINIER"),
  asyncHandler(async (req, res) => {
    const data = inventoryStartSchema.parse(req.body);
    await assertStoreInCompany(req, data.storeId);
    const inv = await prisma.inventory.create({ data: { storeId: data.storeId, note: data.note } });
    res.status(201).json(inv);
  })
);

const inventoryLineSchema = z.object({ productId: z.string(), countedQty: z.number().int().min(0) });
router.post(
  "/inventories/:id/lines",
  requireRole("PROPRIETAIRE", "GERANT", "MAGASINIER"),
  asyncHandler(async (req, res) => {
    const inv = await prisma.inventory.findUnique({ where: { id: req.params.id } });
    if (!inv) throw new AppError("Inventaire introuvable.", 404);
    const data = inventoryLineSchema.parse(req.body);
    const stock = await prisma.stock.findUnique({ where: { productId_storeId: { productId: data.productId, storeId: inv.storeId } } });
    const expectedQty = stock?.quantity ?? 0;
    const line = await prisma.inventoryLine.create({
      data: { inventoryId: inv.id, productId: data.productId, expectedQty, countedQty: data.countedQty, difference: data.countedQty - expectedQty },
    });
    res.status(201).json(line);
  })
);

router.post(
  "/inventories/:id/close",
  requireRole("PROPRIETAIRE", "GERANT"),
  asyncHandler(async (req, res) => {
    const inv = await prisma.inventory.findUnique({ where: { id: req.params.id }, include: { lines: true } });
    if (!inv) throw new AppError("Inventaire introuvable.", 404);

    await prisma.$transaction(async (tx) => {
      for (const line of inv.lines) {
        if (line.difference !== 0) {
          await tx.stock.upsert({
            where: { productId_storeId: { productId: line.productId, storeId: inv.storeId } },
            update: { quantity: line.countedQty },
            create: { productId: line.productId, storeId: inv.storeId, quantity: line.countedQty },
          });
          await tx.stockMovement.create({
            data: {
              productId: line.productId,
              storeId: inv.storeId,
              type: "INVENTAIRE",
              quantity: line.difference,
              reason: `Ajustement inventaire #${inv.id}`,
              userId: req.auth!.userId,
            },
          });
        }
      }
      await tx.inventory.update({ where: { id: inv.id }, data: { status: "TERMINE" } });
    });

    res.json({ ok: true });
  })
);

router.get(
  "/inventories",
  asyncHandler(async (req, res) => {
    const companyFilter = req.auth!.role === "SUPER_ADMIN" ? {} : { store: { companyId: req.auth!.companyId } };
    const inventories = await prisma.inventory.findMany({
      where: companyFilter,
      include: { store: true, lines: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(inventories);
  })
);

// --- Transferts entre dépôts ---
const transferSchema = z.object({
  fromStoreId: z.string(),
  toStoreId: z.string(),
  note: z.string().optional(),
  lines: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })).min(1),
});
router.post(
  "/transfers",
  requireRole("PROPRIETAIRE", "GERANT", "MAGASINIER"),
  asyncHandler(async (req, res) => {
    const data = transferSchema.parse(req.body);
    if (data.fromStoreId === data.toStoreId) throw new AppError("Les dépôts source et destination doivent être différents.", 400);
    await assertStoreInCompany(req, data.fromStoreId);
    await assertStoreInCompany(req, data.toStoreId);

    const transfer = await prisma.$transaction(async (tx) => {
      const t = await tx.transfer.create({
        data: {
          fromStoreId: data.fromStoreId,
          toStoreId: data.toStoreId,
          note: data.note,
          status: "RECU",
          lines: { create: data.lines },
        },
        include: { lines: true },
      });

      for (const line of data.lines) {
        const fromStock = await tx.stock.findUnique({ where: { productId_storeId: { productId: line.productId, storeId: data.fromStoreId } } });
        if (!fromStock || fromStock.quantity < line.quantity) {
          throw new AppError(`Stock insuffisant pour le transfert d'un des produits.`, 400);
        }
        await tx.stock.update({
          where: { productId_storeId: { productId: line.productId, storeId: data.fromStoreId } },
          data: { quantity: { decrement: line.quantity } },
        });
        await tx.stock.upsert({
          where: { productId_storeId: { productId: line.productId, storeId: data.toStoreId } },
          update: { quantity: { increment: line.quantity } },
          create: { productId: line.productId, storeId: data.toStoreId, quantity: line.quantity },
        });
        await tx.stockMovement.create({
          data: { productId: line.productId, storeId: data.fromStoreId, type: "TRANSFERT", quantity: -line.quantity, reference: t.id, userId: req.auth!.userId },
        });
        await tx.stockMovement.create({
          data: { productId: line.productId, storeId: data.toStoreId, type: "TRANSFERT", quantity: line.quantity, reference: t.id, userId: req.auth!.userId },
        });
      }
      return t;
    });

    res.status(201).json(transfer);
  })
);

router.get(
  "/transfers",
  asyncHandler(async (req, res) => {
    const companyFilter = req.auth!.role === "SUPER_ADMIN" ? {} : { fromStore: { companyId: req.auth!.companyId } };
    const transfers = await prisma.transfer.findMany({
      where: companyFilter,
      include: { fromStore: true, toStore: true, lines: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(transfers);
  })
);

export default router;
