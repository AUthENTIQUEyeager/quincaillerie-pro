import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Expense } from "@/types";

const CATEGORY_LABELS: Record<string, string> = {
  SALAIRES: "Salaires",
  TRANSPORT: "Transport",
  ELECTRICITE: "Électricité",
  INTERNET: "Internet",
  LOYER: "Loyer",
  IMPOTS: "Impôts",
  DIVERS: "Divers",
};

export default function ExpensesPage() {
  const currency = useAuthStore((s) => s.user?.company?.currency) || "XOF";
  const queryClient = useQueryClient();
  const { data: expenses, isLoading } = useQuery({ queryKey: ["expenses"], queryFn: async () => (await api.get<Expense[]>("/expenses")).data });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ category: "DIVERS", label: "", amount: "", note: "" });
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const create = useMutation({
    mutationFn: async () => api.post("/expenses", { ...form, amount: Number(form.amount) }),
    onSuccess: () => {
      toast.success("Dépense enregistrée");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDialogOpen(false);
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      toast.success("Dépense supprimée");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setDeleteTarget(null);
    },
  });

  function openCreate() {
    setForm({ category: "DIVERS", label: "", amount: "", note: "" });
    setDialogOpen(true);
  }

  const total = expenses?.reduce((s, e) => s + e.amount, 0) || 0;

  return (
    <div>
      <PageHeader
        title="Dépenses"
        description={`Total enregistré : ${formatCurrency(total, currency)}`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouvelle dépense
          </Button>
        }
      />

      {isLoading ? null : !expenses?.length ? (
        <EmptyState icon={Wallet} title="Aucune dépense enregistrée" action={<Button onClick={openCreate}>Ajouter une dépense</Button>} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-muted-foreground">{formatDateTime(e.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{CATEGORY_LABELS[e.category] || e.category}</Badge>
                </TableCell>
                <TableCell>{e.label}</TableCell>
                <TableCell className="font-medium tabular-nums">{formatCurrency(e.amount, currency)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(e)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle dépense</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Catégorie</Label>
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Libellé *</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Facture SONABEL de juin" />
            </div>
            <div>
              <Label>Montant *</Label>
              <Input type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>Note</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button disabled={!form.label || !form.amount} loading={create.isPending} onClick={() => create.mutate()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Supprimer cette dépense ?"
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
      />
    </div>
  );
}
