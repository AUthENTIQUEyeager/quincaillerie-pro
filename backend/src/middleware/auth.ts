import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentification requise." });
  }
  const token = header.slice(7);
  try {
    const payload = verifyToken(token);
    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Session invalide ou expirée." });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "Authentification requise." });
    if (req.auth.role === "SUPER_ADMIN") return next(); // accès total
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ error: "Permissions insuffisantes pour cette action." });
    }
    return next();
  };
}

// Garantit que l'utilisateur appartient bien à une entreprise (hors Super Admin)
export function requireCompany(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ error: "Authentification requise." });
  if (req.auth.role === "SUPER_ADMIN") return next();
  if (!req.auth.companyId) return res.status(403).json({ error: "Aucune entreprise associée à ce compte." });
  return next();
}
