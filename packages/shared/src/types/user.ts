export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  professional_register?: string;
  phone?: string;
  active: boolean;
  created_by?: string;
  created_at: string;
}

/**
 * Hierarquia de permissões:
 * CEO > Gerente > Supervisor > Técnico
 *
 * CEO        — acesso total + gestão de usuários + configurações
 * Gerente    — acesso total + cadastra supervisores e técnicos
 * Supervisor — projetos, campanhas, dados, relatórios, validação, templates
 * Técnico    — apenas relatórios (revisar e expedir)
 */
export type UserRole = "ceo" | "manager" | "supervisor" | "technician";

export const ROLE_LABELS: Record<UserRole, string> = {
  ceo: "CEO",
  manager: "Gerente",
  supervisor: "Supervisor",
  technician: "Técnico de Campo",
};

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  ceo: 4,
  manager: 3,
  supervisor: 2,
  technician: 1,
};
