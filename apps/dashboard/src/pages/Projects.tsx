import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, Database, FolderOpen, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clients, projects, reportTemplates, type ClientRecord, type ProjectRecord } from "@/data/platform";
import { fetchPlatformProjectsBundle } from "@/lib/platformApi";

export function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [clientsData, setClientsData] = useState<ClientRecord[]>(clients);
  const [projectsData, setProjectsData] = useState<ProjectRecord[]>(projects);
  const deferredSearch = useDeferredValue(search);

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
        // Fallback para dados locais quando a API nao estiver disponivel.
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredProjects = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();
    if (!normalized) {
      return projectsData;
    }

    return projectsData.filter((project) => {
      const client = clientsData.find((item) => item.id === project.clientId);
      return [project.name, project.undertaking, client?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [clientsData, deferredSearch, projectsData]);

  return (
    <div>
      <Header
        title="Cadastros"
        description="Base central de clientes, projetos e destino oficial no Microsoft 365"
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="rounded-2xl bg-elementus-blue/10 p-3 text-elementus-blue">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clientsData.length}</p>
                <p className="text-sm text-muted-foreground">Clientes ativos na base</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="rounded-2xl bg-elementus-green/10 p-3 text-elementus-green">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{projectsData.length}</p>
                <p className="text-sm text-muted-foreground">Projetos prontos para gerar relatorio</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                <FolderOpen className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reportTemplates.length}</p>
                <p className="text-sm text-muted-foreground">Templates disponiveis para emissao</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-elementus-blue/20 bg-elementus-blue/5">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-elementus-blue">
                O relatorio puxa os dados daqui
              </h3>
              <p className="text-sm text-muted-foreground">
                Cliente, projeto, empreendimento e pasta de destino no Microsoft 365 saem do cadastro
                central. O tecnico nao precisa redigitar essas informacoes.
              </p>
            </div>
            <Link to="/reports/generate">
              <Button>
                Criar relatorio
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Projetos cadastrados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por cliente, projeto ou empreendimento"
                className="h-10 w-full rounded-md border bg-white pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {filteredProjects.map((project) => {
                const client = clientsData.find((item) => item.id === project.clientId);
                const statusVariant =
                  project.status === "active"
                    ? "success"
                    : project.status === "setup"
                    ? "warning"
                    : "default";

                return (
                  <Card key={project.id} className="border-border/80 shadow-sm">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-elementus-blue">
                            {client?.name}
                          </p>
                          <h3 className="text-lg font-semibold">{project.name}</h3>
                          <p className="text-sm text-muted-foreground">{project.undertaking}</p>
                        </div>
                        <Badge variant={statusVariant}>{project.status === "active" ? "Ativo" : project.status === "setup" ? "Em setup" : "Pausado"}</Badge>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-muted/60 p-3">
                          <p className="text-xs text-muted-foreground">Coordenador</p>
                          <p className="mt-1 text-sm font-medium">{project.coordinator}</p>
                        </div>
                        <div className="rounded-xl bg-muted/60 p-3">
                          <p className="text-xs text-muted-foreground">Proxima entrega</p>
                          <p className="mt-1 text-sm font-medium">{project.nextDelivery}</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-dashed border-elementus-blue/30 bg-white p-3">
                        <p className="text-xs font-medium text-elementus-blue">
                          Pasta de emissao no Microsoft 365
                        </p>
                        <p className="mt-1 text-sm text-foreground">{project.microsoft365Folder}</p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Dados que entram automaticamente no relatorio
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">cliente_nome</Badge>
                          <Badge variant="outline">empreendimento</Badge>
                          <Badge variant="outline">projeto</Badge>
                          <Badge variant="outline">pasta_m365</Badge>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Link to={`/reports/generate?project=${project.id}`}>
                          <Button size="sm">
                            Abrir fluxo do relatorio
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
