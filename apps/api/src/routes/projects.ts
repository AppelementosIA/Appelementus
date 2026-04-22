import { Router } from "express";
import { supabase } from "../lib/supabase.js";

const router: import("express").Router = Router();

type LegacyProjectRow = {
  id: string;
  name: string;
  client_name: string;
  enterprise: string;
  status: string;
  technical_lead?: string | null;
  next_delivery?: string | null;
  microsoft_365_folder?: string | null;
  default_template_id?: string | null;
  condicionante?: string | null;
  updated_at?: string | null;
};

type OmieProjectRow = {
  id: string;
  client_id: string;
  nome: string;
  empreendimento_nome?: string | null;
  numero_contrato?: string | null;
  status?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  updated_at?: string | null;
};

type OmieClientRow = {
  id: string;
  razao_social: string;
  nome_fantasia?: string | null;
};

function getLimit(value: unknown, fallback = 200, max = 200) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

function inferDefaultTemplateId(project: OmieProjectRow) {
  const normalized = [project.nome, project.empreendimento_nome, project.numero_contrato]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (normalized.includes("implant")) {
    return "template-implantacao";
  }

  if (
    normalized.includes("rodovia") ||
    normalized.includes("supervis") ||
    normalized.includes("cart")
  ) {
    return "template-supervisao-ambiental-rodovia";
  }

  if (
    normalized.includes("cinturao") ||
    normalized.includes("manutenc") ||
    normalized.includes("verde")
  ) {
    return "template-manutencao-cinturao-verde";
  }

  return "template-operacao-rotina-simples";
}

function mapOmieStatus(status?: string | null) {
  return status === "active" ? "active" : status === "inactive" ? "paused" : "setup";
}

function buildOmieMicrosoftFolder(clientName: string, undertaking: string) {
  return `Clientes/${clientName}/${undertaking}/Relatorios`;
}

async function fetchOmieProjects(req: import("express").Request) {
  const query = supabase
    .from("omie_projects_mirror")
    .select(
      "id, client_id, nome, empreendimento_nome, numero_contrato, status, data_inicio, data_fim, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(getLimit(req.query.limit));

  if (req.query.status) {
    const requested = String(req.query.status);

    if (requested === "active") {
      query.eq("status", "active");
    } else if (requested === "paused") {
      query.eq("status", "inactive");
    }
  }

  if (req.query.search) {
    const search = String(req.query.search).replace(/,/g, " ");
    query.or(`nome.ilike.%${search}%,empreendimento_nome.ilike.%${search}%`);
  }

  const { data: projectRows, error: projectError } = await query;

  if (projectError) {
    throw new Error(projectError.message);
  }

  const projects = (projectRows || []) as OmieProjectRow[];

  if (projects.length === 0) {
    return [];
  }

  const clientIds = Array.from(new Set(projects.map((row) => row.client_id)));
  const { data: clientRows, error: clientError } = await supabase
    .from("omie_clients_mirror")
    .select("id, razao_social, nome_fantasia")
    .in("id", clientIds);

  if (clientError) {
    throw new Error(clientError.message);
  }

  const clientsById = new Map(
    ((clientRows || []) as OmieClientRow[]).map((row) => [row.id, row])
  );

  return projects.map((project) => {
    const client = clientsById.get(project.client_id);
    const clientName = client?.nome_fantasia || client?.razao_social || "Cliente";
    const undertaking = project.empreendimento_nome || project.nome;

    return {
      id: project.id,
      name: project.nome,
      client_name: clientName,
      enterprise: undertaking,
      status: mapOmieStatus(project.status),
      technical_lead: null,
      next_delivery: project.data_fim || null,
      microsoft_365_folder: buildOmieMicrosoftFolder(clientName, undertaking),
      default_template_id: inferDefaultTemplateId(project),
      condicionante: null,
      source: "omie_mirror",
      updated_at: project.updated_at || null,
    };
  });
}

async function fetchLegacyProjects(req: import("express").Request) {
  const query = supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(getLimit(req.query.limit));

  if (req.query.status) {
    query.eq("status", req.query.status);
  }

  if (req.query.client_name) {
    query.ilike("client_name", `%${req.query.client_name}%`);
  }

  if (req.query.search) {
    const search = String(req.query.search).replace(/,/g, " ");
    query.or(`name.ilike.%${search}%,client_name.ilike.%${search}%,enterprise.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as LegacyProjectRow[];
}

router.get("/", async (req, res) => {
  try {
    const omieProjects = await fetchOmieProjects(req);

    if (omieProjects.length > 0) {
      res.json(omieProjects);
      return;
    }

    const legacyProjects = await fetchLegacyProjects(req);
    res.json(legacyProjects);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel listar os projetos da plataforma.",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { data: omieProject, error: omieError } = await supabase
      .from("omie_projects_mirror")
      .select("id, client_id, nome, empreendimento_nome, numero_contrato, status, data_inicio, data_fim, updated_at")
      .eq("id", req.params.id)
      .maybeSingle();

    if (omieError) {
      throw new Error(omieError.message);
    }

    if (omieProject) {
      const { data: client, error: clientError } = await supabase
        .from("omie_clients_mirror")
        .select("id, razao_social, nome_fantasia")
        .eq("id", omieProject.client_id)
        .maybeSingle();

      if (clientError) {
        throw new Error(clientError.message);
      }

      const clientName = client?.nome_fantasia || client?.razao_social || "Cliente";
      const undertaking = omieProject.empreendimento_nome || omieProject.nome;

      res.json({
        id: omieProject.id,
        name: omieProject.nome,
        client_name: clientName,
        enterprise: undertaking,
        status: mapOmieStatus(omieProject.status),
        technical_lead: null,
        next_delivery: omieProject.data_fim || null,
        microsoft_365_folder: buildOmieMicrosoftFolder(clientName, undertaking),
        default_template_id: inferDefaultTemplateId(omieProject),
        condicionante: null,
        source: "omie_mirror",
        updated_at: omieProject.updated_at || null,
      });
      return;
    }

    const { data, error } = await supabase
      .from("projects")
      .select("*, campaigns(*)")
      .eq("id", req.params.id)
      .single();

    if (error) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar o projeto solicitado.",
    });
  }
});

router.post("/", async (req, res) => {
  const { data, error } = await supabase
    .from("projects")
    .insert(req.body)
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.status(201).json(data);
});

router.patch("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("projects")
    .update(req.body)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json(data);
});

export default router;
