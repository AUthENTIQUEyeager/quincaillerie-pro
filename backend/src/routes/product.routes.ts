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
    const { images, ...data } = productSchema.parse(req.body);
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
    const { images, ...data } = productSchema.partial().parse(req.body);
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!existing) throw new AppError("Produit introuvable.", 404);

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
