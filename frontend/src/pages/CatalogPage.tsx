import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Tags } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import toast from "react-hot-toast";
import type { Category, SubCategory, Brand } from "@/types";

type Kind = "categories" | "subcategories" | "brands";

function useSimpleCrud<T extends { id: string; name: string }>(kind: Kind) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: [kind], queryFn: async () => (await api.get<T[]>(`/${kind}`)).data });

  const create = useMutation({
    mutationFn: async (payload: any) => api.post(`/${kind}`, payload),
    onSuccess: () => {
      toast.success("Ajouté avec succès");
      queryClient.invalidateQueries({ queryKey: [kind] });
    },
  });
  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => api.put(`/${kind}/${id}`, payload),
    onSuccess: () => {
      toast.success("Mis à jour");
      queryClient.invalidateQueries({ queryKey: [kind] });
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/${kind}/${id}`),
    onSuccess: () => {
      toast.success("Supprimé");
      queryClient.invalidateQueries({ queryKey: [kind] });
    },
  });

  return { query, create, update, remove };
}

export default function CatalogPage() {
  return (
    <div>
      <PageHeader title="Catégories & marques" description="Organisez votre catalogue de produits" />
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Catégories</TabsTrigger>
          <TabsTrigger value="subcategories">Sous-catégories</TabsTrigger>
          <TabsTrigger value="brands">Marques</TabsTrigger>
        </TabsList>
        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="subcategories">
          <SubCategoriesTab />
        </TabsContent>
        <TabsContent value="brands">
          <BrandsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CategoriesTab() {
  const { query, create, update, remove } = useSimpleCrud<Category>("categories");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setDialogOpen(true);
  }
  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setDescription(c.description || "");
    setDialogOpen(true);
  }
  function save() {
    const payload = { name, description };
    if (editing) update.mutate({ id: editing.id, payload }, { onSuccess: () => setDialogOpen(false) });
    else create.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouvelle catégorie
        </Button>
      </div>
      {!query.data?.length ? (
        <EmptyState icon={Tags} title="Aucune catégorie" action={<Button onClick={openCreate}>Créer une catégorie</Button>} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Sous-catégories</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.subCategories?.length || 0}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nom *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button disabled={!name} onClick={save} loading={create.isPending || update.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Supprimer cette catégorie ?"
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
        loading={remove.isPending}
      />
    </div>
  );
}

function SubCategoriesTab() {
  const { query, create, update, remove } = useSimpleCrud<SubCategory>("subcategories");
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: async () => (await api.get<Category[]>("/categories")).data });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubCategory | null>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SubCategory | null>(null);

  function openCreate() {
    setEditing(null);
    setName("");
    setCategoryId(categories?.[0]?.id || "");
    setDialogOpen(true);
  }
  function openEdit(sc: SubCategory) {
    setEditing(sc);
    setName(sc.name);
    setCategoryId(sc.categoryId);
    setDialogOpen(true);
  }
  function save() {
    const payload = { name, categoryId };
    if (editing) update.mutate({ id: editing.id, payload }, { onSuccess: () => setDialogOpen(false) });
    else create.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={openCreate} disabled={!categories?.length}>
          <Plus className="h-4 w-4" />
          Nouvelle sous-catégorie
        </Button>
      </div>
      {!categories?.length ? (
        <EmptyState icon={Tags} title="Créez d'abord une catégorie" />
      ) : !query.data?.length ? (
        <EmptyState icon={Tags} title="Aucune sous-catégorie" action={<Button onClick={openCreate}>Créer</Button>} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Catégorie parente</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.map((sc) => (
              <TableRow key={sc.id}>
                <TableCell className="font-medium">{sc.name}</TableCell>
                <TableCell className="text-muted-foreground">{sc.category?.name}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(sc)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(sc)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier" : "Nouvelle sous-catégorie"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Catégorie parente *</Label>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Nom *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button disabled={!name || !categoryId} onClick={save} loading={create.isPending || update.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Supprimer cette sous-catégorie ?"
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
        loading={remove.isPending}
      />
    </div>
  );
}

function BrandsTab() {
  const { query, create, update, remove } = useSimpleCrud<Brand>("brands");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null);

  function openCreate() {
    setEditing(null);
    setName("");
    setDialogOpen(true);
  }
  function openEdit(b: Brand) {
    setEditing(b);
    setName(b.name);
    setDialogOpen(true);
  }
  function save() {
    if (editing) update.mutate({ id: editing.id, payload: { name } }, { onSuccess: () => setDialogOpen(false) });
    else create.mutate({ name }, { onSuccess: () => setDialogOpen(false) });
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouvelle marque
        </Button>
      </div>
      {!query.data?.length ? (
        <EmptyState icon={Tags} title="Aucune marque" action={<Button onClick={openCreate}>Créer une marque</Button>} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(b)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la marque" : "Nouvelle marque"}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nom *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button disabled={!name} onClick={save} loading={create.isPending || update.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Supprimer cette marque ?"
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
        loading={remove.isPending}
      />
    </div>
  );
}
