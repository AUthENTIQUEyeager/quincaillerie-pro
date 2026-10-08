
import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  requireAuth,
  requireCompany,
  requireRole,
} from "../middleware/auth";
import {
  asyncHandler,
  AppError,
} from "../middleware/errorHandler";

const router = Router();

// Page « Gestion des prix » : réservée au propriétaire et au gérant
router.use(
  requireAuth,
  requireCompany,
  requireRole("PROPRIETAIRE", "GERANT")
);

function scope(req: any) {
  return req.auth.role === "SUPER_ADMIN"
    ? {}
    : {
        companyId: req.auth.companyId ?? undefined,
      };
}

const PRICE_FIELDS = [
  "purchasePrice",
  "sellingPrice",
  "wholesalePrice",
  "resellerPrice",
  "promoPrice",
] as const;

type PriceField = (typeof PRICE_FIELDS)[number];

const OPTIONAL_FIELDS: PriceField[] = [
  "wholesalePrice",
  "resellerPrice",
  "promoPrice",
];

// Liste des produits avec leurs prix
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
      where: scope(req),
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        isActive: true,
        updatedAt: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        purchasePrice: true,
        sellingPrice: true,
        wholesalePrice: true,
        resellerPrice: true,
        promoPrice: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.json(products);
  })
);

const price = z.number().finite().min(0);

const changeSchema = z.object({
  productId: z.string().min(1),
  expectedUpdatedAt: z.string().min(1),

  prices: z
    .object({
      purchasePrice: price.optional(),
      sellingPrice: price.optional(),
      wholesalePrice: price.nullable().optional(),
      resellerPrice: price.nullable().optional(),
      promoPrice: price.nullable().optional(),
    })
    .strict(),
});

const bodySchema = z.object({
  changes: z.array(changeSchema).min(1).max(2000),
});

// Enregistrement groupé
router.put(
  "/",
  asyncHandler(async (req, res) => {
    const { changes } = bodySchema.parse(req.body);

    const ids = changes.map((c) => c.productId);

    if (new Set(ids).size !== ids.length) {
      throw new AppError(
        "Un produit apparaît plusieurs fois dans la demande.",
        400
      );
    }

    const products = await prisma.product.findMany({
      where: {
        id: {
          in: ids,
        },
        ...scope(req),
      },
    });

    const byId = new Map(products.map((p) => [p.id, p]));

    const missing = ids.filter((id) => !byId.has(id));

    if (missing.length) {
      throw new AppError(
        "Un ou plusieurs produits sont introuvables.",
        404
      );
    }

    // Détection des modifications concurrentes
    const conflicts = changes
      .filter(
        (c) =>
          byId.get(c.productId)!.updatedAt.getTime() !==
          new Date(c.expectedUpdatedAt).getTime()
      )
      .map((c) => byId.get(c.productId)!.name);

    if (conflicts.length) {
      const shown =
        conflicts.slice(0, 5).join(", ") +
        (conflicts.length > 5
          ? `… (+${conflicts.length - 5})`
          : "");

      throw new AppError(
        `Ces produits ont été modifiés par quelqu'un d'autre : ${shown}. Rien n'a été enregistré, la page va se recharger.`,
        409
      );
    }

    const userId = req.auth!.userId;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        name: true,
      },
    });

    let updatedProducts = 0;
    let updatedPrices = 0;

    await prisma.$transaction(
      async (tx) => {
        const history: any[] = [];

        for (const c of changes) {
          const p = byId.get(c.productId)!;

          const data: Prisma.ProductUpdateInput = {};

          for (const field of PRICE_FIELDS) {
            const next = c.prices[field];

            if (next === undefined) {
              continue;
            }

            // purchasePrice et sellingPrice ne peuvent pas être null
            if (
              next === null &&
              !OPTIONAL_FIELDS.includes(field)
            ) {
              continue;
            }

            const prev = p[field] as number | null;

            if (prev === next) {
              continue;
            }

            // Affectation explicite des champs pour satisfaire
            // les types générés par Prisma.
            switch (field) {
              case "purchasePrice":
                if (next !== null) {
                  data.purchasePrice = next;
                }
                break;

              case "sellingPrice":
                if (next !== null) {
                  data.sellingPrice = next;
                }
                break;

              case "wholesalePrice":
                data.wholesalePrice = next;
                break;

              case "resellerPrice":
                data.resellerPrice = next;
                break;

              case "promoPrice":
                data.promoPrice = next;
                break;
            }

            history.push({
              companyId: p.companyId,
              productId: p.id,
              productName: p.name,
              field,
              oldValue: prev,
              newValue: next,
              userId,
              userName: user?.name ?? null,
            });
          }

          const n = Object.keys(data).length;

          if (!n) {
            continue;
          }

          await tx.product.update({
            where: {
              id: p.id,
            },
            data,
          });

          updatedProducts += 1;
          updatedPrices += n;
        }

        if (history.length) {
          await tx.priceChange.createMany({
            data: history,
          });
        }
      },
      {
        timeout: 60000,
        maxWait: 10000,
      }
    );

    res.json({
      ok: true,
      updatedProducts,
      updatedPrices,
    });
  })
);

// Historique des modifications de prix
router.get(
  "/history",
  asyncHandler(async (req, res) => {
    const { productId } = req.query as Record<string, string>;

    const where: any = {
      ...scope(req),
    };

    if (productId) {
      where.productId = productId;
    }

    const rows = await prisma.priceChange.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: 200,
    });

    res.json(rows);
  })
);

export default router;

