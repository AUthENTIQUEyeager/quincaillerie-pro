import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCompany } from "../middleware/auth";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import { pushNotification } from "../lib/notify";

const router = Router();
router.use(requireAuth, requireCompany);

function scope(req: any) {
  return req.auth.role === "SUPER_ADMIN" ? {} : { companyId: req.auth.companyId ?? undefined };
}

async function generatePurchaseNumber(companyId: string) {
  const count = await prisma.purchase.count({ where: { companyId } });
  const year = new Date().getFullYear();
  return `A-${year}-${String(count + 1).padStart(5, "0")}`;
}

const purchaseItemSchema = z.object({ productId: z.string(), quantity: z.number().positive(), unitPrice: z.number().min(0) });
const purchaseSchema = z.object({
  storeId: z.string(),
  supplierId: z.string(),
  items: z.array(purchaseItemSchema).min(1),
  paidAmount: z.number().min(0).default(0),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const purchases = await prisma.purchase.findMany({
      where: scope(req),
      include: { supplier: true, store: true, user: { select: { name: true } }, items: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    res.json(purchases);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const purchase = await prisma.purchase.findFirst({
      where: { id: req.params.id, ...scope(req) },
      include: { supplier: true, store: true, items: { include: { product: true } }, payments: true },
    });
    if (!purchase) throw new AppError("Achat introuvable.", 404);
    res.json(purchase);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = purchaseSchema.parse(req.body);
    const companyId = req.auth!.companyId!;
    const store = await prisma.store.findFirst({ where: { id: data.storeId, companyId } });
    if (!store) throw new AppError("Dépôt invalide.", 400);
    const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, companyId } });
    if (!supplier) throw new AppError("Fournisseur invalide.", 400);

    const totalAmount = data.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);

    const purchase = await prisma.$transaction(async (tx) => {
      const number = await generatePurchaseNumber(companyId);
      const created = await tx.purchase.create({
        data: {
          companyId,
          storeId: data.storeId,
          supplierId: data.supplierId,
          userId: req.auth!.userId,
          number,
          totalAmount,
          paidAmount: data.paidAmount,
          items: {
            create: data.items.map((it) => ({ productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice, total: it.quantity * it.unitPrice })),
          },
        },
        include: { items: true },
      });

      for (const item of data.items) {
        await tx.stock.upsert({
          where: { productId_storeId: { productId: item.productId, storeId: data.storeId } },
          update: { quantity: { increment: item.quantity } },
          create: { productId: item.productId, storeId: data.storeId, quantity: item.quantity },
        });
        await tx.stockMovement.create({
          data: { productId: item.productId, storeId: data.storeId, type: "ENTREE", quantity: item.quantity, reference: created.number, userId: req.auth!.userId },
        });
      }

      if (data.paidAmount < totalAmount) {
        await tx.supplier.update({ where: { id: data.supplierId }, data: { balance: { increment: totalAmount - data.paidAmount } } });
      }
      if (data.paidAmount > 0) {
        await tx.supplierPayment.create({ data: { supplierId: data.supplierId, purchaseId: created.id, amount: data.paidAmount } });
      }

      return created;
    });

    await pushNotification(companyId, "NOUVEL_ACHAT", "Nouvel achat", `Achat ${purchase.number} enregistré pour un total de ${totalAmount}.`);
    res.status(201).json(purchase);
  })
);

export default router;
