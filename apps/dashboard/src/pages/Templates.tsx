import { FileStack, Upload, Eye, Edit, Download } from "lucide-react";
import { Header } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const templates = [
  {
    id: "1",
    name: "Relatório de Implantação",
    type: "implantation",
    description: "Template para relatórios de implantação e reposição florestal. Baseado no RT-750/2025.",
    placeholders: 14,
    active: true,
    last_updated: "2026-04-01",
    used_count: 8,
  },
  {
    id: "2",
    name: "Relatório de Monitoramento Trimestral",
    type: "quarterly_monitoring",
    description: "Template para monitoramento trimestral de fauna, flora e água. Estrutura padrão com seções IBAMA.",
    placeholders: 18,
    active: true,
    last_updated: "2026-03-28",
    used_count: 15,
  },
  {
    id: "3",
    name: "Relatório Semestral de Condicionantes",
    type: "semester_condicionante",
    description: "Template para relatórios semestrais de atendimento a condicionantes ambientais.",
    placeholders: 16,
    active: true,
    last_updated: "2026-03-20",
    used_count: 6,
  },
  {
    id: "4",
    name: "Relatório Anual Consolidado",
    type: "annual_consolidated",
    description: "Template para relatório anual consolidado com todos os monitoramentos do período.",
    placeholders: 22,
    active: false,
    last_updated: "2026-02-15",
    used_count: 2,
  },
  {
    id: "5",
    name: "Parecer Técnico",
    type: "technical_opinion",
    description: "Template para pareceres técnicos de viabilidade ambiental e análises especializadas.",
    placeholders: 10,
    active: true,
    last_updated: "2026-04-05",
    used_count: 4,
  },
];

const placeholderExamples = [
  "{{cliente_nome}}", "{{empreendimento}}", "{{condicionante}}",
  "{{periodo}}", "{{tabela_especies}}", "{{figura_localizacao}}",
  "{{responsavel_tecnico}}", "{{numero_relatorio}}",
];

export function TemplatesPage() {
  return (
    <div>
      <Header title="Templates" description="Templates mestre (.docx) com identidade visual Elementus" />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Templates determinísticos — Camada 1 da arquitetura. Layout fixo, conteúdo variável via placeholders.
            </p>
          </div>
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload Template
          </Button>
        </div>

        {/* Placeholders reference */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Placeholders Disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {placeholderExamples.map((p) => (
                <code key={p} className="rounded bg-muted px-2 py-1 text-xs font-mono">
                  {p}
                </code>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Templates list */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-elementus-blue/10">
                      <FileStack className="h-5 w-5 text-elementus-blue" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{template.name}</h3>
                      <p className="text-[10px] text-muted-foreground">
                        {template.placeholders} placeholders · {template.used_count}x usado
                      </p>
                    </div>
                  </div>
                  <Badge variant={template.active ? "success" : "default"}>
                    {template.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground mb-3">{template.description}</p>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    Atualizado: {template.last_updated}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
