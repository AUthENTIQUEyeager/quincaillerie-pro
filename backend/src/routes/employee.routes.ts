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

const ROLES = ["PROPRIETAIRE", "GERANT", "CAISSIER", "MAGASINIER", "COMPTABLE", "LIVREUR"] as const;

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  position: z.string().optional(),
  role: z.enum(ROLES).default("CAISSIER"),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const employees = await prisma.employee.findMany({ where: scope(req), orderBy: { createdAt: "desc" } });
    res.json(employees);
  })
);

router.post(
  "/",
  requireRole("PROPRIETAIRE", "GERANT"),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const employee = await prisma.employee.create({ data: { ...data, companyId: req.auth!.companyId! } });
    res.status(201).json(employee);
  })
);

router.put(
  "/:id",
  requireRole("PROPRIETAIRE", "GERANT"),
  asyncHandler(async (req, res) => {
    const data = createSchema.partial().extend({ status: z.enum(["ACTIF", "SUSPENDU", "PARTI"]).optional() }).parse(req.body);
    const existing = await prisma.employee.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!existing) throw new AppError("Employé introuvable.", 404);
    const employee = await prisma.employee.update({ where: { id: req.params.id }, data });
    res.json(employee);
  })
);

router.delete(
  "/:id",
  requireRole("PROPRIETAIRE", "GERANT"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.employee.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!existing) throw new AppError("Employé introuvable.", 404);
    await prisma.employee.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
