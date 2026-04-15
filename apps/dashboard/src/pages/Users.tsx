import { useState } from "react";
import { Plus, Search, MoreHorizontal, Mail, Phone, Shield } from "lucide-react";
import { Header } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@elementus/shared";

const ROLE_LABELS: Record<UserRole, string> = {
  ceo: "CEO",
  manager: "Gerente",
  supervisor: "Supervisor",
  technician: "Técnico de Campo",
};

const ROLE_COLORS: Record<UserRole, string> = {
  ceo: "bg-purple-100 text-purple-800",
  manager: "bg-blue-100 text-blue-800",
  supervisor: "bg-green-100 text-green-800",
  technician: "bg-amber-100 text-amber-800",
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ceo: "Acesso total + configurações do sistema",
  manager: "Acesso total + cadastro de usuários",
  supervisor: "Projetos, campanhas, dados, relatórios e validação",
  technician: "Apenas visualização e expedição de relatórios",
};

const mockUsers = [
  {
    id: "1",
    name: "Sanzio Rafael",
    email: "sanzio@elementus.com.br",
    phone: "(84) 99999-0001",
    role: "ceo" as UserRole,
    professional_register: "",
    active: true,
    created_at: "2026-04-01",
  },
  {
    id: "2",
    name: "Ana Costa",
    email: "ana.costa@elementus.com.br",
    phone: "(84) 99999-0002",
    role: "manager" as UserRole,
    professional_register: "",
    active: true,
    created_at: "2026-04-02",
  },
  {
    id: "3",
    name: "Carlos Silva",
    email: "carlos.silva@elementus.com.br",
    phone: "(84) 99999-0003",
    role: "supervisor" as UserRole,
    professional_register: "CRBIO 12345/06-D",
    active: true,
    created_at: "2026-04-03",
  },
  {
    id: "4",
    name: "Pedro Almeida",
    email: "pedro.almeida@elementus.com.br",
    phone: "(84) 99999-0004",
    role: "technician" as UserRole,
    professional_register: "CREA 123456/D",
    active: true,
    created_at: "2026-04-03",
  },
  {
    id: "5",
    name: "Maria Souza",
    email: "maria.souza@elementus.com.br",
    phone: "(84) 99999-0005",
    role: "technician" as UserRole,
    professional_register: "CRBIO 67890/06-D",
    active: true,
    created_at: "2026-04-04",
  },
  {
    id: "6",
    name: "Roberto Lima",
    email: "roberto.lima@elementus.com.br",
    phone: "(84) 99999-0006",
    role: "technician" as UserRole,
    professional_register: "CREA 654321/D",
    active: false,
    created_at: "2026-04-05",
  },
];

// Roles que cada perfil pode criar
const CAN_CREATE: Record<UserRole, UserRole[]> = {
  ceo: ["manager", "supervisor", "technician"],
  manager: ["supervisor", "technician"],
  supervisor: [],
  technician: [],
};

export function UsersPage() {
  const { user, hasAccess } = useAuth();
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUserRole, setNewUserRole] = useState<UserRole>("technician");

  const creatableRoles = user ? CAN_CREATE[user.role] : [];
  const activeUsers = mockUsers.filter((u) => u.active);
  const inactiveUsers = mockUsers.filter((u) => !u.active);

  return (
    <div>
      <Header title="Usuários" description="Gerencie os acessos da equipe Elementus" />

      <div className="p-6 space-y-6 max-w-4xl">
        {/* Stats por role */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["ceo", "manager", "supervisor", "technician"] as UserRole[]).map((role) => {
            const count = mockUsers.filter((u) => u.role === role && u.active).length;
            return (
              <Card key={role}>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{count}</p>
                  <Badge className={`text-[10px] mt-1 ${ROLE_COLORS[role]}`}>
                    {ROLE_LABELS[role]}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Permissões por role — referência visual */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Níveis de Acesso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(["ceo", "manager", "supervisor", "technician"] as UserRole[]).map((role) => (
                <div key={role} className="flex items-center gap-2 rounded-md border p-2.5">
                  <Badge className={`text-[10px] shrink-0 ${ROLE_COLORS[role]}`}>
                    {ROLE_LABELS[role]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Barra de ações */}
        <div className="flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              className="h-10 w-full rounded-md border bg-white pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {creatableRoles.length > 0 && (
            <Button onClick={() => setShowNewUser(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Usuário
            </Button>
          )}
        </div>

        {/* Modal novo usuário */}
        {showNewUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-base">Cadastrar Novo Usuário</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nome completo</label>
                  <input
                    type="text"
                    placeholder="Nome do colaborador"
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">E-mail</label>
                  <input
                    type="email"
                    placeholder="email@elementus.com.br"
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Telefone / WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="(84) 99999-0000"
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Registro Profissional (opcional)</label>
                  <input
                    type="text"
                    placeholder="CREA, CRBIO, CRQ..."
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Nível de Acesso</label>
                  <div className="mt-2 space-y-2">
                    {creatableRoles.map((role) => (
                      <label
                        key={role}
                        className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                          newUserRole === role
                            ? "border-elementus-blue bg-elementus-blue/5"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={role}
                          checked={newUserRole === role}
                          onChange={() => setNewUserRole(role)}
                          className="accent-elementus-blue"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{ROLE_LABELS[role]}</span>
                            <Badge className={`text-[9px] ${ROLE_COLORS[role]}`}>
                              {ROLE_LABELS[role]}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowNewUser(false)}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" onClick={() => setShowNewUser(false)}>
                    Cadastrar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lista de usuários ativos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Usuários Ativos ({activeUsers.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {activeUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-elementus-blue/10 text-sm font-bold text-elementus-blue">
                    {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <Badge className={`text-[10px] ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {u.email}
                      </span>
                      {u.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {u.phone}
                        </span>
                      )}
                    </div>
                    {u.professional_register && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{u.professional_register}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Inativos */}
        {inactiveUsers.length > 0 && (
          <Card className="opacity-60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Inativos ({inactiveUsers.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {inactiveUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                      {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{u.name}</p>
                        <Badge variant="outline" className="text-[10px]">Inativo</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <Button variant="outline" size="sm">Reativar</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
