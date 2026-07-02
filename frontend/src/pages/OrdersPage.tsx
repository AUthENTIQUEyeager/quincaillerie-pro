import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ClipboardCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/EmptyState";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Product, Customer, Supplier } from "@/types";

const statusVariant: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  EN_ATTENTE: "warning",
  CONFIRME: "secondary",
  LIVRE: "success",
  ANNULE: "destructive",
};

export default function OrdersPage() {
  const currency = useAuthStore((s) => s.user?.company?.currency) || "XOF";
  const queryClient = useQueryClient();
  const { data: orders, isLoading } = useQuery({ queryKey: ["orders"], queryFn: async () => (await api.get("/orders")).data });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: async () => (await api.get<Product[]>("/products")).data });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get<Customer[]>("/customers")).data });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: async () => (await api.get<Supplier[]>("/suppliers")).data });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [type, setType] = useState<"CLIENT" | "FOURNISSEUR">("CLIENT");
  const [partyId, setPartyId] = useState("");
  const [lines, setLines] = useState<{ productId: string; quantity: number; unitPrice: number }[]>([]);

  const total = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0), [lines]);

  const create = useMutation({
    mutationFn: async () =>
      api.post("/orders", {
        type,
        customerId: type === "CLIENT" ? partyId : null,
        supplierId: type === "FOURNISSEUR" ? partyId : null,
        lines,
      }),
    onSuccess: () => {
      toast.success("Commande créée");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setDialogOpen(false);
      setLines([]);
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => api.put(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      toast.success("Statut mis à jour");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  function openCreate(t: "CLIENT" | "FOURNISSEUR") {
    setType(t);
    setPartyId("");
    setLines([]);
    setDialogOpen(true);
  }

  function addLine() {
    if (!products?.length) return;
    setLines((prev) => [...prev, { productId: products[0].id, quantity: 1, unitPrice: products[0].sellingPrice }]);
  }

  const clientOrders = orders?.filter((o: any) => o.type === "CLIENT") || [];
  const supplierOrders = orders?.filter((o: any) => o.type === "FOURNISSEUR") || [];

  return (
    <div>
      <PageHeader title="Commandes" description="Suivez les commandes clients et fournisseurs" />

      <Tabs defaultValue="client">
        <TabsList>
          <TabsTrigger value="client">Commandes clients</TabsTrigger>
          <TabsTrigger value="fournisseur">Commandes fournisseurs</TabsTrigger>
        </TabsList>

        <TabsContent value="client">
          <div className="mb-3 flex justify-end">
            <Button onClick={() => openCreate("CLIENT")}>
              <Plus className="h-4 w-4" />
              Nouvelle commande client
            </Button>
          </div>
          {isLoading ? null : !clientOrders.length ? (
            <EmptyState icon={ClipboardCheck} title="Aucune commande client" />
          ) : (
            <OrdersTable orders={clientOrders} currency={currency} onStatusChange={(id, status) => updateStatus.mutate({ id, status })} party="customer" />
          )}
        </TabsContent>

        <TabsContent value="fournisseur">
          <div className="mb-3 flex justify-end">
            <Button onClick={() => openCreate("FOURNISSEUR")}>
              <Plus className="h-4 w-4" />
              Nouvelle commande fournisseur
            </Button>
          </div>
          {isLoading ? null : !supplierOrders.length ? (
            <EmptyState icon={ClipboardCheck} title="Aucune commande fournisseur" />
          ) : (
            <OrdersTable orders={supplierOrders} currency={currency} onStatusChange={(id, status) => updateStatus.mutate({ id, status })} party="supplier" />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nouvelle commande {type === "CLIENT" ? "client" : "fournisseur"}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>{type === "CLIENT" ? "Client" : "Fournisseur"}</Label>
            <Select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">Sélectionner...</option>
              {(type === "CLIENT" ? customers : suppliers)?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="mb-0">Articles</Label>
              <Button variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" />
                Ajouter
              </Button>
            </div>
            {lines.map((l, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select className="flex-1" value={l.productId} onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, productId: e.target.value } : x)))}>
                  {products?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Input type="number" min={1} className="w-20" value={l.quantity} onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)))} />
                <Input type="number" min={0} className="w-28" value={l.unitPrice} onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unitPrice: Number(e.target.value) } : x)))} />
                <Button variant="ghost" size="icon" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <p className="text-right font-display font-semibold">Total : {formatCurrency(total, currency)}</p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button disabled={!partyId || !lines.length} loading={create.isPending} onClick={() => create.mutate()}>
              Créer la commande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrdersTable({ orders, currency, onStatusChange, party }: { orders: any[]; currency: string; onStatusChange: (id: string, status: string) => void; party: "customer" | "supplier" }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>{party === "customer" ? "Client" : "Fournisseur"}</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Statut</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((o) => (
          <TableRow key={o.id}>
            <TableCell className="text-muted-foreground">{formatDateTime(o.createdAt)}</TableCell>
            <TableCell>{party === "customer" ? o.customer?.name : o.supplier?.name}</TableCell>
            <TableCell className="font-medium tabular-nums">{formatCurrency(o.totalAmount, currency)}</TableCell>
            <TableCell>
              <Select className="h-8 w-40 text-xs" value={o.status} onChange={(e) => onStatusChange(o.id, e.target.value)}>
                <option value="EN_ATTENTE">En attente</option>
                <option value="CONFIRME">Confirmé</option>
                <option value="LIVRE">Livré</option>
                <option value="ANNULE">Annulé</option>
              </Select>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
