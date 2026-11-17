import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    // Par défaut Prisma coupe toute transaction au bout de 5 s : une facture de 8 lignes ou plus (une vingtaine
    // de requêtes vers Supabase) dépassait ce délai et finissait en « Erreur interne du serveur ».
    transactionOptions: { maxWait: 10000, timeout: 30000 },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma__ = prisma;
}
