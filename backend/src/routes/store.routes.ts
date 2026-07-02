import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCompany, requireRole } from "../middleware/auth";
import { asyncHandler, AppError } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth, requireCompany);

function scope(req: any) {
  return req.auth.role === "SUPER_ADMIN" ? {} : { companyId: req.auth.companyId };
}

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["MAGASIN_PRINCIPAL", "DEPOT_PRINCIPAL", "DEPOT_SECONDAIRE"]).default("DEPOT_SECONDAIRE"),
  address: z.string().optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const stores = await prisma.store.findMany({ where: scope(req), orderBy: { createdAt: "asc" } });
    res.json(stores);
  })
);

router.post(
  "/",
  requireRole("PROPRIETAIRE", "GERANT"),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const store = await prisma.store.create({ data: { ...data, companyId: req.auth!.companyId! } });
    res.status(201).json(store);
  })
);

router.put(
  "/:id",
  requireRole("PROPRIETAIRE", "GERANT"),
  asyncHandler(async (req, res) => {
    const data = createSchema.partial().parse(req.body);
    const existing = await prisma.store.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!existing) throw new AppError("Dépôt introuvable.", 404);
    const store = await prisma.store.update({ where: { id: req.params.id }, data });
    res.json(store);
  })
);

router.delete(
  "/:id",
  requireRole("PROPRIETAIRE"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.store.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!existing) throw new AppError("Dépôt introuvable.", 404);
    await prisma.store.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
