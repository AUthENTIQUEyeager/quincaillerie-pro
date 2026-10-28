import { createHash, randomInt } from "crypto";

// Code secret du reçu magasinier.
//
// - 16 caractères tirés d'un alphabet de 32 symboles = 80 bits d'aléa : impossible à deviner.
// - Alphabet sans I, L, O, U : pas de confusion entre 1/I/L ni entre 0/O à la lecture ou à la saisie.
// - Le code n'expire jamais (« intemporel »), mais il ne sert qu'à remettre les produits de SA vente,
//   et une fois tout remis le reçu est « servi » et ne peut plus être utilisé.
// - Il n'est JAMAIS stocké en clair : la base ne garde que son empreinte SHA-256. Une fuite de la base
//   (ou de la liste des ventes) ne permet donc pas de retrouver les codes.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const PICKUP_CODE_LENGTH = 16;

// Préfixe écrit dans le QR code : permet de reconnaître un reçu Quincaillerie Pro.
const QR_PREFIX = "QP1:";

export function generatePickupCode(): string {
  let code = "";
  for (let i = 0; i < PICKUP_CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

// Accepte ce que renvoie un lecteur de QR code (« QP1:XXXX... ») ou ce que tape le magasinier
// (minuscules, tirets, espaces, O à la place de 0, I/L à la place de 1).
export function normalizePickupCode(input: string): string {
  let s = String(input ?? "").trim().toUpperCase();
  if (s.startsWith(QR_PREFIX)) s = s.slice(QR_PREFIX.length);
  return s
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

export function isValidPickupCode(code: string): boolean {
  if (code.length !== PICKUP_CODE_LENGTH) return false;
  for (let i = 0; i < code.length; i++) {
    if (ALPHABET.indexOf(code[i]) === -1) return false;
  }
  return true;
}

export function hashPickupCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
