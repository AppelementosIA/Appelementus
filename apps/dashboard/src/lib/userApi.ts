import type { PlatformUser, SignatureStatus, UserOnboardingStatus, UserRole } from "@elementus/shared";

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBaseUrl}/api${path}`, init);

  if (!response.ok) {
    let message = `API ${response.status} - ${response.statusText}`;

    try {
      const payload = (await response.json()) as { error?: string };
      message = payload.error || message;
    } catch {
      // ignore json parsing errors
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

function authHeaders(accessToken: string, headers?: HeadersInit) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    ...(headers || {}),
  };
}

export async function syncPlatformSession(input: {
  accessToken: string;
  avatarUrl?: string;
}) {
  return requestJson<PlatformUser>("/users/session/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      microsoft_access_token: input.accessToken,
      avatar_url: input.avatarUrl,
    }),
  });
}

export async function syncPasswordPlatformSession(accessToken: string) {
  return requestJson<PlatformUser>("/users/session/password/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      access_token: accessToken,
    }),
  });
}

export async function registerPasswordPlatformAccess(input: {
  name: string;
  email: string;
  password: string;
}) {
  return requestJson<PlatformUser>("/users/session/password/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      password: input.password,
    }),
  });
}

export async function fetchCurrentPlatformUser(accessToken: string) {
  return requestJson<PlatformUser>("/users/me", {
    headers: authHeaders(accessToken),
  });
}

export async function completePlatformOnboarding(
  accessToken: string,
  payload: {
    name: string;
    phone?: string;
    professional_role?: string;
    registry_type?: string;
    registry_number?: string;
    can_sign_reports: boolean;
    signature_name?: string;
    signature_data_url?: string;
    signature_mime_type?: string;
  }
) {
  return requestJson<PlatformUser>("/users/me/onboarding", {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export async function fetchPlatformUsers(accessToken: string) {
  return requestJson<PlatformUser[]>("/users", {
    headers: authHeaders(accessToken),
  });
}

export async function fetchApprovedPlatformSigners(accessToken: string) {
  return requestJson<PlatformUser[]>("/users/signers", {
    headers: authHeaders(accessToken),
  });
}

export async function updatePlatformUser(
  accessToken: string,
  userId: string,
  payload: {
    role?: UserRole;
    active?: boolean;
    onboarding_status?: UserOnboardingStatus;
    phone?: string;
    professional_role?: string;
    registry_type?: string;
    registry_number?: string;
    can_sign_reports?: boolean;
    signature_name?: string;
    signature_data_url?: string;
    signature_mime_type?: string;
    signature_status?: SignatureStatus;
  }
) {
  return requestJson<PlatformUser>(`/users/${userId}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}
