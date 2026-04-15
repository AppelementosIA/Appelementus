import { Camera, Mic, FileSpreadsheet, MapPin, FileText, Filter } from "lucide-react";
import { Header } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const fieldEntries = [
  {
    id: "1",
    type: "photo" as const,
    source: "whatsapp",
    sent_by: "Carlos Silva",
    project: "Fauna Engie",
    description: "Foto de espécie — Jatobá (Hymenaea courbaril) no ponto P4",
    status: "processed",
    ai_result: "Espécie identificada: Hymenaea courbaril (Jatobá). Confiança: 94%",
    received_at: "2026-04-14 08:32",
  },
  {
    id: "2",
    type: "audio" as const,
    source: "whatsapp",
    sent_by: "Ana Souza",
    project: "Água Anglo American",
    description: "Áudio: coleta ponto P3, pH 7.2, turbidez 15 NTU, temperatura 22°C",
    status: "processed",
    ai_result: "Transcrição: 'Ponto P3, pH medido 7.2, turbidez 15 NTU, temp 22 graus, OD 6.8'",
    received_at: "2026-04-14 07:45",
  },
  {
    id: "3",
    type: "spreadsheet" as const,
    source: "whatsapp",
    sent_by: "Pedro Almeida",
    project: "Reposição Florestal CAERN",
    description: "Foto da planilha de campo — plantio setor leste",
    status: "processing",
    ai_result: "Extraindo dados da planilha...",
    received_at: "2026-04-14 07:20",
  },
  {
    id: "4",
    type: "location" as const,
    source: "whatsapp",
    sent_by: "Carlos Silva",
    project: "Fauna Engie",
    description: "Localização compartilhada — Ponto P4 Setor Norte",
    status: "validated",
    ai_result: "Lat: -5.2341, Lng: -36.8921 — vinculado ao ponto P4",
    received_at: "2026-04-14 08:30",
  },
  {
    id: "5",
    type: "pdf" as const,
    source: "upload",
    sent_by: "Maria Costa",
    project: "Flora Cemig",
    description: "Autorização IBAMA nº 2026/045 — Monitoramento Flora",
    status: "processed",
    ai_result: "Documento indexado. Tipo: Autorização. Órgão: IBAMA. Validade: 31/12/2026",
    received_at: "2026-04-13 16:00",
  },
  {
    id: "6",
    type: "photo" as const,
    source: "whatsapp",
    sent_by: "Roberto Lima",
    project: "Condicionantes Taesa",
    description: "Foto evidência — placa de sinalização ambiental instalada",
    status: "validated",
    ai_result: "Evidência registrada: placa de sinalização ambiental. Conformidade: OK",
    received_at: "2026-04-13 14:22",
  },
];

const typeIcons: Record<string, React.ElementType> = {
  photo: Camera,
  audio: Mic,
  spreadsheet: FileSpreadsheet,
  location: MapPin,
  pdf: FileText,
  document: FileText,
  text: FileText,
};

const statusConfig: Record<string, { label: string; variant: "info" | "success" | "warning" | "default" }> = {
  pending: { label: "Pendente", variant: "default" },
  processing: { label: "Processando", variant: "info" },
  processed: { label: "Processado", variant: "success" },
  validated: { label: "Validado", variant: "success" },
  rejected: { label: "Rejeitado", variant: "warning" },
  error: { label: "Erro", variant: "warning" },
};

export function FieldDataPage() {
  return (
    <div>
      <Header title="Dados de Campo" description="Dados recebidos via WhatsApp e uploads manuais" />

      <div className="p-6 space-y-4">
        {/* Stats rápidos */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Camera className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">142</p>
                <p className="text-xs text-muted-foreground">Fotos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Mic className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">56</p>
                <p className="text-xs text-muted-foreground">Áudios</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">38</p>
                <p className="text-xs text-muted-foreground">Planilhas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <FileText className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">48</p>
                <p className="text-xs text-muted-foreground">Documentos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
              <TabsTrigger value="processed">Processados</TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-3 w-3" />
              Filtrar
            </Button>
          </div>

          <TabsContent value="all" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Entradas Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {fieldEntries.map((entry) => {
                    const Icon = typeIcons[entry.type];
                    const s = statusConfig[entry.status];
                    return (
                      <div key={entry.id} className="flex gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium truncate">{entry.description}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">
                            {entry.sent_by} · {entry.project} · {entry.received_at}
                          </p>
                          <p className="text-xs text-elementus-blue bg-blue-50 rounded px-2 py-1 inline-block">
                            {entry.ai_result}
                          </p>
                        </div>
                        <Badge variant={s.variant} className="shrink-0 self-start">{s.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending" className="mt-4">
            <p className="text-sm text-muted-foreground">Filtro: dados pendentes de processamento</p>
          </TabsContent>
          <TabsContent value="processed" className="mt-4">
            <p className="text-sm text-muted-foreground">Filtro: dados já processados</p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
