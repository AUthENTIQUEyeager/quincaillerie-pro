import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCompany, requireRole } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth, requireCompany);

function companyFilter(req: any) {
  return req.auth.role === "SUPER_ADMIN" ? undefined : req.auth.companyId ?? undefined;
}

router.get(
  "/summary",
  requireRole("PROPRIETAIRE", "GERANT", "COMPTABLE"),
  asyncHandler(async (req, res) => {
    const companyId = companyFilter(req);
    const { from, to } = req.query as Record<string, string>;
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const saleWhere: any = { status: "VALIDEE", type: "VENTE" };
    if (companyId) saleWhere.companyId = companyId;
    if (from || to) saleWhere.createdAt = dateFilter;

    const purchaseWhere: any = { companyId };
    if (from || to) purchaseWhere.createdAt = dateFilter;

    const expenseWhere: any = { companyId };
    if (from || to) expenseWhere.createdAt = dateFilter;

    const [sales, purchases, expensesByCategory, salesTotal, purchasesTotal, expensesTotal] = await Promise.all([
      prisma.sale.findMany({ where: saleWhere, select: { id: true, number: true, totalAmount: true, createdAt: true } }),
      prisma.purchase.findMany({ where: purchaseWhere, select: { id: true, number: true, totalAmount: true, createdAt: true } }),
      prisma.expense.groupBy({ by: ["category"], where: expenseWhere, _sum: { amount: true } }),
      prisma.sale.aggregate({ where: saleWhere, _sum: { totalAmount: true } }),
      prisma.purchase.aggregate({ where: purchaseWhere, _sum: { totalAmount: true } }),
      prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true } }),
    ]);

    // Encaissements par mode de paiement (ventes validées de la période)
    const [paymentRows, legacyRows] = await Promise.all([
      prisma.salePayment.groupBy({ by: ["method"], where: { sale: saleWhere }, _sum: { amount: true } }),
      // Anciennes ventes (avant le paiement multi-modes) : un seul mode, non détaillé
      prisma.sale.groupBy({
        by: ["paymentMethod"],
        where: { ...saleWhere, salePayments: { none: {} }, paidAmount: { gt: 0 } },
        _sum: { paidAmount: true },
      }),
    ]);
    const byMethod = new Map<string, number>();
    for (const r of paymentRows) byMethod.set(r.method, (byMethod.get(r.method) || 0) + (r._sum.amount || 0));
    for (const r of legacyRows) byMethod.set(r.paymentMethod, (byMethod.get(r.paymentMethod) || 0) + (r._sum.paidAmount || 0));
    const paymentsByMethod = [...byMethod.entries()].map(([method, total]) => ({ method, total })).sort((a, b) => b.total - a.total);

    const revenue = salesTotal._sum.totalAmount || 0;
    const purchasesSum = purchasesTotal._sum.totalAmount || 0;
    const expensesSum = expensesTotal._sum.amount || 0;

    res.json({
      revenue,
      purchases: purchasesSum,
      expenses: expensesSum,
      profit: revenue - purchasesSum - expensesSum,
      expensesByCategory: expensesByCategory.map((e) => ({ category: e.category, total: e._sum.amount })),
      paymentsByMethod,
      sales,
      purchaseList: purchases,
    });
  })
);

export default router;
