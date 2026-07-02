import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCompany } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth, requireCompany);

function companyFilter(req: any) {
  return req.auth.role === "SUPER_ADMIN" ? undefined : req.auth.companyId;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const companyId = companyFilter(req);
    const saleWhere: any = { status: "VALIDEE", type: "VENTE" };
    if (companyId) saleWhere.companyId = companyId;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [salesMonth, salesToday, purchasesMonth, expensesMonth, customersDebt, suppliersDebt, lowStockProducts, topProductsRaw, recentSales, salesLast30Days] =
      await Promise.all([
        prisma.sale.aggregate({ where: { ...saleWhere, createdAt: { gte: startOfMonth } }, _sum: { totalAmount: true }, _count: true }),
        prisma.sale.aggregate({ where: { ...saleWhere, createdAt: { gte: startOfDay } }, _sum: { totalAmount: true }, _count: true }),
        prisma.purchase.aggregate({ where: { companyId, createdAt: { gte: startOfMonth } }, _sum: { totalAmount: true }, _count: true }),
        prisma.expense.aggregate({ where: { companyId, createdAt: { gte: startOfMonth } }, _sum: { amount: true } }),
        prisma.customer.aggregate({ where: { companyId, balance: { gt: 0 } }, _sum: { balance: true } }),
        prisma.supplier.aggregate({ where: { companyId, balance: { gt: 0 } }, _sum: { balance: true } }),
        prisma.product.findMany({
          where: { companyId, isActive: true },
          include: { stocks: true },
        }),
        prisma.saleItem.groupBy({
          by: ["productId"],
          where: { sale: { ...saleWhere } },
          _sum: { quantity: true, total: true },
          orderBy: { _sum: { total: "desc" } },
          take: 5,
        }),
        prisma.sale.findMany({
          where: saleWhere,
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { customer: true, user: { select: { name: true } } },
        }),
        prisma.sale.findMany({
          where: { ...saleWhere, createdAt: { gte: new Date(now.getTime() - 30 * 24 * 3600 * 1000) } },
          select: { totalAmount: true, createdAt: true },
        }),
      ]);

    const lowStock = lowStockProducts
      .map((p) => ({ id: p.id, name: p.name, sku: p.sku, totalStock: p.stocks.reduce((s, st) => s + st.quantity, 0), minStock: p.minStock }))
      .filter((p) => p.totalStock <= p.minStock);

    const topProductIds = topProductsRaw.map((t) => t.productId);
    const topProductsInfo = await prisma.product.findMany({ where: { id: { in: topProductIds } }, select: { id: true, name: true, sku: true } });
    const topProducts = topProductsRaw.map((t) => ({
      product: topProductsInfo.find((p) => p.id === t.productId),
      quantity: t._sum.quantity,
      total: t._sum.total,
    }));

    // Regrouper les ventes par jour pour le graphique
    const salesByDay: Record<string, number> = {};
    for (const s of salesLast30Days) {
      const key = s.createdAt.toISOString().slice(0, 10);
      salesByDay[key] = (salesByDay[key] || 0) + s.totalAmount;
    }

    const revenue = salesMonth._sum.totalAmount || 0;
    const expensesTotal = expensesMonth._sum.amount || 0;
    const purchasesTotal = purchasesMonth._sum.totalAmount || 0;

    res.json({
      revenueMonth: revenue,
      salesCountMonth: salesMonth._count,
      revenueToday: salesToday._sum.totalAmount || 0,
      salesCountToday: salesToday._count,
      purchasesMonth: purchasesTotal,
      expensesMonth: expensesTotal,
      profitMonth: revenue - purchasesTotal - expensesTotal,
      customersDebt: customersDebt._sum.balance || 0,
      suppliersDebt: suppliersDebt._sum.balance || 0,
      lowStockCount: lowStock.length,
      lowStockProducts: lowStock.slice(0, 10),
      topProducts,
      recentSales,
      salesChart: Object.entries(salesByDay)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, total]) => ({ date, total })),
    });
  })
);

export default router;
