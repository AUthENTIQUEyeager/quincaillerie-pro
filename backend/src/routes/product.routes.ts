import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCompany } from "../middleware/auth";
import { asyncHandler, AppError } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth, requireCompany);

function scope(req: any) {
  return req.auth.role === "SUPER_ADMIN" ? {} : { companyId: req.auth.companyId ?? undefined };
}

const productSchema = z.object({
  name: z.string().min(1),
  reference: z.string().optional(),
  sku: z.string().min(1),
  barcode: z.string().optional(),
  qrCode: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  subCategoryId: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  description: z.string().optional(),
  unit: z.string().default("unité"),
  altUnit: z.string().trim().min(1).optional().nullable(),
  altUnitFactor: z.number().positive().optional().nullable(),
  altSellingPrice: z.number().min(0).optional().nullable(),
  allowDecimal: z.boolean().default(false),
  purchasePrice: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  wholesalePrice: z.number().min(0).optional().nullable(),
  resellerPrice: z.number().min(0).optional().nullable(),
  promoPrice: z.number().min(0).optional().nullable(),
  vatRate: z.number().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
  maxStock: z.number().int().min(0).optional().nullable(),
  hasSerial: z.boolean().default(false),
  photoUrl: z.string().optional().nullable(),
  images: z.array(z.string()).optional(), // urls
});

// Une 2e unité n'a de sens qu'avec son équivalence en unité de base.
function checkAltUnit(d: { unit?: string; altUnit?: string | null; altUnitFactor?: number | null }) {
  if (d.altUnit && !d.altUnitFactor) throw new AppError("Indiquez combien d'unités de base contient la 2e unité.", 400);
  if (d.altUnit && d.unit && d.altUnit.trim().toLowerCase() === d.unit.trim().toLowerCase()) {
    throw new AppError("La 2e unité doit être différente de l'unité de base.", 400);
  }
}
function cleanAltUnit<T extends { altUnit?: string | null; altUnitFactor?: number | null; altSellingPrice?: number | null }>(d: T): T {
  if (d.altUnit === null || d.altUnit === "") return { ...d, altUnit: null, altUnitFactor: null, altSellingPrice: null };
  return d;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search, categoryId, lowStock } = req.query as Record<string, string>;
    const where: any = { ...scope(req) };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
        { reference: { contains: search } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;

    const products = await prisma.product.findMany({
      where,
      include: { category: true, subCategory: true, brand: true, supplier: true, stocks: true },
      orderBy: { createdAt: "desc" },
    });

    const result = products.map((p) => {
      const totalStock = p.stocks.reduce((sum, s) => sum + s.quantity, 0);
      return { ...p, totalStock };
    });

    res.json(lowStock === "true" ? result.filter((p) => p.totalStock <= p.minStock) : result);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, ...scope(req) },
      include: {
        category: true,
        subCategory: true,
        brand: true,
        supplier: true,
        stocks: { include: { store: true } },
        images: true,
        variants: true,
        batches: { include: { serials: true }, orderBy: { receivedAt: "desc" } },
        stockMovements: { orderBy: { createdAt: "desc" }, take: 30 },
      },
    });
    if (!product) throw new AppError("Produit introuvable.", 404);
    res.json(product);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { images, ...parsed } = productSchema.parse(req.body);
    checkAltUnit(parsed);
    const data = cleanAltUnit(parsed);
    const companyId = req.auth!.companyId!;

    const existingSku = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (existingSku) throw new AppError("Ce SKU existe déjà.", 409);

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data: { ...data, companyId } });
      if (images?.length) {
        await tx.productImage.createMany({
          data: images.map((url, idx) => ({ productId: created.id, url, isPrimary: idx === 0 })),
        });
      }
      // Initialise le stock à 0 dans tous les dépôts de l'entreprise
      const stores = await tx.store.findMany({ where: { companyId } });
      if (stores.length) {
        await tx.stock.createMany({
          data: stores.map((s) => ({ productId: created.id, storeId: s.id, quantity: 0 })),
        });
      }
      return created;
    });

    res.status(201).json(product);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { images, ...parsed } = productSchema.partial().parse(req.body);
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!existing) throw new AppError("Produit introuvable.", 404);
    checkAltUnit({
      unit: parsed.unit ?? existing.unit,
      altUnit: parsed.altUnit !== undefined ? parsed.altUnit : existing.altUnit,
      altUnitFactor: parsed.altUnitFactor !== undefined ? parsed.altUnitFactor : existing.altUnitFactor,
    });
    const data = cleanAltUnit(parsed);

    if (data.sku && data.sku !== existing.sku) {
      const dup = await prisma.product.findUnique({ where: { sku: data.sku } });
      if (dup) throw new AppError("Ce SKU existe déjà.", 409);
    }

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id: req.params.id }, data });
      if (images) {
        await tx.productImage.deleteMany({ where: { productId: req.params.id } });
        if (images.length) {
          await tx.productImage.createMany({
            data: images.map((url, idx) => ({ productId: req.params.id, url, isPrimary: idx === 0 })),
          });
        }
      }
      return updated;
    });

    res.json(product);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!existing) throw new AppError("Produit introuvable.", 404);
    await prisma.product.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

// --- Lots ---
const batchSchema = z.object({
  batchNumber: z.string().min(1),
  supplierId: z.string().optional().nullable(),
  quantity: z.number().int().positive(),
  expiryDate: z.string().optional().nullable(),
});
router.post(
  "/:id/batches",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!product) throw new AppError("Produit introuvable.", 404);
    const data = batchSchema.parse(req.body);
    const batch = await prisma.batch.create({
      data: {
        productId: product.id,
        batchNumber: data.batchNumber,
        supplierId: data.supplierId,
        quantity: data.quantity,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      },
    });
    res.status(201).json(batch);
  })
);

export default router;
