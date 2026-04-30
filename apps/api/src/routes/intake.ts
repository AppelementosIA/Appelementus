import { Buffer } from "node:buffer";
import { createDecipheriv, hkdfSync } from "node:crypto";
import { Router } from "express";
import { deleteReportCascade } from "../lib/report-cleanup.js";
import { supabase } from "../lib/supabase.js";

const router: import("express").Router = Router();

type JsonObject = Record<string, unknown>;

type IntakeContextData = JsonObject & {
  report_action?: "new_report" | "edit_report";
  pending_client_candidate_ids?: string[];
  pending_client_search_text?: string | null;
  pending_project_candidate_ids?: string[];
  pending_project_search_text?: string | null;
  whatsapp_session_options?: string[];
  whatsapp_session_options_at?: string | null;
};

type IntakeSessionRow = {
  id: string;
  user_id: string;
  phone: string;
  client_id?: string | null;
  report_id?: string | null;
  project_id?: string | null;
  template_id?: string | null;
  active_campaign_id?: string | null;
  current_sampling_point_id?: string | null;
  status: string;
  current_step?: string | null;
  missing_fields?: unknown;
  context_data?: IntakeContextData | null;
  last_question?: string | null;
  last_question_at?: string | null;
  last_message_at?: string | null;
  processing_locked_until?: string | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
};

type IntakeMessageRow = {
  id: string;
  session_id: string;
  whatsapp_message_id?: string | null;
  direction: "inbound" | "outbound";
  sender_phone?: string | null;
  sender_name?: string | null;
  message_type: string;
  text_content?: string | null;
  caption?: string | null;
  media_url?: string | null;
  media_storage_path?: string | null;
  media_signed_url?: string | null;
  media_mime_type?: string | null;
  media_size_bytes?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  audio_transcription?: string | null;
  ai_extracted_data?: unknown;
  created_at: string;
};

type MediaProxyMessageRow = {
  id: string;
  session_id: string;
  whatsapp_message_id?: string | null;
  message_type?: string | null;
  text_content?: string | null;
  caption?: string | null;
  media_url?: string | null;
  media_storage_path?: string | null;
  media_mime_type?: string | null;
  media_size_bytes?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  raw_payload?: unknown;
  created_at?: string | null;
};

type IntakeAssetRow = {
  id: string;
  session_id?: string | null;
  message_id?: string | null;
  report_id?: string | null;
  campaign_id?: string | null;
  sampling_point_id?: string | null;
  asset_type: string;
  storage_path: string;
  signed_url?: string | null;
  storage_bucket?: string | null;
  file_size_bytes?: number | null;
  mime_type?: string | null;
  caption?: string | null;
  ai_suggested_caption?: string | null;
  suggested_section_code?: string | null;
  confirmed_section_code?: string | null;
  suggested_figure_role?: string | null;
  figure_number?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  captured_at?: string | null;
  included_in_report?: boolean | null;
  display_order?: number | null;
  created_at: string;
  updated_at?: string | null;
};

type PlatformUserRow = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone_whatsapp?: string | null;
  phone?: string | null;
  app_role?: string | null;
  onboarding_status?: string | null;
  active?: boolean | null;
  is_active?: boolean | null;
};

type OmieProjectRow = {
  id: string;
  client_id: string;
  nome: string;
  empreendimento_nome?: string | null;
  empreendimento_endereco?: string | null;
  empreendimento_cidade?: string | null;
  empreendimento_estado?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  numero_contrato?: string | null;
  status?: string | null;
};

type OmieClientRow = {
  id: string;
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  email?: string | null;
  telefone?: string | null;
  contato_nome?: string | null;
  contato_email?: string | null;
  contato_telefone?: string | null;
};

type TemplateRow = {
  id: string;
  code?: string | null;
  name: string;
  category?: string | null;
  description?: string | null;
};

type ReportRow = {
  id: string;
  report_number?: string | null;
  title: string;
  status: string;
  updated_at: string;
};

type SamplingPointRow = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  point_type?: string | null;
  point_order?: number | null;
};

type IntakeWebhookPayload = {
  whatsapp_message_id?: string | null;
  sender_phone?: string | null;
  sender_name?: string | null;
  message_type?: string | null;
  text_content?: string | null;
  caption?: string | null;
  media_url?: string | null;
  media_storage_path?: string | null;
  media_base64?: string | null;
  media_filename?: string | null;
  media_mime_type?: string | null;
  media_size_bytes?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  raw_payload?: unknown;
  is_photo_without_caption?: boolean | null;
};

const intakeSessionSelect =
  "id, user_id, phone, client_id, report_id, project_id, template_id, active_campaign_id, current_sampling_point_id, status, current_step, missing_fields, context_data, last_question, last_question_at, last_message_at, processing_locked_until, created_at, updated_at, closed_at";
const activeIntakeStatuses = ["open", "awaiting_selection", "awaiting_data", "paused", "ready_for_draft"];

type LoadSessionBundleOptions = {
  includeMessages?: boolean;
  includeAssets?: boolean;
  signMediaUrls?: boolean;
};

type SignedUrlCache = Map<string, Promise<string | null>>;

const fullMessageSelect =
  "id, session_id, whatsapp_message_id, direction, sender_phone, sender_name, message_type, text_content, caption, media_url, media_storage_path, media_mime_type, media_size_bytes, latitude, longitude, audio_transcription, ai_extracted_data, created_at";

const fullAssetSelect =
  "id, session_id, message_id, report_id, campaign_id, sampling_point_id, asset_type, storage_path, storage_bucket, file_size_bytes, mime_type, caption, ai_suggested_caption, suggested_section_code, confirmed_section_code, suggested_figure_role, figure_number, latitude, longitude, captured_at, included_in_report, display_order, created_at, updated_at";

const summaryAssetSelect =
  "id, session_id, message_id, asset_type, caption, ai_suggested_caption, suggested_section_code, confirmed_section_code, included_in_report, display_order, created_at, updated_at";

function getLimit(value: unknown, fallback = 50, max = 200) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

function unique<TValue>(values: Array<TValue | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean))) as TValue[];
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeBoolean(value: unknown) {
  return value === true;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeComparableText(value: unknown) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "";
  }

  return normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeSearchTerm(value: string) {
  return value.replace(/['(),%]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getContextData(value: unknown) {
  return isRecord(value) ? ({ ...value } as IntakeContextData) : ({} as IntakeContextData);
}

function getRecordString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? normalizeText(value) : null;
}

function getNestedRecordString(record: Record<string, unknown>, path: string[]) {
  let current: unknown = record;

  for (const segment of path.slice(0, -1)) {
    if (!isRecord(current)) {
      return null;
    }

    current = current[segment];
  }

  return isRecord(current) ? getRecordString(current, path[path.length - 1]) : null;
}

function getNestedRecordValue(record: Record<string, unknown>, path: string[]) {
  let current: unknown = record;

  for (const segment of path) {
    if (!isRecord(current)) {
      return null;
    }

    current = current[segment];
  }

  return current ?? null;
}

function sanitizeStorageSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function getExtensionFromMimeType(mimeType: string) {
  if (/png/i.test(mimeType)) {
    return "png";
  }

  if (/webp/i.test(mimeType)) {
    return "webp";
  }

  if (/gif/i.test(mimeType)) {
    return "gif";
  }

  return "jpg";
}

function getInboundMimeType(payload: IntakeWebhookPayload) {
  const payloadRecord = payload as Record<string, unknown>;
  const rawPayload = isRecord(payload.raw_payload) ? payload.raw_payload : {};

  return (
    normalizeText(payload.media_mime_type) ||
    getRecordString(payloadRecord, "media_mimetype") ||
    getRecordString(payloadRecord, "mimetype") ||
    getRecordString(payloadRecord, "mimeType") ||
    getNestedRecordString(rawPayload, ["std", "media_mimetype"]) ||
    getNestedRecordString(rawPayload, ["data", "message", "imageMessage", "mimetype"]) ||
    getNestedRecordString(rawPayload, ["data", "message", "videoMessage", "mimetype"]) ||
    getNestedRecordString(rawPayload, ["data", "message", "documentMessage", "mimetype"]) ||
    getNestedRecordString(rawPayload, ["message", "mimetype"]) ||
    "image/jpeg"
  );
}

function getInboundMediaFilename(payload: IntakeWebhookPayload, mimeType: string) {
  const payloadRecord = payload as Record<string, unknown>;
  const rawPayload = isRecord(payload.raw_payload) ? payload.raw_payload : {};
  const explicitFilename =
    normalizeText(payload.media_filename) ||
    getRecordString(payloadRecord, "media_filename") ||
    getRecordString(payloadRecord, "fileName") ||
    getNestedRecordString(rawPayload, ["std", "media_filename"]) ||
    getNestedRecordString(rawPayload, ["data", "message", "imageMessage", "fileName"]) ||
    getNestedRecordString(rawPayload, ["data", "message", "documentMessage", "fileName"]) ||
    getNestedRecordString(rawPayload, ["message", "fileName"]);

  if (explicitFilename) {
    return sanitizeStorageSegment(explicitFilename);
  }

  return `image-${Date.now()}.${getExtensionFromMimeType(mimeType)}`;
}

function getInboundMediaBase64(payload: IntakeWebhookPayload) {
  const payloadRecord = payload as Record<string, unknown>;
  const rawPayload = isRecord(payload.raw_payload) ? payload.raw_payload : {};
  const dataUrl = normalizeText(payload.media_url);
  const base64 =
    normalizeText(payload.media_base64) ||
    getRecordString(payloadRecord, "base64") ||
    getRecordString(payloadRecord, "b64") ||
    getRecordString(payloadRecord, "mediaBase64") ||
    getRecordString(payloadRecord, "fileBase64") ||
    getNestedRecordString(rawPayload, ["data", "base64"]) ||
    getNestedRecordString(rawPayload, ["data", "mediaBase64"]) ||
    getNestedRecordString(rawPayload, ["data", "message", "imageMessage", "base64"]) ||
    getNestedRecordString(rawPayload, ["data", "message", "imageMessage", "mediaBase64"]) ||
    getNestedRecordString(rawPayload, ["data", "message", "imageMessage", "jpegThumbnail"]) ||
    getNestedRecordString(rawPayload, ["message", "base64"]) ||
    getNestedRecordString(rawPayload, ["message", "mediaBase64"]) ||
    getNestedRecordString(rawPayload, ["message", "imageMessage", "base64"]) ||
    getNestedRecordString(rawPayload, ["message", "imageMessage", "mediaBase64"]) ||
    getNestedRecordString(rawPayload, ["message", "imageMessage", "jpegThumbnail"]) ||
    (dataUrl && dataUrl.startsWith("data:image/") ? dataUrl : null);

  if (!base64) {
    return null;
  }

  return base64.includes("base64,") ? base64.split("base64,").pop() || null : base64;
}

function isPhotoMessageType(value?: string | null) {
  const normalized = normalizeComparableText(value);
  return ["image", "photo", "imagem", "image_message", "imagemessage"].includes(normalized);
}

function bufferFromWhatsappBinary(value: unknown) {
  if (typeof value === "string") {
    const cleanValue = value.includes("base64,") ? value.split("base64,").pop() || "" : value;
    return cleanValue ? Buffer.from(cleanValue, "base64") : null;
  }

  if (Array.isArray(value)) {
    return Buffer.from(value.map((item) => Number(item)));
  }

  if (isRecord(value)) {
    const bufferData = value.type === "Buffer" && Array.isArray(value.data) ? value.data : null;

    if (bufferData) {
      return Buffer.from(bufferData.map((item) => Number(item)));
    }

    const numericKeys = Object.keys(value)
      .filter((key) => /^\d+$/.test(key))
      .sort((left, right) => Number(left) - Number(right));

    if (numericKeys.length > 0) {
      return Buffer.from(numericKeys.map((key) => Number(value[key])));
    }
  }

  return null;
}

function getWhatsappImagePayload(payload: IntakeWebhookPayload) {
  const rawPayload = isRecord(payload.raw_payload) ? payload.raw_payload : {};
  const imagePayload =
    getNestedRecordValue(rawPayload, ["data", "message", "imageMessage"]) ||
    getNestedRecordValue(rawPayload, ["message", "imageMessage"]);

  return isRecord(imagePayload) ? imagePayload : {};
}

function getWhatsappEncryptedMediaUrl(payload: IntakeWebhookPayload) {
  const imagePayload = getWhatsappImagePayload(payload);

  return (
    normalizeText(payload.media_url) ||
    getRecordString(imagePayload, "url") ||
    getNestedRecordString(isRecord(payload.raw_payload) ? payload.raw_payload : {}, [
      "data",
      "message",
      "imageMessage",
      "url",
    ])
  );
}

function getWhatsappMediaKey(payload: IntakeWebhookPayload) {
  return bufferFromWhatsappBinary(getWhatsappImagePayload(payload).mediaKey);
}

function isReadableImageBuffer(buffer: Buffer) {
  const header = buffer.subarray(0, 12).toString("hex");
  return header.startsWith("ffd8ff") || header.startsWith("89504e470d0a1a0a") || header.startsWith("52494646");
}

function decryptWhatsappMediaBuffer(encryptedBuffer: Buffer, mediaKey: Buffer, mimeType: string) {
  const info = /png|webp|jpe?g|image/i.test(mimeType) ? "WhatsApp Image Keys" : null;

  if (!info || mediaKey.length !== 32 || encryptedBuffer.length <= 10) {
    return null;
  }

  const expandedKey = Buffer.from(
    hkdfSync("sha256", mediaKey, Buffer.alloc(32), Buffer.from(info), 112)
  );
  const iv = expandedKey.subarray(0, 16);
  const cipherKey = expandedKey.subarray(16, 48);
  const cipherText = encryptedBuffer.subarray(0, -10);
  const decipher = createDecipheriv("aes-256-cbc", cipherKey, iv);

  return Buffer.concat([decipher.update(cipherText), decipher.final()]);
}

async function downloadWhatsappImageFromPayload(payload: IntakeWebhookPayload, mimeType: string) {
  if (!isPhotoMessageType(payload.message_type)) {
    return null;
  }

  const mediaUrl = getWhatsappEncryptedMediaUrl(payload);
  const mediaKey = getWhatsappMediaKey(payload);

  if (!mediaUrl || !mediaKey) {
    return null;
  }

  const response = await fetch(mediaUrl, { redirect: "follow" });

  if (!response.ok) {
    throw new Error(`Nao foi possivel baixar a midia do WhatsApp: HTTP ${response.status}`);
  }

  const encryptedBuffer = Buffer.from(await response.arrayBuffer());

  if (isReadableImageBuffer(encryptedBuffer)) {
    return encryptedBuffer;
  }

  const decryptedBuffer = decryptWhatsappMediaBuffer(encryptedBuffer, mediaKey, mimeType);

  if (!decryptedBuffer || !isReadableImageBuffer(decryptedBuffer)) {
    throw new Error("Nao foi possivel descriptografar a imagem recebida pelo WhatsApp.");
  }

  return decryptedBuffer;
}

async function getInboundMediaBuffer(payload: IntakeWebhookPayload, mimeType: string) {
  const cleanBase64 = getInboundMediaBase64(payload);

  if (cleanBase64) {
    return Buffer.from(cleanBase64, "base64");
  }

  return downloadWhatsappImageFromPayload(payload, mimeType);
}

function omitContextKeys(contextData: IntakeContextData, keys: string[]) {
  const nextContext = { ...contextData };

  for (const key of keys) {
    delete nextContext[key];
  }

  return nextContext;
}

function buildMissingFields(clientId?: string | null, projectId?: string | null) {
  const missingFields: string[] = [];

  if (!clientId) {
    missingFields.push("Cliente");
  }

  if (!projectId) {
    missingFields.push("Projeto");
  }

  return missingFields;
}

function getClientDisplayName(client: OmieClientRow) {
  return client.nome_fantasia || client.razao_social;
}

function getProjectDisplayName(project: OmieProjectRow) {
  return project.numero_contrato
    ? `${project.nome} (${project.numero_contrato})`
    : project.nome;
}

function getTechnicianFirstName(user?: PlatformUserRow | null, whatsappName?: string | null) {
  const displayName = normalizeText(user?.full_name || user?.name) || normalizeText(whatsappName);

  if (!displayName || displayName.includes("@")) {
    return null;
  }

  const firstName = displayName
    .split(/\s+/)
    .map((part) => part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .find((part) => part.length > 0);

  return firstName || null;
}

function buildGreeting(firstName: string | null) {
  return firstName ? `Ola, ${firstName}.` : "Ola.";
}

function addressMessage(firstName: string | null, message: string) {
  if (!firstName) {
    return message;
  }

  return `${firstName}, ${message.charAt(0).toLowerCase()}${message.slice(1)}`;
}

function buildProjectClarificationText(
  client: OmieClientRow,
  projects: OmieProjectRow[],
  firstName?: string | null
) {
  const projectOptions = projects
    .slice(0, 3)
    .map((project) => getProjectDisplayName(project))
    .join("; ");

  const baseText = `Encontrei mais de um projeto para ${getClientDisplayName(client)}. Me envie o nome mais completo do projeto ou o numero do contrato.`;
  const fullText = projectOptions ? `${baseText} Opcoes encontradas: ${projectOptions}.` : baseText;

  return addressMessage(firstName || null, fullText);
}

function buildReportActionQuestion(user?: PlatformUserRow | null, whatsappName?: string | null) {
  const greeting = buildGreeting(getTechnicianFirstName(user, whatsappName));

  return `${greeting} Voce quer construir um novo relatorio ou editar um relatorio atual? Responda com "novo" ou "editar".`;
}

function wantsNewReport(text: string | null) {
  const normalized = normalizeComparableText(text);

  if (!normalized) {
    return false;
  }

  if (
    [
      "novo",
      "nova",
      "novo relatorio",
      "novo relatório",
      "novo laudo",
      "abrir novo",
      "abrir novo relatorio",
      "abrir novo relatório",
      "iniciar novo",
      "iniciar novo relatorio",
      "iniciar novo relatório",
      "criar novo",
      "criar novo relatorio",
      "criar novo relatório",
    ].includes(normalized)
  ) {
    return true;
  }

  return /^(abrir|iniciar|criar)\s+(um\s+)?(novo|nova)\b/.test(normalized);
}

function wantsEditReport(text: string | null) {
  const normalized = normalizeComparableText(text);

  if (!normalized) {
    return false;
  }

  if (
    [
      "2",
      "editar",
      "edita",
      "editar relatorio",
      "editar relatorio atual",
      "alterar",
      "alterar relatorio",
      "corrigir",
      "corrigir relatorio",
      "ajustar",
      "ajustar relatorio",
      "continuar",
      "continuar relatorio",
      "relatorio atual",
      "relatorio existente",
    ].includes(normalized)
  ) {
    return true;
  }

  return /^(editar|alterar|corrigir|ajustar|continuar)\s+(um\s+)?(relatorio|laudo)\b/.test(
    normalized
  );
}

function resolveReportAction(text: string | null): IntakeContextData["report_action"] | null {
  const normalized = normalizeComparableText(text);

  if (normalized === "1" || wantsNewReport(text)) {
    return "new_report";
  }

  if (wantsEditReport(text)) {
    return "edit_report";
  }

  return null;
}

function getReportActionText(action: IntakeContextData["report_action"] | null | undefined) {
  return action === "edit_report" ? "editar um relatorio atual" : "construir um novo relatorio";
}

function buildProjectConfirmedText(
  project: OmieProjectRow,
  action: IntakeContextData["report_action"] | null | undefined,
  firstName?: string | null
) {
  return addressMessage(
    firstName || null,
    `Perfeito. Cliente e projeto confirmados: ${getProjectDisplayName(project)}. Agora vamos ${getReportActionText(action)}. Me envie um resumo do que foi executado em campo para eu iniciar a entrevista tecnica.`
  );
}

function normalizePhoneDigits(phone: string | null | undefined) {
  return (phone ?? "").replace(/\D/g, "");
}

function toNationalPhoneDigits(digits: string) {
  if (digits.startsWith("55") && digits.length > 11) {
    return digits.slice(2);
  }

  return digits;
}

function getLastPhoneDigits(digits: string, length = 8) {
  return digits.length > length ? digits.slice(-length) : digits;
}

function rankPhoneMatch(inputPhone: string, storedPhone: string) {
  const inputDigits = normalizePhoneDigits(inputPhone);
  const storedDigits = normalizePhoneDigits(storedPhone);

  if (!inputDigits || !storedDigits) {
    return null;
  }

  const inputNationalDigits = toNationalPhoneDigits(inputDigits);
  const storedNationalDigits = toNationalPhoneDigits(storedDigits);

  if (storedDigits === inputDigits) {
    return 0;
  }

  if (storedNationalDigits === inputNationalDigits) {
    return 1;
  }

  if (
    getLastPhoneDigits(storedNationalDigits, 8) ===
    getLastPhoneDigits(inputNationalDigits, 8)
  ) {
    return 2;
  }

  return null;
}

function isPhoneMatchRank(value: 0 | 1 | 2 | null): value is 0 | 1 | 2 {
  return value !== null;
}

function extractRpcRow<TValue>(data: TValue[] | TValue | null) {
  if (Array.isArray(data)) {
    return data[0] ?? null;
  }

  return data ?? null;
}

async function findActivePlatformUserByPhone(phone: string) {
  const { data, error } = await supabase
    .from("platform_users")
    .select("id, full_name, name, email, phone_whatsapp, phone, active")
    .eq("active", true)
    .or("phone_whatsapp.not.is.null,phone.not.is.null");

  if (error) {
    throw new Error(error.message);
  }

  const rankedByUser = new Map<string, { user: PlatformUserRow; rank: number }>();

  for (const user of (data || []) as PlatformUserRow[]) {
    const ranks = [user.phone_whatsapp, user.phone]
      .map((candidatePhone) => rankPhoneMatch(phone, candidatePhone || ""))
      .filter(isPhoneMatchRank);

    if (ranks.length === 0) {
      continue;
    }

    const bestRank = Math.min(...ranks);
    const existing = rankedByUser.get(user.id);

    if (!existing || bestRank < existing.rank) {
      rankedByUser.set(user.id, { user, rank: bestRank });
    }
  }

  const matches = Array.from(rankedByUser.values()).sort((left, right) => left.rank - right.rank);

  const exactMatch = matches.find((match) => match.rank <= 1);
  if (exactMatch) {
    return exactMatch.user;
  }

  const suffixMatches = matches.filter((match) => match.rank === 2);
  if (suffixMatches.length === 1) {
    return suffixMatches[0].user;
  }

  return null;
}

async function findOpenSessionForUser(userId: string) {
  const [session] = await findOpenSessionsForUser(userId, 1);

  return session || null;
}

async function findOpenSessionsForUser(userId: string, limit = 6) {
  const { data, error } = await supabase
    .from("intake_sessions")
    .select(intakeSessionSelect)
    .eq("user_id", userId)
    .in("status", ["open", "awaiting_selection", "awaiting_data", "paused", "ready_for_draft"])
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as IntakeSessionRow[];
}

async function findRecentSessionChoiceSession(userId: string) {
  const sessions = await findOpenSessionsForUser(userId, 10);
  const now = Date.now();

  return (
    sessions.find((session) => {
      const context = getContextData(session.context_data);
      const optionIds = normalizeStringArray(context.whatsapp_session_options);
      const optionsAt = context.whatsapp_session_options_at
        ? new Date(String(context.whatsapp_session_options_at)).getTime()
        : 0;

      return optionIds.length > 0 && Number.isFinite(optionsAt) && now - optionsAt < 30 * 60 * 1000;
    }) || null
  );
}

async function clearSessionChoiceOptions(userId: string) {
  const sessions = await findOpenSessionsForUser(userId, 10);

  await Promise.all(
    sessions.map((session) => {
      const context = getContextData(session.context_data);

      if (!normalizeStringArray(context.whatsapp_session_options).length) {
        return Promise.resolve(null);
      }

      return updateSession(session.id, {
        context_data: omitContextKeys(context, [
          "whatsapp_session_options",
          "whatsapp_session_options_at",
        ]),
      });
    })
  );
}

function isSessionMenuRequest(text: string | null) {
  const normalized = normalizeComparableText(text);

  return [
    "0",
    "menu",
    "inicio",
    "iniciar",
    "voltar",
    "oi",
    "ola",
    "bom dia",
    "boa tarde",
    "boa noite",
  ].includes(normalized);
}

async function createOpenSession(userId: string, phone: string) {
  const { data, error } = await supabase
    .from("intake_sessions")
    .insert({
      user_id: userId,
      phone,
      status: "awaiting_selection",
      current_step: "awaiting_report_action",
      missing_fields: ["Acao do relatorio", ...buildMissingFields(null, null)],
      context_data: {},
    })
    .select(intakeSessionSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function findExistingWhatsappMessage(whatsappMessageId: string | null) {
  if (!whatsappMessageId) {
    return null;
  }

  const { data, error } = await supabase
    .from("intake_messages")
    .select("id, session_id")
    .eq("whatsapp_message_id", whatsappMessageId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getSessionById(sessionId: string) {
  const { data, error } = await supabase
    .from("intake_sessions")
    .select(intakeSessionSelect)
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as IntakeSessionRow | null;
}

async function updateSession(sessionId: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("intake_sessions")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select(intakeSessionSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as IntakeSessionRow;
}

async function touchSession(sessionId: string) {
  const { error } = await supabase
    .from("intake_sessions")
    .update({
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    throw new Error(error.message);
  }
}

async function uploadInboundMediaFromBase64(sessionId: string, payload: IntakeWebhookPayload) {
  const mimeType = getInboundMimeType(payload);
  const buffer = await getInboundMediaBuffer(payload, mimeType);

  if (!buffer) {
    return null;
  }

  const filename = getInboundMediaFilename(payload, mimeType);
  const storagePath = [
    "sessions",
    sessionId,
    sanitizeStorageSegment(normalizeText(payload.whatsapp_message_id) || `message-${Date.now()}`),
    filename,
  ].join("/");

  if (buffer.length === 0) {
    throw new Error("Imagem recebida sem conteudo valido.");
  }

  const { error } = await supabase.storage
    .from("intake-assets")
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Nao foi possivel salvar a midia recebida: ${error.message}`);
  }

  return {
    storagePath,
    mimeType,
    sizeBytes: buffer.length,
  };
}

async function insertIntakeAssetForMedia(input: {
  sessionId: string;
  messageId: string;
  payload: IntakeWebhookPayload;
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
}) {
  const messageType = normalizeText(input.payload.message_type) || "image";

  if (!isPhotoMessageType(messageType)) {
    return;
  }

  const assetPayload = {
    session_id: input.sessionId,
    message_id: input.messageId,
    asset_type: "photo",
    storage_path: input.storagePath,
    storage_bucket: "intake-assets",
    file_size_bytes: input.sizeBytes,
    mime_type: input.mimeType,
    caption: normalizeText(input.payload.caption) || normalizeText(input.payload.text_content),
    suggested_section_code: "photos",
    latitude: normalizeNumber(input.payload.latitude),
    longitude: normalizeNumber(input.payload.longitude),
    captured_at: new Date().toISOString(),
    included_in_report: true,
    updated_at: new Date().toISOString(),
  };

  const { data: existingAsset, error: findError } = await supabase
    .from("intake_assets")
    .select("id")
    .eq("message_id", input.messageId)
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw new Error(`Nao foi possivel verificar a midia recebida: ${findError.message}`);
  }

  const { error } = existingAsset
    ? await supabase.from("intake_assets").update(assetPayload).eq("id", existingAsset.id)
    : await supabase.from("intake_assets").insert(assetPayload);

  if (error) {
    throw new Error(`Nao foi possivel registrar a midia recebida: ${error.message}`);
  }
}

async function findIntakeMessageForMediaUrl(rawUrl: string) {
  const { data, error } = await supabase
    .from("intake_messages")
    .select(
      "id, session_id, whatsapp_message_id, message_type, text_content, caption, media_url, media_storage_path, media_mime_type, media_size_bytes, latitude, longitude, raw_payload, created_at"
    )
    .eq("media_url", rawUrl)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<MediaProxyMessageRow>();

  if (error) {
    throw new Error(`Nao foi possivel localizar a midia no atendimento: ${error.message}`);
  }

  return data;
}

async function downloadStoredIntakeMedia(storagePath: string) {
  const { data, error } = await supabase.storage.from("intake-assets").download(storagePath);

  if (error || !data) {
    return null;
  }

  return Buffer.from(await data.arrayBuffer());
}

function buildMediaProxyPayload(message: MediaProxyMessageRow, rawUrl: string): IntakeWebhookPayload {
  return {
    whatsapp_message_id: message.whatsapp_message_id || message.id,
    sender_phone: null,
    sender_name: null,
    message_type: message.message_type || "image",
    text_content: message.text_content || null,
    caption: message.caption || null,
    media_url: rawUrl,
    media_storage_path: message.media_storage_path || null,
    media_mime_type: message.media_mime_type || "image/jpeg",
    media_size_bytes: message.media_size_bytes || null,
    latitude: message.latitude ?? null,
    longitude: message.longitude ?? null,
    raw_payload: message.raw_payload || {},
  };
}

async function materializeWhatsappMediaForMessage(message: MediaProxyMessageRow, rawUrl: string) {
  const mimeType = message.media_mime_type || "image/jpeg";

  if (message.media_storage_path) {
    const storedBuffer = await downloadStoredIntakeMedia(message.media_storage_path);

    if (storedBuffer && isReadableImageBuffer(storedBuffer)) {
      return {
        buffer: storedBuffer,
        mimeType,
        storagePath: message.media_storage_path,
      };
    }
  }

  const payload = buildMediaProxyPayload(message, rawUrl);
  const buffer = await getInboundMediaBuffer(payload, mimeType);

  if (!buffer || buffer.length === 0 || !isReadableImageBuffer(buffer)) {
    throw new Error("A midia do WhatsApp ainda esta criptografada ou nao contem uma imagem valida.");
  }

  const messageKey = sanitizeStorageSegment(message.whatsapp_message_id || message.id);
  const filename = `${messageKey}.${getExtensionFromMimeType(mimeType)}`;
  const storagePath = ["sessions", message.session_id, messageKey, filename].join("/");

  const { error: uploadError } = await supabase.storage
    .from("intake-assets")
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Nao foi possivel salvar a midia descriptografada: ${uploadError.message}`);
  }

  const { error: updateMessageError } = await supabase
    .from("intake_messages")
    .update({
      media_storage_path: storagePath,
      media_mime_type: mimeType,
      media_size_bytes: buffer.length,
    })
    .eq("id", message.id);

  if (updateMessageError) {
    throw new Error(`Nao foi possivel atualizar a mensagem com a midia salva: ${updateMessageError.message}`);
  }

  await insertIntakeAssetForMedia({
    sessionId: message.session_id,
    messageId: message.id,
    payload,
    storagePath,
    mimeType,
    sizeBytes: buffer.length,
  });

  return {
    buffer,
    mimeType,
    storagePath,
  };
}

async function insertInboundMessage(sessionId: string, payload: IntakeWebhookPayload) {
  const uploadedMedia = await uploadInboundMediaFromBase64(sessionId, payload);
  const mediaStoragePath =
    uploadedMedia?.storagePath || normalizeText(payload.media_storage_path) || null;
  const mediaUrl = normalizeText(payload.media_url);
  const hasInboundMedia = Boolean(uploadedMedia || mediaStoragePath || mediaUrl);
  const mediaMimeType = hasInboundMedia
    ? uploadedMedia?.mimeType || normalizeText(payload.media_mime_type) || getInboundMimeType(payload)
    : null;
  const mediaSizeBytes =
    uploadedMedia?.sizeBytes ?? normalizeNumber(payload.media_size_bytes) ?? null;

  const { data, error } = await supabase
    .from("intake_messages")
    .insert({
      session_id: sessionId,
      whatsapp_message_id: normalizeText(payload.whatsapp_message_id) ?? null,
      direction: "inbound",
      sender_phone: normalizeText(payload.sender_phone) ?? null,
      sender_name: normalizeText(payload.sender_name) ?? null,
      message_type: normalizeText(payload.message_type) ?? "text",
      text_content: normalizeText(payload.text_content) ?? null,
      caption: normalizeText(payload.caption) ?? null,
      media_url: mediaUrl?.startsWith("data:image/") ? null : mediaUrl ?? null,
      media_storage_path: mediaStoragePath,
      media_mime_type: mediaMimeType,
      media_size_bytes: mediaSizeBytes,
      latitude: normalizeNumber(payload.latitude),
      longitude: normalizeNumber(payload.longitude),
      raw_payload:
        payload.raw_payload && typeof payload.raw_payload === "object"
          ? payload.raw_payload
          : {},
    })
    .select("id, session_id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (mediaStoragePath) {
    await insertIntakeAssetForMedia({
      sessionId,
      messageId: data.id,
      payload,
      storagePath: mediaStoragePath,
      mimeType: mediaMimeType,
      sizeBytes: mediaSizeBytes,
    });
  }

  return data;
}

async function logOutboundMessage(sessionId: string, text: string, questionKey: string) {
  const now = new Date().toISOString();

  const { error: insertError } = await supabase.from("intake_messages").insert({
    session_id: sessionId,
    direction: "outbound",
    message_type: "text",
    text_content: text,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  const { error: updateError } = await supabase
    .from("intake_sessions")
    .update({
      last_question: questionKey,
      last_question_at: now,
      updated_at: now,
    })
    .eq("id", sessionId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function searchClientCandidates(searchText: string, candidateIds?: string[]) {
  const normalizedSearch = sanitizeSearchTerm(searchText);
  const digitSearch = normalizeDigits(searchText);
  const filters: string[] = [];
  const query = supabase
    .from("omie_clients_mirror")
    .select(
      "id, razao_social, nome_fantasia, cnpj, email, telefone, contato_nome, contato_email, contato_telefone"
    )
    .order("razao_social", { ascending: true })
    .limit(10);

  if (candidateIds && candidateIds.length > 0) {
    query.in("id", candidateIds);
  }

  if (normalizedSearch) {
    filters.push(`razao_social.ilike.%${normalizedSearch}%`);
    filters.push(`nome_fantasia.ilike.%${normalizedSearch}%`);
  }

  if (digitSearch) {
    filters.push(`cnpj.ilike.%${digitSearch}%`);
  }

  if (filters.length > 0) {
    query.or(filters.join(","));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as OmieClientRow[]).sort((left, right) => {
    return getClientDisplayName(left).localeCompare(getClientDisplayName(right), "pt-BR");
  });
}

async function getClientById(clientId: string) {
  const { data, error } = await supabase
    .from("omie_clients_mirror")
    .select(
      "id, razao_social, nome_fantasia, cnpj, email, telefone, contato_nome, contato_email, contato_telefone"
    )
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as OmieClientRow | null) || null;
}

async function getProjectById(projectId: string) {
  const { data, error } = await supabase
    .from("omie_projects_mirror")
    .select(
      "id, client_id, nome, empreendimento_nome, empreendimento_endereco, empreendimento_cidade, empreendimento_estado, latitude, longitude, numero_contrato, status"
    )
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as OmieProjectRow | null) || null;
}

function getSessionStateLabel(session: IntakeSessionRow) {
  if (session.status === "ready_for_draft") {
    return "pronto para montagem";
  }

  switch (session.current_step) {
    case "awaiting_report_action":
      return "selecionando ação";
    case "awaiting_client":
    case "awaiting_client_cnpj":
      return "aguardando cliente";
    case "awaiting_project":
      return "aguardando projeto";
    case "awaiting_period":
      return "aguardando período";
    case "awaiting_field_dates":
      return "aguardando datas de campo";
    case "awaiting_location":
      return "aguardando localização";
    case "awaiting_technical_summary":
      return "aguardando resumo técnico";
    case "awaiting_activities":
      return "aguardando atividades";
    case "awaiting_results":
      return "aguardando resultados";
    case "awaiting_occurrences":
      return "aguardando ocorrências";
    case "awaiting_photos":
      return "aguardando evidências";
    case "awaiting_additional_info":
      return "aguardando informações finais";
    default:
      return session.current_step?.replace(/_/g, " ") || session.status;
  }
}

async function buildSessionOptionRows(sessions: IntakeSessionRow[]) {
  return Promise.all(
    sessions.map(async (session, index) => {
      const project = session.project_id ? await getProjectById(session.project_id) : null;
      const client = session.client_id
        ? await getClientById(session.client_id)
        : project?.client_id
        ? await getClientById(project.client_id)
        : null;
      const clientName = client ? getClientDisplayName(client) : "Cliente não vinculado";
      const projectName = project ? getProjectDisplayName(project) : "Projeto não vinculado";

      return `${index + 1}. ${clientName} - ${projectName} (${getSessionStateLabel(session)})`;
    })
  );
}

async function buildSessionChoiceText(
  firstName: string | null,
  sessions: IntakeSessionRow[]
) {
  const rows = await buildSessionOptionRows(sessions);
  const intro =
    sessions.length === 1
      ? "Encontrei um relatório em andamento:"
      : `Encontrei ${sessions.length} relatórios em andamento:`;

  return addressMessage(
    firstName,
    `${intro}\n${rows.join("\n")}\n\nResponda com o número para continuar ou escreva NOVO para iniciar outro relatório.`
  );
}

async function buildSessionResumeText(session: IntakeSessionRow, firstName: string | null) {
  const [row] = await buildSessionOptionRows([session]);

  return addressMessage(
    firstName,
    `retomei este relatório: ${row.replace(/^1\.\s*/, "")}. Pode enviar a próxima informação correspondente a esse atendimento.`
  );
}

async function searchProjectCandidates(clientId: string, searchText: string, candidateIds?: string[]) {
  const normalizedSearch = sanitizeSearchTerm(searchText);
  const digitSearch = normalizeDigits(searchText);
  const filters: string[] = [];
  const query = supabase
    .from("omie_projects_mirror")
    .select(
      "id, client_id, nome, empreendimento_nome, empreendimento_endereco, empreendimento_cidade, empreendimento_estado, latitude, longitude, numero_contrato, status"
    )
    .eq("client_id", clientId)
    .order("nome", { ascending: true })
    .limit(10);

  if (candidateIds && candidateIds.length > 0) {
    query.in("id", candidateIds);
  }

  if (normalizedSearch) {
    filters.push(`nome.ilike.%${normalizedSearch}%`);
    filters.push(`empreendimento_nome.ilike.%${normalizedSearch}%`);
    filters.push(`numero_contrato.ilike.%${normalizedSearch}%`);
  }

  if (digitSearch) {
    filters.push(`numero_contrato.ilike.%${digitSearch}%`);
  }

  if (filters.length > 0) {
    query.or(filters.join(","));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as OmieProjectRow[]).sort((left, right) => {
    const statusBias = left.status === "active" ? -1 : right.status === "active" ? 1 : 0;
    if (statusBias !== 0) {
      return statusBias;
    }

    return getProjectDisplayName(left).localeCompare(getProjectDisplayName(right), "pt-BR");
  });
}

function resolveClientMatch(searchText: string, candidates: OmieClientRow[]) {
  const digitSearch = normalizeDigits(searchText);
  const comparableSearch = normalizeComparableText(searchText);

  if (digitSearch.length >= 14) {
    const exactCnpjMatches = candidates.filter(
      (candidate) => normalizeDigits(candidate.cnpj) === digitSearch
    );

    if (exactCnpjMatches.length === 1) {
      return exactCnpjMatches[0];
    }
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  if (comparableSearch) {
    const exactNameMatches = candidates.filter((candidate) => {
      return (
        normalizeComparableText(candidate.razao_social) === comparableSearch ||
        normalizeComparableText(candidate.nome_fantasia) === comparableSearch
      );
    });

    if (exactNameMatches.length === 1) {
      return exactNameMatches[0];
    }
  }

  return null;
}

function resolveProjectMatch(searchText: string, candidates: OmieProjectRow[]) {
  const comparableSearch = normalizeComparableText(searchText);

  if (comparableSearch) {
    const exactContractMatches = candidates.filter((candidate) => {
      return normalizeComparableText(candidate.numero_contrato) === comparableSearch;
    });

    if (exactContractMatches.length === 1) {
      return exactContractMatches[0];
    }

    const exactNameMatches = candidates.filter((candidate) => {
      return (
        normalizeComparableText(candidate.nome) === comparableSearch ||
        normalizeComparableText(candidate.empreendimento_nome) === comparableSearch
      );
    });

    if (exactNameMatches.length === 1) {
      return exactNameMatches[0];
    }
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  return null;
}

async function selectClientForSession(session: IntakeSessionRow, client: OmieClientRow) {
  const currentContext = getContextData(session.context_data);

  return updateSession(session.id, {
    client_id: client.id,
    project_id: null,
    status: "awaiting_selection",
    current_step: "awaiting_project",
    missing_fields: buildMissingFields(client.id, null),
    context_data: omitContextKeys(currentContext, [
      "pending_client_candidate_ids",
      "pending_client_search_text",
      "pending_project_candidate_ids",
      "pending_project_search_text",
    ]),
  });
}

async function selectProjectForSession(session: IntakeSessionRow, project: OmieProjectRow) {
  const currentContext = getContextData(session.context_data);

  return updateSession(session.id, {
    project_id: project.id,
    status: "awaiting_data",
    current_step: "ready_for_intake",
    missing_fields: ["Dados tecnicos do relatorio"],
    context_data: omitContextKeys(currentContext, [
      "pending_project_candidate_ids",
      "pending_project_search_text",
    ]),
    last_question: null,
  });
}

async function setSessionAwaitingReportAction(session: IntakeSessionRow) {
  const currentContext = getContextData(session.context_data);

  return updateSession(session.id, {
    client_id: null,
    project_id: null,
    report_id: null,
    status: "awaiting_selection",
    current_step: "awaiting_report_action",
    missing_fields: ["Acao do relatorio", ...buildMissingFields(null, null)],
    context_data: omitContextKeys(currentContext, [
      "report_action",
      "pending_client_candidate_ids",
      "pending_client_search_text",
      "pending_project_candidate_ids",
      "pending_project_search_text",
    ]),
  });
}

async function selectReportActionForSession(
  session: IntakeSessionRow,
  reportAction: NonNullable<IntakeContextData["report_action"]>
) {
  const currentContext = getContextData(session.context_data);

  return updateSession(session.id, {
    client_id: null,
    project_id: null,
    report_id: null,
    status: "awaiting_selection",
    current_step: "awaiting_client",
    missing_fields: buildMissingFields(null, null),
    context_data: {
      ...omitContextKeys(currentContext, [
        "pending_client_candidate_ids",
        "pending_client_search_text",
        "pending_project_candidate_ids",
        "pending_project_search_text",
      ]),
      report_action: reportAction,
    },
  });
}

async function setSessionAwaitingClient(session: IntakeSessionRow) {
  const currentContext = getContextData(session.context_data);

  return updateSession(session.id, {
    status: "awaiting_selection",
    current_step: "awaiting_client",
    missing_fields: buildMissingFields(null, null),
    context_data: omitContextKeys(currentContext, [
      "pending_client_candidate_ids",
      "pending_client_search_text",
      "pending_project_candidate_ids",
      "pending_project_search_text",
    ]),
  });
}

async function setSessionAwaitingClientCnpj(
  session: IntakeSessionRow,
  searchText: string,
  candidates: OmieClientRow[]
) {
  const currentContext = getContextData(session.context_data);

  return updateSession(session.id, {
    status: "awaiting_selection",
    current_step: "awaiting_client_cnpj",
    missing_fields: buildMissingFields(null, null),
    context_data: {
      ...omitContextKeys(currentContext, ["pending_project_candidate_ids", "pending_project_search_text"]),
      pending_client_candidate_ids: candidates.map((candidate) => candidate.id),
      pending_client_search_text: searchText,
    },
  });
}

async function setSessionAwaitingProject(session: IntakeSessionRow) {
  const currentContext = getContextData(session.context_data);

  return updateSession(session.id, {
    status: "awaiting_selection",
    current_step: "awaiting_project",
    missing_fields: buildMissingFields(session.client_id, null),
    context_data: omitContextKeys(currentContext, [
      "pending_project_candidate_ids",
      "pending_project_search_text",
    ]),
  });
}

async function setSessionAwaitingProjectClarification(
  session: IntakeSessionRow,
  searchText: string,
  candidates: OmieProjectRow[]
) {
  const currentContext = getContextData(session.context_data);

  return updateSession(session.id, {
    status: "awaiting_selection",
    current_step: "awaiting_project",
    missing_fields: buildMissingFields(session.client_id, null),
    context_data: {
      ...omitContextKeys(currentContext, ["pending_client_candidate_ids", "pending_client_search_text"]),
      pending_project_candidate_ids: candidates.map((candidate) => candidate.id),
      pending_project_search_text: searchText,
    },
  });
}

async function enqueuePhotoDescription(sessionId: string, messageId: string) {
  const { data, error } = await supabase.rpc("enqueue_photo_for_description", {
    p_session_id: sessionId,
    p_message_id: messageId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return extractRpcRow<{
    should_ask_now: boolean;
    phone: string | null;
    technician_first_name: string | null;
  }>(data as
    | {
        should_ask_now: boolean;
        phone: string | null;
        technician_first_name: string | null;
      }[]
    | {
        should_ask_now: boolean;
        phone: string | null;
        technician_first_name: string | null;
      }
    | null);
}

async function logOutboundPhotoPrompt(sessionId: string, text: string) {
  await logOutboundMessage(sessionId, text, "photo_description_request");
}

function isHttpUrl(value?: string | null) {
  return Boolean(value && /^https?:\/\//i.test(value.trim()));
}

function isWhatsAppMediaUrl(value?: string | null) {
  if (!value || !isHttpUrl(value)) {
    return false;
  }

  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "mmg.whatsapp.net" || hostname.endsWith(".whatsapp.net");
  } catch {
    return false;
  }
}

function buildWhatsAppMediaProxyUrl(value: string) {
  return `/api/intake/media-proxy?url=${encodeURIComponent(value.trim())}&mediaVersion=20260429-v3`;
}

function normalizeStorageObjectPath(path: string, bucket: string) {
  let normalized = path.trim();

  if (!normalized || isHttpUrl(normalized)) {
    return null;
  }

  normalized = normalized.replace(/^\/+/, "");

  if (normalized.startsWith(`${bucket}/`)) {
    normalized = normalized.slice(bucket.length + 1);
  }

  return normalized || null;
}

async function createSignedStorageUrl(
  path?: string | null,
  bucket = "intake-assets",
  cache?: SignedUrlCache
) {
  if (!path) {
    return null;
  }

  if (isWhatsAppMediaUrl(path)) {
    return buildWhatsAppMediaProxyUrl(path);
  }

  if (isHttpUrl(path)) {
    return path.trim();
  }

  const objectPath = normalizeStorageObjectPath(path, bucket);

  if (!objectPath) {
    return null;
  }

  const cacheKey = `${bucket}:${objectPath}`;
  const createUrl = async () => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, 60 * 60 * 24);

    if (error) {
      return null;
    }

    return data.signedUrl;
  };

  if (cache) {
    const cached = cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const promise = createUrl();
    cache.set(cacheKey, promise);
    return promise;
  }

  return createUrl();
}

async function loadSessionBundle(
  sessionRows: IntakeSessionRow[],
  options: LoadSessionBundleOptions = {}
) {
  const includeMessages = options.includeMessages ?? true;
  const includeAssets = options.includeAssets ?? true;
  const signMediaUrls = options.signMediaUrls ?? true;
  const sessionIds = sessionRows.map((row) => row.id);
  const userIds = unique(sessionRows.map((row) => row.user_id));
  const sessionClientIds = unique(sessionRows.map((row) => row.client_id));
  const projectIds = unique(sessionRows.map((row) => row.project_id));
  const templateIds = unique(sessionRows.map((row) => row.template_id));
  const reportIds = unique(sessionRows.map((row) => row.report_id));
  const samplingPointIds = unique(sessionRows.map((row) => row.current_sampling_point_id));

  const [
    usersResult,
    projectsResult,
    templatesResult,
    reportsResult,
    messagesResult,
    assetsResult,
    samplingPointsResult,
  ] = await Promise.all([
    userIds.length > 0
      ? supabase
          .from("platform_users")
          .select("id, name, email, phone, app_role, onboarding_status, is_active")
          .in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length > 0
      ? supabase
          .from("omie_projects_mirror")
          .select(
            "id, client_id, nome, empreendimento_nome, empreendimento_endereco, empreendimento_cidade, empreendimento_estado, latitude, longitude, numero_contrato, status"
          )
          .in("id", projectIds)
      : Promise.resolve({ data: [], error: null }),
    templateIds.length > 0
      ? supabase
          .from("report_templates")
          .select("id, code, name, category, description")
          .in("id", templateIds)
      : Promise.resolve({ data: [], error: null }),
    reportIds.length > 0
      ? supabase
          .from("reports")
          .select("id, report_number, title, status, updated_at")
          .in("id", reportIds)
      : Promise.resolve({ data: [], error: null }),
    includeMessages && sessionIds.length > 0
      ? supabase
          .from("intake_messages")
          .select(fullMessageSelect)
          .in("session_id", sessionIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    includeAssets && sessionIds.length > 0
      ? supabase
          .from("intake_assets")
          .select((signMediaUrls ? fullAssetSelect : summaryAssetSelect) as string)
          .in("session_id", sessionIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    samplingPointIds.length > 0
      ? supabase
          .from("project_sampling_points")
          .select("id, code, name, description, point_type, point_order")
          .in("id", samplingPointIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const results = [
    usersResult,
    projectsResult,
    templatesResult,
    reportsResult,
    messagesResult,
    assetsResult,
    samplingPointsResult,
  ];

  for (const result of results) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const projects = (projectsResult.data || []) as OmieProjectRow[];
  const clientIds = unique([...sessionClientIds, ...projects.map((row) => row.client_id)]);
  const clientsResult =
    clientIds.length > 0
      ? await supabase
          .from("omie_clients_mirror")
          .select(
            "id, razao_social, nome_fantasia, cnpj, email, telefone, contato_nome, contato_email, contato_telefone"
          )
          .in("id", clientIds)
      : { data: [], error: null };

  if (clientsResult.error) {
    throw new Error(clientsResult.error.message);
  }

  const usersById = new Map(
    ((usersResult.data || []) as PlatformUserRow[]).map((row) => [row.id, row])
  );
  const templatesById = new Map(
    ((templatesResult.data || []) as TemplateRow[]).map((row) => [row.id, row])
  );
  const reportsById = new Map(
    ((reportsResult.data || []) as ReportRow[]).map((row) => [row.id, row])
  );
  const clientsById = new Map(
    ((clientsResult.data || []) as OmieClientRow[]).map((row) => [row.id, row])
  );
  const projectsById = new Map(
    projects.map((row) => [
      row.id,
      {
        ...row,
        client: clientsById.get(row.client_id) || null,
      },
    ])
  );
  const samplingPointsById = new Map(
    ((samplingPointsResult.data || []) as SamplingPointRow[]).map((row) => [row.id, row])
  );

  const signedUrlCache: SignedUrlCache = new Map();
  const messages = (messagesResult.data || []) as IntakeMessageRow[];
  const assets = ((assetsResult.data || []) as unknown) as IntakeAssetRow[];

  const signedMessages = signMediaUrls
    ? await Promise.all(
        messages.map(async (message) => ({
          ...message,
          media_signed_url: await createSignedStorageUrl(
            message.media_storage_path || message.media_url,
            "intake-assets",
            signedUrlCache
          ),
        }))
      )
    : messages;
  const signedAssets = signMediaUrls
    ? await Promise.all(
        assets.map(async (asset) => ({
          ...asset,
          signed_url: await createSignedStorageUrl(
            asset.storage_path,
            asset.storage_bucket || "intake-assets",
            signedUrlCache
          ),
        }))
      )
    : assets;

  const messagesBySession = new Map<string, IntakeMessageRow[]>();
  for (const message of signedMessages) {
    const current = messagesBySession.get(message.session_id) || [];
    current.push(message);
    messagesBySession.set(message.session_id, current);
  }

  const assetsBySession = new Map<string, IntakeAssetRow[]>();
  for (const asset of signedAssets) {
    const sessionId = asset.session_id;
    if (!sessionId) {
      continue;
    }

    const current = assetsBySession.get(sessionId) || [];
    current.push(asset);
    assetsBySession.set(sessionId, current);
  }

  return sessionRows.map((session) => ({
    ...session,
    user: usersById.get(session.user_id) || null,
    client: session.client_id ? clientsById.get(session.client_id) || null : null,
    project: session.project_id ? projectsById.get(session.project_id) || null : null,
    template: session.template_id ? templatesById.get(session.template_id) || null : null,
    report: session.report_id ? reportsById.get(session.report_id) || null : null,
    current_sampling_point: session.current_sampling_point_id
      ? samplingPointsById.get(session.current_sampling_point_id) || null
      : null,
    messages: messagesBySession.get(session.id) || [],
    assets: assetsBySession.get(session.id) || [],
  }));
}

function buildWebhookIngestResponse(args: {
  accepted: boolean;
  known_user: boolean;
  senderPhone: string;
  user?: PlatformUserRow | null;
  session?: IntakeSessionRow | null;
  messageId?: string | null;
  messageIsNew?: boolean;
  outboundText?: string | null;
  sendReply?: boolean;
  askPhotoDescriptionNow?: boolean;
  reason?: string | null;
}) {
  return {
    accepted: args.accepted,
    known_user: args.known_user,
    reason: args.reason || null,
    session_id: args.session?.id || null,
    message_id: args.messageId || null,
    message_is_new: args.messageIsNew ?? false,
    ask_photo_description_now: args.askPhotoDescriptionNow ?? false,
    send_reply: args.sendReply ?? Boolean(args.outboundText),
    recipient_phone: args.senderPhone,
    outbound_text: args.outboundText || null,
    client_id: args.session?.client_id || null,
    project_id: args.session?.project_id || null,
    current_step: args.session?.current_step || null,
    report_action: getContextData(args.session?.context_data).report_action || null,
    user: args.user?.id
      ? {
          id: args.user.id,
          full_name: args.user.full_name || args.user.name || args.user.email || null,
        }
      : null,
  };
}

router.post("/webhook-ingest", async (req, res) => {
  const payload = (req.body || {}) as IntakeWebhookPayload;
  const senderPhone = normalizeText(payload.sender_phone);
  const messageType = normalizeText(payload.message_type);
  const messageText = normalizeText(payload.text_content);

  if (!senderPhone || !messageType) {
    res.status(400).json({
      error: "sender_phone e message_type sao obrigatorios.",
    });
    return;
  }

  try {
    const user = await findActivePlatformUserByPhone(senderPhone);
    const whatsappFirstName = getTechnicianFirstName(null, payload.sender_name);

    if (!user?.id) {
      res.json(
        buildWebhookIngestResponse({
          accepted: false,
          known_user: false,
          senderPhone,
          reason: "unknown_user",
          outboundText: `${buildGreeting(whatsappFirstName)} Seu numero nao esta cadastrado na plataforma Elementus. Fale com o administrador para liberar o acesso.`,
          sendReply: true,
        })
      );
      return;
    }

    const technicianFirstName = getTechnicianFirstName(user, payload.sender_name);
    const requestedReportAction = resolveReportAction(messageText);
    const existingMessage = await findExistingWhatsappMessage(
      normalizeText(payload.whatsapp_message_id)
    );

    let session = existingMessage?.session_id
      ? await getSessionById(existingMessage.session_id)
      : null;
    let messageId = existingMessage?.id || null;
    let messageIsNew = false;
    let outboundText: string | null = null;
    let replyReason: string | null = null;
    let askPhotoDescriptionNow = false;

    if (!session) {
      const activeSessions = await findOpenSessionsForUser(user.id);
      const recentChoiceSession = await findRecentSessionChoiceSession(user.id);

      if (recentChoiceSession) {
        const choiceContext = getContextData(recentChoiceSession.context_data);
        const optionIds = normalizeStringArray(choiceContext.whatsapp_session_options);
        const normalizedChoice = normalizeComparableText(messageText);

        if (requestedReportAction === "new_report") {
          await clearSessionChoiceOptions(user.id);

          const newSession = await createOpenSession(user.id, senderPhone);
          session = await selectReportActionForSession(newSession, "new_report");
          const insertedMessage = await insertInboundMessage(session.id, payload);
          messageId = insertedMessage.id;
          messageIsNew = true;
          await touchSession(session.id);

          outboundText = addressMessage(
            technicianFirstName,
            "Perfeito. Vamos construir um novo relatório. Qual é o cliente deste relatório?"
          );
          replyReason = "new_session_started";
          await logOutboundMessage(session.id, outboundText, "client_request");

          res.json(
            buildWebhookIngestResponse({
              accepted: true,
              known_user: true,
              senderPhone,
              user,
              session,
              messageId,
              messageIsNew,
              outboundText,
              sendReply: true,
              askPhotoDescriptionNow: false,
              reason: replyReason,
            })
          );
          return;
        }

        if (/^[0-9]+$/.test(normalizedChoice)) {
          const selectedIndex = Number(normalizedChoice) - 1;
          const selectedSessionId = optionIds[selectedIndex];

          if (selectedSessionId) {
            const selectedSession = await getSessionById(selectedSessionId);

            if (selectedSession) {
              await clearSessionChoiceOptions(user.id);

              const insertedMessage = await insertInboundMessage(selectedSession.id, payload);
              messageId = insertedMessage.id;
              messageIsNew = true;
              await touchSession(selectedSession.id);
              session = (await getSessionById(selectedSession.id)) || selectedSession;
              outboundText = await buildSessionResumeText(session, technicianFirstName);
              replyReason = "session_resumed";
              await logOutboundMessage(session.id, outboundText, "session_resumed");

              res.json(
                buildWebhookIngestResponse({
                  accepted: true,
                  known_user: true,
                  senderPhone,
                  user,
                  session,
                  messageId,
                  messageIsNew,
                  outboundText,
                  sendReply: true,
                  askPhotoDescriptionNow: false,
                  reason: replyReason,
                })
              );
              return;
            }
          }

          const insertedMessage = await insertInboundMessage(recentChoiceSession.id, payload);
          messageId = insertedMessage.id;
          messageIsNew = true;
          outboundText = await buildSessionChoiceText(technicianFirstName, activeSessions);
          replyReason = "session_choice_invalid";
          await logOutboundMessage(recentChoiceSession.id, outboundText, "session_choice_request");

          res.json(
            buildWebhookIngestResponse({
              accepted: true,
              known_user: true,
              senderPhone,
              user,
              session: recentChoiceSession,
              messageId,
              messageIsNew,
              outboundText,
              sendReply: true,
              askPhotoDescriptionNow: false,
              reason: replyReason,
            })
          );
          return;
        }
      }

      if (requestedReportAction === "new_report" && activeSessions.length > 0) {
        await clearSessionChoiceOptions(user.id);
        const newSession = await createOpenSession(user.id, senderPhone);
        session = await selectReportActionForSession(newSession, "new_report");
        const insertedMessage = await insertInboundMessage(session.id, payload);
        messageId = insertedMessage.id;
        messageIsNew = true;
        await touchSession(session.id);

        outboundText = addressMessage(
          technicianFirstName,
          "Perfeito. Vamos construir um novo relatório. Qual é o cliente deste relatório?"
        );
        replyReason = "new_session_started";
        await logOutboundMessage(session.id, outboundText, "client_request");

        res.json(
          buildWebhookIngestResponse({
            accepted: true,
            known_user: true,
            senderPhone,
            user,
            session,
            messageId,
            messageIsNew,
            outboundText,
            sendReply: true,
            askPhotoDescriptionNow: false,
            reason: replyReason,
          })
        );
        return;
      }

      const shouldAskSessionChoice =
        activeSessions.length > 1 ||
        (activeSessions.length === 1 &&
          (isSessionMenuRequest(messageText) ||
            requestedReportAction === "edit_report" ||
            activeSessions[0].status === "ready_for_draft"));

      if (shouldAskSessionChoice) {
        const routerSession = activeSessions[0];
        const optionIds = activeSessions.map((activeSession) => activeSession.id);
        session = await updateSession(routerSession.id, {
          context_data: {
            ...getContextData(routerSession.context_data),
            whatsapp_session_options: optionIds,
            whatsapp_session_options_at: new Date().toISOString(),
          },
        });
        const insertedMessage = await insertInboundMessage(session.id, payload);
        messageId = insertedMessage.id;
        messageIsNew = true;
        outboundText = await buildSessionChoiceText(technicianFirstName, activeSessions);
        replyReason = "session_choice_required";
        await logOutboundMessage(session.id, outboundText, "session_choice_request");

        res.json(
          buildWebhookIngestResponse({
            accepted: true,
            known_user: true,
            senderPhone,
            user,
            session,
            messageId,
            messageIsNew,
            outboundText,
            sendReply: true,
            askPhotoDescriptionNow: false,
            reason: replyReason,
          })
        );
        return;
      }

      const existingSession = activeSessions[0] || (await findOpenSessionForUser(user.id));
      const shouldStartNewSession =
        !existingSession ||
        (Boolean(requestedReportAction) &&
          existingSession.current_step !== "awaiting_report_action");
      session = shouldStartNewSession
        ? await createOpenSession(user.id, senderPhone)
        : existingSession;
    }

    if (!messageId) {
      const insertedMessage = await insertInboundMessage(session.id, payload);
      messageId = insertedMessage.id;
      messageIsNew = true;

      await touchSession(session.id);
      session = (await getSessionById(session.id)) || session;
    }

    if (!messageIsNew) {
      res.json(
        buildWebhookIngestResponse({
          accepted: true,
          known_user: true,
          senderPhone,
          user,
          session,
          messageId,
          messageIsNew: false,
          outboundText: null,
          sendReply: false,
          askPhotoDescriptionNow: false,
          reason: "duplicate_message",
        })
      );
      return;
    }

    const selectedClient = session.client_id ? await getClientById(session.client_id) : null;
    const contextData = getContextData(session.context_data);
    const activeReportAction = contextData.report_action || null;

    if (!activeReportAction && !session.client_id && !session.project_id) {
      if (requestedReportAction) {
        session = await selectReportActionForSession(session, requestedReportAction);
        outboundText = addressMessage(
          technicianFirstName,
          `Perfeito. Vamos ${getReportActionText(requestedReportAction)}. Qual e o cliente deste relatorio?`
        );
        replyReason = "report_action_selected";
        await logOutboundMessage(session.id, outboundText, "client_request");
      } else {
        session = await setSessionAwaitingReportAction(session);
        outboundText = buildReportActionQuestion(user, payload.sender_name);
        replyReason = "report_action_required";
        await logOutboundMessage(session.id, outboundText, "report_action_request");
      }

      res.json(
        buildWebhookIngestResponse({
          accepted: true,
          known_user: true,
          senderPhone,
          user,
          session,
          messageId,
          messageIsNew,
          outboundText,
          sendReply: Boolean(outboundText),
          askPhotoDescriptionNow: false,
          reason: replyReason,
        })
      );
      return;
    }

    if (!session.client_id) {
      if (session.current_step === "awaiting_client_cnpj") {
        const candidateIds = normalizeStringArray(contextData.pending_client_candidate_ids);
        const cnpjDigits = normalizeDigits(messageText);

        if (messageType !== "text" || !messageText || cnpjDigits.length < 14) {
          outboundText = addressMessage(
            technicianFirstName,
            "Encontrei mais de um cliente com esse nome. Me envie o CNPJ completo do cliente para eu localizar o cadastro certo."
          );
          replyReason = "client_cnpj_required";
          await logOutboundMessage(session.id, outboundText, "client_cnpj_request");
        } else {
          const candidates = await searchClientCandidates(
            messageText,
            candidateIds.length > 0 ? candidateIds : undefined
          );
          const matchedClient = resolveClientMatch(messageText, candidates);

          if (matchedClient && normalizeDigits(matchedClient.cnpj) === cnpjDigits) {
            session = await selectClientForSession(session, matchedClient);
            outboundText = addressMessage(
              technicianFirstName,
              `Perfeito. Cliente identificado: ${getClientDisplayName(matchedClient)}. Qual e o projeto ou contrato deste relatorio?`
            );
            replyReason = "client_selected";
            await logOutboundMessage(session.id, outboundText, "project_request");
          } else {
            const pendingSearchText = normalizeText(contextData.pending_client_search_text) || messageText;
            session = await setSessionAwaitingClientCnpj(session, pendingSearchText, candidates);
            outboundText = addressMessage(
              technicianFirstName,
              "Nao consegui localizar o cliente por esse CNPJ. Me envie o CNPJ completo do cliente para eu confirmar o cadastro correto."
            );
            replyReason = "client_cnpj_not_found";
            await logOutboundMessage(session.id, outboundText, "client_cnpj_request");
          }
        }

        res.json(
          buildWebhookIngestResponse({
            accepted: true,
            known_user: true,
            senderPhone,
            user,
            session,
            messageId,
            messageIsNew,
            outboundText,
            sendReply: Boolean(outboundText),
            askPhotoDescriptionNow: false,
            reason: replyReason,
          })
        );
        return;
      }

      if (session.current_step === "awaiting_client" && messageType === "text" && messageText) {
        const clientCandidates = await searchClientCandidates(messageText);
        const matchedClient = resolveClientMatch(messageText, clientCandidates);

        if (matchedClient) {
          session = await selectClientForSession(session, matchedClient);
          outboundText = addressMessage(
            technicianFirstName,
            `Perfeito. Cliente identificado: ${getClientDisplayName(matchedClient)}. Qual e o projeto ou contrato deste relatorio?`
          );
          replyReason = "client_selected";
          await logOutboundMessage(session.id, outboundText, "project_request");
        } else if (clientCandidates.length > 1) {
          session = await setSessionAwaitingClientCnpj(session, messageText, clientCandidates);
          outboundText = addressMessage(
            technicianFirstName,
            "Encontrei mais de um cliente com esse nome. Me envie o CNPJ completo do cliente para eu localizar o cadastro certo."
          );
          replyReason = "client_cnpj_required";
          await logOutboundMessage(session.id, outboundText, "client_cnpj_request");
        } else {
          session = await setSessionAwaitingClient(session);
          outboundText = addressMessage(
            technicianFirstName,
            "Nao encontrei esse cliente na base da Elementus. Me envie o nome do cliente exatamente como esta no cadastro ou o CNPJ completo."
          );
          replyReason = "client_not_found";
          await logOutboundMessage(session.id, outboundText, "client_request");
        }
      } else {
        session = await setSessionAwaitingClient(session);
        outboundText = addressMessage(
          technicianFirstName,
          "Antes de continuar o relatorio, preciso confirmar o cliente. Qual e o cliente deste relatorio?"
        );
        replyReason = "ask_client";
        await logOutboundMessage(session.id, outboundText, "client_request");
      }

      res.json(
        buildWebhookIngestResponse({
          accepted: true,
          known_user: true,
          senderPhone,
          user,
          session,
          messageId,
          messageIsNew,
          outboundText,
          sendReply: Boolean(outboundText),
          askPhotoDescriptionNow: false,
          reason: replyReason,
        })
      );
      return;
    }

    if (!session.project_id) {
      if (messageType === "text" && messageText) {
        const projectCandidateIds = normalizeStringArray(contextData.pending_project_candidate_ids);
        const projectCandidates = await searchProjectCandidates(
          session.client_id,
          messageText,
          projectCandidateIds.length > 0 ? projectCandidateIds : undefined
        );
        const matchedProject = resolveProjectMatch(messageText, projectCandidates);

        if (matchedProject) {
          session = await selectProjectForSession(session, matchedProject);
          outboundText = buildProjectConfirmedText(
            matchedProject,
            getContextData(session.context_data).report_action || activeReportAction,
            technicianFirstName
          );
          replyReason = "project_selected";
          await logOutboundMessage(session.id, outboundText, "intake_start");
        } else if (projectCandidates.length > 1 && selectedClient) {
          session = await setSessionAwaitingProjectClarification(
            session,
            messageText,
            projectCandidates
          );
          outboundText = buildProjectClarificationText(
            selectedClient,
            projectCandidates,
            technicianFirstName
          );
          replyReason = "project_clarification_required";
          await logOutboundMessage(session.id, outboundText, "project_request");
        } else {
          session = await setSessionAwaitingProject(session);
          outboundText = addressMessage(
            technicianFirstName,
            selectedClient
              ? `Nao encontrei um projeto valido para ${getClientDisplayName(selectedClient)}. Qual e o projeto ou contrato deste relatorio?`
              : "Qual e o projeto ou contrato deste relatorio?"
          );
          replyReason = "project_not_found";
          await logOutboundMessage(session.id, outboundText, "project_request");
        }
      } else {
        session = await setSessionAwaitingProject(session);
        outboundText = addressMessage(
          technicianFirstName,
          "Qual e o projeto ou contrato deste relatorio?"
        );
        replyReason = "ask_project";
        await logOutboundMessage(session.id, outboundText, "project_request");
      }

      res.json(
        buildWebhookIngestResponse({
          accepted: true,
          known_user: true,
          senderPhone,
          user,
          session,
          messageId,
          messageIsNew,
          outboundText,
          sendReply: Boolean(outboundText),
          askPhotoDescriptionNow: false,
          reason: replyReason,
        })
      );
      return;
    }

    if (
      normalizeBoolean(payload.is_photo_without_caption) &&
      messageIsNew &&
      messageId
    ) {
      const enqueueResult = await enqueuePhotoDescription(session.id, messageId);
      askPhotoDescriptionNow = Boolean(enqueueResult?.should_ask_now);

      if (askPhotoDescriptionNow) {
        outboundText = addressMessage(
          technicianFirstName,
          "Recebi sua foto. Me conta: o que e essa imagem? (pode responder em texto ou audio)"
        );
        replyReason = "photo_description_request";
        await logOutboundPhotoPrompt(session.id, outboundText);
      }
    }

    res.json(
      buildWebhookIngestResponse({
        accepted: true,
        known_user: true,
        senderPhone,
        user,
        session,
        messageId,
        messageIsNew,
        outboundText,
        sendReply: Boolean(outboundText),
        askPhotoDescriptionNow,
        reason: replyReason,
      })
    );
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel processar a entrada do webhook.",
    });
  }
});

router.get("/media-proxy", async (req, res) => {
  const rawUrl = normalizeText(req.query.url);

  if (!rawUrl || !isWhatsAppMediaUrl(rawUrl)) {
    res.status(400).json({ error: "URL de mídia não permitida." });
    return;
  }

  try {
    const intakeMessage = await findIntakeMessageForMediaUrl(rawUrl);

    if (intakeMessage) {
      const media = await materializeWhatsappMediaForMessage(intakeMessage, rawUrl);

      res
        .status(200)
        .setHeader("Content-Type", media.mimeType)
        .setHeader("Cache-Control", "no-store")
        .send(media.buffer);
      return;
    }

    const response = await fetch(rawUrl, {
      headers: {
        "User-Agent": "ElementusRelatorios/0.1 contato@elementus-sa.com.br",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      res.status(response.status).json({ error: "Não foi possível baixar a mídia." });
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!isReadableImageBuffer(buffer)) {
      res.status(422).json({
        error:
          "A mídia do WhatsApp está criptografada. Envie o payload da Evolution para a API salvar a imagem descriptografada.",
      });
      return;
    }

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
    const mimeType =
      contentType && contentType !== "application/octet-stream" ? contentType : "image/jpeg";

    res
      .status(200)
      .setHeader("Content-Type", mimeType)
      .setHeader("Cache-Control", "no-store")
      .send(buffer);
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Falha ao carregar a mídia.",
    });
  }
});

router.get("/sessions", async (req, res) => {
  const summaryMode = ["1", "true", "yes", "summary"].includes(
    String(req.query.summary || req.query.view || "").toLowerCase()
  );
  const includeArchived = ["1", "true", "yes", "all"].includes(
    String(req.query.include_archived || req.query.include_closed || "").toLowerCase()
  );
  const query = supabase
    .from("intake_sessions")
    .select(intakeSessionSelect)
    .order("updated_at", { ascending: false })
    .limit(getLimit(req.query.limit));

  if (req.query.status) {
    query.eq("status", req.query.status);
  } else if (!includeArchived) {
    query.in("status", activeIntakeStatuses);
  }

  if (req.query.user_id) {
    query.eq("user_id", req.query.user_id);
  }

  if (req.query.project_id) {
    query.eq("project_id", req.query.project_id);
  }

  if (req.query.phone) {
    query.eq("phone", req.query.phone);
  }

  if (req.query.report_id) {
    query.eq("report_id", req.query.report_id);
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  try {
    const bundle = await loadSessionBundle(
      (data || []) as IntakeSessionRow[],
      summaryMode
        ? {
            includeMessages: false,
            includeAssets: true,
            signMediaUrls: false,
          }
        : undefined
    );
    res.setHeader("Cache-Control", summaryMode ? "private, max-age=10" : "no-store");
    res.json(bundle);
  } catch (bundleError) {
    res.status(500).json({
      error:
        bundleError instanceof Error
          ? bundleError.message
          : "Nao foi possivel montar a fila de intake.",
    });
  }
});

router.get("/sessions/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("intake_sessions")
    .select(intakeSessionSelect)
    .eq("id", req.params.id)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!data) {
    res.status(404).json({ error: "Sessao de intake nao encontrada." });
    return;
  }

  try {
    const [session] = await loadSessionBundle([data as IntakeSessionRow]);
    res.json(session);
  } catch (bundleError) {
    res.status(500).json({
      error:
        bundleError instanceof Error
          ? bundleError.message
          : "Nao foi possivel carregar a sessao de intake.",
    });
  }
});

router.patch("/sessions/:id", async (req, res) => {
  const payload = {
    ...req.body,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("intake_sessions")
    .update(payload)
    .eq("id", req.params.id)
    .select(intakeSessionSelect)
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  try {
    const [session] = await loadSessionBundle([data as IntakeSessionRow]);
    res.json(session);
  } catch (bundleError) {
    res.status(500).json({
      error:
        bundleError instanceof Error
          ? bundleError.message
          : "Nao foi possivel carregar a sessao atualizada.",
    });
  }
});

router.delete("/sessions/:id", async (req, res) => {
  const now = new Date().toISOString();
  const deleteLinkedReport = ["1", "true", "yes"].includes(
    String(req.query.delete_report || req.body?.delete_report || "").toLowerCase()
  );

  const { data: session, error: fetchError } = await supabase
    .from("intake_sessions")
    .select(intakeSessionSelect)
    .eq("id", req.params.id)
    .maybeSingle();

  if (fetchError) {
    res.status(500).json({ error: fetchError.message });
    return;
  }

  if (!session) {
    res.status(404).json({ error: "Sessao de intake nao encontrada." });
    return;
  }

  const intakeSession = session as IntakeSessionRow;
  let reportCleanup: Awaited<ReturnType<typeof deleteReportCascade>> | null = null;

  try {
    if (deleteLinkedReport && intakeSession.report_id) {
      reportCleanup = await deleteReportCascade(intakeSession.report_id, {
        abandonLinkedSessions: true,
      });
    }

    const context = getContextData(intakeSession.context_data);
    const { data, error } = await supabase
      .from("intake_sessions")
      .update({
        status: "abandoned",
        current_step: "discarded_from_platform",
        processing_locked_until: null,
        context_data: {
          ...context,
          discarded_at: now,
          discarded_from_platform: true,
          discarded_report_id: intakeSession.report_id || null,
          linked_report_deleted: Boolean(reportCleanup?.reportDeleted),
        },
        closed_at: now,
        updated_at: now,
      })
      .eq("id", req.params.id)
      .select(intakeSessionSelect)
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      ok: true,
      session: data,
      report_cleanup: reportCleanup,
    });
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel descartar o atendimento.",
    });
  }
});

export default router;
