import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { BadgeCheck, BriefcaseBusiness, FileSignature, Leaf, LoaderCircle, LogOut } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { completePlatformOnboarding } from "@/lib/userApi";

function inferMimeType(dataUrl?: string) {
  if (!dataUrl?.startsWith("data:")) {
    return undefined;
  }

  return dataUrl.slice(5, dataUrl.indexOf(";"));
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Nao foi possivel ler a assinatura enviada."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export function OnboardingPage() {
  const { user, getMicrosoftAccessToken, logout, setPlatformUser } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [professionalRole, setProfessionalRole] = useState("");
  const [registryType, setRegistryType] = useState("");
  const [registryNumber, setRegistryNumber] = useState("");
  const [canSignReports, setCanSignReports] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    setName(user.name);
    setPhone(user.phone || "");
    setProfessionalRole(user.professional_profile?.professional_role || "");
    setRegistryType(user.professional_profile?.registry_type || "");
    setRegistryNumber(user.professional_profile?.registry_number || "");
    setCanSignReports(Boolean(user.professional_profile?.can_sign_reports));
    setSignatureName(user.professional_profile?.signature_name || user.name);
    setSignatureDataUrl(user.professional_profile?.signature_data_url || "");
  }, [user]);

  const signatureHint = useMemo(() => {
    if (!canSignReports) {
      return "Marque esta opcao apenas para profissionais que realmente assinam relatorios.";
    }

    return "Envie uma imagem limpa da assinatura para aprovacoes futuras e uso no relatorio.";
  }, [canSignReports]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.onboarding_status === "active") {
    return <Navigate to="/" replace />;
  }

  const isBlocked = user.onboarding_status === "blocked";

  const handleSignatureUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setError(null);
      const nextDataUrl = await readFileAsDataUrl(file);
      setSignatureDataUrl(nextDataUrl);
      setSignatureName((current) => current || file.name.replace(/\.[a-z0-9]+$/i, ""));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Falha ao carregar a assinatura.");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setIsSaving(true);
      setError(null);

      const accessToken = await getMicrosoftAccessToken();
      const nextUser = await completePlatformOnboarding(accessToken, {
        name,
        phone,
        professional_role: professionalRole || undefined,
        registry_type: registryType || undefined,
        registry_number: registryNumber || undefined,
        can_sign_reports: canSignReports,
        signature_name: canSignReports ? signatureName || name : undefined,
        signature_data_url: canSignReports ? signatureDataUrl || undefined : undefined,
        signature_mime_type: canSignReports ? inferMimeType(signatureDataUrl) : undefined,
      });

      setPlatformUser(nextUser);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Nao foi possivel concluir o primeiro acesso."
      );
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-elementus-blue to-elementus-green p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader className="border-b pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-elementus-blue">
                <Leaf className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-elementus-blue">Primeiro acesso da Elementus</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Seu login Microsoft 365 ja foi validado. Agora vamos completar o cadastro no banco
                  da plataforma para liberar seu ambiente de trabalho.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <BriefcaseBusiness className="h-3 w-3" />
                    {user.email}
                  </Badge>
                  <Badge variant="outline">
                    Perfil inicial: {user.role === "technician" ? "Tecnico" : user.role}
                  </Badge>
                </div>
              </div>
            </div>

            <Button variant="outline" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {isBlocked ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
              <h2 className="text-lg font-semibold">Cadastro aguardando liberacao</h2>
              <p className="mt-2 text-sm">
                Seu acesso esta bloqueado no momento. Fale com a administracao da Elementus para
                liberar o perfil ou ajustar suas permissoes.
              </p>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Nome completo</label>
                  <input
                    className="mt-1 h-11 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Nome completo"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Telefone / WhatsApp</label>
                  <input
                    className="mt-1 h-11 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="(84) 99999-0000"
                  />
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-elementus-blue" />
                  <h2 className="font-semibold">Perfil profissional</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Estes dados alimentam o cadastro interno da equipe e a base de signatarios dos
                  relatorios.
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium">Funcao profissional</label>
                    <input
                      className="mt-1 h-11 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={professionalRole}
                      onChange={(event) => setProfessionalRole(event.target.value)}
                      placeholder="Engenheiro, Biologo, Tecnico..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Conselho / registro</label>
                    <input
                      className="mt-1 h-11 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={registryType}
                      onChange={(event) => setRegistryType(event.target.value)}
                      placeholder="CREA, CRBio, CAU..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Numero do registro</label>
                    <input
                      className="mt-1 h-11 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={registryNumber}
                      onChange={(event) => setRegistryNumber(event.target.value)}
                      placeholder="123456/D"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <FileSignature className="h-4 w-4 text-elementus-blue" />
                  <h2 className="font-semibold">Assinatura tecnica</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{signatureHint}</p>

                <label className="mt-4 flex items-center gap-3 rounded-xl border bg-white px-4 py-3">
                  <input
                    checked={canSignReports}
                    className="h-4 w-4 accent-elementus-blue"
                    onChange={(event) => setCanSignReports(event.target.checked)}
                    type="checkbox"
                  />
                  <div>
                    <p className="text-sm font-medium">Este profissional assina relatorios</p>
                    <p className="text-xs text-muted-foreground">
                      Se marcado, a assinatura entra para aprovacao e pode ser usada nos relatorios.
                    </p>
                  </div>
                </label>

                {canSignReports ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-[1fr,220px]">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Nome exibido na assinatura</label>
                        <input
                          className="mt-1 h-11 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          value={signatureName}
                          onChange={(event) => setSignatureName(event.target.value)}
                          placeholder="Nome que aparece abaixo da assinatura"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Imagem da assinatura</label>
                        <input
                          accept="image/*"
                          className="mt-1 block w-full text-sm"
                          onChange={(event) => void handleSignatureUpload(event)}
                          type="file"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          PNG ou JPG com fundo limpo.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border bg-white p-3">
                      <p className="text-xs font-medium text-muted-foreground">Previa</p>
                      <div className="mt-3 flex min-h-40 items-center justify-center rounded-lg border border-dashed bg-muted/20 p-3">
                        {signatureDataUrl ? (
                          <img
                            alt="Assinatura enviada"
                            className="max-h-32 w-full object-contain"
                            src={signatureDataUrl}
                          />
                        ) : (
                          <p className="text-center text-xs text-muted-foreground">
                            Sua assinatura vai aparecer aqui depois do upload.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {error ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <p className="max-w-xl text-sm text-muted-foreground">
                  Ao concluir, seu cadastro fica persistido no banco da plataforma e o acesso deixa
                  de depender de configuracao manual no Vercel.
                </p>
                <Button disabled={isSaving} type="submit">
                  {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSaving ? "Salvando cadastro..." : "Concluir primeiro acesso"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
