import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  FolderOpen,
  Save,
  Sparkles,
} from "lucide-react";
import { Header } from "@/components/layout";
import { FlowStageStrip } from "@/components/workflow/FlowStageStrip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  buildWorkflowHref,
  getDefaultWorkflowCase,
  getWorkflowCaseById,
} from "@/data/workflow";
import { reportStatusMeta, type ReportRecord } from "@/data/platform";
import { loadReportRecord, persistReportRecord } from "@/lib/reportWorkspace";
import { formatDateTime } from "@/lib/utils";

export function ReportWorkspacePlatformPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedCase =
    getWorkflowCaseById(searchParams.get("case")) ?? getDefaultWorkflowCase("relatorio");
  const reportId = searchParams.get("report") ?? selectedCase?.linkedReportId;

  const [report, setReport] = useState<ReportRecord | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    void loadReportRecord(reportId).then((resolvedReport) => {
      if (!active) {
        return;
      }

      setReport(resolvedReport);
    });

    return () => {
      active = false;
    };
  }, [reportId]);

  const status = report ? reportStatusMeta[report.status] : null;
  const filledSections =
    report?.sections.filter((section) => section.content.trim().length > 0).length ?? 0;
  const imageCount =
    report?.sections.reduce((total, section) => total + section.images.length, 0) ?? 0;

  const handleSectionChange = (sectionId: string, content: string) => {
    if (!report) {
      return;
    }

    setReport({
      ...report,
      sections: report.sections.map((section) =>
        section.id === sectionId ? { ...section, content } : section
      ),
    });
  };

  const handleSave = async () => {
    if (!report) {
      return;
    }

    setSaving(true);
    const nextReport = await persistReportRecord({
      ...report,
      status: report.status === "draft" ? "review" : report.status,
    });
    setReport(nextReport);
    setEditingSectionId(null);
    setMessage("Texto salvo. A minuta continua pronta para refinamento e encaixe de imagens.");
    setSaving(false);
  };

  if (!selectedCase) {
    return null;
  }

  if (!report || !status) {
    return (
      <div>
        <Header
          title="Relatorio"
          description="A minuta ainda nao foi criada. Gere a primeira versao a partir da montagem."
        />
        <div className="space-y-6 p-4 lg:p-6">
          <FlowStageStrip activeStage="relatorio" caseId={selectedCase.id} />
          <Card>
            <CardContent className="space-y-4 p-8 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
              <div>
                <p className="text-lg font-semibold">Nenhuma minuta disponivel</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Abra a etapa de montagem e gere a primeira versao com IA para seguir.
                </p>
              </div>
              <Button onClick={() => navigate(buildWorkflowHref("montagem", { caseId: selectedCase.id }))}>
                Ir para montagem
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Relatorio"
        description="A primeira versao nasce da conversa do WhatsApp e vira um editor tecnico em blocos."
      />

      <div className="space-y-6 p-4 lg:p-6">
        <FlowStageStrip activeStage="relatorio" caseId={selectedCase.id} reportId={report.id} />

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <Card className="border-elementus-blue/20 bg-elementus-blue/5">
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-elementus-blue">{report.reportNumber}</p>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <Badge variant={report.microsoft365.status === "saved" ? "success" : "outline"}>
                    {report.microsoft365.status === "saved" ? "M365 salvo" : "M365 pendente"}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-xl font-semibold">{report.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {selectedCase.aiInstruction}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Secoes prontas</p>
                    <p className="mt-2 text-3xl font-semibold text-elementus-blue">
                      {filledSections}/{report.sections.length}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Imagens encaixadas</p>
                    <p className="mt-2 text-3xl font-semibold text-elementus-blue">{imageCount}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ultima revisao</p>
                    <p className="mt-2 text-sm font-semibold text-elementus-blue">
                      {formatDateTime(report.updatedAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Contexto do atendimento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Resumo</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {selectedCase.summary}
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Destino final</p>
                  <p className="mt-2 font-medium">{report.microsoft365.folderPath}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    O encaminhamento final sera aberto com o contato ERP assim que a minuta estiver validada.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedCase.extractedFields.map((field) => (
                    <Badge key={field.id} variant={field.status === "erp" ? "success" : "outline"}>
                      {field.label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col gap-3 p-5">
                <Button onClick={() => void handleSave()} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar revisao"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(
                      buildWorkflowHref("imagens", {
                        caseId: selectedCase.id,
                        reportId: report.id,
                      })
                    )
                  }
                >
                  Seguir para imagens
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {message ? (
              <Card className="border-emerald-200 bg-emerald-50">
                <CardContent className="flex items-center gap-3 p-4 text-sm text-emerald-900">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>{message}</span>
                </CardContent>
              </Card>
            ) : null}

            {report.sections.map((section) => {
              const isEditing = editingSectionId === section.id;

              return (
                <Card key={section.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-elementus-blue">
                          Secao {section.number}
                        </p>
                        <CardTitle className="text-base">{section.title}</CardTitle>
                      </div>
                      <Button
                        variant={isEditing ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setEditingSectionId(isEditing ? null : section.id)}
                      >
                        {isEditing ? "Fechar edicao" : "Editar bloco"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isEditing ? (
                      <textarea
                        value={section.content}
                        onChange={(event) => handleSectionChange(section.id, event.target.value)}
                        className="min-h-40 w-full rounded-xl border bg-white px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    ) : (
                      <div className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                        {section.content}
                      </div>
                    )}

                    <Separator />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Estado do bloco</p>
                        <p className="text-xs text-muted-foreground">
                          {section.images.length > 0
                            ? `${section.images.length} imagem(ns) ligadas a esta secao.`
                            : "Nenhuma imagem ligada a este bloco ainda."}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Sparkles className="h-4 w-4 text-elementus-blue" />
                        Primeira versao gerada com IA
                      </div>
                    </div>

                    {section.images.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {section.images.map((image) => (
                          <Badge key={image.id} variant="outline">
                            {image.caption}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}

            <Card>
              <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold">O que vem depois</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Depois do texto, a plataforma entra na etapa visual para encaixar as evidencias nos
                    blocos certos do relatorio.
                  </p>
                </div>
                <Button
                  onClick={() =>
                    navigate(
                      buildWorkflowHref("imagens", {
                        caseId: selectedCase.id,
                        reportId: report.id,
                      })
                    )
                  }
                >
                  Abrir etapa de imagens
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
