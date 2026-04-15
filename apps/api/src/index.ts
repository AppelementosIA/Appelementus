import express from "express";
import cors from "cors";
import { config } from "./lib/config.js";
import projectsRouter from "./routes/projects.js";
import campaignsRouter from "./routes/campaigns.js";
import reportsRouter from "./routes/reports-platform.js";
import fieldDataRouter from "./routes/field-data.js";
import templatesRouter from "./routes/templates.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Routes
app.use("/api/projects", projectsRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/field-data", fieldDataRouter);
app.use("/api/templates", templatesRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "elementus-api", version: "0.1.0" });
});

app.listen(config.port, () => {
  console.log(`Elementus API running on port ${config.port}`);
});
