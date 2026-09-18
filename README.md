# Trilha CRM

CRM interno da Trilha Finance. Monólito modular em Next.js + TypeScript + PostgreSQL (Drizzle).

## Requisitos

- Node.js 24+ e pnpm
- Docker (Postgres local)

## Rodando localmente

```bash
pnpm install
cp .env.example .env
pnpm db:up          # sobe o Postgres em 127.0.0.1:5432
pnpm dev            # http://localhost:3000
```

Health check: `GET /api/health` → `{"status":"ok"}`.

## Qualidade

```bash
pnpm lint
pnpm typecheck
pnpm test               # unit
pnpm test:integration   # integração com Postgres
pnpm build
```

## Documentação

- Plano e status: [`tasks.md`](tasks.md)
- Arquitetura: [`docs/architecture.md`](docs/architecture.md)
- Mapa do repositório: [`docs/repository-map.md`](docs/repository-map.md)
- Decisões (ADRs): [`docs/decisions.md`](docs/decisions.md)
- Segurança: [`docs/security.md`](docs/security.md)
- Criar um módulo: [`.claude/skills/new-module/SKILL.md`](.claude/skills/new-module/SKILL.md)
