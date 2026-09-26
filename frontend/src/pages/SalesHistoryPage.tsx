import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Ban, Eye, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Sale } from "@/types";

const statusVariant: Record<string, "success" | "destructive" | "warning"> = {
  VALIDEE: "success",
  ANNULEE: "destructive",
  RETOURNEE: "warning",
};

// Transforme une date "YYYY-MM-DD" en bornes de journée (00:00:00 -> 23:59:59.999) en heure locale.
function dayBounds(dateStr: string): { from: string; to: string } {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);
  return { from: start.toISOString(), to: end.toISOString() };
}

export default function SalesHistoryPage() {
  const currency = useAuthStore((s) => s.user?.company?.currency) || "XOF";
  const queryClient = useQueryClient();
  const [dayFilter, setDayFilter] = useState("");

  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales", dayFilter],
    queryFn: async () => {
      const params = dayFilter ? dayBounds(dayFilter) : undefined;
      return (await api.get<Sale[]>("/sales", { params })).data;
    },
  });

  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["sale-detail", detailId],
    queryFn: async () => (await api.get<Sale>(`/sales/${detailId}`)).data,
    enabled: !!detailId,
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => api.post(`/sales/${id}/cancel`),
    onSuccess: () => {
      toast.success("Vente annulée, stock restitué");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setCancelTarget(null);
    },
  });

  return (
    <div>
      <PageHeader
        title="Historique des ventes"
        description="Consultez et gérez toutes vos ventes"
        actions={
          <div className="flex items-end gap-2">
            <div>
              <Label className="mb-1 text-xs">Voir une journée précise</Label>
              <Input type="date" className="h-9" value={dayFilter} onChange={(e) => setDayFilter(e.target.value)} />
            </div>
            {dayFilter && (
              <Button variant="outline" size="icon" onClick={() => setDayFilter("")} aria-label="Effacer le filtre">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        }
      />

      {isLoading ? null : !sales?.length ? (
        <EmptyState icon={ClipboardList} title={dayFilter ? "Aucune vente ce jour-là" : "Aucune vente enregistrée"} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Vendeur</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.number}</TableCell>
                <TableCell className="text-muted-foreground">{formatDateTime(s.createdAt)}</TableCell>
                <TableCell>{s.customer?.name || "Comptant"}</TableCell>
                <TableCell className="text-muted-foreground">{s.user?.name || "—"}</TableCell>
                <TableCell className="font-medium tabular-nums">{formatCurrency(s.totalAmount, currency)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[s.status] || "secondary"}>{s.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setDetailId(s.id)} aria-label="Voir les détails">
                    <Eye className="h-4 w-4" />
                  </Button>
                  {s.status === "VALIDEE" && s.type === "VENTE" && (
                    <Button variant="ghost" size="icon" onClick={() => setCancelTarget(s)} aria-label="Annuler">
                      <Ban className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(v) => !v && setCancelTarget(null)}
        title={`Annuler la vente ${cancelTarget?.number} ?`}
        description="Le stock sera automatiquement restitué aux dépôts."
        onConfirm={() => cancelTarget && cancel.mutate(cancelTarget.id)}
        loading={cancel.isPending}
        confirmLabel="Annuler la vente"
      />

      <Dialog open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détails de la vente {detail?.number}</DialogTitle>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium">{formatDateTime(detail.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Statut</p>
                  <Badge variant={statusVariant[detail.status] || "secondary"}>{detail.status}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="font-medium">{detail.customer?.name || "Client comptant"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vendeur</p>
                  <p className="font-medium">{detail.user?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dépôt</p>
                  <p className="font-medium">{detail.store?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Mode de paiement</p>
                  <p className="font-medium">{detail.paymentMethod}</p>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Produits</p>
                <div className="rounded-md border border-border divide-y divide-border">
                  {detail.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{it.product?.name || it.productId}</p>
                        <p className="text-xs text-muted-foreground">
                          {it.quantity} x {formatCurrency(it.unitPrice, currency)}
                        </p>
                      </div>
                      <p className="shrink-0 font-medium tabular-nums">{formatCurrency(it.total, currency)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1 border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span className="tabular-nums">{formatCurrency(detail.subtotal, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remise</span>
                  <span className="tabular-nums">{formatCurrency(detail.discount, currency)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(detail.totalAmount, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payé</span>
                  <span className="tabular-nums">{formatCurrency(detail.paidAmount, currency)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailId(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
