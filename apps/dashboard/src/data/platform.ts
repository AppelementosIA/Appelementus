export type ReportStatus = "draft" | "review" | "approved" | "issued";

export interface ClientRecord {
  id: string;
  name: string;
  segment: string;
  contact: string;
  microsoft365Root: string;
}

export interface ProjectRecord {
  id: string;
  clientId: string;
  name: string;
  undertaking: string;
  coordinator: string;
  status: "active" | "setup" | "paused";
  nextDelivery: string;
  reportPrefix: string;
  microsoft365Folder: string;
  defaultTemplateId: string;
}

export interface TemplateRecord {
  id: string;
  name: string;
  description: string;
  category: string;
  sections: Array<{ id: string; number: string; title: string }>;
}

export interface AttachmentRecord {
  id: string;
  sectionId: string;
  name: string;
  caption: string;
  addedAt: string;
  source: "upload" | "platform";
  previewUrl?: string;
  microsoft365Url?: string;
}

export interface ReportSectionRecord {
  id: string;
  number: string;
  title: string;
  content: string;
  images: AttachmentRecord[];
}

export interface ReportRecord {
  id: string;
  reportNumber: string;
  title: string;
  clientId: string;
  projectId: string;
  templateId: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  period: string;
  campaignLabel: string;
  responsibleTechnical: string;
  notes: string;
  sections: ReportSectionRecord[];
  microsoft365: {
    status: "pending" | "saved";
    folderPath: string;
    lastSavedAt: string | null;
    folderUrl?: string | null;
    docxUrl?: string | null;
    pdfUrl?: string | null;
    savedBy?: string | null;
  };
}

export const clients: ClientRecord[] = [
  {
    id: "client-caern",
    name: "CAERN",
    segment: "Saneamento",
    contact: "Equipe de licenciamento",
    microsoft365Root: "Clientes/CAERN",
  },
  {
    id: "client-engie",
    name: "Engie",
    segment: "Energia",
    contact: "Time de monitoramento",
    microsoft365Root: "Clientes/Engie",
  },
  {
    id: "client-anglo",
    name: "Anglo American",
    segment: "Mineracao",
    contact: "Coordenacao ambiental",
    microsoft365Root: "Clientes/Anglo American",
  },
];

export const projects: ProjectRecord[] = [
  {
    id: "project-caern-jaguaribe",
    clientId: "client-caern",
    name: "Reposicao Florestal CAERN",
    undertaking: "ETE Jaguaribe",
    coordinator: "Pedro Almeida",
    status: "active",
    nextDelivery: "22/04/2026",
    reportPrefix: "RT",
    microsoft365Folder: "Clientes/CAERN/ETE Jaguaribe/Relatorios",
    defaultTemplateId: "template-implantacao",
  },
  {
    id: "project-engie-fauna",
    clientId: "client-engie",
    name: "Monitoramento de Fauna Engie",
    undertaking: "Complexo Eolico Assu V",
    coordinator: "Ana Souza",
    status: "active",
    nextDelivery: "30/04/2026",
    reportPrefix: "RT",
    microsoft365Folder: "Clientes/Engie/Complexo Eolico Assu V/Relatorios",
    defaultTemplateId: "template-monitoramento",
  },
  {
    id: "project-anglo-agua",
    clientId: "client-anglo",
    name: "Qualidade da Agua Anglo",
    undertaking: "Mina Minas-Rio",
    coordinator: "Maria Costa",
    status: "setup",
    nextDelivery: "15/05/2026",
    reportPrefix: "RT",
    microsoft365Folder: "Clientes/Anglo American/Mina Minas-Rio/Relatorios",
    defaultTemplateId: "template-condicionantes",
  },
];

export const reportTemplates: TemplateRecord[] = [
  {
    id: "template-implantacao",
    name: "Relatorio de Implantacao",
    description: "Fluxo para implantacao, reposicao florestal e registro de execucao em campo.",
    category: "Implantacao",
    sections: [
      { id: "presentation", number: "1", title: "Apresentacao" },
      { id: "general", number: "2", title: "Informacoes Gerais" },
      { id: "activities", number: "3", title: "Atividades Realizadas" },
      { id: "photos", number: "4", title: "Registro Fotografico" },
      { id: "conclusion", number: "5", title: "Conclusao" },
    ],
  },
  {
    id: "template-monitoramento",
    name: "Monitoramento Trimestral",
    description: "Fluxo para relatorios periodicos com analise de campanha, anexos e consolidacao.",
    category: "Monitoramento",
    sections: [
      { id: "presentation", number: "1", title: "Apresentacao" },
      { id: "objective", number: "2", title: "Objetivo" },
      { id: "results", number: "3", title: "Resultados da Campanha" },
      { id: "photos", number: "4", title: "Evidencias e Imagens" },
      { id: "conclusion", number: "5", title: "Conclusao" },
    ],
  },
  {
    id: "template-condicionantes",
    name: "Relatorio Semestral de Condicionantes",
    description: "Fluxo para condicionantes com campos padrao, anexos e emissao formal.",
    category: "Condicionantes",
    sections: [
      { id: "presentation", number: "1", title: "Apresentacao" },
      { id: "scope", number: "2", title: "Escopo de Atendimento" },
      { id: "results", number: "3", title: "Resultados" },
      { id: "photos", number: "4", title: "Anexos Visuais" },
      { id: "conclusion", number: "5", title: "Conclusao" },
    ],
  },
];

export const reportStatusMeta: Record<
  ReportStatus,
  { label: string; variant: "default" | "warning" | "success" | "info" }
> = {
  draft: { label: "Rascunho", variant: "default" },
  review: { label: "Em revisao", variant: "warning" },
  approved: { label: "Aprovado", variant: "info" },
  issued: { label: "Emitido", variant: "success" },
};

export function makeClientId(name: string) {
  return `client-${name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

export function buildMicrosoft365Folder(clientName: string, undertaking: string, explicitPath?: string | null) {
  if (explicitPath) {
    return explicitPath;
  }

  return `Clientes/${clientName}/${undertaking}/Relatorios`;
}

export function inferTemplateId(value?: string | null) {
  const normalized = (value ?? "").toLowerCase();

  if (normalized.includes("implant")) {
    return "template-implantacao";
  }
  if (normalized.includes("condicion")) {
    return "template-condicionantes";
  }

  return "template-monitoramento";
}

export function getClientById(clientId: string) {
  return clients.find((client) => client.id === clientId);
}

export function getProjectById(projectId: string) {
  return projects.find((project) => project.id === projectId);
}

export function getTemplateById(templateId: string) {
  return reportTemplates.find((template) => template.id === templateId);
}

export function buildSectionsForTemplate(input: {
  templateId: string;
  clientName: string;
  projectName: string;
  undertaking: string;
  period: string;
  responsibleTechnical: string;
  notes?: string;
}) {
  const template = getTemplateById(input.templateId);

  if (!template) {
    return [];
  }

  return template.sections.map((section) => ({
    id: section.id,
    number: section.number,
    title: section.title,
    content: buildSectionContent({
      sectionId: section.id,
      clientName: input.clientName,
      projectName: input.projectName,
      undertaking: input.undertaking,
      period: input.period,
      responsibleTechnical: input.responsibleTechnical,
      notes: input.notes ?? "",
    }),
    images: [],
  }));
}

interface BuildDraftInput {
  projectId: string;
  templateId: string;
  reportNumber: string;
  period: string;
  campaignLabel: string;
  responsibleTechnical: string;
  notes?: string;
}

interface BuildDraftFromProjectInput {
  project: ProjectRecord;
  clientName: string;
  templateId: string;
  reportNumber: string;
  period: string;
  campaignLabel: string;
  responsibleTechnical: string;
  notes?: string;
}

export function buildDraftReportFromProject(input: BuildDraftFromProjectInput): ReportRecord {
  const template = getTemplateById(input.templateId);

  if (!template) {
    throw new Error("Template nao encontrado para criar o relatorio.");
  }

  const now = new Date().toISOString();

  const sections: ReportSectionRecord[] = buildSectionsForTemplate({
    templateId: template.id,
    clientName: input.clientName,
    projectName: input.project.name,
    undertaking: input.project.undertaking,
    period: input.period,
    responsibleTechnical: input.responsibleTechnical,
    notes: input.notes ?? "",
  });

  return {
    id: `draft-${Date.now()}`,
    reportNumber: input.reportNumber,
    title: `${template.name} - ${input.project.undertaking}`,
    clientId: input.project.clientId,
    projectId: input.project.id,
    templateId: template.id,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    period: input.period,
    campaignLabel: input.campaignLabel,
    responsibleTechnical: input.responsibleTechnical,
    notes: input.notes ?? "",
    sections,
    microsoft365: {
      status: "pending",
      folderPath: input.project.microsoft365Folder,
      lastSavedAt: null,
      folderUrl: null,
      docxUrl: null,
      pdfUrl: null,
      savedBy: null,
    },
  };
}

export function buildDraftReport(input: BuildDraftInput): ReportRecord {
  const project = getProjectById(input.projectId);
  const template = getTemplateById(input.templateId);

  if (!project || !template) {
    throw new Error("Projeto ou template nao encontrado para criar o relatorio.");
  }

  const client = getClientById(project.clientId);

  return buildDraftReportFromProject({
    project,
    clientName: client?.name ?? "",
    templateId: template.id,
    reportNumber: input.reportNumber,
    period: input.period,
    campaignLabel: input.campaignLabel,
    responsibleTechnical: input.responsibleTechnical,
    notes: input.notes,
  });
}

function buildSectionContent(input: {
  sectionId: string;
  clientName: string;
  projectName: string;
  undertaking: string;
  period: string;
  responsibleTechnical: string;
  notes: string;
}) {
  const noteSuffix = input.notes
    ? `\n\nObservacoes iniciais do time: ${input.notes}`
    : "";

  switch (input.sectionId) {
    case "presentation":
      return `Este relatorio apresenta a execucao referente ao projeto ${input.projectName}, vinculado ao empreendimento ${input.undertaking}, para o cliente ${input.clientName}. O documento foi aberto na plataforma base da Elementus para consolidar conteudo tecnico, anexos e emissao final.${noteSuffix}`;
    case "general":
    case "objective":
    case "scope":
      return `Periodo de referencia: ${input.period}. Responsavel tecnico principal: ${input.responsibleTechnical}. Os dados cadastrais do cliente, projeto e empreendimento foram puxados automaticamente da base central da plataforma.`;
    case "activities":
    case "results":
      return `Registrar aqui o resumo tecnico das atividades realizadas na campanha, os principais resultados obtidos e os pontos que ainda dependem de complemento pelo tecnico. Este bloco ja nasce pronto para edicao antes da emissao.`;
    case "photos":
      return "Area destinada a anexos e evidencias visuais. O tecnico pode organizar as imagens por secao antes de gerar o arquivo final.";
    case "conclusion":
      return "Conclusao preliminar aberta para revisao. Este texto deve ser ajustado pelo tecnico antes da emissao final do relatorio.";
    default:
      return "Conteudo inicial do relatorio.";
  }
}

const reviewSeed = buildDraftReport({
  projectId: "project-caern-jaguaribe",
  templateId: "template-implantacao",
  reportNumber: "RT-812/2026",
  period: "Abril de 2026",
  campaignLabel: "Implantacao - Etapa 2",
  responsibleTechnical: "Eng. Pedro Almeida - CREA 123456/D",
  notes: "Destacar o setor leste e o cronograma de plantio.",
});

reviewSeed.id = "report-caern-review";
reviewSeed.status = "review";
reviewSeed.createdAt = "2026-04-12T09:30:00.000Z";
reviewSeed.updatedAt = "2026-04-14T14:20:00.000Z";
reviewSeed.sections[3].images = [
  {
    id: "attachment-demo-1",
    sectionId: "photos",
    name: "plantio-setor-leste.jpg",
    caption: "Vista geral do plantio no setor leste.",
    addedAt: "2026-04-14T14:10:00.000Z",
    source: "platform",
  },
];

const issuedSeed = buildDraftReport({
  projectId: "project-engie-fauna",
  templateId: "template-monitoramento",
  reportNumber: "RT-811/2026",
  period: "1o trimestre de 2026",
  campaignLabel: "Campanha trimestral Q1",
  responsibleTechnical: "Biol. Ana Souza - CRBIO 98765/06",
});

issuedSeed.id = "report-engie-issued";
issuedSeed.status = "issued";
issuedSeed.createdAt = "2026-04-08T10:00:00.000Z";
issuedSeed.updatedAt = "2026-04-10T16:40:00.000Z";
issuedSeed.microsoft365.status = "saved";
issuedSeed.microsoft365.lastSavedAt = "2026-04-10T16:40:00.000Z";
issuedSeed.microsoft365.docxUrl = "https://microsoft365.elementus.local/RT-811-2026.docx";
issuedSeed.microsoft365.folderUrl =
  "https://microsoft365.elementus.local/clientes/engie/complexo-eolico-assu-v/relatorios";
issuedSeed.microsoft365.savedBy = "ana.souza@elementus.com.br";

export const sampleReports: ReportRecord[] = [reviewSeed, issuedSeed];
