import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, ShoppingCart, Receipt, RotateCcw, AlertTriangle, Database, RefreshCw, CircleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { cn, formatDateTime } from "@/lib/utils";
import type { Notification } from "@/types";

const ICONS: Record<string, any> = {
  NOUVELLE_VENTE: ShoppingCart,
  NOUVEL_ACHAT: Receipt,
  RETOUR: RotateCcw,
  STOCK_FAIBLE: AlertTriangle,
  ERREUR: CircleAlert,
  SAUVEGARDE: Database,
  SYNCHRONISATION: RefreshCw,
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useQuery({ queryKey: ["notifications", "unread-count"], queryFn: async () => (await api.get<Notification[]>("/notifications")).data });

  const markAllRead = useMutation({
    mutationFn: async () => api.post("/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Restez informé de l'activité de votre entreprise"
        actions={
          <Button variant="outline" onClick={() => markAllRead.mutate()} disabled={!notifications?.some((n) => !n.isRead)}>
            Tout marquer comme lu
          </Button>
        }
      />

      {isLoading ? null : !notifications?.length ? (
        <EmptyState icon={Bell} title="Aucune notification" />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = ICONS[n.type] || Bell;
            return (
              <button
                key={n.id}
                onClick={() => !n.isRead && markRead.mutate(n.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-secondary/40",
                  !n.isRead && "bg-primary/5 border-primary/20"
                )}
              >
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", !n.isRead ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{n.title}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                </div>
                {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
