import type { ReportRecord } from "@/data/platform";

const STORAGE_KEY = "elementus-stage1-reports";

export function getStoredReports(): ReportRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as ReportRecord[];
  } catch {
    return [];
  }
}

export function getStoredReportById(reportId: string) {
  return getStoredReports().find((report) => report.id === reportId);
}

export function saveStoredReport(report: ReportRecord) {
  if (typeof window === "undefined") {
    return;
  }

  const current = getStoredReports().filter((item) => item.id !== report.id);
  current.unshift(report);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}
