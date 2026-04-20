import type { UserRole } from "@elementus/shared";

const SESSION_STORAGE_KEY = "elementus.microsoft.session";
const PKCE_VERIFIER_STORAGE_KEY = "elementus.microsoft.pkce.verifier";
const STATE_STORAGE_KEY = "elementus.microsoft.auth.state";
const NONCE_STORAGE_KEY = "elementus.microsoft.auth.nonce";

const DEFAULT_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Files.ReadWrite",
];

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token: string;
  scope?: string;
  token_type: string;
  error?: string;
  error_description?: string;
};

type MicrosoftIdTokenClaims = {
  aud?: string;
  email?: string;
  exp?: number;
  name?: string;
  nonce?: string;
  oid?: string;
  preferred_username?: string;
  sub: string;
  tid?: string;
  upn?: string;
};

export interface MicrosoftAccountProfile {
  id: string;
  email: string;
  name: string;
  tenantId?: string;
}

export interface MicrosoftSession {
  accessToken: string;
  refreshToken?: string;
  idToken: string;
  expiresAt: number;
  scopes: string[];
  role: UserRole;
  account: MicrosoftAccountProfile;
}

interface MicrosoftAuthConfig {
  clientId: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
  allowedDomains: string[];
  defaultRole: UserRole;
  roleEmails: Record<Exclude<UserRole, "technician">, string[]>;
}

const GUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOMAIN_TENANT_REGEX = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;
const MICROSOFT_SHARED_TENANTS = new Set(["common", "organizations", "consumers"]);

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseCsvEnv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getRoleFromEnv(value: string | undefined): UserRole {
  if (value === "ceo" || value === "manager" || value === "supervisor" || value === "technician") {
    return value;
  }

  return "technician";
}

function looksLikePlaceholder(value: string) {
  return /(application\s*\(client\)\s*id|directory\s*\(tenant\)\s*id|client id|tenant id)/i.test(
    value
  );
}

function isValidClientId(value: string) {
  return GUID_REGEX.test(value.trim());
}

function isValidTenantId(value: string) {
  const normalized = value.trim().toLowerCase();

  return (
    GUID_REGEX.test(normalized) ||
    DOMAIN_TENANT_REGEX.test(normalized) ||
    MICROSOFT_SHARED_TENANTS.has(normalized)
  );
}

export function getMicrosoftAuthConfig(): MicrosoftAuthConfig {
  const allowedDomains = parseCsvEnv(import.meta.env.VITE_MICROSOFT_ALLOWED_DOMAINS);
  const singleAllowedDomain = import.meta.env.VITE_MICROSOFT_ALLOWED_DOMAIN;

  if (singleAllowedDomain?.trim()) {
    allowedDomains.push(singleAllowedDomain.trim());
  }

  return {
    clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID ?? "",
    tenantId: import.meta.env.VITE_MICROSOFT_TENANT_ID ?? "common",
    redirectUri:
      import.meta.env.VITE_MICROSOFT_REDIRECT_URI ?? `${window.location.origin}/login`,
    scopes: (import.meta.env.VITE_MICROSOFT_SCOPES ?? DEFAULT_SCOPES.join(" "))
      .split(/\s+/)
      .map((scope: string) => scope.trim())
      .filter(Boolean),
    allowedDomains: Array.from(new Set(allowedDomains.map((domain) => domain.toLowerCase()))),
    defaultRole: getRoleFromEnv(import.meta.env.VITE_MICROSOFT_DEFAULT_ROLE),
    roleEmails: {
      ceo: parseCsvEnv(import.meta.env.VITE_MICROSOFT_CEO_EMAILS).map(normalizeEmail),
      manager: parseCsvEnv(import.meta.env.VITE_MICROSOFT_MANAGER_EMAILS).map(normalizeEmail),
      supervisor: parseCsvEnv(import.meta.env.VITE_MICROSOFT_SUPERVISOR_EMAILS).map(
        normalizeEmail
      ),
    },
  };
}

export function getMicrosoftConfigurationError() {
  const config = getMicrosoftAuthConfig();
  const clientId = config.clientId.trim();
  const tenantId = config.tenantId.trim();

  if (!clientId) {
    return "Defina VITE_MICROSOFT_CLIENT_ID com o Application (client) ID do app no Microsoft Entra.";
  }

  if (looksLikePlaceholder(clientId) || !isValidClientId(clientId)) {
    return "VITE_MICROSOFT_CLIENT_ID precisa receber o GUID real do Application (client) ID, nao o texto do rotulo.";
  }

  if (tenantId && (looksLikePlaceholder(tenantId) || !isValidTenantId(tenantId))) {
    return "VITE_MICROSOFT_TENANT_ID precisa receber o GUID real do Directory (tenant) ID, um dominio valido do tenant, ou common/organizations/consumers.";
  }

  return null;
}

export function isMicrosoftConfigured() {
  return !getMicrosoftConfigurationError();
}

function getAuthorityBase(config = getMicrosoftAuthConfig()) {
  return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0`;
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url<T>(value: string): T {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(normalized + padding);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

function parseJwt<T>(token: string): T {
  const parts = token.split(".");

  if (parts.length < 2) {
    throw new Error("Token Microsoft invalido.");
  }

  return decodeBase64Url<T>(parts[1]);
}

function randomString(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return base64UrlEncode(bytes);
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}

async function createPkcePair() {
  const verifier = randomString(64);
  const challenge = base64UrlEncode(await sha256(verifier));

  return { verifier, challenge };
}

function cleanupMicrosoftCallbackUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("session_state");
  url.searchParams.delete("error");
  url.searchParams.delete("error_description");
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

function saveSession(session: MicrosoftSession) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearMicrosoftSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
  sessionStorage.removeItem(STATE_STORAGE_KEY);
  sessionStorage.removeItem(NONCE_STORAGE_KEY);
}

function resolveUserRole(email: string, config: MicrosoftAuthConfig): UserRole {
  const normalizedEmail = normalizeEmail(email);

  if (config.roleEmails.ceo.includes(normalizedEmail)) {
    return "ceo";
  }
  if (config.roleEmails.manager.includes(normalizedEmail)) {
    return "manager";
  }
  if (config.roleEmails.supervisor.includes(normalizedEmail)) {
    return "supervisor";
  }

  return config.defaultRole;
}

function buildSessionFromTokens(tokenResponse: TokenResponse, expectedNonce?: string) {
  const config = getMicrosoftAuthConfig();
  const claims = parseJwt<MicrosoftIdTokenClaims>(tokenResponse.id_token);
  const email = claims.preferred_username || claims.email || claims.upn;

  if (!email) {
    throw new Error("Nao foi possivel identificar o e-mail da conta Microsoft 365.");
  }

  if (expectedNonce && claims.nonce !== expectedNonce) {
    throw new Error("A autenticacao Microsoft retornou um nonce invalido.");
  }

  if (
    config.allowedDomains.length > 0 &&
    !config.allowedDomains.some((domain) => normalizeEmail(email).endsWith(`@${domain}`))
  ) {
    throw new Error("Esta conta Microsoft 365 nao esta autorizada para acessar a plataforma.");
  }

  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    idToken: tokenResponse.id_token,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
    scopes: (tokenResponse.scope ?? config.scopes.join(" ")).split(/\s+/).filter(Boolean),
    role: resolveUserRole(email, config),
    account: {
      id: claims.oid || claims.sub,
      email,
      name: claims.name || email,
      tenantId: claims.tid,
    },
  } satisfies MicrosoftSession;
}

async function redeemToken(params: URLSearchParams) {
  const config = getMicrosoftAuthConfig();
  const response = await fetch(`${getAuthorityBase(config)}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const payload = (await response.json()) as TokenResponse;

  if (!response.ok || payload.error) {
    throw new Error(
      payload.error_description || payload.error || "Falha ao obter token da Microsoft."
    );
  }

  return payload;
}

export async function startMicrosoftLogin() {
  const config = getMicrosoftAuthConfig();
  const configurationError = getMicrosoftConfigurationError();

  if (configurationError) {
    throw new Error(configurationError);
  }

  const { verifier, challenge } = await createPkcePair();
  const state = randomString(32);
  const nonce = randomString(32);

  sessionStorage.setItem(PKCE_VERIFIER_STORAGE_KEY, verifier);
  sessionStorage.setItem(STATE_STORAGE_KEY, state);
  sessionStorage.setItem(NONCE_STORAGE_KEY, nonce);

  const url = new URL(`${getAuthorityBase(config)}/authorize`);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("prompt", "select_account");

  window.location.assign(url.toString());
}

export async function completeMicrosoftLogin() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");
  const errorDescription = params.get("error_description");

  if (error) {
    cleanupMicrosoftCallbackUrl();
    throw new Error(errorDescription || error);
  }

  if (!code) {
    return null;
  }

  const config = getMicrosoftAuthConfig();
  const expectedState = sessionStorage.getItem(STATE_STORAGE_KEY);
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_STORAGE_KEY);
  const nonce = sessionStorage.getItem(NONCE_STORAGE_KEY) || undefined;

  if (!state || state !== expectedState || !verifier) {
    cleanupMicrosoftCallbackUrl();
    clearMicrosoftSession();
    throw new Error("Nao foi possivel validar o retorno do login Microsoft 365.");
  }

  const tokenResponse = await redeemToken(
    new URLSearchParams({
      client_id: config.clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      code_verifier: verifier,
    })
  );

  const session = buildSessionFromTokens(tokenResponse, nonce);
  saveSession(session);
  cleanupMicrosoftCallbackUrl();
  sessionStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
  sessionStorage.removeItem(STATE_STORAGE_KEY);
  sessionStorage.removeItem(NONCE_STORAGE_KEY);

  return session;
}

export function loadStoredMicrosoftSession() {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as MicrosoftSession;
  } catch {
    clearMicrosoftSession();
    return null;
  }
}

export async function refreshMicrosoftSession(session: MicrosoftSession) {
  if (!session.refreshToken) {
    throw new Error("A sessao Microsoft expirou e precisa de novo login.");
  }

  const config = getMicrosoftAuthConfig();
  const tokenResponse = await redeemToken(
    new URLSearchParams({
      client_id: config.clientId,
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(" "),
    })
  );

  const nextSession = buildSessionFromTokens(tokenResponse);
  const mergedSession: MicrosoftSession = {
    ...nextSession,
    refreshToken: nextSession.refreshToken || session.refreshToken,
  };

  saveSession(mergedSession);
  return mergedSession;
}

export async function ensureMicrosoftSession() {
  const stored = loadStoredMicrosoftSession();

  if (!stored) {
    return null;
  }

  if (stored.expiresAt > Date.now() + 60_000) {
    return stored;
  }

  try {
    return await refreshMicrosoftSession(stored);
  } catch {
    clearMicrosoftSession();
    return null;
  }
}

export function getMicrosoftLogoutUrl() {
  const config = getMicrosoftAuthConfig();
  const logoutUrl = new URL(`${getAuthorityBase(config)}/logout`);
  logoutUrl.searchParams.set("post_logout_redirect_uri", config.redirectUri);
  return logoutUrl.toString();
}
