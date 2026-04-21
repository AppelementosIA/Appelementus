import type { ReportGeneratedData } from "@elementus/shared";
import { config } from "./config.js";

export interface TriggerReportGenerationInput {
  reportId: string;
  projectId: string;
  campaignId?: string | null;
  templateId: string;
  reportNumber: string;
  title: string;
  type: string;
  status: string;
  generatedData: ReportGeneratedData;
  requestedAt: string;
}

export interface TriggerWorkflowResult {
  ok: boolean;
  reason?: string;
  responseBody?: string;
}

export async function triggerReportGenerationWorkflow(
  input: TriggerReportGenerationInput
): Promise<TriggerWorkflowResult> {
  if (!config.n8n.webhookUrl) {
    return {
      ok: false,
      reason: "missing_webhook_url",
    };
  }

  try {
    const response = await fetch(config.n8n.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: "report.generate.requested",
        source: "elementus-api",
        report_id: input.reportId,
        project_id: input.projectId,
        campaign_id: input.campaignId ?? null,
        template_id: input.templateId,
        report_number: input.reportNumber,
        title: input.title,
        type: input.type,
        status: input.status,
        requested_at: input.requestedAt,
        generated_data: input.generatedData,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const responseBody = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        reason: `n8n_http_${response.status}`,
        responseBody,
      };
    }

    return {
      ok: true,
      responseBody,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "n8n_request_failed",
    };
  }
}
