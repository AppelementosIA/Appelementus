import { Router } from "express";
import { supabase } from "../lib/supabase.js";

const router: import("express").Router = Router();

// GET /api/field-data
router.get("/", async (req, res) => {
  const query = supabase
    .from("field_data")
    .select("*, campaigns(name), projects(name)")
    .order("received_at", { ascending: false })
    .limit(50);

  if (req.query.campaign_id) {
    query.eq("campaign_id", req.query.campaign_id);
  }
  if (req.query.status) {
    query.eq("status", req.query.status);
  }
  if (req.query.type) {
    query.eq("type", req.query.type);
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

// GET /api/field-data/stats
router.get("/stats", async (_req, res) => {
  const { data, error } = await supabase
    .from("field_data")
    .select("type, status");

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const stats = {
    total: data.length,
    by_type: {} as Record<string, number>,
    by_status: {} as Record<string, number>,
  };

  for (const entry of data) {
    stats.by_type[entry.type] = (stats.by_type[entry.type] || 0) + 1;
    stats.by_status[entry.status] = (stats.by_status[entry.status] || 0) + 1;
  }

  res.json(stats);
});

// POST /api/field-data — manual upload
router.post("/", async (req, res) => {
  const { data, error } = await supabase
    .from("field_data")
    .insert({
      ...req.body,
      source: "upload",
      status: "pending",
      received_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.status(201).json(data);
});

// POST /api/field-data/webhook — n8n/Evolution API webhook for WhatsApp data
router.post("/webhook", async (req, res) => {
  // This endpoint receives processed data from n8n
  // n8n handles: WhatsApp message → AI processing → structured data
  const { data, error } = await supabase
    .from("field_data")
    .insert({
      ...req.body,
      source: "whatsapp",
      received_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.status(201).json(data);
});

export default router;
