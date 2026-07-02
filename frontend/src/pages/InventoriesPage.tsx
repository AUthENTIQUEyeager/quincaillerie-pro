import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ClipboardCheck, Check } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Store, Product } from "@/types";

export default function InventoriesPage() {
  const queryClient = useQueryClient();
  const { data: inventories, isLoading } = useQuery({ queryKey: ["inventories"], queryFn: async () => (await api.get("/stock/inventories")).data });
  const { data: stores } = useQuery({ queryKey: ["stores"], queryFn: async () => (await api.get<Store[]>("/stores")).data });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: async () => (await api.get<Product[]>("/products")).data });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [storeId, setStoreId] = useState("");
  const [note, setNote] = useState("");

  const [lineDialog, setLineDialog] = useState<any | null>(null);
  const [lineProductId, setLineProductId] = useState("");
  const [countedQty, setCountedQty] = useState("");
  const [closeTarget, setCloseTarget] = useState<any | null>(null);

  const start = useMutation({
    mutationFn: async () => (await api.post("/stock/inventories", { storeId, note })).data,
    onSuccess: () => {
      toast.success("Inventaire démarré");
      queryClient.invalidateQueries({ queryKey: ["inventories"] });
      setDialogOpen(false);
    },
  });

  const addLine = useMutation({
    mutationFn: async () => api.post(`/stock/inventories/${lineDialog.id}/lines`, { productId: lineProductId, countedQty: Number(countedQty) }),
    onSuccess: () => {
      toast.success("Ligne ajoutée");
      queryClient.invalidateQueries({ queryKey: ["inventories"] });
      setCountedQty("");
    },
  });

  const closeInventory = useMutation({
    mutationFn: async (id: string) => api.post(`/stock/inventories/${id}/close`),
    onSuccess: () => {
      toast.success("Inventaire clôturé, stock ajusté");
      queryClient.invalidateQueries({ queryKey: ["inventories"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      setCloseTarget(null);
      setLineDialog(null);
    },
  });

  function openCreate() {
    setStoreId(stores?.[0]?.id || "");
    setNote("");
    setDialogOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Inventaires"
        description="Comptez physiquement votre stock et ajustez les écarts"
        actions={
          <Button onClick={openCreate} disabled={!stores?.length}>
            <Plus className="h-4 w-4" />
            Démarrer un inventaire
          </Button>
        }
      />

      {isLoading ? null : !inventories?.length ? (
        <EmptyState icon={ClipboardCheck} title="Aucun inventaire" action={<Button onClick={openCreate}>Démarrer un inventaire</Button>} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Dépôt</TableHead>
              <TableHead>Lignes</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventories.map((inv: any) => (
              <TableRow key={inv.id}>
                <TableCell className="text-muted-foreground">{formatDateTime(inv.createdAt)}</TableCell>
                <TableCell>{inv.store?.name}</TableCell>
                <TableCell className="text-muted-foreground">{inv.lines?.length || 0}</TableCell>
                <TableCell>
                  <Badge variant={inv.status === "TERMINE" ? "success" : "warning"}>{inv.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {inv.status !== "TERMINE" && (
                    <Button variant="outline" size="sm" onClick={() => setLineDialog(inv)}>
                      Compter
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
            <DialogTitle>Démarrer un inventaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Dépôt</Label>
              <Select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                {stores?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Inventaire de fin de mois..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button loading={start.isPending} onClick={() => start.mutate()}>
              Démarrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lineDialog} onOpenChange={(v) => !v && setLineDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comptage — {lineDialog?.store?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>Produit</Label>
              <Select value={lineProductId} onChange={(e) => setLineProductId(e.target.value)}>
                <option value="">Sélectionner...</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-28">
              <Label>Qté comptée</Label>
              <Input type="number" min={0} value={countedQty} onChange={(e) => setCountedQty(e.target.value)} />
            </div>
            <Button disabled={!lineProductId || countedQty === ""} loading={addLine.isPending} onClick={() => addLine.mutate()}>
              <Check className="h-4 w-4" />
            </Button>
          </div>
          {lineDialog?.lines?.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto scrollbar-thin space-y-1 text-sm">
              {lineDialog.lines.map((l: any) => (
                <div key={l.id} className="flex justify-between border-b border-border py-1">
                  <span className="text-muted-foreground">{products?.find((p) => p.id === l.productId)?.name || l.productId}</span>
                  <span className={l.difference !== 0 ? "text-warning font-medium" : ""}>
                    {l.countedQty} (écart {l.difference > 0 ? `+${l.difference}` : l.difference})
                  </span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineDialog(null)}>
              Fermer
            </Button>
            <Button variant="destructive" onClick={() => setCloseTarget(lineDialog)}>
              Clôturer l'inventaire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!closeTarget}
        onOpenChange={(v) => !v && setCloseTarget(null)}
        title="Clôturer cet inventaire ?"
        description="Le stock sera ajusté automatiquement selon les quantités comptées."
        onConfirm={() => closeTarget && closeInventory.mutate(closeTarget.id)}
        loading={closeInventory.isPending}
        confirmLabel="Clôturer"
      />
    </div>
  );
}
