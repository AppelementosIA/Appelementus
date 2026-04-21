# Workflow - elementus-report-generation

## Objetivo

Receber um pedido de geração de relatório vindo da API, consultar os dados completos do relatório, enviar o contexto para a OpenAI e devolver as seções estruturadas para revisão no dashboard.

## Trigger

- Tipo: `Webhook`
- Método: `POST`
- Path sugerido: `elementus-report-generation`

Esse webhook deve ser usado na variável `N8N_WEBHOOK_URL` da API.

## Sequência de nós

### 1. Webhook - Receber pedido da API

Entrada esperada:

- `event`
- `report_id`
- `project_id`
- `campaign_id`
- `template_id`
- `report_number`
- `title`
- `type`
- `requested_at`
- `generated_data`

Use o arquivo `examples/report-generation.webhook.sample.json` como referência.

### 2. HTTP Request - Buscar relatório completo

- Método: `GET`
- URL:

```text
{{$env.ELEMENTUS_API_URL}}/api/reports/{{$json.body.report_id}}
```

Objetivo:

- puxar `projects`
- puxar `report_templates`
- puxar `generated_data.variables`
- puxar `generated_data.sections`

### 3. Code - Montar contexto da IA

Monte um objeto com:

- cliente
- empreendimento
- projeto
- número do relatório
- período
- responsável técnico
- observações
- seções-base
- instrução de estilo

Saída sugerida:

```json
{
  "report_id": "...",
  "title": "...",
  "report_number": "...",
  "project": {
    "client_name": "...",
    "enterprise": "...",
    "name": "..."
  },
  "variables": {
    "period": "...",
    "responsible_technical": "...",
    "notes": "..."
  },
  "sections": [
    {
      "id": "presentation",
      "number": "1",
      "title": "Apresentacao"
    }
  ]
}
```

### 4. HTTP Request - OpenAI Responses API

- Método: `POST`
- URL:

```text
https://api.openai.com/v1/responses
```

Headers:

- `Authorization: Bearer {{$env.OPENAI_API_KEY}}`
- `Content-Type: application/json`

Body:

- `model`: `{{$env.OPENAI_MODEL}}`
- instrução do sistema
- contexto do relatório
- schema de saída

Use o schema em `schemas/report-generation-response.schema.json`.

### 5. Code - Normalizar resposta da IA

Transforme a resposta da OpenAI em `generated_data.sections`, respeitando o formato da API:

- `id`
- `key`
- `number`
- `title`
- `content`
- `editable: true`
- `edited: false`
- `images: []`

Também é útil guardar em `metadata`:

- `ai_provider: openai`
- `ai_generated_at`
- `ai_model`
- `ai_workflow: n8n`

### 6. HTTP Request - Atualizar relatório na API

- Método: `PATCH`
- URL:

```text
{{$env.ELEMENTUS_API_URL}}/api/reports/{{$json.report_id}}
```

Body sugerido:

```json
{
  "status": "review",
  "generated_data": {
    "sections": [],
    "charts": [],
    "tables": [],
    "variables": {},
    "metadata": {}
  }
}
```

Use o arquivo `examples/report-generation.report-update.sample.json` como referência.

### 7. Respond to Webhook

Retorne algo simples, por exemplo:

```json
{
  "ok": true,
  "report_id": "...",
  "status": "review"
}
```

## Prompt base recomendado

### System

```text
Você escreve minutas técnicas da Elementus em português do Brasil.
Organize relatos de campo em linguagem técnica clara, objetiva e pronta para revisão humana.
Não invente medições, datas, nomes ou resultados que não estejam no contexto.
Se alguma informação estiver incompleta, explicite a lacuna no texto de forma profissional.
Responda estritamente no schema solicitado.
```

### User

Inclua:

- dados do projeto
- dados do relatório
- observações do técnico
- lista de seções a preencher
- regra: devolver uma primeira versão editável, não a versão final

## Critério de aceite

O workflow estará correto quando:

1. a API disparar o webhook ao criar o relatório
2. o `n8n` buscar o relatório completo
3. a OpenAI devolver seções estruturadas
4. o `n8n` fizer `PATCH` no relatório
5. o dashboard abrir a minuta já com os blocos preenchidos para revisão
