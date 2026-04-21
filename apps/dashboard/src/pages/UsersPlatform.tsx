import { useEffect, useMemo, useState } from "react";
import type { PlatformUser, SignatureStatus, UserOnboardingStatus, UserRole } from "@elementus/shared";
import { ROLE_LABELS } from "@elementus/shared";
import { LoaderCircle, Mail, Phone, Search, ShieldCheck, UserCog } from "lucide-react";
import { Header } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { fetchPlatformUsers, updatePlatformUser } from "@/lib/userApi";

const ROLE_COLORS: Record<UserRole, string> = {
  ceo: "bg-blue-100 text-blue-800",
  manager: "bg-sky-100 text-sky-800",
  supervisor: "bg-green-100 text-green-800",
  technician: "bg-amber-100 text-amber-800",
};

const ONBOARDING_LABELS: Record<UserOnboardingStatus, string> = {
  pending_profile: "Primeiro acesso pendente",
  active: "Ativo",
  blocked: "Bloqueado",
};

const SIGNATURE_LABELS: Record<SignatureStatus, string> = {
  missing: "Sem assinatura",
  pending_review: "Aguardando revisao",
  approved: "Aprovada",
  rejected: "Rejeitada",
};

const AVAILABLE_ROLES: UserRole[] = ["technician", "supervisor", "manager", "ceo"];
const AVAILABLE_SIGNATURE_STATUS: SignatureStatus[] = [
  "missing",
  "pending_review",
  "approved",
  "rejected",
];

type EditableUser = {
  id: string;
  role: UserRole;
  active: boolean;
  onboarding_status: UserOnboardingStatus;
  phone: string;
  professional_role: string;
  registry_type: string;
  registry_number: string;
  can_sign_reports: boolean;
  signature_name: string;
  signature_status: SignatureStatus;
};

function buildEditableUser(user: PlatformUser): EditableUser {
  return {
    id: user.id,
    role: user.role,
    active: user.active,
    onboarding_status: user.onboarding_status,
    phone: user.phone || "",
    professional_role: user.professional_profile?.professional_role || "",
    registry_type: user.professional_profile?.registry_type || "",
    registry_number: user.professional_profile?.registry_number || "",
    can_sign_reports: Boolean(user.professional_profile?.can_sign_reports),
    signature_name: user.professional_profile?.signature_name || "",
    signature_status: user.professional_profile?.signature_status || "missing",
  };
}

export function UsersPlatformPage() {
  const { getPlatformAccessToken, hasAccess } = useAuth();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [form, setForm] = useState<EditableUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadUsers = async () => {
      try {
      setIsLoading(true);
      setError(null);
      const accessToken = await getPlatformAccessToken();
      const nextUsers = await fetchPlatformUsers(accessToken);
      setUsers(nextUsers);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Nao foi possivel carregar os usuarios.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!hasAccess("manager")) {
      setIsLoading(false);
      return;
    }

    void loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) => {
      const professionalRole = user.professional_profile?.professional_role || "";
      return [user.name, user.email, professionalRole, user.professional_register || ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [search, users]);

  const activeUsers = filteredUsers.filter((user) => user.active);
  const inactiveUsers = filteredUsers.filter((user) => !user.active);

  if (!hasAccess("manager")) {
    return (
      <div>
        <Header title="Usuarios" description="Acesso restrito a gerentes e administracao" />
        <div className="p-6">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Seu perfil atual nao tem permissao para acessar o gerenciamento de usuarios.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const openEditor = (user: PlatformUser) => {
    setSelectedUser(user);
    setForm(buildEditableUser(user));
  };

  const handleSave = async () => {
    if (!selectedUser || !form) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const accessToken = await getPlatformAccessToken();
      const updated = await updatePlatformUser(accessToken, selectedUser.id, {
        role: form.role,
        active: form.active,
        onboarding_status: form.onboarding_status,
        phone: form.phone || undefined,
        professional_role: form.professional_role || undefined,
        registry_type: form.registry_type || undefined,
        registry_number: form.registry_number || undefined,
        can_sign_reports: form.can_sign_reports,
        signature_name: form.can_sign_reports ? form.signature_name || undefined : undefined,
        signature_status: form.can_sign_reports ? form.signature_status : "missing",
      });

      setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
      setSelectedUser(updated);
      setForm(buildEditableUser(updated));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Nao foi possivel atualizar o usuario.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderUserRow = (user: PlatformUser) => (
    <div
      key={user.id}
      className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-elementus-blue/10 text-sm font-bold text-elementus-blue">
        {user.name
          .split(" ")
          .map((name) => name[0])
          .join("")
          .slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{user.name}</p>
          <Badge className={ROLE_COLORS[user.role]}>{ROLE_LABELS[user.role]}</Badge>
          <Badge variant="outline">{ONBOARDING_LABELS[user.onboarding_status]}</Badge>
          {user.professional_profile?.can_sign_reports ? (
            <Badge variant="outline">{SIGNATURE_LABELS[user.professional_profile.signature_status]}</Badge>
          ) : null}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {user.email}
          </span>
          {user.phone ? (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {user.phone}
            </span>
          ) : null}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {user.professional_profile?.professional_role ? (
            <span>{user.professional_profile.professional_role}</span>
          ) : null}
          {user.professional_register ? <span>{user.professional_register}</span> : null}
        </div>
      </div>

      <Button size="sm" variant="outline" onClick={() => openEditor(user)}>
        <UserCog className="mr-2 h-4 w-4" />
        Editar
      </Button>
    </div>
  );

  return (
    <div>
      <Header
        title="Usuarios"
        description="Equipe sincronizada por Microsoft ou acesso temporario por senha, com onboarding e assinatura tecnica controlados pelo banco"
      />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {AVAILABLE_ROLES.map((role) => (
            <Card key={role}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">
                  {users.filter((user) => user.active && user.role === role).length}
                </p>
                <Badge className={`mt-1 text-[10px] ${ROLE_COLORS[role]}`}>{ROLE_LABELS[role]}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Fluxo operacional de acesso</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
            <div className="rounded-xl border p-3">
              O colaborador entra com Microsoft 365 ou com acesso temporario por senha.
            </div>
            <div className="rounded-xl border p-3">
              No primeiro acesso, a plataforma cria ou sincroniza o cadastro automaticamente.
            </div>
            <div className="rounded-xl border p-3">
              O banco passa a controlar cargo, assinatura e liberacao de uso.
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-md border bg-white pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, e-mail ou registro..."
              value={search}
            />
          </div>

          <Button onClick={() => void loadUsers()} variant="outline">
            Atualizar lista
          </Button>
        </div>

        {error ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        {isLoading ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Carregando usuarios sincronizados...
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Usuarios ativos ({activeUsers.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {activeUsers.length > 0 ? (
                    activeUsers.map(renderUserRow)
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground">
                      Nenhum usuario ativo encontrado com os filtros atuais.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="opacity-80">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Inativos ou bloqueados ({inactiveUsers.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {inactiveUsers.length > 0 ? (
                    inactiveUsers.map(renderUserRow)
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground">
                      Nenhum usuario inativo encontrado.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {selectedUser && form ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">{selectedUser.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
                <Button onClick={() => setSelectedUser(null)} variant="outline">
                  Fechar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Nivel de acesso</label>
                  <select
                    className="mt-1 h-11 w-full rounded-md border px-3 text-sm"
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, role: event.target.value as UserRole } : current
                      )
                    }
                    value={form.role}
                  >
                    {AVAILABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Status do onboarding</label>
                  <select
                    className="mt-1 h-11 w-full rounded-md border px-3 text-sm"
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              onboarding_status: event.target.value as UserOnboardingStatus,
                            }
                          : current
                      )
                    }
                    value={form.onboarding_status}
                  >
                    {Object.entries(ONBOARDING_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Telefone</label>
                  <input
                    className="mt-1 h-11 w-full rounded-md border px-3 text-sm"
                    onChange={(event) =>
                      setForm((current) => (current ? { ...current, phone: event.target.value } : current))
                    }
                    value={form.phone}
                  />
                </div>
                <label className="mt-6 flex items-center gap-3 rounded-xl border px-4 py-3">
                  <input
                    checked={form.active}
                    className="h-4 w-4 accent-elementus-blue"
                    onChange={(event) =>
                      setForm((current) => (current ? { ...current, active: event.target.checked } : current))
                    }
                    type="checkbox"
                  />
                  <div>
                    <p className="text-sm font-medium">Usuario ativo</p>
                    <p className="text-xs text-muted-foreground">
                      Desmarque para bloquear o acesso deste colaborador.
                    </p>
                  </div>
                </label>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Funcao profissional</label>
                  <input
                    className="mt-1 h-11 w-full rounded-md border px-3 text-sm"
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, professional_role: event.target.value } : current
                      )
                    }
                    value={form.professional_role}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Registro</label>
                  <input
                    className="mt-1 h-11 w-full rounded-md border px-3 text-sm"
                    onChange={(event) =>
                      setForm((current) => (current ? { ...current, registry_type: event.target.value } : current))
                    }
                    value={form.registry_type}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Numero</label>
                  <input
                    className="mt-1 h-11 w-full rounded-md border px-3 text-sm"
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, registry_number: event.target.value } : current
                      )
                    }
                    value={form.registry_number}
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-xl border px-4 py-3">
                <input
                  checked={form.can_sign_reports}
                  className="h-4 w-4 accent-elementus-blue"
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, can_sign_reports: event.target.checked } : current
                    )
                  }
                  type="checkbox"
                />
                <div>
                  <p className="text-sm font-medium">Pode assinar relatorios</p>
                  <p className="text-xs text-muted-foreground">
                    Controla quem fica disponivel como signatario tecnico.
                  </p>
                </div>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Nome da assinatura</label>
                  <input
                    className="mt-1 h-11 w-full rounded-md border px-3 text-sm"
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, signature_name: event.target.value } : current
                      )
                    }
                    value={form.signature_name}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Status da assinatura</label>
                  <select
                    className="mt-1 h-11 w-full rounded-md border px-3 text-sm"
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? { ...current, signature_status: event.target.value as SignatureStatus }
                          : current
                      )
                    }
                    value={form.signature_status}
                  >
                    {AVAILABLE_SIGNATURE_STATUS.map((status) => (
                      <option key={status} value={status}>
                        {SIGNATURE_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button onClick={() => setSelectedUser(null)} type="button" variant="outline">
                  Cancelar
                </Button>
                <Button disabled={isSaving} onClick={() => void handleSave()} type="button">
                  {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar ajustes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
