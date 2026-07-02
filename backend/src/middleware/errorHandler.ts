import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: "Ressource introuvable." });
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: "Données invalides.",
      details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  // Erreurs Prisma connues
  const anyErr = err as any;
  if (anyErr?.code === "P2002") {
    return res.status(409).json({ error: "Cette valeur existe déjà (contrainte d'unicité)." });
  }
  if (anyErr?.code === "P2025") {
    return res.status(404).json({ error: "Ressource introuvable." });
  }
  console.error(err);
  return res.status(500).json({ error: "Erreur interne du serveur." });
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
