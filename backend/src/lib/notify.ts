import { prisma } from "./prisma";

export async function pushNotification(companyId: string, type: string, title: string, message: string, userId?: string) {
  try {
    await prisma.notification.create({ data: { companyId, type, title, message, userId } });
  } catch (err) {
    console.error("Erreur lors de la création de la notification :", err);
  }
}
