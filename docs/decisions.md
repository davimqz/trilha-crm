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

**Status:** Aceita (2026-09-18, aprovada pelo dono do produto)

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

---

## ADR-005 — Autenticação com Better Auth, sem o plugin admin

**Status:** Aceita (2026-09-18)

### Contexto

O plugin `admin` do Better Auth traz papéis próprios e expõe muitos endpoints HTTP (impersonação, remoção de
usuário, troca de senha de terceiros, listagem). Isso criaria duas fontes de verdade para permissões e
aumentaria a superfície de ataque.

### Decisão

- Better Auth apenas para identidade e sessão (e-mail/senha, cookies, rate limit).
- `role` e `active` são campos adicionais do usuário com `input: false` (nunca aceitos do cliente).
- Gestão de usuários (criar, papel, ativar/desativar, redefinir senha) só pelo service do módulo `users`,
  que aplica o nosso RBAC e usa o `internalAdapter` do Better Auth.
- Hook `session.create.before` bloqueia login de usuário inativo; desativar apaga as sessões existentes.
- Endpoints não usados ficam em `disabledPaths` (cadastro, update-user, reset de senha por e-mail etc.).
- Rate limit com armazenamento em banco (funciona com múltiplas instâncias/serverless).
- Login e troca de senha passam pelo endpoint HTTP (`/api/auth/*`) para que o rate limit se aplique;
  chamadas `auth.api.*` diretas no servidor não passam pelo rate limit.
- Telemetria desativada.

### Consequências

- Recuperação de senha por e-mail fica para quando houver integração de e-mail; até lá o admin redefine.
- O papel e o status são lidos do banco a cada request (sem cache de sessão em cookie): mudanças valem na hora.

---

## ADR-006 — Armazenamento de anexos no Postgres

**Status:** Aceita (2026-09-18)

### Contexto

Leads precisam de anexos (PDF, DOC, planilhas, imagens). A hospedagem ainda não foi decidida (ADR-004) e o volume
é pequeno (< 30 leads, poucos arquivos).

### Decisão

- Conteúdo em tabela própria (`lead_attachment_contents`, coluna `bytea`), separada dos metadados, para que
  listagens nunca carreguem os arquivos.
- Acesso concentrado no service do módulo (`addAttachment`, `getAttachmentFile`, `removeAttachment`). Uma interface
  `AttachmentStorage` será extraída quando existir um segundo backend (tech debt registrado).
- Limites: 10 MB por arquivo, 20 anexos por lead, tipos em lista permitida, validados pelo **conteúdo**.
- Download por route handler autenticado, sempre como `attachment` e com `nosniff` + `CSP: sandbox` + `X-Frame-Options: DENY`.
- Pré-visualização (`/preview`) só para PDF, PNG/JPG e TXT/CSV: `inline`, `X-Frame-Options: SAMEORIGIN` e
  `CSP frame-ancestors 'self'` (exibível só dentro do CRM). Imagem e texto com `sandbox`; texto sempre `text/plain`.
  PDF sem `sandbox`, porque o visualizador de PDF do Chrome não abre sob CSP sandbox.
  DOC/DOCX/XLS/XLSX não têm pré-visualização: exigiria serviço externo de terceiros (exposição de dados).

### Alternativas

- **Vercel Blob / S3 / R2:** melhores para volume, mas dependem da hospedagem. Como o acesso está concentrado no service, a migração é localizada.
- **Disco local:** não funciona em serverless e complica backups.

### Consequências

- Backups do banco incluem os anexos. Revisar quando o volume passar de ~1 GB.

---

## ADR-007 — Anotações em rich text (Tiptap) guardadas como JSON

**Status:** Aceita (2026-09-18)

### Decisão

- Editor Tiptap 3 com apenas: parágrafo, negrito, sublinhado, cor (paleta fixa), lista com marcadores e numerada, quebra de linha.
  Links, imagens, HTML e demais extensões desativados.
- Conteúdo salvo como **JSON do ProseMirror**, validado no servidor por schema Zod estrito (nós, marcas e cores permitidos;
  profundidade e tamanho limitados).
- Renderização por um componente React próprio que só conhece os nós permitidos (sem `dangerouslySetInnerHTML`).

### Consequências

- Não há como injetar HTML/estilos arbitrários: XSS armazenado fica estruturalmente impossível nesse campo.
- Novos recursos de formatação exigem atualizar schema e renderizador juntos (com teste).

---

## ADR-008 — Clientes como extensão de Leads + registro de eventos

**Status:** Aceita (2026-09-19)

### Contexto

Cliente não é cadastrado manualmente: nasce da conversão de um lead e compartilha dados, anotações e anexos com ele.
O dono do produto pediu uma linha do tempo com todo o histórico (quando virou lead, cada mudança de coluna, com dia e hora).

### Decisão

- **Uma pessoa, dois papéis:** a tabela `clients` referencia o lead (`lead_id` único). Nome, e-mail, telefone e responsável
  ficam só no lead (fonte única); o cliente guarda status associativo, datas de conversão e arquivamento.
- **Dependência explícita entre módulos (exceção ao ADR-002):** `clients` é extensão de `leads` e pode ler/escrever as tabelas
  de leads dentro das regras de permissão de leads. `leads` chama `syncClientForStatusChange` (de `clients`) **na mesma transação**
  da mudança de status. A composição da linha do tempo acontece na camada de página (dados de cada módulo + função pura).
- **Registro de eventos:** tabela `lead_events` (tipo, valor anterior, valor novo, autor, data) gravada na mesma transação de cada
  ação. Anotações, anexos e atendimentos entram na linha do tempo a partir das próprias tabelas (sem duplicar).
- Migração faz backfill: evento "created" para leads existentes e clientes para leads já convertidos.

### Consequências

- Histórico auditável daqui para frente (também serve de base para o "log de auditoria" do roadmap).
- Excluir lead convertido é bloqueado (a exclusão apagaria o cliente em cascata).
