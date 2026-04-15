# Fluxo Git + GitHub + EasyPanel

## Objetivo

Deixar a plataforma facil de editar, versionar e publicar, sem depender de processos manuais toda vez.

## Estrutura recomendada

- `GitHub` como repositorio central do projeto
- `EasyPanel` conectado ao repositorio para publicar automaticamente
- `main` como branch de producao
- `homolog` como branch de homologacao
- `feature/*` para ajustes e evolucoes
- `hotfix/*` para correcoes urgentes

## Fluxo simples do dia a dia

1. Criar uma branch nova a partir de `homolog` ou `main`
2. Fazer as alteracoes no projeto
3. Subir para o GitHub
4. Deixar o GitHub Actions validar `lint` e `build`
5. Abrir PR
6. Fazer merge em `homolog` para testar no ambiente de homologacao
7. Quando estiver aprovado, fazer merge em `main`
8. O EasyPanel publica a versao nova automaticamente

## Como fica a publicacao

### Homologacao

- `dashboard-hml` apontando para a branch `homolog`
- `api-hml` apontando para a branch `homolog`

### Producao

- `dashboard-prod` apontando para a branch `main`
- `api-prod` apontando para a branch `main`

## O que fica salvo no Git

Deve ir para o repositorio:

- codigo da API
- codigo do dashboard
- Dockerfiles
- workflows do GitHub
- documentacao
- migrations do banco

Nao deve ir para o repositorio:

- `.env`
- chaves privadas
- segredos do Microsoft 365
- segredos do Supabase

Esses segredos ficam configurados no EasyPanel e no GitHub, nunca dentro do codigo.

## O que o EasyPanel faz

Depois de conectado ao repositorio:

- observa a branch configurada no servico
- baixa a versao mais recente
- faz o build com o Dockerfile do projeto
- publica sozinho quando houver merge na branch monitorada

## O que o GitHub Actions faz

O workflow `.github/workflows/validate.yml` foi criado para:

- instalar dependencias
- rodar validacao TypeScript
- rodar build da API e do dashboard

Assim, antes de publicar, o projeto ja passa por uma checagem automatica.

## Processo recomendado para voces

### Ajustes normais

Use este fluxo:

```bash
git checkout homolog
git pull
git checkout -b feature/nome-do-ajuste
git add .
git commit -m "feat: descreve o ajuste"
git push -u origin feature/nome-do-ajuste
```

Depois:

1. abrir PR para `homolog`
2. testar no ambiente de homologacao
3. aprovar
4. abrir PR de `homolog` para `main`

### Correcao urgente

Use este fluxo:

```bash
git checkout main
git pull
git checkout -b hotfix/correcao-rapida
git add .
git commit -m "fix: descreve a correcao"
git push -u origin hotfix/correcao-rapida
```

Depois:

1. abrir PR para `main`
2. publicar
3. replicar a correcao em `homolog`

## Como isso encaixa com meu trabalho aqui

O melhor formato e:

- eu faco as alteracoes no projeto
- voces versionam no GitHub
- o EasyPanel publica pelas branches certas

Se depois voces quiserem, podemos evoluir para um processo ainda mais redondo com:

- ambiente de homologacao separado
- revisao obrigatoria por PR
- checklist de release
- backup/versionamento de banco

## Proximo passo pratico

Para fechar esse fluxo de vez, falta:

1. criar o repositorio no GitHub
2. subir este projeto para o repositorio
3. conectar os servicos do EasyPanel ao repositorio
4. apontar `homolog` e `main` para os ambientes corretos
5. cadastrar as variaveis de ambiente no EasyPanel
