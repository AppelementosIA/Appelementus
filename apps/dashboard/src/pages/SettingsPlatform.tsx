import {
  Cloud,
  FileStack,
  KeyRound,
  MessageSquareText,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Header } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const integrations = [
  {
    title: "Microsoft 365",
    description: "Integracao obrigatoria da etapa 1 para salvar a emissao final do relatorio.",
    status: "Prioridade atual",
    icon: Cloud,
    variant: "success" as const,
  },
  {
    title: "Login Microsoft 365",
    description: "Autenticacao corporativa para amarrar acesso, emissao e salvamento ao mesmo usuario.",
    status: "Ativo",
    icon: KeyRound,
    variant: "success" as const,
  },
  {
    title: "Templates .docx",
    description: "Camada que garante o padrao visual e estrutura dos relatorios da Elementus.",
    status: "Ativo",
    icon: FileStack,
    variant: "success" as const,
  },
  {
    title: "WhatsApp",
    description: "Entrada automatica de dados de campo para conectar depois da plataforma base.",
    status: "Proxima fase",
    icon: MessageSquareText,
    variant: "warning" as const,
  },
  {
    title: "OCR e leitura de planilhas",
    description: "Extracao automatica para reduzir digitacao manual em ciclos posteriores.",
    status: "Planejado",
    icon: ScanSearch,
    variant: "outline" as const,
  },
  {
    title: "Assistencia por IA",
    description: "Geracao assistida, sugestao de texto e automacoes mais avancadas sobre a base.",
    status: "Planejado",
    icon: Sparkles,
    variant: "outline" as const,
  },
];

export function SettingsPlatformPage() {
  return (
    <div>
      <Header
        title="Configuracoes"
        description="Mapa das integracoes da plataforma base e das conexoes previstas"
      />

      <div className="max-w-4xl space-y-6 p-6">
        <Card className="border-elementus-blue/20 bg-elementus-blue/5">
          <CardContent className="flex items-start gap-3 p-5">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-elementus-blue" />
            <div>
              <h3 className="font-semibold text-elementus-blue">Ordem correta da implementacao</h3>
              <p className="text-sm text-muted-foreground">
                Primeiro construimos a plataforma de cadastro, edicao, anexos e emissao. Depois
                conectamos WhatsApp, OCR, audio e IA em cima dessa base.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {integrations.map((integration) => (
            <Card key={integration.title}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-muted p-3 text-elementus-blue">
                      <integration.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{integration.title}</CardTitle>
                      <CardDescription>{integration.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={integration.variant}>{integration.status}</Badge>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
