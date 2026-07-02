import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCompany } from "../middleware/auth";
import { asyncHandler, AppError } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth, requireCompany);

function scope(req: any) {
  return req.auth.role === "SUPER_ADMIN" ? {} : { companyId: req.auth.companyId };
}

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const suppliers = await prisma.supplier.findMany({ where: scope(req), orderBy: { name: "asc" } });
    res.json(suppliers);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, ...scope(req) },
      include: {
        purchases: { orderBy: { createdAt: "desc" }, take: 20 },
        payments: { orderBy: { createdAt: "desc" }, take: 20 },
        products: true,
      },
    });
    if (!supplier) throw new AppError("Fournisseur introuvable.", 404);
    res.json(supplier);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const supplier = await prisma.supplier.create({ data: { ...data, companyId: req.auth!.companyId! } });
    res.status(201).json(supplier);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = createSchema.partial().parse(req.body);
    const existing = await prisma.supplier.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!existing) throw new AppError("Fournisseur introuvable.", 404);
    const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data });
    res.json(supplier);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.supplier.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!existing) throw new AppError("Fournisseur introuvable.", 404);
    await prisma.supplier.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

// Paiement d'une dette fournisseur
const paymentSchema = z.object({ amount: z.number().positive(), method: z.string().default("ESPECES"), purchaseId: z.string().optional() });
router.post(
  "/:id/payments",
  asyncHandler(async (req, res) => {
    const supplier = await prisma.supplier.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!supplier) throw new AppError("Fournisseur introuvable.", 404);
    const data = paymentSchema.parse(req.body);
    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.supplierPayment.create({ data: { supplierId: supplier.id, ...data } });
      await tx.supplier.update({ where: { id: supplier.id }, data: { balance: { decrement: data.amount } } });
      return p;
    });
    res.status(201).json(payment);
  })
);

export default router;
