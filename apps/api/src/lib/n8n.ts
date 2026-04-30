import type { ReportGeneratedData } from "@elementus/shared";
import { config } from "./config.js";

const FINAL_REPORT_WEBHOOK_FALLBACK_URL =
  "https://elementus-n8n.qseovz.easypanel.host/webhook/elementus-final-report-rag-native-completo";
const FINAL_REPORT_DOCX_WEBHOOK_SECONDARY_URL =
  "https://elementus-n8n.qseovz.easypanel.host/webhook/elementus-final-report-rag-native-completo";

type JsonRecord = Record<string, unknown>;

type NormalizedWebhookAsset = {
  id: string;
  role: "location_map" | "report_image";
  section_id?: string | null;
  title?: string | null;
  caption?: string | null;
  source_url: string;
  filename: string;
  mime_type: string;
  encoding: "url";
  byte_length?: number | null;
};

type FinalReportWebhookAssets = {
  location_map: NormalizedWebhookAsset | null;
  images: NormalizedWebhookAsset[];
  failures: Array<{
    id: string;
    role: "location_map" | "report_image";
    source_url?: string | null;
    reason: string;
  }>;
};

export interface TriggerReportGenerationInput {
  reportId: string;
  projectId: string;
  campaignId?: string | null;
  templateId: string;
  reportNumber: string;
  title: string;
  type: string;
  status: string;
  generatedData: ReportGeneratedData;
  requestedAt: string;
}

export interface TriggerWorkflowResult {
  ok: boolean;
  reason?: string;
  responseBody?: string;
  webhookUrl?: string;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPublicApiBaseUrl() {
  return (process.env.ELEMENTUS_API_URL || "https://appelementus-api.vercel.app").replace(
    /\/+$/,
    ""
  );
}

function isWhatsAppMediaUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "mmg.whatsapp.net" || hostname.endsWith(".whatsapp.net");
  } catch {
    return false;
  }
}

function normalizeWebhookAssetUrl(value?: string | null) {
  const url = getString(value);

  if (!url) {
    return null;
  }

  if (url.startsWith("/api/")) {
    return `${getPublicApiBaseUrl()}${url}`;
  }

  if (/^https?:\/\//i.test(url) && isWhatsAppMediaUrl(url)) {
    return `${getPublicApiBaseUrl()}/api/intake/media-proxy?url=${encodeURIComponent(url)}`;
  }

  return url;
}

function getFilenameFromUrl(url: string, fallback: string) {
  try {
    const parsed = new URL(url);
    const candidate = parsed.pathname.split("/").filter(Boolean).pop();

    if (candidate) {
      return decodeURIComponent(candidate);
    }
  } catch {
    // Falls back below for data URLs or malformed external references.
  }

  return fallback;
}

function getExtensionFromMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase();

  if (normalized.includes("svg")) return "svg";
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("pdf")) return "pdf";

  return "bin";
}

function ensureFilenameExtension(filename: string, mimeType: string) {
  if (/\.[a-z0-9]{2,8}$/i.test(filename)) {
    return filename;
  }

  return `${filename}.${getExtensionFromMimeType(mimeType)}`;
}

function getLocationMap(generatedData: ReportGeneratedData) {
  const variables = asRecord(generatedData.variables);
  const metadata = asRecord(generatedData.metadata);
  return asRecord(variables.location_map || metadata.location_map);
}

function getLocationMapUrl(locationMap: JsonRecord) {
  return (
    getString(locationMap.inlineStaticMapUrl) ||
    getString(locationMap.inline_static_map_url) ||
    getString(locationMap.staticMapUrl) ||
    getString(locationMap.static_map_url)
  );
}

function getImageUrl(image: JsonRecord) {
  return (
    getString(image.preview_url) ||
    getString(image.previewUrl) ||
    getString(image.microsoft365_url) ||
    getString(image.microsoft365Url) ||
    getString(image.media_url) ||
    getString(image.url)
  );
}

/*
async function buildFinalReportWebhookAssets(
  generatedData: ReportGeneratedData
): Promise<FinalReportWebhookAssets> {
  const failures: FinalReportWebhookAssets["failures"] = [];
  const locationMap = getLocationMap(generatedData);
  const images: NormalizedWebhookAsset[] = [];
  let normalizedLocationMap: NormalizedWebhookAsset | null = null;

  if (Object.keys(locationMap).length > 0) {
    const locationResult = await fetchAssetAsBase64({
      id: getString(locationMap.id) || "location-map",
      role: "location_map",
      title: getString(locationMap.title) || "Mapa de localização do atendimento",
      caption: getString(locationMap.addressLabel) || getString(locationMap.address_label),
      url: getLocationMapUrl(locationMap),
      fallbackFilename: "mapa-localizacao",
    });

    if (locationResult.ok) {
      normalizedLocationMap = locationResult.asset;
    } else {
      failures.push(locationResult.failure);
    }
  }

  for (const section of generatedData.sections || []) {
    const sectionId = section.id || section.key || null;

    for (const rawImage of section.images || []) {
      const image = rawImage as unknown as JsonRecord;
      const imageId = getString(image.id) || `image-${images.length + 1}`;
      const imageResult = await fetchAssetAsBase64({
        id: imageId,
        role: "report_image",
        sectionId,
        title: getString(image.name) || `Evidência ${images.length + 1}`,
        caption:
          getString(image.reviewed_caption) ||
          getString(image.reviewedCaption) ||
          getString(image.caption) ||
          getString(image.activity_description) ||
          getString(image.activityDescription),
        url: getImageUrl(image),
        fallbackFilename: getString(image.name) || `evidencia-${images.length + 1}`,
      });

      if (imageResult.ok) {
        images.push(imageResult.asset);
      } else {
        failures.push(imageResult.failure);
      }
    }
  }

  return {
    location_map: normalizedLocationMap,
    images,
    failures,
  };
}
*/

function buildAssetReference(input: {
  id: string;
  role: "location_map" | "report_image";
  sectionId?: string | null;
  title?: string | null;
  caption?: string | null;
  url?: string | null;
  fallbackFilename: string;
  mimeType?: string | null;
}): NormalizedWebhookAsset | null {
  const url = normalizeWebhookAssetUrl(input.url);

  if (!url) {
    return null;
  }

  return {
    id: input.id,
    role: input.role,
    section_id: input.sectionId ?? null,
    title: input.title ?? null,
    caption: input.caption ?? null,
    source_url: url,
    filename: ensureFilenameExtension(
      getFilenameFromUrl(url, input.fallbackFilename),
      input.mimeType || "application/octet-stream"
    ),
    mime_type: input.mimeType || "application/octet-stream",
    encoding: "url",
    byte_length: null,
  };
}

function buildFinalReportWebhookAssetReferences(
  generatedData: ReportGeneratedData
): FinalReportWebhookAssets {
  const failures: FinalReportWebhookAssets["failures"] = [];
  const locationMap = getLocationMap(generatedData);
  const images: NormalizedWebhookAsset[] = [];
  const locationMapUrl = getLocationMapUrl(locationMap);
  const normalizedLocationMap =
    Object.keys(locationMap).length > 0
      ? buildAssetReference({
          id: getString(locationMap.id) || "location-map",
          role: "location_map",
          title: getString(locationMap.title) || "Mapa de localização do atendimento",
          caption: getString(locationMap.addressLabel) || getString(locationMap.address_label),
          url: locationMapUrl,
          fallbackFilename: "mapa-localizacao",
          mimeType: "image/svg+xml",
        })
      : null;

  if (Object.keys(locationMap).length > 0 && !normalizedLocationMap) {
    failures.push({
      id: getString(locationMap.id) || "location-map",
      role: "location_map",
      source_url: null,
      reason: "missing_asset_url",
    });
  }

  for (const section of generatedData.sections || []) {
    const sectionId = section.id || section.key || null;

    for (const rawImage of section.images || []) {
      const image = rawImage as unknown as JsonRecord;
      const imageId = getString(image.id) || `image-${images.length + 1}`;
      const sourceUrl = getImageUrl(image);
      const reference = buildAssetReference({
        id: imageId,
        role: "report_image",
        sectionId,
        title: getString(image.name) || `Evidência ${images.length + 1}`,
        caption:
          getString(image.reviewed_caption) ||
          getString(image.reviewedCaption) ||
          getString(image.caption) ||
          getString(image.activity_description) ||
          getString(image.activityDescription),
        url: sourceUrl,
        fallbackFilename: getString(image.name) || `evidencia-${images.length + 1}`,
        mimeType: getString(image.mime_type) || getString(image.mimeType) || "image/jpeg",
      });

      if (reference) {
        images.push(reference);
      } else {
        failures.push({
          id: imageId,
          role: "report_image",
          source_url: null,
          reason: "missing_asset_url",
        });
      }
    }
  }

  return {
    location_map: normalizedLocationMap,
    images,
    failures,
  };
}

async function postN8nWebhook(
  webhookUrl: string,
  missingReason: string,
  payload: Record<string, unknown>,
  timeoutMs = 10_000
): Promise<TriggerWorkflowResult> {
  if (!webhookUrl) {
    return {
      ok: false,
      reason: missingReason,
      webhookUrl,
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const responseBody = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        reason: `n8n_http_${response.status}: ${webhookUrl}`,
        responseBody,
        webhookUrl,
      };
    }

    return {
      ok: true,
      responseBody,
      webhookUrl,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "n8n_request_failed",
      webhookUrl,
    };
  }
}

function normalizeFinalReportWebhookUrl(value?: string | null) {
  const url = getString(value);

  if (!url) {
    return null;
  }

  return url.replace("/webhook-test/", "/webhook/");
}

function addUniqueUrl(urls: string[], value?: string | null) {
  const url = getString(value);

  if (url && !urls.includes(url)) {
    urls.push(url);
  }
}

function buildFinalReportWebhookUrls(configuredUrl?: string | null) {
  const urls: string[] = [];
  const configured = getString(configuredUrl);
  const normalized = normalizeFinalReportWebhookUrl(configured);

  addUniqueUrl(urls, FINAL_REPORT_WEBHOOK_FALLBACK_URL);
  addUniqueUrl(urls, normalized);

  if (
    configured &&
    configured === normalized &&
    !configured.includes("/webhook-test/")
  ) {
    addUniqueUrl(urls, configured);
  }

  addUniqueUrl(urls, FINAL_REPORT_DOCX_WEBHOOK_SECONDARY_URL);

  return urls;
}

async function postN8nWebhookCandidates(
  webhookUrls: string[],
  missingReason: string,
  payload: Record<string, unknown>,
  timeoutMs = 10_000
): Promise<TriggerWorkflowResult> {
  if (!webhookUrls.length) {
    return {
      ok: false,
      reason: missingReason,
      webhookUrl: "",
    };
  }

  const failures: string[] = [];
  let lastResult: TriggerWorkflowResult | null = null;

  for (const webhookUrl of webhookUrls) {
    const result = await postN8nWebhook(webhookUrl, missingReason, payload, timeoutMs);

    if (result.ok) {
      return result;
    }

    lastResult = result;
    failures.push(result.reason || `n8n_request_failed: ${webhookUrl}`);
  }

  return {
    ok: false,
    reason: failures.length ? failures.join(" | ") : missingReason,
    responseBody: lastResult?.responseBody,
    webhookUrl: lastResult?.webhookUrl || webhookUrls[0],
  };
}

export async function triggerReportGenerationWorkflow(
  input: TriggerReportGenerationInput
): Promise<TriggerWorkflowResult> {
  return postN8nWebhook(config.n8n.webhookUrl, "missing_webhook_url", {
    event: "report.generate.requested",
    source: "elementus-api",
    report_id: input.reportId,
    project_id: input.projectId,
    campaign_id: input.campaignId ?? null,
    template_id: input.templateId,
    report_number: input.reportNumber,
    title: input.title,
    type: input.type,
    status: input.status,
    requested_at: input.requestedAt,
    generated_data: input.generatedData,
  });
}

export async function triggerFinalReportRagWorkflow(input: {
  reportId: string;
  projectId: string;
  campaignId?: string | null;
  templateId: string;
  reportNumber: string;
  title: string;
  type: string;
  status: string;
  generatedData: ReportGeneratedData;
  stageSnapshots: Array<Record<string, unknown>>;
  requestedAt: string;
}): Promise<TriggerWorkflowResult> {
  const mediaAssets = buildFinalReportWebhookAssetReferences(input.generatedData);
  const assetSummary = {
    location_map_included: Boolean(mediaAssets.location_map),
    images_included: mediaAssets.images.length,
    failures: mediaAssets.failures.length,
  };
  const webhookPayload = {
    event: "report.final.generate.requested",
    source: "elementus-api",
    report_id: input.reportId,
    project_id: input.projectId,
    campaign_id: input.campaignId ?? null,
    template_id: input.templateId,
    report_number: input.reportNumber,
    title: input.title,
    type: input.type,
    report_type: input.type,
    status: input.status,
    requested_at: input.requestedAt,
    generated_data: input.generatedData,
    stage_snapshots: input.stageSnapshots,
    media_assets: mediaAssets,
    asset_summary: assetSummary,
    generation_mode: "final_docx_simple_native",
    payload: {
      generated_data: input.generatedData,
      stage_snapshots: input.stageSnapshots,
      media_assets: mediaAssets,
      asset_summary: assetSummary,
    },
  };

  return postN8nWebhookCandidates(
    buildFinalReportWebhookUrls(config.n8n.finalReportWebhookUrl),
    "missing_final_report_webhook_url",
    webhookPayload,
    30_000
  );
}
