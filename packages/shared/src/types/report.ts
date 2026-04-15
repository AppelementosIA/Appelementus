export interface Report {
  id: string;
  project_id: string;
  campaign_id?: string;
  template_id: string;
  title: string;
  report_number: string;
  type: ReportType;
  status: ReportStatus;
  generated_data?: ReportGeneratedData;
  docx_url?: string;
  pdf_url?: string;
  version: number;
  generated_at?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export type ReportType =
  | "implantation"
  | "quarterly_monitoring"
  | "semester_condicionante"
  | "annual_consolidated"
  | "technical_opinion";

export type ReportStatus =
  | "draft"
  | "generating"
  | "review"
  | "approved"
  | "delivered"
  | "archived";

export interface ReportGeneratedData {
  sections: ReportSection[];
  charts: ReportChart[];
  tables: ReportTable[];
  variables: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ReportSection {
  id: string;
  key: string;
  number?: string;
  title: string;
  content: string;
  editable: boolean;
  edited?: boolean;
  images?: ReportSectionImage[];
}

export interface ReportSectionImage {
  id: string;
  name: string;
  caption: string;
  added_at: string;
  source: "upload" | "platform" | "whatsapp";
  preview_url?: string;
  microsoft365_url?: string;
}

export interface ReportChart {
  id: string;
  type: "bar" | "line" | "pie" | "donut" | "scatter";
  title: string;
  data: Record<string, unknown>[];
  image_url?: string;
}

export interface ReportTable {
  id: string;
  title: string;
  headers: string[];
  rows: string[][];
}

export interface ReportTemplate {
  id: string;
  name: string;
  type: ReportType;
  description?: string;
  template_url: string;
  placeholders: TemplatePlaceholder[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplatePlaceholder {
  key: string;
  label: string;
  type: "text" | "table" | "chart" | "image" | "list";
  required: boolean;
  description?: string;
}
