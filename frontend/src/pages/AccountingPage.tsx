import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, Download, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TrendingUp, ShoppingCart, Package, Wallet } from "lucide-react";

interface Summary {
  revenue: number;
  purchases: number;
  expenses: number;
  profit: number;
  expensesByCategory: { category: string; total: number }[];
  sales: { id: string; number: string; totalAmount: number; createdAt: string }[];
  purchaseList: { id: string; number: string; totalAmount: number; createdAt: string }[];
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AccountingPage() {
  const currency = useAuthStore((s) => s.user?.company?.currency) || "XOF";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["accounting-summary", from, to],
    queryFn: async () => (await api.get<Summary>("/accounting/summary", { params: { from: from || undefined, to: to || undefined } })).data,
  });

  function exportCsv() {
    if (!data) return;
    const rows: (string | number)[][] = [
      ["Rapport comptable"],
      ["Chiffre d'affaires", data.revenue],
      ["Achats", data.purchases],
      ["Dépenses", data.expenses],
      ["Bénéfice", data.profit],
      [],
      ["Ventes"],
      ["Numéro", "Date", "Montant"],
      ...data.sales.map((s) => [s.number, formatDate(s.createdAt), s.totalAmount]),
      [],
      ["Achats"],
      ["Numéro", "Date", "Montant"],
      ...data.purchaseList.map((p) => [p.number, formatDate(p.createdAt), p.totalAmount]),
    ];
    downloadCsv(`rapport-comptable-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div>
      <PageHeader
        title="Comptabilité"
        description="Recettes, dépenses et bénéfices de votre entreprise"
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={!data}>
              <Download className="h-4 w-4" />
              Export Excel (CSV)
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Export PDF
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <Label>Du</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>Au</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {isLoading || !data ? null : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
            <StatCard label="Recettes" value={formatCurrency(data.revenue, currency)} icon={TrendingUp} tone="success" />
            <StatCard label="Achats" value={formatCurrency(data.purchases, currency)} icon={ShoppingCart} />
            <StatCard label="Dépenses" value={formatCurrency(data.expenses, currency)} icon={Wallet} />
            <StatCard label="Bénéfice" value={formatCurrency(data.profit, currency)} icon={Package} tone={data.profit >= 0 ? "success" : "destructive"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Dépenses par catégorie</CardTitle>
              </CardHeader>
              <CardContent>
                {!data.expensesByCategory.length ? (
                  <EmptyState icon={Calculator} title="Aucune dépense sur cette période" />
                ) : (
                  <div className="space-y-2">
                    {data.expensesByCategory.map((e) => (
                      <div key={e.category} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{e.category}</span>
                        <span className="font-medium tabular-nums">{formatCurrency(e.total, currency)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dernières ventes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N°</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.sales.slice(0, 10).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.number}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
                        <TableCell className="tabular-nums">{formatCurrency(s.totalAmount, currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
