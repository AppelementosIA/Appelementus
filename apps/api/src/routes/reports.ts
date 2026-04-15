import { Router } from "express";
import { supabase } from "../lib/supabase.js";

const router: import("express").Router = Router();

// GET /api/reports
router.get("/", async (req, res) => {
  const query = supabase
    .from("reports")
    .select("*, projects(name, client_name), report_templates(name)")
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

// POST /api/reports/generate — trigger report generation
router.post("/generate", async (req, res) => {
  const { template_id, project_id, campaign_id, variables } = req.body;

  // Create report record
  const { data: report, error } = await supabase
    .from("reports")
    .insert({
      template_id,
      project_id,
      campaign_id,
      status: "generating",
      title: variables?.title || "Relatório",
      report_number: variables?.report_number || "",
      type: variables?.type || "quarterly_monitoring",
      version: 1,
      generated_data: { variables, sections: [], charts: [], tables: [] },
    })
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  // TODO: Trigger n8n webhook to start AI generation pipeline
  // This will:
  // 1. Call the Elementus Specialist Agent (Claude/GPT-4o) to generate text content
  // 2. Generate charts from field data
  // 3. Use docxtemplater to fill the template
  // 4. Upload the final .docx and .pdf to Supabase Storage

  res.status(201).json(report);
});

// PATCH /api/reports/:id — update report (edit sections, approve, etc.)
router.patch("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("reports")
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
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json(data);
});

export default router;
