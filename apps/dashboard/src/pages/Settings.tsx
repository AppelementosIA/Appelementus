import { Header } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function SettingsPage() {
  return (
    <div>
      <Header title="Configurações" description="Configurações do sistema e integrações" />

      <div className="p-6 space-y-6 max-w-3xl">
        {/* Supabase */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Supabase</CardTitle>
                <CardDescription>Banco de dados e armazenamento</CardDescription>
              </div>
              <Badge variant="success">Conectado</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium">URL do Projeto</label>
              <input
                type="text"
                placeholder="https://seu-projeto.supabase.co"
                className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Anon Key</label>
              <input
                type="password"
                placeholder="eyJ..."
                className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp / Evolution API */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">WhatsApp (Evolution API)</CardTitle>
                <CardDescription>Recebimento de dados de campo</CardDescription>
              </div>
              <Badge variant="success">Conectado</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium">URL da Evolution API</label>
              <input
                type="text"
                placeholder="https://sua-evolution.dominio.com"
                className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Nome da Instância</label>
              <input
                type="text"
                placeholder="elementus"
                className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        {/* n8n */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">n8n</CardTitle>
                <CardDescription>Automação de fluxos e pipeline</CardDescription>
              </div>
              <Badge variant="success">Conectado</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div>
              <label className="text-sm font-medium">Webhook URL</label>
              <input
                type="text"
                placeholder="https://seu-n8n.dominio.com/webhook"
                className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        {/* IA */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agente Especialista (IA)</CardTitle>
            <CardDescription>Configuração dos modelos de IA</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium">OpenAI API Key (GPT-4o + Whisper)</label>
              <input
                type="password"
                placeholder="sk-..."
                className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Anthropic API Key (Claude)</label>
              <input
                type="password"
                placeholder="sk-ant-..."
                className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end">
          <Button>Salvar Configurações</Button>
        </div>
      </div>
    </div>
  );
}
