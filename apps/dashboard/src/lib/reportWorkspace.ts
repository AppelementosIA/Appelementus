import { sampleReports, type ReportRecord } from "@/data/platform";
import { fetchPlatformReport, savePlatformReport } from "@/lib/platformApi";
import { getStoredReportById, getStoredReports, saveStoredReport } from "@/lib/reportDrafts";

export function cloneReport(report: ReportRecord) {
  return JSON.parse(JSON.stringify(report)) as ReportRecord;
}

export function resolveStoredOrSampleReport(reportId?: string | null) {
  if (reportId) {
    const exactMatch =
      getStoredReportById(reportId) ?? sampleReports.find((item) => item.id === reportId);

    if (exactMatch) {
      return cloneReport(exactMatch);
    }
  }

  const fallback = getStoredReports()[0] ?? sampleReports[0];
  return fallback ? cloneReport(fallback) : null;
}

export async function loadReportRecord(reportId?: string | null) {
  if (reportId) {
    try {
      const platformReport = await fetchPlatformReport(reportId);
      saveStoredReport(platformReport);
      return cloneReport(platformReport);
    } catch {
      return resolveStoredOrSampleReport(reportId);
    }
  }

  return resolveStoredOrSampleReport(reportId);
}

export async function persistReportRecord(nextReport: ReportRecord) {
  const normalized = {
    ...nextReport,
    updatedAt: new Date().toISOString(),
  };

  saveStoredReport(normalized);

  try {
    const saved = await savePlatformReport(normalized);
    saveStoredReport(saved);
    return cloneReport(saved);
  } catch {
    return cloneReport(normalized);
  }
}
