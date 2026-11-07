# Implantação — Railway (banco incluído)

Tudo roda em **um projeto Railway** (ex.: `trila demo`). O Supabase é usado **somente para autenticação** (Supabase Auth).

| Serviço Railway | Origem | Config file | Health check |
|---|---|---|---|
| `fandom-web` | este repositório | `/apps/web/railway.json` | `/healthz` |
| `fandom-api` | este repositório | `/apps/api/railway.json` | `/health/ready` |
| `fandom-worker` | este repositório | `/apps/worker/railway.json` | `/health` |
| `fandom-redis` | template **Redis** | — | gerenciado |
| `fandom-postgres` | template **PostgreSQL** | — | gerenciado (volume persistente + backups) |

Todos os Dockerfiles usam a **raiz do repositório** como contexto (monorepo compartilhado).

---

## 1. Banco de dados — PostgreSQL na Railway

1. No projeto `trila demo`: *Create → Database → Add PostgreSQL*. Renomeie o serviço para **`fandom-postgres`**.
2. Nada mais é necessário: a API e o worker usam a **rede privada** (`fandom-postgres.railway.internal`), sem exposição pública. As migrations, as políticas e os seeds rodam automaticamente no *pre-deploy* da API.
3. Extensões usadas (`citext`, `pgcrypto`) já vêm na imagem PostgreSQL da Railway.
4. **Backups**: em `fandom-postgres → Backups`, habilite backups agendados (diário + semanal).
5. Acesso administrativo pontual (psql, DBeaver): use `DATABASE_PUBLIC_URL` do serviço, apenas da sua máquina — nunca nos serviços.

> RLS: as políticas específicas do Supabase são aplicadas apenas quando existem as roles `anon`/`authenticated`; na Railway o RLS fica habilitado em todas as tabelas e nenhum cliente externo tem acesso ao banco (somente a API, pela rede privada).

## 2. Supabase (apenas autenticação)

1. Crie um projeto em <https://supabase.com> (região São Paulo). O banco desse projeto **não** é usado.
2. **Project Settings → API**: `SUPABASE_URL` (`https://<ref>.supabase.co`) e a chave **publishable/anon** (`VITE_SUPABASE_PUBLISHABLE_KEY`). Se o projeto usa o segredo JWT HS256 legado: *JWT Settings → JWT Secret* → `SUPABASE_JWT_SECRET` (**segredo**, só na API). Com *JWT Signing Keys* assimétricas basta `SUPABASE_URL`. Nunca use a chave `service_role`.
3. **Authentication → Providers → Email**: habilite *Confirm email*.
4. **Authentication → URL Configuration**: *Site URL* = `https://<domínio do fandom-web>`; *Redirect URLs* = `https://<domínio>/auth/callback` e `https://<domínio>/reset-password` (mais `http://localhost:5173/...` para desenvolvimento).
5. **Authentication → SMTP**: configure SMTP próprio antes do lançamento.

## 3. Railway — serviços da aplicação (projeto `trila demo`)

1. *Create → GitHub Repo* → este repositório → renomeie para `fandom-api`. Em *Settings*: **Root Directory** vazio; **Railway Config File** `/apps/api/railway.json`.
2. Repita para `fandom-web` (`/apps/web/railway.json`) e `fandom-worker` (`/apps/worker/railway.json`).
3. *Create → Database → Add Redis* → renomeie para `fandom-redis`.
4. `fandom-web` e `fandom-api` → *Settings → Networking → Generate Domain*.
5. Configure as variáveis abaixo (*Variables → Raw Editor*) e faça *Deploy*.

O `railway.json` de cada serviço define builder Dockerfile, `watchPatterns` (deploy independente), health check, restart e, na API, o **pre-deploy** `migrate && seed`.

### Alternativa pela CLI (a partir da raiz do repositório)

```bash
npm i -g @railway/cli
railway login
railway link                       # escolha o workspace e o projeto "trila demo"
railway add --database postgres    # renomeie para fandom-postgres no painel
railway add --database redis       # renomeie para fandom-redis
railway add --service fandom-api
railway add --service fandom-web
railway add --service fandom-worker
# Em cada serviço de aplicação, defina "Railway Config File" no painel (passo 1–2 acima)
# e as variáveis da seção seguinte; depois:
railway up --service fandom-api
railway up --service fandom-worker
railway up --service fandom-web
```

## Variáveis por serviço

Referências `${{serviço.VAR}}` são resolvidas pela Railway.

### fandom-api
```
NODE_ENV=production
APP_ENV=production
LOG_JSON=true
DATABASE_URL=${{fandom-postgres.DATABASE_URL}}
DATABASE_SSL=disable
REDIS_URL=${{fandom-redis.REDIS_URL}}
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_JWT_SECRET=<somente se usar HS256 legado>
WEB_ORIGINS=https://${{fandom-web.RAILWAY_PUBLIC_DOMAIN}}
SUBSCRIPTION_GRACE_DAYS=3
BOOTSTRAP_SUPER_ADMIN_EMAILS=<e-mail do fundador; remova após o primeiro login>
```
> `DATABASE_URL` aponta para `fandom-postgres.railway.internal` (tráfego privado e criptografado pela rede da Railway), por isso `DATABASE_SSL=disable` é aceito em produção. Se algum dia usar a URL pública (`*.proxy.rlwy.net`), use `DATABASE_SSL=require`.

### fandom-worker
```
NODE_ENV=production
APP_ENV=production
DATABASE_URL=${{fandom-postgres.DATABASE_URL}}
DATABASE_SSL=disable
REDIS_URL=${{fandom-redis.REDIS_URL}}
SUBSCRIPTION_GRACE_DAYS=3
```

### fandom-web
```
VITE_API_URL=https://${{fandom-api.RAILWAY_PUBLIC_DOMAIN}}
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
VITE_APP_ENV=production
```
As variáveis `VITE_*` são **build args** (inlinadas no bundle) e também lidas em runtime pelo servidor para montar a Content-Security-Policy. Alterá-las exige novo deploy do web.

## 4. Ambientes (desenvolvimento · homologação · produção)

- **Desenvolvimento**: local (`.env`, `pnpm dev`).
- **Homologação**: na Railway, *Environments → New Environment → Duplicate `production`* → nome `staging` (ganha seu próprio PostgreSQL e Redis). Use um **projeto Supabase Auth separado** e `APP_ENV=staging`/`VITE_APP_ENV=staging`. Configure *Settings → Triggers* para fazer deploy a partir de uma branch `staging`.
- **Produção**: ambiente `production`, deploy a partir de `main`, com *Wait for CI* habilitado para só implantar commits aprovados no GitHub Actions.

## 5. Primeiro deploy — checklist

1. Faça push para a branch configurada → a Railway constrói as três imagens.
2. Pre-deploy da API aplica, no `fandom-postgres`, as migrations, políticas RLS e seeds (veja *Deploy Logs*: `[database] done: …`).
3. Verifique: `https://<api>/health/ready` → `{"status":"ok", "checks": {"database": ok, "redis": ok}}`; `https://<web>/healthz`; logs do worker com `subscription lifecycle sweep`.
4. Cadastre-se no web com o e-mail de `BOOTSTRAP_SUPER_ADMIN_EMAILS`, confirme o e-mail, entre — o perfil recebe `super_admin`. Depois **remova** a variável.

## 6. Operação

- **Logs**: JSON estruturado (API com `LOG_JSON=true`, worker sempre). Correlação por `X-Request-Id`.
- **Restart automático**: `ON_FAILURE` (api/web) e `ALWAYS` (worker), com health checks durante o deploy (zero-downtime com `overlapSeconds`).
- **Escala**: API e web são *stateless* — aumente réplicas em *Settings → Deploy → Replicas*. O rate limit é distribuído via Redis e o job do worker usa `SKIP LOCKED`.
- **Rollback**: *Deployments → ⋯ → Rollback*. Migrations são apenas aditivas por convenção; rollback de schema exige uma nova migration.

## 7. Validação local das imagens

```bash
docker build -f infrastructure/docker/api.Dockerfile -t fandom-api .
docker build -f infrastructure/docker/worker.Dockerfile -t fandom-worker .
docker build -f infrastructure/docker/web.Dockerfile --build-arg VITE_API_URL=http://localhost:3000 -t fandom-web .
```
