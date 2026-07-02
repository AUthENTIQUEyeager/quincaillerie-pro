import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Ban, CheckCircle, ShieldCheck, Building2, Users, DollarSign, Activity, LogOut, KeyRound } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";

interface Stats {
  totalCompanies: number;
  activeCompanies: number;
  totalUsers: number;
  totalSalesAmount: number;
  totalSalesCount: number;
}

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({ queryKey: ["superadmin", "stats"], queryFn: async () => (await api.get<Stats>("/superadmin/stats")).data });
  const { data: companies } = useQuery({ queryKey: ["superadmin", "companies"], queryFn: async () => (await api.get("/superadmin/companies")).data });
  const { data: users } = useQuery({ queryKey: ["superadmin", "users"], queryFn: async () => (await api.get("/superadmin/users")).data });
  const { data: connections } = useQuery({ queryKey: ["superadmin", "connections"], queryFn: async () => (await api.get("/superadmin/connections")).data });
  const { data: auditLogs } = useQuery({ queryKey: ["superadmin", "audit"], queryFn: async () => (await api.get("/superadmin/audit-logs")).data });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", currency: "XOF", phone: "", ownerName: "", ownerEmail: "", ownerPassword: "" });
  const [resetTarget, setResetTarget] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const createCompany = useMutation({
    mutationFn: async () => api.post("/superadmin/companies", form),
    onSuccess: () => {
      toast.success("Entreprise créée");
      queryClient.invalidateQueries({ queryKey: ["superadmin"] });
      setDialogOpen(false);
      setForm({ name: "", currency: "XOF", phone: "", ownerName: "", ownerEmail: "", ownerPassword: "" });
    },
  });

  const toggleCompany = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => api.put(`/superadmin/companies/${id}`, { isActive }),
    onSuccess: () => {
      toast.success("Statut mis à jour");
      queryClient.invalidateQueries({ queryKey: ["superadmin", "companies"] });
    },
  });

  const resetPassword = useMutation({
    mutationFn: async () => api.post(`/superadmin/users/${resetTarget.id}/reset-password`, { newPassword }),
    onSuccess: () => {
      toast.success("Mot de passe réinitialisé");
      setResetTarget(null);
      setNewPassword("");
    },
  });

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-semibold">Console Authentique-Studio</h1>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Déconnexion
        </Button>
      </div>

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Entreprises" value={String(stats.totalCompanies)} icon={Building2} hint={`${stats.activeCompanies} actives`} />
          <StatCard label="Utilisateurs" value={String(stats.totalUsers)} icon={Users} />
          <StatCard label="Ventes totales" value={formatCurrency(stats.totalSalesAmount, "XOF")} icon={DollarSign} />
          <StatCard label="Transactions" value={String(stats.totalSalesCount)} icon={Activity} />
        </div>
      )}

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies">Entreprises</TabsTrigger>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="connections">Connexions</TabsTrigger>
          <TabsTrigger value="logs">Journaux</TabsTrigger>
        </TabsList>

        <TabsContent value="companies">
          <div className="mb-3 flex justify-end">
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Nouvelle entreprise
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entreprise</TableHead>
                <TableHead>Magasins</TableHead>
                <TableHead>Utilisateurs</TableHead>
                <TableHead>Ventes</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.stores?.length || 0}</TableCell>
                  <TableCell className="text-muted-foreground">{c.users?.length || 0}</TableCell>
                  <TableCell className="text-muted-foreground">{c._count?.sales || 0}</TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? "success" : "destructive"}>{c.isActive ? "Active" : "Désactivée"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => toggleCompany.mutate({ id: c.id, isActive: !c.isActive })}>
                      {c.isActive ? <Ban className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-success" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="users">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Entreprise</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="text-muted-foreground">{u.company?.name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.role}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setResetTarget(u)} aria-label="Réinitialiser mot de passe">
                      <KeyRound className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="connections">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Entreprise</TableHead>
                <TableHead>Dernière connexion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.company?.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(c.lastLoginAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="logs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Entreprise</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!auditLogs?.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Aucun journal pour l'instant
                  </TableCell>
                </TableRow>
              ) : (
                auditLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground">{formatDateTime(log.createdAt)}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell className="text-muted-foreground">{log.user?.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{log.company?.name || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle entreprise</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nom de l'entreprise *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Devise</Label>
                <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option value="XOF">XOF</option>
                  <option value="XAF">XAF</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </Select>
              </div>
              <div>
                <Label>Téléphone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Nom du propriétaire *</Label>
              <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
            </div>
            <div>
              <Label>Email du propriétaire *</Label>
              <Input type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
            </div>
            <div>
              <Label>Mot de passe *</Label>
              <Input type="password" minLength={6} value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button loading={createCompany.isPending} onClick={() => createCompany.mutate()}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={(v) => !v && setResetTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe de {resetTarget?.name}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nouveau mot de passe</Label>
            <Input type="password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              Annuler
            </Button>
            <Button disabled={newPassword.length < 6} loading={resetPassword.isPending} onClick={() => resetPassword.mutate()}>
              Réinitialiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
