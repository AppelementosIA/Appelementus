import { Router } from "express";
import { supabase } from "../lib/supabase.js";

const router: import("express").Router = Router();

const reportSelect =
  "*, projects(id, name, client_name, enterprise), report_templates(id, name, type, code, template_url)";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const templateCodeByInputId: Record<string, string> = {
  "template-implantacao": "implantacao_florestal",
  "template-monitoramento": "operacao_rotina_simples",
  "template-condicionantes": "supervisao_ambiental_rodovia",
  "template-operacao-rotina-simples": "operacao_rotina_simples",
  "template-supervisao-ambiental-rodovia": "supervisao_ambiental_rodovia",
  "template-manutencao-cinturao-verde": "manutencao_cinturao_verde",
};

async function resolveTemplateId(inputTemplateId?: string | null) {
  if (!inputTemplateId) {
    throw new Error("Template nao informado.");
  }

  if (uuidPattern.test(inputTemplateId)) {
    return inputTemplateId;
  }

  const templateCode = templateCodeByInputId[inputTemplateId] || inputTemplateId;
  const { data, error } = await supabase
    .from("report_templates")
    .select("id")
    .eq("code", templateCode)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error(`Template nao localizado para ${inputTemplateId}.`);
  }

  return data.id as string;
}

async function ensureLegacyProjectForReport(projectId?: string | null) {
  if (!projectId) {
    throw new Error("Projeto nao informado.");
  }

  const { data: legacyProject, error: legacyError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (legacyError) {
    throw new Error(legacyError.message);
  }

  if (legacyProject?.id) {
    return { projectId, omieProjectId: null as string | null };
  }

  const { data: omieProject, error: omieError } = await supabase
    .from("omie_projects_mirror")
    .select("id, client_id, nome, empreendimento_nome, numero_contrato, status")
    .eq("id", projectId)
    .maybeSingle();

  if (omieError) {
    throw new Error(omieError.message);
  }

  if (!omieProject) {
    return { projectId, omieProjectId: null as string | null };
  }

  const { data: client, error: clientError } = await supabase
    .from("omie_clients_mirror")
    .select("razao_social, nome_fantasia")
    .eq("id", omieProject.client_id)
    .maybeSingle();

  if (clientError) {
    throw new Error(clientError.message);
  }

  const clientName = client?.nome_fantasia || client?.razao_social || "Cliente";
  const enterprise = omieProject.empreendimento_nome || omieProject.nome;
  const now = new Date().toISOString();

  const { error: upsertError } = await supabase.from("projects").upsert(
    {
      id: projectId,
      name: omieProject.nome,
      client_name: clientName,
      enterprise,
      description: "Projeto criado automaticamente a partir do espelho Omie para geracao de relatorio.",
      environmental_permit: omieProject.numero_contrato || null,
      organ: "OTHER",
      status: omieProject.status === "inactive" ? "paused" : "active",
      updated_at: now,
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  return { projectId, omieProjectId: projectId };
}

// GET /api/reports
router.get("/", async (req, res) => {
  const query = supabase.from("reports").select(reportSelect).order("created_at", {
    ascending: false,
  });

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

// POST /api/reports/generate - trigger report generation
router.post("/generate", async (req, res) => {
  const {
    template_id,
    project_id,
    campaign_id,
    variables,
    title,
    report_number,
    type,
    status,
    sections,
    charts,
    tables,
    metadata,
  } = req.body;

  let resolvedTemplateId: string;
  let projectLink: { projectId: string; omieProjectId: string | null };

  try {
    resolvedTemplateId = await resolveTemplateId(template_id);
    projectLink = await ensureLegacyProjectForReport(project_id);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Nao foi possivel preparar o relatorio.",
    });
    return;
  }

  const reportVariables = {
    ...(variables || {}),
    title: title || variables?.title || "Relatorio",
    report_number: report_number || variables?.report_number || "",
    type: type || variables?.type || "quarterly_monitoring",
  };

  const { data: report, error } = await supabase
    .from("reports")
    .insert({
      template_id: resolvedTemplateId,
      project_id: projectLink.projectId,
      omie_project_id: projectLink.omieProjectId,
      campaign_id,
      status: status || "draft",
      title: reportVariables.title,
      report_number: reportVariables.report_number,
      type: reportVariables.type,
      version: 1,
      generated_data: {
        variables: reportVariables,
        sections: Array.isArray(sections) ? sections : [],
        charts: Array.isArray(charts) ? charts : [],
        tables: Array.isArray(tables) ? tables : [],
        metadata: metadata || {},
      },
    })
    .select(reportSelect)
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(201).json(report);
});

// PATCH /api/reports/:id - update report (edit sections, approve, etc.)
router.patch("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("reports")
    .update(req.body)
    .eq("id", req.params.id)
    .select(reportSelect)
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json(data);
});

// POST /api/reports/:id/approve
router.post("/:id/approve", async (req, res) => {
  const { data, error } = await supabase
    .from("reports")
    .update({
      status: "approved",
      approved_by: req.body.approved_by,
      approved_at: new Date().toISOString(),
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
