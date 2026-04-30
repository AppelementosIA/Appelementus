import type { ReportGeneratedData, ReportSignerSnapshot, SignatureStatus } from "@elementus/shared";
import { Router } from "express";
import {
  buildReportDocxBuffer,
  buildReportDocxFileName,
  extractReportAttachments,
  type ReportDocumentSource,
} from "../lib/report-documents.js";
import { triggerFinalReportRagWorkflow, triggerReportGenerationWorkflow } from "../lib/n8n.js";
import { ensureMicrosoftFolder, uploadFileToMicrosoftFolder } from "../lib/microsoft-graph.js";
import { deleteReportCascade } from "../lib/report-cleanup.js";
import { supabase } from "../lib/supabase.js";
import { renderTemplateDocx } from "../lib/template-docx-renderer.js";

const router: import("express").Router = Router();

const reportSelect =
  "*, projects(id, name, client_name, enterprise), report_templates(id, name, type, template_url)";

const reportSignerSelect = `
  id,
  report_id,
  user_id,
  name_snapshot,
  role_snapshot,
  registry_type_snapshot,
  registry_number_snapshot,
  signature_name_snapshot,
  signature_data_url_snapshot,
  signature_status_snapshot,
  created_at,
  updated_at
`;

function buildGeneratedData(body: {
  generated_data?: Partial<ReportGeneratedData>;
  variables?: Record<string, unknown>;
  sections?: ReportGeneratedData["sections"];
  charts?: ReportGeneratedData["charts"];
  tables?: ReportGeneratedData["tables"];
  metadata?: Record<string, unknown>;
}) {
  return {
    variables: body.variables ?? body.generated_data?.variables ?? {},
    sections: body.sections ?? body.generated_data?.sections ?? [],
    charts: body.charts ?? body.generated_data?.charts ?? [],
    tables: body.tables ?? body.generated_data?.tables ?? [],
    metadata: body.metadata ?? body.generated_data?.metadata ?? {},
  } satisfies ReportGeneratedData;
}

function getReportFolderPath(report: ReportDocumentSource) {
  const variables = (report.generated_data?.variables || {}) as Record<string, unknown>;
  const explicitFolder = variables.microsoft365_folder;

  if (typeof explicitFolder === "string" && explicitFolder.trim()) {
    return explicitFolder.trim();
  }

  const clientName = report.projects?.client_name || "Cliente";
  const enterprise = report.projects?.enterprise || "Empreendimento";
  return `Clientes/${clientName}/${enterprise}/Relatorios`;
}

function mergeGeneratedData(
  base: ReportGeneratedData | undefined,
  patch: Partial<ReportGeneratedData> & {
    variables?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
) {
  return {
    sections: patch.sections ?? base?.sections ?? [],
    charts: patch.charts ?? base?.charts ?? [],
    tables: patch.tables ?? base?.tables ?? [],
    variables: {
      ...(base?.variables || {}),
      ...(patch.variables || {}),
    },
    metadata: {
      ...(base?.metadata || {}),
      ...(patch.metadata || {}),
    },
  } satisfies ReportGeneratedData;
}

const workflowStages = new Set(["entrada", "montagem", "relatorio", "imagens", "envio"]);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const templateCodeByUiId: Record<string, string> = {
  "template-implantacao": "implantacao_florestal",
  "template-monitoramento": "operacao_rotina_simples",
  "template-condicionantes": "operacao_rotina_simples",
  "template-operacao-rotina-simples": "operacao_rotina_simples",
  "template-supervisao-ambiental-rodovia": "supervisao_ambiental_rodovia",
  "template-manutencao-cinturao-verde": "manutencao_cinturao_verde",
};

function normalizeTemplateCode(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^template-/, "")
    .replace(/-/g, "_");
}

async function resolveReportTemplateId(templateId?: string | null, reportType?: string | null) {
  const requested = String(templateId || "").trim();
  const requestedNormalized = normalizeTemplateCode(requested);
  const mappedCode = templateCodeByUiId[requested.toLowerCase()] || requestedNormalized;
  const { data, error } = await supabase
    .from("report_templates")
    .select("id, code, type, active")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const templates = (data || []) as Array<{
    id: string;
    code?: string | null;
    type?: string | null;
    active?: boolean | null;
  }>;
  const exact =
    templates.find((template) => template.id === requested) ||
    templates.find((template) => normalizeTemplateCode(template.code) === requestedNormalized) ||
    templates.find((template) => normalizeTemplateCode(template.code) === mappedCode) ||
    templates.find((template) => reportType && template.type === reportType) ||
    templates.find((template) => template.active !== false) ||
    templates[0];

  if (!exact?.id) {
    throw new Error("Template de relatorio nao encontrado para salvar a minuta.");
  }

  return exact.id;
}

function getOmieClientName(client: unknown) {
  const row = Array.isArray(client) ? client[0] : client;

  if (!row || typeof row !== "object") {
    return "Cliente";
  }

  const record = row as Record<string, unknown>;
  return String(record.nome_fantasia || record.razao_social || "Cliente");
}

async function ensureReportProjectId(projectId?: string | null) {
  const requestedProjectId = String(projectId || "").trim();

  if (!uuidPattern.test(requestedProjectId)) {
    throw new Error("Projeto invalido para salvar o relatorio.");
  }

  const { data: existingProject, error: existingProjectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", requestedProjectId)
    .maybeSingle();

  if (existingProjectError) {
    throw new Error(existingProjectError.message);
  }

  if (existingProject?.id) {
    return existingProject.id as string;
  }

  const { data: omieProject, error: omieProjectError } = await supabase
    .from("omie_projects_mirror")
    .select(
      "id, nome, empreendimento_nome, empreendimento_cidade, empreendimento_estado, status, numero_contrato, raw_omie_payload, omie_clients_mirror(razao_social, nome_fantasia)"
    )
    .eq("id", requestedProjectId)
    .maybeSingle();

  if (omieProjectError) {
    throw new Error(omieProjectError.message);
  }

  if (!omieProject) {
    throw new Error("Projeto nao encontrado no ERP/Omie para salvar o relatorio.");
  }

  const project = omieProject as Record<string, unknown>;
  const name = String(project.nome || "Projeto Omie");
  const enterprise = String(project.empreendimento_nome || project.nome || "Empreendimento");
  const cityState = [project.empreendimento_cidade, project.empreendimento_estado]
    .filter(Boolean)
    .join(" - ");
  const { data: insertedProject, error: insertProjectError } = await supabase
    .from("projects")
    .insert({
      id: requestedProjectId,
      name,
      client_name: getOmieClientName(project.omie_clients_mirror),
      enterprise,
      description: cityState || null,
      environmental_permit: null,
      condicionante: project.numero_contrato ? String(project.numero_contrato) : null,
      organ: "OTHER",
      status: project.status === "active" ? "active" : "paused",
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertProjectError) {
    throw new Error(insertProjectError.message);
  }

  return insertedProject.id as string;
}

async function buildReportPersistencePayload(body: {
  template_id?: string;
  project_id?: string;
  campaign_id?: string | null;
  title?: string;
  report_number?: string;
  type?: string;
  status?: string;
  version?: number;
  variables?: Record<string, unknown>;
  sections?: ReportGeneratedData["sections"];
  charts?: ReportGeneratedData["charts"];
  tables?: ReportGeneratedData["tables"];
  generated_data?: Partial<ReportGeneratedData>;
  metadata?: Record<string, unknown>;
}) {
  const generatedData = buildGeneratedData({
    generated_data: body.generated_data,
    variables: body.variables,
    sections: body.sections,
    charts: body.charts,
    tables: body.tables,
    metadata: body.metadata,
  });
  const type = body.type || String(body.variables?.type || "quarterly_monitoring");

  return {
    template_id: await resolveReportTemplateId(body.template_id, type),
    project_id: await ensureReportProjectId(body.project_id),
    campaign_id: body.campaign_id || null,
    status: body.status || "draft",
    title: body.title || String(body.variables?.title || "Relatorio"),
    report_number: body.report_number || String(body.variables?.report_number || ""),
    type,
    version: body.version || 1,
    generated_data: generatedData,
  };
}

async function fetchReportStageSnapshots(reportId: string) {
  const { data, error } = await supabase
    .from("report_stage_snapshots")
    .select("*")
    .eq("report_id", reportId)
    .order("completed_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as Array<Record<string, unknown>>;
}

async function tryFetchReportStageSnapshots(reportId: string) {
  try {
    return await fetchReportStageSnapshots(reportId);
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
}

async function upsertReportStageSnapshot(input: {
  reportId: string;
  stage: string;
  payload: Record<string, unknown>;
  advancedToStage?: string | null;
  completedBy?: string | null;
}) {
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("report_stage_snapshots")
    .select("revision")
    .eq("report_id", input.reportId)
    .eq("stage", input.stage)
    .maybeSingle();
  const nextRevision =
    typeof existing?.revision === "number" ? existing.revision + 1 : 1;

  const { data, error } = await supabase
    .from("report_stage_snapshots")
    .upsert(
      {
        report_id: input.reportId,
        stage: input.stage,
        status: "completed",
        revision: nextRevision,
        payload: input.payload,
        advanced_to_stage: input.advancedToStage || null,
        completed_by: input.completedBy || null,
        completed_at: now,
        updated_at: now,
      },
      { onConflict: "report_id,stage" }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Record<string, unknown>;
}

async function markReportStageMetadata(input: {
  reportId: string;
  generatedData: ReportGeneratedData | undefined;
  stage: string;
  payload: Record<string, unknown>;
  advancedToStage?: string | null;
  snapshotStored: boolean;
}) {
  const stageSnapshots =
    input.generatedData?.metadata?.stage_snapshots &&
    typeof input.generatedData.metadata.stage_snapshots === "object" &&
    !Array.isArray(input.generatedData.metadata.stage_snapshots)
      ? (input.generatedData.metadata.stage_snapshots as Record<string, unknown>)
      : {};
  const stagePayloads =
    input.generatedData?.metadata?.stage_payloads &&
    typeof input.generatedData.metadata.stage_payloads === "object" &&
    !Array.isArray(input.generatedData.metadata.stage_payloads)
      ? (input.generatedData.metadata.stage_payloads as Record<string, unknown>)
      : {};
  const nextGeneratedData = mergeGeneratedData(input.generatedData, {
    metadata: {
      stage_snapshots: {
        ...stageSnapshots,
        [input.stage]: {
          status: "completed",
          completed_at: new Date().toISOString(),
          advanced_to_stage: input.advancedToStage || null,
          stored_in_table: input.snapshotStored,
        },
      },
      stage_payloads: input.snapshotStored
        ? stagePayloads
        : {
            ...stagePayloads,
            [input.stage]: input.payload,
          },
    },
  });

  await supabase
    .from("reports")
    .update({
      generated_data: nextGeneratedData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.reportId);

  return nextGeneratedData;
}

async function fetchReportById(reportId: string) {
  const { data, error } = await supabase
    .from("reports")
    .select(reportSelect)
    .eq("id", reportId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ReportDocumentSource & {
    project_id: string;
    campaign_id?: string | null;
    template_id: string;
    status: string;
    docx_url?: string | null;
    pdf_url?: string | null;
  };
}

function mapReportSigner(row: Record<string, unknown>): ReportSignerSnapshot {
  return {
    id: String(row.id),
    report_id: String(row.report_id),
    user_id: row.user_id ? String(row.user_id) : null,
    name_snapshot: String(row.name_snapshot || ""),
    role_snapshot: row.role_snapshot ? String(row.role_snapshot) : null,
    registry_type_snapshot: row.registry_type_snapshot ? String(row.registry_type_snapshot) : null,
    registry_number_snapshot: row.registry_number_snapshot
      ? String(row.registry_number_snapshot)
      : null,
    signature_name_snapshot: row.signature_name_snapshot
      ? String(row.signature_name_snapshot)
      : null,
    signature_data_url_snapshot: row.signature_data_url_snapshot
      ? String(row.signature_data_url_snapshot)
      : null,
    signature_status_snapshot: (row.signature_status_snapshot || "missing") as SignatureStatus,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function fetchReportSigners(reportId: string) {
  const { data, error } = await supabase
    .from("report_signers")
    .select(reportSignerSelect)
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as Record<string, unknown>[]).map(mapReportSigner);
}

router.get("/", async (req, res) => {
  const query = supabase
    .from("reports")
    .select(reportSelect)
    .order("created_at", { ascending: false });

  if (req.query.project_id) {
    query.eq("project_id", req.query.project_id);
  }
  if (req.query.status) {
    query.eq("status", req.query.status);
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
});

router.get("/:id/signers", async (req, res) => {
  try {
    const signers = await fetchReportSigners(req.params.id);
    res.json(signers);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Nao foi possivel carregar as assinaturas.",
    });
  }
});

router.put("/:id/signers", async (req, res) => {
  const userIds: string[] = Array.isArray(req.body.user_ids)
    ? req.body.user_ids.filter((value: unknown): value is string => typeof value === "string")
    : [];
  const uniqueUserIds: string[] = Array.from(new Set(userIds));
  const now = new Date().toISOString();

  try {
    const report = await fetchReportById(req.params.id);

    if (uniqueUserIds.length === 0) {
      const { error: deleteError } = await supabase
        .from("report_signers")
        .delete()
        .eq("report_id", req.params.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      const nextGeneratedData = mergeGeneratedData(report.generated_data, {
        variables: {
          report_signers: [],
        },
      });

      await supabase
        .from("reports")
        .update({
          generated_data: nextGeneratedData,
          updated_at: now,
        })
        .eq("id", req.params.id);

      res.json([]);
      return;
    }

    const { data: users, error: usersError } = await supabase
      .from("platform_users")
      .select(
        `
          id,
          name,
          app_role,
          is_active,
          onboarding_status,
          platform_user_profiles (
            professional_role,
            registry_type,
            registry_number,
            can_sign_reports,
            signature_name,
            signature_data_url,
            signature_status
          )
        `
      )
      .in("id", uniqueUserIds);

    if (usersError) {
      throw new Error(usersError.message);
    }

    const usersById = new Map((users || []).map((user) => [String(user.id), user]));
    const rows = uniqueUserIds.map((userId) => {
      const user = usersById.get(userId) as
        | {
            id: string;
            name: string;
            app_role: string;
            is_active: boolean;
            onboarding_status: string;
            platform_user_profiles?: Array<{
              professional_role?: string | null;
              registry_type?: string | null;
              registry_number?: string | null;
              can_sign_reports?: boolean | null;
              signature_name?: string | null;
              signature_data_url?: string | null;
              signature_status?: SignatureStatus | null;
            }> | {
              professional_role?: string | null;
              registry_type?: string | null;
              registry_number?: string | null;
              can_sign_reports?: boolean | null;
              signature_name?: string | null;
              signature_data_url?: string | null;
              signature_status?: SignatureStatus | null;
            } | null;
          }
        | undefined;
      const profile = Array.isArray(user?.platform_user_profiles)
        ? user?.platform_user_profiles[0]
        : user?.platform_user_profiles;

      const hasUsableSignature =
        profile?.can_sign_reports &&
        Boolean(profile.signature_data_url) &&
        (profile.signature_status === "approved" ||
          profile.signature_status === "pending_review");

      if (
        !user ||
        !user.is_active ||
        user.onboarding_status !== "active" ||
        !hasUsableSignature
      ) {
        throw new Error("Escolha apenas assinaturas ativas cadastradas para relatorio.");
      }

      return {
        report_id: req.params.id,
        user_id: user.id,
        name_snapshot: user.name,
        role_snapshot: profile.professional_role || user.app_role,
        registry_type_snapshot: profile.registry_type || null,
        registry_number_snapshot: profile.registry_number || null,
        signature_name_snapshot: profile.signature_name || user.name,
        signature_data_url_snapshot: profile.signature_data_url || null,
        signature_status_snapshot: profile.signature_status || "approved",
      };
    });

    const { error: deleteError } = await supabase
      .from("report_signers")
      .delete()
      .eq("report_id", req.params.id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("report_signers")
      .insert(rows)
      .select(reportSignerSelect);

    if (insertError) {
      throw new Error(insertError.message);
    }

    const signers = ((inserted || []) as Record<string, unknown>[]).map(mapReportSigner);
    const nextGeneratedData = mergeGeneratedData(report.generated_data, {
      variables: {
        report_signers: signers.map((signer) => ({
          name: signer.signature_name_snapshot || signer.name_snapshot,
          role: signer.role_snapshot,
          registry_type: signer.registry_type_snapshot,
          registry_number: signer.registry_number_snapshot,
          signature_data_url: signer.signature_data_url_snapshot,
        })),
      },
    });

    await supabase
      .from("reports")
      .update({
        generated_data: nextGeneratedData,
        updated_at: now,
      })
      .eq("id", req.params.id);

    res.json(signers);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Nao foi possivel salvar as assinaturas.",
    });
  }
});

router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("reports")
    .select(reportSelect)
    .eq("id", req.params.id)
    .single();

  if (error) {
    res.status(404).json({ error: error.message });
    return;
  }

  res.json(data);
});

router.delete("/:id", async (req, res) => {
  const abandonLinkedSessions = ["1", "true", "yes"].includes(
    String(req.query.abandon_sessions || req.body?.abandon_sessions || "").toLowerCase()
  );
  const force = ["1", "true", "yes"].includes(
    String(req.query.force || req.body?.force || "").toLowerCase()
  );

  try {
    const result = await deleteReportCascade(req.params.id, {
      abandonLinkedSessions,
      force,
    });

    if (!result.found) {
      res.status(404).json({ error: "Relatorio nao encontrado." });
      return;
    }

    res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel excluir o relatorio.",
    });
  }
});

router.get("/:id/stages", async (req, res) => {
  try {
    const snapshots = await fetchReportStageSnapshots(req.params.id);
    res.json(snapshots);
  } catch (error) {
    res.status(200).json({
      snapshots: [],
      warning:
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar os snapshots das etapas.",
    });
  }
});

router.post("/render-template-docx", async (req, res) => {
  try {
    const templateUrl = String(req.body.template_url || req.body.templateUrl || "").trim();
    const templateData =
      req.body.data && typeof req.body.data === "object" && !Array.isArray(req.body.data)
        ? (req.body.data as Record<string, unknown>)
        : {};
    const fileName = String(req.body.file_name || req.body.fileName || "relatorio-elementus.docx");
    const rendered = await renderTemplateDocx({
      templateUrl,
      data: templateData,
    });

    res.json({
      ok: true,
      file_name: fileName,
      render_mode: "api-template-docxtemplater",
      template_source: rendered.source,
      bytes: rendered.buffer.length,
      docx_base64: rendered.buffer.toString("base64"),
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel renderizar o modelo Word.",
    });
  }
});

router.post("/:id/stages/:stage", async (req, res) => {
  const stage = req.params.stage;
  const advancedToStage = req.body.advanced_to_stage as string | undefined;

  if (!workflowStages.has(stage)) {
    res.status(400).json({ error: "Etapa invalida para snapshot." });
    return;
  }

  if (advancedToStage && !workflowStages.has(advancedToStage)) {
    res.status(400).json({ error: "Etapa de destino invalida." });
    return;
  }

  try {
    const report = await fetchReportById(req.params.id);
    const payload =
      req.body.payload && typeof req.body.payload === "object" && !Array.isArray(req.body.payload)
        ? (req.body.payload as Record<string, unknown>)
        : {
            report_id: report.id,
            generated_data: report.generated_data,
            status: report.status,
          };

    let snapshot: Record<string, unknown> | null = null;
    let snapshotStored = true;
    let snapshotError: string | null = null;

    try {
      snapshot = await upsertReportStageSnapshot({
        reportId: req.params.id,
        stage,
        payload,
        advancedToStage,
        completedBy: typeof req.body.completed_by === "string" ? req.body.completed_by : null,
      });
    } catch (error) {
      snapshotStored = false;
      snapshotError = error instanceof Error ? error.message : "stage_snapshot_failed";
    }

    const generatedData = await markReportStageMetadata({
      reportId: req.params.id,
      generatedData: report.generated_data,
      stage,
      payload,
      advancedToStage,
      snapshotStored,
    });

    res.json({
      ok: true,
      stage,
      advanced_to_stage: advancedToStage || null,
      snapshot_stored: snapshotStored,
      snapshot_error: snapshotError,
      snapshot,
      generated_data: generatedData,
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Nao foi possivel salvar a etapa.",
    });
  }
});

router.post("/generate", async (req, res) => {
  const {
    template_id,
    project_id,
    campaign_id,
    title,
    report_number,
    type,
    status,
    version,
    variables,
    sections,
    charts,
    tables,
    metadata,
  } = req.body;
  const requestedAt = new Date().toISOString();

  let persistencePayload: Awaited<ReturnType<typeof buildReportPersistencePayload>>;

  try {
    persistencePayload = await buildReportPersistencePayload({
      template_id,
      project_id,
      campaign_id,
      title,
      report_number,
      type,
      status,
      version,
      variables,
      sections,
      charts,
      tables,
      metadata,
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Nao foi possivel preparar a minuta.",
    });
    return;
  }

  const { data: report, error } = await supabase
    .from("reports")
    .insert(persistencePayload)
    .select(reportSelect)
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const workflowResult = await triggerReportGenerationWorkflow({
    reportId: report.id,
    projectId: report.project_id,
    campaignId: report.campaign_id,
    templateId: report.template_id,
    reportNumber: report.report_number,
    title: report.title,
    type: report.type,
    status: report.status,
    generatedData: persistencePayload.generated_data,
    requestedAt,
  });

  const nextGeneratedData = mergeGeneratedData(report.generated_data, {
    metadata: {
      n8n_generation_requested_at: requestedAt,
      n8n_generation_triggered: workflowResult.ok,
      n8n_generation_error: workflowResult.ok ? null : workflowResult.reason || null,
    },
  });

  if (workflowResult.ok) {
    const { data: queuedReport, error: queueError } = await supabase
      .from("reports")
      .update({
        status: "generating",
        generated_data: nextGeneratedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", report.id)
      .select(reportSelect)
      .single();

    if (!queueError && queuedReport) {
      res.status(201).json(queuedReport);
      return;
    }
  } else {
    await supabase
      .from("reports")
      .update({
        generated_data: nextGeneratedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", report.id);
  }

  res.status(201).json(report);
});

router.patch("/:id", async (req, res) => {
  const payload = {
    ...req.body,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("reports")
    .update(payload)
    .eq("id", req.params.id)
    .select(reportSelect)
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json(data);
});

router.post("/", async (req, res) => {
  try {
    const persistencePayload = await buildReportPersistencePayload(req.body);
    const { data, error } = await supabase
      .from("reports")
      .insert(persistencePayload)
      .select(reportSelect)
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar o rascunho do relatorio.",
    });
  }
});

router.post("/:id/final-generation", async (req, res) => {
  const requestedAt = new Date().toISOString();
  const reportPatch = req.body.report as
    | {
        title?: string;
        report_number?: string;
        project_id?: string;
        template_id?: string;
        type?: string;
        status?: string;
        generated_data?: ReportGeneratedData;
      }
    | undefined;

  try {
    if (reportPatch) {
      const resolvedProjectId = reportPatch.project_id
        ? await ensureReportProjectId(reportPatch.project_id)
        : undefined;
      const resolvedTemplateId = reportPatch.template_id
        ? await resolveReportTemplateId(reportPatch.template_id, reportPatch.type)
        : undefined;

      const { error: patchError } = await supabase
        .from("reports")
        .update({
          title: reportPatch.title,
          report_number: reportPatch.report_number,
          project_id: resolvedProjectId,
          template_id: resolvedTemplateId,
          type: reportPatch.type,
          status: reportPatch.status || "review",
          generated_data: reportPatch.generated_data,
          updated_at: requestedAt,
        })
        .eq("id", req.params.id);

      if (patchError) {
        throw new Error(patchError.message);
      }
    }

    const report = await fetchReportById(req.params.id);
    const stageSnapshots = await tryFetchReportStageSnapshots(req.params.id);
    const workflowResult = await triggerFinalReportRagWorkflow({
      reportId: report.id,
      projectId: report.project_id,
      campaignId: report.campaign_id,
      templateId: report.template_id,
      reportNumber: report.report_number,
      title: report.title,
      type: report.type,
      status: report.status,
      generatedData: report.generated_data || buildGeneratedData({}),
      stageSnapshots,
      requestedAt,
    });
    const nextGeneratedData = mergeGeneratedData(report.generated_data, {
      metadata: {
        final_rag_requested_at: requestedAt,
        final_rag_triggered: workflowResult.ok,
        final_rag_error: workflowResult.ok ? null : workflowResult.reason || null,
        final_rag_snapshot_count: stageSnapshots.length,
      },
    });

    const { data, error } = await supabase
      .from("reports")
      .update({
        status: workflowResult.ok ? "generating" : report.status,
        generated_data: nextGeneratedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select(reportSelect)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      report: data,
      workflow: workflowResult,
    });
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel solicitar a geracao final com IA/RAG.",
    });
  }
});

router.post("/:id/microsoft-365/save", async (req, res) => {
  const accessToken = req.body.microsoft_access_token as string | undefined;
  const reportPatch = req.body.report as
    | {
        title?: string;
        report_number?: string;
        project_id?: string;
        template_id?: string;
        type?: string;
        generated_data?: ReportGeneratedData;
      }
    | undefined;
  const emittedBy = req.body.emitted_by as { email?: string; name?: string } | undefined;

  if (!accessToken) {
    res.status(400).json({ error: "Token Microsoft 365 obrigatorio para emitir o relatorio." });
    return;
  }

  const now = new Date().toISOString();

  try {
    if (reportPatch) {
      const { error: patchError } = await supabase
        .from("reports")
        .update({
          title: reportPatch.title,
          report_number: reportPatch.report_number,
          project_id: reportPatch.project_id,
          template_id: reportPatch.template_id,
          type: reportPatch.type,
          generated_data: reportPatch.generated_data,
          status: "review",
          updated_at: now,
        })
        .eq("id", req.params.id);

      if (patchError) {
        res.status(400).json({ error: patchError.message });
        return;
      }
    }

    const report = await fetchReportById(req.params.id);
    const reportFolderPath = getReportFolderPath(report);
    const folder = await ensureMicrosoftFolder(reportFolderPath, accessToken);
    const attachmentsFolder = await ensureMicrosoftFolder(
      `${reportFolderPath}/Anexos`,
      accessToken
    );

    const uploadedAttachments = new Map<string, string>();

    for (const attachment of extractReportAttachments(report)) {
      const uploadedItem = await uploadFileToMicrosoftFolder({
        accessToken,
        parentFolderId: attachmentsFolder.id,
        fileName: attachment.fileName,
        buffer: attachment.buffer,
        contentType: attachment.mimeType,
      });

      uploadedAttachments.set(attachment.id, uploadedItem.webUrl || "");
    }

    const sectionsWithAttachmentUrls =
      report.generated_data?.sections.map((section) => ({
        ...section,
        images: (section.images || []).map((image) => ({
          ...image,
          microsoft365_url:
            uploadedAttachments.get(image.id) || image.microsoft365_url,
        })),
      })) || [];

    const reportForExport: ReportDocumentSource = {
      ...report,
      generated_data: mergeGeneratedData(report.generated_data, {
        sections: sectionsWithAttachmentUrls,
      }),
    };

    const docxBuffer = await buildReportDocxBuffer(reportForExport);
    const uploadedDocx = await uploadFileToMicrosoftFolder({
      accessToken,
      parentFolderId: folder.id,
      fileName: buildReportDocxFileName(reportForExport),
      buffer: docxBuffer,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const generatedData = mergeGeneratedData(report.generated_data, {
      sections: sectionsWithAttachmentUrls,
      variables: {
        microsoft365_folder: reportFolderPath,
        microsoft365_folder_url: folder.webUrl || null,
        microsoft365_status: "saved",
        microsoft365_docx_url: uploadedDocx.webUrl || null,
        microsoft365_saved_by: emittedBy?.email || emittedBy?.name || null,
        last_saved_at: now,
      },
      metadata: {
        microsoft365_attachment_count: uploadedAttachments.size,
      },
    });

    const { data, error } = await supabase
      .from("reports")
      .update({
        generated_data: generatedData,
        status: "delivered",
        docx_url: uploadedDocx.webUrl || null,
        approved_by: emittedBy?.email || emittedBy?.name || null,
        approved_at: now,
        generated_at: now,
        updated_at: now,
      })
      .eq("id", req.params.id)
      .select(reportSelect)
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar o relatorio no Microsoft 365.",
    });
  }
});

router.post("/:id/approve", async (req, res) => {
  const { data, error } = await supabase
    .from("reports")
    .update({
      status: "approved",
      approved_by: req.body.approved_by,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.params.id)
    .select(reportSelect)
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json(data);
});

export default router;