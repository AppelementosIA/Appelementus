# Easypanel — Setup Elementus Fase 1

## Serviços a configurar no Easypanel

### 1. Dashboard (Frontend React)
- **Tipo:** App (Docker)
- **Dockerfile:** `infra/docker/Dockerfile.dashboard`
- **Porta:** 80
- **Domínio:** `app.elementus.seudominio.com`

### 2. API (Backend Node.js)
- **Tipo:** App (Docker)
- **Dockerfile:** `infra/docker/Dockerfile.api`
- **Porta:** 3001
- **Variáveis de ambiente:** copiar do `.env.example`
- **Domínio:** `api.elementus.seudominio.com`

### 3. Supabase (já configurado externamente)
- Usar Supabase Cloud ou self-hosted
- Rodar a migration `infra/supabase/migrations/001_initial_schema.sql`

### 4. n8n (já rodando no servidor)
- Configurar webhooks apontando para a API:
  - `POST /api/field-data/webhook` — recebe dados processados do WhatsApp

### 5. Evolution API (já configurada)
- Configurar webhook no n8n para receber mensagens
- Instância: `elementus`

## Variáveis de Ambiente necessárias

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE_NAME=elementus
N8N_WEBHOOK_URL=
API_PORT=3001
NODE_ENV=production
```

## Ordem de deploy

1. Rodar migration no Supabase
2. Deploy da API
3. Deploy do Dashboard
4. Configurar webhooks no n8n
5. Testar fluxo WhatsApp → n8n → API → Supabase
