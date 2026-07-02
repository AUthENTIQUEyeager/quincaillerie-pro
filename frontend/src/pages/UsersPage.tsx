import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, KeyRound, Ban, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";
import type { AppUser } from "@/types";

const ROLE_LABELS: Record<string, string> = {
  PROPRIETAIRE: "Propriétaire",
  GERANT: "Gérant",
  CAISSIER: "Caissier",
  MAGASINIER: "Magasinier",
  COMPTABLE: "Comptable",
  LIVREUR: "Livreur",
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({ queryKey: ["users"], queryFn: async () => (await api.get<AppUser[]>("/users")).data });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "CAISSIER" });

  const create = useMutation({
    mutationFn: async () => api.post("/users", form),
    onSuccess: () => {
      toast.success("Utilisateur créé");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDialogOpen(false);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => api.put(`/users/${id}`, { isActive }),
    onSuccess: () => {
      toast.success("Statut mis à jour");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  function openCreate() {
    setForm({ name: "", email: "", phone: "", password: "", role: "CAISSIER" });
    setDialogOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        description="Gérez les comptes de connexion et permissions"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouvel utilisateur
          </Button>
        }
      />

      {isLoading ? null : !users?.length ? (
        <EmptyState icon={KeyRound} title="Aucun utilisateur" action={<Button onClick={openCreate}>Créer un utilisateur</Button>} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Dernière connexion</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{ROLE_LABELS[u.role]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Jamais"}</TableCell>
                <TableCell>
                  <Badge variant={u.isActive ? "success" : "destructive"}>{u.isActive ? "Actif" : "Désactivé"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {u.role !== "PROPRIETAIRE" && (
                    <Button variant="ghost" size="icon" onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}>
                      {u.isActive ? <Ban className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-success" />}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel utilisateur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nom *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Mot de passe *</Label>
              <Input type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <Label>Rôle</Label>
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
            <Button disabled={!form.name || !form.email || form.password.length < 6} loading={create.isPending} onClick={() => create.mutate()}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
