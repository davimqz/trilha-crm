# Arquitetura

Monólito modular (ADR-001, ADR-002). Um único app Next.js serve UI e backend. Toda regra de negócio fica em módulos.

## Camadas

```text
Browser
   │  HTML / Server Actions / Route Handlers
   ▼
src/app/            rotas finas: compõem UI e chamam actions/services
   │
   ▼
src/modules/<id>/   actions.ts → service.ts (validação + autorização + regra) → schema.ts
   │
   ▼
src/core/           db (Drizzle), env, rbac, modules (registry), health
   │
   ▼
PostgreSQL
```

## Regras de dependência

| De → Para | Permitido? |
|---|---|
| `app` → `modules`, `core` | ✅ |
| `modules/<a>` → `core` | ✅ |
| `modules/<a>` → `modules/<b>/service` | ✅ (só pela API pública do service) |
| `modules/<a>` → `modules/<b>/schema`, componentes internos | ❌ |
| `core` → `modules` | ❌ (exceção: agregador `core/db/schema.ts`) |

## Módulos e permissões

- Cada módulo declara um **manifesto** (`module.ts`): id, nome, permissões por ação e por papel, navegação.
- `src/modules/registry.ts` lista os manifestos. Um teste valida o registry no CI
  (ids únicos, kebab-case, papéis conhecidos, admin em tudo, navegação coerente).
- `core/modules/permissions.ts` gera o índice papel → permissões (`<módulo>:<ação>`), deny by default,
  e a navegação filtrada por papel.
- A aplicação dessas permissões em sessões reais chega na Entrega 02 (Better Auth + `requirePermission`).

## Banco de dados

- Schema por módulo, agregado em `src/core/db/schema.ts` para o Drizzle e o drizzle-kit.
- Migrations SQL geradas em `drizzle/` (`pnpm db:generate`), revisadas e versionadas.
- `getDb()` (server-only) mantém uma conexão reaproveitada; `createDatabase(url)` é usado em testes.
- Local: Docker Compose com `trilha_crm` (dev) e `trilha_crm_test` (integração).

## Configuração

- Variáveis validadas com Zod em `src/core/env.ts`, lidas sob demanda (o build não exige segredos).
- `.env` nunca é versionado; `.env.example` documenta as chaves.

## Testes

| Tipo | Padrão de arquivo | Comando |
|---|---|---|
| Unit | `*.test.ts` | `pnpm test` |
| Integração (Postgres real) | `*.integration.test.ts` | `pnpm test:integration` |
| E2E | a definir nas entregas com UI (Playwright) | — |

## Futuro

Integrações (WhatsApp, e-mail) e workflows entrarão como módulos. Jobs em background e webhooks
serão definidos no ADR-004 quando essas entregas começarem.
