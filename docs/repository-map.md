# Mapa do Repositório

Guia rápido para humanos e agentes de IA. Atualize ao adicionar módulos ou mudar a estrutura.

```text
.
├── .claude/skills/new-module/   Skill: passo a passo para criar um módulo
├── .github/workflows/ci.yml     CI: lint, typecheck, unit, integração (Postgres), build, audit
├── docker/postgres/init/        SQL executado na 1ª subida do Postgres (cria banco de teste)
├── docker-compose.yml           Postgres local (127.0.0.1:5432)
├── docs/                        architecture, decisions (ADRs), security, este mapa
├── drizzle/                     Migrations SQL geradas (a partir do 1º módulo)
├── drizzle.config.ts            Config do drizzle-kit
├── next.config.ts               Headers de segurança (CSP etc.)
├── src/
│   ├── app/                     Rotas Next.js (App Router)
│   │   ├── api/health/route.ts  GET /api/health → 200 ok | 503 error
│   │   ├── layout.tsx           Layout raiz (pt-BR)
│   │   └── page.tsx             Página inicial (placeholder)
│   ├── core/                    Infraestrutura compartilhada (não depende de módulos)
│   │   ├── db/                  createDatabase, getDb, agregador de schemas
│   │   ├── env.ts               Validação de variáveis de ambiente
│   │   ├── health/              checkDatabase
│   │   ├── modules/             Tipos do manifesto, validação, índice de permissões
│   │   └── rbac/roles.ts        Papéis: admin, manager, sales, viewer
│   └── modules/                 Módulos de negócio
│       └── registry.ts          Lista de manifestos registrados
├── test/                        Setup de testes (stub server-only, setup de integração)
├── tasks.md                     Entregas, tasks, status (fonte de verdade)
└── vitest.config.mts            Projetos de teste: unit e integration
```

## Entry points

| Entry point | Arquivo |
|---|---|
| App web | `src/app/layout.tsx`, `src/app/page.tsx` |
| Health check | `src/app/api/health/route.ts` |
| Conexão com banco | `src/core/db/index.ts` (`getDb`) |
| Registro de módulos | `src/modules/registry.ts` |

## Arquivos críticos

- `src/core/env.ts`: falha cedo com config inválida sem vazar valores.
- `src/core/modules/permissions.ts` e `validate-modules.ts`: base do RBAC.
- `next.config.ts`: política de segurança de conteúdo.

## Módulos

| Módulo | Pasta | Tabelas | Rotas | Status |
|---|---|---|---|---|
| — | — | — | — | nenhum módulo ainda (Leads e Clientes nas Entregas 03/04) |
