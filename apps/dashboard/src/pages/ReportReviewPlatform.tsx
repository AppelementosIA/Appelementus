import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileImage,
  FolderOpen,
  Save,
  Send,
} from "lucide-react";
import { Header } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  clients,
  projects,
  reportStatusMeta,
  sampleReports,
  type AttachmentRecord,
  type ClientRecord,
  type ProjectRecord,
  type ReportRecord,
} from "@/data/platform";
import { getStoredReportById, saveStoredReport } from "@/lib/reportDrafts";
import {
  fetchPlatformProjectsBundle,
  fetchPlatformReport,
  issuePlatformReport,
  savePlatformReport,
} from "@/lib/platformApi";
import { useAuth } from "@/hooks/useAuth";

function cloneReport(report: ReportRecord) {
  return JSON.parse(JSON.stringify(report)) as ReportRecord;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ReportReviewPlatformPage() {
  const params = useParams();
  const { getMicrosoftAccessToken, user } = useAuth();
  const [clientsData, setClientsData] = useState<ClientRecord[]>(clients);
  const [projectsData, setProjectsData] = useState<ProjectRecord[]>(projects);
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [showIssueConfirm, setShowIssueConfirm] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);

  useEffect(() => {
    let active = true;

    void fetchPlatformProjectsBundle()
      .then((bundle) => {
        if (!active) {
          return;
        }

        setClientsData(bundle.clients);
        setProjectsData(bundle.projects);
      })
      .catch(() => {
        // fallback local
      });

    if (!params.id) {
      setReport(null);
      return () => {
        active = false;
      };
    }

    const reportId = params.id;

    void fetchPlatformReport(reportId)
      .then((platformReport) => {
        if (!active) {
          return;
        }

        saveStoredReport(platformReport);
        setReport(cloneReport(platformReport));
      })
      .catch(() => {
        const source =
          getStoredReportById(reportId) ??
          sampleReports.find((item) => item.id === reportId);

        if (!active) {
          return;
        }

        setReport(source ? cloneReport(source) : null);
      });

    return () => {
      active = false;
    };
  }, [params.id]);

  const client = useMemo(
    () => (report ? clientsData.find((item) => item.id === report.clientId) : undefined),
    [clientsData, report]
  );
  const project = useMemo(
    () => (report ? projectsData.find((item) => item.id === report.projectId) : undefined),
    [projectsData, report]
  );
  const status = report ? reportStatusMeta[report.status] : null;

  const persistReport = (
    nextReport: ReportRecord,
    nextMessage?: string,
    tone: "success" | "error" = "success"
  ) => {
    const normalized = { ...nextReport, updatedAt: new Date().toISOString() };
    saveStoredReport(normalized);
    setReport(normalized);

    if (nextMessage) {
      setMessage(nextMessage);
      setMessageTone(tone);
    }

    void savePlatformReport(normalized).catch(() => {
      // fallback local ja salvo acima
    });
  };

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

  const handleSaveDraft = () => {
    if (!report) {
      return;
    }

    persistReport(
      {
        ...report,
        status: report.status === "draft" ? "review" : report.status,
      },
      "Rascunho salvo com sucesso."
    );
    setEditingSectionId(null);
  };

  const handleIssue = async () => {
    if (!report) {
      return;
    }

    try {
      setIsIssuing(true);

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
      setReport(cloneReport(issuedReport));
      setMessage("Relatorio emitido e salvo no Microsoft 365 com a sua conta corporativa.");
      setMessageTone("success");
      setShowIssueConfirm(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel emitir o relatorio no Microsoft 365."
      );
      setMessageTone("error");
    } finally {
      setIsIssuing(false);
    }
  };

  const handleAttachmentUpload = async (sectionId: string, files: FileList | null) => {
    if (!report || !files || files.length === 0) {
      return;
    }

    const attachments: AttachmentRecord[] = await Promise.all(
      Array.from(files).map(async (file, index) => ({
        id: `${sectionId}-${Date.now()}-${index}`,
        sectionId,
        name: file.name,
        caption: file.name.replace(/\.[^.]+$/, ""),
        addedAt: new Date().toISOString(),
        source: "upload",
        previewUrl: await readFileAsDataUrl(file),
      }))
    );

    persistReport(
      {
        ...report,
        sections: report.sections.map((section) =>
          section.id === sectionId
            ? { ...section, images: [...section.images, ...attachments] }
            : section
        ),
      },
      `${attachments.length} imagem(ns) adicionada(s) ao relatorio.`
    );
  };

  if (!report || !status) {
    return (
      <div>
        <Header title="Relatorio" description="Nao encontramos o relatorio solicitado" />
        <div className="p-6">
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              O relatorio nao foi encontrado ou ainda nao foi criado nesta sessao.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title={report.reportNumber}
        description="Edicao tecnica, anexos de imagem e emissao final do relatorio"
      />

      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/reports">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </Link>
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge variant={report.microsoft365.status === "saved" ? "success" : "outline"}>
              {report.microsoft365.status === "saved" ? "Microsoft 365 salvo" : "Microsoft 365 pendente"}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleSaveDraft}>
              <Save className="mr-2 h-4 w-4" />
              Salvar rascunho
            </Button>
            <Button onClick={() => setShowIssueConfirm(true)} disabled={isIssuing}>
              <Send className="mr-2 h-4 w-4" />
              {isIssuing ? "Emitindo..." : "Emitir relatorio"}
            </Button>
          </div>
        </div>

        {message ? (
          <Card
            className={
              messageTone === "success"
                ? "border-elementus-green/20 bg-elementus-green/5"
                : "border-destructive/20 bg-destructive/5"
            }
          >
            <CardContent className="flex items-center gap-3 p-4 text-sm">
              {messageTone === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-elementus-green" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              <span>{message}</span>
            </CardContent>
          </Card>
        ) : null}

        {showIssueConfirm ? (
          <Card className="border-elementus-blue/20 bg-elementus-blue/5">
            <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="font-semibold">Confirmar emissao</h3>
                <p className="text-sm text-muted-foreground">
                  Ao emitir, o relatorio sera marcado como concluido e salvo na pasta oficial do Microsoft 365 deste projeto.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowIssueConfirm(false)} disabled={isIssuing}>
                  Cancelar
                </Button>
                <Button onClick={() => void handleIssue()} disabled={isIssuing}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {isIssuing ? "Salvando..." : "Confirmar emissao"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resumo do relatorio</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="mt-1 font-medium">{client?.name}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Projeto</p>
                  <p className="mt-1 font-medium">{project?.name}</p>
                  <p className="text-sm text-muted-foreground">{project?.undertaking}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Periodo</p>
                  <p className="mt-1 font-medium">{report.period}</p>
                </div>
                <div className="rounded-xl border border-dashed border-elementus-blue/30 p-4">
                  <div className="flex items-center gap-2 text-elementus-blue">
                    <FolderOpen className="h-4 w-4" />
                    <p className="text-sm font-semibold">Destino Microsoft 365</p>
                  </div>
                  <p className="mt-2 text-sm">{report.microsoft365.folderPath}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ultimo salvamento:{" "}
                    {report.microsoft365.lastSavedAt
                      ? new Date(report.microsoft365.lastSavedAt).toLocaleString("pt-BR")
                      : "Ainda nao emitido"}
                  </p>
                  {report.microsoft365.savedBy ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Emitido por: {report.microsoft365.savedBy}
                    </p>
                  ) : null}
                  {report.microsoft365.folderUrl ? (
                    <Button variant="outline" size="sm" className="mt-3" asChild>
                      <a href={report.microsoft365.folderUrl} target="_blank" rel="noreferrer">
                        <FolderOpen className="mr-2 h-4 w-4" />
                        Abrir pasta no Microsoft 365
                      </a>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Dados puxados do cadastro</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">cliente_nome</Badge>
                  <Badge variant="outline">empreendimento</Badge>
                  <Badge variant="outline">projeto</Badge>
                  <Badge variant="outline">numero_relatorio</Badge>
                  <Badge variant="outline">pasta_m365</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
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
                        {isEditing ? "Fechar edicao" : "Editar texto"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isEditing ? (
                      <textarea
                        value={section.content}
                        onChange={(event) => handleSectionChange(section.id, event.target.value)}
                        className="min-h-40 w-full rounded-md border bg-white px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    ) : (
                      <div className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                        {section.content}
                      </div>
                    )}

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Imagens da secao</p>
                          <p className="text-xs text-muted-foreground">
                            O tecnico anexa as evidencias diretamente antes da emissao.
                          </p>
                        </div>
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent">
                          <FileImage className="mr-2 h-4 w-4" />
                          Adicionar imagens
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(event) => void handleAttachmentUpload(section.id, event.target.files)}
                          />
                        </label>
                      </div>

                      {section.images.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                          Nenhuma imagem anexada nesta secao.
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {section.images.map((image) => (
                            <div key={image.id} className="overflow-hidden rounded-xl border bg-white">
                              <div className="aspect-[4/3] bg-muted">
                                {image.previewUrl ? (
                                  <img
                                    src={image.previewUrl}
                                    alt={image.caption}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-muted-foreground">
                                    <FileImage className="h-8 w-8" />
                                  </div>
                                )}
                              </div>
                              <div className="space-y-1 p-3">
                                <p className="text-sm font-medium">{image.caption}</p>
                                <p className="text-xs text-muted-foreground">{image.name}</p>
                                {image.microsoft365Url ? (
                                  <a
                                    href={image.microsoft365Url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex text-xs font-medium text-elementus-blue hover:underline"
                                  >
                                    Abrir anexo salvo no Microsoft 365
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-semibold">Saida final da etapa 1</h3>
              <p className="text-sm text-muted-foreground">
                O relatorio fica pronto para gerar o `.docx`, salvar no Microsoft 365 e manter a revisao feita pelo tecnico dentro da plataforma.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {report.microsoft365.docxUrl ? (
                <Button variant="outline" asChild>
                  <a href={report.microsoft365.docxUrl} target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Abrir .docx salvo
                  </a>
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  <Download className="mr-2 h-4 w-4" />
                  Emitir para gerar .docx
                </Button>
              )}
              <Button variant="outline" disabled={!report.microsoft365.pdfUrl}>
                <Download className="mr-2 h-4 w-4" />
                PDF em proxima iteracao
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
