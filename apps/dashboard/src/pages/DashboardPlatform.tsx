import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, FileOutput, FolderOpen, PlusCircle, ShieldCheck } from "lucide-react";
import { Header } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  clients,
  projects,
  reportStatusMeta,
  sampleReports,
  type ClientRecord,
  type ProjectRecord,
  type ReportRecord,
} from "@/data/platform";
import { getStoredReports } from "@/lib/reportDrafts";
import { fetchPlatformProjectsBundle, fetchPlatformReports } from "@/lib/platformApi";

export function DashboardPlatformPage() {
  const navigate = useNavigate();
  const [clientsData, setClientsData] = useState<ClientRecord[]>(clients);
  const [projectsData, setProjectsData] = useState<ProjectRecord[]>(projects);
  const [storedReports, setStoredReports] = useState<ReportRecord[]>([]);

  useEffect(() => {
    let active = true;

    setStoredReports(getStoredReports());

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

    void fetchPlatformReports()
      .then((reportsData) => {
        if (!active) {
          return;
        }

        setStoredReports(reportsData);
      })
      .catch(() => {
        // fallback local
      });

    return () => {
      active = false;
    };
  }, []);

  const reports = useMemo(() => {
    const unique = new Map<string, ReportRecord>();

    [...storedReports, ...sampleReports].forEach((report) => {
      unique.set(report.id, report);
    });

    return Array.from(unique.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [storedReports]);

  const stats = [
    {
      label: "Clientes ativos",
      value: clientsData.length,
      icon: Building2,
      tone: "text-elementus-blue",
    },
    {
      label: "Projetos operando",
      value: projectsData.length,
      icon: FolderOpen,
      tone: "text-elementus-green",
    },
    {
      label: "Relatorios em trabalho",
      value: reports.filter((report) => report.status !== "issued").length,
      icon: FileOutput,
      tone: "text-amber-600",
    },
    {
      label: "Salvos no Microsoft 365",
      value: reports.filter((report) => report.microsoft365.status === "saved").length,
      icon: ShieldCheck,
      tone: "text-emerald-600",
    },
  ];

  return (
    <div>
      <Header
        title="Inicio"
        description="Plataforma base da etapa 1 para criar, revisar e emitir relatorios"
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-3xl font-bold">{stat.value}</p>
                </div>
                <div className={`rounded-2xl bg-muted p-3 ${stat.tone}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-elementus-blue/20 bg-elementus-blue/5">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-elementus-blue">
                Etapa 1
              </p>
              <h3 className="text-xl font-semibold">Primeiro entregamos a plataforma base</h3>
              <p className="text-sm text-muted-foreground">
                Cliente e projeto entram pelo cadastro central, o tecnico revisa o rascunho,
                anexa imagens e a emissao final salva no Microsoft 365.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate("/projects")} variant="outline">
                Ver cadastros
              </Button>
              <Button onClick={() => navigate("/reports/generate")}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Novo relatorio
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fluxo operacional ja desenhado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "1. Selecionar cliente e projeto a partir do cadastro central.",
                "2. Abrir o relatorio no template correto com dados ja preenchidos.",
                "3. Revisar o texto tecnico dentro da plataforma.",
                "4. Anexar e organizar imagens por secao.",
                "5. Emitir o arquivo final e salvar no Microsoft 365.",
              ].map((step) => (
                <div key={step} className="rounded-xl border bg-white p-4 text-sm">
                  {step}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Projetos prontos para operar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {projectsData.map((project) => {
                const client = clientsData.find((item) => item.id === project.clientId);
                return (
                  <button
                    key={project.id}
                    onClick={() => navigate(`/reports/generate?project=${project.id}`)}
                    className="w-full rounded-xl border p-4 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-elementus-blue">
                          {client?.name}
                        </p>
                        <p className="text-sm font-semibold">{project.name}</p>
                        <p className="text-xs text-muted-foreground">{project.undertaking}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Pasta M365: {project.microsoft365Folder}
                    </p>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">Relatorios recentes</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/reports")}>
                Ver todos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {reports.slice(0, 3).map((report) => {
              const project = projectsData.find((item) => item.id === report.projectId);
              const client = clientsData.find((item) => item.id === report.clientId);
              const status = reportStatusMeta[report.status];

              return (
                <button
                  key={report.id}
                  onClick={() => navigate(`/reports/${report.id}`)}
                  className="flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-elementus-blue">{report.reportNumber}</p>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm font-medium">{report.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {client?.name} · {project?.undertaking} · {report.period}
                    </p>
                  </div>
                  <Badge variant={report.microsoft365.status === "saved" ? "success" : "outline"}>
                    {report.microsoft365.status === "saved" ? "M365 salvo" : "Pendente M365"}
                  </Badge>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
