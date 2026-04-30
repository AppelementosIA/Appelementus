import type { ReportGeneratedData } from "@elementus/shared";
import { Router } from "express";
import {
  buildReportDocxBuffer,
  buildReportDocxFileName,
  extractReportAttachments,
  type ReportDocumentSource,
} from "../lib/report-documents.js";
import { triggerReportGenerationWorkflow } from "../lib/n8n.js";
import { ensureMicrosoftFolder, uploadFileToMicrosoftFolder } from "../lib/microsoft-graph.js";
import { supabase } from "../lib/supabase.js";
import { renderTemplateDocx } from "../lib/template-docx-renderer.js";

const router: import("express").Router = Router();

const reportSelect =
  "*, projects(id, name, client_name, enterprise), report_templates(id, name, type, template_url)";

function buildGeneratedData(body: {
  variables?: Record<string, unknown>;
  sections?: ReportGeneratedData["sections"];
  charts?: ReportGeneratedData["charts"];
  tables?: ReportGeneratedData["tables"];
  metadata?: Record<string, unknown>;
}) {
  return {
    variables: body.variables ?? {},
    sections: body.sections ?? [],
    charts: body.charts ?? [],
    tables: body.tables ?? [],
    metadata: body.metadata ?? {},
  } satisfies ReportGeneratedData;
}

function getReportFolderPath(report: ReportDocumentSource) {
  const variables = (report.generated_data?.variables || {}) as Record<string, unknown>;
  const explicitFolder = variables.microsoft365_folder;

  if (typeof explicitFolder === "string" && explicitFolder.trim()) {
    return explicitFolder.trim();
  }

  const clientName = report.projects?.client_name || "Cliente";
  const enterprise = report.projects?.enterprise || "Empreendimento";
  return `Clientes/${clientName}/${enterprise}/Relatorios`;
}

function mergeGeneratedData(
  base: ReportGeneratedData | undefined,
  patch: Partial<ReportGeneratedData> & {
    variables?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
) {
  return {
    sections: patch.sections ?? base?.sections ?? [],
    charts: patch.charts ?? base?.charts ?? [],
    tables: patch.tables ?? base?.tables ?? [],
    variables: {
      ...(base?.variables || {}),
      ...(patch.variables || {}),
    },
    metadata: {
      ...(base?.metadata || {}),
      ...(patch.metadata || {}),
    },
  } satisfies ReportGeneratedData;
}

async function fetchReportById(reportId: string) {
  const { data, error } = await supabase
    .from("reports")
    .select(reportSelect)
    .eq("id", reportId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ReportDocumentSource & {
    status: string;
    docx_url?: string | null;
    pdf_url?: string | null;
  };
}

router.get("/", async (req, res) => {
  const query = supabase
    .from("reports")
    .select(reportSelect)
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

router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("reports")
    .select(reportSelect)
    .eq("id", req.params.id)
    .single();

  if (error) {
    res.status(404).json({ error: error.message });
    return;
  }

  res.json(data);
});

router.post("/render-template-docx", async (req, res) => {
  try {
    const templateUrl = String(req.body.template_url || req.body.templateUrl || "").trim();
    const templateData =
      req.body.data && typeof req.body.data === "object" && !Array.isArray(req.body.data)
        ? (req.body.data as Record<string, unknown>)
        : {};
    const fileName = String(req.body.file_name || req.body.fileName || "relatorio-elementus.docx");
    const rendered = await renderTemplateDocx({
      templateUrl,
      data: templateData,
    });

    res.json({
      ok: true,
      file_name: fileName,
      render_mode: "api-template-docxtemplater",
      template_source: rendered.source,
      bytes: rendered.buffer.length,
      docx_base64: rendered.buffer.toString("base64"),
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel renderizar o modelo Word.",
    });
  }
});
router.post("/generate", async (req, res) => {
  const {
    template_id,
    project_id,
    campaign_id,
    title,
    report_number,
    type,
    status,
    version,
    variables,
    sections,
    charts,
    tables,
    metadata,
  } = req.body;
  const generatedData = buildGeneratedData({
    variables,
    sections,
    charts,
    tables,
    metadata,
  });
  const requestedAt = new Date().toISOString();

  const { data: report, error } = await supabase
    .from("reports")
    .insert({
      template_id,
      project_id,
      campaign_id: campaign_id || null,
      status: status || "draft",
      title: title || variables?.title || "Relatorio",
      report_number: report_number || variables?.report_number || "",
      type: type || variables?.type || "quarterly_monitoring",
      version: version || 1,
      generated_data: generatedData,
    })
    .select(reportSelect)
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const workflowResult = await triggerReportGenerationWorkflow({
    reportId: report.id,
    projectId: report.project_id,
    campaignId: report.campaign_id,
    templateId: report.template_id,
    reportNumber: report.report_number,
    title: report.title,
    type: report.type,
    status: report.status,
    generatedData,
    requestedAt,
  });

  const nextGeneratedData = mergeGeneratedData(report.generated_data, {
    metadata: {
      n8n_generation_requested_at: requestedAt,
      n8n_generation_triggered: workflowResult.ok,
      n8n_generation_error: workflowResult.ok ? null : workflowResult.reason || null,
    },
  });

  if (workflowResult.ok) {
    const { data: queuedReport, error: queueError } = await supabase
      .from("reports")
      .update({
        status: "generating",
        generated_data: nextGeneratedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", report.id)
      .select(reportSelect)
      .single();

    if (!queueError && queuedReport) {
      res.status(201).json(queuedReport);
      return;
    }
  } else {
    await supabase
      .from("reports")
      .update({
        generated_data: nextGeneratedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", report.id);
  }

  res.status(201).json(report);
});

router.patch("/:id", async (req, res) => {
  const payload = {
    ...req.body,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("reports")
    .update(payload)
    .eq("id", req.params.id)
    .select(reportSelect)
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json(data);
});

router.post("/:id/microsoft-365/save", async (req, res) => {
  const accessToken = req.body.microsoft_access_token as string | undefined;
  const reportPatch = req.body.report as
    | {
        title?: string;
        report_number?: string;
        project_id?: string;
        template_id?: string;
        type?: string;
        generated_data?: ReportGeneratedData;
      }
    | undefined;
  const emittedBy = req.body.emitted_by as { email?: string; name?: string } | undefined;

  if (!accessToken) {
    res.status(400).json({ error: "Token Microsoft 365 obrigatorio para emitir o relatorio." });
    return;
  }

  const now = new Date().toISOString();

  try {
    if (reportPatch) {
      const { error: patchError } = await supabase
        .from("reports")
        .update({
          title: reportPatch.title,
          report_number: reportPatch.report_number,
          project_id: reportPatch.project_id,
          template_id: reportPatch.template_id,
          type: reportPatch.type,
          generated_data: reportPatch.generated_data,
          status: "review",
          updated_at: now,
        })
        .eq("id", req.params.id);

      if (patchError) {
        res.status(400).json({ error: patchError.message });
        return;
      }
    }

    const report = await fetchReportById(req.params.id);
    const reportFolderPath = getReportFolderPath(report);
    const folder = await ensureMicrosoftFolder(reportFolderPath, accessToken);
    const attachmentsFolder = await ensureMicrosoftFolder(
      `${reportFolderPath}/Anexos`,
      accessToken
    );

    const uploadedAttachments = new Map<string, string>();

    for (const attachment of extractReportAttachments(report)) {
      const uploadedItem = await uploadFileToMicrosoftFolder({
        accessToken,
        parentFolderId: attachmentsFolder.id,
        fileName: attachment.fileName,
        buffer: attachment.buffer,
        contentType: attachment.mimeType,
      });

      uploadedAttachments.set(attachment.id, uploadedItem.webUrl || "");
    }

    const sectionsWithAttachmentUrls =
      report.generated_data?.sections.map((section) => ({
        ...section,
        images: (section.images || []).map((image) => ({
          ...image,
          microsoft365_url:
            uploadedAttachments.get(image.id) || image.microsoft365_url,
        })),
      })) || [];

    const reportForExport: ReportDocumentSource = {
      ...report,
      generated_data: mergeGeneratedData(report.generated_data, {
        sections: sectionsWithAttachmentUrls,
      }),
    };

    const docxBuffer = await buildReportDocxBuffer(reportForExport);
    const uploadedDocx = await uploadFileToMicrosoftFolder({
      accessToken,
      parentFolderId: folder.id,
      fileName: buildReportDocxFileName(reportForExport),
      buffer: docxBuffer,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const generatedData = mergeGeneratedData(report.generated_data, {
      sections: sectionsWithAttachmentUrls,
      variables: {
        microsoft365_folder: reportFolderPath,
        microsoft365_folder_url: folder.webUrl || null,
        microsoft365_status: "saved",
        microsoft365_docx_url: uploadedDocx.webUrl || null,
        microsoft365_saved_by: emittedBy?.email || emittedBy?.name || null,
        last_saved_at: now,
      },
      metadata: {
        microsoft365_attachment_count: uploadedAttachments.size,
      },
    });

    const { data, error } = await supabase
      .from("reports")
      .update({
        generated_data: generatedData,
        status: "delivered",
        docx_url: uploadedDocx.webUrl || null,
        approved_by: emittedBy?.email || emittedBy?.name || null,
        approved_at: now,
        generated_at: now,
        updated_at: now,
      })
      .eq("id", req.params.id)
      .select(reportSelect)
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar o relatorio no Microsoft 365.",
    });
  }
});

router.post("/:id/approve", async (req, res) => {
  const { data, error } = await supabase
    .from("reports")
    .update({
      status: "approved",
      approved_by: req.body.approved_by,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
