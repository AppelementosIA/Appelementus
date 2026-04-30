import { Router } from "express";
import { config } from "../lib/config.js";
import { syncOmieClients, syncOmieProjects } from "../lib/omie-sync.js";
import { supabase } from "../lib/supabase.js";

const router: import("express").Router = Router();

function getPositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

router.get("/status", (_req, res) => {
  res.json({
    configured: Boolean(config.omie.appKey && config.omie.appSecret),
    base_url: config.omie.baseUrl,
  });
});

router.get("/clients", async (req, res) => {
  const limit = Math.min(getPositiveNumber(req.query.limit, 50), 200);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const query = supabase
    .from("omie_clients_mirror")
    .select("*", { count: "exact" })
    .order("razao_social", { ascending: true })
    .limit(limit);

  if (search) {
    const escaped = search.replace(/,/g, " ");
    query.or(
      `razao_social.ilike.%${escaped}%,nome_fantasia.ilike.%${escaped}%,cnpj.ilike.%${escaped}%,email.ilike.%${escaped}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({
    total: count || 0,
    items: data || [],
  });
});

router.get("/projects", async (req, res) => {
  const limit = Math.min(getPositiveNumber(req.query.limit, 50), 200);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const query = supabase
    .from("omie_projects_mirror")
    .select("*", { count: "exact" })
    .order("nome", { ascending: true })
    .limit(limit);

  if (search) {
    const escaped = search.replace(/,/g, " ");
    query.or(`nome.ilike.%${escaped}%,empreendimento_nome.ilike.%${escaped}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({
    total: count || 0,
    items: data || [],
  });
});

router.post("/sync/clients", async (req, res) => {
  try {
    const result = await syncOmieClients({
      pageSize: getPositiveNumber(req.body?.page_size, 50),
      maxPages: req.body?.max_pages ? getPositiveNumber(req.body.max_pages, 1) : undefined,
    });

    res.json({
      ok: true,
      target: "clients",
      ...result,
    });
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel sincronizar os clientes da Omie.",
    });
  }
});

router.post("/sync/projects", async (req, res) => {
  try {
    const result = await syncOmieProjects({
      pageSize: getPositiveNumber(req.body?.page_size, 50),
      maxPages: req.body?.max_pages ? getPositiveNumber(req.body.max_pages, 1) : undefined,
    });

    res.json({
      ok: true,
      target: "projects",
      note:
        result.totalFromOmie > 0
          ? "Projetos operacionais espelhados a partir de Contratos de Servico da Omie quando disponiveis; fallback automatico para Ordens de Servico e, por ultimo, /geral/projetos."
          : undefined,
      ...result,
    });
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel sincronizar os projetos da Omie.",
    });
  }
});

router.post("/sync/all", async (req, res) => {
  try {
    const pageSize = getPositiveNumber(req.body?.page_size, 50);
    const maxPages = req.body?.max_pages ? getPositiveNumber(req.body.max_pages, 1) : undefined;
    const clients = await syncOmieClients({ pageSize, maxPages });
    const projects = await syncOmieProjects({ pageSize, maxPages });

    res.json({
      ok: true,
      clients,
      projects,
      note:
        projects.totalFromOmie > 0
          ? "Clientes foram importados. Projetos operacionais foram espelhados a partir de Contratos de Servico da Omie quando esse modulo estiver populado, com fallback para Ordens de Servico e /geral/projetos."
          : undefined,
    });
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel sincronizar os espelhos da Omie.",
    });
  }
});

export default router;
