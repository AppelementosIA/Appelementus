import { loadAppEnvironment } from "./env.js";

loadAppEnvironment();

function parseEnvList(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export const config = {
  port: parseInt(process.env.PORT || process.env.API_PORT || "3001", 10),
  supabase: {
    url: process.env.SUPABASE_URL || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },
  passwordAuth: {
    enabled: process.env.PASSWORD_AUTH_ENABLED !== "false",
    allowedDomains: parseEnvList(
      process.env.PASSWORD_AUTH_ALLOWED_DOMAINS || "elementus-sa.com.br"
    ),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
  },
  evolution: {
    url: process.env.EVOLUTION_API_URL || "",
    apiKey: process.env.EVOLUTION_API_KEY || "",
    instanceName: process.env.EVOLUTION_INSTANCE_NAME || "elementus",
  },
  omie: {
    baseUrl: (process.env.OMIE_BASE_URL || "https://app.omie.com.br/api/v1").replace(/\/+$/, ""),
    appKey: process.env.OMIE_APP_KEY || "",
    appSecret: process.env.OMIE_APP_SECRET || "",
  },
  n8n: {
    webhookUrl: process.env.N8N_WEBHOOK_URL || "",
  },
  microsoft365: {
    driveId: process.env.MICROSOFT_365_DRIVE_ID || "",
    rootFolder: process.env.MICROSOFT_365_ROOT_FOLDER || "",
  },
};
