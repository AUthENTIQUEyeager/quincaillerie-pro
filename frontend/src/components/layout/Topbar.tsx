import { Menu, Moon, Sun, Bell, LogOut, User } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useThemeStore } from "@/store/themeStore";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import type { Notification } from "@/types";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const { data: notifications } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => (await api.get<Notification[]>("/notifications")).data,
    enabled: user?.role !== "SUPER_ADMIN",
    refetchInterval: 30000,
  });
  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/80 backdrop-blur px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Basculer le thème">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {user?.role !== "SUPER_ADMIN" && (
          <Button variant="ghost" size="icon" className="relative" onClick={() => navigate("/notifications")} aria-label="Notifications">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <Badge variant="destructive" className="absolute -right-0.5 -top-0.5 h-4 min-w-4 justify-center px-1 text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </Button>
        )}

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {user ? initials(user.name) : <User className="h-4 w-4" />}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-[200px] rounded-md border border-border bg-popover p-1.5 shadow-lg">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <div className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none hover:bg-destructive/10"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
