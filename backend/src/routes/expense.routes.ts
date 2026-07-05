import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCompany, requireRole } from "../middleware/auth";
import { asyncHandler, AppError } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth, requireCompany);

function scope(req: any) {
  return req.auth.role === "SUPER_ADMIN" ? {} : { companyId: req.auth.companyId ?? undefined };
}

const CATEGORIES = ["SALAIRES", "TRANSPORT", "ELECTRICITE", "INTERNET", "LOYER", "IMPOTS", "DIVERS"] as const;

const createSchema = z.object({
  category: z.enum(CATEGORIES),
  label: z.string().min(1),
  amount: z.number().positive(),
  note: z.string().optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { from, to, category } = req.query as Record<string, string>;
    const where: any = { ...scope(req) };
    if (category) where.category = category;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    const expenses = await prisma.expense.findMany({ where, orderBy: { createdAt: "desc" } });
    res.json(expenses);
  })
);

router.post(
  "/",
  requireRole("PROPRIETAIRE", "GERANT", "COMPTABLE"),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const expense = await prisma.expense.create({ data: { ...data, companyId: req.auth!.companyId! } });
    res.status(201).json(expense);
  })
);

router.delete(
  "/:id",
  requireRole("PROPRIETAIRE", "GERANT", "COMPTABLE"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.expense.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!existing) throw new AppError("Dépense introuvable.", 404);
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
