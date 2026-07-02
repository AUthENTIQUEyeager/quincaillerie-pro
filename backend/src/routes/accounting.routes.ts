import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCompany, requireRole } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth, requireCompany);

function companyFilter(req: any) {
  return req.auth.role === "SUPER_ADMIN" ? undefined : req.auth.companyId;
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

    const revenue = salesTotal._sum.totalAmount || 0;
    const purchasesSum = purchasesTotal._sum.totalAmount || 0;
    const expensesSum = expensesTotal._sum.amount || 0;

    res.json({
      revenue,
      purchases: purchasesSum,
      expenses: expensesSum,
      profit: revenue - purchasesSum - expensesSum,
      expensesByCategory: expensesByCategory.map((e) => ({ category: e.category, total: e._sum.amount })),
      sales,
      purchaseList: purchases,
    });
  })
);

export default router;
