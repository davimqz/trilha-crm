# Mapa do Repositório

Guia rápido para humanos e agentes de IA. Atualize ao adicionar módulos ou mudar a estrutura.

```text
.
├── .claude/skills/new-module/   Skill: passo a passo para criar um módulo
├── .github/workflows/ci.yml     CI: lint, typecheck, unit, integração (Postgres), build, audit
├── docker/postgres/init/        SQL executado na 1ª subida do Postgres (cria banco de teste)
├── docker-compose.yml           Postgres local (127.0.0.1:5432)
├── docs/                        architecture, decisions (ADRs), security, este mapa
├── drizzle/                     Migrations SQL geradas (0000_auth: tabelas de auth)
├── e2e/                         Testes Playwright (setup global faz seed e login por papel)
├── drizzle.config.ts            Config do drizzle-kit
├── next.config.ts               Headers de segurança (CSP etc.)
├── playwright.config.ts         E2E contra `pnpm start` na porta 3300
├── scripts/create-admin.ts      Cria o primeiro admin (`pnpm auth:create-admin`)
├── src/
│   ├── app/                     Rotas Next.js (App Router)
│   │   ├── (auth)/login/        Tela de login (pública)
│   │   ├── (app)/               Área autenticada: layout com menu por papel e página inicial
│   │   │   ├── account/password/  Troca da própria senha
│   │   │   └── settings/users/    Gestão de usuários (admin)
│   │   ├── api/auth/[...all]/   Better Auth atrás da allowlist
│   │   ├── api/health/route.ts  GET /api/health → 200 ok | 503 error
│   │   └── layout.tsx           Layout raiz (pt-BR)
│   ├── components/              ui/ (shadcn), form/ (select nativo, feedback), access-denied
│   ├── core/                    Infraestrutura compartilhada (não depende de módulos)
│   │   ├── actions/             runAction (erros seguros) e estado de formulário
│   │   ├── auth/                Better Auth: config, schema, allowlist, DAL de sessão, client
│   │   ├── db/                  createDatabase, getDb, agregador de schemas
│   │   ├── errors.ts            DomainError, NotFoundError, ConflictError
│   │   ├── env.ts               Validação de variáveis de ambiente
│   │   ├── health/              checkDatabase
│   │   ├── modules/             Tipos do manifesto, validação, índice de permissões
│   │   └── rbac/                Papéis (roles.ts) e createAuthorization (can/requirePermission)
│   ├── lib/utils.ts             cn() do shadcn
│   └── modules/                 Módulos de negócio
│       ├── authorization.ts     can/requirePermission ligados ao registry
│       ├── registry.ts          Lista de manifestos registrados
│       └── users/               Gestão de usuários (manifesto, validators, service, actions, UI, testes)
├── test/                        Setup de testes (migrations, stub server-only) e helpers de auth
├── tasks.md                     Entregas, tasks, status (fonte de verdade)
└── vitest.config.mts            Projetos de teste: unit e integration
```

## Entry points

| Entry point | Arquivo |
|---|---|
| App web | `src/app/layout.tsx`, `src/app/page.tsx` |
| Health check | `src/app/api/health/route.ts` |
| Auth HTTP | `src/app/api/auth/[...all]/route.ts` |
| Sessão (DAL) | `src/core/auth/session.ts` |
| Conexão com banco | `src/core/db/index.ts` (`getDb`) |
| Registro de módulos | `src/modules/registry.ts` |

## Arquivos críticos

- `src/core/env.ts`: falha cedo com config inválida sem vazar valores.
- `src/core/modules/permissions.ts` e `validate-modules.ts`: base do RBAC.
- `src/core/auth/create-auth.ts` e `allowed-routes.ts`: superfície de autenticação.
- `src/modules/users/service.ts`: gestão de acesso (locks e revalidação do ator).
- `next.config.ts`: política de segurança de conteúdo.

## Módulos

| Módulo | Pasta | Tabelas | Rotas | Status |
|---|---|---|---|---|
| users | `src/modules/users` | `users`, `accounts`, `sessions` (em `core/auth/schema.ts`) | `/settings/users` | 🟢 Entrega 02 |
