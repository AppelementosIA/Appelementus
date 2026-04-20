# Deploy do Dashboard no Vercel

## Objetivo

Publicar o frontend da plataforma Elementus no Vercel para visualizar o dashboard e o fluxo principal do produto.

## Recomendacao desta etapa

Nesta fase, publique apenas o `dashboard` no Vercel.

- repositorio: `AppelementosIA/Appelementus`
- projeto no Vercel: ligado ao mesmo repositorio
- root directory: `apps/dashboard`

O backend pode continuar fora do Vercel por enquanto, mas o ambiente definitivo do dashboard precisa apontar para uma API real.

## Por que usar `apps/dashboard` como Root Directory

O projeto esta em monorepo. No Vercel, o caminho correto e importar o repositorio e escolher `apps/dashboard` como `Root Directory`, para que o deploy trate somente o frontend.

## Arquivo de configuracao

Foi adicionado `apps/dashboard/vercel.json` com:

- `framework: vite`
- `outputDirectory: dist`
- `rewrite` para SPA, permitindo abrir rotas como `/reports`, `/projects` e `/login` sem erro 404

## Variaveis minimas do ambiente definitivo

No primeiro deploy definitivo, use no minimo:

- `VITE_API_URL=https://SUA-API`
- `VITE_MICROSOFT_CLIENT_ID`
- `VITE_MICROSOFT_TENANT_ID`
- `VITE_MICROSOFT_REDIRECT_URI=https://SEU-DOMINIO/login`
- `VITE_MICROSOFT_SCOPES=openid profile email offline_access User.Read Files.ReadWrite`
- `VITE_MICROSOFT_ALLOWED_DOMAINS`
- `VITE_MICROSOFT_DEFAULT_ROLE`
- `VITE_MICROSOFT_CEO_EMAILS`
- `VITE_MICROSOFT_MANAGER_EMAILS`
- `VITE_MICROSOFT_SUPERVISOR_EMAILS`

Sem `VITE_API_URL`, a navegacao de cadastros e a emissao final nao ficam conectadas ao ambiente oficial.

## Configuracao do Microsoft 365 / Entra

No Microsoft Entra, o aplicativo precisa estar registrado como `Single-page application` e usar o dominio do Vercel como redirect URI:

- `VITE_MICROSOFT_REDIRECT_URI=https://SEU-DOMINIO/login`

Tambem e preciso garantir que a API tenha configurado:

- `MICROSOFT_365_DRIVE_ID`
- `MICROSOFT_365_ROOT_FOLDER`

## Passo a passo no Vercel

1. Entrar no Vercel
2. Clicar em `Add New Project`
3. Importar o repositorio `AppelementosIA/Appelementus`
4. Em `Root Directory`, escolher `apps/dashboard`
5. Confirmar que o framework detectado e `Vite`
6. Cadastrar as variaveis do ambiente definitivo
7. Fazer o deploy

## Resultado esperado

Depois do deploy:

- a rota `/login` abre normalmente
- o acesso acontece com a conta Microsoft 365 da Elementus
- o dashboard carrega os dados reais da API configurada
- rotas internas continuam funcionando ao atualizar a pagina

## Observacao importante

Se voce quiser usar o projeto como ambiente oficial, o Vercel deve publicar o frontend e a API precisa estar online em um dominio acessivel publicamente.
