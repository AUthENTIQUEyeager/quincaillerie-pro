import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Crée le compte Super Admin, ou change son mot de passe s'il existe déjà. Ne touche à aucune autre donnée.
// Usage :  SUPERADMIN_PASSWORD="un-mot-de-passe-long" npm run admin:password
// Pour la production : lancez-le depuis votre ordinateur avec la DATABASE_URL directe (port 5432) de Supabase.
const EMAIL = process.env.SUPERADMIN_EMAIL || "superadmin@authentique-studio.com";
const prisma = new PrismaClient();

async function main() {
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!password || password.length < 12) {
    console.error("❌ Définissez SUPERADMIN_PASSWORD (12 caractères minimum).");
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, isActive: true },
    create: { name: "Authentique Studio", email: EMAIL, passwordHash, role: "SUPER_ADMIN" },
  });
  console.log(`✅ Super Admin ${EMAIL} : mot de passe défini.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
