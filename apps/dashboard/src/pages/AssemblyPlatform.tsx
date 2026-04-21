import { startTransition, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  FolderOpen,
  Loader2,
  Mail,
  MessageSquare,
  TriangleAlert,
} from "lucide-react";
import { Header } from "@/components/layout";
import { FlowStageStrip } from "@/components/workflow/FlowStageStrip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildWorkflowHref,
  getDefaultWorkflowCase,
  getWorkflowCaseById,
  workflowCases,
  workflowOperationalStatusMeta,
  type WorkflowCaseRecord,
} from "@/data/workflow";
import {
  buildDraftReportFromProject,
  clients,
  projects,
  reportTemplates,
  type ClientRecord,
  type ProjectRecord,
} from "@/data/platform";
import { useAuth } from "@/hooks/useAuth";
import { createPlatformReportDraft, fetchPlatformProjectsBundle } from "@/lib/platformApi";
import { saveStoredReport } from "@/lib/reportDrafts";
import { cn, formatDateTime } from "@/lib/utils";

function getAssemblyCase(caseId?: string | null) {
  const selected = getWorkflowCaseById(caseId);

  if (selected) {
    return selected;
  }

  return getDefaultWorkflowCase("montagem");
}

function buildStarterReportNumber(prefix: string) {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  return `${prefix}-${stamp}-${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
}

export function AssemblyPlatformPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedCase = getAssemblyCase(searchParams.get("case"));
  const { user } = useAuth();

  const [clientsData, setClientsData] = useState<ClientRecord[]>(clients);
  const [projectsData, setProjectsData] = useState<ProjectRecord[]>(projects);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [starterProjectId, setStarterProjectId] = useState(projects[0]?.id ?? "");
  const [starterTemplateId, setStarterTemplateId] = useState(
    projects[0]?.defaultTemplateId ?? reportTemplates[0]?.id ?? ""
  );
  const [starterReportNumber, setStarterReportNumber] = useState(
    buildStarterReportNumber(projects[0]?.reportPrefix ?? "RT")
  );
  const [starterPeriod, setStarterPeriod] = useState("Abril de 2026");
  const [starterCampaignLabel, setStarterCampaignLabel] = useState("Nova campanha manual");
  const [starterResponsibleTechnical, setStarterResponsibleTechnical] = useState("");
  const [starterNotes, setStarterNotes] = useState("");
  const reportId = searchParams.get("report") ?? selectedCase?.linkedReportId;

  useEffect(() => {
    let active = true;

    void fetchPlatformProjectsBundle()
      .then((bundle) => {
        if (!active) {
          return;
        }

        setClientsData(bundle.clients);
        setProjectsData(bundle.projects);
      })
      .catch(() => {
        // fallback local
      });

    return () => {
      active = false;
    };
  }, []);

  const project = useMemo(
    () => projectsData.find((item) => item.id === selectedCase?.projectId),
    [projectsData, selectedCase?.projectId]
  );
  const client = useMemo(
    () =>
      project
        ? clientsData.find((item) => item.id === project.clientId)
        : clientsData.find((item) => item.name === selectedCase?.clientName),
    [clientsData, project, selectedCase?.clientName]
  );

  const canGenerate = Boolean(selectedCase && project && selectedCase.missingFieldLabels.length === 0);
  const readyCases = workflowCases.filter((item) => item.operationalStatus === "ready_for_ai");
  const starterProject = useMemo(
    () => projectsData.find((item) => item.id === starterProjectId) ?? projectsData[0] ?? null,
    [projectsData, starterProjectId]
  );
  const starterClient = useMemo(
    () =>
      starterProject
        ? clientsData.find((item) => item.id === starterProject.clientId) ?? null
        : null,
    [clientsData, starterProject]
  );

  useEffect(() => {
    const fallbackProject = projectsData.find((item) => item.status !== "paused") ?? projectsData[0];

    if (!fallbackProject) {
      return;
    }

    if (!starterProjectId || !projectsData.some((item) => item.id === starterProjectId)) {
      setStarterProjectId(fallbackProject.id);
      setStarterTemplateId(fallbackProject.defaultTemplateId);
      setStarterReportNumber(buildStarterReportNumber(fallbackProject.reportPrefix));
    }

    setStarterResponsibleTechnical(
      (current) => current || user?.name || fallbackProject.coordinator || "Equipe Elementus"
    );
  }, [projectsData, starterProjectId, user?.name]);

  const handleStarterProjectChange = (projectId: string) => {
    setStarterProjectId(projectId);

    const nextProject = projectsData.find((item) => item.id === projectId);

    if (!nextProject) {
      return;
    }

    setStarterTemplateId(nextProject.defaultTemplateId);
    setStarterReportNumber(buildStarterReportNumber(nextProject.reportPrefix));
  };

  const handleGenerate = (caseRecord: WorkflowCaseRecord) => {
    if (!project || !caseRecord) {
      return;
    }

    setCreating(true);
    setMessage("");

    window.setTimeout(() => {
      void createPlatformReportDraft({
        project,
        clientName: client?.name || caseRecord.clientName,
        templateId: caseRecord.templateId,
        reportNumber: caseRecord.draftInput.reportNumber,
        period: caseRecord.draftInput.period,
        campaignLabel: caseRecord.draftInput.campaignLabel,
        responsibleTechnical: caseRecord.draftInput.responsibleTechnical,
        notes: caseRecord.draftInput.notes,
      })
        .then((draftReport) => {
          saveStoredReport(draftReport);

          startTransition(() => {
            navigate(
              buildWorkflowHref("relatorio", {
                caseId: caseRecord.id,
                reportId: draftReport.id,
              })
            );
          });
        })
        .catch((error) => {
          const draftReport = buildDraftReportFromProject({
            project,
            clientName: client?.name || caseRecord.clientName,
            templateId: caseRecord.templateId,
            reportNumber: caseRecord.draftInput.reportNumber,
            period: caseRecord.draftInput.period,
            campaignLabel: caseRecord.draftInput.campaignLabel,
            responsibleTechnical: caseRecord.draftInput.responsibleTechnical,
            notes: caseRecord.draftInput.notes,
          });

          saveStoredReport(draftReport);
          setCreating(false);
          setMessage(
            error instanceof Error
              ? `${error.message} O rascunho foi aberto em modo local para a demonstracao.`
              : "O rascunho foi aberto em modo local para a demonstracao."
          );

          startTransition(() => {
            navigate(
              buildWorkflowHref("relatorio", {
                caseId: caseRecord.id,
                reportId: draftReport.id,
              })
            );
          });
        });
    }, 700);
  };

  const handleCreateFromScratch = () => {
    if (!starterProject || !starterClient || !starterTemplateId) {
      return;
    }

    setCreating(true);
    setMessage("");

    window.setTimeout(() => {
      void createPlatformReportDraft({
        project: starterProject,
        clientName: starterClient.name,
        templateId: starterTemplateId,
        reportNumber: starterReportNumber,
        period: starterPeriod,
        campaignLabel: starterCampaignLabel,
        responsibleTechnical: starterResponsibleTechnical || user?.name || "Equipe Elementus",
        notes: starterNotes,
      })
        .then((draftReport) => {
          saveStoredReport(draftReport);

          startTransition(() => {
            navigate(
              buildWorkflowHref("relatorio", {
                caseId: "case-manual-start",
                reportId: draftReport.id,
              })
            );
          });
        })
        .catch((error) => {
          const draftReport = buildDraftReportFromProject({
            project: starterProject,
            clientName: starterClient.name,
            templateId: starterTemplateId,
            reportNumber: starterReportNumber,
            period: starterPeriod,
            campaignLabel: starterCampaignLabel,
            responsibleTechnical: starterResponsibleTechnical || user?.name || "Equipe Elementus",
            notes: starterNotes,
          });

          saveStoredReport(draftReport);
          setCreating(false);
          setMessage(
            error instanceof Error
              ? `${error.message} A minuta manual foi aberta em modo local para continuar o teste.`
              : "A minuta manual foi aberta em modo local para continuar o teste."
          );

          startTransition(() => {
            navigate(
              buildWorkflowHref("relatorio", {
                caseId: "case-manual-start",
                reportId: draftReport.id,
              })
            );
          });
        });
    }, 700);
  };

  if (!selectedCase) {
    return null;
  }

  const status = workflowOperationalStatusMeta[selectedCase.operationalStatus];

  return (
    <div>
      <Header
        title="Montagem"
        description="Dados extraidos, lacunas visiveis e um disparo claro para gerar a primeira versao com IA."
      />

      <div className="space-y-6 p-4 lg:p-6">
        <FlowStageStrip activeStage="montagem" caseId={selectedCase.id} reportId={reportId ?? undefined} />

        {creating ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <Card className="w-full max-w-md">
              <CardContent className="space-y-4 p-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-elementus-blue/10">
                  <Bot className="h-8 w-8 text-elementus-blue" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Gerando a primeira versao</h3>
                  <p className="text-sm text-muted-foreground">
                    A plataforma esta abrindo o rascunho com cliente, projeto, secoes e destino final.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparando minuta, imagens e contexto ERP...
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card className="border-elementus-blue/20 bg-elementus-blue/5">
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-elementus-blue">{selectedCase.protocol}</p>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold">
                    {selectedCase.clientName} · {selectedCase.serviceType}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {selectedCase.summary}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Atualizacao</p>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium">
                    <Clock3 className="h-4 w-4 text-elementus-blue" />
                    {formatDateTime(selectedCase.updatedAt)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Dados extraidos do WhatsApp</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Linha viva da conversa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedCase.timeline.map((event) => (
                  <div key={event.id} className="rounded-2xl border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{event.channel}</Badge>
                      <p className="text-sm font-medium">
                        {event.actor === "bot"
                          ? "Assistente"
                          : event.actor === "erp"
                          ? "ERP"
                          : selectedCase.technicianName}
                      </p>
                      <span className="text-xs text-muted-foreground">{formatDateTime(event.at)}</span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {event.message}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-emerald-200 bg-emerald-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Criar relatorio do zero</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-emerald-900">
                  Use este atalho para testar a construcao manual com sua conta, sem depender da
                  fila do WhatsApp.
                </p>

                <div>
                  <label className="text-sm font-medium">Projeto</label>
                  <select
                    className="mt-1 h-11 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={starterProjectId}
                    onChange={(event) => handleStarterProjectChange(event.target.value)}
                  >
                    {projectsData.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} - {item.undertaking}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Template</label>
                  <select
                    className="mt-1 h-11 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={starterTemplateId}
                    onChange={(event) => setStarterTemplateId(event.target.value)}
                  >
                    {reportTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Numero do relatorio</label>
                  <input
                    className="mt-1 h-11 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={starterReportNumber}
                    onChange={(event) => setStarterReportNumber(event.target.value)}
                    placeholder="RT-20260421-0900"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Periodo</label>
                  <input
                    className="mt-1 h-11 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={starterPeriod}
                    onChange={(event) => setStarterPeriod(event.target.value)}
                    placeholder="Abril de 2026"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Campanha / referencia</label>
                  <input
                    className="mt-1 h-11 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={starterCampaignLabel}
                    onChange={(event) => setStarterCampaignLabel(event.target.value)}
                    placeholder="Nova campanha manual"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Responsavel tecnico</label>
                  <input
                    className="mt-1 h-11 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={starterResponsibleTechnical}
                    onChange={(event) => setStarterResponsibleTechnical(event.target.value)}
                    placeholder="Equipe Elementus"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Observacoes iniciais</label>
                  <textarea
                    className="mt-1 min-h-24 w-full rounded-md border bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={starterNotes}
                    onChange={(event) => setStarterNotes(event.target.value)}
                    placeholder="Escreva o contexto inicial da minuta."
                  />
                </div>

                <div className="rounded-2xl bg-white p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {starterClient?.name ?? "Cliente"} - {starterProject?.undertaking ?? "Empreendimento"}
                  </p>
                  <p className="mt-1">
                    Destino final: {starterProject?.microsoft365Folder ?? "A definir"}
                  </p>
                </div>

                <Button
                  className="w-full"
                  onClick={() => void handleCreateFromScratch()}
                  disabled={
                    creating ||
                    !starterProject ||
                    !starterClient ||
                    !starterTemplateId ||
                    !starterReportNumber ||
                    !starterPeriod ||
                    !starterResponsibleTechnical
                  }
                >
                  <Bot className="mr-2 h-4 w-4" />
                  Abrir construcao do zero
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Projeto e saida final</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Projeto</p>
                  <p className="mt-2 font-semibold">{project?.name ?? "Projeto ainda nao localizado"}</p>
                  <p className="text-sm text-muted-foreground">{project?.undertaking ?? selectedCase.location}</p>
                </div>

                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Contato ERP</p>
                  <p className="mt-2 font-semibold">{selectedCase.erpContact.name}</p>
                  <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Mail className="h-4 w-4 text-elementus-blue" />
                      {selectedCase.erpContact.email}
                    </span>
                    <span>{selectedCase.erpContact.phone}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-dashed border-elementus-blue/30 p-4">
                  <div className="flex items-center gap-2 text-elementus-blue">
                    <FolderOpen className="h-4 w-4" />
                    <p className="text-sm font-semibold">Destino do documento</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {project?.microsoft365Folder ?? "A pasta final sera definida quando o projeto for localizado."}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Briefing para a IA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
                  {selectedCase.aiInstruction}
                </div>

                {selectedCase.missingFieldLabels.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <div className="flex items-center gap-2 font-semibold">
                      <TriangleAlert className="h-4 w-4" />
                      Ainda nao esta pronto para gerar
                    </div>
                    <p className="mt-2">{selectedCase.nextQuestion}</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="h-4 w-4" />
                      Atendimento completo
                    </div>
                    <p className="mt-2">
                      Cliente, local, tipo de servico e destinatario final estao amarrados. Ja pode abrir a primeira versao.
                    </p>
                  </div>
                )}

                {message ? (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                    {message}
                  </div>
                ) : null}

                <div className="grid gap-3">
                  <Button onClick={() => handleGenerate(selectedCase)} disabled={!canGenerate || creating}>
                    <Bot className="mr-2 h-4 w-4" />
                    Gerar primeira versao com IA
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate(
                        buildWorkflowHref("relatorio", {
                          caseId: selectedCase.id,
                          reportId: reportId ?? undefined,
                        })
                      )
                    }
                    disabled={!reportId}
                  >
                    Abrir minuta atual
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fila pronta para montagem</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {readyCases.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(buildWorkflowHref("montagem", { caseId: item.id }))}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition-colors hover:bg-muted/40",
                      item.id === selectedCase.id && "border-elementus-blue bg-elementus-blue/5"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-elementus-blue">{item.protocol}</p>
                        <p className="mt-1 text-sm font-medium">
                          {item.clientName} · {item.serviceType}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        {item.location}
                      </span>
                      <span>{item.technicianName}</span>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
