import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Warehouse } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/EmptyState";
import { formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";
import type { StockRow, Product, Store } from "@/types";

export default function StockPage() {
  const queryClient = useQueryClient();
  const { data: stocks, isLoading } = useQuery({ queryKey: ["stock"], queryFn: async () => (await api.get<StockRow[]>("/stock")).data });
  const { data: movements } = useQuery({ queryKey: ["stock-movements"], queryFn: async () => (await api.get("/stock/movements")).data });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: async () => (await api.get<Product[]>("/products")).data });
  const { data: stores } = useQuery({ queryKey: ["stores"], queryFn: async () => (await api.get<Store[]>("/stores")).data });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ productId: "", storeId: "", type: "ENTREE", quantity: 1, reason: "" });

  const create = useMutation({
    mutationFn: async () => api.post("/stock/movements", form),
    onSuccess: () => {
      toast.success("Mouvement de stock enregistré");
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false);
    },
  });

  function openCreate() {
    setForm({ productId: products?.[0]?.id || "", storeId: stores?.[0]?.id || "", type: "ENTREE", quantity: 1, reason: "" });
    setDialogOpen(true);
  }

  const groupedByStore = useMemo(() => {
    if (!stocks) return {};
    return stocks.reduce<Record<string, StockRow[]>>((acc, s) => {
      const key = s.store.name;
      acc[key] = acc[key] || [];
      acc[key].push(s);
      return acc;
    }, {});
  }, [stocks]);

  return (
    <div>
      <PageHeader
        title="Stock"
        description="Suivez les niveaux de stock par dépôt"
        actions={
          <Button onClick={openCreate} disabled={!products?.length || !stores?.length}>
            <Plus className="h-4 w-4" />
            Mouvement manuel
          </Button>
        }
      />

      <Tabs defaultValue="niveaux">
        <TabsList>
          <TabsTrigger value="niveaux">Niveaux de stock</TabsTrigger>
          <TabsTrigger value="mouvements">Historique des mouvements</TabsTrigger>
        </TabsList>

        <TabsContent value="niveaux">
          {isLoading ? null : !stocks?.length ? (
            <EmptyState icon={Warehouse} title="Aucun stock enregistré" />
          ) : (
            Object.entries(groupedByStore).map(([storeName, rows]) => (
              <div key={storeName} className="mb-6">
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{storeName}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Disponible</TableHead>
                      <TableHead>Réservé</TableHead>
                      <TableHead>Endommagé</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <p className="font-medium">{s.product.name}</p>
                          <p className="text-xs text-muted-foreground">{s.product.sku}</p>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {s.quantity} {s.product.unit}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">{s.reserved}</TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">{s.damaged}</TableCell>
                        <TableCell>
                          {s.quantity <= s.product.minStock ? <Badge variant="warning">Stock faible</Badge> : <Badge variant="success">OK</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="mouvements">
          {!movements?.length ? (
            <EmptyState icon={Warehouse} title="Aucun mouvement enregistré" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Dépôt</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantité</TableHead>
                  <TableHead>Motif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground">{formatDateTime(m.createdAt)}</TableCell>
                    <TableCell>{m.product?.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.store?.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{m.type}</Badge>
                    </TableCell>
                    <TableCell className={m.quantity < 0 ? "text-destructive" : "text-success"}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{m.reason || m.reference || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mouvement de stock manuel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Produit</Label>
              <Select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Dépôt</Label>
              <Select value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })}>
                {stores?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="ENTREE">Entrée</option>
                  <option value="SORTIE">Sortie</option>
                  <option value="CORRECTION">Correction</option>
                  <option value="DOMMAGE">Dommage</option>
                </Select>
              </div>
              <div>
                <Label>Quantité</Label>
                <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Motif</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button loading={create.isPending} onClick={() => create.mutate()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
