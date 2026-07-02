import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Receipt } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Purchase, Product, Supplier, Store } from "@/types";

interface Line {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export default function PurchasesPage() {
  const currency = useAuthStore((s) => s.user?.company?.currency) || "XOF";
  const queryClient = useQueryClient();
  const { data: purchases, isLoading } = useQuery({ queryKey: ["purchases"], queryFn: async () => (await api.get<Purchase[]>("/purchases")).data });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: async () => (await api.get<Product[]>("/products")).data });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: async () => (await api.get<Supplier[]>("/suppliers")).data });
  const { data: stores } = useQuery({ queryKey: ["stores"], queryFn: async () => (await api.get<Store[]>("/stores")).data });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const total = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0), [lines]);

  const create = useMutation({
    mutationFn: async () =>
      api.post("/purchases", { supplierId, storeId: storeId || stores?.[0]?.id, items: lines, paidAmount: Number(paidAmount || 0) }),
    onSuccess: () => {
      toast.success("Achat enregistré, stock mis à jour");
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDialogOpen(false);
      setLines([]);
      setPaidAmount("");
      setSupplierId("");
    },
  });

  function openCreate() {
    setSupplierId(suppliers?.[0]?.id || "");
    setStoreId(stores?.[0]?.id || "");
    setLines([]);
    setPaidAmount("");
    setDialogOpen(true);
  }

  function addLine() {
    if (!products?.length) return;
    setLines((prev) => [...prev, { productId: products[0].id, quantity: 1, unitPrice: products[0].purchasePrice }]);
  }

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <PageHeader
        title="Achats"
        description="Enregistrez vos réceptions de marchandises"
        actions={
          <Button onClick={openCreate} disabled={!suppliers?.length || !stores?.length || !products?.length}>
            <Plus className="h-4 w-4" />
            Nouvel achat
          </Button>
        }
      />

      {isLoading ? null : !purchases?.length ? (
        <EmptyState icon={Receipt} title="Aucun achat enregistré" action={<Button onClick={openCreate}>Enregistrer un achat</Button>} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Payé</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.number}</TableCell>
                <TableCell className="text-muted-foreground">{formatDateTime(p.createdAt)}</TableCell>
                <TableCell>{p.supplier?.name}</TableCell>
                <TableCell className="font-medium tabular-nums">{formatCurrency(p.totalAmount, currency)}</TableCell>
                <TableCell className="tabular-nums">{formatCurrency(p.paidAmount, currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouvel achat</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fournisseur *</Label>
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Dépôt de réception *</Label>
              <Select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                {stores?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="mb-0">Articles</Label>
              <Button variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" />
                Ajouter une ligne
              </Button>
            </div>
            {lines.map((l, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select className="flex-1" value={l.productId} onChange={(e) => updateLine(idx, { productId: e.target.value })}>
                  {products?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Input type="number" min={1} className="w-20" value={l.quantity} onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })} />
                <Input type="number" min={0} className="w-28" value={l.unitPrice} onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) })} />
                <Button variant="ghost" size="icon" onClick={() => removeLine(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {!lines.length && <p className="text-sm text-muted-foreground">Aucun article ajouté.</p>}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="w-40">
              <Label>Montant payé</Label>
              <Input type="number" min={0} value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0" />
            </div>
            <p className="font-display text-lg font-semibold">Total : {formatCurrency(total, currency)}</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button disabled={!lines.length || !supplierId || !storeId} loading={create.isPending} onClick={() => create.mutate()}>
              Enregistrer l'achat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
