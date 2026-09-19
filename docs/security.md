# Segurança

## Princípios

- Todo código (inclusive gerado por IA) é considerado inseguro até ser revisado e testado.
- Autorização no servidor, deny by default, checagem de posse (IDOR) em todo acesso por id.
- Validação de entrada no servidor com Zod e limites de tamanho.
- Segredos só em variáveis de ambiente; nunca em código, logs ou respostas.
- Mensagens de erro para o cliente são genéricas; detalhes apenas no log do servidor.

## Controles atuais (Entrega 01)

| Controle | Onde |
|---|---|
| CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS | `next.config.ts` |
| `X-Powered-By` desativado | `next.config.ts` |
| Health check sem detalhes internos e sem cache | `src/app/api/health/route.ts` |
| Validação de env sem expor valores | `src/core/env.ts` |
| Postgres local exposto só em 127.0.0.1 | `docker-compose.yml` |
| `.env` ignorado pelo Git | `.gitignore` |
| CI com permissões mínimas (`contents: read`) e auditoria de dependências | `.github/workflows/ci.yml` |

## Controles atuais (Entrega 02 — Auth e RBAC)

| Controle | Onde |
|---|---|
| Allowlist de endpoints do Better Auth (4 rotas, match exato) + `disabledPaths` | `src/core/auth/allowed-routes.ts`, `create-auth.ts` |
| POST de auth só com `application/json` (bloqueia form cross-site) | `allowed-routes.ts` |
| Checagem de Origin/CSRF forçada em todos os ambientes (a lib desliga em teste por padrão) | `create-auth.ts` |
| Cadastro público desativado; `role`/`active` com `input: false` | `create-auth.ts` |
| Rate limit em banco: login e troca de senha 5/min por IP | `create-auth.ts` |
| Senha 12–128 caracteres, hash scrypt (Better Auth) | `password-policy.ts` |
| Cookies `HttpOnly`, `SameSite=Lax`, `Secure` em produção | Better Auth |
| Papel e status relidos do banco a cada request (sem cache em cookie) | `src/core/auth/session.ts` |
| Usuário inativo não cria sessão; desativar/redefinir senha apaga sessões | `create-auth.ts`, `users/service.ts` |
| RBAC deny-by-default, permissão desconhecida falha alto | `src/core/rbac/authorization.ts` |
| Toda action exige sessão; todo service exige permissão e revalida o ator no banco com lock de linha | `users/actions.ts`, `users/service.ts` |
| Autoalteração (papel/desativação) proibida → sempre existe um admin ativo | `users/service.ts` |
| Entrada tratada como `unknown` e validada com Zod `strictObject` (sem mass assignment) | `users/validators.ts` |
| `CHECK` no banco restringindo `role` aos papéis válidos | `drizzle/0000_auth.sql` |
| Erros ao cliente só com mensagens seguras; demais vão para o log | `src/core/actions/action-result.ts` |
| Telemetria do Better Auth desativada | `create-auth.ts` |

## Riscos aceitos

| Risco | Justificativa | Revisar em |
|---|---|---|
| CSP com `'unsafe-inline'` em scripts | Guia oficial do Next para apps sem nonce; nonce exige renderização dinâmica em todas as páginas. React escapa conteúdo e o texto rico não aceita HTML (ADR-007) | Tech debt (após o deploy) |
| GHSA-67mh-4wv8-2f99 (moderado) no `esbuild` antigo usado pelo `drizzle-kit` (aparece em `--prod` porque o `better-auth` declara o `drizzle-kit`) | Só afeta o servidor de desenvolvimento do esbuild, que não usamos; ferramenta de dev, fora do bundle de produção | Quando o drizzle-kit atualizar a dependência |
| `/api/health` e `/api/health/live` públicos | Retornam apenas `ok`/`error`, sem versão nem detalhes; `/live` não toca o banco | — |
| ~~Rate limit por IP contornável com `X-Forwarded-For` forjado~~ | **Resolvido na Entrega 05:** IP vem de `AUTH_IP_HEADER` (Netlify: `x-nf-client-connection-ip`, obrigatório em produção) + limite por conta | — |
| Bloqueio temporário de conta: quem sabe o e-mail de alguém pode travar o login dessa pessoa por até 15 min (10 tentativas) | Troca consciente para impedir força bruta distribuída. Uso interno, poucos usuários; o bloqueio expira sozinho | Se houver abuso: CAPTCHA ou 2FA |
| Usuário inativo com a senha correta recebe `403` (diferente do `401`) | Exige conhecer a senha; a UI mostra mensagem genérica | — |
| Sessão dura até 7 dias no cookie mesmo com renovação no banco | Sessão é revalidada no banco a cada request; revogação é imediata | — |

## Pentest — Entrega 01

| Teste | Resultado |
|---|---|
| Headers de segurança presentes na resposta | ✅ |
| Health com banco fora do ar: 503 genérico, sem stack/host/versão | ✅ (resposta em ~20 ms) |
| Recuperação automática quando o banco volta | ✅ |
| Env inválida não vaza o valor na mensagem de erro | ✅ (teste automatizado) |
| Porta do Postgres não exposta na rede (bind 127.0.0.1) | ✅ |
| Dependências de produção sem vulnerabilidades conhecidas | ✅ (`pnpm audit --prod`) |

## Pentest — Entrega 02

Automatizado (`src/core/auth/auth-http.integration.test.ts`, `src/modules/users/__tests__/`, `e2e/`):

| Teste | Resultado |
|---|---|
| Cadastro público (`/sign-up/email`) | ✅ 404, nenhum usuário criado |
| Autopromoção via `/update-user` com `role: admin` | ✅ 404, papel inalterado |
| Variações de caminho (`/x/`, `//x`, `%2F`, maiúsculas, `../`) | ✅ 404 |
| Enumeração de usuários no login | ✅ resposta idêntica para e-mail inexistente e senha errada |
| Brute force (6 tentativas/min do mesmo IP) | ✅ 429, inclusive com a senha correta |
| CSRF: Origin de outro site, navegação cross-site, form-urlencoded, cookie da vítima + Origin do atacante | ✅ 403/415 |
| Cookie de sessão | ✅ HttpOnly + SameSite=Lax |
| Troca de senha sem sessão / com senha atual errada | ✅ recusada |
| Não-admin em cada operação de usuários (manager, sales, viewer) | ✅ ForbiddenError |
| Admin rebaixado/desativado usando objeto de sessão antigo | ✅ bloqueado (revalidação no banco) |
| Alteração concorrente entre dois admins | ✅ serializada por lock; sempre sobra um admin |
| Viewer reproduzindo a Server Action de criar usuário capturada do admin | ✅ "sem permissão", nada criado |
| Mass assignment (`active`, `id`, `emailVerified` no payload) | ✅ rejeitado |

Validação dos testes por mutação: remover o lock, a revalidação do ator ou a exclusão de sessões faz os testes falharem.

Security review do diff completo da branch: nenhuma vulnerabilidade de alta confiança.

## Controles atuais (Entrega 03 — Leads)

| Controle | Onde |
|---|---|
| Permissões por ação + posse (`update`/`archive` só no próprio lead para `sales`; `*-any` para admin/manager) | `leads/module.ts`, `leads/service.ts` |
| Lock de linha + checagem de posse com dados do banco em toda escrita | `leads/service.ts` |
| Anotações em JSON validado por schema estrito; renderização sem `dangerouslySetInnerHTML`; cor só da paleta | `leads/rich-text.ts`, `rich-text-view.tsx` |
| Anexos: tipo confirmado pelo conteúdo (assinatura) + extensão; 4 MB (10 MB até a Entrega 05); 20 por lead; nome higienizado | `leads/file-types.ts`, `leads/service.ts` |
| Upload: mesma origem (`Origin` + `Sec-Fetch-Site`), sessão, `Content-Length` checado antes de ler o corpo | `leads/http.ts` |
| Download: `attachment`, MIME da allowlist, `nosniff`, CSP `default-src 'none'; sandbox`, `X-Frame-Options: DENY`, `no-store` | `leads/http.ts`, `next.config.ts` |
| Pré-visualização: só PDF/imagem/texto; `inline`; `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'`; `sandbox` em imagem/texto; texto sempre `text/plain`; Office recusado (415) | `leads/http.ts`, `next.config.ts` |
| Busca com `%`/`_` literais; ordenação/período por enum | `leads/service.ts` |
| Parâmetros da URL validados com fallback seguro | `app/(app)/leads/page.tsx` |

## Pentest — Entrega 03

Automatizado (`src/modules/leads/__tests__/`, `e2e/leads.spec.ts`):

| Teste | Resultado |
|---|---|
| `sales` alterando/movendo/arquivando/anotando/anexando em lead de outro (IDOR) | ✅ ForbiddenError |
| `sales` reproduzindo a Server Action de mover com o id do lead do admin | ✅ bloqueado, lead inalterado |
| `viewer` em qualquer escrita (service, UI e endpoint de upload) | ✅ bloqueado |
| Reatribuição de responsável sem `leads:assign` / para usuário inativo | ✅ bloqueada |
| Mass assignment (`ownerId`, `archivedAt`) | ✅ rejeitado |
| XSS em anotação: HTML/script digitado, atributos `style`/`onclick` injetados, cor com CSS | ✅ texto puro; atributos descartados; nenhum script executa |
| Upload: HTML como `.pdf`, `.html`, `.svg`, executável renomeado, ZIP qualquer como `.docx`, vazio, > 10 MB (hoje > 4 MB), 21º anexo, nome `../../` | ✅ recusados/higienizados |
| Upload sem sessão (401), de outra origem (403), acima do limite (413) | ✅ |
| Download sem sessão (401); anexo pedido por outro lead (404); headers seguros | ✅ |
| Busca com `%` e `_` | ✅ tratados como texto |
| Pré-visualização: sem sessão (401), headers (`inline`, `SAMEORIGIN`, `frame-ancestors 'self'`, `nosniff`), CSV com HTML servido como `text/plain` + `sandbox`, DOCX → 415 | ✅ |
| Páginas do app continuam com CSP global e `X-Frame-Options: DENY` após as regras por rota | ✅ |
| Exclusão em cascata (anotações, anexos, conteúdos) | ✅ |

Achados corrigidos durante a entrega:
- **CSP do download sobrescrita pela CSP global** do `next.config.ts` (o `sandbox` não chegava ao navegador) → regra por rota.
- **Tipos `never[]` em queries com dois aliases de `users`** (Drizzle 0.45) desligavam a checagem de tipos → nomes por subconsulta.

Validação por mutação: desligar a checagem de posse faz os testes de IDOR falharem.

Security review do diff completo da branch: nenhuma vulnerabilidade de alta confiança.

## Controles atuais (Entrega 04 — Clientes)

| Controle | Onde |
|---|---|
| Não existe criação manual de cliente: só `syncClientForStatusChange`, dentro da transação de status do lead (já autorizada) | `clients/sync.ts`, `leads/service.ts` |
| Edição de cliente: `clients:update` + posse pelo responsável do lead lido do banco, com lock das linhas; reatribuir exige `clients:assign` | `clients/service.ts` |
| Atendimentos: `clients:log-service` (sem viewer), cliente arquivado bloqueado, responsável ativo, data não futura | `clients/service.ts`, `clients/validators.ts` |
| Descrição do atendimento: mesmo schema/renderizador seguro das anotações (ADR-007) | `clients/validators.ts` |
| Linha do tempo com eventos gravados na transação da ação (`clock_timestamp()` para ordem correta) | `leads/events.ts`, `drizzle/0003_*` |
| Excluir lead convertido bloqueado (FK sem cascade + regra no service) | `leads/service.ts`, `clients/schema.ts` |
| Lead arquivado não muda de status por nenhum caminho (kanban ou formulário) | `leads/service.ts` |

## Pentest — Entrega 04

| Teste | Resultado |
|---|---|
| Criar cliente sem conversão (não há action/rota; mass assignment de `leadId`/`archivedAt`) | ✅ impossível / ZodError |
| Sales editando cliente de outro responsável; viewer editando | ✅ ForbiddenError |
| Reatribuir sem `clients:assign` | ✅ ForbiddenError |
| Atendimento: viewer, data futura, tipo inválido, responsável inativo, cliente arquivado | ✅ recusado |
| XSS na descrição do atendimento (nós HTML, `style`/`onclick`) | ✅ recusado/limpo |
| Excluir lead convertido (mesmo como admin) | ✅ bloqueado, nada apagado |
| Conversão/reversão/reativação consistentes (mesmo cliente, histórico intacto) | ✅ |
| Lead arquivado convertendo pelo formulário (achado da security review) | ✅ corrigido: bloqueado |

Validação por mutação: remover a checagem de posse do cliente ou a sincronização lead → cliente faz os testes falharem.
Security review do diff: nenhuma vulnerabilidade de alta confiança.

## Edição/exclusão de anotações e atendimentos (2026-09-19)

| Controle / teste | Resultado |
|---|---|
| Só autor (com permissão de escrita) ou gestor/admin (`*-any`) edita/exclui; regra revalidada no servidor com lock da linha | ✅ outro comercial e viewer → ForbiddenError |
| IDOR: `noteId`/`recordId` sempre buscados junto com `leadId`/`clientId` | ✅ id de outro lead/cliente → NotFound |
| Conteúdo editado passa pelo mesmo schema estrito (ADR-007); campos extras (`authorId`) recusados | ✅ ZodError |
| Rastro: edição e exclusão viram eventos na linha do tempo (exclusão guarda trecho/assunto) | ✅ |

Validação por mutação: liberar a regra de autor faz os testes falharem.

## Entrega 05 — Hardening para o deploy (2026-09-19)

| Controle / teste | Resultado |
|---|---|
| IP do cliente vem só do cabeçalho da plataforma (`AUTH_IP_HEADER`, obrigatório em produção); `X-Forwarded-For` forjado ignorado | ✅ 6ª tentativa com XFF diferente a cada vez → 429 |
| Limite por conta: 10 tentativas / 15 min, mesmo de IPs diferentes e mesmo com a senha certa | ✅ 11ª → 429, sem cookie de sessão |
| Contador atômico (`insert … on conflict … returning`) | ✅ 20 tentativas em paralelo → exatamente 10 × 401 e 10 × 429 |
| E-mail normalizado (maiúsculas/espaços) e guardado só como SHA-256 | ✅ |
| Conta inexistente bloqueia igual (não revela quais e-mails existem) | ✅ |
| Login com sucesso zera o contador; outras contas não são afetadas | ✅ |
| Backup: dump criptografado (AES-256) antes de sair do runner; segredo via variável, nunca em argumento; workflow sem gatilho de PR | ✅ revisado |
| Previews/branch deploys bloqueados no `netlify.toml` (não tocam o banco de produção) | ✅ |
| Health checks sem detalhes internos e sem cache | ✅ E2E |

Validação por mutação: afrouxar o limite, não zerar o contador após sucesso ou ignorar o cabeçalho confiável faz os testes falharem.
Security review do diff: nenhuma vulnerabilidade de alta confiança. Pentest no ambiente publicado: pendente (após o primeiro deploy).

## Pentest em produção — https://trilha-crm.netlify.app (2026-09-19)

| Teste | Resultado |
|---|---|
| 7 logins errados trocando `X-Forwarded-For` a cada tentativa | ✅ 401×5 e depois 429 — o IP forjado é ignorado (vale o `x-nf-client-connection-ip`) |
| Cabeçalhos da página de login (CSP, HSTS, XFO, nosniff, Referrer-Policy, Permissions-Policy) | ✅ todos presentes |
| `POST /api/auth/sign-up/email` (fora da allowlist) | ✅ 404 |
| Login em `application/x-www-form-urlencoded` | ✅ 415 |
| `/leads` sem sessão | ✅ 307 para `/login` |
| Cookie de sessão | ✅ `__Secure-` + `HttpOnly` + `Secure` + `SameSite=Lax` |
| Login com `Origin` de outro site | ✅ 403 |
| Upload de anexo com `Origin` de outro site | ✅ 403 |
| Backup diário criptografado | ✅ execução manual concluída; artifact privado com 14 dias de retenção |

## Roadmap de segurança

- ~~Limite de login por conta e IP confiável conforme a hospedagem~~ — feito na Entrega 05.
- CSP com nonce.
- Log de auditoria de alterações.
- **LGPD / dados sensíveis** (antes de armazenar CPF, dados financeiros ou patrimoniais): base legal e consentimento,
  criptografia de colunas sensíveis, mascaramento na UI, retenção e exclusão, direitos do titular, registro de acesso.
- 2FA.
