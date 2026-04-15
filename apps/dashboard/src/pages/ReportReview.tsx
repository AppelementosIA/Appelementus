import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Edit3,
  Send,
  Download,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  AlertTriangle,
  MessageSquare,
  Eye,
  X,
  Plus,
} from "lucide-react";
import { Header } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

// Mock: relatório já gerado pela IA com imagens do WhatsApp inseridas
const mockReport = {
  id: "1",
  report_number: "RT-812/2026",
  title: "Relatório de Implantação — Reposição Florestal CAERN/ETE Jaguaribe",
  project: "Reposição Florestal CAERN",
  client: "CAERN",
  type: "Implantação",
  status: "review" as const,
  generated_at: "14/04/2026 14:30",
  responsible: "Eng. Pedro Almeida — CREA 123456/D",
  sections: [
    {
      id: "1",
      key: "apresentacao",
      number: "1",
      title: "Apresentação",
      content:
        "O presente relatório técnico apresenta os resultados das atividades de implantação do Programa de Reposição Florestal, desenvolvido pela Elementus Soluções Ambientais, referente à área da Estação de Tratamento de Esgoto (ETE) Jaguaribe, de responsabilidade da Companhia de Águas e Esgotos do Rio Grande do Norte (CAERN).\n\nAs atividades foram realizadas em atendimento à Condicionante 4.2 da Licença de Operação nº 089/2025, emitida pelo IBAMA, que determina a execução de programa de reposição florestal como medida compensatória aos impactos ambientais identificados no processo de licenciamento.",
      images: [],
      ai_confidence: 96,
    },
    {
      id: "2",
      key: "objetivo",
      number: "2",
      title: "Objetivo",
      content:
        "Apresentar os resultados das atividades de implantação do Programa de Reposição Florestal na área da ETE Jaguaribe, incluindo o preparo do solo, plantio das espécies nativas, e registro fotográfico das atividades realizadas no período de fevereiro a abril de 2026.",
      images: [],
      ai_confidence: 98,
    },
    {
      id: "3",
      key: "area_estudo",
      number: "3",
      title: "Área de Estudo",
      content:
        "A área de implantação do programa de reposição florestal está localizada no entorno da ETE Jaguaribe, município de Natal/RN, nas coordenadas -5.8234°S, -35.2156°W. A área total destinada ao plantio compreende 2,4 hectares, distribuídos em 4 setores conforme apresentado na Figura 1.",
      images: [
        {
          id: "img1",
          url: "/api/placeholder/800/500",
          caption: "Figura 1 — Mapa de localização da área de implantação com setores demarcados",
          source: "whatsapp",
          sent_by: "Pedro Almeida",
          sent_at: "12/04/2026 08:15",
        },
      ],
      ai_confidence: 94,
    },
    {
      id: "4",
      key: "materiais_metodos",
      number: "4",
      title: "Materiais e Métodos",
      content:
        "O plantio foi realizado seguindo as diretrizes do Plano de Reposição Florestal aprovado pelo IBAMA, utilizando espaçamento de 2x2 metros entre mudas. As espécies selecionadas são nativas do bioma Mata Atlântica, com prioridade para espécies pioneiras e secundárias iniciais.\n\nAs covas foram preparadas com dimensões de 40x40x40 cm, com adubação orgânica (2 kg de esterco bovino curtido por cova) e adubação química (100g de NPK 06-30-06 por cova). O plantio foi realizado nos períodos de maior precipitação para garantir o pegamento das mudas.",
      images: [],
      ai_confidence: 95,
    },
    {
      id: "5",
      key: "plantio",
      number: "5",
      title: "Atividades de Plantio",
      content:
        "Após a realização das atividades de preparo do solo, foi realizado o plantio das espécies nativas conforme cronograma estabelecido. No setor leste, foram plantadas 15 mudas no dia 28 de outubro, com espaçamento de 2x2 metros. As espécies plantadas incluem Jatobá (Hymenaea courbaril), Ipê-amarelo (Handroanthus albus), Aroeira (Schinus terebinthifolia) e Pau-brasil (Paubrasilia echinata).\n\nO Quadro 1 apresenta o quantitativo de mudas plantadas por espécie e setor.",
      images: [
        {
          id: "img2",
          url: "/api/placeholder/800/600",
          caption: "Figura 2 — Muda de Jatobá (Hymenaea courbaril) plantada no ponto P4, setor leste",
          source: "whatsapp",
          sent_by: "Pedro Almeida",
          sent_at: "12/04/2026 08:32",
        },
        {
          id: "img3",
          url: "/api/placeholder/800/600",
          caption: "Figura 3 — Vista geral do plantio no setor leste após conclusão das atividades",
          source: "whatsapp",
          sent_by: "Pedro Almeida",
          sent_at: "12/04/2026 09:10",
        },
        {
          id: "img4",
          url: "/api/placeholder/800/600",
          caption: "Figura 4 — Detalhe do espaçamento 2x2m entre mudas no setor leste",
          source: "whatsapp",
          sent_by: "Pedro Almeida",
          sent_at: "12/04/2026 09:15",
        },
      ],
      ai_confidence: 92,
      table: {
        title: "Quadro 1 — Quantitativo de mudas plantadas por espécie e setor",
        headers: ["Espécie", "Nome Científico", "Setor Norte", "Setor Leste", "Setor Sul", "Setor Oeste", "Total"],
        rows: [
          ["Jatobá", "Hymenaea courbaril", "12", "15", "10", "8", "45"],
          ["Ipê-amarelo", "Handroanthus albus", "10", "12", "8", "10", "40"],
          ["Aroeira", "Schinus terebinthifolia", "15", "18", "12", "14", "59"],
          ["Pau-brasil", "Paubrasilia echinata", "8", "10", "6", "8", "32"],
          ["Angico", "Anadenanthera colubrina", "10", "8", "10", "12", "40"],
          ["Total", "", "55", "63", "46", "52", "216"],
        ],
      },
    },
    {
      id: "6",
      key: "registro_fotografico",
      number: "6",
      title: "Registro Fotográfico",
      content:
        "As figuras a seguir apresentam o registro fotográfico das atividades de implantação realizadas nos setores norte e leste da área de reposição florestal.",
      images: [
        {
          id: "img5",
          url: "/api/placeholder/800/600",
          caption: "Figura 5 — Preparo do solo com abertura de covas no setor norte",
          source: "whatsapp",
          sent_by: "Pedro Almeida",
          sent_at: "10/04/2026 07:45",
        },
        {
          id: "img6",
          url: "/api/placeholder/800/600",
          caption: "Figura 6 — Equipe técnica durante atividade de plantio no setor norte",
          source: "whatsapp",
          sent_by: "Pedro Almeida",
          sent_at: "10/04/2026 10:20",
        },
        {
          id: "img7",
          url: "/api/placeholder/800/600",
          caption: "Figura 7 — Placa de identificação do Programa de Reposição Florestal instalada na área",
          source: "whatsapp",
          sent_by: "Pedro Almeida",
          sent_at: "12/04/2026 14:00",
        },
        {
          id: "img8",
          url: "/api/placeholder/800/600",
          caption: "Figura 8 — Evidência de uso de EPIs pela equipe durante as atividades",
          source: "whatsapp",
          sent_by: "Pedro Almeida",
          sent_at: "12/04/2026 14:05",
        },
      ],
      ai_confidence: 97,
    },
    {
      id: "7",
      key: "conclusao",
      number: "7",
      title: "Conclusão",
      content:
        "As atividades de implantação do Programa de Reposição Florestal na área da ETE Jaguaribe foram concluídas com êxito, totalizando 216 mudas de espécies nativas da Mata Atlântica plantadas em uma área de 2,4 hectares.\n\nO índice de pegamento observado até o momento é de 94%, considerado satisfatório para esta fase do programa. As mudas que não apresentaram pegamento serão replantadas na próxima campanha, conforme previsto no cronograma.\n\nRecomenda-se o acompanhamento trimestral das mudas plantadas, conforme estabelecido na Condicionante 4.2, com monitoramento de crescimento, sobrevivência e necessidade de replantio ou manejo.",
      images: [],
      ai_confidence: 93,
    },
  ],
  whatsapp_images_total: 8,
  whatsapp_images_used: 8,
  pending_issues: 1,
};

export function ReportReviewPage() {
  const { id } = useParams();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(mockReport.sections.map((s) => s.id))
  );
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [approved, setApproved] = useState(false);

  const toggleSection = (sectionId: string) => {
    const next = new Set(expandedSections);
    if (next.has(sectionId)) next.delete(sectionId);
    else next.add(sectionId);
    setExpandedSections(next);
  };

  const startEdit = (sectionId: string, content: string) => {
    setEditingSection(sectionId);
    if (!editedContent[sectionId]) {
      setEditedContent((prev) => ({ ...prev, [sectionId]: content }));
    }
  };

  const saveEdit = () => {
    setEditingSection(null);
  };

  const handleApprove = () => {
    setApproved(true);
    setShowApproveConfirm(false);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header fixo mobile-friendly */}
      <div className="sticky top-0 z-10 border-b bg-white">
        <div className="flex items-center justify-between px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/reports">
              <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold truncate lg:text-base">
                  {mockReport.report_number}
                </h1>
                <Badge variant={approved ? "success" : "warning"}>
                  {approved ? "Aprovado" : "Em Revisão"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {mockReport.project} — {mockReport.client}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="hidden sm:flex">
              <Download className="mr-2 h-3.5 w-3.5" />
              .docx
            </Button>
            {!approved && (
              <Button
                size="sm"
                className="bg-elementus-green hover:bg-elementus-green/90"
                onClick={() => setShowApproveConfirm(true)}
              >
                <Send className="mr-2 h-3.5 w-3.5" />
                <span className="hidden sm:inline">Aprovar e </span>Expedir
              </Button>
            )}
          </div>
        </div>

        {/* Barra de progresso de leitura */}
        <Progress value={approved ? 100 : 75} className="h-1 rounded-none" />
      </div>

      {/* Modal de confirmação de aprovação */}
      {showApproveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-elementus-green/10">
                <Send className="h-7 w-7 text-elementus-green" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Expedir Relatório?</h3>
              <p className="text-sm text-muted-foreground mb-1">
                <strong>{mockReport.report_number}</strong>
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {mockReport.title}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                O relatório será gerado em .docx e .pdf com a identidade Elementus
                e ficará disponível para envio ao cliente.
              </p>
              <div className="flex items-center gap-2 rounded-md border bg-blue-50 p-2.5 mb-6">
                <svg className="h-4 w-4 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zm-9 9h7v7H4v-7zm9 0h7v7h-7v-7z" opacity=".8"/></svg>
                <p className="text-[11px] text-blue-700 text-left">
                  Uma cópia será salva automaticamente no <strong>Microsoft 365</strong> da Elementus
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowApproveConfirm(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-elementus-green hover:bg-elementus-green/90"
                  onClick={handleApprove}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Expedir
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmação de aprovação */}
      {approved && (
        <div className="mx-4 mt-4 lg:mx-6">
          <Card className="border-elementus-green/30 bg-elementus-green/5">
            <CardContent className="flex items-center gap-3 p-4">
              <CheckCircle2 className="h-6 w-6 text-elementus-green shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-elementus-green">
                  Relatório expedido com sucesso
                </p>
                <p className="text-xs text-muted-foreground">
                  .docx e .pdf gerados · Cópia salva no Microsoft 365 · Disponível para envio ao cliente
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="outline" size="sm">
                  <Download className="mr-1 h-3 w-3" />
                  .docx
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="mr-1 h-3 w-3" />
                  .pdf
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
        {/* Resumo do relatório */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Tipo</p>
                <p className="font-medium">{mockReport.type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Responsável</p>
                <p className="font-medium text-xs">{mockReport.responsible}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gerado em</p>
                <p className="font-medium">{mockReport.generated_at}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fotos do WhatsApp</p>
                <div className="flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5 text-elementus-blue" />
                  <p className="font-medium">
                    {mockReport.whatsapp_images_used}/{mockReport.whatsapp_images_total} inseridas
                  </p>
                </div>
              </div>
            </div>

            {mockReport.pending_issues > 0 && !approved && (
              <>
                <Separator className="my-3" />
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs font-medium">
                    {mockReport.pending_issues} alerta(s) para revisar
                  </span>
                  <Link to="/validation" className="text-xs underline ml-auto">
                    Ver alertas
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Seções do relatório */}
        {mockReport.sections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const isEditing = editingSection === section.id;
          const content = editedContent[section.id] || section.content;

          return (
            <Card key={section.id} className="overflow-hidden">
              {/* Header da seção — clicável para expandir/colapsar */}
              <button
                onClick={() => toggleSection(section.id)}
                className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-elementus-blue/10 text-xs font-bold text-elementus-blue">
                    {section.number}
                  </span>
                  <h3 className="font-semibold text-sm truncate">{section.title}</h3>
                  {section.images.length > 0 && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      <ImageIcon className="mr-1 h-2.5 w-2.5" />
                      {section.images.length} foto{section.images.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {section.table && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      1 quadro
                    </Badge>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* Conteúdo da seção */}
              {isExpanded && (
                <CardContent className="px-4 pb-4 pt-0">
                  <Separator className="mb-4" />

                  {/* Texto */}
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={content}
                        onChange={(e) =>
                          setEditedContent((prev) => ({
                            ...prev,
                            [section.id]: e.target.value,
                          }))
                        }
                        className="w-full min-h-[200px] rounded-md border bg-white p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit}>
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingSection(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="group relative">
                      <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                        {content}
                      </div>
                      {!approved && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-xs text-muted-foreground opacity-60 group-hover:opacity-100"
                          onClick={() => startEdit(section.id, content)}
                        >
                          <Edit3 className="mr-1 h-3 w-3" />
                          Editar texto
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Tabela */}
                  {section.table && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        {section.table.title}
                      </p>
                      <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-elementus-blue/5">
                              {section.table.headers.map((h, i) => (
                                <th
                                  key={i}
                                  className="px-3 py-2 text-left font-semibold text-elementus-blue whitespace-nowrap"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {section.table.rows.map((row, ri) => (
                              <tr
                                key={ri}
                                className={`border-t ${
                                  ri === section.table!.rows.length - 1
                                    ? "bg-muted/50 font-semibold"
                                    : ""
                                }`}
                              >
                                {row.map((cell, ci) => (
                                  <td key={ci} className="px-3 py-2 whitespace-nowrap">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Imagens do WhatsApp */}
                  {section.images.length > 0 && (
                    <div className="mt-4 space-y-4">
                      {section.images.map((img) => (
                        <div key={img.id} className="space-y-2">
                          <div className="relative rounded-lg overflow-hidden border bg-muted/30">
                            {/* Placeholder de imagem — será substituído pela foto real */}
                            <div className="aspect-video bg-gradient-to-br from-elementus-blue/10 to-elementus-green/10 flex items-center justify-center">
                              <div className="text-center">
                                <ImageIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">
                                  Foto recebida via WhatsApp
                                </p>
                              </div>
                            </div>

                            {/* Badge de origem WhatsApp */}
                            <div className="absolute top-2 right-2">
                              <Badge
                                variant="outline"
                                className="bg-white/90 backdrop-blur text-[10px]"
                              >
                                <MessageSquare className="mr-1 h-2.5 w-2.5 text-green-600" />
                                {img.sent_by} · {img.sent_at}
                              </Badge>
                            </div>
                          </div>

                          {/* Legenda da figura */}
                          <p className="text-xs text-muted-foreground text-center italic px-2">
                            {img.caption}
                          </p>
                        </div>
                      ))}

                      {/* Botão para adicionar mais fotos */}
                      {!approved && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs border-dashed"
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Adicionar foto a esta seção
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Indicador de confiança da IA */}
                  <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${
                        section.ai_confidence >= 95
                          ? "bg-green-500"
                          : section.ai_confidence >= 90
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                    />
                    IA: {section.ai_confidence}% confiança nesta seção
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {/* Barra de ação inferior — fixa no mobile */}
        {!approved && (
          <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-3 lg:hidden z-10">
            <div className="flex gap-2 max-w-4xl mx-auto">
              <Button variant="outline" className="flex-1" size="sm">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Baixar .docx
              </Button>
              <Button
                className="flex-1 bg-elementus-green hover:bg-elementus-green/90"
                size="sm"
                onClick={() => setShowApproveConfirm(true)}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Aprovar e Expedir
              </Button>
            </div>
          </div>
        )}

        {/* Espaçamento para a barra inferior no mobile */}
        <div className="h-16 lg:hidden" />
      </div>
    </div>
  );
}
