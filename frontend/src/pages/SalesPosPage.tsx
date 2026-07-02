import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Minus, Trash2, ShoppingCart, User, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Product, Store, Customer, Sale } from "@/types";

interface CartLine {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export default function SalesPosPage() {
  const currency = useAuthStore((s) => s.user?.company?.currency) || "XOF";
  const queryClient = useQueryClient();

  const { data: products } = useQuery({ queryKey: ["products"], queryFn: async () => (await api.get<Product[]>("/products")).data });
  const { data: stores } = useQuery({ queryKey: ["stores"], queryFn: async () => (await api.get<Store[]>("/stores")).data });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get<Customer[]>("/customers")).data });

  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("ESPECES");
  const [paidAmount, setPaidAmount] = useState("");
  const [saleType, setSaleType] = useState<"VENTE" | "DEVIS">("VENTE");
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);

  const effectiveStoreId = storeId || stores?.[0]?.id || "";

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q)).slice(0, 30);
  }, [products, search]);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product, quantity: 1, unitPrice: product.sellingPrice, discount: 0 }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) => prev.map((l) => (l.product.id === productId ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l)));
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  }

  const subtotal = cart.reduce((sum, l) => sum + l.quantity * l.unitPrice - l.discount, 0);
  const total = subtotal;

  const createSale = useMutation({
    mutationFn: async () => {
      const payload = {
        storeId: effectiveStoreId,
        customerId: customerId || null,
        type: saleType,
        items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount })),
        discount: 0,
        paidAmount: saleType === "DEVIS" ? 0 : Number(paidAmount || total),
        paymentMethod,
      };
      const { data } = await api.post<Sale>("/sales", payload);
      return data;
    },
    onSuccess: (sale) => {
      toast.success(saleType === "DEVIS" ? "Devis créé" : `Vente ${sale.number} enregistrée`);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      setReceiptSale(sale);
      setCart([]);
      setPaidAmount("");
      setCustomerId("");
    },
  });

  if (!stores?.length) {
    return <EmptyState icon={ShoppingCart} title="Aucun dépôt configuré" description="Créez d'abord un dépôt dans le module Dépôts." />;
  }

  return (
    <div>
      <PageHeader title="Vente rapide" description="Encaissez vos clients en quelques clics" />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher un produit, SKU, code-barres..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
            </div>
            <Select value={effectiveStoreId} onChange={(e) => setStoreId(e.target.value)} className="sm:w-52">
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="flex flex-col items-start rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-accent"
              >
                <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                <span className="mt-1 text-xs text-muted-foreground">{p.sku}</span>
                <span className="mt-2 font-display text-sm font-semibold text-primary">{formatCurrency(p.sellingPrice, currency)}</span>
                <Badge variant={(p.totalStock ?? 0) > p.minStock ? "secondary" : "warning"} className="mt-1.5">
                  {p.totalStock ?? 0} {p.unit}
                </Badge>
              </button>
            ))}
            {!filteredProducts.length && (
              <div className="col-span-full">
                <EmptyState icon={ShoppingCart} title="Aucun produit trouvé" />
              </div>
            )}
          </div>
        </div>

        <div>
          <Card className="sticky top-20">
            <CardContent className="pt-5">
              <div className="mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Client comptant</option>
                  {customers?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="max-h-[320px] space-y-2 overflow-y-auto scrollbar-thin">
                {cart.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Panier vide</p>
                ) : (
                  cart.map((l) => (
                    <div key={l.product.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{l.product.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(l.unitPrice, currency)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(l.product.id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm tabular-nums">{l.quantity}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(l.product.id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLine(l.product.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 space-y-2 border-t border-border pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span className="font-medium tabular-nums">{formatCurrency(subtotal, currency)}</span>
                </div>
                <div className="flex justify-between font-display text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(total, currency)}</span>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <Label>Type</Label>
                  <Select value={saleType} onChange={(e) => setSaleType(e.target.value as any)}>
                    <option value="VENTE">Vente</option>
                    <option value="DEVIS">Devis</option>
                  </Select>
                </div>
                {saleType === "VENTE" && (
                  <>
                    <div>
                      <Label>Mode de paiement</Label>
                      <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                        <option value="ESPECES">Espèces</option>
                        <option value="MOBILE_MONEY">Mobile Money</option>
                        <option value="CARTE">Carte</option>
                        <option value="VIREMENT">Virement</option>
                        <option value="MIXTE">Mixte</option>
                      </Select>
                    </div>
                    <div>
                      <Label>Montant payé</Label>
                      <Input type="number" min={0} placeholder={String(total)} value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
                    </div>
                  </>
                )}

                <Button className="w-full" size="lg" disabled={!cart.length} loading={createSale.isPending} onClick={() => createSale.mutate()}>
                  {saleType === "DEVIS" ? "Créer le devis" : "Valider la vente"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!receiptSale} onOpenChange={(v) => !v && setReceiptSale(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reçu {receiptSale?.number}</DialogTitle>
          </DialogHeader>
          {receiptSale && (
            <div className="space-y-2 font-mono text-xs">
              {receiptSale.items.map((it) => (
                <div key={it.id} className="flex justify-between">
                  <span>
                    {it.quantity} x {it.product?.name || it.productId}
                  </span>
                  <span>{formatCurrency(it.total, currency)}</span>
                </div>
              ))}
              <div className="border-t border-border pt-2 flex justify-between font-semibold">
                <span>TOTAL</span>
                <span>{formatCurrency(receiptSale.totalAmount, currency)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Imprimer
            </Button>
            <Button onClick={() => setReceiptSale(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
