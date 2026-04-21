import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Mail, Send, ShieldCheck } from "lucide-react";
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
import { type ReportRecord, reportStatusMeta } from "@/data/platform";
import { useAuth } from "@/hooks/useAuth";
import { issuePlatformReport } from "@/lib/platformApi";
import { loadReportRecord, persistReportRecord } from "@/lib/reportWorkspace";
import { saveStoredReport } from "@/lib/reportDrafts";
import { formatDateTime } from "@/lib/utils";

function buildMailtoHref(input: {
  email: string;
  recipientName: string;
  report: ReportRecord;
  clientName: string;
  location: string;
  senderName: string;
}) {
  const subject = `${input.report.reportNumber} - ${input.report.title}`;
  const body = [
    `Ola ${input.recipientName},`,
    "",
    `Segue o relatorio ${input.report.reportNumber} referente ao atendimento em ${input.location} para ${input.clientName}.`,
    "",
    "Fico a disposicao para qualquer ajuste.",
    "",
    `Atenciosamente,`,
    input.senderName,
  ].join("\n");

  return `mailto:${input.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function DeliveryPlatformPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedCase =
    getWorkflowCaseById(searchParams.get("case")) ?? getDefaultWorkflowCase("envio");
  const reportId = searchParams.get("report") ?? selectedCase?.linkedReportId;
  const { getMicrosoftAccessToken, hasMicrosoftSession, isPresentationMode, isPasswordMode, user } =
    useAuth();

  const [report, setReport] = useState<ReportRecord | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">("info");
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
  const imageCount =
    report?.sections.reduce((total, section) => total + section.images.length, 0) ?? 0;
  const mailtoHref = useMemo(() => {
    if (!report || !selectedCase) {
      return null;
    }

    return buildMailtoHref({
      email: selectedCase.erpContact.email,
      recipientName: selectedCase.erpContact.name,
      report,
      clientName: selectedCase.clientName,
      location: selectedCase.location,
      senderName: user?.name ?? selectedCase.draftInput.responsibleTechnical,
    });
  }, [report, selectedCase, user?.name]);

  const handleSaveFinal = async () => {
    if (!report) {
      return;
    }

    setSaving(true);
    const nextReport = await persistReportRecord({
      ...report,
      status: report.status === "draft" ? "review" : report.status,
    });
    setReport(nextReport);
    setMessage("Checklist final salvo. O pacote esta pronto para encaminhamento.");
    setMessageTone("success");
    setSaving(false);
  };

  const handleSaveToMicrosoft = async () => {
    if (!report) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const accessToken = await getMicrosoftAccessToken();
      const issuedReport = await issuePlatformReport({
        report,
        accessToken,
        emittedBy: {
          name: user?.name,
          email: user?.email,
        },
      });

      saveStoredReport(issuedReport);
      setReport(issuedReport);
      setMessage("Documento final salvo no Microsoft 365. Agora voce pode abrir o e-mail com o destinatario do ERP.");
      setMessageTone("success");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar o documento no Microsoft 365."
      );
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  };

  if (!selectedCase || !report || !status) {
    return null;
  }

  return (
    <div>
      <Header
        title="Envio"
        description="A etapa final fecha documento, contato ERP e e-mail de encaminhamento no mesmo lugar."
      />

      <div className="space-y-6 p-4 lg:p-6">
        <FlowStageStrip activeStage="envio" caseId={selectedCase.id} reportId={report.id} />

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <Card className="border-elementus-blue/20 bg-elementus-blue/5">
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-elementus-blue">{report.reportNumber}</p>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <Badge variant={report.microsoft365.status === "saved" ? "success" : "outline"}>
                    {report.microsoft365.status === "saved" ? "Documento salvo" : "Documento pendente"}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{report.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {selectedCase.nextAction}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Checklist de saida</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  {
                    label: "Texto tecnico revisado",
                    value: `${report.sections.length} secoes prontas`,
                  },
                  {
                    label: "Evidencias distribuidas",
                    value: `${imageCount} imagem(ns) encaixadas`,
                  },
                  {
                    label: "Contato puxado do ERP",
                    value: `${selectedCase.erpContact.name} · ${selectedCase.erpContact.email}`,
                  },
                  {
                    label: "Destino do documento",
                    value: report.microsoft365.folderPath,
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border p-4">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{item.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Contato final</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">ERP</p>
                  <p className="mt-2 font-semibold">{selectedCase.erpContact.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedCase.erpContact.email}</p>
                  <p className="text-sm text-muted-foreground">{selectedCase.erpContact.phone}</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ultima atualizacao</p>
                  <p className="mt-2 text-sm font-medium">{formatDateTime(report.updatedAt)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Acoes finais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={() => void handleSaveFinal()} disabled={saving} className="w-full">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar checklist final"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => void handleSaveToMicrosoft()}
                  disabled={saving || !hasMicrosoftSession}
                  className="w-full"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Salvar documento no Microsoft 365
                </Button>

                {mailtoHref ? (
                  <Button asChild className="w-full">
                    <a href={mailtoHref}>
                      <Mail className="mr-2 h-4 w-4" />
                      Abrir e-mail preenchido
                    </a>
                  </Button>
                ) : (
                  <Button className="w-full" disabled>
                    <Mail className="mr-2 h-4 w-4" />
                    Abrir e-mail preenchido
                  </Button>
                )}

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
                  className="w-full"
                >
                  Voltar para imagens
                </Button>

                {report.microsoft365.docxUrl ? (
                  <Button variant="outline" asChild className="w-full">
                    <a href={report.microsoft365.docxUrl} target="_blank" rel="noreferrer">
                      Abrir documento salvo
                    </a>
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            {!hasMicrosoftSession ? (
              <Card
                className={
                  isPresentationMode
                    ? "border-sky-200 bg-sky-50"
                    : "border-amber-200 bg-amber-50"
                }
              >
                <CardContent
                  className={`space-y-2 p-5 text-sm ${
                    isPresentationMode ? "text-sky-900" : "text-amber-950"
                  }`}
                >
                  <p className="font-semibold">
                    {isPresentationMode ? "Modo apresentacao ativo" : "Conexao Microsoft pendente"}
                  </p>
                  <p>
                    {isPresentationMode
                      ? "Nesta demonstracao o fluxo ja mostra o encaminhamento por e-mail, mas o botao de salvar no Microsoft 365 fica bloqueado para nao usar credenciais reais."
                      : isPasswordMode
                      ? "O acesso temporario por e-mail e senha libera a construcao do relatorio, mas o salvamento final no Microsoft 365 continua reservado para contas Microsoft."
                      : "Entre com Microsoft 365 para salvar o documento final diretamente no ambiente corporativo."}
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {message ? (
              <Card
                className={
                  messageTone === "error"
                    ? "border-destructive/20 bg-destructive/5"
                    : messageTone === "success"
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-elementus-blue/20 bg-elementus-blue/5"
                }
              >
                <CardContent className="p-5 text-sm">{message}</CardContent>
              </Card>
            ) : null}

            <Card>
              <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold">Encaminhamento em um clique</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Depois do documento, a plataforma abre o e-mail final com o contato puxado do ERP.
                  </p>
                </div>
                {mailtoHref ? (
                  <Button asChild variant="outline">
                    <a href={mailtoHref}>
                      Ir para o e-mail
                      <Send className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <Button variant="outline" disabled>
                    Ir para o e-mail
                    <Send className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
