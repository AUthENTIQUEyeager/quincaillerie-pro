import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ArrowLeftRight } from "lucide-react";
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
import type { Store, Product } from "@/types";

interface Line {
  productId: string;
  quantity: number;
}

export default function TransfersPage() {
  const queryClient = useQueryClient();
  const { data: transfers, isLoading } = useQuery({ queryKey: ["transfers"], queryFn: async () => (await api.get("/stock/transfers")).data });
  const { data: stores } = useQuery({ queryKey: ["stores"], queryFn: async () => (await api.get<Store[]>("/stores")).data });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: async () => (await api.get<Product[]>("/products")).data });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [fromStoreId, setFromStoreId] = useState("");
  const [toStoreId, setToStoreId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const create = useMutation({
    mutationFn: async () => api.post("/stock/transfers", { fromStoreId, toStoreId, lines }),
    onSuccess: () => {
      toast.success("Transfert effectué");
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      setDialogOpen(false);
      setLines([]);
    },
  });

  function openCreate() {
    setFromStoreId(stores?.[0]?.id || "");
    setToStoreId(stores?.[1]?.id || stores?.[0]?.id || "");
    setLines([]);
    setDialogOpen(true);
  }

  function addLine() {
    if (!products?.length) return;
    setLines((prev) => [...prev, { productId: products[0].id, quantity: 1 }]);
  }

  return (
    <div>
      <PageHeader
        title="Transferts entre dépôts"
        description="Déplacez du stock d'un dépôt à un autre"
        actions={
          <Button onClick={openCreate} disabled={!stores || stores.length < 2}>
            <Plus className="h-4 w-4" />
            Nouveau transfert
          </Button>
        }
      />

      {!stores || stores.length < 2 ? (
        <EmptyState icon={ArrowLeftRight} title="Créez au moins deux dépôts" description="Un transfert nécessite un dépôt source et un dépôt destination." />
      ) : isLoading ? null : !transfers?.length ? (
        <EmptyState icon={ArrowLeftRight} title="Aucun transfert" action={<Button onClick={openCreate}>Créer un transfert</Button>} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>De</TableHead>
              <TableHead>Vers</TableHead>
              <TableHead>Articles</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell className="text-muted-foreground">{formatDateTime(t.createdAt)}</TableCell>
                <TableCell>{t.fromStore?.name}</TableCell>
                <TableCell>{t.toStore?.name}</TableCell>
                <TableCell className="text-muted-foreground">{t.lines?.length} article(s)</TableCell>
                <TableCell>
                  <Badge variant="success">{t.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nouveau transfert</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dépôt source</Label>
              <Select value={fromStoreId} onChange={(e) => setFromStoreId(e.target.value)}>
                {stores?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Dépôt destination</Label>
              <Select value={toStoreId} onChange={(e) => setToStoreId(e.target.value)}>
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
              <Label className="mb-0">Articles à transférer</Label>
              <Button variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" />
                Ajouter
              </Button>
            </div>
            {lines.map((l, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select
                  className="flex-1"
                  value={l.productId}
                  onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, productId: e.target.value } : x)))}
                >
                  {products?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min={1}
                  className="w-24"
                  value={l.quantity}
                  onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)))}
                />
                <Button variant="ghost" size="icon" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button disabled={!lines.length || fromStoreId === toStoreId} loading={create.isPending} onClick={() => create.mutate()}>
              Transférer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
