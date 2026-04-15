import { Router } from "express";
import { supabase } from "../lib/supabase.js";

const router: import("express").Router = Router();

// GET /api/campaigns
router.get("/", async (req, res) => {
  const query = supabase
    .from("campaigns")
    .select("*, projects(name, client_name)")
    .order("updated_at", { ascending: false });

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

// GET /api/campaigns/:id
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*, projects(name, client_name), collection_points(*), field_data(*)")
    .eq("id", req.params.id)
    .single();

  if (error) {
    res.status(404).json({ error: error.message });
    return;
  }
  res.json(data);
});

// POST /api/campaigns
router.post("/", async (req, res) => {
  const { data, error } = await supabase
    .from("campaigns")
    .insert(req.body)
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.status(201).json(data);
});

export default router;
