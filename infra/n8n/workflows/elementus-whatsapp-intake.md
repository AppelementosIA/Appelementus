# Workflow - elementus-whatsapp-intake

## Objetivo

Receber mensagens do tecnico pelo WhatsApp via Evolution API, transformar a conversa em dados estruturados, guardar textos/imagens/localizacao no banco e abrir um rascunho de relatorio na plataforma quando o minimo necessario estiver completo.

## Experiencia desejada

1. O tecnico envia texto, imagem, legenda e localizacao pelo WhatsApp.
2. O bot identifica o contexto do atendimento e pergunta so o que faltar.
3. Cada mensagem vira um registro em `field_data`.
4. Quando cliente, projeto, tipo de servico, periodo, local e resumo tecnico estiverem bons o bastante, o workflow cria o relatorio.
5. A API dispara o workflow de geracao com IA ja existente.
6. O tecnico recebe no WhatsApp o aviso de que o rascunho foi aberto na plataforma.
7. A finalizacao acontece no dashboard em `Montagem -> Relatorio -> Imagens -> Envio`.

## Dependencias

### No n8n

- `ELEMENTUS_API_URL`
- `ELEMENTUS_DASHBOARD_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`

### Na API

- `N8N_WEBHOOK_URL` continua apontando para o workflow de geracao do relatorio

## Endpoints usados

- `POST /api/field-data/webhook`
- `PATCH /api/field-data/:id`
- `GET /api/field-data?sent_by=...&limit=...`
- `GET /api/projects?status=active`
- `GET /api/templates?active=true`
- `POST /api/reports/generate`

## Estrategia do bot

O bot nao tenta fechar tudo de uma vez. Ele trabalha em ciclos curtos:

1. recebe a mensagem atual
2. consulta o historico recente do mesmo tecnico
3. extrai o que acabou de chegar
4. consolida com o que ja tinha
5. decide a proxima pergunta unica
6. se ja estiver pronto, abre o rascunho

## Minimo para abrir o rascunho

- projeto identificado
- template identificado
- local da atividade
- periodo ou data de referencia
- resumo do que foi executado
- responsavel tecnico ou tecnico remetente

## Observacoes

- imagens e localizacao entram no rascunho como evidencias iniciais
- o texto final continua sendo revisado no dashboard
- o workflow foi pensado para facilitar o campo: o WhatsApp coleta e organiza, a plataforma finaliza
