import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Wrench } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import toast from "react-hot-toast";
import type { AuthUser } from "@/types";

export default function RegisterCompanyPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ companyName: "", ownerName: "", email: "", password: "", phone: "", currency: "XOF" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post<{ token: string; user: AuthUser }>("/auth/register-company", form);
      setAuth(data.token, data.user);
      toast.success("Entreprise créée avec succès !");
      navigate("/");
    } catch {
      // géré par l'intercepteur
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wrench className="h-5 w-5" />
          </div>
          <h1 className="font-display text-xl font-semibold">Créer votre quincaillerie</h1>
          <p className="text-sm text-muted-foreground">Un magasin principal sera créé automatiquement</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nouvelle entreprise</CardTitle>
            <CardDescription>Vous serez le propriétaire de ce compte</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="companyName">Nom de l'entreprise</Label>
                <Input id="companyName" required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Quincaillerie Sanou & Fils" />
              </div>
              <div>
                <Label htmlFor="ownerName">Votre nom complet</Label>
                <Input id="ownerName" required value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} placeholder="Adama Sanou" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+226 70 00 00 00" />
                </div>
                <div>
                  <Label htmlFor="currency">Devise</Label>
                  <Select id="currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                    <option value="XOF">XOF (FCFA)</option>
                    <option value="XAF">XAF (FCFA)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="MAD">MAD (DH)</option>
                    <option value="GNF">GNF (FG)</option>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="email">Adresse email</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nom@entreprise.com" />
              </div>
              <div>
                <Label htmlFor="password">Mot de passe</Label>
                <Input id="password" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Minimum 6 caractères" />
              </div>
              <Button type="submit" className="w-full" loading={loading}>
                Créer mon compte
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
