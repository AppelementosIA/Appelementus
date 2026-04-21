import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, FileImage, Save } from "lucide-react";
import { Header } from "@/components/layout";
import { FlowStageStrip } from "@/components/workflow/FlowStageStrip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildWorkflowHref,
  getDefaultWorkflowCase,
  getWorkflowCaseById,
} from "@/data/workflow";
import { type ReportRecord } from "@/data/platform";
import { loadReportRecord, persistReportRecord } from "@/lib/reportWorkspace";

export function ImagesPlatformPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedCase =
    getWorkflowCaseById(searchParams.get("case")) ?? getDefaultWorkflowCase("imagens");
  const reportId = searchParams.get("report") ?? selectedCase?.linkedReportId;

  const [report, setReport] = useState<ReportRecord | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedSectionByImage, setSelectedSectionByImage] = useState<Record<string, string>>({});

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

  useEffect(() => {
    if (!selectedCase || !report) {
      return;
    }

    setSelectedSectionByImage(
      selectedCase.images.reduce<Record<string, string>>((acc, image) => {
        acc[image.id] =
          report.sections.find((section) => section.id === image.suggestedSectionId)?.id ??
          report.sections[0]?.id ??
          "";
        return acc;
      }, {})
    );
  }, [report, selectedCase]);

  const assignedImageIds = useMemo(() => {
    if (!report) {
      return new Set<string>();
    }

    return new Set(report.sections.flatMap((section) => section.images.map((image) => image.id)));
  }, [report]);

  const assignedCount = assignedImageIds.size;

  const handleAssignImage = async (imageId: string) => {
    if (!report || !selectedCase) {
      return;
    }

    const sourceImage = selectedCase.images.find((item) => item.id === imageId);
    const targetSectionId = selectedSectionByImage[imageId];

    if (!sourceImage || !targetSectionId) {
      return;
    }

    setSaving(true);

    const nextReport = await persistReportRecord({
      ...report,
      sections: report.sections.map((section) =>
        section.id === targetSectionId
          ? {
              ...section,
              images: assignedImageIds.has(sourceImage.id)
                ? section.images
                : [
                    ...section.images,
                    {
                      id: sourceImage.id,
                      sectionId: targetSectionId,
                      name: sourceImage.name,
                      caption: sourceImage.caption,
                      addedAt: sourceImage.capturedAt,
                      source: "platform",
                    },
                  ],
            }
          : section
      ),
    });

    setReport(nextReport);
    setSaving(false);
    setMessage("Imagem encaixada no bloco escolhido e salva no rascunho.");
  };

  if (!selectedCase || !report) {
    return null;
  }

  return (
    <div>
      <Header
        title="Imagens"
        description="A etapa visual organiza as evidencias do WhatsApp nos blocos certos do relatorio."
      />

      <div className="space-y-6 p-4 lg:p-6">
        <FlowStageStrip activeStage="imagens" caseId={selectedCase.id} reportId={report.id} />

        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-6">
            <Card className="border-elementus-blue/20 bg-elementus-blue/5">
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-elementus-blue">{selectedCase.protocol}</p>
                  <Badge variant="outline">{assignedCount}/{selectedCase.images.length} encaixadas</Badge>
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Caixa de imagens do atendimento</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {selectedCase.summary}
                  </p>
                </div>
              </CardContent>
            </Card>

            {message ? (
              <Card className="border-emerald-200 bg-emerald-50">
                <CardContent className="flex items-center gap-3 p-4 text-sm text-emerald-900">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>{message}</span>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fotos recebidas pelo WhatsApp</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedCase.images.map((image) => {
                  const assigned = assignedImageIds.has(image.id);

                  return (
                    <div key={image.id} className="rounded-2xl border p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex gap-4">
                          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted text-elementus-blue">
                            <FileImage className="h-8 w-8" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{image.caption}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{image.name}</p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Local: {image.location}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Sugestao automatica: {image.suggestedSectionId}
                            </p>
                          </div>
                        </div>

                        <Badge variant={assigned ? "success" : "outline"}>
                          {assigned ? "Ja encaixada" : "Aguardando bloco"}
                        </Badge>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                        <select
                          value={selectedSectionByImage[image.id] ?? ""}
                          onChange={(event) =>
                            setSelectedSectionByImage((current) => ({
                              ...current,
                              [image.id]: event.target.value,
                            }))
                          }
                          className="h-11 rounded-xl border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {report.sections.map((section) => (
                            <option key={section.id} value={section.id}>
                              Secao {section.number} - {section.title}
                            </option>
                          ))}
                        </select>

                        <Button onClick={() => void handleAssignImage(image.id)} disabled={assigned || saving}>
                          <Save className="mr-2 h-4 w-4" />
                          Encaixar no relatorio
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Mapa visual por secao</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.sections.map((section) => (
                  <div key={section.id} className="rounded-2xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-elementus-blue">
                          Secao {section.number}
                        </p>
                        <p className="text-sm font-semibold">{section.title}</p>
                      </div>
                      <Badge variant={section.images.length > 0 ? "success" : "outline"}>
                        {section.images.length} imagem(ns)
                      </Badge>
                    </div>

                    {section.images.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {section.images.map((image) => (
                          <Badge key={image.id} variant="outline">
                            {image.caption}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                        Nenhuma evidencia encaixada nesta secao ainda.
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold">Relatorio pronto para a saida final</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Depois das imagens, a plataforma consolida destino do documento e e-mail ao contato do ERP.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate(
                        buildWorkflowHref("relatorio", {
                          caseId: selectedCase.id,
                          reportId: report.id,
                        })
                      )
                    }
                  >
                    Voltar ao texto
                  </Button>
                  <Button
                    onClick={() =>
                      navigate(
                        buildWorkflowHref("envio", {
                          caseId: selectedCase.id,
                          reportId: report.id,
                        })
                      )
                    }
                  >
                    Ir para envio
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
