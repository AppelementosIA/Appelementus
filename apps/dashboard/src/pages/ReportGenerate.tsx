import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const templates = [
  { id: "1", name: "Relatório de Implantação", description: "Reposição florestal, plantio, recuperação de áreas" },
  { id: "2", name: "Monitoramento Trimestral", description: "Fauna, flora, água — acompanhamento periódico" },
  { id: "3", name: "Relatório Semestral de Condicionantes", description: "Atendimento a condicionantes de licença" },
  { id: "4", name: "Relatório Anual Consolidado", description: "Compilação anual de dados e resultados" },
  { id: "5", name: "Parecer Técnico", description: "Análise técnica, viabilidade ambiental" },
];

export function ReportGeneratePage() {
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    // Simula geração pela IA — no real, chama a API que dispara o pipeline
    setTimeout(() => {
      navigate("/reports/RT-NEW");
    }, 2000);
  };

  return (
    <div>
      <Header title="Gerar Relatório" description="Escolha o template, preencha os dados e a IA gera o conteúdo" />

      <div className="p-6 space-y-6 max-w-3xl">
        <Link to="/reports">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>

        {/* Loading overlay */}
        {generating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-sm">
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-elementus-blue/10 animate-pulse">
                  <Sparkles className="h-8 w-8 text-elementus-blue" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Gerando relatório...</h3>
                <p className="text-sm text-muted-foreground">
                  O Agente Especialista Elementus está redigindo o conteúdo com base nos dados de campo e no estilo da empresa.
                </p>
                <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Processando dados e gerando seções...
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 1. Escolher Template */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">1. Tipo de Relatório</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  selectedTemplate === t.id ? "border-elementus-blue bg-elementus-blue/5" : "hover:bg-muted/50"
                }`}
              >
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-medium">{t.name}</span>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                {selectedTemplate === t.id && <CheckCircle2 className="ml-auto h-4 w-4 text-elementus-blue shrink-0" />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 2. Dados do Relatório */}
        {selectedTemplate && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">2. Dados do Relatório</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Cliente</label>
                  <input
                    type="text"
                    placeholder="Ex: Engie, CAERN, Anglo American..."
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Empreendimento</label>
                  <input
                    type="text"
                    placeholder="Ex: Parque Solar Assú V"
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Condicionante / Referência</label>
                  <input
                    type="text"
                    placeholder="Ex: 2.8 — Monitoramento de Fauna"
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Período</label>
                  <input
                    type="text"
                    placeholder="Ex: Janeiro a Março 2026"
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Responsável Técnico</label>
                  <input
                    type="text"
                    placeholder="Ex: Dr. Carlos Silva — CRBIO 12345/06"
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Nº do Relatório</label>
                  <input
                    type="text"
                    placeholder="Ex: RT-812/2026"
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Observações para a IA (opcional)</label>
                <textarea
                  placeholder="Instruções adicionais para o Agente Especialista... Ex: 'Focar na seção de resultados, destacar o registro de jaguatirica'"
                  className="mt-1 w-full min-h-[80px] rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  A IA vai usar os dados de campo recebidos via WhatsApp para preencher o relatório automaticamente.
                </p>
                <Button onClick={handleGenerate} disabled={generating}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar com IA
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
