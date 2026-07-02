import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email }, include: { company: true } });
    if (!user || !user.isActive) throw new AppError("Identifiants incorrects.", 401);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError("Identifiants incorrects.", 401);

    if (user.company && !user.company.isActive) {
      throw new AppError("Cette entreprise est désactivée. Contactez le support.", 403);
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = signToken({ userId: user.id, companyId: user.companyId, role: user.role });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        company: user.company ? { id: user.company.id, name: user.company.name, logo: user.company.logo, currency: user.company.currency } : null,
      },
    });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      include: { company: true },
    });
    if (!user) throw new AppError("Utilisateur introuvable.", 404);
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      company: user.company
        ? { id: user.company.id, name: user.company.name, logo: user.company.logo, currency: user.company.currency, phone: user.company.phone }
        : null,
    });
  })
);

const registerCompanySchema = z.object({
  companyName: z.string().min(2),
  ownerName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  currency: z.string().default("XOF"),
});

// Inscription publique : crée une entreprise + son propriétaire + un dépôt principal
router.post(
  "/register-company",
  asyncHandler(async (req, res) => {
    const data = registerCompanySchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError("Cet email est déjà utilisé.", 409);

    const passwordHash = await bcrypt.hash(data.password, 10);

    const company = await prisma.company.create({
      data: {
        name: data.companyName,
        phone: data.phone,
        currency: data.currency,
        stores: { create: { name: "Magasin principal", type: "MAGASIN_PRINCIPAL" } },
      },
    });

    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        name: data.ownerName,
        email: data.email,
        passwordHash,
        role: "PROPRIETAIRE",
      },
    });

    const token = signToken({ userId: user.id, companyId: company.id, role: user.role });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: company.id } });
  })
);

export default router;
