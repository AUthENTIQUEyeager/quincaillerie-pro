import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { DollarSign, TrendingUp, ShoppingCart, AlertTriangle, Wallet, Users, Package } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { DashboardData } from "@/types";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const currency = user?.company?.currency || "XOF";

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardData>("/dashboard")).data,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={`Bonjour, ${user?.name?.split(" ")[0] || ""} 👋`} description="Voici la performance de votre entreprise aujourd'hui." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Chiffre d'affaires (mois)" value={formatCurrency(data.revenueMonth, currency)} icon={DollarSign} hint={`${data.salesCountMonth} ventes`} />
        <StatCard label="Bénéfice (mois)" value={formatCurrency(data.profitMonth, currency)} icon={TrendingUp} tone={data.profitMonth >= 0 ? "success" : "destructive"} />
        <StatCard label="Ventes du jour" value={formatCurrency(data.revenueToday, currency)} icon={ShoppingCart} hint={`${data.salesCountToday} ventes`} />
        <StatCard label="Produits en rupture" value={String(data.lowStockCount)} icon={AlertTriangle} tone={data.lowStockCount > 0 ? "warning" : "default"} />
        <StatCard label="Dettes clients" value={formatCurrency(data.customersDebt, currency)} icon={Users} tone="warning" />
        <StatCard label="Dettes fournisseurs" value={formatCurrency(data.suppliersDebt, currency)} icon={Wallet} tone="destructive" />
        <StatCard label="Achats (mois)" value={formatCurrency(data.purchasesMonth, currency)} icon={Package} />
        <StatCard label="Dépenses (mois)" value={formatCurrency(data.expensesMonth, currency)} icon={Wallet} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Évolution des ventes (30 derniers jours)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.salesChart.length === 0 ? (
              <EmptyState icon={TrendingUp} title="Aucune vente enregistrée" description="Le graphique apparaîtra dès votre première vente." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.salesChart}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(20 88% 53%)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(20 88% 53%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="total" stroke="hsl(20 88% 53%)" fill="url(#colorRevenue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top produits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée pour l'instant.</p>
            ) : (
              data.topProducts.map((t, idx) => (
                <div key={t.product?.id || idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">{idx + 1}</span>
                    <span className="truncate">{t.product?.name || "Produit"}</span>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">{formatCurrency(t.total || 0, currency)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ventes récentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentSales.length === 0 ? (
              <EmptyState icon={ShoppingCart} title="Aucune vente récente" />
            ) : (
              data.recentSales.map((s) => (
                <div key={s.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0 text-sm">
                  <div>
                    <p className="font-medium">{s.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.customer?.name || "Client comptant"} · {formatDateTime(s.createdAt)}
                    </p>
                  </div>
                  <span className="font-medium tabular-nums">{formatCurrency(s.totalAmount, currency)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertes de stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.lowStockProducts.length === 0 ? (
              <EmptyState icon={Package} title="Tous les stocks sont suffisants" />
            ) : (
              data.lowStockProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sku}</p>
                  </div>
                  <Badge variant="warning">
                    {p.totalStock} / {p.minStock} min
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
