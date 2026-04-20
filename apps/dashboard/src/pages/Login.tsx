import { useState } from "react";
import { BriefcaseBusiness, Leaf, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { getMicrosoftConfigurationError } from "@/lib/microsoftAuth";

export function LoginPage() {
  const {
    authError,
    isLoading,
    isMicrosoftReady,
    loginWithMicrosoft,
  } = useAuth();
  const [startingLogin, setStartingLogin] = useState(false);
  const configurationError = getMicrosoftConfigurationError();

  const handleLogin = async () => {
    try {
      setStartingLogin(true);
      await loginWithMicrosoft();
    } catch {
      setStartingLogin(false);
    }
  };

  const loading = isLoading || startingLogin;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-elementus-blue to-elementus-green p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-elementus-blue">
            <Leaf className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-bold">Elementus</h1>
          <p className="text-sm text-muted-foreground">
            Plataforma de relatórios conectada ao Microsoft 365
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
            O acesso agora fica preso à conta Microsoft 365 da equipe. Ao entrar, a plataforma usa
            a mesma identidade para emitir e salvar o relatório na pasta correta do Microsoft 365.
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
                Configuração necessária
              </div>
              <p className="mt-2">
                {configurationError ||
                  `Defina o login Microsoft 365 no ambiente do Vercel. O redirect usa automaticamente ${window.location.origin}/login quando VITE_MICROSOFT_REDIRECT_URI nao for informado.`}
              </p>
            </div>
          ) : null}

          {authError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {authError}
            </div>
          ) : null}

          <p className="text-center text-xs text-muted-foreground">
            Elementus Soluções Ambientais × Estandarte
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
