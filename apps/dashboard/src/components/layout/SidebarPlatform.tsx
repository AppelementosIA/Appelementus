import { NavLink } from "react-router-dom";
import { Database, FileStack, FileText, LayoutDashboard, Leaf, LogOut, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@elementus/shared";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  minRole: UserRole;
}

const navigation: NavItem[] = [
  { name: "Inicio", href: "/", icon: LayoutDashboard, minRole: "technician" },
  { name: "Cadastros", href: "/projects", icon: Database, minRole: "technician" },
  { name: "Relatorios", href: "/reports", icon: FileText, minRole: "technician" },
  { name: "Templates", href: "/templates", icon: FileStack, minRole: "supervisor" },
];

const bottomNav: NavItem[] = [
  { name: "Usuarios", href: "/users", icon: Users, minRole: "manager" },
  { name: "Configuracoes", href: "/settings", icon: Settings, minRole: "ceo" },
];

const roleLabels: Record<UserRole, string> = {
  ceo: "CEO",
  manager: "Gerente",
  supervisor: "Supervisor",
  technician: "Tecnico",
};

const roleColors: Record<UserRole, string> = {
  ceo: "bg-blue-100 text-blue-800",
  manager: "bg-sky-100 text-sky-800",
  supervisor: "bg-green-100 text-green-800",
  technician: "bg-amber-100 text-amber-800",
};

export function SidebarPlatform() {
  const { user, hasAccess, logout } = useAuth();

  const visibleNav = navigation.filter((item) => hasAccess(item.minRole));
  const visibleBottom = bottomNav.filter((item) => hasAccess(item.minRole));

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-white">
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-elementus-blue">
          <Leaf className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-elementus-blue">Elementus</h1>
          <p className="text-[10px] leading-none text-muted-foreground">
            Plataforma de Relatorios
          </p>
        </div>
      </div>

      <Separator />

      {user ? (
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-elementus-blue/10 text-sm font-bold text-elementus-blue">
              {user.name
                .split(" ")
                .map((name) => name[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <Badge className={cn("px-1.5 py-0 text-[10px]", roleColors[user.role])}>
                {roleLabels[user.role]}
              </Badge>
            </div>
          </div>
        </div>
      ) : null}

      <Separator />

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visibleNav.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-elementus-blue/10 text-elementus-blue"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <Separator />

      <div className="space-y-1 px-3 py-3">
        {visibleBottom.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-elementus-blue/10 text-elementus-blue"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </NavLink>
        ))}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
