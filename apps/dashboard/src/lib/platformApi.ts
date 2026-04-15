import type { Project, Report, ReportGeneratedData, ReportSectionImage, ReportType } from "@elementus/shared";
import {
  buildDraftReportFromProject,
  buildMicrosoft365Folder,
  buildSectionsForTemplate,
  inferTemplateId,
  makeClientId,
  type ClientRecord,
  type ProjectRecord,
  type ReportRecord,
  type ReportSectionRecord,
} from "@/data/platform";

const apiBaseUrl = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

interface ApiProjectRow extends Project {
  microsoft_365_folder?: string | null;
  technical_lead?: string | null;
  next_delivery?: string | null;
  default_template_id?: string | null;
}

interface ApiReportRow extends Report {
  generated_data?: ReportGeneratedData;
  projects?: Pick<ApiProjectRow, "id" | "name" | "client_name" | "enterprise"> | null;
  report_templates?: {
    id: string;
    name: string;
    type?: ReportType | null;
    template_url?: string | null;
  } | null;
}

function getApiStatus(status: ReportRecord["status"]) {
  if (status === "issued") {
    return "delivered";
  }

  return status;
}

function getPlatformStatus(status: Report["status"]): ReportRecord["status"] {
  if (status === "delivered") {
    return "issued";
  }

  return status === "approved" ? "approved" : status === "review" ? "review" : "draft";
}

function getReportTypeFromTemplate(templateId: string): ReportType {
  if (templateId === "template-implantacao") {
    return "implantation";
  }
  if (templateId === "template-condicionantes") {
    return "semester_condicionante";
  }

  return "quarterly_monitoring";
}

function mapApiProject(project: ApiProjectRow): ProjectRecord {
  return {
    id: project.id,
    clientId: makeClientId(project.client_name),
    name: project.name,
    undertaking: project.enterprise,
    coordinator: project.technical_lead || "Equipe Elementus",
    status:
      project.status === "active"
        ? "active"
        : project.status === "paused"
        ? "paused"
        : "setup",
    nextDelivery: project.next_delivery || "--",
    reportPrefix: "RT",
    microsoft365Folder: buildMicrosoft365Folder(
      project.client_name,
      project.enterprise,
      project.microsoft_365_folder
    ),
    defaultTemplateId:
      project.default_template_id || inferTemplateId(project.condicionante || project.name),
  };
}

function buildClientRecords(projects: ApiProjectRow[]): ClientRecord[] {
  const unique = new Map<string, ClientRecord>();

  for (const project of projects) {
    const clientId = makeClientId(project.client_name);

    if (!unique.has(clientId)) {
      unique.set(clientId, {
        id: clientId,
        name: project.client_name,
        segment: "Operacao ambiental",
        contact: "Conta principal",
        microsoft365Root: `Clientes/${project.client_name}`,
      });
    }
  }

  return Array.from(unique.values());
}

function mapSectionImage(image: ReportSectionImage) {
  return {
    id: image.id,
    sectionId: "",
    name: image.name,
    caption: image.caption,
    addedAt: image.added_at,
    source: image.source === "whatsapp" ? "platform" : image.source,
    previewUrl: image.preview_url,
    microsoft365Url: image.microsoft365_url,
  } as ReportSectionRecord["images"][number];
}

function mapApiSections(report: ApiReportRow, templateId: string): ReportSectionRecord[] {
  const variables = (report.generated_data?.variables || {}) as Record<string, unknown>;
  const sections = report.generated_data?.sections || [];

  if (sections.length > 0) {
    return sections.map((section, index) => ({
      id: section.id || section.key || `section-${index + 1}`,
      number: section.number || String(index + 1),
      title: section.title,
      content: section.content,
      images: (section.images || []).map((image) => ({
        ...mapSectionImage(image),
        sectionId: section.id || section.key || `section-${index + 1}`,
      })),
    }));
  }

  return buildSectionsForTemplate({
    templateId,
    clientName: report.projects?.client_name || "Cliente",
    projectName: report.projects?.name || "Projeto",
    undertaking: report.projects?.enterprise || "Empreendimento",
    period: String(variables.period || "Periodo nao informado"),
    responsibleTechnical: String(variables.responsible_technical || "Equipe Elementus"),
    notes: String(variables.notes || ""),
  });
}

function mapApiReport(report: ApiReportRow): ReportRecord {
  const variables = (report.generated_data?.variables || {}) as Record<string, unknown>;
  const templateId = inferTemplateId(report.report_templates?.type || report.type);
  const projectId = report.project_id;
  const clientId = makeClientId(report.projects?.client_name || "cliente");
  const folderPath = String(
    variables.microsoft365_folder ||
      buildMicrosoft365Folder(
        report.projects?.client_name || "Cliente",
        report.projects?.enterprise || "Empreendimento"
      )
  );

  return {
    id: report.id,
    reportNumber: report.report_number,
    title: report.title,
    clientId,
    projectId,
    templateId,
    status: getPlatformStatus(report.status),
    createdAt: report.created_at,
    updatedAt: report.updated_at,
    period: String(variables.period || "Periodo nao informado"),
    campaignLabel: String(variables.campaign_label || ""),
    responsibleTechnical: String(variables.responsible_technical || "Equipe Elementus"),
    notes: String(variables.notes || ""),
    sections: mapApiSections(report, templateId),
    microsoft365: {
      status:
        String(variables.microsoft365_status || "") === "saved" || report.status === "delivered"
          ? "saved"
          : "pending",
      folderPath,
      lastSavedAt:
        typeof variables.last_saved_at === "string" ? variables.last_saved_at : null,
      folderUrl:
        typeof variables.microsoft365_folder_url === "string"
          ? variables.microsoft365_folder_url
          : null,
      docxUrl:
        report.docx_url ||
        (typeof variables.microsoft365_docx_url === "string"
          ? variables.microsoft365_docx_url
          : null),
      pdfUrl:
        report.pdf_url ||
        (typeof variables.microsoft365_pdf_url === "string"
          ? variables.microsoft365_pdf_url
          : null),
      savedBy:
        typeof variables.microsoft365_saved_by === "string"
          ? variables.microsoft365_saved_by
          : null,
    },
  };
}

function serializeReport(report: ReportRecord) {
  return {
    project_id: report.projectId,
    template_id: report.templateId,
    title: report.title,
    report_number: report.reportNumber,
    type: getReportTypeFromTemplate(report.templateId),
    status: getApiStatus(report.status),
    generated_data: {
      sections: report.sections.map((section) => ({
        id: section.id,
        key: section.id,
        number: section.number,
        title: section.title,
        content: section.content,
        editable: true,
        edited: true,
        images: section.images.map((image) => ({
          id: image.id,
          name: image.name,
          caption: image.caption,
          added_at: image.addedAt,
          source: image.source === "platform" ? "platform" : "upload",
          preview_url: image.previewUrl,
          microsoft365_url: image.microsoft365Url,
        })),
      })),
      charts: [],
      tables: [],
      variables: {
        period: report.period,
        campaign_label: report.campaignLabel,
        responsible_technical: report.responsibleTechnical,
        notes: report.notes,
        microsoft365_folder: report.microsoft365.folderPath,
        microsoft365_status: report.microsoft365.status,
        last_saved_at: report.microsoft365.lastSavedAt,
        microsoft365_folder_url: report.microsoft365.folderUrl,
        microsoft365_docx_url: report.microsoft365.docxUrl,
        microsoft365_pdf_url: report.microsoft365.pdfUrl,
        microsoft365_saved_by: report.microsoft365.savedBy,
      },
      metadata: {},
    },
  };
}

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `API ${response.status} - ${response.statusText}`;

    try {
      const payload = (await response.json()) as { error?: string };
      message = payload.error || message;
    } catch {
      // ignore json parsing errors
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function fetchPlatformProjectsBundle() {
  const projectRows = await requestJson<ApiProjectRow[]>("/projects");

  return {
    clients: buildClientRecords(projectRows),
    projects: projectRows.map(mapApiProject),
  };
}

export async function fetchPlatformReports() {
  const reportRows = await requestJson<ApiReportRow[]>("/reports");
  return reportRows.map(mapApiReport);
}

export async function fetchPlatformReport(reportId: string) {
  const reportRow = await requestJson<ApiReportRow>(`/reports/${reportId}`);
  return mapApiReport(reportRow);
}

export async function createPlatformReportDraft(input: {
  project: ProjectRecord;
  clientName: string;
  templateId: string;
  reportNumber: string;
  period: string;
  campaignLabel: string;
  responsibleTechnical: string;
  notes: string;
}) {
  const draft = buildDraftReportFromProject({
    project: input.project,
    clientName: input.clientName,
    templateId: input.templateId,
    reportNumber: input.reportNumber,
    period: input.period,
    campaignLabel: input.campaignLabel,
    responsibleTechnical: input.responsibleTechnical,
    notes: input.notes,
  });

  draft.microsoft365.folderPath = input.project.microsoft365Folder;
  draft.clientId = input.project.clientId;

  const reportRow = await requestJson<ApiReportRow>("/reports/generate", {
    method: "POST",
    body: JSON.stringify({
      project_id: draft.projectId,
      template_id: draft.templateId,
      title: draft.title,
      report_number: draft.reportNumber,
      type: getReportTypeFromTemplate(draft.templateId),
      status: "draft",
      version: 1,
      sections: serializeReport(draft).generated_data.sections,
      variables: {
        period: draft.period,
        campaign_label: draft.campaignLabel,
        responsible_technical: draft.responsibleTechnical,
        notes: draft.notes,
        microsoft365_folder: draft.microsoft365.folderPath,
        microsoft365_status: draft.microsoft365.status,
      },
      charts: [],
      tables: [],
      metadata: {},
    }),
  });

  return mapApiReport(reportRow);
}

export async function savePlatformReport(report: ReportRecord) {
  const reportRow = await requestJson<ApiReportRow>(`/reports/${report.id}`, {
    method: "PATCH",
    body: JSON.stringify(serializeReport(report)),
  });

  return mapApiReport(reportRow);
}

export async function issuePlatformReport(input: {
  report: ReportRecord;
  accessToken: string;
  emittedBy?: {
    name?: string;
    email?: string;
  };
}) {
  const reportRow = await requestJson<ApiReportRow>(
    `/reports/${input.report.id}/microsoft-365/save`,
    {
      method: "POST",
      body: JSON.stringify({
        microsoft_access_token: input.accessToken,
        emitted_by: input.emittedBy,
        report: serializeReport({
          ...input.report,
          status: input.report.status === "issued" ? "review" : input.report.status,
        }),
      }),
    }
  );

  return mapApiReport(reportRow);
}
