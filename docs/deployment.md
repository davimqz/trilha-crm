# Deploy

**No ar:** https://trilha-crm.netlify.app · Projeto Netlify `trilha-crm` · Projeto Neon `trilha-crm` (AWS US East 2, Postgres 18, plano Free).
Publicado em 2026-09-19.

Produção: **Netlify Free** (app Next.js) + **Neon Free** (Postgres). Custo zero, uso comercial permitido. Decisão: ADR-004.

## Limites do plano gratuito (e o que fazemos com eles)

| Limite | Valor | Impacto / mitigação |
|---|---|---|
| Créditos Netlify | 300/mês; **cada deploy de produção = 15** (≈ 20 deploys/mês) | Deploy só no merge da `main`; previews desativados. Ao esgotar, o site **pausa** até o próximo ciclo |
| Corpo da requisição (funções) | 6 MB; binário vira base64 (≈ 4,5 MB úteis) | **Anexos limitados a 4 MB** |
| Tempo de função | 60 s | Nenhuma operação chega perto |
| Região das funções | Ohio (`cmh`), fixa no Free | Criar o Neon em **AWS US East 2 (Ohio)** para ficar ao lado |
| Armazenamento Neon | 0,5 GB por projeto (anexos ficam no banco — ADR-006) | Workflow de backup alerta acima de 400 MB |
| Computação Neon | 100 CU-hora/mês; hiberna após 5 min sem uso | Monitor de uptime usa `/api/health/live` (não acorda o banco). A primeira requisição depois de hibernar demora ~1 s a mais |
| Histórico Neon (PITR) | 6 horas | Backup diário próprio (abaixo) |

## Variáveis de ambiente (Netlify → Project configuration → Environment variables)

| Variável | Valor | Escopo |
|---|---|---|
| `DATABASE_URL` | URL **com `-pooler`** do Neon (app) | Builds + Functions |
| `DATABASE_URL_UNPOOLED` | URL **direta** (sem `-pooler`) do Neon (migrations no build) | Builds |
| `BETTER_AUTH_SECRET` | 32+ caracteres aleatórios (gere com o comando do `.env.example`) — **marcar como secreto** | Builds + Functions |
| `BETTER_AUTH_URL` | `https://<seu-site>.netlify.app` (sem barra no fim) | Builds + Functions |
| `AUTH_IP_HEADER` | `x-nf-client-connection-ip` | Builds + Functions |

`AUTH_IP_HEADER` é obrigatória em produção: é o IP gravado pela própria Netlify, então forjar `X-Forwarded-For` não fura o limite de login.

## Primeiro deploy (passo a passo)

1. **Neon** → *New project* → Postgres 17, região **AWS US East 2 (Ohio)**. Em *Connect*, copie as duas URLs:
   com *Connection pooling* ligado (`...-pooler...`) e desligado.
2. **Netlify** → *Add new project* → *Import an existing project* → GitHub → `trilha-crm`. Build command e publish vêm do `netlify.toml`.
   Antes de publicar, cadastre as variáveis da tabela acima.
3. **Netlify** → *Developer settings → Branches and deploy contexts*: *Deploy Previews* = **Don't deploy pull requests**; *Branch deploys* = **None**.
   Em *General → Project visibility*, escolha **Public** (o projeto nasce privado, exigindo login da Netlify para abrir o site).
4. Faça o deploy. O build roda as migrations (`pnpm db:migrate`) e depois o `next build`.
5. **Primeiro administrador** (na sua máquina, uma única vez):

   ```bash
   DATABASE_URL="<url direta do Neon>" BETTER_AUTH_SECRET="<mesmo segredo da Netlify>" \
   BETTER_AUTH_URL="https://<seu-site>.netlify.app" \
   ADMIN_NAME="Seu Nome" ADMIN_EMAIL="voce@empresa.com" pnpm auth:create-admin
   ```

   A senha gerada aparece uma vez; entre e troque em “Alterar minha senha”.
6. Conferir: `https://<seu-site>.netlify.app/api/health` → `{"status":"ok"}`.

## Deploys seguintes

Merge na `main` → deploy automático (migrations incluídas). Commits que só mexem em `.md` não geram deploy (regra `ignore` no `netlify.toml`). Migrations devem ser **aditivas**: se o build falhar depois
da migration, o site antigo continua no ar com o banco novo. Agrupe mudanças: cada deploy consome 15 créditos.

## Backup e restauração

Workflow `.github/workflows/backup.yml`: todo dia às 03:00 (Brasília) faz `pg_dump`, criptografa com AES-256 e guarda como
artifact privado do repositório por 14 dias. Também mede o tamanho do banco e falha acima de 400 MB (o GitHub avisa por e-mail).

Configurado em 2026-09-19 e testado com uma execução manual (dump de 34 KB). **Guarde a `BACKUP_PASSPHRASE` num cofre de senhas: sem ela o backup é ilegível.**

Ativação (GitHub → repositório → *Settings → Secrets and variables → Actions*):

- Secret `PROD_DATABASE_URL_UNPOOLED` = URL direta do Neon
- Secret `BACKUP_PASSPHRASE` = frase longa e aleatória — **guarde num cofre de senhas**; sem ela o backup é ilegível
- Variable `BACKUP_ENABLED` = `true`

Teste manual: *Actions → Backup do banco → Run workflow*.

Restaurar (num banco vazio, ex.: branch nova do Neon):

```bash
gpg --decrypt --output backup.dump trilha-crm-AAAA-MM-DD.dump.gpg
pg_restore --no-owner --no-privileges -d "<url direta do banco de destino>" backup.dump
```

Use `pg_restore` da mesma versão do servidor ou mais nova (ex.: `docker run --rm -v "$PWD:/b" postgres:18-alpine pg_restore ...`).
Para erros recentes (até 6 h), o *Restore* do próprio Neon é mais rápido. Procedimento testado localmente em 2026-09-19
(dump → criptografia → restauração em banco vazio).

## Monitoramento

- Uptime (opcional, grátis): UptimeRobot a cada 5 min em `/api/health/live` — **não** use `/api/health`, que acorda o banco e gasta a cota.
- Erros: *Netlify → Logs → Functions*. Erros inesperados são registrados com o prefixo do módulo (ex.: `[leads/attachments]`).
- Uso: painel de créditos da Netlify e de armazenamento/computação do Neon.

## Desenvolvimento local

Nada muda: `pnpm db:up` + `pnpm dev`. `DATABASE_URL_UNPOOLED` e `AUTH_IP_HEADER` são opcionais fora de produção.
