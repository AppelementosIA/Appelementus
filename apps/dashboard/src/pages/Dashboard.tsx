import { useNavigate } from "react-router-dom";
import {
  FileText,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  ArrowRight,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Header } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";

const stats = [
  { label: "Relatórios este Mês", value: "11", icon: FileText, color: "text-elementus-blue" },
  { label: "Aguardando Revisão", value: "3", icon: Clock, color: "text-amber-600" },
  { label: "Dados Novos", value: "18", icon: MessageSquare, color: "text-elementus-green" },
  { label: "Alertas de Validação", value: "2", icon: AlertTriangle, color: "text-red-500" },
];

const pendingReports = [
  { id: "RT-812", description: "Reposição Florestal CAERN — Implantação", status: "review", date: "12/04" },
  { id: "RT-811", description: "Monitoramento Fauna Engie — Trimestral", status: "review", date: "10/04" },
  { id: "RT-810", description: "Qualidade Água Anglo — Semestral", status: "generating", date: "09/04" },
];

const recentFieldData = [
  { type: "photo", from: "Carlos Silva", message: "3 fotos de espécies — Ponto 4, Setor Leste", time: "Há 2h" },
  { type: "audio", from: "Pedro Almeida", message: "Áudio: registro de plantio 15 mudas jatobá", time: "Há 4h" },
  { type: "file", from: "Maria Souza", message: "Planilha de campo — Monitoramento hídrico", time: "Há 6h" },
  { type: "photo", from: "Carlos Silva", message: "5 fotos evidências EPIs — Campanha CAERN", time: "Ontem" },
];

const statusMap: Record<string, { label: string; variant: "warning" | "info" }> = {
  review: { label: "Aguardando Revisão", variant: "warning" },
  generating: { label: "Gerando...", variant: "info" },
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { hasAccess } = useAuth();

  return (
    <div>
      <Header title="Início" description="Motor de Relatórios Elementus" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <stat.icon className={`h-7 w-7 ${stat.color} opacity-70`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Ação rápida — Gerar Relatório */}
        {hasAccess("supervisor") && (
          <Card className="border-elementus-blue/30 bg-elementus-blue/5">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-elementus-blue">Gerar Novo Relatório</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Selecione um template, preencha os dados e gere o relatório automaticamente
                </p>
              </div>
              <Button onClick={() => navigate("/reports/generate")}>
                <Plus className="mr-2 h-4 w-4" />
                Gerar Relatório
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Relatórios pendentes */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Relatórios Pendentes
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/reports")}>
                  Ver todos
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {pendingReports.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mb-2 text-elementus-green" />
                  <p className="text-sm">Nenhum relatório pendente</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingReports.map((report) => {
                    const s = statusMap[report.status];
                    return (
                      <div
                        key={report.id}
                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => navigate(`/reports/${report.id}`)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{report.id}</span>
                            <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{report.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-xs text-muted-foreground">{report.date}</span>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dados de campo recentes */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4" />
                  Dados de Campo Recentes
                </CardTitle>
                {hasAccess("supervisor") && (
                  <Button variant="ghost" size="sm" onClick={() => navigate("/field-data")}>
                    Ver todos
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentFieldData.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elementus-blue/10 text-xs font-bold text-elementus-blue">
                      {item.from.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{item.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.from} · {item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline status */}
        {hasAccess("supervisor") && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Status do Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">WhatsApp recebidos</span>
                    <span className="font-medium">284</span>
                  </div>
                  <Progress value={100} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Processados pela IA</span>
                    <span className="font-medium">276 / 284</span>
                  </div>
                  <Progress value={97} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Validados</span>
                    <span className="font-medium">268 / 284</span>
                  </div>
                  <Progress value={94} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Relatórios gerados</span>
                    <span className="font-medium">47</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-elementus-green" />
                    <span className="text-xs text-muted-foreground">Pipeline operacional</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
