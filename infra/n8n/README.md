# n8n - Elementus

Este diretório guarda o blueprint operacional dos workflows do `n8n` para a próxima fase da plataforma.

## Fluxo prioritário

O primeiro workflow que deve entrar em produção é:

- `elementus-report-generation`

Esse fluxo é disparado pela API quando um relatório é aberto para geração com IA.

## Como ele se conecta hoje

1. O frontend chama `POST /api/reports/generate`.
2. A API cria o relatório no Supabase.
3. Se `N8N_WEBHOOK_URL` estiver preenchido no ambiente da API, a API dispara o webhook do `n8n`.
4. O `n8n` busca o relatório completo na API.
5. O `n8n` chama a OpenAI para montar a minuta estruturada.
6. O `n8n` faz `PATCH /api/reports/:id` com as seções geradas.

## Variáveis de ambiente do n8n

Configure no `n8n`:

- `ELEMENTUS_API_URL=https://sua-api`
- `OPENAI_API_KEY=...`
- `OPENAI_MODEL=...`

## Variável de ambiente da API

Configure no `EasyPanel` da API:

- `N8N_WEBHOOK_URL=https://seu-n8n/webhook/elementus-report-generation`

## Arquivos deste diretório

- `elementus-report-generation.md`: passo a passo do workflow
- `examples/report-generation.webhook.sample.json`: payload disparado pela API
- `examples/report-generation.report-update.sample.json`: payload que o `n8n` envia de volta para a API
- `schemas/report-generation-response.schema.json`: schema sugerido para a resposta estruturada da OpenAI
