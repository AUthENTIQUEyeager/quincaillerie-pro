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

async function generateSaleNumber(companyId: string) {
  const count = await prisma.sale.count({ where: { companyId } });
  const year = new Date().getFullYear();
  return `V-${year}-${String(count + 1).padStart(5, "0")}`;
}

const saleItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().positive(),
  // Unité de vente choisie : absente ou égale à l'unité de base = vente à l'unité de base.
  unit: z.string().optional().nullable(),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
});

// Arrondi pour éviter les dérives du type 0,1 + 0,2 = 0,30000000000000004
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const saleSchema = z.object({
  storeId: z.string(),
  customerId: z.string().optional().nullable(),
  type: z.enum(["VENTE", "DEVIS", "BON_LIVRAISON"]).default("VENTE"),
  items: z.array(saleItemSchema).min(1),
  discount: z.number().min(0).default(0),
  paidAmount: z.number().min(0).default(0),
  paymentMethod: z.enum(["ESPECES", "MOBILE_MONEY", "CARTE", "VIREMENT", "MIXTE"]).default("ESPECES"),
  // Paiement en plusieurs tranches (ex. espèces + mobile money). Prioritaire sur paidAmount/paymentMethod.
  payments: z
    .array(
      z.object({
        method: z.enum(["ESPECES", "MOBILE_MONEY", "CARTE", "VIREMENT"]),
        amount: z.number().positive(),
      })
    )
    .max(10)
    .optional(),
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
      include: { customer: true, user: { select: { name: true } }, store: true, items: true, salePayments: true },
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
      include: { customer: true, user: { select: { name: true } }, store: true, items: { include: { product: true } }, payments: true, salePayments: true },
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

    // Résout l'unité de chaque ligne côté serveur (le client ne décide jamais du facteur de conversion).
    const products = await prisma.product.findMany({
      where: { id: { in: [...new Set(data.items.map((i) => i.productId))] }, companyId },
    });
    const productById = new Map(products.map((p) => [p.id, p]));
    const items = data.items.map((it) => {
      const product = productById.get(it.productId);
      if (!product) throw new AppError("Produit introuvable.", 400);
      const wantsAlt = !!it.unit && !!product.altUnit && it.unit === product.altUnit;
      if (it.unit && it.unit !== product.unit && !wantsAlt) {
        throw new AppError(`Unité "${it.unit}" inconnue pour "${product.name}".`, 400);
      }
      const unitFactor = wantsAlt ? product.altUnitFactor ?? 1 : 1;
      if (!product.allowDecimal && !Number.isInteger(it.quantity)) {
        throw new AppError(`"${product.name}" se vend en quantités entières.`, 400);
      }
      return { ...it, unit: wantsAlt ? product.altUnit! : null, unitFactor, baseQty: round3(it.quantity * unitFactor) };
    });

    const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unitPrice - it.discount, 0);
    const totalAmount = Math.max(subtotal - data.discount, 0);

    // Tranches de paiement : nouveau format (payments[]) ou ancien format (un seul montant + un seul mode)
    const isSale = data.type === "VENTE";
    const paymentLines: { method: string; amount: number }[] = !isSale
      ? []
      : data.payments?.length
      ? data.payments
      : data.paidAmount > 0
      ? [{ method: data.paymentMethod, amount: data.paidAmount }]
      : [];
    const paidAmount = isSale ? paymentLines.reduce((sum, p) => sum + p.amount, 0) : data.paidAmount;
    if (isSale && paidAmount > totalAmount + 0.0001) {
      throw new AppError("Le total des paiements dépasse le montant de la vente.", 400);
    }
    const distinctMethods = [...new Set(paymentLines.map((p) => p.method))];
    const paymentMethod = distinctMethods.length > 1 ? "MIXTE" : distinctMethods[0] ?? data.paymentMethod;

    const sale = await prisma.$transaction(async (tx) => {
      // Vérifie et décrémente le stock uniquement pour les ventes réelles (pas devis)
      if (data.type === "VENTE") {
        // Total demandé par produit (un même produit peut figurer sur 2 lignes, ex. sacs + tonne)
        const needed = new Map<string, number>();
        for (const item of items) needed.set(item.productId, round3((needed.get(item.productId) ?? 0) + item.baseQty));
        for (const [productId, qty] of needed) {
          const stock = await tx.stock.findUnique({ where: { productId_storeId: { productId, storeId: data.storeId } } });
          if (!stock || stock.quantity < qty - 1e-9) {
            const product = productById.get(productId);
            throw new AppError(
              `Stock insuffisant pour "${product?.name ?? productId}" (demandé : ${qty} ${product?.unit ?? ""}, disponible : ${round3(stock?.quantity ?? 0)}).`,
              400
            );
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
          paidAmount,
          paymentMethod,
          items: {
            create: items.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              unit: it.unit,
              unitFactor: it.unitFactor,
              unitPrice: it.unitPrice,
              discount: it.discount,
              total: it.quantity * it.unitPrice - it.discount,
            })),
          },
        },
        include: { items: true },
      });

      if (data.type === "VENTE") {
        for (const item of items) {
          await tx.stock.update({
            where: { productId_storeId: { productId: item.productId, storeId: data.storeId } },
            data: { quantity: { decrement: item.baseQty } },
          });
          await tx.stockMovement.create({
            data: { productId: item.productId, storeId: data.storeId, type: "VENTE", quantity: -item.baseQty, reference: created.number, userId: req.auth!.userId },
          });
        }

        // Détail des paiements par mode (avec ou sans client enregistré)
        if (paymentLines.length) {
          await tx.salePayment.createMany({
            data: paymentLines.map((p) => ({ companyId, saleId: created.id, method: p.method, amount: p.amount })),
          });
        }

        if (data.customerId && paidAmount < totalAmount) {
          await tx.customer.update({ where: { id: data.customerId }, data: { balance: { increment: totalAmount - paidAmount } } });
        }
        if (data.customerId) {
          for (const p of paymentLines) {
            await tx.customerPayment.create({ data: { customerId: data.customerId, saleId: created.id, amount: p.amount, method: p.method } });
          }
        }
      }

      return tx.sale.findUniqueOrThrow({
        where: { id: created.id },
        include: { items: { include: { product: true } }, salePayments: true },
      });
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
          data: { quantity: { increment: round3(item.quantity * item.unitFactor) } },
        });
        await tx.stockMovement.create({
          data: { productId: item.productId, storeId: sale.storeId, type: "RETOUR", quantity: round3(item.quantity * item.unitFactor), reference: sale.number, userId: req.auth!.userId },
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
