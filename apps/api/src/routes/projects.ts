import { Router } from "express";
import { supabase } from "../lib/supabase.js";

const router: import("express").Router = Router();

// GET /api/projects
router.get("/", async (_req, res) => {
  const req = _req;
  const query = supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

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
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

// GET /api/projects/:id
router.get("/:id", async (req, res) => {
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
});

// POST /api/projects
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

// PATCH /api/projects/:id
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
