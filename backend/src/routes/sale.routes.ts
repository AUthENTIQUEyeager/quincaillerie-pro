import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCompany } from "../middleware/auth";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import { pushNotification } from "../lib/notify";

const router = Router();
router.use(requireAuth, requireCompany);

function scope(req: any) {
  return req.auth.role === "SUPER_ADMIN" ? {} : { companyId: req.auth.companyId };
}

async function generateSaleNumber(companyId: string) {
  const count = await prisma.sale.count({ where: { companyId } });
  const year = new Date().getFullYear();
  return `V-${year}-${String(count + 1).padStart(5, "0")}`;
}

const saleItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
});

const saleSchema = z.object({
  storeId: z.string(),
  customerId: z.string().optional().nullable(),
  type: z.enum(["VENTE", "DEVIS", "BON_LIVRAISON"]).default("VENTE"),
  items: z.array(saleItemSchema).min(1),
  discount: z.number().min(0).default(0),
  paidAmount: z.number().min(0).default(0),
  paymentMethod: z.enum(["ESPECES", "MOBILE_MONEY", "CARTE", "VIREMENT", "MIXTE"]).default("ESPECES"),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { storeId, from, to, status } = req.query as Record<string, string>;
    const where: any = { ...scope(req) };
    if (storeId) where.storeId = storeId;
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    const sales = await prisma.sale.findMany({
      where,
      include: { customer: true, user: { select: { name: true } }, store: true, items: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    res.json(sales);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.id, ...scope(req) },
      include: { customer: true, user: { select: { name: true } }, store: true, items: { include: { product: true } }, payments: true },
    });
    if (!sale) throw new AppError("Vente introuvable.", 404);
    res.json(sale);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = saleSchema.parse(req.body);
    const companyId = req.auth!.companyId!;
    const store = await prisma.store.findFirst({ where: { id: data.storeId, companyId } });
    if (!store) throw new AppError("Dépôt invalide.", 400);

    const subtotal = data.items.reduce((sum, it) => sum + it.quantity * it.unitPrice - it.discount, 0);
    const totalAmount = Math.max(subtotal - data.discount, 0);

    const sale = await prisma.$transaction(async (tx) => {
      // Vérifie et décrémente le stock uniquement pour les ventes réelles (pas devis)
      if (data.type === "VENTE") {
        for (const item of data.items) {
          const stock = await tx.stock.findUnique({ where: { productId_storeId: { productId: item.productId, storeId: data.storeId } } });
          if (!stock || stock.quantity < item.quantity) {
            const product = await tx.product.findUnique({ where: { id: item.productId } });
            throw new AppError(`Stock insuffisant pour "${product?.name ?? item.productId}".`, 400);
          }
        }
      }

      const number = await generateSaleNumber(companyId);
      const created = await tx.sale.create({
        data: {
          companyId,
          storeId: data.storeId,
          customerId: data.customerId || null,
          userId: req.auth!.userId,
          number,
          type: data.type,
          subtotal,
          discount: data.discount,
          totalAmount,
          paidAmount: data.paidAmount,
          paymentMethod: data.paymentMethod,
          items: {
            create: data.items.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              discount: it.discount,
              total: it.quantity * it.unitPrice - it.discount,
            })),
          },
        },
        include: { items: true },
      });

      if (data.type === "VENTE") {
        for (const item of data.items) {
          await tx.stock.update({
            where: { productId_storeId: { productId: item.productId, storeId: data.storeId } },
            data: { quantity: { decrement: item.quantity } },
          });
          await tx.stockMovement.create({
            data: { productId: item.productId, storeId: data.storeId, type: "VENTE", quantity: -item.quantity, reference: created.number, userId: req.auth!.userId },
          });
        }

        if (data.customerId && data.paidAmount < totalAmount) {
          await tx.customer.update({ where: { id: data.customerId }, data: { balance: { increment: totalAmount - data.paidAmount } } });
        }
        if (data.paidAmount > 0 && data.customerId) {
          await tx.customerPayment.create({ data: { customerId: data.customerId, saleId: created.id, amount: data.paidAmount, method: data.paymentMethod } });
        }
      }

      return created;
    });

    if (data.type === "VENTE") {
      await pushNotification(companyId, "NOUVELLE_VENTE", "Nouvelle vente", `Vente ${sale.number} enregistrée pour un total de ${totalAmount}.`);
    }

    res.status(201).json(sale);
  })
);

// Annulation d'une vente (remet le stock)
router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const sale = await prisma.sale.findFirst({ where: { id: req.params.id, ...scope(req) }, include: { items: true } });
    if (!sale) throw new AppError("Vente introuvable.", 404);
    if (sale.status !== "VALIDEE") throw new AppError("Cette vente ne peut plus être annulée.", 400);

    await prisma.$transaction(async (tx) => {
      for (const item of sale.items) {
        await tx.stock.update({
          where: { productId_storeId: { productId: item.productId, storeId: sale.storeId } },
          data: { quantity: { increment: item.quantity } },
        });
        await tx.stockMovement.create({
          data: { productId: item.productId, storeId: sale.storeId, type: "RETOUR", quantity: item.quantity, reference: sale.number, userId: req.auth!.userId },
        });
      }
      await tx.sale.update({ where: { id: sale.id }, data: { status: "ANNULEE" } });
      if (sale.customerId) {
        await tx.customer.update({ where: { id: sale.customerId }, data: { balance: { decrement: Math.max(sale.totalAmount - sale.paidAmount, 0) } } });
      }
    });

    await pushNotification(sale.companyId, "RETOUR", "Vente annulée", `La vente ${sale.number} a été annulée et le stock restitué.`);
    res.json({ ok: true });
  })
);

export default router;
