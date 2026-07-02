import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import toast from "react-hot-toast";
import type { Company } from "@/types";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((s) => s.updateUser);
  const user = useAuthStore((s) => s.user);
  const { data: company } = useQuery({ queryKey: ["settings"], queryFn: async () => (await api.get<Company>("/settings")).data });

  const [form, setForm] = useState({ name: "", logo: "", currency: "XOF", phone: "", email: "", address: "" });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name || "",
        logo: company.logo || "",
        currency: company.currency || "XOF",
        phone: company.phone || "",
        email: company.email || "",
        address: company.address || "",
      });
    }
  }, [company]);

  const save = useMutation({
    mutationFn: async () => (await api.put<Company>("/settings", form)).data,
    onSuccess: (updated) => {
      toast.success("Paramètres enregistrés");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      if (user) updateUser({ ...user, company: updated });
    },
  });

  return (
    <div>
      <PageHeader title="Paramètres" description="Informations générales de votre entreprise" />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Entreprise</CardTitle>
          <CardDescription>Ces informations apparaissent sur vos factures et reçus</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nom de l'entreprise</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Logo (URL)</Label>
            <Input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} placeholder="https://..." />
            {form.logo && <img src={form.logo} alt="Logo" className="mt-2 h-12 rounded-md border border-border object-contain p-1" />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Devise</Label>
              <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option value="XOF">XOF (FCFA)</option>
                <option value="XAF">XAF (FCFA)</option>
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="MAD">MAD (DH)</option>
                <option value="GNF">GNF (FG)</option>
              </Select>
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Adresse</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Enregistrer les modifications
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
