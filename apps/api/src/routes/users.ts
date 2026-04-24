import type {
  PlatformUser,
  ProfessionalProfile,
  SignatureStatus,
  UserOnboardingStatus,
  UserRole,
} from "@elementus/shared";
import { Router } from "express";
import { config } from "../lib/config.js";
import { fetchMicrosoftGraphUserProfile } from "../lib/microsoft-graph.js";
import { supabase } from "../lib/supabase.js";

const router: import("express").Router = Router();

const ROLE_HIERARCHY: Record<UserRole, number> = {
  ceo: 4,
  manager: 3,
  supervisor: 2,
  technician: 1,
};

const userSelect = `
  id,
  entra_oid,
  email,
  name,
  tenant_id,
  phone,
  phone_whatsapp,
  avatar_url,
  app_role,
  onboarding_status,
  is_active,
  created_by,
  created_at,
  updated_at,
  last_login_at,
  platform_user_profiles (
    user_id,
    professional_role,
    registry_type,
    registry_number,
    can_sign_reports,
    signature_name,
    signature_data_url,
    signature_mime_type,
    signature_status,
    signature_updated_at,
    created_at,
    updated_at
  )
`;

type RawPlatformProfileRow = {
  user_id: string;
  professional_role?: string | null;
  registry_type?: string | null;
  registry_number?: string | null;
  can_sign_reports: boolean | null;
  signature_name?: string | null;
  signature_data_url?: string | null;
  signature_mime_type?: string | null;
  signature_status?: SignatureStatus | null;
  signature_updated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type RawPlatformUserRow = {
  id: string;
  entra_oid: string;
  email: string;
  name: string;
  tenant_id?: string | null;
  phone?: string | null;
  phone_whatsapp?: string | null;
  avatar_url?: string | null;
  app_role: UserRole;
  onboarding_status: UserOnboardingStatus;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
  platform_user_profiles?: RawPlatformProfileRow[] | RawPlatformProfileRow | null;
};

type Requester = {
  provider: "microsoft365" | "password";
  accessToken: string;
  user: PlatformUser;
  profile?: Awaited<ReturnType<typeof fetchMicrosoftGraphUserProfile>>;
};

function getBearerToken(authHeader?: string) {
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) {
    return null;
  }

  return token.trim();
}

function normalizeProfile(
  profile: RawPlatformUserRow["platform_user_profiles"]
): ProfessionalProfile | null {
  const row = Array.isArray(profile) ? profile[0] : profile;

  if (!row) {
    return null;
  }

  return {
    user_id: row.user_id,
    professional_role: row.professional_role || undefined,
    registry_type: row.registry_type || undefined,
    registry_number: row.registry_number || undefined,
    can_sign_reports: Boolean(row.can_sign_reports),
    signature_name: row.signature_name || undefined,
    signature_data_url: row.signature_data_url || undefined,
    signature_mime_type: row.signature_mime_type || undefined,
    signature_status: row.signature_status || "missing",
    signature_updated_at: row.signature_updated_at || undefined,
    created_at: row.created_at || undefined,
    updated_at: row.updated_at || undefined,
  };
}

function getRawProfile(profile: RawPlatformUserRow["platform_user_profiles"]) {
  return Array.isArray(profile) ? profile[0] || null : profile || null;
}

function mapPlatformUser(row: RawPlatformUserRow): PlatformUser {
  const profile = normalizeProfile(row.platform_user_profiles);

  return {
    id: row.id,
    entra_oid: row.entra_oid,
    email: row.email,
    name: row.name,
    role: row.app_role,
    tenant_id: row.tenant_id || undefined,
    phone: row.phone || undefined,
    avatar_url: row.avatar_url || undefined,
    active: row.is_active,
    onboarding_status: row.onboarding_status,
    created_by: row.created_by || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_login_at: row.last_login_at || undefined,
    professional_profile: profile,
    professional_register:
      profile?.registry_type && profile.registry_number
        ? `${profile.registry_type} ${profile.registry_number}`
        : undefined,
  };
}

async function fetchUserByEntraOid(entraOid: string) {
  const { data, error } = await supabase
    .from("platform_users")
    .select(userSelect)
    .eq("entra_oid", entraOid)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as RawPlatformUserRow | null) ?? null;
}

async function fetchUserByEmail(email: string) {
  const { data, error } = await supabase
    .from("platform_users")
    .select(userSelect)
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as RawPlatformUserRow | null) ?? null;
}

async function fetchUserById(userId: string) {
  const { data, error } = await supabase
    .from("platform_users")
    .select(userSelect)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as RawPlatformUserRow | null) ?? null;
}

async function ensureUserProfile(userId: string) {
  const { data, error } = await supabase
    .from("platform_user_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    const { error: insertError } = await supabase.from("platform_user_profiles").insert({
      user_id: userId,
      can_sign_reports: false,
      signature_status: "missing",
    });

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}

async function resolveSupabasePasswordSession(accessToken: string) {
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user?.id || !data.user.email) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email.toLowerCase(),
    name: getPasswordDisplayName({
      name:
        sanitizeOptionalText(data.user.user_metadata?.full_name) ||
        sanitizeOptionalText(data.user.user_metadata?.name),
      email: data.user.email.toLowerCase(),
    }),
  };
}

async function upsertPasswordPlatformUser(input: {
  authUserId: string;
  email: string;
  name: string;
}) {
  const now = new Date().toISOString();
  const existing = await fetchUserByEmail(input.email);

  if (existing) {
    const existingPhone = normalizePhoneForDatabase(existing.phone, { strict: false });
    const existingWhatsapp =
      normalizePhoneForDatabase(existing.phone_whatsapp, { strict: false }) || existingPhone;
    const nextEntraOid = existing.entra_oid.startsWith("password:")
      ? buildPasswordEntraOid(input.authUserId)
      : existing.entra_oid;

    const { error } = await supabase
      .from("platform_users")
      .update({
        entra_oid: nextEntraOid,
        email: input.email,
        name: input.name || existing.name,
        tenant_id: existing.tenant_id || "password",
        phone: existingPhone || existing.phone || null,
        phone_whatsapp: existingWhatsapp,
        last_login_at: now,
        updated_at: now,
      })
      .eq("id", existing.id);

    if (error) {
      throw new Error(error.message);
    }

    await ensureUserProfile(existing.id);

    const nextUser = await fetchUserById(existing.id);

    if (!nextUser) {
      throw new Error("Nao foi possivel carregar o usuario de acesso por senha.");
    }

    return mapPlatformUser(nextUser);
  }

  const { data: created, error: insertError } = await supabase
    .from("platform_users")
    .insert({
      entra_oid: buildPasswordEntraOid(input.authUserId),
      email: input.email,
      name: input.name,
      tenant_id: "password",
      app_role: "technician",
      onboarding_status: "pending_profile",
      is_active: true,
      last_login_at: now,
    })
    .select(userSelect)
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  await ensureUserProfile(created.id);
  const nextUser = await fetchUserById(created.id);

  if (!nextUser) {
    throw new Error("Nao foi possivel carregar o usuario recem-criado para acesso por senha.");
  }

  return mapPlatformUser(nextUser);
}

async function getRequester(req: import("express").Request) {
  const accessToken = getBearerToken(req.headers.authorization);

  if (!accessToken) {
    throw new Error("Sessao autenticada obrigatoria.");
  }

  const passwordSession = await resolveSupabasePasswordSession(accessToken);

  if (passwordSession) {
    const userRow = await fetchUserByEmail(passwordSession.email);

    if (!userRow) {
      throw new Error("Usuario ainda nao sincronizado com a plataforma.");
    }

    const user = mapPlatformUser(userRow);

    if (!user.active) {
      throw new Error("Seu acesso na plataforma esta inativo.");
    }

    return {
      provider: "password",
      accessToken,
      user,
    } satisfies Requester;
  }

  const profile = await fetchMicrosoftGraphUserProfile(accessToken);
  const userRow = await fetchUserByEntraOid(profile.oid);

  if (!userRow) {
    throw new Error("Usuario ainda nao sincronizado com a plataforma.");
  }

  const user = mapPlatformUser(userRow);

  if (!user.active) {
    throw new Error("Seu acesso na plataforma esta inativo.");
  }

  return {
    provider: "microsoft365",
    profile,
    accessToken,
    user,
  } satisfies Requester;
}

function assertRole(requester: PlatformUser, minRole: UserRole) {
  if (ROLE_HIERARCHY[requester.role] < ROLE_HIERARCHY[minRole]) {
    throw new Error("Voce nao tem permissao para executar esta acao.");
  }
}

function canManageRole(requesterRole: UserRole, targetRole: UserRole) {
  if (requesterRole === "ceo") {
    return true;
  }

  if (requesterRole === "manager") {
    return targetRole === "supervisor" || targetRole === "technician";
  }

  return false;
}

function getOnboardingStatusFromBody(value: unknown): UserOnboardingStatus | null {
  if (value === "pending_profile" || value === "active" || value === "blocked") {
    return value;
  }

  return null;
}

function getUserRoleFromBody(value: unknown): UserRole | null {
  if (value === "ceo" || value === "manager" || value === "supervisor" || value === "technician") {
    return value;
  }

  return null;
}

function getSignatureStatusFromBody(value: unknown): SignatureStatus | null {
  if (value === "missing" || value === "pending_review" || value === "approved" || value === "rejected") {
    return value;
  }

  return null;
}

function sanitizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizePhoneForDatabase(value: unknown, options: { strict?: boolean } = {}) {
  const raw = sanitizeOptionalText(value);

  if (!raw) {
    return null;
  }

  const strict = options.strict ?? true;

  if (/^\+[1-9][0-9]{7,14}$/.test(raw)) {
    return raw;
  }

  const digits = raw.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  const internationalDigits =
    digits.startsWith("55") || (digits.length !== 10 && digits.length !== 11)
      ? digits
      : `55${digits}`;
  const normalized = `+${internationalDigits}`;

  if (/^\+[1-9][0-9]{7,14}$/.test(normalized)) {
    return normalized;
  }

  if (strict) {
    throw new Error("Informe o telefone no formato WhatsApp com DDD, ex: +5534991549095.");
  }

  return null;
}

function sanitizeEmail(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized ? normalized : null;
}

function buildPasswordEntraOid(authUserId: string) {
  return `password:${authUserId}`;
}

function getPasswordDisplayName(input: { name?: string | null; email: string }) {
  const normalized = sanitizeOptionalText(input.name);

  if (normalized) {
    return normalized;
  }

  return input.email.split("@")[0];
}

function isAllowedPasswordAuthEmail(email: string) {
  if (config.passwordAuth.allowedDomains.length === 0) {
    return true;
  }

  return config.passwordAuth.allowedDomains.some((domain) => email.endsWith(`@${domain}`));
}

function sanitizeDataUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (!normalized.startsWith("data:image/")) {
    throw new Error("A assinatura precisa ser enviada como imagem.");
  }

  return normalized;
}

async function syncPlatformUser(input: {
  accessToken: string;
  avatarUrl?: string | null;
}) {
  const profile = await fetchMicrosoftGraphUserProfile(input.accessToken);
  const now = new Date().toISOString();
  const existingByOid = await fetchUserByEntraOid(profile.oid);
  const existingByEmail = existingByOid ? null : await fetchUserByEmail(profile.email);
  const existing = existingByOid || existingByEmail;
  const profilePhone = normalizePhoneForDatabase(profile.phone, { strict: false });

  if (existing) {
    const existingPhone = normalizePhoneForDatabase(existing.phone, { strict: false });
    const existingWhatsapp =
      normalizePhoneForDatabase(existing.phone_whatsapp, { strict: false }) || existingPhone;
    const nextPhone = profilePhone || existingPhone || existing.phone || null;

    const { error } = await supabase
      .from("platform_users")
      .update({
        entra_oid: profile.oid,
        email: profile.email,
        name: profile.name,
        tenant_id: profile.tenantId || existing.tenant_id || null,
        phone: nextPhone,
        phone_whatsapp: profilePhone || existingWhatsapp,
        avatar_url: input.avatarUrl ?? existing.avatar_url ?? null,
        last_login_at: now,
        updated_at: now,
      })
      .eq("id", existing.id);

    if (error) {
      throw new Error(error.message);
    }

    await ensureUserProfile(existing.id);

    const nextUser = await fetchUserById(existing.id);

    if (!nextUser) {
      throw new Error("Nao foi possivel carregar o usuario da plataforma.");
    }

    return mapPlatformUser(nextUser);
  }

  const { data: created, error: insertError } = await supabase
    .from("platform_users")
    .insert({
      entra_oid: profile.oid,
      email: profile.email,
      name: profile.name,
      tenant_id: profile.tenantId || null,
      phone: profilePhone,
      phone_whatsapp: profilePhone,
      avatar_url: input.avatarUrl || null,
      app_role: "technician",
      onboarding_status: "pending_profile",
      is_active: true,
      last_login_at: now,
    })
    .select(userSelect)
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  await ensureUserProfile(created.id);
  const nextUser = await fetchUserById(created.id);

  if (!nextUser) {
    throw new Error("Nao foi possivel carregar o usuario recem-criado.");
  }

  return mapPlatformUser(nextUser);
}

async function syncPasswordPlatformUser(input: { accessToken: string }) {
  if (!config.passwordAuth.enabled) {
    throw new Error("O acesso por e-mail e senha esta desativado neste ambiente.");
  }

  const authSession = await resolveSupabasePasswordSession(input.accessToken);

  if (!authSession) {
    throw new Error("Sessao por e-mail e senha invalida ou expirada.");
  }

  return upsertPasswordPlatformUser({
    authUserId: authSession.id,
    email: authSession.email,
    name: authSession.name,
  });
}

async function registerPasswordPlatformUser(input: {
  name?: string | null;
  email: string;
  password: string;
}) {
  if (!config.passwordAuth.enabled) {
    throw new Error("O acesso por e-mail e senha esta desativado neste ambiente.");
  }

  if (!isAllowedPasswordAuthEmail(input.email)) {
    throw new Error("Use um e-mail corporativo autorizado para criar o acesso temporario.");
  }

  if (input.password.length < 8) {
    throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  }

  const displayName = getPasswordDisplayName({
    name: input.name,
    email: input.email,
  });

  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: displayName,
      source: "elementus-password-access",
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user?.id) {
    throw new Error("Nao foi possivel criar o usuario de acesso por senha.");
  }

  return upsertPasswordPlatformUser({
    authUserId: data.user.id,
    email: input.email,
    name: displayName,
  });
}

router.post("/session/password/register", async (req, res) => {
  const email = sanitizeEmail(req.body.email);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const name = sanitizeOptionalText(req.body.name);

  if (!name || !email || !password) {
    res.status(400).json({ error: "Informe nome, e-mail e senha para criar o acesso temporario." });
    return;
  }

  try {
    const user = await registerPasswordPlatformUser({
      name,
      email,
      password,
    });

    res.status(201).json(user);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel criar o acesso por e-mail e senha.";

    res.status(message.toLowerCase().includes("already") ? 409 : 400).json({
      error: message,
    });
  }
});

router.post("/session/password/sync", async (req, res) => {
  const accessToken = typeof req.body.access_token === "string" ? req.body.access_token : "";

  if (!accessToken) {
    res.status(400).json({ error: "Token da sessao por senha obrigatorio." });
    return;
  }

  try {
    const user = await syncPasswordPlatformUser({
      accessToken,
    });

    res.json(user);
  } catch (error) {
    res.status(401).json({
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel sincronizar a sessao por e-mail e senha.",
    });
  }
});

router.post("/session/sync", async (req, res) => {
  const accessToken = req.body.microsoft_access_token as string | undefined;
  const avatarUrl = sanitizeOptionalText(req.body.avatar_url);

  if (!accessToken) {
    res.status(400).json({ error: "Token Microsoft 365 obrigatorio para sincronizar a sessao." });
    return;
  }

  try {
    const user = await syncPlatformUser({
      accessToken,
      avatarUrl,
    });

    res.json(user);
  } catch (error) {
    res.status(401).json({
      error:
        error instanceof Error ? error.message : "Nao foi possivel sincronizar a sessao do usuario.",
    });
  }
});

router.get("/me", async (req, res) => {
  try {
    const requester = await getRequester(req);
    res.json(requester.user);
  } catch (error) {
    res.status(401).json({
      error: error instanceof Error ? error.message : "Nao foi possivel carregar o usuario atual.",
    });
  }
});

router.patch("/me/onboarding", async (req, res) => {
  try {
    const requester = await getRequester(req);
    const now = new Date().toISOString();
    const name = sanitizeOptionalText(req.body.name) || requester.user.name;
    const phone =
      normalizePhoneForDatabase(req.body.phone) ??
      normalizePhoneForDatabase(requester.user.phone, { strict: false });
    const professionalRole = sanitizeOptionalText(req.body.professional_role);
    const registryType = sanitizeOptionalText(req.body.registry_type);
    const registryNumber = sanitizeOptionalText(req.body.registry_number);
    const canSignReports = Boolean(req.body.can_sign_reports);
    const signatureName = sanitizeOptionalText(req.body.signature_name);
    const signatureDataUrl = sanitizeDataUrl(req.body.signature_data_url);
    const signatureMimeType = sanitizeOptionalText(req.body.signature_mime_type);
    const signatureStatus =
      canSignReports && signatureDataUrl ? "pending_review" : ("missing" as SignatureStatus);

    const { error: userError } = await supabase
      .from("platform_users")
      .update({
        name,
        phone,
        phone_whatsapp: phone,
        onboarding_status: "active",
        updated_at: now,
        last_login_at: now,
      })
      .eq("id", requester.user.id);

    if (userError) {
      res.status(400).json({ error: userError.message });
      return;
    }

    const { error: profileError } = await supabase
      .from("platform_user_profiles")
      .upsert({
        user_id: requester.user.id,
        professional_role: professionalRole,
        registry_type: registryType,
        registry_number: registryNumber,
        can_sign_reports: canSignReports,
        signature_name: canSignReports ? signatureName : null,
        signature_data_url: canSignReports ? signatureDataUrl : null,
        signature_mime_type: canSignReports ? signatureMimeType : null,
        signature_status: signatureStatus,
        signature_updated_at: canSignReports && signatureDataUrl ? now : null,
        updated_at: now,
      });

    if (profileError) {
      res.status(400).json({ error: profileError.message });
      return;
    }

    const nextUser = await fetchUserById(requester.user.id);

    if (!nextUser) {
      res.status(404).json({ error: "Usuario nao encontrado apos concluir o onboarding." });
      return;
    }

    res.json(mapPlatformUser(nextUser));
  } catch (error) {
    res.status(401).json({
      error:
        error instanceof Error ? error.message : "Nao foi possivel concluir o primeiro acesso.",
    });
  }
});

router.get("/signers", async (req, res) => {
  try {
    await getRequester(req);

    const { data, error } = await supabase
      .from("platform_users")
      .select(userSelect)
      .eq("is_active", true)
      .eq("onboarding_status", "active")
      .order("name", { ascending: true });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    const signers = (data as RawPlatformUserRow[])
      .map(mapPlatformUser)
      .filter(
        (user) =>
          user.professional_profile?.can_sign_reports &&
          user.professional_profile.signature_status === "approved"
      );

    res.json(signers);
  } catch (error) {
    res.status(401).json({
      error: error instanceof Error ? error.message : "Nao foi possivel carregar os signatarios.",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const requester = await getRequester(req);
    assertRole(requester.user, "manager");

    const { data, error } = await supabase
      .from("platform_users")
      .select(userSelect)
      .order("name", { ascending: true });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json((data as RawPlatformUserRow[]).map(mapPlatformUser));
  } catch (error) {
    res.status(403).json({
      error: error instanceof Error ? error.message : "Nao foi possivel listar os usuarios.",
    });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const requester = await getRequester(req);
    assertRole(requester.user, "manager");

    const target = await fetchUserById(req.params.id);

    if (!target) {
      res.status(404).json({ error: "Usuario nao encontrado." });
      return;
    }

    const nextRole = getUserRoleFromBody(req.body.role);
    const nextOnboardingStatus = getOnboardingStatusFromBody(req.body.onboarding_status);
    const nextSignatureStatus = getSignatureStatusFromBody(req.body.signature_status);

    if (nextRole && !canManageRole(requester.user.role, nextRole)) {
      res.status(403).json({ error: "Voce nao pode atribuir este nivel de acesso." });
      return;
    }

    if (requester.user.role !== "ceo" && !canManageRole(requester.user.role, target.app_role)) {
      res.status(403).json({ error: "Voce nao pode editar este usuario." });
      return;
    }

    const now = new Date().toISOString();
    const targetProfile = getRawProfile(target.platform_user_profiles);
    const phone =
      normalizePhoneForDatabase(req.body.phone) ??
      normalizePhoneForDatabase(target.phone, { strict: false });
    const { error: userError } = await supabase
      .from("platform_users")
      .update({
        app_role: nextRole || target.app_role,
        is_active: typeof req.body.active === "boolean" ? req.body.active : target.is_active,
        onboarding_status: nextOnboardingStatus || target.onboarding_status,
        phone,
        phone_whatsapp: phone,
        approved_at: nextOnboardingStatus === "active" ? now : null,
        approved_by: nextOnboardingStatus === "active" ? requester.user.id : null,
        updated_at: now,
      })
      .eq("id", target.id);

    if (userError) {
      res.status(400).json({ error: userError.message });
      return;
    }

    const signatureDataUrl = sanitizeDataUrl(req.body.signature_data_url);

    const { error: profileError } = await supabase
      .from("platform_user_profiles")
      .upsert({
        user_id: target.id,
        professional_role:
          sanitizeOptionalText(req.body.professional_role) ?? targetProfile?.professional_role ?? null,
        registry_type:
          sanitizeOptionalText(req.body.registry_type) ?? targetProfile?.registry_type ?? null,
        registry_number:
          sanitizeOptionalText(req.body.registry_number) ?? targetProfile?.registry_number ?? null,
        can_sign_reports:
          typeof req.body.can_sign_reports === "boolean"
            ? req.body.can_sign_reports
            : targetProfile?.can_sign_reports || false,
        signature_name:
          sanitizeOptionalText(req.body.signature_name) ?? targetProfile?.signature_name ?? null,
        signature_data_url: signatureDataUrl ?? targetProfile?.signature_data_url ?? null,
        signature_mime_type:
          sanitizeOptionalText(req.body.signature_mime_type) ?? targetProfile?.signature_mime_type ?? null,
        signature_status:
          nextSignatureStatus ||
          (signatureDataUrl ? "pending_review" : targetProfile?.signature_status) ||
          "missing",
        signature_updated_at:
          signatureDataUrl || nextSignatureStatus ? now : targetProfile?.signature_updated_at ?? null,
        updated_at: now,
      });

    if (profileError) {
      res.status(400).json({ error: profileError.message });
      return;
    }

    const nextUser = await fetchUserById(target.id);

    if (!nextUser) {
      res.status(404).json({ error: "Nao foi possivel recarregar o usuario." });
      return;
    }

    res.json(mapPlatformUser(nextUser));
  } catch (error) {
    res.status(403).json({
      error: error instanceof Error ? error.message : "Nao foi possivel atualizar o usuario.",
    });
  }
});

export default router;
