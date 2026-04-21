import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, Clock3, MapPin, Search, TriangleAlert } from "lucide-react";
import { Header } from "@/components/layout";
import { FlowStageStrip } from "@/components/workflow/FlowStageStrip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildWorkflowCaseHref,
  getWorkflowCaseById,
  workflowCases,
  workflowOperationalStatusMeta,
  workflowPriorityMeta,
} from "@/data/workflow";
import { cn, formatDateTime } from "@/lib/utils";

type IntakeFilter = "all" | "awaiting_data" | "ready_for_ai" | "active";

export function IntakePlatformPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<IntakeFilter>("all");
  const [selectedCaseId, setSelectedCaseId] = useState(workflowCases[0]?.id ?? "");
  const deferredSearch = useDeferredValue(search);

  const visibleCases = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();

    return workflowCases.filter((item) => {
      if (filter === "awaiting_data" && item.operationalStatus !== "awaiting_data") {
        return false;
      }

      if (filter === "ready_for_ai" && item.operationalStatus !== "ready_for_ai") {
        return false;
      }

      if (
        filter === "active" &&
        !["draft_ready", "image_review", "ready_to_send"].includes(item.operationalStatus)
      ) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      const haystack = [
        item.protocol,
        item.clientName,
        item.location,
        item.serviceType,
        item.technicianName,
        item.summary,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [deferredSearch, filter]);

  const selectedCase = getWorkflowCaseById(selectedCaseId) ?? visibleCases[0] ?? workflowCases[0];

  const stats = [
    {
      label: "Fila WhatsApp",
      value: workflowCases.length,
      helper: "Atendimentos vivos no fluxo",
    },
    {
      label: "Aguardando dados",
      value: workflowCases.filter((item) => item.operationalStatus === "awaiting_data").length,
      helper: "Bot ainda completando coleta",
    },
    {
      label: "Prontos para IA",
      value: workflowCases.filter((item) => item.operationalStatus === "ready_for_ai").length,
      helper: "Podem virar minuta agora",
    },
    {
      label: "Prontos para envio",
      value: workflowCases.filter((item) => item.operationalStatus === "ready_to_send").length,
      helper: "Contato ERP ja localizado",
    },
  ];

  return (
    <div>
      <Header
        title="Entrada"
        description="Atendimentos do WhatsApp entram aqui, com bot, ERP e plataforma trabalhando em sequencia."
      />

      <div className="space-y-6 p-4 lg:p-6">
        <FlowStageStrip activeStage="entrada" caseId={selectedCase?.id} reportId={selectedCase?.linkedReportId} />

        <Card className="border-elementus-blue/20 bg-elementus-blue/5">
          <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-elementus-blue">
                Fluxo operacional
              </p>
              <h3 className="mt-2 text-xl font-semibold">
                O dashboard deixa de ser menu e vira fila viva de atendimento.
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Cada conversa do tecnico no WhatsApp chega como atendimento em montagem. O bot extrai,
                pergunta o que falta, puxa contato do ERP e prepara o ponto certo para gerar o
                relatorio com IA.
              </p>
              <div className="mt-4">
                <Button asChild>
                  <Link to="/montagem?case=case-manual-start">
                    Abrir construcao manual
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-elementus-blue">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.helper}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar por protocolo, cliente, local ou tecnico"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="h-11 w-full rounded-xl border bg-white pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "all", label: "Todos" },
                      { id: "awaiting_data", label: "Aguardando dados" },
                      { id: "ready_for_ai", label: "Prontos para IA" },
                      { id: "active", label: "Em andamento" },
                    ].map((item) => (
                      <Button
                        key={item.id}
                        variant={filter === item.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter(item.id as IntakeFilter)}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {visibleCases.map((item) => {
                const status = workflowOperationalStatusMeta[item.operationalStatus];
                const priority = workflowPriorityMeta[item.priority];
                const isSelected = item.id === selectedCase?.id;

                return (
                  <Card
                    key={item.id}
                    className={cn(
                      "transition-colors hover:border-elementus-blue/40 hover:bg-elementus-blue/5",
                      isSelected && "border-elementus-blue bg-elementus-blue/5"
                    )}
                  >
                    <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
                      <button
                        type="button"
                        onClick={() => setSelectedCaseId(item.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-elementus-blue">{item.protocol}</p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              priority.className
                            )}
                          >
                            Prioridade {priority.label}
                          </span>
                        </div>

                        <p className="mt-3 text-base font-semibold">
                          {item.clientName} · {item.serviceType}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>

                        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {item.location}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-4 w-4" />
                            {item.technicianName}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-4 w-4" />
                            Atualizado {formatDateTime(item.updatedAt)}
                          </span>
                        </div>

                        {item.missingFieldLabels.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.missingFieldLabels.map((field) => (
                              <Badge key={field} variant="warning">
                                {field}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </button>

                      <div className="flex items-center gap-3">
                        <Button asChild>
                          <Link to={buildWorkflowCaseHref(item)}>
                            Continuar
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {visibleCases.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum atendimento encontrado com esse filtro.
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>

          {selectedCase ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Atendimento em foco</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl bg-muted/40 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Proximo passo</p>
                    <p className="mt-2 font-semibold">{selectedCase.nextAction}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{selectedCase.nextQuestion}</p>
                  </div>

                  <div className="grid gap-3">
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
                              : "capturado"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{field.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="flex gap-3 p-5 text-sm text-amber-900">
                  <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">O que esta travando agora</p>
                    <p className="mt-1">
                      {selectedCase.missingFieldLabels.length > 0
                        ? `Ainda faltam ${selectedCase.missingFieldLabels.length} campo(s) antes da geracao da minuta.`
                        : "Nada trava a fila agora. Este atendimento pode seguir adiante."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
