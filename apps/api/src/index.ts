import express from "express";
import cors from "cors";
import { config } from "./lib/config.js";
import projectsRouter from "./routes/projects.js";
import campaignsRouter from "./routes/campaigns.js";
import reportsRouter from "./routes/reports-platform.js";
import fieldDataRouter from "./routes/field-data.js";
import templatesRouter from "./routes/templates.js";
import usersRouter from "./routes/users.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const healthPayload = {
  status: "ok",
  service: "elementus-api",
  version: "0.1.0",
};

// Routes
app.use("/api/projects", projectsRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/field-data", fieldDataRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/users", usersRouter);

// Health check
app.get("/", (_req, res) => {
  res.json(healthPayload);
});

app.get("/health", (_req, res) => {
  res.json(healthPayload);
});

app.get("/api/health", (_req, res) => {
  res.json(healthPayload);
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Elementus API running on port ${config.port}`);
});
