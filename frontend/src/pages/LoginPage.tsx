import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Wrench, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import toast from "react-hot-toast";
import type { AuthUser } from "@/types";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post<{ token: string; user: AuthUser }>("/auth/login", { email, password });
      setAuth(data.token, data.user);
      toast.success(`Bienvenue, ${data.user.name.split(" ")[0]}`);
      navigate(data.user.role === "SUPER_ADMIN" ? "/super-admin" : "/");
    } catch {
      // géré par l'intercepteur axios
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wrench className="h-5 w-5" />
          </div>
          <h1 className="font-display text-xl font-semibold">Quincaillerie Pro</h1>
          <p className="text-sm text-muted-foreground">Connectez-vous à votre espace de gestion</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connexion</CardTitle>
            <CardDescription>Entrez vos identifiants pour continuer</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Adresse email</Label>
                <Input id="email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@entreprise.com" />
              </div>
              <div>
                <Label htmlFor="password">Mot de passe</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <Button type="submit" className="w-full" loading={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Se connecter"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Nouvelle entreprise ?{" "}
          <Link to="/inscription" className="font-medium text-primary hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
