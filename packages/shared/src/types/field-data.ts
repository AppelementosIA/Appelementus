export interface FieldDataEntry {
  id: string;
  campaign_id: string;
  project_id: string;
  collection_point_id?: string;
  source: FieldDataSource;
  type: FieldDataType;
  status: FieldDataStatus;
  raw_content_url?: string;
  processed_data?: Record<string, unknown>;
  ai_extracted_text?: string;
  validation_issues: ValidationIssue[];
  whatsapp_message_id?: string;
  sent_by?: string;
  received_at: string;
  processed_at?: string;
  created_at: string;
}

export type FieldDataSource = "whatsapp" | "upload" | "manual";

export type FieldDataType =
  | "photo"
  | "audio"
  | "spreadsheet"
  | "pdf"
  | "location"
  | "text"
  | "document";

export type FieldDataStatus =
  | "pending"
  | "processing"
  | "processed"
  | "validated"
  | "rejected"
  | "error";

export interface ValidationIssue {
  id: string;
  field_data_id: string;
  severity: "error" | "warning" | "info";
  type: ValidationType;
  message: string;
  field?: string;
  expected_value?: string;
  actual_value?: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
}

export type ValidationType =
  | "missing_field"
  | "out_of_range"
  | "duplicate"
  | "format_error"
  | "legal_limit_exceeded"
  | "atypical_value"
  | "missing_collection_point";
