export interface Campaign {
  id: string;
  project_id: string;
  name: string;
  type: CampaignType;
  period_start: string;
  period_end: string;
  status: CampaignStatus;
  collection_points: CollectionPoint[];
  responsible_technician?: string;
  observations?: string;
  created_at: string;
  updated_at: string;
}

export type CampaignType =
  | "fauna"
  | "flora"
  | "water"
  | "soil"
  | "noise"
  | "reforestation"
  | "condicionante"
  | "other";

export type CampaignStatus =
  | "planning"
  | "in_field"
  | "data_collection"
  | "processing"
  | "review"
  | "completed";

export interface CollectionPoint {
  id: string;
  campaign_id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  description?: string;
}
