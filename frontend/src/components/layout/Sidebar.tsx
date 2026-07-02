import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Tags,
  Truck,
  Users,
  ShoppingCart,
  ClipboardList,
  Warehouse,
  Building2,
  ArrowLeftRight,
  ClipboardCheck,
  Wallet,
  Calculator,
  Receipt,
  UserCog,
  KeyRound,
  Settings,
  Bell,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles?: string[];
}

const nav: { section: string; items: NavItem[] }[] = [
  {
    section: "Aperçu",
    items: [{ to: "/", label: "Tableau de bord", icon: LayoutDashboard }],
  },
  {
    section: "Catalogue",
    items: [
      { to: "/produits", label: "Produits", icon: Package },
      { to: "/catalogue", label: "Catégories & marques", icon: Tags },
      { to: "/fournisseurs", label: "Fournisseurs", icon: Truck },
      { to: "/clients", label: "Clients", icon: Users },
    ],
  },
  {
    section: "Opérations",
    items: [
      { to: "/ventes", label: "Vente rapide", icon: ShoppingCart },
      { to: "/ventes/historique", label: "Historique des ventes", icon: ClipboardList },
      { to: "/achats", label: "Achats", icon: Receipt },
      { to: "/commandes", label: "Commandes", icon: ClipboardCheck },
    ],
  },
  {
    section: "Stock",
    items: [
      { to: "/stock", label: "Stock", icon: Warehouse },
      { to: "/depots", label: "Dépôts", icon: Building2 },
      { to: "/transferts", label: "Transferts", icon: ArrowLeftRight },
      { to: "/inventaires", label: "Inventaires", icon: ClipboardCheck },
    ],
  },
  {
    section: "Finance",
    items: [
      { to: "/depenses", label: "Dépenses", icon: Wallet },
      { to: "/comptabilite", label: "Comptabilité", icon: Calculator },
    ],
  },
  {
    section: "Équipe",
    items: [
      { to: "/employes", label: "Employés", icon: UserCog, roles: ["PROPRIETAIRE", "GERANT"] },
      { to: "/utilisateurs", label: "Utilisateurs", icon: KeyRound, roles: ["PROPRIETAIRE", "GERANT"] },
    ],
  },
  {
    section: "Système",
    items: [
      { to: "/notifications", label: "Notifications", icon: Bell },
      { to: "/parametres", label: "Paramètres", icon: Settings, roles: ["PROPRIETAIRE", "GERANT"] },
    ],
  },
];

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-border bg-card transition-transform lg:static lg:translate-x-0 lg:flex lg:flex-col",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Wrench className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold">Quincaillerie Pro</p>
            <p className="text-[11px] text-muted-foreground">{user?.company?.name || "Authentique-Studio"}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
          {isSuperAdmin ? (
            <NavLink
              to="/super-admin"
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-secondary"
                )
              }
            >
              <ShieldCheck className="h-4 w-4" />
              Super Admin
            </NavLink>
          ) : (
            nav.map((group) => {
              const items = group.items.filter((it) => !it.roles || (user && it.roles.includes(user.role)));
              if (!items.length) return null;
              return (
                <div key={group.section} className="mb-4">
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.section}</p>
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          isActive ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-secondary"
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              );
            })
          )}
        </nav>
      </aside>
    </>
  );
}
