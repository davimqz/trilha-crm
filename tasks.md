# Tasks

## Status

- ⚪ Pendente
- 🔵 Em andamento
- 🟢 Concluído
- 🟡 Bloqueado
- 🔴 Precisa de correção

---

## Visão geral das entregas

| # | Entrega | Status |
|---|---|---|
| 00 | Definição (stack, arquitetura, roles, roadmap) | 🟢 |
| 01 | Foundation | 🟢 |
| 02 | Autenticação + RBAC + gestão de usuários | 🟢 |
| 03 | Módulo Leads (kanban, anotações, anexos) | 🟢 |
| 04 | Módulo Clientes (conversão, atendimentos, linha do tempo) | 🔵 |
| 05 | Hardening + Deploy do MVP | ⚪ |

---

# Entrega 00 — Definição

## Objetivo

Definir stack, arquitetura, modelo de papéis e roadmap antes de qualquer código.

## Tasks

- [x] Levantar requisitos iniciais (uso interno, < 30 leads, sem dados sensíveis no MVP)
- [x] Escolher stack — ADR-001
- [x] Definir arquitetura modular — ADR-002
- [x] Propor modelo de papéis — ADR-003 (aprovado)
- [x] Mapear opções de hospedagem — ADR-004
- [x] Roadmap de produto (abaixo)

---

# Entrega 01 — Foundation

## Objetivo

Base do projeto rodando localmente, com arquitetura modular, qualidade automatizada e documentação,
pronta para receber módulos.

## Escopo

Scaffold Next.js + TypeScript, Tailwind, Postgres via Docker, Drizzle, estrutura `core/` + `modules/`,
registry de módulos, skill `new-module`, Vitest, ESLint, CI no GitHub Actions, docs.
(shadcn/ui entra na primeira entrega com telas.)

## Fora do escopo

Autenticação, telas de negócio, deploy.

## Tasks

### Repository

- [x] Repositório Git + GitHub privado
- [x] Estrutura `src/core` e `src/modules`
- [x] `docs/architecture.md` e `docs/repository-map.md`

### Development

- [x] Scaffold Next.js (App Router, TS strict, Tailwind)
- [x] Docker Compose com Postgres
- [x] Drizzle (cliente, config, migrations)
- [x] Validação de variáveis de ambiente (Zod)
- [x] Registry de módulos (manifesto, permissões, navegação)
- [x] Skill `.claude/skills/new-module`
- [x] Endpoint de health check (app + banco)

### QA

- [x] Vitest configurado
- [x] Testes do registry (ids únicos, permissões bem formadas)
- [x] Teste de integração do health check com Postgres real
- [x] Lint + typecheck + testes no CI

### Security

- [x] `.env` fora do Git, `.env.example` sem segredos
- [x] Headers de segurança (CSP básica, X-Frame-Options, etc.)
- [x] Health check sem vazar detalhes internos
- [x] Auditoria de dependências (`pnpm audit`)

### Git

- [x] Branch `chore/foundation`
- [x] Commits atômicos (Conventional Commits)
- [x] PR para `main`

### Definition of Done

- [x] `pnpm dev` sobe com Postgres local
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` passam
- [x] CI verde
- [x] Documentação atualizada
- [x] Security review realizado

---

# Entrega 02 — Autenticação + RBAC

## Objetivo

Login seguro, sessões, papéis (`admin`, `manager`, `sales`, `viewer`) e gestão de usuários pelo admin.

## Escopo

- Login por e-mail e senha; logout; troca da própria senha.
- Sem cadastro público: usuários criados pelo admin (senha inicial definida por ele).
- Primeiro admin criado por script (`pnpm auth:create-admin`).
- RBAC: `can()` / `requirePermission()` sobre o índice do registry; checagem em toda page, action e service.
- Módulo `users` (admin): listar, criar, alterar papel, desativar/reativar, redefinir senha.
- Shell autenticado (menu por papel) e página inicial.

## Fora do escopo

Recuperação de senha por e-mail (sem provedor de e-mail ainda), 2FA, login social, papéis customizáveis, log de auditoria.

## Decisões (ADR-005)

Better Auth **sem o plugin admin**: `role` e `active` são campos do usuário com `input: false`;
bloqueio de inativos em hook de criação de sessão; criação/alteração de usuários só pelo service `users`.

## Critérios de aceitação

1. Visitante sem sessão que acessa qualquer página interna é redirecionado para `/login`.
2. Login válido leva à página inicial; inválido mostra mensagem genérica (não revela se o e-mail existe).
3. Admin cria usuário com nome, e-mail, papel e senha inicial; o usuário consegue entrar.
4. Menu e páginas respeitam o papel: só `admin` vê/acessa "Usuários".
5. Admin altera papel e desativa/reativa usuários; não pode fazer isso consigo mesmo.
6. Usuário desativado perde as sessões ativas imediatamente e não consegue entrar.
7. Redefinição de senha pelo admin invalida a senha antiga e as sessões do usuário.
8. Usuário troca a própria senha informando a atual.
9. Sempre existe ao menos um admin ativo (inclusive sob alterações concorrentes).

## QA

| Nível | Casos |
|---|---|
| Unit | matriz papel × permissão, permissão desconhecida, validators (limites, e-mail, papel inválido, campos extras) |
| Integração (Postgres) | criar usuário e logar; não-admin bloqueado em cada operação; e-mail duplicado; autoalteração bloqueada; desativar revoga sessões e bloqueia login; reset de senha; corrida entre dois admins |
| Pentest automatizado (HTTP no handler) | cadastro público bloqueado; `/update-user` com `role` bloqueado; brute force → 429 |
| E2E (Playwright) | redirect sem sessão; login inválido; login admin → usuários; viewer sem acesso a usuários; logout |

## Ameaças analisadas

| Ameaça | Mitigação |
|---|---|
| Brute force / credential stuffing | Rate limit do Better Auth em banco (login: 5 tentativas/min por IP); senha mínima de 12 caracteres |
| Escalada de privilégio (mass assignment de `role`) | `input: false` em `role`/`active`; `/update-user` desabilitado; teste automatizado |
| Cadastro público | `disableSignUp` + rota desabilitada; teste automatizado |
| Server Actions chamadas diretamente | `requireActor` + `requirePermission` em toda action e service |
| IDOR em usuários | Só `admin` tem `users:*`; ids validados como UUID |
| Sessão de usuário desativado/rebaixado | Papel e status lidos do banco a cada request (sem cache em cookie); sessões apagadas ao desativar |
| CSRF | Checagem de Origin do Better Auth + Server Actions do Next (origin check); cookies `SameSite=Lax`, `HttpOnly`, `Secure` em produção |
| Enumeração de usuários | Mensagem genérica no login |
| Lockout (sem admins) | Autoalteração proibida + lock transacional das linhas de admin |
| Vazamento de dados | Service retorna só campos necessários (sem hash de senha) |
| Telemetria externa | Telemetria do Better Auth desativada |

## Tasks

### Development

- [x] Schema de auth (users, sessions, accounts, verifications, rate_limits) + migration
- [x] Configuração do Better Auth + route handler `/api/auth/*`
- [x] DAL de sessão (`getCurrentActor`, `requireActor`)
- [x] `core/rbac/authorization` (`can`, `requirePermission`)
- [x] Módulo `users` (manifesto, validators, service, actions, UI)
- [x] shadcn/ui
- [x] Login, logout, shell autenticado, troca de senha
- [x] Script `auth:create-admin`

### QA

- [x] Testes unit
- [x] Testes de integração
- [x] Pentest automatizado
- [x] Playwright (E2E) + CI

### Security

- [x] Security review do diff
- [x] Pentest (HTTP no handler + replay de Server Action no E2E)

### Git

- [x] Branch `feature/auth-rbac`
- [x] Commits atômicos
- [x] PR para `main`

### Definition of Done

- [x] Critérios de aceitação 1–9 verificados
- [x] lint, typecheck, unit, integração, E2E e build verdes no CI
- [x] Docs (architecture, repository-map, security, skill) atualizadas

---

# Entrega 03 — Leads

## Objetivo

Seção Leads com kanban de estágios (drag and drop), busca, filtros, ordenação, arquivados, cadastro manual,
painel do lead (informações, edição, anotações em rich text e anexos).

**Especificação completa:** [`docs/specs/leads.md`](docs/specs/leads.md) (estrutura da tela, regras, permissões,
critérios de aceitação 1–13, QA e ameaças). Decisões: ADR-006 (anexos) e ADR-007 (rich text).

## Fora do escopo

Seção Clientes e conversão lead → cliente (Entrega 04), importação CSV, reordenação manual dentro da coluna,
edição/exclusão de anotações.

## Tasks

### Definição

- [x] Especificação estruturada (`docs/specs/leads.md`)
- [x] Regras de filtro/ordenação/limites decididas e documentadas
- [x] ADR-006 e ADR-007

### Development

- [x] Schema: `leads`, `lead_notes`, `lead_attachments`, `lead_attachment_contents` + migration
- [x] Validators: lead, telefone BR, filtros, rich text (JSON), arquivos
- [x] Service: listar (busca/filtros/ordenação/arquivados), obter, criar, editar, mover, arquivar, excluir,
      reatribuir, anotações, anexos (com posse do `sales`)
- [x] Route handlers de upload/download de anexos
- [x] Componentes shadcn: dialog, sheet, tabs, dropdown-menu, alert-dialog, skeleton, sonner, tooltip, toggle, popover, separator
- [x] UI: toolbar (busca, filtros, ordenar, abas), kanban com dnd-kit, "+" por coluna, painel com abas
- [x] Editor e renderizador de anotações (Tiptap)
- [x] Menu "Leads" (manifesto do módulo)

### QA

- [x] Unit (telefone, validators, rich text, tipos de arquivo)
- [x] Integração (service + matriz de permissões + IDOR)
- [x] E2E (fluxos da §8 da spec)

### Security

- [x] Security review do diff
- [x] Pentest (XSS em anotação, upload malicioso, IDOR, mass assignment)

### Git

- [x] Branch `feature/leads`
- [x] Commits atômicos
- [x] PR para `main`

### Definition of Done

- [x] Critérios de aceitação 1–13 verificados
- [x] CI verde (lint, typecheck, unit, integração, build, E2E)
- [x] Docs atualizadas (spec, architecture, repository-map, security)

# Entrega 04 — Clientes

## Objetivo

Seção Clientes: clientes nascem da conversão de leads; lista com contador de ativos, busca, filtros, ordenação,
modal com Informações, Editar, Anotações, Anexos, **Atendimentos** e **Linha do tempo** (histórico completo).

**Especificação:** [`docs/specs/clients.md`](docs/specs/clients.md) · **Decisão:** ADR-008.

## Tasks

### Definição

- [x] Regras de negócio confirmadas (atendimento = registro de contato; ativos = adimplentes; reverter arquiva; histórico compartilhado)
- [x] Especificação + ADR-008

### Development

- [ ] Schema: `lead_events`, `clients`, `client_service_records` + migration com backfill
- [ ] Eventos gravados em todas as ações de leads (criar, mover, editar, responsável, arquivar)
- [ ] Conversão/reversão/reativação na transação do lead; bloqueio de exclusão de lead convertido
- [ ] Service de clientes (lista, contador, detalhe, editar, atendimentos) + linha do tempo
- [ ] UI: página Clientes, modal com 6 abas, atendimentos, linha do tempo (também no lead)
- [ ] Menu "Clientes"

### QA

- [ ] Unit · [ ] Integração · [ ] E2E

### Security

- [ ] Security review · [ ] Pentest

### Git

- [x] Branch `feature/clients` · [ ] Commits · [ ] PR

### Definition of Done

- [ ] Critérios 1–12 · [ ] CI verde · [ ] Docs

# Entrega 05 — Hardening + Deploy

- [ ] Decidir hospedagem (ADR-004)
- [ ] Backups do banco
- [ ] Monitoramento de erros
- [ ] Pentest final do MVP

---

# Tech debt / follow-ups

| Tipo | Item | Origem |
|---|---|---|
| SECURITY | CSP com nonce (remover `'unsafe-inline'` de scripts) | Entrega 01 |
| TECH DEBT | Alerta moderado GHSA-67mh no `esbuild` transitivo do `drizzle-kit` (dev-only) | Entrega 01 |
| ~~TECH DEBT~~ | ~~Configurar Playwright~~ — feito na Entrega 02 | Entrega 01 |
| IMPROVEMENT | Lint de fronteiras entre módulos (proibir import de internals de outro módulo) | Entrega 01 |
| IMPROVEMENT | Estados de carregamento (skeleton) no kanban e no painel do lead (`loading.tsx`) | Entrega 03 |
| IMPROVEMENT | Arraste por teclado move por pixels; mover entre colunas com as setas exige sensor customizado (hoje o status também muda em "Editar") | Entrega 03 |
| TECH DEBT | Extrair a interface `AttachmentStorage` (ADR-006) quando houver 2º backend de arquivos; hoje o service grava direto no Postgres | Entrega 03 |
| BUG | ~~Clicar no corpo do card não abria o painel (só o nome)~~ — corrigido em `fix/lead-card-click` | Entrega 03 |
| IMPROVEMENT | Menu lateral estilo dashboard (sidebar recolhível, gaveta no celular, menu da conta) — `feature/sidebar-layout` | Pedido do dono do produto |
| IMPROVEMENT | Card do lead em modal centralizado + anexos com Visualizar (PDF/imagem/texto) e Baixar — `feature/lead-modal-and-preview` | Pedido do dono do produto |
| FEATURE | Regras pendentes do dono do produto: editar/excluir anotações, alterar lead arquivado, visibilidade do viewer (spec §12) | Entrega 03 |
| SECURITY | **Limite de tentativas de login por conta** (independente de IP) + `trustedProxies` conforme hospedagem: o rate limit por IP pode ser contornado com `X-Forwarded-For` forjado se o servidor ficar exposto sem proxy | Entrega 02 → **obrigatório na Entrega 05** |
| FEATURE | Recuperação de senha por e-mail | Entrega 02 (depende da integração de e-mail) |

---

# Roadmap de produto (futuro)

| Tipo | Item | Observação |
|---|---|---|
| FEATURE | Atividades / tarefas / follow-ups | Ligadas a leads e clientes |
| FEATURE | Pipeline (kanban) por estágio | |
| FEATURE | Dashboard comercial | Conversão, origem dos leads, funil |
| FEATURE | Importação/exportação CSV | |
| FEATURE | Campos customizáveis por objeto | Modelo "metadata" à la Twenty |
| FEATURE | Integração e-mail | Envio + histórico |
| FEATURE | Integração WhatsApp | API oficial (Cloud API); webhooks assinados |
| FEATURE | Automações e workflows | Gatilhos, ações, filas/jobs em background |
| SECURITY | Log de auditoria | Quem alterou o quê e quando |
| SECURITY | **LGPD e dados sensíveis** | Antes de armazenar CPF, dados financeiros ou patrimoniais: base legal e consentimento, criptografia de colunas sensíveis, mascaramento na UI, política de retenção/exclusão, atendimento a direitos do titular, registro de acesso a dados sensíveis |
| SECURITY | 2FA para usuários | |
| IMPROVEMENT | Papéis customizáveis | Se o time crescer |
