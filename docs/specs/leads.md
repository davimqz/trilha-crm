# Especificação — Módulo Leads (Entrega 03)

> Fonte: requisitos do dono do produto (2026-09-18). Onde o requisito não definiu a regra, a decisão tomada
> está marcada com **[Decisão]** e pode ser revista.

## 1. Visão geral

A seção **Leads** mostra os leads em um **kanban** por estágio do funil. É possível arrastar cards entre colunas,
buscar por nome, filtrar, ordenar, cadastrar leads manualmente e abrir cada card para ver as informações, editar,
registrar anotações e anexar arquivos. Leads podem ser **arquivados** manualmente e ficam em uma aba própria.

## 2. Estágios (colunas do kanban)

| Ordem | Id (código) | Rótulo |
|---|---|---|
| 1 | `prospect` | Prospect |
| 2 | `first_contact` | Primeiro Contato |
| 3 | `meeting_scheduled` | Reunião Agendada |
| 4 | `meeting_cancelled` | Reunião Desmarcada |
| 5 | `meeting_done` | Reunião Realizada |
| 6 | `converted` | Convertido |
| 7 | `not_converted` | Não convertido |

- Mover um card para outra coluna altera o status do lead.
- **[Decisão]** Não há reordenação manual dentro da coluna: a ordem dos cards segue o "Ordenar por" escolhido.
- **[Decisão]** "Convertido" é só um status nesta entrega. A criação automática do cliente fica para a Entrega 04.

## 3. Estrutura da tela

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Leads                                                                                │
│ [ Ativos | Arquivados ]                                                              │
│ [🔍 Buscar por nome...        ] [Filtros ▾ (2)] [Ordenar por: Atualizados ▾]         │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────── ... ─────────┤
│ Prospect  3  │ 1º Contato 1 │ Reunião Ag. 0│ Reunião Desm.│ ...  (rolagem horizontal)│
│ ┌──────────┐ │ ┌──────────┐ │              │              │                          │
│ │Ana Souza │ │ │João Lima │ │  (vazio)     │              │                          │
│ │ana@...   │ │ │(81) 9... │ │              │              │                          │
│ │(11) 9... │ │ │👤 Davi    │ │              │              │                          │
│ └──────────┘ │ └──────────┘ │              │              │                          │
│ [    +     ] │ [    +     ] │ [    +     ] │ [    +     ] │                          │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────────────────┘
```

### 3.1 Abas
- **Ativos:** kanban com os leads não arquivados.
- **Arquivados:** **[Decisão]** tabela (não kanban) com Nome, E-mail, Telefone, Status, Arquivado em, Arquivado por.
  Clicar na linha abre o card. Busca, filtros e ordenação também valem aqui.

### 3.2 Busca
- Campo "Buscar por nome", com espera de 300 ms após a digitação. Não diferencia maiúsculas de minúsculas e procura o termo em qualquer parte do nome.
- Máximo de 100 caracteres. Os caracteres `%` e `_` são tratados como texto literal, não como curinga.

### 3.3 Filtros **[Decisão]**
| Filtro | Opções |
|---|---|
| Responsável | Todos · Meus leads · (cada usuário ativo) |
| Criado em | Qualquer data · Últimos 7 dias · Últimos 30 dias · Últimos 90 dias |

O botão mostra quantos filtros estão ativos e tem a opção "Limpar filtros".

### 3.4 Ordenar por **[Decisão]**
Atualizados recentemente (padrão) · Criados recentemente · Mais antigos · Nome (A–Z) · Nome (Z–A).

### 3.5 Estado na URL
Busca, filtros, ordenação, aba e card aberto ficam na URL (`?q=&owner=&period=&sort=&view=archived&lead=<id>&tab=notes`).
Assim o link pode ser compartilhado e o botão "voltar" do navegador funciona.

### 3.6 Botão "+" (cadastro manual)
- No pé de cada coluna. Abre um diálogo **"Novo lead — <coluna>"** com:
  - **Nome** (obrigatório, 2–120 caracteres)
  - **E-mail** (obrigatório, válido, até 254 caracteres; **[Decisão]** único entre os leads, sem diferenciar maiúsculas)
  - **Telefone com DDD** (obrigatório; ver §5)
  - Botão **Cadastrar**
- O lead nasce no estágio da coluna, com o usuário que cadastrou como **responsável**.

### 3.7 Card do lead
Mostra nome, e-mail, telefone formatado, responsável e "atualizado há X". O card inteiro é clicável e abre o painel do lead.
Quem pode editar o lead consegue arrastar o card.

## 4. Painel do lead (ao clicar no card)

Painel lateral (Sheet) com **abas**:

### 4.1 Informações
Nome, e-mail, telefone, status, responsável, criado em/por, **última edição (data e hora) e por quem**, e "Arquivado" quando for o caso.

### 4.2 Editar
- Campos: Nome, E-mail, Telefone, Status e Responsável (este último só para quem tem permissão de reatribuir).
- Mostra **"Última edição: 18/09/2026 às 14:32 por Ana"** e o **status** atual.
- Botões: **Salvar**, **Arquivar** (ou **Desarquivar**) e **Excluir**, este com confirmação: *"Excluir este lead apaga também
  anotações e anexos. Esta ação não pode ser desfeita."*

### 4.3 Anotações
- Editor com: **Negrito**, **Sublinhado**, **Cor do texto** (paleta fixa de 8 cores), **Lista com marcadores** e **Lista numerada**.
- Botão **Adicionar anotação**.
- Histórico, da mais recente para a mais antiga:
  - **Título:** data e hora da anotação (ex.: "18/09/2026 às 14:32"), acompanhada do autor.
  - **Conteúdo:** o texto formatado.
- **[Decisão]** Anotações não são editadas nem excluídas: o histórico é imutável. Excluir o lead apaga as anotações.
- Limite de 10.000 caracteres de texto por anotação.

### 4.4 Anexos
- Botão **Adicionar** (seletor de arquivo).
- Lista com: **Nome**, **Tipo** (PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, TXT, CSV), **Tamanho** (KB/MB), **Data do anexo**
  e botão **Remover** (com confirmação). Clicar no nome baixa o arquivo.
- **[Decisão]** Limites: 10 MB por arquivo, até 20 anexos por lead. Tipos fora da lista são recusados.

## 5. Regras de dados

| Campo | Regra |
|---|---|
| Nome | Espaços extras removidos; 2–120 caracteres |
| E-mail | Espaços removidos, convertido para minúsculas, formato válido, até 254 caracteres, único |
| Telefone | Só dígitos são guardados: DDD válido (11–99, lista da Anatel) + 8 dígitos (fixo) ou 9 dígitos começando com 9 (celular). Aceita a entrada com ou sem `+55`, parênteses, espaços e hífen. É exibido como `(11) 91234-5678` |
| Status | Um dos 7 ids da §2 |
| Responsável | Usuário ativo |
| Datas | Guardadas em UTC e exibidas em `America/Sao_Paulo`, formato brasileiro |

## 6. Permissões (ADR-003)

| Ação | admin | manager | sales | viewer |
|---|---|---|---|---|
| Ver leads, anotações e anexos | ✅ | ✅ | ✅ | ✅ |
| Cadastrar lead | ✅ | ✅ | ✅ | ❌ |
| Editar, mover no kanban, anotar, anexar e remover anexo | ✅ | ✅ | só leads em que é responsável | ❌ |
| Arquivar / desarquivar | ✅ | ✅ | só leads em que é responsável | ❌ |
| Reatribuir responsável | ✅ | ✅ | ❌ | ❌ |
| Excluir lead | ✅ | ✅ | ❌ | ❌ |

A interface esconde o que o usuário não pode fazer, mas **toda regra é verificada no servidor**.

## 7. Estados de interface

| Estado | Comportamento |
|---|---|
| Carregando | Esqueleto das colunas e dos cards |
| Vazio (sem leads) | Colunas vazias com o "+"; mensagem "Nenhum lead ainda. Use + para cadastrar." |
| Busca/filtro sem resultado | "Nenhum lead encontrado para os filtros atuais" + "Limpar filtros" |
| Erro ao mover | O card volta para a coluna original e aparece um aviso de erro |
| Sucesso | Aviso curto ("Lead cadastrado", "Anotação adicionada"…) |
| Sem permissão | Botões de ação ocultos; cards de outros responsáveis não são arrastáveis para o `sales` |

**Acessibilidade:** o arrastar funciona também pelo teclado (espaço para pegar, setas para mover, espaço para soltar),
o status pode ser alterado no formulário de edição, os campos têm rótulos e os diálogos prendem o foco.

## 8. Critérios de aceitação

1. Ao clicar em **Leads**, aparece o kanban com as 7 colunas na ordem da §2, cada uma com contador.
2. O "+" de uma coluna abre o cadastro com Nome, E-mail e Telefone obrigatórios; ao cadastrar, o card aparece nessa coluna.
3. Dados inválidos (e-mail inválido, telefone sem DDD válido, nome curto, e-mail duplicado) mostram erro no campo e nada é salvo.
4. Arrastar um card para outra coluna altera o status, e o novo status persiste ao recarregar a página.
5. A busca por parte do nome filtra os cards (sem diferenciar maiúsculas); filtros e ordenação funcionam e ficam na URL.
6. Clicar no card abre o painel com as abas Informações, Editar, Anotações e Anexos.
7. Em Editar, salvar altera os dados e atualiza "Última edição" (data, hora e autor).
8. Arquivar tira o lead do kanban e o leva à aba Arquivados; desarquivar o traz de volta.
9. Excluir (após confirmação) remove o lead, as anotações e os anexos.
10. Uma anotação com negrito, sublinhado, cor e listas aparece no histórico com data/hora como título e a formatação preservada.
11. Anexar um PDF lista o arquivo com nome, tipo "PDF", tamanho e data; ele pode ser baixado e removido.
12. Arquivos de tipo não permitido ou acima de 10 MB são recusados com mensagem clara.
13. As permissões da §6 são respeitadas no servidor (o `viewer` não altera nada, o `sales` não altera leads de outros).

## 9. QA

| Nível | Casos |
|---|---|
| Unit | Telefone (DDDs válidos e inválidos, fixo/celular, formatos de entrada), validators, schema de rich text (nós, marcas e cores permitidos), detecção de tipo de arquivo por conteúdo, formatação de tamanho e data |
| Integração (Postgres) | CRUD, busca (incluindo `%`/`_`), filtros, ordenação, arquivar, excluir em cascata, e-mail duplicado, matriz papel × ação, `sales` em lead de outro (IDOR), limites de anexos, anotações com conteúdo malicioso |
| E2E | Criar pelo "+", arrastar entre colunas, buscar, abrir card, editar, anotar com formatação, anexar/baixar/remover, arquivar/desarquivar, excluir, `viewer` sem ações |
| Pentest | XSS em anotação (HTML/scripts/`style` via cor), IDOR em lead/anexo/anotação, upload malicioso (extensão falsa, HTML/SVG disfarçado, arquivo enorme, nome com `../`), download com tipo forçado, mass assignment (`ownerId`, `archivedAt`) |

## 10. Segurança (ameaças específicas)

| Ameaça | Mitigação |
|---|---|
| XSS armazenado via anotação | Conteúdo guardado como **JSON estruturado** (não HTML), validado por schema estrito (lista de nós e marcas permitidos, cor só da paleta) e renderizado por componentes React, sem `dangerouslySetInnerHTML` (ADR-007) |
| Upload malicioso | Tipo detectado pelo **conteúdo** (assinatura dos primeiros bytes), cruzado com a extensão; lista de tipos permitidos; limite de tamanho; nome do arquivo higienizado |
| Download servindo HTML/script | `Content-Disposition: attachment`, `Content-Type` da lista permitida, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`, `Cache-Control: private, no-store` |
| IDOR | Todo acesso por id confere a permissão e a posse no service; o id do anexo sempre é buscado junto com o id do lead |
| Mass assignment | Schemas `strict`: `ownerId`, `archivedAt`, `createdBy` etc. nunca vêm do cliente (o responsável só com `leads:assign`) |
| Injeção na busca | Query parametrizada; `%` e `_` tratados como literais |
| Enumeração de anexos | Ids UUID + rota exige sessão e permissão |

## 11. Decisões técnicas

- ADR-006 — Anexos guardados no Postgres (`bytea`) por trás de uma interface de armazenamento.
- ADR-007 — Rich text com Tiptap guardado em JSON validado e renderizado sem HTML.
- Drag and drop: `@dnd-kit/core` (estável, acessível por teclado).

## 12. Em aberto (para o dono do produto)

- Especificação da seção **Clientes** e do que acontece ao **converter** um lead (Entrega 04).
- Confirmar se o `sales` deve poder anotar e anexar em leads de **outros** responsáveis (hoje: não, conforme o ADR-003).
- Confirmar se anotações devem poder ser editadas ou excluídas (hoje: histórico imutável).
