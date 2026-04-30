import type { UserRole } from "./user";

export type UserOnboardingStatus = "pending_profile" | "active" | "blocked";

export type SignatureStatus = "missing" | "pending_review" | "approved" | "rejected";

export interface ProfessionalProfile {
  user_id: string;
  professional_role?: string;
  registry_type?: string;
  registry_number?: string;
  can_sign_reports: boolean;
  signature_name?: string;
  signature_data_url?: string;
  signature_mime_type?: string;
  signature_status: SignatureStatus;
  signature_updated_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PlatformUser {
  id: string;
  entra_oid: string;
  email: string;
  name: string;
  role: UserRole;
  tenant_id?: string;
  phone?: string;
  phone_whatsapp?: string;
  avatar_url?: string;
  active: boolean;
  onboarding_status: UserOnboardingStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  professional_register?: string;
  professional_profile?: ProfessionalProfile | null;
}

export interface ReportSignerSnapshot {
  id: string;
  report_id: string;
  user_id?: string | null;
  name_snapshot: string;
  role_snapshot?: string | null;
  registry_type_snapshot?: string | null;
  registry_number_snapshot?: string | null;
  signature_name_snapshot?: string | null;
  signature_data_url_snapshot?: string | null;
  signature_status_snapshot: SignatureStatus;
  created_at: string;
  updated_at: string;
}
