import { Router } from "express";
import { z, ZodSchema } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCompany } from "../middleware/auth";
import { asyncHandler, AppError } from "../middleware/errorHandler";

/**
 * Crée un routeur CRUD simple pour un modèle Prisma "company-scoped".
 * Utilisé pour les modules simples : Category, SubCategory, Brand.
 */
export function createScopedCrudRouter(opts: {
  model: any; // ex: prisma.category
  createSchema: ZodSchema;
  updateSchema: ZodSchema;
  include?: any;
  orderBy?: any;
}) {
  const router = Router();
  router.use(requireAuth, requireCompany);

  function scope(req: any) {
    return req.auth.role === "SUPER_ADMIN" ? {} : { companyId: req.auth.companyId };
  }

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const items = await opts.model.findMany({
        where: scope(req),
        include: opts.include,
        orderBy: opts.orderBy || { createdAt: "desc" },
      });
      res.json(items);
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const item = await opts.model.findFirst({ where: { id: req.params.id, ...scope(req) }, include: opts.include });
      if (!item) throw new AppError("Introuvable.", 404);
      res.json(item);
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const data = opts.createSchema.parse(req.body);
      const companyId = req.auth!.role === "SUPER_ADMIN" ? data.companyId ?? req.auth!.companyId : req.auth!.companyId;
      if (!companyId) throw new AppError("companyId requis.", 400);
      const item = await opts.model.create({ data: { ...data, companyId } });
      res.status(201).json(item);
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      const data = opts.updateSchema.parse(req.body);
      const existing = await opts.model.findFirst({ where: { id: req.params.id, ...scope(req) } });
      if (!existing) throw new AppError("Introuvable.", 404);
      const item = await opts.model.update({ where: { id: req.params.id }, data });
      res.json(item);
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const existing = await opts.model.findFirst({ where: { id: req.params.id, ...scope(req) } });
      if (!existing) throw new AppError("Introuvable.", 404);
      await opts.model.delete({ where: { id: req.params.id } });
      res.status(204).send();
    })
  );

  return router;
}

export { z };
