import type { ElementType } from "react";
import { NavLink } from "react-router-dom";
import {
  FileText,
  Image,
  Inbox,
  Leaf,
  LogOut,
  Send,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@elementus/shared";
import {
  getWorkflowStageCounts,
  workflowStageMeta,
  workflowStageOrder,
  type WorkflowStage,
} from "@/data/workflow";

interface NavItem {
  name: string;
  href: string;
  icon: ElementType;
  minRole: UserRole;
  count?: number;
}

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

const workflowIcons: Record<WorkflowStage, ElementType> = {
  entrada: Inbox,
  montagem: Sparkles,
  relatorio: FileText,
  imagens: Image,
  envio: Send,
};

export function SidebarPlatform() {
  const { user, hasAccess, isPresentationMode, logout } = useAuth();
  const stageCounts = getWorkflowStageCounts();

  const navigation: NavItem[] = workflowStageOrder.map((stage) => ({
    name: workflowStageMeta[stage].label,
    href: workflowStageMeta[stage].href,
    icon: workflowIcons[stage],
    minRole: "technician",
    count: stageCounts[stage],
  }));

  const visibleNav = navigation.filter((item) => hasAccess(item.minRole));
  const visibleBottom = bottomNav.filter((item) => hasAccess(item.minRole));

  return (
    <aside className="border-b bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-3 px-4 py-4 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-elementus-blue">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-elementus-blue">Elementus</h1>
            <p className="text-[11px] leading-none text-muted-foreground">
              Estacao operacional de relatorios
            </p>
          </div>
        </div>

        <Badge variant={isPresentationMode ? "info" : "outline"}>
          {isPresentationMode ? "Demo" : "Producao"}
        </Badge>
      </div>

      {user ? (
        <div className="px-4 pb-4 lg:px-6">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/40 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-elementus-blue/10 text-sm font-bold text-elementus-blue">
              {user.name
                .split(" ")
                .map((name) => name[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge className={cn("px-1.5 py-0 text-[10px]", roleColors[user.role])}>
                  {roleLabels[user.role]}
                </Badge>
                {isPresentationMode ? <Badge variant="info">Sem login Microsoft</Badge> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="flex gap-2 overflow-x-auto px-4 pb-4 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:px-3">
        {visibleNav.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "min-w-44 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors lg:min-w-0",
                isActive
                  ? "border-elementus-blue bg-elementus-blue/10 text-elementus-blue"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </div>
              <Badge variant="outline">{item.count ?? 0}</Badge>
            </div>
            <p className="mt-2 text-xs font-normal leading-relaxed text-muted-foreground">
              {workflowStageMeta[
                workflowStageOrder.find((stage) => workflowStageMeta[stage].href === item.href) ?? "entrada"
              ].description}
            </p>
          </NavLink>
        ))}
      </nav>

      <div className="hidden px-4 pb-4 lg:block">
        <div className="rounded-2xl border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Foco da fase
          </p>
          <p className="mt-2 text-sm font-medium">
            WhatsApp - montagem - IA - imagens - envio
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            A plataforma agora acompanha atendimento vivo em vez de esconder o fluxo em menus separados.
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-t px-4 py-4 lg:block lg:space-y-1 lg:border-t lg:px-3">
        {visibleBottom.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex min-w-max items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
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
          className="flex min-w-max items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
