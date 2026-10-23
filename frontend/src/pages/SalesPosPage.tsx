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
import { formatCurrency, paymentLabel } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Product, Store, Customer, Sale } from "@/types";

// Les 3 tarifs disponibles à la vente, définis sur la fiche produit.
type PriceTier = "VENTE" | "GROSSISTE" | "REVENDEUR" | "PROMOTIONNEL";

interface PaymentLine {
  key: string;
  method: string;
  amount: string;
}

const PAYMENT_METHODS = ["ESPECES", "MOBILE_MONEY", "VIREMENT", "CARTE"] as const;

interface CartLine {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
  priceTier: PriceTier;
}

// Retourne le prix correspondant au tarif choisi ; si ce tarif n'est pas
// renseigné sur la fiche produit, revient automatiquement au prix officiel.
function priceForTier(product: Product, tier: PriceTier): number {
  if (tier === "GROSSISTE") return product.wholesalePrice ?? product.sellingPrice;
  if (tier === "REVENDEUR") return product.resellerPrice ?? product.sellingPrice;
  if (tier === "PROMOTIONNEL") return product.promoPrice ?? product.sellingPrice;
  return product.sellingPrice;
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
  // Paiement en plusieurs tranches : une ligne par mode (espèces, mobile money, virement...)
  const newPaymentLine = (): PaymentLine => ({ key: Math.random().toString(36).slice(2), method: "ESPECES", amount: "" });
  const [payments, setPayments] = useState<PaymentLine[]>(() => [newPaymentLine()]);
  const [saleType, setSaleType] = useState<"VENTE" | "DEVIS">("VENTE");
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);

  const effectiveStoreId = storeId || stores?.[0]?.id || "";

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    const base = q
      ? products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q))
      : products;
    // Produits avec le plus de stock disponible en premier.
    const sorted = [...base].sort((a, b) => (b.totalStock ?? 0) - (a.totalStock ?? 0));
    return sorted.slice(0, 30);
  }, [products, search]);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product, quantity: 1, unitPrice: product.sellingPrice, discount: 0, priceTier: "VENTE" }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) => prev.map((l) => (l.product.id === productId ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l)));
  }

  function setLineTier(productId: string, tier: PriceTier) {
    setCart((prev) => prev.map((l) => (l.product.id === productId ? { ...l, priceTier: tier, unitPrice: priceForTier(l.product, tier) } : l)));
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  }

  const subtotal = cart.reduce((sum, l) => sum + l.quantity * l.unitPrice - l.discount, 0);
  const total = subtotal;

  // Montants saisis. Une seule ligne laissée vide = le client paie le total (comportement habituel).
  const parsedAmounts = payments.map((p) => (p.amount.trim() === "" ? 0 : Number(p.amount.replace(",", "."))));
  const hasInvalidAmount = parsedAmounts.some((a) => !Number.isFinite(a) || a < 0);
  const singleBlank = payments.length === 1 && payments[0].amount.trim() === "";
  const paidSum = singleBlank ? total : parsedAmounts.reduce((sum, a) => sum + (Number.isFinite(a) ? a : 0), 0);
  const remaining = total - paidSum;
  const overpaid = paidSum > total + 0.0001;

  function updatePayment(key: string, patch: Partial<PaymentLine>) {
    setPayments((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }
  function removePayment(key: string) {
    setPayments((prev) => (prev.length > 1 ? prev.filter((p) => p.key !== key) : prev));
  }
  // Remplit une ligne avec ce qui reste à payer après les autres lignes
  function fillRemaining(key: string) {
    const others = payments.reduce((sum, p, i) => (p.key === key ? sum : sum + (Number.isFinite(parsedAmounts[i]) ? parsedAmounts[i] : 0)), 0);
    updatePayment(key, { amount: String(Math.max(total - others, 0)) });
  }

  const createSale = useMutation({
    mutationFn: async () => {
      if (saleType === "VENTE") {
        if (hasInvalidAmount) throw new Error("Un montant de paiement est invalide.");
        if (overpaid) throw new Error("Le total des paiements dépasse le montant de la vente.");
      }
      const lines =
        saleType === "DEVIS"
          ? []
          : singleBlank
          ? total > 0
            ? [{ method: payments[0].method, amount: total }]
            : []
          : payments.map((p, i) => ({ method: p.method, amount: parsedAmounts[i] })).filter((p) => p.amount > 0);
      const payload = {
        storeId: effectiveStoreId,
        customerId: customerId || null,
        type: saleType,
        items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount })),
        discount: 0,
        paidAmount: lines.reduce((sum, l) => sum + l.amount, 0),
        payments: lines,
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
      setPayments([newPaymentLine()]);
      setCustomerId("");
    },
    onError: (err: any) => {
      // Les erreurs venant du serveur sont déjà affichées par l'intercepteur axios
      if (!err?.response) toast.error(err?.message || "Une erreur est survenue.");
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

              <div className="max-h-[360px] space-y-2 overflow-y-auto scrollbar-thin">
                {cart.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Panier vide</p>
                ) : (
                  cart.map((l) => (
                    <div key={l.product.id} className="space-y-1.5 rounded-md border border-border p-2">
                      <div className="flex items-center gap-2">
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
                      <Select
                        value={l.priceTier}
                        onChange={(e) => setLineTier(l.product.id, e.target.value as PriceTier)}
                        className="h-6 px-1.5 text-[11px]"
                      >
                        <option value="VENTE">Prix de vente</option>
                        <option value="GROSSISTE">Prix grossiste{l.product.wholesalePrice == null ? " (indispo → vente)" : ""}</option>
                        <option value="REVENDEUR">Prix revendeur{l.product.resellerPrice == null ? " (indispo → vente)" : ""}</option>
                        <option value="PROMOTIONNEL">Prix promotionnel{l.product.promoPrice == null ? " (indispo → vente)" : ""}</option>
                      </Select>
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
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="mb-0">Paiement</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setPayments((prev) => [...prev, newPaymentLine()])}
                          disabled={payments.length >= 4}
                        >
                          <Plus className="h-3 w-3" />
                          Ajouter un mode
                        </Button>
                      </div>

                      {payments.map((p) => (
                        <div key={p.key} className="flex items-center gap-1.5">
                          <Select value={p.method} onChange={(e) => updatePayment(p.key, { method: e.target.value })} className="w-32 shrink-0">
                            {PAYMENT_METHODS.map((m) => (
                              <option key={m} value={m}>
                                {paymentLabel(m)}
                              </option>
                            ))}
                          </Select>
                          <Input
                            type="number"
                            min={0}
                            inputMode="decimal"
                            placeholder={payments.length === 1 ? String(total) : "Montant"}
                            value={p.amount}
                            onChange={(e) => updatePayment(p.key, { amount: e.target.value })}
                          />
                          {payments.length > 1 && (
                            <>
                              <Button type="button" variant="outline" size="sm" className="h-9 px-2 text-xs" onClick={() => fillRemaining(p.key)} title="Mettre ce qui reste à payer">
                                Solde
                              </Button>
                              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removePayment(p.key)} aria-label="Retirer ce mode">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}

                      <div className="space-y-0.5 rounded-md bg-secondary/50 p-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Payé</span>
                          <span className="font-medium tabular-nums">{formatCurrency(paidSum, currency)}</span>
                        </div>
                        {overpaid ? (
                          <p className="font-medium text-destructive">Le total payé dépasse le montant de la vente de {formatCurrency(paidSum - total, currency)}.</p>
                        ) : (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Reste à payer</span>
                            <span className={"font-medium tabular-nums " + (remaining > 0.0001 ? "text-warning" : "")}>{formatCurrency(Math.max(remaining, 0), currency)}</span>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Si le montant payé est inférieur au total, la différence devient une dette sur la fiche du client sélectionné.
                      </p>
                      {remaining > 0.0001 && !customerId && (
                        <p className="text-xs font-medium text-warning">
                          Aucun client sélectionné : le reste à payer ne sera enregistré comme dette de personne.
                        </p>
                      )}
                    </div>
                  </>
                )}

                <Button className="w-full" size="lg" disabled={!cart.length || (saleType === "VENTE" && (overpaid || hasInvalidAmount))} loading={createSale.isPending} onClick={() => createSale.mutate()}>
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
              {receiptSale.type === "VENTE" && (
                <div className="space-y-1 border-t border-dashed border-border pt-2">
                  {receiptSale.salePayments?.map((p) => (
                    <div key={p.id} className="flex justify-between">
                      <span>{paymentLabel(p.method)}</span>
                      <span>{formatCurrency(p.amount, currency)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between">
                    <span>PAYÉ</span>
                    <span>{formatCurrency(receiptSale.paidAmount, currency)}</span>
                  </div>
                  {receiptSale.totalAmount - receiptSale.paidAmount > 0.0001 && (
                    <div className="flex justify-between font-semibold">
                      <span>RESTE À PAYER</span>
                      <span>{formatCurrency(receiptSale.totalAmount - receiptSale.paidAmount, currency)}</span>
                    </div>
                  )}
                </div>
              )}
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
