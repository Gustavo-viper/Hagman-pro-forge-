# Implantação — Railway + Supabase

Quatro serviços na Railway, banco no Supabase:

| Serviço Railway | Origem | Config file | Health check |
|---|---|---|---|
| `fandom-web` | este repositório | `/apps/web/railway.json` | `/healthz` |
| `fandom-api` | este repositório | `/apps/api/railway.json` | `/health/ready` |
| `fandom-worker` | este repositório | `/apps/worker/railway.json` | `/health` |
| `fandom-redis` | template **Redis** da Railway | — | gerenciado |

Todos os Dockerfiles usam a **raiz do repositório** como contexto (monorepo compartilhado).

---

## 1. Supabase (banco + autenticação)

1. Crie um projeto em <https://supabase.com> (região `South America (São Paulo)` para o público brasileiro).
2. **Database → Connection string**
   - `DATABASE_URL` (API/worker): *Transaction pooler* (porta `6543`) — IPv4, recomendado para a Railway.
   - `DATABASE_MIGRATION_URL`: *Session pooler* (porta `5432`).
   - **Database → Settings → SSL**: baixe o certificado e use `DATABASE_SSL=verify-full` + `DATABASE_CA_CERT` (cole o PEM; `\n` literais são aceitos).
3. **Project Settings → API**
   - `SUPABASE_URL` = `https://<ref>.supabase.co` (API: verificação JWKS; web: `VITE_SUPABASE_URL`).
   - Chave **publishable/anon** → `VITE_SUPABASE_PUBLISHABLE_KEY` (pública por design; o RLS protege os dados).
   - Se o projeto ainda usa o segredo JWT HS256 legado: *JWT Settings → JWT Secret* → `SUPABASE_JWT_SECRET` (**segredo**, só na API). Com *JWT Signing Keys* assimétricas basta `SUPABASE_URL`.
   - **Nunca** use a chave `service_role`/secret em nenhum serviço desta etapa.
4. **Authentication → Providers → Email**: habilite *Confirm email* (obrigatório em produção).
5. **Authentication → URL Configuration**
   - *Site URL*: `https://<domínio do fandom-web>`
   - *Redirect URLs*: `https://<domínio>/auth/callback` e `https://<domínio>/reset-password` (e as equivalentes de homologação/local: `http://localhost:5173/auth/callback`, `http://localhost:5173/reset-password`).
6. **Authentication → SMTP**: configure um SMTP próprio antes do lançamento (o SMTP padrão do Supabase tem limite baixo de envios).

## 2. Railway — criação do projeto

1. *New Project → Deploy from GitHub repo* → selecione este repositório. Renomeie o serviço para `fandom-api`.
2. Em `fandom-api` → *Settings*:
   - **Root Directory**: vazio (raiz do repositório).
   - **Config-as-code → Railway Config File**: `/apps/api/railway.json`.
3. Repita *New → GitHub Repo* (mesmo repositório) para `fandom-web` (`/apps/web/railway.json`) e `fandom-worker` (`/apps/worker/railway.json`).
4. *New → Database → Redis* e renomeie para `fandom-redis`.
5. `fandom-web` e `fandom-api` → *Settings → Networking → Generate Domain* (ou domínio próprio). O worker não precisa de domínio público.

O `railway.json` de cada serviço define: builder Dockerfile, `watchPatterns` (deploy independente — mudar só o web não redeploya a API), health check, política de restart e, na API, o **pre-deploy** `migrate && seed` (se falhar, o deploy não entra no ar).

## 3. Variáveis por serviço

Use *Variables → Raw Editor*. Referências `${{serviço.VAR}}` são resolvidas pela Railway.

### fandom-api
```
NODE_ENV=production
APP_ENV=production
LOG_JSON=true
DATABASE_URL=<Supabase transaction pooler>
DATABASE_MIGRATION_URL=<Supabase session pooler>
DATABASE_SSL=verify-full
DATABASE_CA_CERT=<PEM do Supabase>
REDIS_URL=${{fandom-redis.REDIS_URL}}
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_JWT_SECRET=<somente se usar HS256 legado>
WEB_ORIGINS=https://${{fandom-web.RAILWAY_PUBLIC_DOMAIN}}
SUBSCRIPTION_GRACE_DAYS=3
BOOTSTRAP_SUPER_ADMIN_EMAILS=<e-mail do fundador; remova após o primeiro login>
```
> Para a rede privada use `REDIS_URL=${{fandom-redis.REDIS_URL}}` (host `*.railway.internal`, IPv6 — a API e o worker já escutam/conectam em dual-stack).

### fandom-worker
```
NODE_ENV=production
APP_ENV=production
DATABASE_URL=<mesmo da API>
DATABASE_SSL=verify-full
DATABASE_CA_CERT=<PEM>
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
- **Homologação**: na Railway, *Environments → New Environment → Duplicate `production`* → nome `staging`. Use um **projeto Supabase separado** e `APP_ENV=staging`/`VITE_APP_ENV=staging`. Configure *Settings → Triggers* para fazer deploy a partir de uma branch `staging`.
- **Produção**: ambiente `production`, deploy a partir de `main`, com *Wait for CI* habilitado para só implantar commits aprovados no GitHub Actions.

## 5. Primeiro deploy — checklist

1. Faça push para a branch configurada → a Railway constrói as três imagens.
2. Pre-deploy da API aplica migrations, políticas RLS e seeds (veja *Deploy Logs*: `[database] done: …`).
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
