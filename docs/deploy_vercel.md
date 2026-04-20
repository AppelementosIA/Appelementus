# Deploy do Dashboard no Vercel

## Objetivo

Publicar o frontend da plataforma Elementus no Vercel para visualizar o dashboard e o fluxo principal do produto.

## Recomendacao desta etapa

Nesta fase, publique apenas o `dashboard` no Vercel.

- repositorio: `AppelementosIA/Appelementus`
- projeto no Vercel: ligado ao mesmo repositorio
- root directory: `apps/dashboard`

O backend pode continuar fora do Vercel por enquanto. Para ver a interface agora, o mais simples e usar o modo demo local/publicado.

## Por que usar `apps/dashboard` como Root Directory

O projeto esta em monorepo. No Vercel, o caminho correto e importar o repositorio e escolher `apps/dashboard` como `Root Directory`, para que o deploy trate somente o frontend.

## Arquivo de configuracao

Foi adicionado `apps/dashboard/vercel.json` com:

- `framework: vite`
- `outputDirectory: dist`
- `rewrite` para SPA, permitindo abrir rotas como `/reports`, `/projects` e `/login` sem erro 404

## Variaveis minimas para ver a interface

No primeiro deploy, use esta variavel no Vercel:

- `VITE_ENABLE_LOCAL_DEMO=true`

Nesta primeira publicacao, pode deixar `VITE_API_URL` sem configurar.

Com isso, a plataforma abre em modo visual e usa fallback local quando a API nao estiver configurada.

## Variaveis para Microsoft 365 depois

Quando quiser ativar login real no Vercel, adicione:

- `VITE_MICROSOFT_CLIENT_ID`
- `VITE_MICROSOFT_TENANT_ID`
- `VITE_MICROSOFT_REDIRECT_URI=https://SEU-DOMINIO/login`
- `VITE_MICROSOFT_SCOPES=openid profile email offline_access User.Read Files.ReadWrite`
- `VITE_MICROSOFT_ALLOWED_DOMAINS`
- `VITE_MICROSOFT_DEFAULT_ROLE`
- `VITE_MICROSOFT_CEO_EMAILS`
- `VITE_MICROSOFT_MANAGER_EMAILS`
- `VITE_MICROSOFT_SUPERVISOR_EMAILS`

## Passo a passo no Vercel

1. Entrar no Vercel
2. Clicar em `Add New Project`
3. Importar o repositorio `AppelementosIA/Appelementus`
4. Em `Root Directory`, escolher `apps/dashboard`
5. Confirmar que o framework detectado e `Vite`
6. Cadastrar as variaveis minimas
7. Fazer o deploy

## Resultado esperado

Depois do deploy:

- a rota `/login` abre normalmente
- o botao `Entrar em modo demo local` aparece
- o dashboard pode ser navegado mesmo sem API real
- rotas internas continuam funcionando ao atualizar a pagina

## Proximo passo depois do preview

Quando a interface estiver aprovada, o ideal e:

1. ligar a API em um dominio proprio
2. preencher `VITE_API_URL` com a URL real da API
3. ajustar o redirect URI do Microsoft Entra para o dominio do Vercel
