import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import toast from "react-hot-toast";
import type { Company } from "@/types";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((s) => s.updateUser);
  const user = useAuthStore((s) => s.user);
  const { data: company } = useQuery({ queryKey: ["settings"], queryFn: async () => (await api.get<Company>("/settings")).data });

  const logoInputRef = useRef<HTMLInputElement>(null);

  // Charge une image depuis l'ordinateur, la réduit (max 300 px) et la garde dans la fiche entreprise.
  // Ainsi le logo s'affiche toujours sur les devis et reçus, sans dépendre d'un lien externe.
  function onLogoFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez un fichier image (PNG, JPG...).");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 300 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        toast.error("Impossible de traiter cette image.");
        URL.revokeObjectURL(url);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/png");
      URL.revokeObjectURL(url);
      if (dataUrl.length > 400_000) {
        toast.error("Image trop lourde. Choisissez un logo plus simple.");
        return;
      }
      setForm((f) => ({ ...f, logo: dataUrl }));
      toast.success("Logo chargé. Cliquez sur « Enregistrer les modifications ».");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error("Impossible de lire cette image.");
    };
    img.src = url;
  }

  const [form, setForm] = useState({ name: "", logo: "", currency: "XOF", phone: "", email: "", address: "", receiptFooter: "", activities: "", slogan: "" });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name || "",
        logo: company.logo || "",
        currency: company.currency || "XOF",
        phone: company.phone || "",
        email: company.email || "",
        address: company.address || "",
        receiptFooter: company.receiptFooter || "",
        activities: company.activities || "",
        slogan: company.slogan || "",
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
            <Label>Logo</Label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onLogoFile(file);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}>
                Choisir une image
              </Button>
              {form.logo && (
                <Button type="button" variant="ghost" onClick={() => setForm({ ...form, logo: "" })}>
                  Retirer le logo
                </Button>
              )}
            </div>
            {form.logo ? (
              <img src={form.logo} alt="Logo" className="mt-2 h-16 rounded-md border border-border object-contain p-1" />
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Aucun logo. Choisissez une image depuis votre ordinateur (PNG ou JPG).</p>
            )}
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Ou utiliser un lien (URL) vers une image</summary>
              <Input
                className="mt-1.5"
                value={form.logo.startsWith("data:") ? "" : form.logo}
                onChange={(e) => setForm({ ...form, logo: e.target.value })}
                placeholder="https://.../logo.png"
              />
            </details>
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
            <Label>Siège / adresse</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Ex. : Secteur 16 Bobo-Dioulasso, en face de ..." />
          </div>
          <div>
            <Label>Activités (en-tête du bordereau de livraison)</Label>
            <Textarea
              rows={4}
              maxLength={600}
              value={form.activities}
              onChange={(e) => setForm({ ...form, activities: e.target.value })}
              placeholder="Ex. : Section MATERIAUX DE CONSTRUCTION&#10;Fer à béton, Ciment, Tôles, Mobilier, Fourniture bureautique..."
            />
          </div>
          <div>
            <Label>Slogan (sous le logo)</Label>
            <Input maxLength={200} value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} placeholder="Ex. : L'étincelle du bien-être et de la qualité !" />
          </div>
          <div>
            <Label>Texte en bas des devis et reçus</Label>
            <Textarea
              rows={3}
              maxLength={500}
              value={form.receiptFooter}
              onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
              placeholder="Ex. : Merci de votre confiance. Devis valable 15 jours. Paiement par Mobile Money : 70 00 00 00"
            />
            <p className="mt-1 text-xs text-muted-foreground">Laissez vide pour afficher « Merci de votre confiance » sur les reçus.</p>
          </div>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Enregistrer les modifications
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
