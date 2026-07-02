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
  discount: z.number().min(0).max(100).default(0),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const customers = await prisma.customer.findMany({ where: scope(req), orderBy: { name: "asc" } });
    res.json(customers);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, ...scope(req) },
      include: {
        sales: { orderBy: { createdAt: "desc" }, take: 20, include: { items: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!customer) throw new AppError("Client introuvable.", 404);
    res.json(customer);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const customer = await prisma.customer.create({ data: { ...data, companyId: req.auth!.companyId! } });
    res.status(201).json(customer);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = createSchema.partial().parse(req.body);
    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!existing) throw new AppError("Client introuvable.", 404);
    const customer = await prisma.customer.update({ where: { id: req.params.id }, data });
    res.json(customer);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!existing) throw new AppError("Client introuvable.", 404);
    await prisma.customer.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

const paymentSchema = z.object({ amount: z.number().positive(), method: z.string().default("ESPECES"), saleId: z.string().optional() });
router.post(
  "/:id/payments",
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!customer) throw new AppError("Client introuvable.", 404);
    const data = paymentSchema.parse(req.body);
    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.customerPayment.create({ data: { customerId: customer.id, ...data } });
      await tx.customer.update({ where: { id: customer.id }, data: { balance: { decrement: data.amount } } });
      return p;
    });
    res.status(201).json(payment);
  })
);

export default router;
