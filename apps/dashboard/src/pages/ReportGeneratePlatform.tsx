import { startTransition, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Header } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  buildDraftReportFromProject,
  clients,
  getTemplateById,
  projects,
  reportTemplates,
  type ClientRecord,
  type ProjectRecord,
} from "@/data/platform";
import { saveStoredReport } from "@/lib/reportDrafts";
import { createPlatformReportDraft, fetchPlatformProjectsBundle } from "@/lib/platformApi";

function buildSuggestedNumber(projectId: string) {
  const index = Math.max(
    1,
    projects.findIndex((project) => project.id === projectId) + 1
  );

  return `RT-${900 + index}/2026`;
}

export function ReportGeneratePlatformPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialProjectId = searchParams.get("project") ?? projects[0]?.id ?? "";

  const [clientsData, setClientsData] = useState<ClientRecord[]>(clients);
  const [projectsData, setProjectsData] = useState<ProjectRecord[]>(projects);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [period, setPeriod] = useState("Abril de 2026");
  const [campaignLabel, setCampaignLabel] = useState("Campanha base da etapa 1");
  const [responsibleTechnical, setResponsibleTechnical] = useState("Equipe tecnica Elementus");
  const [reportNumber, setReportNumber] = useState(buildSuggestedNumber(initialProjectId));
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

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
    () => projectsData.find((item) => item.id === selectedProjectId),
    [projectsData, selectedProjectId]
  );
  const client = useMemo(
    () => (project ? clientsData.find((item) => item.id === project.clientId) : undefined),
    [clientsData, project]
  );
  const template = useMemo(() => getTemplateById(selectedTemplateId), [selectedTemplateId]);

  useEffect(() => {
    if (!project) {
      return;
    }

    setSelectedTemplateId(project.defaultTemplateId);
    setReportNumber(buildSuggestedNumber(project.id));
  }, [project?.id]);

  const canCreate = Boolean(project && template && reportNumber.trim() && responsibleTechnical.trim());

  const handleCreate = () => {
    if (!project || !template) {
      return;
    }

    setCreating(true);

    window.setTimeout(() => {
      void createPlatformReportDraft({
        project,
        clientName: client?.name || "Cliente",
        templateId: template.id,
        reportNumber,
        period,
        campaignLabel,
        responsibleTechnical,
        notes,
      })
        .then((draftReport) => {
          saveStoredReport(draftReport);

          startTransition(() => {
            navigate(`/reports/${draftReport.id}`);
          });
        })
        .catch(() => {
          const draftReport = buildDraftReportFromProject({
            project,
            clientName: client?.name || "Cliente",
            templateId: template.id,
            reportNumber,
            period,
            campaignLabel,
            responsibleTechnical,
            notes,
          });

          saveStoredReport(draftReport);

          startTransition(() => {
            navigate(`/reports/${draftReport.id}`);
          });
        });
    }, 800);
  };

  return (
    <div>
      <Header
        title="Novo relatorio"
        description="Abrir o rascunho da plataforma com dados puxados do cadastro central"
      />

      <div className="space-y-6 p-6">
        <Link to="/reports">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>

        {creating ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <Card className="w-full max-w-md">
              <CardContent className="space-y-4 p-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-elementus-blue/10">
                  <Sparkles className="h-8 w-8 text-elementus-blue" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Abrindo o relatorio na plataforma</h3>
                  <p className="text-sm text-muted-foreground">
                    Estamos montando o rascunho com cliente, projeto, template e destino no Microsoft 365.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparando editor, anexos e emissao...
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">1. Origem do relatorio</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Projeto</label>
                  <select
                    value={selectedProjectId}
                    onChange={(event) => setSelectedProjectId(event.target.value)}
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                    value={selectedTemplateId}
                    onChange={(event) => setSelectedTemplateId(event.target.value)}
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {reportTemplates.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">2. Dados da emissao</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Numero do relatorio</label>
                  <input
                    type="text"
                    value={reportNumber}
                    onChange={(event) => setReportNumber(event.target.value)}
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Periodo</label>
                  <input
                    type="text"
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Campanha ou referencia</label>
                  <input
                    type="text"
                    value={campaignLabel}
                    onChange={(event) => setCampaignLabel(event.target.value)}
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Responsavel tecnico</label>
                  <input
                    type="text"
                    value={responsibleTechnical}
                    onChange={(event) => setResponsibleTechnical(event.target.value)}
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Observacoes iniciais</label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Anotar o que a equipe tecnica ja quer destacar no primeiro rascunho."
                    className="mt-1 min-h-28 w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Dados puxados automaticamente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="mt-1 font-medium">{client?.name ?? "Nao definido"}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Projeto</p>
                  <p className="mt-1 font-medium">{project?.name ?? "Nao definido"}</p>
                  <p className="text-sm text-muted-foreground">{project?.undertaking}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Destino no Microsoft 365</p>
                  <p className="mt-1 text-sm font-medium">{project?.microsoft365Folder ?? "Nao definido"}</p>
                </div>
                <div className="rounded-xl border border-dashed border-elementus-blue/30 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">cliente_nome</Badge>
                    <Badge variant="outline">empreendimento</Badge>
                    <Badge variant="outline">projeto</Badge>
                    <Badge variant="outline">pasta_m365</Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    O tecnico abre o relatorio ja com esses campos preenchidos e segue para revisao
                    e anexacao de imagens dentro da plataforma.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                <div>
                  <h3 className="font-semibold">O que acontece no proximo passo</h3>
                  <p className="text-sm text-muted-foreground">
                    O sistema abre o rascunho, separa as secoes principais do template e deixa o
                    relatorio pronto para edicao tecnica e emissao.
                  </p>
                </div>
                <Separator />
                <Button onClick={handleCreate} disabled={!canCreate || creating} className="w-full">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Criar rascunho na plataforma
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
