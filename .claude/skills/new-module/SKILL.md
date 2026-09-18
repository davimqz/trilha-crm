---
name: new-module
description: Cria um novo módulo de negócio no Trilha CRM (ex.: leads, clientes, atividades, whatsapp) seguindo a arquitetura modular do ADR-002 — manifesto, schema Drizzle, validação Zod, service com autorização, server actions, UI, testes, migration, registro e documentação. Use sempre que for adicionar um novo domínio/objeto/entidade ao CRM ou quando o usuário pedir "novo módulo", "adicionar X ao CRM", "criar cadastro de X".
---

# Criar um módulo no Trilha CRM

Um módulo é uma pasta autocontida em `src/modules/<id>/`. Siga os passos **na ordem**, sem pular QA e segurança.
Leia antes: `docs/architecture.md` e `docs/decisions.md` (ADR-002 e ADR-003).

## 0. Pré-requisitos (metodologia)

1. A especificação do módulo está definida no `tasks.md` (campos, regras, papéis, critérios de aceitação).
   Se não estiver, **pare e peça ao dono do produto**. Não invente campos de negócio.
2. Branch própria: `git switch -c feature/<id>` a partir da `main` atualizada.
3. Escreva primeiro os critérios de QA e os casos de segurança no `tasks.md`.

## 1. Estrutura

```text
src/modules/<id>/
├── module.ts          # manifesto (defineModule)
├── schema.ts          # tabelas Drizzle
├── validators.ts      # schemas Zod de entrada
├── service.ts         # regras de negócio + autorização — única porta para o banco
├── actions.ts         # Server Actions finas ("use server") que chamam o service
├── components/        # UI do módulo
└── __tests__/         # *.test.ts (unit) e *.integration.test.ts (Postgres real)
```

Rotas ficam em `src/app/(app)/<rota>/` e só compõem componentes do módulo e chamam actions/service.

## 2. Manifesto — `module.ts`

```ts
import { defineModule } from "@/core/modules/types";

export const exemploModule = defineModule({
  id: "exemplo",                 // kebab-case, único
  name: "Exemplos",
  permissions: {
    read:   { description: "Ver exemplos",     roles: ["admin", "manager", "sales", "viewer"] },
    create: { description: "Criar exemplos",   roles: ["admin", "manager", "sales"] },
    update: { description: "Editar exemplos",  roles: ["admin", "manager", "sales"] },
    delete: { description: "Excluir exemplos", roles: ["admin", "manager"] },
  },
  navigation: [{ label: "Exemplos", href: "/exemplos", permission: "read" }],
});
```

Regras (validadas por `src/modules/registry.test.ts`):
- `admin` em todas as permissões; demais papéis seguem o ADR-003.
- Ações em kebab-case. Permissão final = `<id>:<ação>`.
- Escopo por dono (ex.: `sales` só edita os seus) **não** é permissão do manifesto; é regra do service.

## 3. Schema — `schema.ts`

- `id` uuid (`uuid().primaryKey().defaultRandom()`), `createdAt`/`updatedAt` com timezone.
- Nome de tabela no plural e snake_case; prefixe se houver risco de colisão.
- Referência a outro módulo só por chave estrangeira; **não** importe componentes/serviços internos dele.
- Imports **relativos** (o drizzle-kit não resolve `@/`).
- Exporte no agregador `src/core/db/schema.ts`: `export * from "../../modules/<id>/schema";`
- Gere e revise a migration: `pnpm db:generate` → leia o SQL em `drizzle/` → `pnpm db:migrate`.
  Nunca edite migrations já commitadas na `main`.

## 4. Validação — `validators.ts`

- Um schema Zod por operação (`create`, `update`, filtros). Tamanhos máximos em todo texto (`.max()`),
  `.trim()`, e-mail com `z.email()`, enums com `z.enum()`.
- Use `.strict()` / objetos explícitos: nunca aceite campos como `id`, `ownerId`, `createdAt` vindos do cliente
  (mass assignment).

## 5. Service — `service.ts`

- `import "server-only"`.
- Toda função recebe o **contexto do usuário** (sessão) e começa checando permissão
  (`requirePermission`, disponível a partir da Entrega 02). Deny by default.
- Valida a entrada com o schema Zod **no servidor**, mesmo que o formulário já valide.
- Checagens de posse (IDOR): ao buscar/alterar por id, confirme que o usuário pode acessar **aquele** registro.
- Queries só via Drizzle (parametrizadas). Nada de SQL com interpolação de string.
- Erros de domínio com mensagens seguras; não repasse erro do banco para o cliente.
- Outros módulos consomem este módulo **somente** pelas funções exportadas aqui.

## 6. Actions e UI

- `actions.ts` com `"use server"`: parse do FormData → chama o service → `revalidatePath`. Sem regra de negócio.
- Server Actions são endpoints públicos: a autorização está no service, nunca só no botão escondido.
- UI com estados de loading, vazio, erro e sucesso; labels acessíveis; texto em pt-BR.
- Antes de escrever código Next.js, leia o guia relevante em `node_modules/next/dist/docs/` (ver `AGENTS.md`).

## 7. Registro

Adicione o manifesto em `src/modules/registry.ts`:

```ts
import { exemploModule } from "./exemplo/module";
export const MODULES: readonly ModuleManifest[] = [exemploModule];
```

## 8. Testes (obrigatórios)

- **Unit** (`__tests__/validators.test.ts`): entradas válidas, limites, inválidas, campos proibidos.
- **Integração** (`__tests__/service.integration.test.ts`, banco de teste real):
  happy path; cada papel × cada ação (matriz de permissões); IDOR (usuário A acessando registro de B);
  registro inexistente; entrada inválida rejeitada no servidor.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm build`.

## 9. Segurança e pentest

Checklist mínimo antes do PR (registre o resultado no `tasks.md`):
- [ ] Toda função do service checa permissão e posse
- [ ] Entrada validada no servidor com limites de tamanho
- [ ] Sem mass assignment (campos controlados pelo servidor ignorados)
- [ ] Sem vazamento de dados na resposta (só os campos necessários)
- [ ] Nenhum `dangerouslySetInnerHTML` com dado do usuário
- [ ] Teste manual: chamar a action com usuário sem permissão / id de outro usuário / payload malformado

## 10. Documentação e Git

- Atualize `docs/repository-map.md` (nova pasta, tabelas, rotas) e o `tasks.md`.
- Commits atômicos em Conventional Commits, por exemplo:
  `feat(exemplo): add schema and migration` → `feat(exemplo): add service with authorization` →
  `feat(exemplo): add list and form pages` → `test(exemplo): add permission matrix tests` → `docs(exemplo): update repository map`.
- **Nunca** adicione trailers de co-autoria de IA nem menções a assistentes nos commits/PRs.
- Abra o PR para `main` com o template da metodologia (Objetivo, Alterações, QA, Security, Pentest, Checklist).
