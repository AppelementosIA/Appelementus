import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  FolderOpen,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { Header } from "@/components/layout";
import { FlowStageStrip } from "@/components/workflow/FlowStageStrip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildWorkflowHref,
  getDefaultWorkflowCase,
  getWorkflowCaseById,
  type WorkflowCaseRecord,
} from "@/data/workflow";
import {
  reportStatusMeta,
  type ReportRecord,
  type ReportSectionRecord,
} from "@/data/platform";
import { loadReportRecord, persistReportRecord } from "@/lib/reportWorkspace";
import { formatDateTime } from "@/lib/utils";

function buildSectionSnippet(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= 220) {
    return normalized;
  }

  return `${normalized.slice(0, 220).trim()}...`;
}

function getTimelineActorLabel(
  caseRecord: WorkflowCaseRecord,
  actor: WorkflowCaseRecord["timeline"][number]["actor"]
) {
  if (actor === "bot") {
    return "Assistente";
  }

  if (actor === "erp") {
    return "ERP";
  }

  return caseRecord.technicianName;
}

function buildAiSectionDraft(
  section: ReportSectionRecord,
  caseRecord: WorkflowCaseRecord,
  report: ReportRecord
) {
  const whatsappSummary =
    caseRecord.timeline
      .filter((event) => event.channel === "whatsapp")
      .map((event) => event.message)
      .join(" ") || caseRecord.summary;
  const extractedSummary = caseRecord.extractedFields
    .map((field) => `${field.label}: ${field.value}`)
    .join("; ");
  const imagesSummary =
    caseRecord.images.length > 0
      ? caseRecord.images.map((image) => image.caption).join("; ")
      : "Nenhuma evidencia fotografica chegou vinculada a este atendimento ate agora.";
  const pendingPoint =
    caseRecord.nextQuestion && !caseRecord.nextQuestion.toLowerCase().includes("nenhuma")
      ? `Ponto de atencao para a revisao tecnica: ${caseRecord.nextQuestion}.`
      : "Nao ha pendencias abertas no momento, apenas refinamento tecnico do texto.";

  switch (section.id) {
    case "presentation":
      return `Este relatorio registra o atendimento ${caseRecord.protocol}, referente a ${caseRecord.serviceType.toLowerCase()} executado em ${caseRecord.location}, para o cliente ${caseRecord.clientName}. A primeira versao foi organizada a partir dos relatos enviados pelo tecnico via WhatsApp e consolidada na plataforma operacional da Elementus. O periodo de referencia desta minuta e ${report.period}, com responsabilidade tecnica atribuida a ${report.responsibleTechnical}.`;
    case "general":
    case "objective":
    case "scope":
      return `Base consolidada pela IA para abertura do relatorio: ${extractedSummary}. O destino previsto do documento permanece em ${report.microsoft365.folderPath}, enquanto o contato final mapeado no ERP para encaminhamento e ${caseRecord.erpContact.name} (${caseRecord.erpContact.email}).`;
    case "activities":
    case "results":
      return `Relato consolidado do campo: ${whatsappSummary}\n\nA IA reorganizou esse material em linguagem tecnica inicial, mantendo como referencia adicional as observacoes internas registradas nesta minuta: ${report.notes || caseRecord.draftInput.notes || "Sem observacoes complementares."}`;
    case "photos":
      return `As evidencias recebidas para este relatorio incluem ${caseRecord.images.length} imagem(ns). Legendas iniciais sugeridas: ${imagesSummary} O tecnico pode redistribuir essas imagens nos blocos corretos antes da emissao final.`;
    case "conclusion":
      return `Com base no material recebido ate aqui, a minuta pode seguir para revisao tecnica e distribuicao final das evidencias. ${pendingPoint}`;
    default:
      return `Resumo inicial do atendimento: ${caseRecord.summary}`;
  }
}

function buildAiReportVersion(report: ReportRecord, caseRecord: WorkflowCaseRecord) {
  return {
    ...report,
    updatedAt: new Date().toISOString(),
    status: report.status === "draft" ? "review" : report.status,
    sections: report.sections.map((section) => ({
      ...section,
      content: buildAiSectionDraft(section, caseRecord, report),
    })),
  };
}

export function ReportWorkspacePlatformPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedCase =
    getWorkflowCaseById(searchParams.get("case")) ?? getDefaultWorkflowCase("relatorio");
  const reportId = searchParams.get("report") ?? selectedCase?.linkedReportId;

  const [report, setReport] = useState<ReportRecord | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);

  useEffect(() => {
    let active = true;

    void loadReportRecord(reportId).then((resolvedReport) => {
      if (!active) {
        return;
      }

      setReport(resolvedReport);
    });

    return () => {
      active = false;
    };
  }, [reportId]);

  const status = report ? reportStatusMeta[report.status] : null;
  const filledSections =
    report?.sections.filter((section) => section.content.trim().length > 0).length ?? 0;
  const imageCount =
    report?.sections.reduce((total, section) => total + section.images.length, 0) ?? 0;
  const editingSection =
    report?.sections.find((section) => section.id === editingSectionId) ?? null;
  const whatsappTimeline = selectedCase?.timeline.filter((event) => event.channel === "whatsapp") ?? [];
  const aiButtonLabel =
    report && filledSections > 0 ? "Refazer texto com IA" : "Gerar relatorio com IA";

  const handleSectionChange = (sectionId: string, content: string) => {
    if (!report) {
      return;
    }

    setReport({
      ...report,
      sections: report.sections.map((section) =>
        section.id === sectionId ? { ...section, content } : section
      ),
    });
  };

  const openEditor = (section: ReportSectionRecord) => {
    setEditingSectionId(section.id);
    setEditingDraft(section.content);
    setMessage("");
  };

  const closeEditor = () => {
    setEditingSectionId(null);
    setEditingDraft("");
  };

  const applyEditorDraft = () => {
    if (!editingSectionId) {
      return;
    }

    handleSectionChange(editingSectionId, editingDraft);
    closeEditor();
    setMessage("Bloco atualizado na tela. Agora basta salvar a revisao para consolidar a minuta.");
  };

  const handleGenerateWithAi = () => {
    if (!report || !selectedCase) {
      return;
    }

    setGeneratingAi(true);
    setMessage("");

    window.setTimeout(() => {
      const nextReport = buildAiReportVersion(report, selectedCase);
      setReport(nextReport);

      if (editingSectionId) {
        const nextSection = nextReport.sections.find((section) => section.id === editingSectionId);

        if (nextSection) {
          setEditingDraft(nextSection.content);
        }
      }

      setGeneratingAi(false);
      setMessage(
        "A IA reorganizou o relato bruto em uma nova minuta. Revise os blocos e ajuste o texto final se precisar."
      );
    }, 800);
  };

  const handleGenerateCurrentSectionWithAi = () => {
    if (!editingSection || !selectedCase || !report) {
      return;
    }

    setEditingDraft(buildAiSectionDraft(editingSection, selectedCase, report));
    setMessage(
      `A IA montou uma nova sugestao para a secao ${editingSection.number}. Revise e aplique se fizer sentido.`
    );
  };

  const handleSave = async () => {
    if (!report) {
      return;
    }

    setSaving(true);
    const nextReport = await persistReportRecord({
      ...report,
      status: report.status === "draft" ? "review" : report.status,
    });
    setReport(nextReport);
    closeEditor();
    setMessage("Texto salvo. A minuta continua pronta para refinamento e encaixe de imagens.");
    setSaving(false);
  };

  if (!selectedCase) {
    return null;
  }

  if (!report || !status) {
    return (
      <div>
        <Header
          title="Relatorio"
          description="A minuta ainda nao foi criada. Gere a primeira versao a partir da montagem."
        />
        <div className="space-y-6 p-4 lg:p-6">
          <FlowStageStrip activeStage="relatorio" caseId={selectedCase.id} />
          <Card>
            <CardContent className="space-y-4 p-8 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
              <div>
                <p className="text-lg font-semibold">Nenhuma minuta disponivel</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Abra a etapa de montagem e gere a primeira versao com IA para seguir.
                </p>
              </div>
              <Button onClick={() => navigate(buildWorkflowHref("montagem", { caseId: selectedCase.id }))}>
                Ir para montagem
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Relatorio"
        description="Receba o relato bruto do tecnico, gere a minuta com IA e refine tudo em uma janela simples antes da emissao."
      />

      <div className="space-y-6 p-4 lg:p-6">
        <FlowStageStrip activeStage="relatorio" caseId={selectedCase.id} reportId={report.id} />

        {generatingAi ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <Card className="w-full max-w-md">
              <CardContent className="space-y-4 p-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-elementus-blue/10">
                  <Bot className="h-8 w-8 text-elementus-blue" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Gerando relatorio com IA</h3>
                  <p className="text-sm text-muted-foreground">
                    A plataforma esta organizando os relatos vindos do WhatsApp em blocos prontos para revisao.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-elementus-blue" />
                  Consolidando contexto, secoes e narrativa tecnica...
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {editingSection ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <Card role="dialog" aria-modal="true" className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden">
              <CardHeader className="border-b pb-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-elementus-blue">
                      Janela de edicao
                    </p>
                    <CardTitle className="mt-2 text-xl">
                      Secao {editingSection.number} - {editingSection.title}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Revise o que a IA escreveu, ajuste o texto com liberdade e aplique o bloco quando estiver satisfeito.
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={closeEditor} aria-label="Fechar janela">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="grid flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[0.42fr_0.58fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border bg-muted/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Relato bruto do tecnico
                    </p>
                    <div className="mt-3 space-y-3">
                      {whatsappTimeline.length > 0 ? (
                        whatsappTimeline.map((event) => (
                          <div key={event.id} className="rounded-xl bg-white p-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{getTimelineActorLabel(selectedCase, event.actor)}</Badge>
                              <span className="text-xs text-muted-foreground">{formatDateTime(event.at)}</span>
                            </div>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                              {event.message}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">{selectedCase.summary}</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-muted/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Dados amarrados
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedCase.extractedFields.map((field) => (
                        <Badge key={field.id} variant={field.status === "erp" ? "success" : "outline"}>
                          {field.label}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {selectedCase.aiInstruction}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-muted/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Observacao de montagem
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {report.notes || selectedCase.draftInput.notes || selectedCase.summary}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-3 rounded-2xl border bg-elementus-blue/5 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-elementus-blue">Texto gerado para revisao</p>
                      <p className="text-sm text-muted-foreground">
                        Use a sugestao da IA como ponto de partida e ajuste o texto antes de aplicar.
                      </p>
                    </div>
                    <Button variant="outline" onClick={handleGenerateCurrentSectionWithAi}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Gerar nova sugestao
                    </Button>
                  </div>

                  <textarea
                    value={editingDraft}
                    onChange={(event) => setEditingDraft(event.target.value)}
                    className="min-h-[420px] w-full rounded-2xl border bg-white px-4 py-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                  />

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Dica: revise clareza tecnica, datas, nomes e se a secao esta coerente com as imagens que vao entrar depois.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={closeEditor}>
                        Cancelar
                      </Button>
                      <Button onClick={applyEditorDraft}>
                        Aplicar bloco
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <Card className="border-elementus-blue/20 bg-elementus-blue/5">
              <CardContent className="space-y-5 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-elementus-blue">{report.reportNumber}</p>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <Badge variant={report.microsoft365.status === "saved" ? "success" : "outline"}>
                    {report.microsoft365.status === "saved" ? "M365 salvo" : "M365 pendente"}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-xl font-semibold">{report.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Aqui o tecnico recebe o texto organizado pela IA, revisa em uma janela simples e so depois segue para imagens e envio.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Secoes prontas</p>
                    <p className="mt-2 text-3xl font-semibold text-elementus-blue">
                      {filledSections}/{report.sections.length}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Imagens encaixadas</p>
                    <p className="mt-2 text-3xl font-semibold text-elementus-blue">{imageCount}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ultima revisao</p>
                    <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-elementus-blue">
                      <Clock3 className="h-4 w-4" />
                      {formatDateTime(report.updatedAt)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  <Button onClick={handleGenerateWithAi}>
                    <Bot className="mr-2 h-4 w-4" />
                    {aiButtonLabel}
                  </Button>
                  <Button variant="outline" onClick={() => void handleSave()} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Salvando..." : "Salvar revisao"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate(
                        buildWorkflowHref("imagens", {
                          caseId: selectedCase.id,
                          reportId: report.id,
                        })
                      )
                    }
                  >
                    Ir para imagens
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Materia-prima recebida do campo</CardTitle>
                <CardDescription>
                  O objetivo aqui e deixar visivel o que chegou desorganizado do WhatsApp antes de virar texto final.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="timeline" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="timeline">Relato bruto</TabsTrigger>
                    <TabsTrigger value="fields">Campos</TabsTrigger>
                    <TabsTrigger value="images">Imagens</TabsTrigger>
                  </TabsList>

                  <TabsContent value="timeline" className="space-y-3">
                    {selectedCase.timeline.map((event) => (
                      <div key={event.id} className="rounded-2xl border p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{event.channel}</Badge>
                          <p className="text-sm font-medium">
                            {getTimelineActorLabel(selectedCase, event.actor)}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(event.at)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                          {event.message}
                        </p>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="fields" className="grid gap-3 md:grid-cols-2">
                    {selectedCase.extractedFields.map((field) => (
                      <div key={field.id} className="rounded-2xl border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{field.label}</p>
                          <Badge
                            variant={
                              field.status === "missing"
                                ? "warning"
                                : field.status === "erp"
                                ? "success"
                                : "outline"
                            }
                          >
                            {field.status === "missing"
                              ? "faltando"
                              : field.status === "erp"
                              ? "erp"
                              : "confirmado"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{field.value}</p>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="images" className="space-y-3">
                    {selectedCase.images.length > 0 ? (
                      selectedCase.images.map((image) => (
                        <div key={image.id} className="rounded-2xl border p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{image.name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {image.location} · {formatDateTime(image.capturedAt)}
                              </p>
                            </div>
                            <Badge variant="outline">Sugestao: {image.suggestedSectionId}</Badge>
                          </div>
                          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                            {image.caption}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                        Nenhuma imagem chegou junto com este atendimento ainda.
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Briefing da IA e destino final</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
                  {selectedCase.aiInstruction}
                </div>

                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Observacoes internas</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {report.notes || selectedCase.draftInput.notes || selectedCase.summary}
                  </p>
                </div>

                <div className="rounded-2xl border border-dashed border-elementus-blue/30 p-4">
                  <div className="flex items-center gap-2 text-elementus-blue">
                    <FolderOpen className="h-4 w-4" />
                    <p className="text-sm font-semibold">Destino previsto do documento</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{report.microsoft365.folderPath}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Depois da revisao textual, o fluxo segue para encaixe das evidencias e emissao final.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {message ? (
              <Card className="border-emerald-200 bg-emerald-50">
                <CardContent className="flex items-center gap-3 p-4 text-sm text-emerald-900">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>{message}</span>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Versao gerada para revisao</CardTitle>
                <CardDescription>
                  Cada secao vira um bloco simples. O tecnico enxerga a previa e abre uma janela para editar quando precisar.
                </CardDescription>
              </CardHeader>
            </Card>

            {report.sections.map((section) => {
              return (
                <Card key={section.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-elementus-blue">
                          Secao {section.number}
                        </p>
                        <CardTitle className="text-base">{section.title}</CardTitle>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openEditor(section)}>
                        Abrir janela de edicao
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl bg-muted/30 p-4">
                      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                        {buildSectionSnippet(section.content)}
                      </p>
                    </div>

                    <Separator />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Estado do bloco</p>
                        <p className="text-xs text-muted-foreground">
                          {section.images.length > 0
                            ? `${section.images.length} imagem(ns) ligadas a esta secao.`
                            : "Nenhuma imagem ligada a este bloco ainda."}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Sparkles className="h-4 w-4 text-elementus-blue" />
                        Primeira versao gerada com IA
                      </div>
                    </div>

                    {section.images.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {section.images.map((image) => (
                          <Badge key={image.id} variant="outline">
                            {image.caption}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}

            <Card>
              <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold">Proximo passo depois do texto</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Quando a minuta estiver clara, a plataforma entra na etapa visual para encaixar as evidencias nos blocos certos do relatorio.
                  </p>
                </div>
                <Button
                  onClick={() =>
                    navigate(
                      buildWorkflowHref("imagens", {
                        caseId: selectedCase.id,
                        reportId: report.id,
                      })
                    )
                  }
                >
                  Abrir etapa de imagens
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
