import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Download, Eye, Plus, Search } from "lucide-react";
import { Header } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const reports = [
  {
    id: "1",
    report_number: "RT-812/2026",
    title: "Relatório de Implantação — Reposição Florestal CAERN",
    client: "CAERN",
    type: "Implantação",
    status: "review",
    generated_at: "12/04/2026",
  },
  {
    id: "2",
    report_number: "RT-811/2026",
    title: "Monitoramento Trimestral de Fauna — Q1 2026",
    client: "Engie",
    type: "Monitoramento",
    status: "approved",
    generated_at: "10/04/2026",
  },
  {
    id: "3",
    report_number: "RT-810/2026",
    title: "Relatório Semestral Qualidade da Água — S2 2025",
    client: "Anglo American",
    type: "Semestral",
    status: "generating",
    generated_at: "09/04/2026",
  },
  {
    id: "4",
    report_number: "RT-809/2026",
    title: "Condicionante 2.4 — Monitoramento de Ruído",
    client: "Taesa",
    type: "Condicionante",
    status: "delivered",
    generated_at: "07/04/2026",
  },
  {
    id: "5",
    report_number: "PT-045/2026",
    title: "Parecer Técnico — Viabilidade Ambiental Complexo Eólico",
    client: "Enel Green Power",
    type: "Parecer",
    status: "draft",
    generated_at: "05/04/2026",
  },
];

const statusConfig: Record<string, { label: string; variant: "info" | "success" | "warning" | "default" | "secondary" }> = {
  draft: { label: "Rascunho", variant: "default" },
  generating: { label: "Gerando...", variant: "info" },
  review: { label: "Em Revisão", variant: "warning" },
  approved: { label: "Aprovado", variant: "success" },
  delivered: { label: "Entregue", variant: "success" },
};

export function ReportsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = reports.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) && !r.report_number.toLowerCase().includes(search.toLowerCase()) && !r.client.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <Header title="Relatórios" description="Geração, revisão e entrega de relatórios técnicos" />

      <div className="p-6 space-y-4">
        {/* Barra de ação */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar relatório..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-md border bg-white pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Link to="/reports/generate">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Gerar Relatório
            </Button>
          </Link>
        </div>

        {/* Filtros */}
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">Todos ({reports.length})</TabsTrigger>
            <TabsTrigger value="review">Em Revisão ({reports.filter((r) => r.status === "review").length})</TabsTrigger>
            <TabsTrigger value="approved">Aprovados ({reports.filter((r) => r.status === "approved").length})</TabsTrigger>
            <TabsTrigger value="delivered">Entregues ({reports.filter((r) => r.status === "delivered").length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Lista */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum relatório encontrado</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((report) => {
              const s = statusConfig[report.status];
              return (
                <Card
                  key={report.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/reports/${report.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-mono font-semibold text-elementus-blue">
                            {report.report_number}
                          </span>
                          <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>
                        </div>
                        <p className="text-sm font-medium truncate">{report.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {report.client} · {report.type} · {report.generated_at}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); navigate(`/reports/${report.id}`); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
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
