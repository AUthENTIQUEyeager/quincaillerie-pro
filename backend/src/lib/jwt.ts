import jwt from "jsonwebtoken";

const DEV_DEFAULT_SECRET = "dev_secret_change_me";
const KNOWN_PLACEHOLDERS = [DEV_DEFAULT_SECRET, "change_this_secret_in_production_please_use_a_long_random_string"];

// En production, un secret absent, trop court ou connu (publié dans le dépôt) permettrait à n'importe qui
// de fabriquer un jeton valide : on préfère refuser de démarrer.
function resolveSecret(): string {
  const value = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!value || value.length < 16 || KNOWN_PLACEHOLDERS.includes(value)) {
      throw new Error(
        "JWT_SECRET manquant, trop court (< 16 caractères) ou identique à l'exemple du dépôt. " +
          "Définissez une chaîne aléatoire longue (ex. : openssl rand -base64 32) dans les variables d'environnement."
      );
    }
    return value;
  }
  if (!value || KNOWN_PLACEHOLDERS.includes(value)) {
    console.warn("⚠️  JWT_SECRET non défini (ou valeur d'exemple) : acceptable en développement local uniquement.");
  }
  return value || DEV_DEFAULT_SECRET;
}

const SECRET = resolveSecret();
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export interface JwtPayload {
  userId: string;
  companyId: string | null;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}
