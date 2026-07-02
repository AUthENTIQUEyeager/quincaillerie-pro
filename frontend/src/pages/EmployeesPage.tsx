import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, UserCog } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Employee } from "@/types";

const ROLE_LABELS: Record<string, string> = {
  PROPRIETAIRE: "Propriétaire",
  GERANT: "Gérant",
  CAISSIER: "Caissier",
  MAGASINIER: "Magasinier",
  COMPTABLE: "Comptable",
  LIVREUR: "Livreur",
};

const emptyForm = { name: "", phone: "", position: "", role: "CAISSIER" };

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const { data: employees, isLoading } = useQuery({ queryKey: ["employees"], queryFn: async () => (await api.get<Employee[]>("/employees")).data });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  const save = useMutation({
    mutationFn: async () => (editing ? api.put(`/employees/${editing.id}`, form) : api.post("/employees", form)),
    onSuccess: () => {
      toast.success(editing ? "Employé mis à jour" : "Employé ajouté");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setDialogOpen(false);
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => {
      toast.success("Employé supprimé");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setDeleteTarget(null);
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }
  function openEdit(e: Employee) {
    setEditing(e);
    setForm({ name: e.name, phone: e.phone || "", position: e.position || "", role: e.role });
    setDialogOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Employés"
        description="Gérez votre équipe et leurs fonctions"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouvel employé
          </Button>
        }
      />

      {isLoading ? null : !employees?.length ? (
        <EmptyState icon={UserCog} title="Aucun employé" action={<Button onClick={openCreate}>Ajouter un employé</Button>} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Fonction</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Depuis</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.name}</TableCell>
                <TableCell className="text-muted-foreground">{e.position || "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{ROLE_LABELS[e.role]}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={e.status === "ACTIF" ? "success" : e.status === "SUSPENDU" ? "warning" : "destructive"}>{e.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(e.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
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
            <DialogTitle>{editing ? "Modifier l'employé" : "Nouvel employé"}</DialogTitle>
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
              <Label>Fonction</Label>
              <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Vendeur, Magasinier..." />
            </div>
            <div>
              <Label>Rôle système</Label>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {Object.entries(ROLE_LABELS)
                  .filter(([k]) => k !== "PROPRIETAIRE")
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </Select>
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

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Supprimer cet employé ?"
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
      />
    </div>
  );
}
