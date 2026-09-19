import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Warehouse, Search, Check } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/EmptyState";
import { cn, formatDateTime } from "@/lib/utils";
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

  // Recherche + sélection du produit dans le formulaire de mouvement manuel.
  // La sélection se fait UNIQUEMENT par clic sur un résultat (jamais via un
  // <select> natif dont les options changent pendant la frappe) pour éviter
  // tout risque de désynchronisation entre ce qui est affiché et le produit
  // réellement enregistré dans le formulaire.
  const [productSearch, setProductSearch] = useState("");
  const [productResultsOpen, setProductResultsOpen] = useState(false);
  const selectedProduct = useMemo(() => products?.find((p) => p.id === form.productId) || null, [products, form.productId]);

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
    const defaultProduct = products?.[0] || null;
    setForm({ productId: defaultProduct?.id || "", storeId: stores?.[0]?.id || "", type: "ENTREE", quantity: 1, reason: "" });
    setProductSearch("");
    setProductResultsOpen(false);
    setDialogOpen(true);
  }

  function selectProduct(p: Product) {
    setForm((f) => ({ ...f, productId: p.id }));
    setProductSearch("");
    setProductResultsOpen(false);
  }

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const q = productSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 20);
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q)).slice(0, 20);
  }, [products, productSearch]);

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

              {/* Produit actuellement retenu pour ce mouvement : toujours visible, sans ambiguïté */}
              {selectedProduct && (
                <div className="mb-2 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-sm">
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-medium">{selectedProduct.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{selectedProduct.sku}</span>
                </div>
              )}

              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un autre produit pour changer la sélection..."
                  className="h-8 pl-8 text-sm"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setProductResultsOpen(true);
                  }}
                  onFocus={() => setProductResultsOpen(true)}
                />
              </div>

              {productResultsOpen && (
                <div className="mt-1 max-h-48 overflow-y-auto scrollbar-thin rounded-md border border-border">
                  {filteredProducts.length === 0 ? (
                    <p className="p-2.5 text-sm text-muted-foreground">Aucun produit trouvé.</p>
                  ) : (
                    filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectProduct(p)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-secondary",
                          p.id === form.productId && "bg-primary/10"
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{p.sku}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
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
            <Button loading={create.isPending} disabled={!form.productId || !form.storeId} onClick={() => create.mutate()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
