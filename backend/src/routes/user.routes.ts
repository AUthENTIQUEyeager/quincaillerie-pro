import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCompany, requireRole } from "../middleware/auth";
import { asyncHandler, AppError } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth, requireCompany);

function scope(req: any) {
  return req.auth.role === "SUPER_ADMIN" ? {} : { companyId: req.auth.companyId };
}

const ROLES = ["PROPRIETAIRE", "GERANT", "CAISSIER", "MAGASINIER", "COMPTABLE", "LIVREUR"] as const;

router.get(
  "/",
  requireRole("PROPRIETAIRE", "GERANT"),
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: scope(req),
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  })
);

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  role: z.enum(ROLES),
});

router.post(
  "/",
  requireRole("PROPRIETAIRE", "GERANT"),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError("Cet email est déjà utilisé.", 409);
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, phone: data.phone, role: data.role, passwordHash, companyId: req.auth!.companyId! },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.status(201).json(user);
  })
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

router.put(
  "/:id",
  requireRole("PROPRIETAIRE", "GERANT"),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!existing) throw new AppError("Utilisateur introuvable.", 404);

    const { password, ...rest } = data;
    const updateData: any = { ...rest };
    if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.json(user);
  })
);

router.delete(
  "/:id",
  requireRole("PROPRIETAIRE"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!existing) throw new AppError("Utilisateur introuvable.", 404);
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
