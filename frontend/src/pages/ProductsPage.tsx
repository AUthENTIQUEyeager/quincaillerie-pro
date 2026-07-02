import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Package, ImageOff } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Product, Category, Brand, Supplier } from "@/types";

const emptyForm = {
  name: "",
  sku: "",
  reference: "",
  barcode: "",
  categoryId: "",
  subCategoryId: "",
  brandId: "",
  supplierId: "",
  unit: "unité",
  description: "",
  purchasePrice: 0,
  sellingPrice: 0,
  wholesalePrice: "",
  resellerPrice: "",
  promoPrice: "",
  vatRate: 0,
  minStock: 0,
  maxStock: "",
  hasSerial: false,
  photoUrl: "",
};

export default function ProductsPage() {
  const currency = useAuthStore((s) => s.user?.company?.currency) || "XOF";
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await api.get<Product[]>("/products")).data,
  });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: async () => (await api.get<Category[]>("/categories")).data });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: async () => (await api.get<Brand[]>("/brands")).data });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: async () => (await api.get<Supplier[]>("/suppliers")).data });

  const subCategories = useMemo(() => categories?.find((c) => c.id === form.categoryId)?.subCategories || [], [categories, form.categoryId]);

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q));
  }, [products, search]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        categoryId: form.categoryId || null,
        subCategoryId: form.subCategoryId || null,
        brandId: form.brandId || null,
        supplierId: form.supplierId || null,
        purchasePrice: Number(form.purchasePrice),
        sellingPrice: Number(form.sellingPrice),
        wholesalePrice: form.wholesalePrice ? Number(form.wholesalePrice) : null,
        resellerPrice: form.resellerPrice ? Number(form.resellerPrice) : null,
        promoPrice: form.promoPrice ? Number(form.promoPrice) : null,
        vatRate: Number(form.vatRate),
        minStock: Number(form.minStock),
        maxStock: form.maxStock ? Number(form.maxStock) : null,
        photoUrl: form.photoUrl || null,
      };
      if (editing) return api.put(`/products/${editing.id}`, payload);
      return api.post("/products", payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Produit mis à jour" : "Produit créé");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success("Produit supprimé");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDeleteTarget(null);
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      reference: p.reference || "",
      barcode: p.barcode || "",
      categoryId: p.categoryId || "",
      subCategoryId: p.subCategoryId || "",
      brandId: p.brandId || "",
      supplierId: p.supplierId || "",
      unit: p.unit,
      description: p.description || "",
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      wholesalePrice: p.wholesalePrice?.toString() || "",
      resellerPrice: p.resellerPrice?.toString() || "",
      promoPrice: p.promoPrice?.toString() || "",
      vatRate: p.vatRate,
      minStock: p.minStock,
      maxStock: p.maxStock?.toString() || "",
      hasSerial: p.hasSerial,
      photoUrl: p.photoUrl || "",
    });
    setDialogOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Produits"
        description="Gérez votre catalogue d'articles"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouveau produit
          </Button>
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Rechercher par nom, SKU, code-barres..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="Aucun produit trouvé" description="Ajoutez votre premier produit pour commencer à vendre." action={<Button onClick={openCreate}>Ajouter un produit</Button>} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Prix de vente</TableHead>
              <TableHead>Stock total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
                      {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-full w-full object-cover" /> : <ImageOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <span className="font-medium">{p.name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{p.sku}</TableCell>
                <TableCell className="text-muted-foreground">{p.category?.name || "—"}</TableCell>
                <TableCell className="font-medium tabular-nums">{formatCurrency(p.sellingPrice, currency)}</TableCell>
                <TableCell>
                  <Badge variant={(p.totalStock ?? 0) <= p.minStock ? "warning" : "secondary"}>
                    {p.totalStock ?? 0} {p.unit}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="Modifier">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(p)} aria-label="Supprimer">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="prix">Prix & TVA</TabsTrigger>
              <TabsTrigger value="stock">Stock</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Nom du produit *</Label>
                  <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Marteau menuisier 500g" />
                </div>
                <div>
                  <Label>SKU *</Label>
                  <Input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="OUT-0001" />
                </div>
                <div>
                  <Label>Code-barres</Label>
                  <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                </div>
                <div>
                  <Label>Référence</Label>
                  <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                </div>
                <div>
                  <Label>Unité</Label>
                  <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="unité, kg, sac..." />
                </div>
                <div>
                  <Label>Catégorie</Label>
                  <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value, subCategoryId: "" })}>
                    <option value="">Aucune</option>
                    {categories?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Sous-catégorie</Label>
                  <Select value={form.subCategoryId} onChange={(e) => setForm({ ...form, subCategoryId: e.target.value })} disabled={!form.categoryId}>
                    <option value="">Aucune</option>
                    {subCategories.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Marque</Label>
                  <Select value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
                    <option value="">Aucune</option>
                    {brands?.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Fournisseur</Label>
                  <Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                    <option value="">Aucun</option>
                    {suppliers?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>URL photo</Label>
                  <Input value={form.photoUrl} onChange={(e) => setForm({ ...form, photoUrl: e.target.value })} placeholder="https://..." />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="prix" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prix d'achat *</Label>
                  <Input type="number" min={0} required value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Prix de vente *</Label>
                  <Input type="number" min={0} required value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Prix grossiste</Label>
                  <Input type="number" min={0} value={form.wholesalePrice} onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} />
                </div>
                <div>
                  <Label>Prix revendeur</Label>
                  <Input type="number" min={0} value={form.resellerPrice} onChange={(e) => setForm({ ...form, resellerPrice: e.target.value })} />
                </div>
                <div>
                  <Label>Prix promotionnel</Label>
                  <Input type="number" min={0} value={form.promoPrice} onChange={(e) => setForm({ ...form, promoPrice: e.target.value })} />
                </div>
                <div>
                  <Label>TVA (%)</Label>
                  <Input type="number" min={0} max={100} value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="stock" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Stock minimum</Label>
                  <Input type="number" min={0} value={form.minStock} onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Stock maximum</Label>
                  <Input type="number" min={0} value={form.maxStock} onChange={(e) => setForm({ ...form, maxStock: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.hasSerial} onChange={(e) => setForm({ ...form, hasSerial: e.target.checked })} className="h-4 w-4 rounded border-input" />
                Ce produit nécessite un numéro de série
              </label>
              {editing && (
                <div className="rounded-md border border-border p-3">
                  <p className="mb-2 text-sm font-medium">Stock par dépôt</p>
                  <div className="space-y-1">
                    {editing.stocks?.map((s) => (
                      <div key={s.id} className={cn("flex justify-between text-sm")}>
                        <span className="text-muted-foreground">{s.store?.name}</span>
                        <span className="font-medium tabular-nums">{s.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Utilisez le module Stock pour ajuster les quantités.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button loading={saveMutation.isPending} disabled={!form.name || !form.sku} onClick={() => saveMutation.mutate()}>
              {editing ? "Enregistrer" : "Créer le produit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Supprimer ce produit ?"
        description={`"${deleteTarget?.name}" sera définitivement supprimé, y compris son historique de stock.`}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
