import { Router } from "express";
import { supabase } from "../lib/supabase.js";

const router: import("express").Router = Router();

// GET /api/templates
router.get("/", async (req, res) => {
  const query = supabase
    .from("report_templates")
    .select("*")
    .order("name");

  if (req.query.type) {
    query.eq("type", req.query.type);
  }

  if (req.query.active === "true") {
    query.eq("active", true);
  }
  if (req.query.active === "false") {
    query.eq("active", false);
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

// GET /api/templates/:id
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("report_templates")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) {
    res.status(404).json({ error: error.message });
    return;
  }
  res.json(data);
});

// POST /api/templates
router.post("/", async (req, res) => {
  const { data, error } = await supabase
    .from("report_templates")
    .insert(req.body)
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.status(201).json(data);
});

// PATCH /api/templates/:id
router.patch("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("report_templates")
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
