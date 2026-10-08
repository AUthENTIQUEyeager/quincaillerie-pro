
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Coins, Undo2, History, Save } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";

type PriceField =
  | "purchasePrice"
  | "sellingPrice"
  | "wholesalePrice"
  | "resellerPrice"
  | "promoPrice";

type Prices = Record<PriceField, number | null>;

interface PriceProduct extends Prices {
  id: string;
  name: string;
  sku: string;
  unit: string;
  isActive: boolean;
  updatedAt: string;
  categoryId: string | null;
  category: { id: string; name: string } | null;
}

interface PriceChangeRow {
  id: string;
  productName: string;
  field: PriceField;
  oldValue: number | null;
  newValue: number | null;
  userName: string | null;
  createdAt: string;
}

const COLUMNS: { field: PriceField; label: string }[] = [
  { field: "purchasePrice", label: "Prix d'achat" },
  { field: "sellingPrice", label: "Prix de vente" },
  { field: "wholesalePrice", label: "Grossiste" },
  { field: "resellerPrice", label: "Revendeur" },
  { field: "promoPrice", label: "Promo" },
];

const FIELD_LABEL = Object.fromEntries(
  COLUMNS.map((c) => [c.field, c.label])
) as Record<PriceField, string>;

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 6 });

const fmt = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : nf.format(v);

// Évite les résidus de calcul flottant
// (ex. 1000.0000000001) sans arrondir le prix.
const clean = (v: number) => parseFloat(v.toFixed(6));

function parseInput(text: string): number | null | "invalid" {
  const t = text
    .replace(/\s/g, "")
    .replace(/ /g, "")
    .replace(",", ".");

  if (t === "") return null;

  const n = Number(t);

  if (!Number.isFinite(n) || n < 0) {
    return "invalid";
  }

  return n;
}

const cellKey = (id: string, field: PriceField) =>
  `${id}|${field}`;

export default function PricesPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");

  // Valeurs de travail des lignes modifiées (non enregistrées)
  const [draft, setDraft] = useState<Record<string, Prices>>({});

  const [active, setActive] = useState<{
    id: string;
    field: PriceField;
    text: string;
  } | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ["prices"],
    queryFn: async () =>
      (await api.get<PriceProduct[]>("/prices")).data,
  });

  const { data: history } = useQuery({
    queryKey: ["prices-history"],
    queryFn: async () =>
      (await api.get<PriceChangeRow[]>("/prices/history")).data,
    enabled: historyOpen,
  });

  const working = (p: PriceProduct): Prices =>
    draft[p.id] ?? p;

  // Produits groupés par catégorie (A-Z),
  // « Sans catégorie » à la fin,
  // puis A-Z par nom.
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();

    const list = (products || []).filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );

    const map = new Map<
      string,
      { name: string; items: PriceProduct[] }
    >();

    for (const p of list) {
      const key = p.category?.id ?? "__none__";

      if (!map.has(key)) {
        map.set(key, {
          name: p.category?.name ?? "Sans catégorie",
          items: [],
        });
      }

      map.get(key)!.items.push(p);
    }

    const arr = [...map.entries()].map(([key, g]) => ({
      key,
      ...g,
    }));

    arr.sort((a, b) =>
      a.key === "__none__"
        ? 1
        : b.key === "__none__"
        ? -1
        : a.name.localeCompare(b.name, "fr", {
            sensitivity: "base",
          })
    );

    for (const g of arr) {
      g.items.sort((a, b) =>
        a.name.localeCompare(b.name, "fr", {
          sensitivity: "base",
        })
      );
    }

    return arr;
  }, [products, search]);

  const flatIds = useMemo(
    () => groups.flatMap((g) => g.items.map((p) => p.id)),
    [groups]
  );

  function isChanged(
    p: PriceProduct,
    field: PriceField
  ) {
    const d = draft[p.id];

    return !!d && d[field] !== p[field];
  }

  const changedRows = useMemo(
    () =>
      (products || []).filter((p) => {
        const d = draft[p.id];

        return (
          d &&
          COLUMNS.some(
            (c) => d[c.field] !== p[c.field]
          )
        );
      }),
    [products, draft]
  );

  // Avertit avant de quitter la page
  // avec des modifications non enregistrées.
  useEffect(() => {
    if (!changedRows.length) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);

    return () =>
      window.removeEventListener("beforeunload", handler);
  }, [changedRows.length]);

  function focusCell(
    id: string,
    field: PriceField
  ) {
    const el =
      document.querySelector<HTMLInputElement>(
        `[data-cell="${cellKey(id, field)}"]`
      );

    if (el) {
      el.focus();
      el.scrollIntoView({
        block: "nearest",
      });
    }
  }

  function commit(
    p: PriceProduct,
    field: PriceField,
    text: string
  ) {
    const parsed = parseInput(text);

    if (parsed === "invalid") {
      toast.error(
        "Montant invalide (nombre positif attendu)."
      );
      return false;
    }

    const current = working(p);
    const oldValue = current[field];
    const next: Prices = { ...current };

    if (parsed === null) {
      // Vider : seulement possible pour les prix facultatifs.
      if (
        field === "purchasePrice" ||
        field === "sellingPrice"
      ) {
        toast.error(
          "Le prix d'achat et le prix de vente sont obligatoires."
        );
        return false;
      }

      next[field] = null;
    } else if (
      oldValue !== null &&
      parsed !== oldValue
    ) {
      /*
       * Chaque modification propage l'écart.
       *
       * Exemple :
       * 1000 -> 1013 = +13
       * 1013 -> 990  = -23
       *
       * Dans les deux cas, le même delta est appliqué
       * aux autres prix renseignés.
       */
      const delta = parsed - oldValue;

      let clamped = false;

      for (const c of COLUMNS) {
        if (c.field === field) {
          // Le prix directement modifié prend exactement
          // la nouvelle valeur saisie.
          next[c.field] = parsed;
        } else if (current[c.field] !== null) {
          // Même écart sur les autres prix renseignés.
          let v = clean(
            (current[c.field] as number) + delta
          );

          // Aucun prix ne peut devenir négatif.
          if (v < 0) {
            v = 0;
            clamped = true;
          }

          next[c.field] = v;
        }
      }

      if (clamped) {
        toast(
          "Un prix serait devenu négatif : il a été bloqué à 0.",
          {
            icon: "⚠️",
          }
        );
      }
    } else {
      // Prix facultatif vide ou valeur inchangée.
      next[field] = parsed;
    }

    setDraft((d) => ({
      ...d,
      [p.id]: next,
    }));

    return true;
  }

  function onEnter(
    p: PriceProduct,
    field: PriceField
  ) {
    if (!active) return;

    if (!commit(p, field, active.text)) {
      return;
    }

    setActive(null);

    const idx = flatIds.indexOf(p.id);
    const nextId = flatIds[idx + 1];

    if (nextId) {
      // Passe à la ligne suivante,
      // même colonne.
      setTimeout(
        () => focusCell(nextId, field),
        0
      );
    } else {
      (
        document.activeElement as HTMLElement | null
      )?.blur();
    }
  }

  function resetRow(id: string) {
    setDraft((d) => {
      const {
        [id]: _removed,
        ...rest
      } = d;

      return rest;
    });
  }

  function resetAll() {
    setDraft({});
    setActive(null);
  }

  const save = useMutation({
    mutationFn: async () => {
      const changes = changedRows.map((p) => {
        const d = draft[p.id];

        const prices: Partial<Prices> = {};

        for (const c of COLUMNS) {
          if (d[c.field] !== p[c.field]) {
            prices[c.field] = d[c.field];
          }
        }

        return {
          productId: p.id,
          expectedUpdatedAt: p.updatedAt,
          prices,
        };
      });

      return (
        await api.put<{
          updatedProducts: number;
          updatedPrices: number;
        }>("/prices", {
          changes,
        })
      ).data;
    },

    onSuccess: (r) => {
      toast.success(
        `${r.updatedProducts} produit(s) mis à jour`
      );

      resetAll();
      setConfirmOpen(false);

      queryClient.invalidateQueries({
        queryKey: ["prices"],
      });

      queryClient.invalidateQueries({
        queryKey: ["prices-history"],
      });

      queryClient.invalidateQueries({
        queryKey: ["products"],
      });
    },

    onError: (err: any) => {
      setConfirmOpen(false);

      if (err?.response?.status === 409) {
        // Données devenues obsolètes :
        // on recharge et on repart d'une base propre.
        resetAll();

        queryClient.invalidateQueries({
          queryKey: ["prices"],
        });
      }
    },
  });

  return (
    <div>
      <PageHeader
        title="Gestion des prix"
        description="Modifiez un prix puis appuyez sur Entrée : l'écart s'applique aux autres prix de la ligne."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="h-4 w-4" />
              Historique
            </Button>

            {changedRows.length > 0 && (
              <Button
                variant="outline"
                onClick={resetAll}
              >
                <Undo2 className="h-4 w-4" />
                Annuler tout
              </Button>
            )}

            <Button
              disabled={!changedRows.length}
              onClick={() => setConfirmOpen(true)}
            >
              <Save className="h-4 w-4" />
              Enregistrer
              {changedRows.length > 0
                ? ` (${changedRows.length})`
                : ""}
            </Button>
          </>
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        <Input
          placeholder="Rechercher un produit ou un SKU..."
          className="pl-9"
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-12"
            />
          ))}
        </div>
      ) : !groups.length ? (
        <EmptyState
          icon={Coins}
          title="Aucun produit"
          description="Aucun produit ne correspond à la recherche."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>

              {COLUMNS.map((c) => (
                <TableHead
                  key={c.field}
                  className="min-w-[130px]"
                >
                  {c.label}
                </TableHead>
              ))}

              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {groups.map((g) => (
              <GroupRows
                key={g.key}
                name={g.name}
                count={g.items.length}
              >
                {g.items.map((p) => {
                  const w = working(p);

                  const rowChanged =
                    COLUMNS.some((c) =>
                      isChanged(p, c.field)
                    );

                  return (
                    <TableRow
                      key={p.id}
                      className={cn(
                        rowChanged &&
                          "bg-warning/5"
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {p.name}
                          </span>

                          {!p.isActive && (
                            <Badge variant="secondary">
                              Inactif
                            </Badge>
                          )}
                        </div>

                        <span className="font-mono text-xs text-muted-foreground">
                          {p.sku}
                        </span>
                      </TableCell>

                      {COLUMNS.map((c) => {
                        const isActive =
                          active?.id === p.id &&
                          active.field === c.field;

                        const changed =
                          isChanged(
                            p,
                            c.field
                          );

                        return (
                          <TableCell
                            key={c.field}
                            className="py-2"
                          >
                            <Input
                              data-cell={cellKey(
                                p.id,
                                c.field
                              )}
                              inputMode="decimal"
                              placeholder="—"
                              className={cn(
                                "h-9 text-right tabular-nums",
                                changed &&
                                  "border-warning bg-warning/10 font-semibold"
                              )}
                              value={
                                isActive
                                  ? active!.text
                                  : fmt(w[c.field])
                              }
                              onFocus={(e) => {
                                setActive({
                                  id: p.id,
                                  field: c.field,
                                  text:
                                    w[c.field] ===
                                    null
                                      ? ""
                                      : String(
                                          w[c.field]
                                        ),
                                });

                                e.currentTarget.select();
                              }}
                              onChange={(e) =>
                                setActive({
                                  id: p.id,
                                  field: c.field,
                                  text: e.target.value,
                                })
                              }
                              onBlur={() =>
                                setActive((a) =>
                                  a &&
                                  a.id === p.id &&
                                  a.field ===
                                    c.field
                                    ? null
                                    : a
                                )
                              }
                              onKeyDown={(e) => {
                                if (
                                  e.key ===
                                  "Enter"
                                ) {
                                  e.preventDefault();
                                  onEnter(
                                    p,
                                    c.field
                                  );
                                } else if (
                                  e.key ===
                                  "Escape"
                                ) {
                                  setActive(null);
                                  e.currentTarget.blur();
                                }
                              }}
                            />

                            {changed && (
                              <p className="mt-0.5 text-right text-[11px] text-muted-foreground line-through tabular-nums">
                                {p[c.field] ===
                                null
                                  ? "vide"
                                  : fmt(
                                      p[c.field]
                                    )}
                              </p>
                            )}
                          </TableCell>
                        );
                      })}

                      <TableCell className="py-2">
                        {rowChanged && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              resetRow(p.id)
                            }
                            aria-label="Annuler les modifications de cette ligne"
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </GroupRows>
            ))}
          </TableBody>
        </Table>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Entrée valide le prix et passe à la ligne suivante.
        Échap annule la saisie en cours. Rien n'est appliqué
        avant « Enregistrer ».
      </p>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Enregistrer les nouveaux prix ?"
        description={`${changedRows.length} produit(s) vont changer de prix. Les nouveaux prix seront utilisés immédiatement pour les prochaines ventes.`}
        confirmLabel="Enregistrer"
        variant="default"
        loading={save.isPending}
        onConfirm={() => save.mutate()}
      />

      <Dialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Historique des modifications de prix
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            {!history ? (
              <Skeleton className="h-24" />
            ) : history.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucune modification enregistrée pour le
                moment.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead className="text-right">
                      Ancien
                    </TableHead>
                    <TableHead className="text-right">
                      Nouveau
                    </TableHead>
                    <TableHead>Par</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(
                          h.createdAt
                        )}
                      </TableCell>

                      <TableCell className="font-medium">
                        {h.productName}
                      </TableCell>

                      <TableCell>
                        {FIELD_LABEL[h.field] ??
                          h.field}
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        {h.oldValue === null
                          ? "—"
                          : fmt(h.oldValue)}
                      </TableCell>

                      <TableCell className="text-right font-medium tabular-nums">
                        {h.newValue === null
                          ? "—"
                          : fmt(h.newValue)}
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {h.userName || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GroupRows({
  name,
  count,
  children,
}: {
  name: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <TableRow className="bg-secondary/60 hover:bg-secondary/60">
        <TableCell
          colSpan={COLUMNS.length + 2}
          className="py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {name}

          <span className="ml-1 font-normal">
            ({count})
          </span>
        </TableCell>
      </TableRow>

      {children}
    </>
  );
}

