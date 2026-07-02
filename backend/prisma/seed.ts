import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Initialisation des données de démonstration...");

  // --- Super Admin (Authentique-Studio) ---
  const superAdminPassword = await bcrypt.hash("SuperAdmin@2026", 10);
  await prisma.user.upsert({
    where: { email: "superadmin@authentique-studio.com" },
    update: {},
    create: {
      name: "Authentique Studio",
      email: "superadmin@authentique-studio.com",
      passwordHash: superAdminPassword,
      role: "SUPER_ADMIN",
    },
  });

  // --- Entreprise démo ---
  const company = await prisma.company.create({
    data: {
      name: "Quincaillerie Sanou & Fils",
      currency: "XOF",
      phone: "+226 70 00 00 00",
      address: "Bobo-Dioulasso, Burkina Faso",
      stores: {
        create: [
          { name: "Magasin principal", type: "MAGASIN_PRINCIPAL" },
          { name: "Dépôt secondaire", type: "DEPOT_SECONDAIRE" },
        ],
      },
    },
    include: { stores: true },
  });

  const [mainStore, secondStore] = company.stores;

  const ownerPassword = await bcrypt.hash("Proprietaire@2026", 10);
  await prisma.user.create({
    data: { companyId: company.id, name: "Adama Sanou", email: "proprietaire@quincaillerie.demo", passwordHash: ownerPassword, role: "PROPRIETAIRE" },
  });

  const cashierPassword = await bcrypt.hash("Caissier@2026", 10);
  const cashier = await prisma.user.create({
    data: { companyId: company.id, name: "Fatou Ouédraogo", email: "caissier@quincaillerie.demo", passwordHash: cashierPassword, role: "CAISSIER" },
  });

  // --- Catalogue ---
  const category = await prisma.category.create({ data: { companyId: company.id, name: "Outillage" } });
  const subCategory = await prisma.subCategory.create({ data: { companyId: company.id, categoryId: category.id, name: "Outils à main" } });
  const brand = await prisma.brand.create({ data: { companyId: company.id, name: "Stanley" } });

  const supplier = await prisma.supplier.create({
    data: { companyId: company.id, name: "Fournisseur BTP Ouaga", phone: "+226 76 11 22 33", address: "Ouagadougou" },
  });

  const customer = await prisma.customer.create({
    data: { companyId: company.id, name: "Client Chantier Koudougou", phone: "+226 78 44 55 66" },
  });

  const productsData = [
    { name: "Marteau menuisier 500g", sku: "OUT-0001", purchasePrice: 2500, sellingPrice: 4000, minStock: 5 },
    { name: "Tournevis cruciforme", sku: "OUT-0002", purchasePrice: 800, sellingPrice: 1500, minStock: 10 },
    { name: "Perceuse électrique 650W", sku: "OUT-0003", purchasePrice: 25000, sellingPrice: 38000, minStock: 3 },
    { name: "Sac de ciment 50kg", sku: "MAT-0001", purchasePrice: 4500, sellingPrice: 5500, minStock: 20 },
    { name: "Peinture blanche 5L", sku: "MAT-0002", purchasePrice: 8000, sellingPrice: 12000, minStock: 8 },
  ];

  for (const p of productsData) {
    const product = await prisma.product.create({
      data: {
        companyId: company.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        brandId: brand.id,
        supplierId: supplier.id,
        unit: "unité",
        vatRate: 18,
        ...p,
      },
    });
    await prisma.stock.create({ data: { productId: product.id, storeId: mainStore.id, quantity: 50 } });
    await prisma.stock.create({ data: { productId: product.id, storeId: secondStore.id, quantity: 15 } });
  }

  await prisma.expense.createMany({
    data: [
      { companyId: company.id, category: "LOYER", label: "Loyer du mois", amount: 150000 },
      { companyId: company.id, category: "ELECTRICITE", label: "Facture SONABEL", amount: 25000 },
      { companyId: company.id, category: "TRANSPORT", label: "Livraison marchandises", amount: 10000 },
    ],
  });

  console.log("✅ Données de démonstration créées avec succès.");
  console.log("");
  console.log("Comptes de connexion :");
  console.log("  Super Admin  : superadmin@authentique-studio.com / SuperAdmin@2026");
  console.log("  Propriétaire : proprietaire@quincaillerie.demo / Proprietaire@2026");
  console.log("  Caissier     : caissier@quincaillerie.demo / Caissier@2026");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
