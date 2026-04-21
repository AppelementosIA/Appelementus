export type WorkflowStage = "entrada" | "montagem" | "relatorio" | "imagens" | "envio";

export type WorkflowOperationalStatus =
  | "awaiting_data"
  | "ready_for_ai"
  | "draft_ready"
  | "image_review"
  | "ready_to_send";

export type WorkflowFieldStatus = "captured" | "missing" | "erp";

export interface WorkflowFieldRecord {
  id: string;
  label: string;
  value: string;
  status: WorkflowFieldStatus;
}

export interface WorkflowPhotoRecord {
  id: string;
  name: string;
  caption: string;
  capturedAt: string;
  location: string;
  suggestedSectionId: string;
  source: "whatsapp";
}

export interface WorkflowTimelineRecord {
  id: string;
  actor: "technician" | "bot" | "erp";
  channel: "whatsapp" | "platform" | "erp";
  at: string;
  message: string;
}

export interface WorkflowCaseRecord {
  id: string;
  protocol: string;
  stage: WorkflowStage;
  operationalStatus: WorkflowOperationalStatus;
  priority: "high" | "medium" | "low";
  technicianName: string;
  startedAt: string;
  updatedAt: string;
  clientName: string;
  location: string;
  serviceType: string;
  projectId: string;
  templateId: string;
  summary: string;
  nextAction: string;
  nextQuestion: string;
  missingFieldLabels: string[];
  extractedFields: WorkflowFieldRecord[];
  aiInstruction: string;
  erpContact: {
    name: string;
    email: string;
    phone: string;
    source: "erp" | "manual";
  };
  images: WorkflowPhotoRecord[];
  timeline: WorkflowTimelineRecord[];
  draftInput: {
    reportNumber: string;
    period: string;
    campaignLabel: string;
    responsibleTechnical: string;
    notes: string;
  };
  linkedReportId?: string;
}

export const workflowStageOrder: WorkflowStage[] = [
  "entrada",
  "montagem",
  "relatorio",
  "imagens",
  "envio",
];

export const workflowStageMeta: Record<
  WorkflowStage,
  { label: string; href: string; description: string }
> = {
  entrada: {
    label: "Entrada",
    href: "/entrada",
    description: "Atendimentos vivos vindos do WhatsApp.",
  },
  montagem: {
    label: "Montagem",
    href: "/montagem",
    description: "Dados extraidos, lacunas e disparo da IA.",
  },
  relatorio: {
    label: "Relatorio",
    href: "/relatorio",
    description: "Primeira versao em blocos para revisao tecnica.",
  },
  imagens: {
    label: "Imagens",
    href: "/imagens",
    description: "Encaixe visual das evidencias no relatorio.",
  },
  envio: {
    label: "Envio",
    href: "/envio",
    description: "Conferencia final, documento e e-mail ao cliente.",
  },
};

export const workflowOperationalStatusMeta: Record<
  WorkflowOperationalStatus,
  { label: string; variant: "warning" | "info" | "success" | "outline" }
> = {
  awaiting_data: { label: "Aguardando dados", variant: "warning" },
  ready_for_ai: { label: "Pronto para IA", variant: "info" },
  draft_ready: { label: "Minuta em revisao", variant: "outline" },
  image_review: { label: "Imagens em encaixe", variant: "outline" },
  ready_to_send: { label: "Pronto para envio", variant: "success" },
};

export const workflowPriorityMeta = {
  high: { label: "Alta", className: "bg-rose-100 text-rose-700" },
  medium: { label: "Media", className: "bg-amber-100 text-amber-700" },
  low: { label: "Baixa", className: "bg-emerald-100 text-emerald-700" },
} as const;

export const workflowCases: WorkflowCaseRecord[] = [
  {
    id: "case-engie-2841",
    protocol: "WA-2841",
    stage: "entrada",
    operationalStatus: "awaiting_data",
    priority: "high",
    technicianName: "Ramon Costa",
    startedAt: "2026-04-20T12:05:00.000Z",
    updatedAt: "2026-04-20T12:27:00.000Z",
    clientName: "Engie",
    location: "Complexo Eolico Assu V - setor norte",
    serviceType: "Monitoramento de fauna",
    projectId: "project-engie-fauna",
    templateId: "template-monitoramento",
    summary:
      "Tecnico abriu o atendimento pelo WhatsApp, descreveu a campanha e enviou fotos, mas ainda faltam dados de periodo e coordenadas de um ponto de coleta.",
    nextAction:
      "Bot precisa concluir as perguntas pendentes antes de liberar a geracao da minuta.",
    nextQuestion:
      "Confirmar periodo da campanha, coordenadas do ponto 4 e a quantidade de registros do setor norte.",
    missingFieldLabels: [
      "Periodo da campanha",
      "Coordenadas do ponto 4",
      "Quantidade de registros do setor norte",
    ],
    extractedFields: [
      { id: "client", label: "Cliente", value: "Engie", status: "captured" },
      {
        id: "location",
        label: "Local",
        value: "Complexo Eolico Assu V - setor norte",
        status: "captured",
      },
      {
        id: "service",
        label: "Tipo de servico",
        value: "Monitoramento de fauna",
        status: "captured",
      },
      {
        id: "period",
        label: "Periodo da campanha",
        value: "Aguardando confirmacao do tecnico",
        status: "missing",
      },
      {
        id: "contact",
        label: "Contato ERP",
        value: "Larissa Melo - larissa.melo@engie.com",
        status: "erp",
      },
    ],
    aiInstruction:
      "Quando os campos faltantes forem respondidos, gerar uma primeira versao com foco nos resultados da campanha, pontos de ausencia e necessidade de revisita do setor norte.",
    erpContact: {
      name: "Larissa Melo",
      email: "larissa.melo@engie.com",
      phone: "(84) 99999-1200",
      source: "erp",
    },
    images: [
      {
        id: "engie-photo-1",
        name: "ponto-3-setor-norte.jpg",
        caption: "Registro do ponto 3 no setor norte.",
        capturedAt: "2026-04-20T12:18:00.000Z",
        location: "Setor norte",
        suggestedSectionId: "photos",
        source: "whatsapp",
      },
      {
        id: "engie-photo-2",
        name: "armadilha-aerea.jpg",
        caption: "Armadilha aerea instalada proxima ao talude.",
        capturedAt: "2026-04-20T12:19:00.000Z",
        location: "Talude leste",
        suggestedSectionId: "photos",
        source: "whatsapp",
      },
    ],
    timeline: [
      {
        id: "engie-msg-1",
        actor: "technician",
        channel: "whatsapp",
        at: "2026-04-20T12:05:00.000Z",
        message: "Cheguei no setor norte. Vou mandar os dados da campanha agora.",
      },
      {
        id: "engie-msg-2",
        actor: "bot",
        channel: "whatsapp",
        at: "2026-04-20T12:08:00.000Z",
        message: "Perfeito. Ja identifiquei cliente, local e tipo de servico. Falta o periodo da campanha e o ponto 4.",
      },
      {
        id: "engie-msg-3",
        actor: "erp",
        channel: "erp",
        at: "2026-04-20T12:22:00.000Z",
        message: "Contato do ERP vinculado automaticamente ao atendimento.",
      },
    ],
    draftInput: {
      reportNumber: "RT-814/2026",
      period: "Abril de 2026",
      campaignLabel: "Campanha abril - setor norte",
      responsibleTechnical: "Biol. Ramon Costa - CRBio 12345/06",
      notes:
        "Registrar no texto que o ponto 4 ainda depende de complemento enviado pelo tecnico.",
    },
  },
  {
    id: "case-caern-2839",
    protocol: "WA-2839",
    stage: "montagem",
    operationalStatus: "ready_for_ai",
    priority: "medium",
    technicianName: "Pedro Almeida",
    startedAt: "2026-04-20T10:12:00.000Z",
    updatedAt: "2026-04-20T11:03:00.000Z",
    clientName: "CAERN",
    location: "ETE Jaguaribe - setor leste",
    serviceType: "Reposicao florestal",
    projectId: "project-caern-jaguaribe",
    templateId: "template-implantacao",
    summary:
      "Atendimento completo vindo do WhatsApp com dados minimos, contexto tecnico e evidencias iniciais para abrir a minuta.",
    nextAction:
      "Gerar a primeira versao com IA, revisar a narrativa tecnica e seguir para distribuicao das imagens.",
    nextQuestion:
      "Nenhuma pergunta pendente. Atendimento pronto para virar relatorio em montagem.",
    missingFieldLabels: [],
    extractedFields: [
      { id: "client", label: "Cliente", value: "CAERN", status: "captured" },
      {
        id: "location",
        label: "Local",
        value: "ETE Jaguaribe - setor leste",
        status: "captured",
      },
      {
        id: "service",
        label: "Tipo de servico",
        value: "Reposicao florestal",
        status: "captured",
      },
      {
        id: "period",
        label: "Periodo",
        value: "Abril de 2026",
        status: "captured",
      },
      {
        id: "contact",
        label: "Contato ERP",
        value: "Equipe de licenciamento - licenciamento@caern.com.br",
        status: "erp",
      },
    ],
    aiInstruction:
      "Gerar minuta destacando a execucao no setor leste, o cronograma de plantio e os pontos que ja podem ser revisados antes da emissao final.",
    erpContact: {
      name: "Equipe de licenciamento",
      email: "licenciamento@caern.com.br",
      phone: "(84) 98888-4500",
      source: "erp",
    },
    images: [
      {
        id: "caern-photo-1",
        name: "plantio-setor-leste.jpg",
        caption: "Vista geral do plantio no setor leste.",
        capturedAt: "2026-04-20T10:28:00.000Z",
        location: "Setor leste",
        suggestedSectionId: "photos",
        source: "whatsapp",
      },
      {
        id: "caern-photo-2",
        name: "equipe-campo.jpg",
        caption: "Equipe em atividade na frente de servico.",
        capturedAt: "2026-04-20T10:31:00.000Z",
        location: "Frente de servico",
        suggestedSectionId: "activities",
        source: "whatsapp",
      },
      {
        id: "caern-photo-3",
        name: "mudas-preparadas.jpg",
        caption: "Mudas preparadas para distribuicao no setor leste.",
        capturedAt: "2026-04-20T10:33:00.000Z",
        location: "Area de apoio",
        suggestedSectionId: "photos",
        source: "whatsapp",
      },
    ],
    timeline: [
      {
        id: "caern-msg-1",
        actor: "technician",
        channel: "whatsapp",
        at: "2026-04-20T10:12:00.000Z",
        message: "Servico concluido no setor leste. Seguem dados e imagens.",
      },
      {
        id: "caern-msg-2",
        actor: "bot",
        channel: "whatsapp",
        at: "2026-04-20T10:20:00.000Z",
        message: "Cliente, local, periodo e tipo de servico confirmados. Atendimento pronto para montagem.",
      },
      {
        id: "caern-msg-3",
        actor: "erp",
        channel: "erp",
        at: "2026-04-20T10:25:00.000Z",
        message: "Contato de licenciamento encontrado no ERP e anexado ao atendimento.",
      },
    ],
    draftInput: {
      reportNumber: "RT-813/2026",
      period: "Abril de 2026",
      campaignLabel: "Implantacao - setor leste",
      responsibleTechnical: "Eng. Pedro Almeida - CREA 123456/D",
      notes: "Destacar o setor leste e o cronograma de plantio desta frente.",
    },
  },
  {
    id: "case-caern-2837",
    protocol: "WA-2837",
    stage: "relatorio",
    operationalStatus: "draft_ready",
    priority: "medium",
    technicianName: "Pedro Almeida",
    startedAt: "2026-04-19T15:05:00.000Z",
    updatedAt: "2026-04-20T09:41:00.000Z",
    clientName: "CAERN",
    location: "ETE Jaguaribe - setor leste",
    serviceType: "Reposicao florestal",
    projectId: "project-caern-jaguaribe",
    templateId: "template-implantacao",
    summary:
      "Minuta gerada pela IA ja aberta para revisao textual. O tecnico precisa alinhar a secao de atividades e ajustar a conclusao.",
    nextAction:
      "Concluir revisao dos blocos textuais e seguir para o encaixe final das imagens.",
    nextQuestion:
      "Validar se a conclusao precisa mencionar a janela de replantio da proxima semana.",
    missingFieldLabels: [],
    extractedFields: [
      { id: "client", label: "Cliente", value: "CAERN", status: "captured" },
      {
        id: "location",
        label: "Local",
        value: "ETE Jaguaribe - setor leste",
        status: "captured",
      },
      {
        id: "service",
        label: "Tipo de servico",
        value: "Reposicao florestal",
        status: "captured",
      },
      {
        id: "contact",
        label: "Contato ERP",
        value: "Equipe de licenciamento - licenciamento@caern.com.br",
        status: "erp",
      },
    ],
    aiInstruction:
      "A IA ja abriu a primeira versao. Agora o foco e aparar texto, garantir clareza tecnica e preparar o relatorio para a distribuicao das evidencias.",
    erpContact: {
      name: "Equipe de licenciamento",
      email: "licenciamento@caern.com.br",
      phone: "(84) 98888-4500",
      source: "erp",
    },
    images: [
      {
        id: "caern-photo-4",
        name: "setor-leste-geral.jpg",
        caption: "Visao geral da area reflorestada.",
        capturedAt: "2026-04-19T15:22:00.000Z",
        location: "Setor leste",
        suggestedSectionId: "photos",
        source: "whatsapp",
      },
    ],
    timeline: [
      {
        id: "caern-review-1",
        actor: "bot",
        channel: "platform",
        at: "2026-04-20T08:55:00.000Z",
        message: "Primeira versao montada com IA a partir do atendimento do WhatsApp.",
      },
      {
        id: "caern-review-2",
        actor: "technician",
        channel: "platform",
        at: "2026-04-20T09:20:00.000Z",
        message: "Revisar bloco de atividades e reforcar o cronograma na conclusao.",
      },
    ],
    draftInput: {
      reportNumber: "RT-812/2026",
      period: "Abril de 2026",
      campaignLabel: "Implantacao - Etapa 2",
      responsibleTechnical: "Eng. Pedro Almeida - CREA 123456/D",
      notes: "Revisar bloco de atividades e reforcar o cronograma da proxima semana.",
    },
    linkedReportId: "report-caern-review",
  },
  {
    id: "case-caern-2836",
    protocol: "WA-2836",
    stage: "imagens",
    operationalStatus: "image_review",
    priority: "low",
    technicianName: "Pedro Almeida",
    startedAt: "2026-04-19T13:10:00.000Z",
    updatedAt: "2026-04-20T08:12:00.000Z",
    clientName: "CAERN",
    location: "ETE Jaguaribe - setor leste",
    serviceType: "Reposicao florestal",
    projectId: "project-caern-jaguaribe",
    templateId: "template-implantacao",
    summary:
      "Texto revisado. Falta distribuir as fotos recebidas no WhatsApp pelos blocos certos do relatorio antes do envio.",
    nextAction:
      "Associar cada imagem a sua secao, validar legendas e liberar o pacote final.",
    nextQuestion:
      "Conferir se a imagem da equipe deve entrar em atividades ou permanecer em registro fotografico.",
    missingFieldLabels: [],
    extractedFields: [
      { id: "client", label: "Cliente", value: "CAERN", status: "captured" },
      {
        id: "location",
        label: "Local",
        value: "ETE Jaguaribe - setor leste",
        status: "captured",
      },
      {
        id: "contact",
        label: "Contato ERP",
        value: "Equipe de licenciamento - licenciamento@caern.com.br",
        status: "erp",
      },
    ],
    aiInstruction:
      "Nesta etapa a plataforma vira uma mesa de encaixe visual: relaciona a evidencias recebidas com as secoes corretas do relatorio.",
    erpContact: {
      name: "Equipe de licenciamento",
      email: "licenciamento@caern.com.br",
      phone: "(84) 98888-4500",
      source: "erp",
    },
    images: [
      {
        id: "caern-photo-5",
        name: "equipe-campo-frente.jpg",
        caption: "Equipe operando na frente de servico.",
        capturedAt: "2026-04-19T13:30:00.000Z",
        location: "Frente de servico",
        suggestedSectionId: "activities",
        source: "whatsapp",
      },
      {
        id: "caern-photo-6",
        name: "mudas-setor-leste.jpg",
        caption: "Distribuicao das mudas no setor leste.",
        capturedAt: "2026-04-19T13:32:00.000Z",
        location: "Setor leste",
        suggestedSectionId: "photos",
        source: "whatsapp",
      },
      {
        id: "caern-photo-7",
        name: "preparo-solo.jpg",
        caption: "Preparo do solo concluido antes do plantio.",
        capturedAt: "2026-04-19T13:36:00.000Z",
        location: "Setor leste",
        suggestedSectionId: "general",
        source: "whatsapp",
      },
    ],
    timeline: [
      {
        id: "caern-image-1",
        actor: "bot",
        channel: "platform",
        at: "2026-04-20T07:55:00.000Z",
        message: "Relatorio revisado. Restam tres imagens sem encaixe definitivo.",
      },
      {
        id: "caern-image-2",
        actor: "technician",
        channel: "platform",
        at: "2026-04-20T08:12:00.000Z",
        message: "Separar fotos de atividades e evidencias gerais antes de encaminhar.",
      },
    ],
    draftInput: {
      reportNumber: "RT-812/2026",
      period: "Abril de 2026",
      campaignLabel: "Implantacao - Etapa 2",
      responsibleTechnical: "Eng. Pedro Almeida - CREA 123456/D",
      notes: "Restam tres imagens para encaixar antes do envio.",
    },
    linkedReportId: "report-caern-review",
  },
  {
    id: "case-engie-2835",
    protocol: "WA-2835",
    stage: "envio",
    operationalStatus: "ready_to_send",
    priority: "medium",
    technicianName: "Ana Souza",
    startedAt: "2026-04-18T09:20:00.000Z",
    updatedAt: "2026-04-20T07:48:00.000Z",
    clientName: "Engie",
    location: "Complexo Eolico Assu V",
    serviceType: "Monitoramento trimestral",
    projectId: "project-engie-fauna",
    templateId: "template-monitoramento",
    summary:
      "Relatorio final revisado, contato ERP encontrado e pacote pronto para abrir o e-mail de encaminhamento.",
    nextAction:
      "Confirmar salvamento do documento final e abrir o e-mail ja preenchido com o destinatario do ERP.",
    nextQuestion:
      "Apenas validar se o assunto do e-mail deve mencionar a campanha trimestral ou o numero interno.",
    missingFieldLabels: [],
    extractedFields: [
      { id: "client", label: "Cliente", value: "Engie", status: "captured" },
      {
        id: "service",
        label: "Tipo de servico",
        value: "Monitoramento trimestral",
        status: "captured",
      },
      {
        id: "contact",
        label: "Contato ERP",
        value: "Larissa Melo - larissa.melo@engie.com",
        status: "erp",
      },
    ],
    aiInstruction:
      "Tudo pronto para o fechamento: documento final, destino no Microsoft 365 e disparo do e-mail de envio ao contato mestre.",
    erpContact: {
      name: "Larissa Melo",
      email: "larissa.melo@engie.com",
      phone: "(84) 99999-1200",
      source: "erp",
    },
    images: [
      {
        id: "engie-photo-3",
        name: "campanha-q1.jpg",
        caption: "Panorama da campanha do primeiro trimestre.",
        capturedAt: "2026-04-18T09:44:00.000Z",
        location: "Area central",
        suggestedSectionId: "photos",
        source: "whatsapp",
      },
    ],
    timeline: [
      {
        id: "engie-send-1",
        actor: "bot",
        channel: "platform",
        at: "2026-04-20T07:10:00.000Z",
        message: "Relatorio marcado como pronto para envio com destinatario puxado do ERP.",
      },
      {
        id: "engie-send-2",
        actor: "technician",
        channel: "platform",
        at: "2026-04-20T07:48:00.000Z",
        message: "Abrir e-mail final assim que o documento estiver validado.",
      },
    ],
    draftInput: {
      reportNumber: "RT-811/2026",
      period: "1o trimestre de 2026",
      campaignLabel: "Campanha trimestral Q1",
      responsibleTechnical: "Biol. Ana Souza - CRBIO 98765/06",
      notes: "Encaminhar com o contato mestre vindo do ERP.",
    },
    linkedReportId: "report-engie-issued",
  },
  {
    id: "case-manual-start",
    protocol: "MANUAL-START",
    stage: "montagem",
    operationalStatus: "ready_for_ai",
    priority: "low",
    technicianName: "Criacao manual",
    startedAt: "2026-04-21T09:00:00.000Z",
    updatedAt: "2026-04-21T09:00:00.000Z",
    clientName: "Selecione um cliente",
    location: "Relatorio iniciado manualmente na plataforma",
    serviceType: "Fluxo livre de construcao",
    projectId: "project-caern-jaguaribe",
    templateId: "template-implantacao",
    summary:
      "Atalho de teste para abrir um relatorio do zero, sem depender da conversa de WhatsApp nem do payload inicial do bot.",
    nextAction:
      "Escolher projeto, template e dados basicos para abrir uma nova minuta diretamente na estacao de trabalho.",
    nextQuestion:
      "Informe projeto, periodo, numero do relatorio e responsavel tecnico para seguir.",
    missingFieldLabels: [],
    extractedFields: [
      {
        id: "origin",
        label: "Origem",
        value: "Criacao manual liberada pelo acesso temporario",
        status: "captured",
      },
      {
        id: "client",
        label: "Cliente",
        value: "Definido na etapa de montagem",
        status: "missing",
      },
      {
        id: "project",
        label: "Projeto",
        value: "Definido na etapa de montagem",
        status: "missing",
      },
      {
        id: "contact",
        label: "Contato ERP",
        value: "Sera preenchido quando a integracao real estiver conectada",
        status: "erp",
      },
    ],
    aiInstruction:
      "Abrir uma minuta limpa, com estrutura pronta para edicao, imagens e revisao tecnica a partir dos dados informados manualmente.",
    erpContact: {
      name: "Contato sera definido pelo ERP",
      email: "contato@erp.local",
      phone: "(00) 00000-0000",
      source: "manual",
    },
    images: [],
    timeline: [
      {
        id: "manual-start-1",
        actor: "bot",
        channel: "platform",
        at: "2026-04-21T09:00:00.000Z",
        message:
          "Fluxo manual pronto. Use este card para abrir um relatorio do zero enquanto WhatsApp e ERP ainda estao em homologacao.",
      },
    ],
    draftInput: {
      reportNumber: "RT-TESTE-2026",
      period: "Abril de 2026",
      campaignLabel: "Construcao manual",
      responsibleTechnical: "Equipe Elementus",
      notes: "Minuta aberta manualmente para testes internos da plataforma.",
    },
  },
];

export function getWorkflowCaseById(caseId?: string | null) {
  if (!caseId) {
    return undefined;
  }

  return workflowCases.find((item) => item.id === caseId);
}

export function getDefaultWorkflowCase(stage?: WorkflowStage) {
  if (!stage) {
    return workflowCases[0];
  }

  return workflowCases.find((item) => item.stage === stage) ?? workflowCases[0];
}

export function getWorkflowStageCounts() {
  return workflowStageOrder.reduce(
    (counts, stage) => ({
      ...counts,
      [stage]: workflowCases.filter((item) => item.stage === stage).length,
    }),
    {} as Record<WorkflowStage, number>
  );
}

export function buildWorkflowHref(
  stage: WorkflowStage,
  options?: { caseId?: string; reportId?: string }
) {
  const params = new URLSearchParams();

  if (options?.caseId) {
    params.set("case", options.caseId);
  }

  if (options?.reportId) {
    params.set("report", options.reportId);
  }

  const query = params.toString();
  return `${workflowStageMeta[stage].href}${query ? `?${query}` : ""}`;
}

export function buildWorkflowCaseHref(item: WorkflowCaseRecord) {
  return buildWorkflowHref(item.stage, {
    caseId: item.id,
    reportId: item.linkedReportId,
  });
}
