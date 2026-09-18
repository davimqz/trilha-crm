# Decisões de Arquitetura (ADR)

Registro das decisões relevantes. Cada decisão tem contexto, decisão, alternativas e consequências.

---

## ADR-001 — Stack principal

**Status:** Aceita (2026-09-18)

### Contexto

CRM interno da Trilha Finance. Empresa nova, poucos usuários (time interno), < 30 leads no início.
Roadmap inclui WhatsApp, e-mail, automações e workflows. Requisito: custo zero ou próximo de zero,
código modular e fácil de evoluir por humanos e agentes de IA.

### Decisão

| Camada | Escolha | Motivo |
|---|---|---|
| Linguagem | TypeScript (strict) | Um só idioma no front e no back, tipos ponta a ponta |
| Framework | Next.js (App Router) | UI + backend (Server Actions / Route Handlers) em um único app, sem API separada no MVP |
| Banco | PostgreSQL | Relacional, ideal para CRM (leads ↔ clientes ↔ usuários ↔ atividades), padrão de mercado, grátis |
| ORM | Drizzle | Schema em TypeScript, migrations SQL explícitas, leve, sem engine binária |
| Auth | Better Auth | Open source, dados no nosso Postgres, sem limite de usuários, sem vendor lock-in |
| Validação | Zod | Mesmo schema valida formulário e servidor |
| UI | Tailwind CSS + shadcn/ui | Componentes copiados para o repo (sem dependência opaca), acessíveis |
| Testes | Vitest (unit/integração) + Playwright (E2E, a partir das features) | Rápidos, padrão do ecossistema |
| Dev local | Docker Compose (Postgres) | Ambiente reprodutível, sem depender de nuvem para desenvolver |
| Pacotes | pnpm | Rápido, lockfile determinístico |

### Alternativas avaliadas

- **Firebase (Firestore):** rejeitado. NoSQL é ruim para dados relacionais de CRM (joins, relatórios,
  integridade referencial), consultas limitadas e lock-in forte no Google.
- **Supabase (tudo-em-um):** bom, mas o plano grátis pausa o projeto após inatividade e acopla auth/RLS
  à plataforma. Pode ser usado apenas como **host do Postgres** se quisermos.
- **API separada (NestJS/Hono) + SPA:** mais peças para manter sem ganho real no tamanho atual.
  Revisitar quando workflows/WhatsApp exigirem workers dedicados (ver ADR-004).
- **GraphQL (como o Twenty):** sem justificativa arquitetural no MVP; Server Actions + serviços tipados bastam.

### Consequências

- Monólito modular em um único deploy.
- Toda regra de negócio e autorização fica em serviços no servidor, nunca só na UI.

---

## ADR-002 — Monólito modular inspirado no Twenty

**Status:** Aceita (2026-09-18)

### Decisão

Cada domínio de negócio é um **módulo** em `src/modules/<nome>/`, com estrutura fixa:

```text
src/modules/<nome>/
├── module.ts        # manifesto: id, nome, permissões, itens de navegação
├── schema.ts        # tabelas Drizzle do módulo
├── validators.ts    # schemas Zod de entrada
├── service.ts       # regras de negócio + autorização (única porta de acesso ao banco)
├── actions.ts       # Server Actions finas (chamam o service)
├── components/      # UI do módulo
└── __tests__/       # testes do módulo
```

- `src/core/` contém infraestrutura compartilhada (db, auth, rbac, ui, utilidades).
- `src/modules/registry.ts` registra os manifestos; permissões e navegação são derivadas dele.
- **Regra de dependência:** módulos dependem de `core`; um módulo só usa outro através do `service`
  exportado dele (nunca importa tabelas/componentes internos de outro módulo diretamente).
- Novos módulos são criados pela skill `.claude/skills/new-module` para manter o padrão.

### Consequências

- Adicionar um domínio (atividades, WhatsApp, workflows) = adicionar uma pasta + registrar.
- Se um dia for preciso, um módulo pode virar pacote de monorepo sem reescrita.

---

## ADR-003 — Modelo de papéis (RBAC)

**Status:** Proposta (aguardando validação do dono do produto)

### Decisão

Quatro papéis fixos, permissões por ação (`<recurso>:<ação>`) definidas em código:

| Papel | Para quem | Resumo |
|---|---|---|
| `admin` | Sócios / dono | Tudo, inclusive gestão de usuários, papéis e configurações |
| `manager` | Gestor comercial | Vê e edita todos os leads/clientes, reatribui responsável, exclui |
| `sales` | Comercial / assessor | Vê todos os leads/clientes, cria, edita apenas os que é responsável |
| `viewer` | Sócio investidor, estagiário, auditor | Somente leitura |

Regras:

- **Deny by default:** sem permissão explícita, acesso negado.
- **Checagem no servidor** em toda operação do `service` (a UI apenas esconde botões).
- **Escopo por dono** (`sales` só edita o que é responsável) é verificado no service, não na query do cliente.
- Sem cadastro público: usuários são criados por um `admin`. O primeiro admin é criado por script de seed.
- Papéis customizáveis (tabela de roles/permissões editável) ficam no roadmap, se o time crescer.

---

## ADR-004 — Hospedagem e jobs em background

**Status:** Adiada para a Entrega de Deploy

Opções mapeadas:

- **Vercel + Neon (Postgres grátis):** melhor experiência com Next.js. Atenção: o plano Hobby da Vercel é
  **somente para uso não comercial**; uso por empresa exige o plano Pro.
- **Cloudflare Workers (via OpenNext) + Neon:** plano grátis permite uso comercial; um pouco mais de configuração.
- **VPS + Docker:** mais barato em escala, mais manutenção.

Jobs/workflows (WhatsApp, e-mail, automações) serão decididos na entrega correspondente
(candidatos: fila baseada em Postgres, Vercel Workflow/Queues, Cloudflare Queues/Workflows).

O código é mantido **agnóstico de plataforma** até lá (sem APIs específicas de provedor).
