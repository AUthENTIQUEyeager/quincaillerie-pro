import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCompany, requireRole } from "../middleware/auth";
import { asyncHandler, AppError } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth, requireCompany);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth!.companyId) throw new AppError("Aucune entreprise associée.", 404);
    const company = await prisma.company.findUnique({ where: { id: req.auth!.companyId } });
    res.json(company);
  })
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  logo: z.string().optional().nullable(),
  currency: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
});

router.put(
  "/",
  requireRole("PROPRIETAIRE", "GERANT"),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const company = await prisma.company.update({ where: { id: req.auth!.companyId! }, data });
    res.json(company);
  })
);

export default router;
