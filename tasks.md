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
| 01 | Foundation | 🔵 |
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

Scaffold Next.js + TypeScript, Tailwind/shadcn, Postgres via Docker, Drizzle, estrutura `core/` + `modules/`,
registry de módulos, skill `new-module`, Vitest, lint/format, CI no GitHub Actions, docs.

## Fora do escopo

Autenticação, telas de negócio, deploy.

## Tasks

### Repository

- [x] Repositório Git + GitHub privado
- [ ] Estrutura `src/core` e `src/modules`
- [ ] `docs/architecture.md` e `docs/repository-map.md`

### Development

- [ ] Scaffold Next.js (App Router, TS strict, Tailwind)
- [ ] Docker Compose com Postgres
- [ ] Drizzle (cliente, config, migrations)
- [ ] Validação de variáveis de ambiente (Zod)
- [ ] Registry de módulos (manifesto, permissões, navegação)
- [ ] Skill `.claude/skills/new-module`
- [ ] Endpoint de health check (app + banco)

### QA

- [ ] Vitest configurado
- [ ] Testes do registry (ids únicos, permissões bem formadas)
- [ ] Teste de integração do health check com Postgres real
- [ ] Lint + typecheck + testes no CI

### Security

- [ ] `.env` fora do Git, `.env.example` sem segredos
- [ ] Headers de segurança (CSP básica, X-Frame-Options, etc.)
- [ ] Health check sem vazar detalhes internos
- [ ] Auditoria de dependências (`pnpm audit`)

### Git

- [ ] Branch `chore/foundation`
- [ ] Commits atômicos (Conventional Commits)
- [ ] PR para `main`

### Definition of Done

- [ ] `pnpm dev` sobe com Postgres local
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` passam
- [ ] CI verde
- [ ] Documentação atualizada
- [ ] Security review realizado

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
