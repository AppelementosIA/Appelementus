import { config } from "./config.js";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

export interface MicrosoftDriveItem {
  id: string;
  name: string;
  webUrl?: string;
}

export interface MicrosoftFolderResult extends MicrosoftDriveItem {
  path: string;
}

export interface MicrosoftGraphUserProfile {
  oid: string;
  email: string;
  name: string;
  tenantId?: string;
  phone?: string;
}

function getDriveBasePath() {
  return config.microsoft365.driveId
    ? `/drives/${encodeURIComponent(config.microsoft365.driveId)}`
    : "/me/drive";
}

function buildGraphUrl(path: string) {
  return `${GRAPH_BASE_URL}${getDriveBasePath()}${path}`;
}

function buildApiUrl(path: string) {
  return `${GRAPH_BASE_URL}${path}`;
}

function sanitizeSegment(value: string) {
  return value.replace(/[<>:"/\\|?*]+/g, " ").replace(/\s+/g, " ").trim();
}

export function sanitizeFileName(value: string) {
  return sanitizeSegment(value).replace(/\.+$/, "");
}

export function normalizeMicrosoftFolderPath(folderPath: string) {
  const configuredRoot = config.microsoft365.rootFolder
    .split(/[\\/]+/)
    .map(sanitizeSegment)
    .filter(Boolean);

  const dynamicSegments = folderPath
    .split(/[\\/]+/)
    .map(sanitizeSegment)
    .filter(Boolean);

  return [...configuredRoot, ...dynamicSegments].join("/");
}

async function graphRequest<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(buildGraphUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let errorMessage = `Microsoft Graph ${response.status}`;

    try {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      errorMessage = payload.error?.message || errorMessage;
    } catch {
      // ignore json parsing
    }

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function graphApiRequest<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let errorMessage = `Microsoft Graph ${response.status}`;

    try {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      errorMessage = payload.error?.message || errorMessage;
    } catch {
      // ignore json parsing
    }

    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}

function decodeJwtPayload<T>(token: string): T | null {
  const parts = token.split(".");

  if (parts.length < 2) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    const json = Buffer.from(normalized + padding, "base64").toString("utf-8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

async function listChildren(parentId: string, accessToken: string) {
  const payload = await graphRequest<{ value: Array<MicrosoftDriveItem & { folder?: object }> }>(
    `/items/${parentId}/children?$select=id,name,webUrl,folder`,
    accessToken
  );

  return payload.value;
}

async function createFolder(parentId: string, name: string, accessToken: string) {
  return graphRequest<MicrosoftDriveItem>(
    `/items/${parentId}/children`,
    accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        folder: {},
        "@microsoft.graph.conflictBehavior": "rename",
      }),
    }
  );
}

async function getRootFolder(accessToken: string) {
  return graphRequest<MicrosoftDriveItem>("/root?$select=id,name,webUrl", accessToken);
}

export async function ensureMicrosoftFolder(folderPath: string, accessToken: string) {
  const normalizedPath = normalizeMicrosoftFolderPath(folderPath);
  const root = await getRootFolder(accessToken);

  if (!normalizedPath) {
    return {
      ...root,
      path: "",
    } satisfies MicrosoftFolderResult;
  }

  let current = root;
  let currentPath = "";

  for (const segment of normalizedPath.split("/")) {
    const children = await listChildren(current.id, accessToken);
    const existing = children.find((child) => child.name === segment);
    current = existing ?? (await createFolder(current.id, segment, accessToken));
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
  }

  return {
    ...current,
    path: currentPath,
  } satisfies MicrosoftFolderResult;
}

export async function fetchMicrosoftGraphUserProfile(accessToken: string) {
  const me = await graphApiRequest<{
    id: string;
    displayName?: string;
    mail?: string | null;
    userPrincipalName?: string | null;
    mobilePhone?: string | null;
    businessPhones?: string[] | null;
  }>("/me?$select=id,displayName,mail,userPrincipalName,mobilePhone,businessPhones", accessToken);
  const tokenClaims = decodeJwtPayload<{ oid?: string; tid?: string }>(accessToken);
  const email = (me.mail || me.userPrincipalName || "").trim().toLowerCase();

  if (!email) {
    throw new Error("Nao foi possivel identificar o e-mail da conta Microsoft 365.");
  }

  return {
    oid: tokenClaims?.oid || me.id,
    email,
    name: me.displayName || email,
    tenantId: tokenClaims?.tid,
    phone: me.mobilePhone || me.businessPhones?.[0] || undefined,
  } satisfies MicrosoftGraphUserProfile;
}

export async function uploadFileToMicrosoftFolder(input: {
  accessToken: string;
  parentFolderId: string;
  fileName: string;
  buffer: Buffer;
  contentType: string;
}) {
  const safeFileName = sanitizeFileName(input.fileName);
  const binaryPayload = Uint8Array.from(input.buffer);

  return graphRequest<MicrosoftDriveItem>(
    `/items/${input.parentFolderId}:/${encodeURIComponent(safeFileName)}:/content`,
    input.accessToken,
    {
      method: "PUT",
      headers: {
        "Content-Type": input.contentType,
      },
      body: new Blob([binaryPayload], { type: input.contentType }),
    }
  );
}
