import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UserRole } from "@elementus/shared";
import {
  clearMicrosoftSession,
  completeMicrosoftLogin,
  ensureMicrosoftSession,
  getMicrosoftLogoutUrl,
  isMicrosoftConfigured,
  startMicrosoftLogin,
  type MicrosoftSession,
} from "@/lib/microsoftAuth";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  provider: "microsoft365";
  tenant_id?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: MicrosoftSession | null;
  isLoading: boolean;
  authError: string | null;
  isMicrosoftReady: boolean;
  hasAccess: (minRole: UserRole) => boolean;
  loginWithMicrosoft: () => Promise<void>;
  logout: () => void;
  getMicrosoftAccessToken: () => Promise<string>;
}

const ROLE_LEVEL: Record<UserRole, number> = {
  ceo: 4,
  manager: 3,
  supervisor: 2,
  technician: 1,
};

const AuthContext = createContext<AuthContextType | null>(null);

function mapSessionToUser(session: MicrosoftSession): AuthUser {
  return {
    id: session.account.id,
    email: session.account.email,
    name: session.account.name,
    role: session.role,
    provider: "microsoft365",
    tenant_id: session.account.tenantId,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MicrosoftSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const microsoftReady = isMicrosoftConfigured();

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
        setUser(nextSession ? mapSessionToUser(nextSession) : null);
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

  const logout = () => {
    clearMicrosoftSession();
    setSession(null);
    setUser(null);
    setAuthError(null);

    if (microsoftReady && user?.provider === "microsoft365") {
      window.location.assign(getMicrosoftLogoutUrl());
    }
  };

  const getMicrosoftAccessToken = async () => {
    const nextSession = await ensureMicrosoftSession();

    if (!nextSession) {
      setSession(null);
      setUser(null);
      throw new Error("Sua sessao Microsoft 365 expirou. Entre novamente para emitir o relatorio.");
    }

    setSession(nextSession);
    setUser(mapSessionToUser(nextSession));
    return nextSession.accessToken;
  };

  const value = useMemo(
    () => ({
      user,
      session,
      isLoading,
      authError,
      isMicrosoftReady: microsoftReady,
      hasAccess,
      loginWithMicrosoft,
      logout,
      getMicrosoftAccessToken,
    }),
    [authError, isLoading, microsoftReady, session, user]
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
