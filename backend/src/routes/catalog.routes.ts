import { prisma } from "../lib/prisma";
import { createScopedCrudRouter, z } from "../utils/scopedCrud";

export const categoryRouter = createScopedCrudRouter({
  model: prisma.category,
  createSchema: z.object({ name: z.string().min(1), description: z.string().optional(), companyId: z.string().optional() }),
  updateSchema: z.object({ name: z.string().min(1).optional(), description: z.string().optional() }),
  include: { subCategories: true },
});

export const subCategoryRouter = createScopedCrudRouter({
  model: prisma.subCategory,
  createSchema: z.object({ name: z.string().min(1), categoryId: z.string(), companyId: z.string().optional() }),
  updateSchema: z.object({ name: z.string().min(1).optional(), categoryId: z.string().optional() }),
  include: { category: true },
});

export const brandRouter = createScopedCrudRouter({
  model: prisma.brand,
  createSchema: z.object({ name: z.string().min(1), companyId: z.string().optional() }),
  updateSchema: z.object({ name: z.string().min(1).optional() }),
});
