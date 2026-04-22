import { Router } from "express";
import { supabase } from "../lib/supabase.js";

const router: import("express").Router = Router();

type IntakeSessionRow = {
  id: string;
  user_id: string;
  phone: string;
  report_id?: string | null;
  project_id?: string | null;
  template_id?: string | null;
  active_campaign_id?: string | null;
  current_sampling_point_id?: string | null;
  status: string;
  current_step?: string | null;
  missing_fields?: unknown;
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
  media_mime_type?: string | null;
  media_size_bytes?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  audio_transcription?: string | null;
  ai_extracted_data?: unknown;
  created_at: string;
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
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  app_role?: string | null;
  onboarding_status?: string | null;
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

async function loadSessionBundle(sessionRows: IntakeSessionRow[]) {
  const sessionIds = sessionRows.map((row) => row.id);
  const userIds = unique(sessionRows.map((row) => row.user_id));
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
    sessionIds.length > 0
      ? supabase
          .from("intake_messages")
          .select(
            "id, session_id, whatsapp_message_id, direction, sender_phone, sender_name, message_type, text_content, caption, media_url, media_storage_path, media_mime_type, media_size_bytes, latitude, longitude, audio_transcription, ai_extracted_data, created_at"
          )
          .in("session_id", sessionIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    sessionIds.length > 0
      ? supabase
          .from("intake_assets")
          .select(
            "id, session_id, message_id, report_id, campaign_id, sampling_point_id, asset_type, storage_path, storage_bucket, file_size_bytes, mime_type, caption, ai_suggested_caption, suggested_section_code, confirmed_section_code, suggested_figure_role, figure_number, latitude, longitude, captured_at, included_in_report, display_order, created_at, updated_at"
          )
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
  const clientIds = unique(projects.map((row) => row.client_id));
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

  const messagesBySession = new Map<string, IntakeMessageRow[]>();
  for (const message of (messagesResult.data || []) as IntakeMessageRow[]) {
    const current = messagesBySession.get(message.session_id) || [];
    current.push(message);
    messagesBySession.set(message.session_id, current);
  }

  const assetsBySession = new Map<string, IntakeAssetRow[]>();
  for (const asset of (assetsResult.data || []) as IntakeAssetRow[]) {
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

router.get("/sessions", async (req, res) => {
  const query = supabase
    .from("intake_sessions")
    .select(
      "id, user_id, phone, report_id, project_id, template_id, active_campaign_id, current_sampling_point_id, status, current_step, missing_fields, last_question, last_question_at, last_message_at, processing_locked_until, created_at, updated_at, closed_at"
    )
    .order("updated_at", { ascending: false })
    .limit(getLimit(req.query.limit));

  if (req.query.status) {
    query.eq("status", req.query.status);
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
    const bundle = await loadSessionBundle((data || []) as IntakeSessionRow[]);
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
    .select(
      "id, user_id, phone, report_id, project_id, template_id, active_campaign_id, current_sampling_point_id, status, current_step, missing_fields, last_question, last_question_at, last_message_at, processing_locked_until, created_at, updated_at, closed_at"
    )
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
    .select(
      "id, user_id, phone, report_id, project_id, template_id, active_campaign_id, current_sampling_point_id, status, current_step, missing_fields, last_question, last_question_at, last_message_at, processing_locked_until, created_at, updated_at, closed_at"
    )
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

export default router;
