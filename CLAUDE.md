@AGENTS.md

# Trilha CRM

CRM interno da Trilha Finance. Monólito modular em Next.js (App Router) + TypeScript + PostgreSQL (Drizzle).

- Status e plano: `tasks.md` (fonte de verdade — atualize a cada entrega)
- Decisões: `docs/decisions.md` · Arquitetura: `docs/architecture.md` · Mapa: `docs/repository-map.md` · Segurança: `docs/security.md`

## Regras do projeto

- Idioma: código e identificadores em inglês; textos de UI, docs e mensagens de erro em pt-BR.
- **Novo domínio de negócio = novo módulo**: use a skill `.claude/skills/new-module`. Não crie regras de negócio fora de `src/modules/<id>/service.ts`.
- `src/core` não importa de `src/modules` (exceção: agregador `src/core/db/schema.ts`). Módulos se comunicam apenas pelo `service` exportado.
- Autorização sempre no servidor (service), deny by default. A UI só esconde botões.
- Não invente campos de negócio: se a especificação não está no `tasks.md`, pergunte ao dono do produto.
- Fluxo: entender → definir → QA/segurança no `tasks.md` → branch → implementar → testar → revisar segurança → commit → PR.

## Git

- Branches: `feature/*`, `fix/*`, `security/*`, `refactor/*`, `test/*`, `chore/*`, `docs/*`. Nunca commitar direto na `main`.
- Conventional Commits, commits atômicos.
- **Nunca** incluir trailers `Co-Authored-By` de IA, "Generated with ..." ou qualquer menção a assistente de IA em commits ou PRs.

## Comandos

```bash
pnpm db:up              # Postgres local (Docker)
pnpm dev                # app em http://localhost:3000
pnpm lint && pnpm typecheck
pnpm test               # unit
pnpm test:integration   # integração (usa TEST_DATABASE_URL)
pnpm db:generate        # gera migration a partir dos schemas
pnpm db:migrate         # aplica migrations
```
