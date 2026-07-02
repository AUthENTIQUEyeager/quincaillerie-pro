import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Ban } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Sale } from "@/types";

const statusVariant: Record<string, "success" | "destructive" | "warning"> = {
  VALIDEE: "success",
  ANNULEE: "destructive",
  RETOURNEE: "warning",
};

export default function SalesHistoryPage() {
  const currency = useAuthStore((s) => s.user?.company?.currency) || "XOF";
  const queryClient = useQueryClient();
  const { data: sales, isLoading } = useQuery({ queryKey: ["sales"], queryFn: async () => (await api.get<Sale[]>("/sales")).data });
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);

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
      <PageHeader title="Historique des ventes" description="Consultez et gérez toutes vos ventes" />

      {isLoading ? null : !sales?.length ? (
        <EmptyState icon={ClipboardList} title="Aucune vente enregistrée" />
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
    </div>
  );
}
