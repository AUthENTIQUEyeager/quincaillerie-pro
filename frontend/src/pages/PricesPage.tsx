import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
Search,
Coins,
Undo2,
History,
Save,
FileSpreadsheet,
FileDown,
} from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
Table,
TableHeader,
TableBody,
TableRow,
TableHead,
TableCell,
} from "@/components/ui/table";
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
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
const nf = new Intl.NumberFormat("fr-FR", {
maximumFractionDigits: 6,
});
const fmt = (v: number | null | undefined) =>
v === null || v === undefined ? "" : nf.format(v);
const clean = (v: number) => parseFloat(v.toFixed(6));
function parseInput(text: string): number | null | "invalid" {
const t = text.replace(/\s/g, "").replace(",", ".");
if (t === "") return null;
const n = Number(t);
if (!Number.isFinite(n) || n < 0) {
return "invalid";
}
return n;
}
const cellKey = (id: string, field: PriceField) =>
`${id}|${field}`;
const formatExportDate = (date: string) => {
const parsed = new Date(date);
return Number.isNaN(parsed.getTime())
? date
: parsed.toLocaleString("fr-FR");
};
const exportPrice = (value: number | null | undefined) =>
value === null || value === undefined ? "" : value;
const filenameDate = () =>
new Date().toISOString().slice(0, 10);
export default function PricesPage() {
const queryClient = useQueryClient();
const [search, setSearch] = useState("");
const [draft, setDraft] = useState<Record<string, Prices>>({});
const [active, setActive] = useState<{
id: string;
field: PriceField;
text: string;
} | null>(null);
const [confirmOpen, setConfirmOpen] = useState(false);
const [historyOpen, setHistoryOpen] = useState(false);
const [exporting, setExporting] = useState(false);
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
const arr = [...map.entries()].map(([key, group]) => ({  
  key,  
  ...group,  
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
for (const group of arr) {  
  group.items.sort((a, b) =>  
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
function isChanged(p: PriceProduct, field: PriceField) {
const d = draft[p.id];
return !!d && d[field] !== p[field];
}
const changedRows = useMemo(
() =>
(products || []).filter((p) => {
const d = draft[p.id];
    return (  
      d &&  
      COLUMNS.some((c) => d[c.field] !== p[c.field])  
    );  
  }),  
[products, draft]  
);
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
function focusCell(id: string, field: PriceField) {
const el = document.querySelector<HTMLInputElement>(
`[data-cell="${cellKey(id, field)}"]`
);
if (el) {  
  el.focus();  
  el.scrollIntoView({ block: "nearest" });  
}  
}
function commit(
p: PriceProduct,
field: PriceField,
text: string
) {
const parsed = parseInput(text);
if (parsed === "invalid") {  
  toast.error("Montant invalide (nombre positif attendu).");  
  return false;  
}
const current = working(p);  
const oldValue = current[field];  
const next: Prices = { ...current };
if (parsed === null) {  
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
} else if (oldValue !== null && parsed !== oldValue) {  
  const delta = parsed - oldValue;  
  let clamped = false;
  for (const c of COLUMNS) {  
    if (c.field === field) {  
      next[c.field] = parsed;  
    } else if (current[c.field] !== null) {  
      let value = clean(  
        (current[c.field] as number) + delta  
      );
      if (value < 0) {  
        value = 0;  
        clamped = true;  
      }
      next[c.field] = value;  
    }  
  }
  if (clamped) {  
    toast(  
      "Un prix serait devenu négatif : il a été bloqué à 0.",  
      { icon: "⚠️" }  
    );  
  }  
} else {  
  next[field] = parsed;  
}
setDraft((d) => ({  
  ...d,  
  [p.id]: next,  
}));
return true;  
}
function onEnter(p: PriceProduct, field: PriceField) {
if (!active) return;
if (!commit(p, field, active.text)) {  
  return;  
}
setActive(null);
const idx = flatIds.indexOf(p.id);  
const nextId = flatIds[idx + 1];
if (nextId) {  
  setTimeout(() => focusCell(nextId, field), 0);  
} else {  
  (  
    document.activeElement as HTMLElement | null  
  )?.blur();  
}  
}
function resetRow(id: string) {
setDraft((d) => {
const { [id]: _removed, ...rest } = d;
return rest;
});
}
function resetAll() {
setDraft({});
setActive(null);
}
// Prépare toutes les données, indépendamment du filtre de recherche.
// Les prix en attente d'enregistrement sont inclus.
function getExportProducts() {
return (products || []).map((p) => ({
...p,
...working(p),
}));
}
async function getExportHistory() {
const response = await api.get<PriceChangeRow[]>(
"/prices/history"
);
return response.data;  
}
function buildProductExportRows() {
return getExportProducts().map((p) => ({
"ID produit": p.id,
Produit: p.name,
SKU: p.sku,
Catégorie: p.category?.name ?? "Sans catégorie",
Unité: p.unit,
Statut: p.isActive ? "Actif" : "Inactif",
"Prix d'achat": exportPrice(p.purchasePrice),
"Prix de vente": exportPrice(p.sellingPrice),
Grossiste: exportPrice(p.wholesalePrice),
Revendeur: exportPrice(p.resellerPrice),
Promo: exportPrice(p.promoPrice),
"Dernière mise à jour": formatExportDate(p.updatedAt),
"Modifications en attente": draft[p.id] && COLUMNS.some(
(c) => {
  const original = (products || []).find((item) => item.id === p.id);
  return !!original && draft[p.id][c.field] !== original[c.field];
})
? "Oui"
: "Non",
}));
}
function buildHistoryExportRows(rows: PriceChangeRow[]) {
return rows.map((h) => ({
Date: formatExportDate(h.createdAt),
Produit: h.productName,
"Type de prix": FIELD_LABEL[h.field] ?? h.field,
"Ancienne valeur": exportPrice(h.oldValue),
"Nouvelle valeur": exportPrice(h.newValue),
Utilisateur: h.userName || "—",
}));
}
async function exportExcel() {
  if (!products?.length) {
    toast.error("Aucun produit à exporter.");
    return;
  }

  setExporting(true);
  try {
    const rows = buildProductExportRows();
    if (!rows.length) {
      toast.error("Aucune donnée à exporter.");
      return;
    }

    const headers = Object.keys(rows[0]);
    const escapeCSV = (value: unknown) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };

    const csv = [
      headers.map(escapeCSV).join(";"),
      ...rows.map((row) =>
        headers.map((header) => escapeCSV(row[header as keyof typeof row])).join(";")
      ),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gestion-prix-${filenameDate()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast.success("Fichier compatible Excel téléchargé.");
  } catch (error) {
    console.error("Erreur export Excel :", error);
    toast.error("Impossible d'exporter les données.");
  } finally {
    setExporting(false);
  }
}

async function exportPDF() {
  if (!products?.length) {
    toast.error("Aucun produit à exporter.");
    return;
  }

  setExporting(true);
  try {
    const exportProducts = getExportProducts();
    const historyRows = await getExportHistory();

    const escapeHTML = (value: unknown) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const productRows = exportProducts.map((p) => `
      <tr>
        <td>${escapeHTML(p.name)}</td>
        <td>${escapeHTML(p.sku)}</td>
        <td>${escapeHTML(p.category?.name ?? "Sans catégorie")}</td>
        <td>${escapeHTML(p.unit)}</td>
        <td>${p.isActive ? "Actif" : "Inactif"}</td>
        <td>${escapeHTML(fmt(p.purchasePrice) || "—")}</td>
        <td>${escapeHTML(fmt(p.sellingPrice) || "—")}</td>
        <td>${escapeHTML(fmt(p.wholesalePrice) || "—")}</td>
        <td>${escapeHTML(fmt(p.resellerPrice) || "—")}</td>
        <td>${escapeHTML(fmt(p.promoPrice) || "—")}</td>
      </tr>
    `).join("");

    const historyTableRows = historyRows.map((h) => `
      <tr>
        <td>${escapeHTML(formatExportDate(h.createdAt))}</td>
        <td>${escapeHTML(h.productName)}</td>
        <td>${escapeHTML(FIELD_LABEL[h.field] ?? h.field)}</td>
        <td>${escapeHTML(h.oldValue === null ? "—" : fmt(h.oldValue))}</td>
        <td>${escapeHTML(h.newValue === null ? "—" : fmt(h.newValue))}</td>
        <td>${escapeHTML(h.userName || "—")}</td>
      </tr>
    `).join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Autorise les fenêtres pop-up pour exporter le PDF.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>Gestion des prix</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: Arial, sans-serif; color: #222; font-size: 10px; }
          h1 { font-size: 22px; margin-bottom: 5px; }
          h2 { font-size: 15px; margin-top: 28px; }
          p { color: #555; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #ccc; padding: 6px; text-align: left; overflow-wrap: anywhere; }
          th { background: #eee; }
          tr { break-inside: avoid; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <h1>Gestion des prix</h1>
        <p>Export du ${escapeHTML(new Date().toLocaleString("fr-FR"))}</p>
        <p>${exportProducts.length} produit(s)</p>
        <h2>Prix des produits</h2>
        <table>
          <thead><tr>
            <th>Produit</th><th>SKU</th><th>Catégorie</th><th>Unité</th><th>Statut</th>
            <th>Achat</th><th>Vente</th><th>Grossiste</th><th>Revendeur</th><th>Promo</th>
          </tr></thead>
          <tbody>${productRows}</tbody>
        </table>
        <h2>Historique des modifications</h2>
        ${historyRows.length ? `
          <table>
            <thead><tr>
              <th>Date</th><th>Produit</th><th>Type de prix</th><th>Ancien</th><th>Nouveau</th><th>Utilisateur</th>
            </tr></thead>
            <tbody>${historyTableRows}</tbody>
          </table>
        ` : "<p>Aucune modification enregistrée.</p>"}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 300);

    toast.success("Document prêt : choisis « Enregistrer au format PDF » dans la fenêtre d'impression.");
  } catch (error) {
    console.error("Erreur export PDF :", error);
    toast.error("Impossible de préparer le document PDF.");
  } finally {
    setExporting(false);
  }
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
    }>("/prices", { changes })  
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
        <Button  
          variant="outline"  
          onClick={exportExcel}  
          disabled={exporting || !products?.length}  
        >  
          <FileSpreadsheet className="h-4 w-4" />  
          Excel  
        </Button>
        <Button  
          variant="outline"  
          onClick={exportPDF}  
          disabled={exporting || !products?.length}  
        >  
          <FileDown className="h-4 w-4" />  
          PDF  
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
      onChange={(e) => setSearch(e.target.value)}  
    />  
  </div>
  {isLoading ? (  
    <div className="space-y-2">  
      {Array.from({ length: 6 }).map((_, i) => (  
        <Skeleton key={i} className="h-12" />  
      ))}
