import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCompany, requireRole } from "../middleware/auth";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import { hashPickupCode, isValidPickupCode, normalizePickupCode } from "../lib/pickupCode";

// Remises magasin : le magasinier présente le reçu (QR code / code secret) et valide ce qu'il remet.
// Cette API ne renvoie JAMAIS de prix : le magasinier ne voit que les désignations et les quantités.
const router = Router();
router.use(requireAuth, requireCompany, requireRole("PROPRIETAIRE", "GERANT", "MAGASINIER"));

function scope(req: any) {
  return req.auth.role === "SUPER_ADMIN" ? {} : { companyId: req.auth.companyId ?? undefined };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const EPS = 1e-6;

// Freine les essais de codes au hasard (en plus de la limite générale de l'API).
const codeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives. Patientez une minute avant de réessayer." },
});

const slipInclude = {
  store: { select: { id: true, name: true } },
  customer: { select: { name: true } },
  items: {
    include: { product: { select: { name: true, sku: true, unit: true, allowDecimal: true } } },
    orderBy: { id: "asc" as const },
  },
  deliveries: {
    orderBy: { createdAt: "asc" as const },
    include: { lines: true },
  },
};

// Vue « magasinier » d'une vente : sans aucun prix, avec ce qui reste à remettre.
function toSlip(sale: any) {
  const items = sale.items.map((it: any) => ({
    id: it.id as string,
    productId: it.productId as string,
    productName: (it.product?.name ?? it.productId) as string,
    sku: (it.product?.sku ?? null) as string | null,
    unit: (it.unit || it.product?.unit || "") as string,
    allowDecimal: !!it.product?.allowDecimal,
    quantity: it.quantity as number,
    deliveredQty: it.deliveredQty as number,
    remaining: Math.max(round3(it.quantity - it.deliveredQty), 0),
  }));
  const nameByItem = new Map<string, string>(items.map((i: any) => [i.id, i.productName] as [string, string]));

  return {
    id: sale.id as string,
    number: sale.number as string,
    deliveryNumber: sale.deliveryNumber as number | null,
    createdAt: sale.createdAt,
    status: sale.status as string,
    deliveryStatus: sale.deliveryStatus as string,
    store: sale.store,
    customerName: (sale.customer?.name ?? null) as string | null,
    items,
    deliveries: sale.deliveries.map((d: any) => ({
      id: d.id,
      createdAt: d.createdAt,
      userName: d.userName,
      note: d.note,
      lines: d.lines.map((l: any) => ({
        saleItemId: l.saleItemId,
        productName: nameByItem.get(l.saleItemId) ?? "",
        quantity: l.quantity,
      })),
    })),
  };
}

async function findSaleByCode(db: any, req: any, rawCode: string) {
  const code = normalizePickupCode(rawCode);
  if (!isValidPickupCode(code)) {
    throw new AppError("Code invalide : vérifiez le code ou scannez à nouveau le QR code.", 404);
  }
  const sale = await db.sale.findFirst({
    where: { pickupCodeHash: hashPickupCode(code), ...scope(req) },
    include: slipInclude,
  });
  if (!sale) throw new AppError("Code inconnu : ce reçu n'existe pas.", 404);
  return sale;
}

const codeSchema = z.object({ code: z.string().min(1).max(100) });

// Vérifie un reçu (POST pour que le code ne se retrouve pas dans les journaux d'accès du serveur).
router.post(
  "/lookup",
  codeLimiter,
  asyncHandler(async (req, res) => {
    const { code } = codeSchema.parse(req.body);
    const sale = await findSaleByCode(prisma, req, code);
    if (sale.status !== "VALIDEE") {
      throw new AppError("Cette vente a été annulée : ne rien remettre.", 409);
    }
    res.set("Cache-Control", "no-store");
    res.json(toSlip(sale));
  })
);

const deliverSchema = z.object({
  code: z.string().min(1).max(100),
  note: z.string().max(300).optional(),
  lines: z
    .array(z.object({ saleItemId: z.string().min(1), quantity: z.number().positive() }))
    .min(1)
    .max(100),
});

// Valide une remise (totale ou partielle). Le code est exigé aussi ici : impossible de remettre
// une vente en connaissant seulement son identifiant.
router.post(
  "/deliver",
  codeLimiter,
  asyncHandler(async (req, res) => {
    const data = deliverSchema.parse(req.body);
    const userId = req.auth!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    const saleId = await prisma.$transaction(
      async (tx) => {
        const sale = await findSaleByCode(tx, req, data.code);
        if (sale.status !== "VALIDEE") {
          throw new AppError("Cette vente a été annulée : ne rien remettre.", 409);
        }
        if (sale.deliveryStatus === "SERVIE") {
          throw new AppError("Ce reçu a déjà été entièrement servi.", 409);
        }

        // Vérifie l'état de la vente et la verrouille pour la durée de la transaction :
        // protège d'une annulation ou d'une autre remise exactement au même moment.
        const lock = await tx.sale.updateMany({
          where: { id: sale.id, status: "VALIDEE", deliveryStatus: { in: ["EN_ATTENTE", "PARTIELLE"] } },
          data: { deliveryStatus: "PARTIELLE" },
        });
        if (lock.count !== 1) {
          throw new AppError("Cette vente vient d'être modifiée. Rechargez le reçu.", 409);
        }

        const itemById = new Map<string, any>(sale.items.map((it: any) => [it.id, it] as [string, any]));
        const seen = new Set<string>();

        const delivery = await tx.delivery.create({
          data: {
            companyId: sale.companyId,
            saleId: sale.id,
            userId,
            userName: user?.name ?? null,
            note: data.note || null,
          },
        });

        for (const line of data.lines) {
          if (seen.has(line.saleItemId)) {
            throw new AppError("Un produit apparaît plusieurs fois dans la remise.", 400);
          }
          seen.add(line.saleItemId);

          const item = itemById.get(line.saleItemId);
          if (!item) throw new AppError("Ligne inconnue pour ce reçu.", 400);

          const name: string = item.product?.name ?? "produit";
          const qty = round3(line.quantity);
          if (qty <= 0) throw new AppError(`Quantité invalide pour "${name}".`, 400);
          if (!item.product?.allowDecimal && !Number.isInteger(qty)) {
            throw new AppError(`"${name}" se remet en quantités entières.`, 400);
          }

          const remaining = round3(item.quantity - item.deliveredQty);
          if (qty > remaining + EPS) {
            throw new AppError(`Quantité trop élevée pour "${name}" (reste à remettre : ${remaining}).`, 400);
          }

          // Quantité sortie du stock, en unité de base (ex. 1 tonne = 20 sacs)
          const baseQty = round3(qty * item.unitFactor);

          // Mise à jour conditionnelle : si quelqu'un a remis cette ligne entre-temps, count vaut 0.
          const itemUpdate = await tx.saleItem.updateMany({
            where: { id: item.id, deliveredQty: { lte: round3(item.quantity - qty) + EPS } },
            data: { deliveredQty: { increment: qty } },
          });
          if (itemUpdate.count !== 1) {
            throw new AppError(`"${name}" vient d'être remis par quelqu'un d'autre. Rechargez le reçu.`, 409);
          }

          // Le stock avait été réservé à la vente : on lève la réservation (le produit quitte le magasin).
          const stockUpdate = await tx.stock.updateMany({
            where: { productId: item.productId, storeId: sale.storeId, reserved: { gte: baseQty - EPS } },
            data: { reserved: { decrement: baseQty } },
          });
          if (stockUpdate.count !== 1) {
            throw new AppError(`Réservation de stock introuvable pour "${name}". Prévenez le gérant.`, 409);
          }

          await tx.deliveryLine.create({
            data: { deliveryId: delivery.id, saleItemId: item.id, productId: item.productId, quantity: qty },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              storeId: sale.storeId,
              type: "LIVRAISON",
              quantity: -baseQty,
              // Le disponible avait déjà baissé à la vente (mouvement VENTE) : ce mouvement-ci enregistre la sortie PHYSIQUE.
              reason: `Remise au client (bordereau n° ${sale.deliveryNumber ?? sale.number}) — sortie physique, déjà décomptée du disponible à la vente`,
              reference: sale.number,
              userId,
            },
          });
        }

        const items = await tx.saleItem.findMany({
          where: { saleId: sale.id },
          select: { quantity: true, deliveredQty: true },
        });
        const allDelivered = items.every((it) => it.deliveredQty >= it.quantity - EPS);
        await tx.sale.update({
          where: { id: sale.id },
          data: { deliveryStatus: allDelivered ? "SERVIE" : "PARTIELLE" },
        });

        return sale.id as string;
      },
      { timeout: 20000, maxWait: 10000 }
    );

    const updated = await prisma.sale.findUniqueOrThrow({ where: { id: saleId }, include: slipInclude });
    res.set("Cache-Control", "no-store");
    res.status(201).json(toSlip(updated));
  })
);

// Ventes dont les produits n'ont pas (entièrement) été remis. Aucun code ni prix n'est renvoyé :
// c'est un tableau de suivi pour le gérant et le magasinier, pas un moyen de remettre sans reçu.
router.get(
  "/pending",
  asyncHandler(async (req, res) => {
    const sales = await prisma.sale.findMany({
      where: {
        ...scope(req),
        type: "VENTE",
        status: "VALIDEE",
        deliveryStatus: { in: ["EN_ATTENTE", "PARTIELLE"] },
      },
      include: {
        customer: { select: { name: true } },
        store: { select: { name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    res.set("Cache-Control", "no-store");
    res.json(
      sales.map((s) => ({
        id: s.id,
        number: s.number,
        deliveryNumber: s.deliveryNumber,
        createdAt: s.createdAt,
        deliveryStatus: s.deliveryStatus,
        storeName: s.store.name,
        customerName: s.customer?.name ?? null,
        remainingLines: s.items
          .map((it) => ({
            id: it.id,
            productName: it.product.name,
            unit: it.unit || it.product.unit,
            remaining: Math.max(round3(it.quantity - it.deliveredQty), 0),
          }))
          .filter((l) => l.remaining > 0),
      }))
    );
  })
);

export default router;
