import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler, AppError } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth, requireRole("SUPER_ADMIN"));

// --- Vue globale ---
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const [companies, users, sales, activeCompanies] = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.sale.aggregate({ _sum: { totalAmount: true }, _count: true }),
      prisma.company.count({ where: { isActive: true } }),
    ]);
    res.json({
      totalCompanies: companies,
      activeCompanies,
      totalUsers: users,
      totalSalesAmount: sales._sum.totalAmount || 0,
      totalSalesCount: sales._count,
    });
  })
);

// --- Entreprises ---
router.get(
  "/companies",
  asyncHandler(async (req, res) => {
    const companies = await prisma.company.findMany({
      include: { stores: true, users: { select: { id: true, name: true, email: true, role: true } }, _count: { select: { sales: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(companies);
  })
);

const createCompanySchema = z.object({
  name: z.string().min(2),
  currency: z.string().default("XOF"),
  phone: z.string().optional(),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(6),
});
router.post(
  "/companies",
  asyncHandler(async (req, res) => {
    const data = createCompanySchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.ownerEmail } });
    if (existing) throw new AppError("Cet email est déjà utilisé.", 409);
    const passwordHash = await bcrypt.hash(data.ownerPassword, 10);

    const company = await prisma.company.create({
      data: {
        name: data.name,
        currency: data.currency,
        phone: data.phone,
        stores: { create: { name: "Magasin principal", type: "MAGASIN_PRINCIPAL" } },
        users: { create: { name: data.ownerName, email: data.ownerEmail, passwordHash, role: "PROPRIETAIRE" } },
      },
      include: { stores: true, users: true },
    });
    res.status(201).json(company);
  })
);

const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  currency: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});
router.put(
  "/companies/:id",
  asyncHandler(async (req, res) => {
    const data = updateCompanySchema.parse(req.body);
    const company = await prisma.company.update({ where: { id: req.params.id }, data });
    res.json(company);
  })
);

router.delete(
  "/companies/:id",
  asyncHandler(async (req, res) => {
    await prisma.company.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

// --- Utilisateurs (tous, toutes entreprises) ---
router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, company: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  })
);

const resetPasswordSchema = z.object({ newPassword: z.string().min(6) });
router.post(
  "/users/:id/reset-password",
  asyncHandler(async (req, res) => {
    const { newPassword } = resetPasswordSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });
    res.json({ ok: true, userId: user.id });
  })
);

// --- Journaux d'erreurs / audit / connexions ---
router.get(
  "/audit-logs",
  asyncHandler(async (req, res) => {
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { name: true, email: true } }, company: { select: { name: true } } } });
    res.json(logs);
  })
);

router.get(
  "/connections",
  asyncHandler(async (req, res) => {
    const recentLogins = await prisma.user.findMany({
      where: { lastLoginAt: { not: null } },
      select: { id: true, name: true, email: true, role: true, lastLoginAt: true, company: { select: { name: true } } },
      orderBy: { lastLoginAt: "desc" },
      take: 100,
    });
    res.json(recentLogins);
  })
);

export default router;
