import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCompany } from "../middleware/auth";
import { asyncHandler, AppError } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth, requireCompany);

function scope(req: any) {
  return req.auth.role === "SUPER_ADMIN" ? {} : { companyId: req.auth.companyId ?? undefined };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: scope(req),
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(notifications);
  })
);

router.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const existing = await prisma.notification.findFirst({ where: { id: req.params.id, ...scope(req) } });
    if (!existing) throw new AppError("Notification introuvable.", 404);
    const notif = await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
    res.json(notif);
  })
);

router.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({ where: { ...scope(req), isRead: false }, data: { isRead: true } });
    res.json({ ok: true });
  })
);

export default router;
