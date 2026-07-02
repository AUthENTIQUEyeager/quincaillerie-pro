import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Building2, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import toast from "react-hot-toast";
import type { Store } from "@/types";

const typeLabels: Record<string, string> = {
  MAGASIN_PRINCIPAL: "Magasin principal",
  DEPOT_PRINCIPAL: "Dépôt principal",
  DEPOT_SECONDAIRE: "Dépôt secondaire",
};

export default function StoresPage() {
  const queryClient = useQueryClient();
  const { data: stores, isLoading } = useQuery({ queryKey: ["stores"], queryFn: async () => (await api.get<Store[]>("/stores")).data });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "DEPOT_SECONDAIRE", address: "" });
  const [deleteTarget, setDeleteTarget] = useState<Store | null>(null);

  const create = useMutation({
    mutationFn: async () => api.post("/stores", form),
    onSuccess: () => {
      toast.success("Dépôt créé");
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      setDialogOpen(false);
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/stores/${id}`),
    onSuccess: () => {
      toast.success("Dépôt supprimé");
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      setDeleteTarget(null);
    },
  });

  function openCreate() {
    setForm({ name: "", type: "DEPOT_SECONDAIRE", address: "" });
    setDialogOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Dépôts"
        description="Gérez vos magasins et dépôts de stockage"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouveau dépôt
          </Button>
        }
      />

      {isLoading ? null : !stores?.length ? (
        <EmptyState icon={Building2} title="Aucun dépôt" action={<Button onClick={openCreate}>Créer un dépôt</Button>} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Adresse</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stores.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{typeLabels[s.type]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{s.address || "—"}</TableCell>
                <TableCell className="text-right">
                  {s.type !== "MAGASIN_PRINCIPAL" && (
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(s)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
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
            <DialogTitle>Nouveau dépôt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nom *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="DEPOT_PRINCIPAL">Dépôt principal</option>
                <option value="DEPOT_SECONDAIRE">Dépôt secondaire</option>
              </Select>
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
            <Button disabled={!form.name} loading={create.isPending} onClick={() => create.mutate()}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Supprimer ce dépôt ?"
        description="Le stock associé à ce dépôt sera également supprimé."
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
      />
    </div>
  );
}
