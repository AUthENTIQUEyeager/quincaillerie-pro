import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Truck, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Supplier } from "@/types";

const emptyForm = { name: "", phone: "", email: "", address: "" };

export default function SuppliersPage() {
  const currency = useAuthStore((s) => s.user?.company?.currency) || "XOF";
  const queryClient = useQueryClient();
  const { data: suppliers, isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: async () => (await api.get<Supplier[]>("/suppliers")).data });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [payTarget, setPayTarget] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const save = useMutation({
    mutationFn: async () => (editing ? api.put(`/suppliers/${editing.id}`, form) : api.post("/suppliers", form)),
    onSuccess: () => {
      toast.success(editing ? "Fournisseur mis à jour" : "Fournisseur créé");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setDialogOpen(false);
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/suppliers/${id}`),
    onSuccess: () => {
      toast.success("Fournisseur supprimé");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setDeleteTarget(null);
    },
  });
  const pay = useMutation({
    mutationFn: async () => api.post(`/suppliers/${payTarget!.id}/payments`, { amount: Number(payAmount) }),
    onSuccess: () => {
      toast.success("Paiement enregistré");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setPayTarget(null);
      setPayAmount("");
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }
  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({ name: s.name, phone: s.phone || "", email: s.email || "", address: s.address || "" });
    setDialogOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Fournisseurs"
        description="Gérez vos partenaires d'approvisionnement"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouveau fournisseur
          </Button>
        }
      />

      {isLoading ? null : !suppliers?.length ? (
        <EmptyState icon={Truck} title="Aucun fournisseur" action={<Button onClick={openCreate}>Ajouter un fournisseur</Button>} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Dette</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-muted-foreground">{s.phone || "—"}</TableCell>
                <TableCell>
                  {s.balance > 0 ? <Badge variant="destructive">{formatCurrency(s.balance, currency)}</Badge> : <Badge variant="success">Aucune dette</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {s.balance > 0 && (
                    <Button variant="ghost" size="icon" onClick={() => setPayTarget(s)} aria-label="Payer">
                      <Wallet className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(s)}>
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
            <DialogTitle>{editing ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nom *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Adresse</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button disabled={!form.name} loading={save.isPending} onClick={() => save.mutate()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payTarget} onOpenChange={(v) => !v && setPayTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Payer {payTarget?.name}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Montant ({currency})</Label>
            <Input type="number" min={1} max={payTarget?.balance} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} autoFocus />
            <p className="mt-1 text-xs text-muted-foreground">Dette actuelle : {formatCurrency(payTarget?.balance || 0, currency)}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)}>
              Annuler
            </Button>
            <Button disabled={!payAmount || Number(payAmount) <= 0} loading={pay.isPending} onClick={() => pay.mutate()}>
              Enregistrer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Supprimer ce fournisseur ?"
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
      />
    </div>
  );
}
