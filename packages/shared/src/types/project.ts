export interface Project {
  id: string;
  name: string;
  client_name: string;
  client_logo_url?: string;
  enterprise: string;
  description?: string;
  environmental_permit?: string;
  condicionante?: string;
  organ: EnvironmentalOrgan;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export type ProjectStatus = "active" | "paused" | "completed" | "archived";

export type EnvironmentalOrgan =
  | "IBAMA"
  | "IGAM"
  | "SUPRAM"
  | "CETESB"
  | "IEF"
  | "SEMAD"
  | "OTHER";

export interface ProjectCreateInput {
  name: string;
  client_name: string;
  enterprise: string;
  description?: string;
  environmental_permit?: string;
  condicionante?: string;
  organ: EnvironmentalOrgan;
}
