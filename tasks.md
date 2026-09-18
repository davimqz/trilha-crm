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
| 01 | Foundation | 🟢 (PR aberto) |
| 02 | Autenticação + RBAC + gestão de usuários | ⚪ |
| 03 | Módulo Leads | 🟡 aguardando especificação do dono do produto |
| 04 | Módulo Clientes (+ conversão lead → cliente) | 🟡 aguardando especificação do dono do produto |
| 05 | Hardening + Deploy do MVP | ⚪ |

---

# Entrega 00 — Definição

## Objetivo

Definir stack, arquitetura, modelo de papéis e roadmap antes de qualquer código.

## Tasks

- [x] Levantar requisitos iniciais (uso interno, < 30 leads, sem dados sensíveis no MVP)
- [x] Escolher stack — ADR-001
- [x] Definir arquitetura modular — ADR-002
- [x] Propor modelo de papéis — ADR-003 (aguardando validação)
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
- [ ] CI verde
- [x] Documentação atualizada
- [x] Security review realizado

---

# Entrega 02 — Autenticação + RBAC

## Objetivo

Login seguro, sessões, papéis (`admin`, `manager`, `sales`, `viewer`) e gestão de usuários pelo admin.

## Tasks (rascunho)

- [ ] Better Auth com e-mail/senha, cadastro público desabilitado
- [ ] Seed do primeiro admin via script
- [ ] `core/rbac`: papéis, permissões, `can()` / `requirePermission()`
- [ ] Proteção de rotas (layout autenticado) + checagem em todo service
- [ ] Tela de usuários (admin): criar, alterar papel, desativar
- [ ] Rate limiting no login
- [ ] Testes: matriz papel × permissão, acesso sem sessão, escalada de privilégio
- [ ] Pentest: brute force, fixação de sessão, IDOR em usuários, CSRF

---

# Entrega 03 — Leads 🟡

Aguardando a especificação de como o dono do produto quer o cadastro de leads (campos, status, origem, fluxo).

# Entrega 04 — Clientes 🟡

Aguardando especificação (campos, relação com lead, conversão).

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
| TECH DEBT | Configurar Playwright quando houver a primeira tela com fluxo | Entrega 01 |
| IMPROVEMENT | Lint de fronteiras entre módulos (proibir import de internals de outro módulo) | Entrega 01 |

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
