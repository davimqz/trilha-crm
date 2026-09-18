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
| CSP com `'unsafe-inline'` em scripts | Guia oficial do Next para apps sem nonce; mitigação completa exige CSP com nonce (renderização dinâmica) | Entrega 05 (Hardening) |
| GHSA-67mh-4wv8-2f99 (moderado) no `esbuild` antigo usado pelo `drizzle-kit` (aparece em `--prod` porque o `better-auth` declara o `drizzle-kit`) | Só afeta o servidor de desenvolvimento do esbuild, que não usamos; ferramenta de dev, fora do bundle de produção | Quando o drizzle-kit atualizar a dependência |
| `/api/health` público | Retorna apenas `ok`/`error`; útil para monitoramento. Rate limiting na plataforma de deploy | Entrega 05 |
| **Rate limit por IP contornável com `X-Forwarded-For` forjado** se o servidor for exposto diretamente (sem proxy que sobrescreva o header) | Na Vercel o header é definido pela plataforma. Em VPS: proxy reverso + `advanced.ipAddress.trustedProxies`. Mitigação completa: limite por conta (e-mail), independente de IP | **Entrega 05 — obrigatório antes do deploy** |
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
| Anexos: tipo confirmado pelo conteúdo (assinatura) + extensão; 10 MB; 20 por lead; nome higienizado | `leads/file-types.ts`, `leads/service.ts` |
| Upload: mesma origem (`Origin` + `Sec-Fetch-Site`), sessão, `Content-Length` checado antes de ler o corpo | `leads/http.ts` |
| Download: `attachment`, MIME da allowlist, `nosniff`, CSP `default-src 'none'; sandbox`, `no-store` | `leads/http.ts`, `next.config.ts` |
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
| Upload: HTML como `.pdf`, `.html`, `.svg`, executável renomeado, ZIP qualquer como `.docx`, vazio, > 10 MB, 21º anexo, nome `../../` | ✅ recusados/higienizados |
| Upload sem sessão (401), de outra origem (403), acima do limite (413) | ✅ |
| Download sem sessão (401); anexo pedido por outro lead (404); headers seguros | ✅ |
| Busca com `%` e `_` | ✅ tratados como texto |
| Exclusão em cascata (anotações, anexos, conteúdos) | ✅ |

Achados corrigidos durante a entrega:
- **CSP do download sobrescrita pela CSP global** do `next.config.ts` (o `sandbox` não chegava ao navegador) → regra por rota.
- **Tipos `never[]` em queries com dois aliases de `users`** (Drizzle 0.45) desligavam a checagem de tipos → nomes por subconsulta.

Validação por mutação: desligar a checagem de posse faz os testes de IDOR falharem.

Security review do diff completo da branch: nenhuma vulnerabilidade de alta confiança.

## Roadmap de segurança

- Entrega 05: limite de tentativas de login por conta (independente de IP) e `trustedProxies` conforme a hospedagem.
- CSP com nonce.
- Log de auditoria de alterações.
- **LGPD / dados sensíveis** (antes de armazenar CPF, dados financeiros ou patrimoniais): base legal e consentimento,
  criptografia de colunas sensíveis, mascaramento na UI, retenção e exclusão, direitos do titular, registro de acesso.
- 2FA.
