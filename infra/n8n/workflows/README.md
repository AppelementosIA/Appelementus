# n8n Workflows

## Arquivos prontos

- `elementus-report-generation.workflow.json`: workflow completo para importar no n8n
- `elementus-whatsapp-intake.workflow.json`: workflow completo para receber mensagens do WhatsApp e abrir o rascunho
- `elementus-whatsapp-intake.md`: explicacao operacional do fluxo do bot

## Como importar

1. No n8n, clique em `Import from File`.
2. Importe `elementus-whatsapp-intake.workflow.json` para o fluxo de conversa com o tecnico.
3. Importe `elementus-report-generation.workflow.json` para o fluxo que gera a minuta do relatorio.
4. Revise os webhooks:
   `elementus-whatsapp-intake`
   `elementus-report-generation`
5. Salve os workflows e deixe `Active` desligado ate terminar os cadastros.

## Variaveis do n8n

Preencha no ambiente do n8n:

- `ELEMENTUS_API_URL`
- `ELEMENTUS_DASHBOARD_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`

## Variavel da API

Depois que o workflow estiver ativo, copie a URL de producao do webhook e configure na API:

- `N8N_WEBHOOK_URL=https://seu-n8n/webhook/elementus-report-generation`

## Fluxo ponta a ponta

1. O tecnico envia mensagem, imagem ou localizacao no WhatsApp.
2. O workflow `elementus-whatsapp-intake` grava isso em `field_data`, entende o contexto e pergunta o que faltar.
3. Quando o minimo estiver completo, o mesmo workflow chama `POST /api/reports/generate`.
4. A API cria o relatorio no banco e dispara o workflow `elementus-report-generation`.
5. O workflow de geracao chama a OpenAI para montar a minuta estruturada.
6. O relatorio volta para a API em `PATCH /api/reports/:id`.
7. O dashboard abre o relatorio em modo de revisao para finalizar imagens, texto e envio.

## Teste minimo

1. Ative o workflow no n8n.
2. Configure `N8N_WEBHOOK_URL` na API.
3. Gere um relatorio pelo dashboard.
4. Confirme no banco ou na API que o status mudou para `review`.
