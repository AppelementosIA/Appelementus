# Escopo Oficial - Etapa 1

## Plataforma Base de Producao de Relatorios Elementus

### 1. Objetivo da Etapa 1

Construir a plataforma base de producao de relatorios da Elementus, permitindo criar, editar, revisar, anexar imagens e emitir relatorios tecnicos em padrao visual da empresa, com preenchimento automatico de dados cadastrais e salvamento final no Microsoft 365.

O foco desta etapa nao e automatizar tudo de uma vez. O foco e criar o nucleo operacional onde o relatorio nasce, e revisado pelo tecnico, recebe anexos e e salvo no ambiente oficial de trabalho da Elementus.

### 2. Problema que a Etapa 1 Resolve

Hoje, a producao e o envio de relatorios dependem de trabalho manual, repeticao de informacoes, organizacao dispersa de arquivos e muito tempo gasto com formatacao, montagem e conferencia.

Com a Etapa 1, a Elementus passa a ter uma plataforma unica para:

- centralizar clientes, projetos e relatorios
- reduzir redigitacao de informacoes
- padronizar a montagem dos relatorios
- permitir edicao tecnica antes da emissao final
- anexar e organizar imagens no proprio fluxo
- salvar o resultado final diretamente no Microsoft 365

### 3. Entrega Principal

Ao final da Etapa 1, a Elementus tera uma plataforma web operacional onde o tecnico ou gestor podera:

- selecionar o cliente e o projeto
- criar um novo relatorio a partir de um template padrao
- puxar automaticamente os dados cadastrais principais do cliente e do projeto
- editar o conteudo do relatorio antes da emissao
- anexar e organizar imagens do relatorio
- gerar os arquivos finais em `.docx` e `.pdf`
- salvar automaticamente a versao emitida no Microsoft 365, na pasta correspondente

### 4. Escopo da Etapa 1

#### 4.1. Cadastro central de dados

A plataforma devera possuir estrutura de cadastro para:

- clientes
- projetos
- empreendimentos
- campanhas ou periodos
- relatorios

Esses dados servirao como base para preenchimento automatico dos relatorios, evitando retrabalho e inconsistencias.

#### 4.2. Preenchimento automatico de informacoes

Ao iniciar um relatorio, a plataforma devera preencher automaticamente, quando disponivel:

- nome do cliente
- nome do empreendimento
- identificacao do projeto
- periodo ou campanha
- informacoes padrao associadas ao cadastro

O objetivo e eliminar redigitacao e garantir consistencia entre documentos.

#### 4.3. Modulo de criacao e edicao de relatorios

A plataforma devera permitir:

- criar relatorios a partir de templates padronizados da Elementus
- editar campos textuais antes da emissao final
- revisar conteudo tecnico manualmente
- complementar observacoes, descricoes e ajustes necessarios
- manter o tecnico como aprovador final do relatorio

#### 4.4. Modulo de imagens e anexos

A plataforma devera permitir:

- upload de imagens relacionadas ao relatorio
- organizacao das imagens por relatorio
- vinculacao das imagens aos blocos ou secoes correspondentes
- preparacao dessas imagens para composicao do relatorio final

#### 4.5. Emissao do relatorio final

A plataforma devera gerar:

- versao editavel em `.docx`
- versao final em `.pdf`

Os arquivos deverao respeitar o template visual definido para a Elementus.

#### 4.6. Salvamento automatico no Microsoft 365

O Microsoft 365 faz parte obrigatoria da Etapa 1.

Ao emitir o relatorio, a plataforma devera:

- salvar os arquivos finais no ambiente Microsoft 365 da Elementus
- direcionar o salvamento para a pasta correta, conforme cliente, projeto ou estrutura definida
- registrar na plataforma a referencia do arquivo emitido

### 5. Fluxo Operacional da Etapa 1

O fluxo base da plataforma sera:

1. O usuario seleciona o cliente e o projeto.
2. A plataforma puxa os dados cadastrais ja registrados.
3. O usuario cria o relatorio a partir de um template padrao.
4. O tecnico revisa, edita e complementa o conteudo.
5. O tecnico anexa e organiza as imagens necessarias.
6. A plataforma gera os arquivos finais em `.docx` e `.pdf`.
7. A versao emitida e salva automaticamente no Microsoft 365.

### 6. O que Entra na Etapa 1

- plataforma web base de producao de relatorios
- cadastro central de clientes, projetos e relatorios
- preenchimento automatico de dados cadastrais
- criacao de relatorios por template
- edicao manual antes da emissao
- anexacao e organizacao de imagens
- exportacao em `.docx` e `.pdf`
- integracao com Microsoft 365 para armazenamento final

### 7. O que Nao Entra na Etapa 1

Para manter a etapa viavel, objetiva e aderente ao primeiro ciclo de entrega, os itens abaixo ficam fora do escopo principal desta fase:

- entrada automatica de dados via WhatsApp
- transcricao automatica de audios
- OCR de fotos de planilhas
- identificacao automatica de especies por imagem
- agente de IA completo com RAG documental
- dashboard gerencial amplo
- integracao com ERP Sankhya
- envio automatico de relatorio ao cliente
- assinatura digital
- automacoes avancadas de validacao

Esses itens poderao ser conectados posteriormente sobre a plataforma base construida nesta etapa.

### 8. Premissa de Arquitetura

A Etapa 1 deve ser construida de modo que a plataforma ja nasca preparada para futuras integracoes.

Ou seja:

- primeiro construi-se o nucleo da operacao
- depois conectam-se WhatsApp, automacoes, IA e demais entradas

Essa abordagem reduz risco, acelera a entrega inicial e cria uma base solida para as proximas fases.

### 9. Criterios de Aceite da Etapa 1

A Etapa 1 sera considerada entregue quando for possivel validar, em ambiente de uso da Elementus, que:

- existe cadastro funcional de clientes, projetos e relatorios
- o nome do cliente e os dados basicos sao puxados automaticamente no inicio do relatorio
- o relatorio pode ser criado e editado pela plataforma
- o tecnico consegue anexar e organizar imagens
- o relatorio pode ser emitido em `.docx` e `.pdf`
- os arquivos emitidos sao salvos no Microsoft 365
- o fluxo reduz etapas manuais em comparacao ao processo atual

### 10. Resultado Esperado ao Final da Etapa 1

Ao final da Etapa 1, a Elementus tera o nucleo operacional da sua futura plataforma de automacao documental:

- um lugar unico para criar relatorios
- dados cadastrais reaproveitados automaticamente
- edicao tecnica antes da versao final
- imagens organizadas dentro do fluxo
- emissao padronizada de documentos
- armazenamento oficial no Microsoft 365

Com isso, a empresa passa a operar em cima de uma base propria, pronta para receber nas fases seguintes as integracoes com WhatsApp, IA e automacoes mais avancadas.
