import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Users, Wallet } from "lucide-react";
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
import type { Customer } from "@/types";

const emptyForm = { name: "", phone: "", email: "", address: "", discount: 0 };

export default function CustomersPage() {
  const currency = useAuthStore((s) => s.user?.company?.currency) || "XOF";
  const queryClient = useQueryClient();
  const { data: customers, isLoading } = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get<Customer[]>("/customers")).data });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [payTarget, setPayTarget] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const save = useMutation({
    mutationFn: async () => (editing ? api.put(`/customers/${editing.id}`, form) : api.post("/customers", form)),
    onSuccess: () => {
      toast.success(editing ? "Client mis à jour" : "Client créé");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setDialogOpen(false);
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      toast.success("Client supprimé");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setDeleteTarget(null);
    },
  });
  const pay = useMutation({
    mutationFn: async () => api.post(`/customers/${payTarget!.id}/payments`, { amount: Number(payAmount) }),
    onSuccess: () => {
      toast.success("Paiement enregistré");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setPayTarget(null);
      setPayAmount("");
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }
  function openEdit(c: Customer) {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone || "", email: c.email || "", address: c.address || "", discount: c.discount });
    setDialogOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Gérez votre fichier clients"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouveau client
          </Button>
        }
      />

      {isLoading ? null : !customers?.length ? (
        <EmptyState icon={Users} title="Aucun client" action={<Button onClick={openCreate}>Ajouter un client</Button>} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Remise</TableHead>
              <TableHead>Dette</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.phone || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.discount}%</TableCell>
                <TableCell>
                  {c.balance > 0 ? <Badge variant="destructive">{formatCurrency(c.balance, currency)}</Badge> : <Badge variant="success">À jour</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {c.balance > 0 && (
                    <Button variant="ghost" size="icon" onClick={() => setPayTarget(c)} aria-label="Encaisser">
                      <Wallet className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)}>
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
            <DialogTitle>{editing ? "Modifier le client" : "Nouveau client"}</DialogTitle>
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
            <div>
              <Label>Remise par défaut (%)</Label>
              <Input type="number" min={0} max={100} value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} />
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
            <DialogTitle>Encaisser {payTarget?.name}</DialogTitle>
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
        title="Supprimer ce client ?"
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
      />
    </div>
  );
}
