export const config = {
  port: parseInt(process.env.API_PORT || "3001", 10),
  supabase: {
    url: process.env.SUPABASE_URL || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
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
  n8n: {
    webhookUrl: process.env.N8N_WEBHOOK_URL || "",
  },
  microsoft365: {
    driveId: process.env.MICROSOFT_365_DRIVE_ID || "",
    rootFolder: process.env.MICROSOFT_365_ROOT_FOLDER || "",
  },
};
