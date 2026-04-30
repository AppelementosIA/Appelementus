import { supabase } from "./supabase.js";

type DeleteReportCascadeOptions = {
  abandonLinkedSessions?: boolean;
  force?: boolean;
};

type ReportCleanupResult = {
  found: boolean;
  reportDeleted: boolean;
  reportId: string;
  linkedSessionsUpdated: number | null;
  linkedCampaigns: number;
  jobsDeleted: number | null;
};

const finalReportStatuses = new Set(["approved", "delivered"]);

function isMissingTableError(errorMessage: string) {
  return /does not exist|schema cache/i.test(errorMessage);
}

async function deleteOptionalRows(table: string, column: string, value: string) {
  const { count, error } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .eq(column, value);

  if (error && !isMissingTableError(error.message)) {
    throw new Error(error.message);
  }

  return count ?? null;
}

export async function deleteReportCascade(
  reportId: string,
  options: DeleteReportCascadeOptions = {}
): Promise<ReportCleanupResult> {
  const now = new Date().toISOString();
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id, status")
    .eq("id", reportId)
    .maybeSingle();

  if (reportError) {
    throw new Error(reportError.message);
  }

  if (!report) {
    return {
      found: false,
      reportDeleted: false,
      reportId,
      linkedSessionsUpdated: 0,
      linkedCampaigns: 0,
      jobsDeleted: 0,
    };
  }

  if (finalReportStatuses.has(String(report.status)) && !options.force) {
    throw new Error(
      "Este relatorio ja foi aprovado ou emitido. Para preservar rastreabilidade, arquive em vez de excluir."
    );
  }

  const { data: campaigns, error: campaignsError } = await supabase
    .from("report_campaigns")
    .select("id")
    .eq("report_id", reportId);

  if (campaignsError && !isMissingTableError(campaignsError.message)) {
    throw new Error(campaignsError.message);
  }

  const campaignIds = (campaigns || [])
    .map((campaign) => String((campaign as { id?: unknown }).id || ""))
    .filter(Boolean);
  const sessionPatch: Record<string, unknown> = {
    report_id: null,
    active_campaign_id: null,
    processing_locked_until: null,
    updated_at: now,
  };

  if (options.abandonLinkedSessions) {
    sessionPatch.status = "abandoned";
    sessionPatch.current_step = "discarded_from_platform";
    sessionPatch.closed_at = now;
  }

  const { count: sessionsByReportCount, error: sessionsByReportError } = await supabase
    .from("intake_sessions")
    .update(sessionPatch, { count: "exact" })
    .eq("report_id", reportId);

  if (sessionsByReportError) {
    throw new Error(sessionsByReportError.message);
  }

  let sessionsByCampaignCount: number | null = 0;

  if (campaignIds.length > 0) {
    const { count, error } = await supabase
      .from("intake_sessions")
      .update(sessionPatch, { count: "exact" })
      .in("active_campaign_id", campaignIds);

    if (error) {
      throw new Error(error.message);
    }

    sessionsByCampaignCount = count ?? 0;
  }

  const jobsDeleted = await deleteOptionalRows("jobs_geracao", "report_id", reportId);
  const { error: deleteReportError } = await supabase.from("reports").delete().eq("id", reportId);

  if (deleteReportError) {
    throw new Error(deleteReportError.message);
  }

  return {
    found: true,
    reportDeleted: true,
    reportId,
    linkedSessionsUpdated: (sessionsByReportCount ?? 0) + (sessionsByCampaignCount ?? 0),
    linkedCampaigns: campaignIds.length,
    jobsDeleted,
  };
}
