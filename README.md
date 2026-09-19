# Trilha CRM

CRM interno da Trilha Finance. Monólito modular em Next.js + TypeScript + PostgreSQL (Drizzle).

## Requisitos

- Node.js 24+ e pnpm
- Docker (Postgres local)

## Rodando localmente

```bash
pnpm install
cp .env.example .env   # preencha BETTER_AUTH_SECRET (comando no arquivo)
pnpm db:up          # sobe o Postgres em 127.0.0.1:5432
pnpm db:migrate     # cria as tabelas
pnpm dev            # http://localhost:3000
```

Health check: `GET /api/health` → `{"status":"ok"}` (`/api/health/live` não consulta o banco).

## Primeiro acesso

Não existe cadastro público. Crie o primeiro administrador:

```bash
ADMIN_NAME="Seu Nome" ADMIN_EMAIL="voce@empresa.com" pnpm auth:create-admin
```

Sem `ADMIN_PASSWORD`, uma senha forte é gerada e exibida uma única vez. Depois de entrar, troque-a em
“Alterar minha senha” e cadastre a equipe em **Usuários**.

## Qualidade

```bash
pnpm lint
pnpm typecheck
pnpm test               # unit
pnpm test:integration   # integração com Postgres
pnpm build
pnpm exec playwright install chromium   # uma vez
pnpm test:e2e           # E2E contra o build, no banco de teste
```

## Documentação

- Plano e status: [`tasks.md`](tasks.md)
- Arquitetura: [`docs/architecture.md`](docs/architecture.md)
- Mapa do repositório: [`docs/repository-map.md`](docs/repository-map.md)
- Decisões (ADRs): [`docs/decisions.md`](docs/decisions.md)
- Segurança: [`docs/security.md`](docs/security.md)
- Deploy (Netlify + Neon), backup e restauração: [`docs/deployment.md`](docs/deployment.md)
- Criar um módulo: [`.claude/skills/new-module/SKILL.md`](.claude/skills/new-module/SKILL.md)
