import { useState } from "react";
import { BriefcaseBusiness, KeyRound, Leaf, Mail, ShieldCheck, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { getMicrosoftConfigurationError } from "@/lib/microsoftAuth";

export function LoginPage() {
  const {
    authError,
    isLoading,
    isMicrosoftReady,
    isPresentationEnabled,
    isPasswordAccessEnabled,
    loginWithMicrosoft,
    loginWithPassword,
    registerWithPassword,
    loginForPresentation,
  } = useAuth();
  const [startingLogin, setStartingLogin] = useState(false);
  const [passwordMode, setPasswordMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const configurationError = getMicrosoftConfigurationError();

  const handleLogin = async () => {
    try {
      setStartingLogin(true);
      await loginWithMicrosoft();
    } catch {
      setStartingLogin(false);
    }
  };

  const handlePasswordAccess = async () => {
    try {
      setPasswordBusy(true);
      setPasswordError(null);

      if (passwordMode === "register") {
        await registerWithPassword({
          name,
          email,
          password,
        });
      } else {
        await loginWithPassword({
          email,
          password,
        });
      }
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : "Nao foi possivel acessar com e-mail e senha."
      );
    } finally {
      setPasswordBusy(false);
    }
  };

  const loading = isLoading || startingLogin;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-elementus-blue to-elementus-green p-4">
      <Card className="w-full max-w-5xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-elementus-blue">
            <Leaf className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-bold">Elementus</h1>
          <p className="text-sm text-muted-foreground">
            Plataforma de relatorios com acesso corporativo e porta temporaria de teste
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-elementus-blue">
                  Opcao principal
                </p>
                <h2 className="mt-2 text-lg font-semibold">Entrar com Microsoft 365</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Esta continua sendo a autenticacao oficial para ligar usuario, emissao e salvamento
                  final no Microsoft 365 com a mesma identidade corporativa.
                </p>
              </div>

              <Button
                className="w-full"
                disabled={loading || !isMicrosoftReady}
                onClick={() => void handleLogin()}
              >
                <BriefcaseBusiness className="mr-2 h-4 w-4" />
                {loading ? "Conectando..." : "Entrar com Microsoft 365"}
              </Button>

              {!isMicrosoftReady ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="h-4 w-4" />
                    Configuracao necessaria
                  </div>
                  <p className="mt-2">
                    {configurationError ||
                      `Defina o login Microsoft 365 no ambiente do Vercel. O redirect usa automaticamente ${window.location.origin}/login quando VITE_MICROSOFT_REDIRECT_URI nao for informado.`}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="space-y-4 rounded-2xl border border-elementus-blue/20 bg-elementus-blue/5 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-elementus-blue">
                  Opcao temporaria
                </p>
                <h2 className="mt-2 text-lg font-semibold">Acesso por e-mail e senha</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Esta porta de entrada serve para destravar os testes do fluxo de construcao do
                  relatorio enquanto o Microsoft 365 ainda estiver em homologacao.
                </p>
              </div>

              {isPasswordAccessEnabled ? (
                <>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={passwordMode === "login" ? "default" : "outline"}
                      onClick={() => setPasswordMode("login")}
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      Entrar
                    </Button>
                    <Button
                      type="button"
                      variant={passwordMode === "register" ? "default" : "outline"}
                      onClick={() => setPasswordMode("register")}
                    >
                      <UserRoundPlus className="mr-2 h-4 w-4" />
                      Criar acesso
                    </Button>
                  </div>

                  {passwordMode === "register" ? (
                    <div>
                      <label className="text-sm font-medium">Nome completo</label>
                      <input
                        className="mt-1 h-11 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Nome completo"
                        value={name}
                      />
                    </div>
                  ) : null}

                  <div>
                    <label className="text-sm font-medium">E-mail</label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        className="h-11 w-full rounded-md border bg-white pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="voce@elementus-sa.com.br"
                        value={email}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Senha</label>
                    <input
                      className="mt-1 h-11 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Minimo de 8 caracteres"
                      type="password"
                      value={password}
                    />
                  </div>

                  <Button className="w-full" disabled={passwordBusy} onClick={() => void handlePasswordAccess()}>
                    {passwordBusy
                      ? "Preparando acesso..."
                      : passwordMode === "register"
                      ? "Criar acesso de teste"
                      : "Entrar com e-mail e senha"}
                  </Button>

                  <div className="rounded-xl border border-elementus-blue/20 bg-white/80 p-4 text-sm text-muted-foreground">
                    O login por senha libera onboarding, criacao de relatorio e navegacao do fluxo.
                    A emissao final no Microsoft 365 continua reservada para a conta Microsoft.
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  O acesso por e-mail e senha depende do Supabase estar configurado neste ambiente.
                </div>
              )}
            </div>
          </div>

          {isPresentationEnabled ? (
            <Button className="w-full" variant="outline" onClick={loginForPresentation}>
              Entrar em modo de apresentacao
            </Button>
          ) : null}

          {isPresentationEnabled ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
              O modo de apresentacao libera a navegacao visual da plataforma sem depender de login
              real. E-mail e senha, por outro lado, passam a testar o fluxo real de acesso e onboarding.
            </div>
          ) : null}

          {passwordError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {passwordError}
            </div>
          ) : null}

          {authError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {authError}
            </div>
          ) : null}

          <p className="text-center text-xs text-muted-foreground">
            Elementus Solucoes Ambientais x Estandarte
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
