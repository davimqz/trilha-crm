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

## Riscos aceitos

| Risco | Justificativa | Revisar em |
|---|---|---|
| CSP com `'unsafe-inline'` em scripts | Guia oficial do Next para apps sem nonce; mitigação completa exige CSP com nonce (renderização dinâmica) | Entrega 05 (Hardening) |
| GHSA-67mh-4wv8-2f99 (moderado) no `esbuild` antigo usado pelo `drizzle-kit` | Só afeta o servidor de desenvolvimento do esbuild, que não usamos; ferramenta de dev, fora do bundle de produção | Quando o drizzle-kit atualizar a dependência |
| `/api/health` público | Retorna apenas `ok`/`error`; útil para monitoramento. Rate limiting na plataforma de deploy | Entrega 05 |

## Pentest — Entrega 01

| Teste | Resultado |
|---|---|
| Headers de segurança presentes na resposta | ✅ |
| Health com banco fora do ar: 503 genérico, sem stack/host/versão | ✅ (resposta em ~20 ms) |
| Recuperação automática quando o banco volta | ✅ |
| Env inválida não vaza o valor na mensagem de erro | ✅ (teste automatizado) |
| Porta do Postgres não exposta na rede (bind 127.0.0.1) | ✅ |
| Dependências de produção sem vulnerabilidades conhecidas | ✅ (`pnpm audit --prod`) |

## Roadmap de segurança

- Entrega 02: sessões seguras, rate limiting no login, matriz de permissões testada, proteção contra escalada de privilégio.
- Log de auditoria de alterações.
- **LGPD / dados sensíveis** (antes de armazenar CPF, dados financeiros ou patrimoniais): base legal e consentimento,
  criptografia de colunas sensíveis, mascaramento na UI, retenção e exclusão, direitos do titular, registro de acesso.
- 2FA.
