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

const orderSchema = z.object({
  type: z.enum(["CLIENT", "FOURNISSEUR"]),
  customerId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  note: z.string().optional(),
  lines: z.array(z.object({ productId: z.string(), quantity: z.number().positive(), unitPrice: z.number().min(0) })).min(1),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { type } = req.query as Record<string, string>;
    const where: any = { ...scope(req) };
    if (type) where.type = type;
    const orders = await prisma.order.findMany({
      where,
      include: { customer: true, supplier: true, lines: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = orderSchema.parse(req.body);
    const totalAmount = data.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const order = await prisma.order.create({
      data: {
        companyId: req.auth!.companyId!,
        type: data.type,
        customerId: data.customerId || null,
        supplierId: data.supplierId || null,
        note: data.note,
        totalAmount,
        lines: { create: data.lines },
      },
      include: { lines: true },
    });
    res.status(201).json(order);
  })
);

const statusSchema = z.object({ status: z.enum(["EN_ATTENTE", "CONFIRME", "LIVRE", "ANNULE"]) });
router.put(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!existing) throw new AppError("Commande introuvable.", 404);
    const { status } = statusSchema.parse(req.body);
    const order = await prisma.order.update({ where: { id: req.params.id }, data: { status } });
    res.json(order);
  })
);

export default router;
