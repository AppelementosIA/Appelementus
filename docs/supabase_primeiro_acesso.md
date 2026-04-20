# Supabase para primeiro acesso e assinaturas

## Objetivo

Tirar o controle de usuarios do Vercel e mover a gestao de acesso, perfil profissional e assinatura tecnica para o Supabase.

## O que muda na arquitetura

- Microsoft 365 continua sendo a autenticacao da equipe
- a API valida o token Microsoft e sincroniza o colaborador no primeiro acesso
- o banco passa a guardar:
  - cargo no app
  - status de onboarding
  - telefone
  - funcao profissional
  - conselho e numero de registro
  - permissao para assinar relatorios
  - assinatura tecnica

## Fluxo do primeiro acesso

1. O colaborador entra com a conta Microsoft 365 dele
2. O frontend envia o token para `POST /api/users/session/sync`
3. A API consulta o Microsoft Graph, identifica o colaborador e cria/atualiza `platform_users`
4. Se o cadastro ainda estiver incompleto, o usuario vai para `/onboarding`
5. Ao concluir o formulario, a plataforma grava os dados em `platform_users` e `platform_user_profiles`
6. Depois disso, o acesso e controlado pelo banco

## Estrutura criada

Arquivo de migracao:

- [20260420_user_onboarding.sql](/D:/Documents/ELEMENTUS%20CLIENTE/Elementus%20etapa1%20cria%C3%A7%C3%A3o%20de%20projeto/infra/supabase/migrations/20260420_user_onboarding.sql)

Tabelas:

- `platform_users`
- `platform_user_profiles`
- `report_signers`

## Como aplicar no Supabase

Com os dados que voce me passou ate agora, eu consigo preparar o codigo e a migracao, mas ainda nao consigo executar a criacao remota do schema sozinho porque a API precisa da `SUPABASE_SERVICE_ROLE_KEY` para gravar no banco e eu nao recebi essa chave.

Voce tem dois caminhos:

1. Abrir o `SQL Editor` do Supabase e rodar o conteudo do arquivo `20260420_user_onboarding.sql`
2. Me passar a `SUPABASE_SERVICE_ROLE_KEY` para eu terminar a integracao do ambiente da API com voce

## Variaveis de ambiente

### Dashboard

- `VITE_API_URL`
- `VITE_MICROSOFT_CLIENT_ID`
- `VITE_MICROSOFT_TENANT_ID`
- `VITE_MICROSOFT_ALLOWED_DOMAINS`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Observacao:

- o dashboard Vite agora aceita tanto `VITE_SUPABASE_*` quanto `NEXT_PUBLIC_SUPABASE_*`

### API

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MICROSOFT_365_DRIVE_ID`
- `MICROSOFT_365_ROOT_FOLDER`

## Observacoes operacionais

- nao e mais necessario cadastrar funcionario por funcionario no Vercel
- o cargo do usuario no app e separado da permissao de assinatura tecnica
- usuarios novos entram por padrao como `technician` ate serem promovidos no modulo de usuarios
- a assinatura enviada no primeiro acesso fica marcada como `pending_review` ate validacao interna
