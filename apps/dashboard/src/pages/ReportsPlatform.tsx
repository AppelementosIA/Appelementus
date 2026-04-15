import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, FolderOpen, Plus, Search } from "lucide-react";
import { Header } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export function ReportsPlatformPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [clientsData, setClientsData] = useState<ClientRecord[]>(clients);
  const [projectsData, setProjectsData] = useState<ProjectRecord[]>(projects);
  const [draftReports, setDraftReports] = useState<ReportRecord[]>([]);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let active = true;

    setDraftReports(getStoredReports());

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

        setDraftReports(reportsData);
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

    [...draftReports, ...sampleReports].forEach((report) => {
      unique.set(report.id, report);
    });

    return Array.from(unique.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [draftReports]);

  const filteredReports = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();

    return reports.filter((report) => {
      if (filter !== "all" && report.status !== filter) {
        return false;
      }

      const client = clientsData.find((item) => item.id === report.clientId);
      const project = projectsData.find((item) => item.id === report.projectId);
      const haystack = [
        report.reportNumber,
        report.title,
        report.period,
        client?.name ?? "",
        project?.name ?? "",
        project?.undertaking ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return !normalized || haystack.includes(normalized);
    });
  }, [clientsData, deferredSearch, filter, projectsData, reports]);

  return (
    <div>
      <Header
        title="Relatorios"
        description="Fluxo operacional da etapa 1: criar, revisar, anexar imagens e emitir"
      />

      <div className="space-y-4 p-6">
        <Card className="border-elementus-blue/20 bg-elementus-blue/5">
          <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-semibold text-elementus-blue">Os dados principais ja vem do cadastro</h3>
              <p className="text-sm text-muted-foreground">
                Ao abrir um relatorio, o nome do cliente, o empreendimento e a pasta do Microsoft 365
                entram automaticamente a partir do projeto selecionado.
              </p>
            </div>
            <Link to="/reports/generate">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo relatorio
              </Button>
            </Link>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por numero, cliente, projeto ou periodo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 w-full rounded-md border bg-white pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all">Todos ({reports.length})</TabsTrigger>
              <TabsTrigger value="draft">
                Rascunhos ({reports.filter((report) => report.status === "draft").length})
              </TabsTrigger>
              <TabsTrigger value="review">
                Em revisao ({reports.filter((report) => report.status === "review").length})
              </TabsTrigger>
              <TabsTrigger value="issued">
                Emitidos ({reports.filter((report) => report.status === "issued").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-3">
          {filteredReports.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                <p className="text-sm">Nenhum relatorio encontrado</p>
              </CardContent>
            </Card>
          ) : (
            filteredReports.map((report) => {
              const status = reportStatusMeta[report.status];
              const client = clientsData.find((item) => item.id === report.clientId);
              const project = projectsData.find((item) => item.id === report.projectId);

              return (
                <Card
                  key={report.id}
                  className="cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => navigate(`/reports/${report.id}`)}
                >
                  <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-elementus-blue">{report.reportNumber}</p>
                        <Badge variant={status.variant}>{status.label}</Badge>
                        <Badge variant={report.microsoft365.status === "saved" ? "success" : "outline"}>
                          {report.microsoft365.status === "saved" ? "Microsoft 365 salvo" : "Microsoft 365 pendente"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-base font-semibold">{report.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {client?.name} · {project?.undertaking} · {report.period}
                      </p>
                    </div>

                    <div className="grid gap-2 rounded-xl bg-muted/40 p-4 text-sm lg:min-w-80">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-elementus-blue" />
                        <span className="font-medium">Destino M365</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{report.microsoft365.folderPath}</p>
                      <p className="text-xs text-muted-foreground">
                        Ultima atualizacao: {new Date(report.updatedAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
