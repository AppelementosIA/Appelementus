# Deploy no EasyPanel

## Objetivo

Subir a plataforma Elementus da etapa 1 em producao com dois servicos principais:

- `dashboard`: frontend React/Vite servido por `nginx`
- `api`: backend Express/TypeScript

Servicos externos desta fase:

- `Supabase`: banco e armazenamento
- `Microsoft 365`: autenticacao e salvamento final dos relatorios

## Recomendacao de arquitetura

Para esta versao, a forma mais segura de publicar no EasyPanel e:

1. Um `App Service` para o `dashboard`
2. Um `App Service` para a `api`
3. `Supabase` gerenciado fora do EasyPanel
4. `Microsoft 365` configurado no tenant da empresa

Nao recomendo comecar pelo `Compose Service` no EasyPanel nesta etapa. O projeto ja tem compose local, mas em producao o caminho mais previsivel e separar frontend e backend.

## Dominios sugeridos

- `app.elementus.seudominio.com` para o dashboard
- `api.elementus.seudominio.com` para a API

Se quiser um ambiente de homologacao:

- `app-hml.elementus.seudominio.com`
- `api-hml.elementus.seudominio.com`

## Arquivos prontos no projeto

- Dockerfile da API: `infra/docker/Dockerfile.api`
- Dockerfile do dashboard: `infra/docker/Dockerfile.dashboard`
- Nginx standalone do dashboard: `infra/docker/nginx.standalone.conf`
- Template de env da API: `infra/easypanel/api.env.example`
- Template de env do dashboard: `infra/easypanel/dashboard.env.example`

## Ordem de publicacao

1. Publicar a API
2. Confirmar `GET /api/health`
3. Publicar o dashboard apontando para a URL da API
4. Configurar o redirect URI do Microsoft Entra
5. Testar login e emissao de relatorio

## Servico 1: API

### Criacao no EasyPanel

- Tipo: `App`
- Source: repositório Git do projeto
- Build type: `Dockerfile`
- Dockerfile path: `infra/docker/Dockerfile.api`
- Context: raiz do repositório
- Porta interna: `3001`
- Dominio: `api.elementus.seudominio.com`

### Variaveis de ambiente

Baseie-se em `infra/easypanel/api.env.example`.

Obrigatorias nesta fase:

- `API_PORT=3001`
- `NODE_ENV=production`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MICROSOFT_365_DRIVE_ID`
- `MICROSOFT_365_ROOT_FOLDER`

Opcionais agora:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`
- `N8N_WEBHOOK_URL`

### Teste rapido

Depois do deploy, valide:

`https://api.elementus.seudominio.com/api/health`

Resposta esperada:

```json
{
  "status": "ok",
  "service": "elementus-api",
  "version": "0.1.0"
}
```

## Servico 2: Dashboard

### Criacao no EasyPanel

- Tipo: `App`
- Source: repositório Git do projeto
- Build type: `Dockerfile`
- Dockerfile path: `infra/docker/Dockerfile.dashboard`
- Context: raiz do repositório
- Porta interna: `80`
- Dominio: `app.elementus.seudominio.com`

### Variaveis de ambiente

Baseie-se em `infra/easypanel/dashboard.env.example`.

Obrigatorias nesta fase:

- `VITE_API_URL=https://api.elementus.seudominio.com`
- `VITE_ENABLE_LOCAL_DEMO=false`
- `VITE_MICROSOFT_CLIENT_ID`
- `VITE_MICROSOFT_TENANT_ID`
- `VITE_MICROSOFT_REDIRECT_URI=https://app.elementus.seudominio.com/login`
- `VITE_MICROSOFT_SCOPES=openid profile email offline_access User.Read Files.ReadWrite`
- `VITE_MICROSOFT_ALLOWED_DOMAINS`
- `VITE_MICROSOFT_DEFAULT_ROLE`
- `VITE_MICROSOFT_CEO_EMAILS`
- `VITE_MICROSOFT_MANAGER_EMAILS`
- `VITE_MICROSOFT_SUPERVISOR_EMAILS`

### Observacao importante

O dashboard foi ajustado para rodar standalone no `nginx`, sem depender de proxy interno para a API. Em producao, ele conversa diretamente com a URL configurada em `VITE_API_URL`.

## Microsoft Entra / Microsoft 365

No aplicativo registrado no Microsoft Entra, configure:

- Plataforma: `Single-page application`
- Redirect URI producao: `https://app.elementus.seudominio.com/login`
- Redirect URI homologacao, se existir: `https://app-hml.elementus.seudominio.com/login`

Permissoes delegadas recomendadas:

- `openid`
- `profile`
- `email`
- `offline_access`
- `User.Read`
- `Files.ReadWrite`

## Supabase

A API usa:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Recomendacao:

- manter o Supabase externo e gerenciado
- usar um projeto separado para homologacao, se possivel

## Smoke test de producao

Depois dos dois deploys:

1. Abrir `https://app.elementus.seudominio.com/login`
2. Fazer login com Microsoft 365
3. Abrir um relatorio
4. Editar uma secao
5. Anexar uma imagem
6. Emitir o relatorio
7. Confirmar:
   - status alterado para emitido
   - pasta do Microsoft 365 acessivel
   - `.docx` salvo

## Homologacao rapida

Se quiser mostrar a plataforma antes do tenant Microsoft ficar pronto:

- use um ambiente separado
- no dashboard de homologacao, pode manter `VITE_ENABLE_LOCAL_DEMO=true`

Assim o botao `Entrar em modo demo local` continua disponivel.

## Checklist final

- API publicada e respondendo `/api/health`
- Dashboard publicado com `VITE_API_URL` correto
- Redirect URI do Entra cadastrado com o dominio final
- Segredos da API preenchidos
- Dominio HTTPS ativo
- Login Microsoft funcionando
- Emissao salvando no Microsoft 365
