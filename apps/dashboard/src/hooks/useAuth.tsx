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
import { fetchCurrentPlatformUser, syncPlatformSession } from "@/lib/userApi";

const PRESENTATION_STORAGE_KEY = "elementus.presentation.user";
const PRESENTATION_QUERY_KEY = "presentation";

type AuthProvider = "microsoft365" | "presentation";

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
  hasAccess: (minRole: UserRole) => boolean;
  loginWithMicrosoft: () => Promise<void>;
  loginForPresentation: () => void;
  logout: () => void;
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

function mapPlatformUserToAuthUser(user: PlatformUser): AuthUser {
  return {
    provider: "microsoft365",
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MicrosoftSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const microsoftReady = isMicrosoftConfigured();
  const presentationEnabled = isPresentationAccessEnabled();

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

        if (!nextSession) {
          if (presentationEnabled) {
            setUser(loadPresentationUser());
          } else {
            setUser(null);
          }
          return;
        }

        const syncedUser = await syncPlatformSession({
          accessToken: nextSession.accessToken,
        });

        if (!active) {
          return;
        }

        setUser(mapPlatformUserToAuthUser(syncedUser));
      } catch (error) {
        clearMicrosoftSession();

        if (!active) {
          return;
        }

        setSession(null);
        setUser(null);
        setAuthError(error instanceof Error ? error.message : "Falha ao autenticar com Microsoft 365.");
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
  }, []);

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

  const loginForPresentation = () => {
    const previewUser = buildPresentationUser();
    savePresentationUser(previewUser);
    setSession(null);
    setUser(previewUser);
    setAuthError(null);
  };

  const logout = () => {
    clearMicrosoftSession();
    localStorage.removeItem(PRESENTATION_STORAGE_KEY);
    setSession(null);
    setUser(null);
    setAuthError(null);

    if (microsoftReady && user?.provider === "microsoft365") {
      window.location.assign(getMicrosoftLogoutUrl());
    }
  };

  const getMicrosoftAccessToken = async () => {
    if (user?.provider === "presentation") {
      throw new Error(
        "O modo apresentacao nao emite relatorios nem sincroniza dados reais. Use apenas para demonstracao visual."
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

    const accessToken = await getMicrosoftAccessToken();
    const nextUser = await fetchCurrentPlatformUser(accessToken);
    const mappedUser = mapPlatformUserToAuthUser(nextUser);
    setUser(mappedUser);
    return mappedUser;
  };

  const setPlatformUser = (nextUser: PlatformUser) => {
    setUser((currentUser) => ({
      ...(currentUser?.provider === "presentation"
        ? { provider: "presentation" as const }
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
      hasAccess,
      loginWithMicrosoft,
      loginForPresentation,
      logout,
      getMicrosoftAccessToken,
      refreshPlatformUser,
      setPlatformUser,
    }),
    [authError, isLoading, microsoftReady, presentationEnabled, session, user]
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
