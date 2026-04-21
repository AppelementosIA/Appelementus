import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PlatformUser, UserRole } from "@elementus/shared";
import {
  clearMicrosoftSession,
  completeMicrosoftLogin,
  ensureMicrosoftSession,
  getMicrosoftLogoutUrl,
  isMicrosoftConfigured,
  startMicrosoftLogin,
  type MicrosoftSession,
} from "@/lib/microsoftAuth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  fetchCurrentPlatformUser,
  registerPasswordPlatformAccess,
  syncPasswordPlatformSession,
  syncPlatformSession,
} from "@/lib/userApi";

const PRESENTATION_STORAGE_KEY = "elementus.presentation.user";
const PRESENTATION_QUERY_KEY = "presentation";

type AuthProvider = "microsoft365" | "presentation" | "password";

export interface AuthUser extends PlatformUser {
  provider: AuthProvider;
}

interface AuthContextType {
  user: AuthUser | null;
  session: MicrosoftSession | null;
  isLoading: boolean;
  authError: string | null;
  isMicrosoftReady: boolean;
  isPresentationEnabled: boolean;
  isPresentationMode: boolean;
  isPasswordAccessEnabled: boolean;
  isPasswordMode: boolean;
  hasMicrosoftSession: boolean;
  hasAccess: (minRole: UserRole) => boolean;
  loginWithMicrosoft: () => Promise<void>;
  loginWithPassword: (input: { email: string; password: string }) => Promise<void>;
  registerWithPassword: (input: { name: string; email: string; password: string }) => Promise<void>;
  loginForPresentation: () => void;
  logout: () => void;
  getPlatformAccessToken: () => Promise<string>;
  getMicrosoftAccessToken: () => Promise<string>;
  refreshPlatformUser: () => Promise<AuthUser | null>;
  setPlatformUser: (user: PlatformUser) => void;
}

const ROLE_LEVEL: Record<UserRole, number> = {
  ceo: 4,
  manager: 3,
  supervisor: 2,
  technician: 1,
};

const AuthContext = createContext<AuthContextType | null>(null);

function getPresentationRole(): UserRole {
  const role = import.meta.env.VITE_PRESENTATION_ROLE;

  if (role === "ceo" || role === "manager" || role === "supervisor" || role === "technician") {
    return role;
  }

  return "supervisor";
}

function hasPresentationQueryFlag() {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get(PRESENTATION_QUERY_KEY) === "1";
}

function isPresentationAccessEnabled() {
  return import.meta.env.VITE_ENABLE_PRESENTATION_ACCESS === "true" || hasPresentationQueryFlag();
}

function isPasswordAccessEnabled() {
  return import.meta.env.VITE_ENABLE_PASSWORD_AUTH !== "false" && isSupabaseConfigured();
}

function mapPlatformUserToAuthUser(user: PlatformUser, provider: AuthProvider): AuthUser {
  return {
    provider,
    ...user,
  };
}

function buildPresentationUser(): AuthUser {
  const now = new Date().toISOString();

  return {
    id: "presentation-user",
    entra_oid: "presentation-user",
    email: import.meta.env.VITE_PRESENTATION_EMAIL || "apresentacao@elementus.local",
    name: import.meta.env.VITE_PRESENTATION_NAME || "Acesso de Apresentacao",
    role: getPresentationRole(),
    tenant_id: "presentation",
    active: true,
    onboarding_status: "active",
    created_at: now,
    updated_at: now,
    provider: "presentation",
    professional_profile: null,
  };
}

function loadPresentationUser() {
  const raw = localStorage.getItem(PRESENTATION_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    localStorage.removeItem(PRESENTATION_STORAGE_KEY);
    return null;
  }
}

function savePresentationUser(user: AuthUser) {
  localStorage.setItem(PRESENTATION_STORAGE_KEY, JSON.stringify(user));
}

async function ensurePasswordSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  if (data.session) {
    return data.session;
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();

  if (refreshError) {
    throw new Error(refreshError.message);
  }

  return refreshed.session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MicrosoftSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const microsoftReady = isMicrosoftConfigured();
  const presentationEnabled = isPresentationAccessEnabled();
  const passwordEnabled = isPasswordAccessEnabled();

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        setAuthError(null);

        const redirectSession = await completeMicrosoftLogin();
        const nextSession = redirectSession ?? (await ensureMicrosoftSession());

        if (!active) {
          return;
        }

        setSession(nextSession);

        if (nextSession) {
          const syncedUser = await syncPlatformSession({
            accessToken: nextSession.accessToken,
          });

          if (!active) {
            return;
          }

          setUser(mapPlatformUserToAuthUser(syncedUser, "microsoft365"));
          return;
        }

        if (passwordEnabled) {
          const passwordSession = await ensurePasswordSession();

          if (passwordSession?.access_token) {
            const syncedUser = await syncPasswordPlatformSession(passwordSession.access_token);

            if (!active) {
              return;
            }

            setUser(mapPlatformUserToAuthUser(syncedUser, "password"));
            return;
          }
        }

        if (presentationEnabled) {
          setUser(loadPresentationUser());
        } else {
          setUser(null);
        }
      } catch (error) {
        clearMicrosoftSession();
        void supabase.auth.signOut();

        if (!active) {
          return;
        }

        setSession(null);
        setUser(null);
        setAuthError(error instanceof Error ? error.message : "Falha ao autenticar na plataforma.");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [passwordEnabled, presentationEnabled]);

  const hasAccess = (minRole: UserRole): boolean => {
    if (!user) {
      return false;
    }

    return ROLE_LEVEL[user.role] >= ROLE_LEVEL[minRole];
  };

  const loginWithMicrosoft = async () => {
    setAuthError(null);
    await startMicrosoftLogin();
  };

  const loginWithPassword = async (input: { email: string; password: string }) => {
    setAuthError(null);
    clearMicrosoftSession();
    localStorage.removeItem(PRESENTATION_STORAGE_KEY);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    });

    if (error || !data.session?.access_token) {
      throw new Error(error?.message || "Nao foi possivel entrar com e-mail e senha.");
    }

    const syncedUser = await syncPasswordPlatformSession(data.session.access_token);
    setSession(null);
    setUser(mapPlatformUserToAuthUser(syncedUser, "password"));
  };

  const registerWithPassword = async (input: { name: string; email: string; password: string }) => {
    setAuthError(null);

    await registerPasswordPlatformAccess({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
    });

    await loginWithPassword({
      email: input.email,
      password: input.password,
    });
  };

  const loginForPresentation = () => {
    const previewUser = buildPresentationUser();
    savePresentationUser(previewUser);
    setSession(null);
    setUser(previewUser);
    setAuthError(null);
  };

  const logout = () => {
    const currentProvider = user?.provider;

    clearMicrosoftSession();
    localStorage.removeItem(PRESENTATION_STORAGE_KEY);
    void supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setAuthError(null);

    if (microsoftReady && currentProvider === "microsoft365") {
      window.location.assign(getMicrosoftLogoutUrl());
    }
  };

  const getPlatformAccessToken = async () => {
    if (user?.provider === "presentation") {
      throw new Error(
        "O modo apresentacao nao sincroniza dados reais. Use Microsoft ou e-mail e senha para continuar."
      );
    }

    if (user?.provider === "password") {
      const passwordSession = await ensurePasswordSession();

      if (!passwordSession?.access_token) {
        setUser(null);
        throw new Error("Sua sessao por e-mail e senha expirou. Entre novamente para continuar.");
      }

      return passwordSession.access_token;
    }

    return getMicrosoftAccessToken();
  };

  const getMicrosoftAccessToken = async () => {
    if (user?.provider === "presentation") {
      throw new Error(
        "O modo apresentacao nao emite relatorios nem sincroniza dados reais. Use apenas para demonstracao visual."
      );
    }

    if (user?.provider === "password") {
      throw new Error(
        "Esta acao exige conexao Microsoft 365. Entre com Microsoft para emitir e salvar no Microsoft 365."
      );
    }

    const nextSession = await ensureMicrosoftSession();

    if (!nextSession) {
      setSession(null);
      setUser(null);
      throw new Error("Sua sessao Microsoft 365 expirou. Entre novamente para emitir o relatorio.");
    }

    setSession(nextSession);
    return nextSession.accessToken;
  };

  const refreshPlatformUser = async () => {
    if (user?.provider === "presentation") {
      return user;
    }

    const accessToken = await getPlatformAccessToken();
    const nextUser = await fetchCurrentPlatformUser(accessToken);
    const mappedUser = mapPlatformUserToAuthUser(nextUser, user?.provider || "microsoft365");
    setUser(mappedUser);
    return mappedUser;
  };

  const setPlatformUser = (nextUser: PlatformUser) => {
    setUser((currentUser) => ({
      ...(currentUser?.provider === "presentation"
        ? { provider: "presentation" as const }
        : currentUser?.provider === "password"
        ? { provider: "password" as const }
        : { provider: "microsoft365" as const }),
      ...nextUser,
    }));
  };

  const value = useMemo(
    () => ({
      user,
      session,
      isLoading,
      authError,
      isMicrosoftReady: microsoftReady,
      isPresentationEnabled: presentationEnabled,
      isPresentationMode: user?.provider === "presentation",
      isPasswordAccessEnabled: passwordEnabled,
      isPasswordMode: user?.provider === "password",
      hasMicrosoftSession: user?.provider === "microsoft365",
      hasAccess,
      loginWithMicrosoft,
      loginWithPassword,
      registerWithPassword,
      loginForPresentation,
      logout,
      getPlatformAccessToken,
      getMicrosoftAccessToken,
      refreshPlatformUser,
      setPlatformUser,
    }),
    [authError, isLoading, microsoftReady, passwordEnabled, presentationEnabled, session, user]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return ctx;
}
