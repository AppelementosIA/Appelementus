# n8n Workflows

## Arquivos prontos

- `elementus-report-generation.workflow.json`: workflow completo para importar no n8n

## Como importar

1. No n8n, clique em `Import from File`.
2. Selecione `elementus-report-generation.workflow.json`.
3. Revise o path do webhook:
   `elementus-report-generation`
4. Salve o workflow e deixe `Active` desligado ate terminar os cadastros.

## Variaveis do n8n

Preencha no ambiente do n8n:

- `ELEMENTUS_API_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

## Variavel da API

Depois que o workflow estiver ativo, copie a URL de producao do webhook e configure na API:

- `N8N_WEBHOOK_URL=https://seu-n8n/webhook/elementus-report-generation`

## Fluxo ponta a ponta

1. O dashboard pede `POST /api/reports/generate`.
2. A API cria o relatorio no banco.
3. A API chama o webhook do n8n.
4. O n8n busca o relatorio completo em `GET /api/reports/:id`.
5. O n8n chama a OpenAI para gerar a minuta estruturada.
6. O n8n atualiza o relatorio em `PATCH /api/reports/:id`.
7. O dashboard abre o relatorio em modo de revisao.

## Teste minimo

1. Ative o workflow no n8n.
2. Configure `N8N_WEBHOOK_URL` na API.
3. Gere um relatorio pelo dashboard.
4. Confirme no banco ou na API que o status mudou para `review`.
