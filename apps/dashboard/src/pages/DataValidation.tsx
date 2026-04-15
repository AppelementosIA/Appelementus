import { AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";
import { Header } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const issues = [
  {
    id: "1",
    severity: "error" as const,
    type: "legal_limit_exceeded",
    message: "Turbidez (45 NTU) acima do limite CONAMA 357 Classe 2 (40 NTU)",
    field: "Turbidez",
    point: "P3 — Rio Jaguaribe",
    project: "Qualidade da Água Anglo American",
    campaign: "Coleta Trimestral Q1 2026",
    expected: "≤ 40 NTU",
    actual: "45 NTU",
    resolved: false,
  },
  {
    id: "2",
    severity: "error" as const,
    type: "missing_collection_point",
    message: "Ponto P5 não possui dados para o período Jan-Mar 2026",
    field: null,
    point: "P5 — Nascente Sul",
    project: "Qualidade da Água Anglo American",
    campaign: "Coleta Trimestral Q1 2026",
    expected: "Dados presentes",
    actual: "Sem dados",
    resolved: false,
  },
  {
    id: "3",
    severity: "warning" as const,
    type: "atypical_value",
    message: "pH 4.2 — valor atípico para o ponto. Média histórica: 6.8",
    field: "pH",
    point: "P1 — Reservatório Norte",
    project: "Qualidade da Água Anglo American",
    campaign: "Coleta Trimestral Q1 2026",
    expected: "6.0 - 9.0",
    actual: "4.2",
    resolved: false,
  },
  {
    id: "4",
    severity: "warning" as const,
    type: "duplicate",
    message: "Registro duplicado — mesma espécie, mesmo ponto, mesma data",
    field: "Registro de espécie",
    point: "P8 — Transecto Leste",
    project: "Fauna Engie",
    campaign: "Campanha Q1 2026 — Fauna",
    expected: "Registro único",
    actual: "2 registros idênticos",
    resolved: false,
  },
  {
    id: "5",
    severity: "info" as const,
    type: "missing_field",
    message: "Coordenada GPS ausente — georreferenciamento pendente",
    field: "Coordenadas",
    point: "P12 — Borda Oeste",
    project: "Fauna Engie",
    campaign: "Campanha Q1 2026 — Fauna",
    expected: "Lat/Lng",
    actual: "Não informado",
    resolved: false,
  },
  {
    id: "6",
    severity: "error" as const,
    type: "format_error",
    message: "Data de coleta inválida: 31/02/2026",
    field: "Data de coleta",
    point: "P2 — Margem Direita",
    project: "Condicionantes Taesa",
    campaign: "Condicionante 2.4 — Ruído",
    expected: "Data válida",
    actual: "31/02/2026",
    resolved: true,
  },
];

const severityConfig = {
  error: { icon: XCircle, color: "text-red-500", bg: "bg-red-50", label: "Erro" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50", label: "Alerta" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-50", label: "Info" },
};

export function DataValidationPage() {
  const unresolvedErrors = issues.filter((i) => i.severity === "error" && !i.resolved).length;
  const unresolvedWarnings = issues.filter((i) => i.severity === "warning" && !i.resolved).length;
  const resolved = issues.filter((i) => i.resolved).length;

  return (
    <div>
      <Header title="Validação de Dados" description="Revisão de inconsistências e alertas antes da geração de relatórios" />

      <div className="p-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-600">{unresolvedErrors}</p>
                <p className="text-xs text-muted-foreground">Erros pendentes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold text-amber-600">{unresolvedWarnings}</p>
                <p className="text-xs text-muted-foreground">Alertas pendentes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-600">{resolved}</p>
                <p className="text-xs text-muted-foreground">Resolvidos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Issues list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Problemas Encontrados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {issues.map((issue) => {
              const config = severityConfig[issue.severity];
              const Icon = config.icon;
              return (
                <div
                  key={issue.id}
                  className={`rounded-lg border p-4 ${issue.resolved ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium">{issue.message}</p>
                        {issue.resolved && <Badge variant="success">Resolvido</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {issue.project} · {issue.campaign} · {issue.point}
                      </p>
                      <div className="flex items-center gap-4 text-xs">
                        {issue.expected && (
                          <span>
                            <span className="text-muted-foreground">Esperado:</span>{" "}
                            <span className="font-medium text-green-700">{issue.expected}</span>
                          </span>
                        )}
                        {issue.actual && (
                          <span>
                            <span className="text-muted-foreground">Encontrado:</span>{" "}
                            <span className="font-medium text-red-700">{issue.actual}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {!issue.resolved && (
                      <div className="flex gap-1 shrink-0">
                        <Button variant="outline" size="sm">Ignorar</Button>
                        <Button size="sm">Resolver</Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
