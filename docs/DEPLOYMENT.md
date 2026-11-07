# Implantação — 100% Railway

Tudo roda em **um único projeto Railway** (`Trilha Demo`): aplicação, banco de dados, filas e autenticação. **Nenhum serviço externo de identidade ou banco** é usado.

| Serviço Railway | Origem | Referência de config | Health check |
|---|---|---|---|
| `fandom-web` | este repositório | `apps/web/railway.json` | `/healthz` |
| `fandom-api` | este repositório | `apps/api/railway.json` | `/health/ready` |
| `fandom-worker` | este repositório | `apps/worker/railway.json` | `/health` |
| `fandom-postgres` | template **PostgreSQL** | — | gerenciado (volume persistente) |
| `fandom-redis` | template **Redis** | — | gerenciado (volume persistente) |

Dependência externa: um **provedor SMTP** (atualmente Gmail com senha de app) para entregar os e-mails de verificação e de redefinição de senha (ex.: Resend, Amazon SES, Brevo, Mailgun, Postmark — todos expõem SMTP).

---

## 1. Banco de dados — `fandom-postgres`

1. *Create → Database → Add PostgreSQL* → renomeie para **`fandom-postgres`**.
2. A API e o worker usam a **rede privada** (`fandom-postgres.railway.internal`); o banco não precisa ser exposto.
3. Migrations, políticas RLS e dados de referência rodam automaticamente no *pre-deploy* da API (`node /app/database/src/cli.ts deploy`).
4. **Backups**: `fandom-postgres → Backups` → habilite backups agendados (diário + semanal).
5. Acesso administrativo pontual (psql/DBeaver) apenas da sua máquina, com `DATABASE_PUBLIC_URL` do serviço.

## 2. Autenticação (própria, dentro da API)

- Cadastro, login, logout, renovação de sessão, verificação de e-mail e redefinição de senha estão em `fandom-api` (`/v1/auth/*`).
- Senhas: hash **scrypt** (N=2¹⁷). Tokens de acesso JWT de 15 min; refresh tokens rotativos (30 dias) com detecção de reuso. Tudo armazenado em `fandom-postgres` (`auth_credentials`, `auth_sessions`, `auth_tokens`).
- **Segredo obrigatório**: `AUTH_JWT_SECRET` (≥ 32 caracteres aleatórios). Trocar o valor encerra todas as sessões.
- **E-mails**: a API enfileira no Redis; o worker envia por SMTP (`SMTP_URL`). Sem SMTP o cadastro e o login funcionam, mas os e-mails ficam na fila com novas tentativas até o SMTP ser configurado — a recuperação de senha depende disso.

## 3. Serviços da aplicação

1. *Create → GitHub Repo* → este repositório → nome `fandom-api`. **Root Directory** vazio.
2. Em *Settings → Build/Deploy*, aplique os valores de `apps/api/railway.json`: *Dockerfile Path*, *Start Command*, *Pre-deploy Command*, *Healthcheck Path/Timeout*, *Restart Policy*, *Watch Paths* (ou defina a variável `RAILWAY_DOCKERFILE_PATH`).
3. Repita para `fandom-worker` e `fandom-web`.
4. *Create → Database → Add Redis* → `fandom-redis`.
5. `fandom-web` e `fandom-api` → *Settings → Networking → Generate Domain*.

> A Railway deprecou o campo *Railway Config File* (config-as-code) em favor de *Infrastructure as Code* (`.railway/railway.ts`). Por isso as configurações ficam aplicadas diretamente em cada serviço; os `railway.json` permanecem no repositório como fonte de referência dos valores.

## 4. Variáveis por serviço

Referências `${{serviço.VAR}}` são resolvidas pela Railway.

### fandom-api
```
NODE_ENV=production
APP_ENV=production
LOG_JSON=true
DATABASE_URL=${{fandom-postgres.DATABASE_URL}}
DATABASE_SSL=disable
REDIS_URL=${{fandom-redis.REDIS_URL}}
AUTH_JWT_SECRET=<48+ caracteres aleatórios>
APP_PUBLIC_URL=https://${{fandom-web.RAILWAY_PUBLIC_DOMAIN}}
WEB_ORIGINS=https://${{fandom-web.RAILWAY_PUBLIC_DOMAIN}}
SUBSCRIPTION_GRACE_DAYS=3
BOOTSTRAP_SUPER_ADMIN_EMAILS=<e-mail do fundador; remova depois>
API_PUBLIC_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
# Pagamentos (InfinitePay Checkout Integrado). Sem estas três, a cobrança fica desligada.
INFINITEPAY_HANDLE=<sua InfiniteTag, sem o $>
INFINITEPAY_API_KEY=<inchk_… criada em Configurações do Checkout>
INFINITEPAY_WEBHOOK_TOKEN=<32+ caracteres aleatórios>
```

#### InfinitePay
1. No app/Conta Web: *Configurações do Checkout* → ative **Checkout Integrado** → crie uma **API Key** (`inchk_…`, aparece uma vez).
2. Preencha as variáveis acima em `fandom-api`. O webhook é configurado automaticamente em cada link (`/v1/billing/webhooks/infinitepay?token=…`).
3. Não há sandbox: valide com um pagamento real e estorne pelo app se quiser. Estornos e cancelamentos de cobrança são feitos só pelo app/Conta Web da InfinitePay.
> `DATABASE_SSL=disable` só é aceito em produção para hosts `*.railway.internal` (rede privada). Para a URL pública use `require`.

### fandom-worker
```
NODE_ENV=production
APP_ENV=production
DATABASE_URL=${{fandom-postgres.DATABASE_URL}}
DATABASE_SSL=disable
REDIS_URL=${{fandom-redis.REDIS_URL}}
SUBSCRIPTION_GRACE_DAYS=3
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=forgestudios.contato@gmail.com
SMTP_PASSWORD=<senha de app de 16 letras, sem espaços>
EMAIL_FROM=Fandom Universe <forgestudios.contato@gmail.com>
APP_PUBLIC_URL=https://${{fandom-web.RAILWAY_PUBLIC_DOMAIN}}
```

#### Gmail (configuração atual, sem domínio próprio)
1. Na conta Google: *Segurança → Verificação em duas etapas* (obrigatória) → *Senhas de app* → crie "Fandom Universe" e copie a senha de 16 letras.
2. Preencha as variáveis acima em `fandom-worker` (o plano Pro da Railway libera SMTP de saída).
3. Nos *Deploy Logs* do worker deve aparecer `smtp connection verified`; `GET /health` do worker mostra `"smtp":"ok"`.
4. Limites: ~500 destinatários/dia; o remetente precisa ser o próprio Gmail. Ao ter domínio, troque para um provedor transacional (Resend, Brevo, SES) mudando apenas essas variáveis e configure SPF/DKIM.

### fandom-web
```
VITE_API_URL=https://${{fandom-api.RAILWAY_PUBLIC_DOMAIN}}
VITE_APP_ENV=production
```
`VITE_*` são *build args* (inlinadas no bundle) e também lidas em runtime para montar a Content-Security-Policy. Alterá-las exige novo deploy do web.

## 5. Primeiro super admin

- **Com SMTP**: defina `BOOTSTRAP_SUPER_ADMIN_EMAILS`, cadastre-se com esse e-mail e clique no link de confirmação — o perfil recebe `super_admin` (somente enquanto não existir nenhum). Depois remova a variável.
- **Sem SMTP**: cadastre-se no site e rode, com a CLI da Railway logada no projeto:
  ```bash
  railway ssh --service fandom-api -- node /app/database/src/cli.ts grant-role voce@exemplo.com super_admin
  ```
  A ação é registrada em `audit_logs`.

## 6. Ambientes (desenvolvimento · homologação · produção)

- **Desenvolvimento**: local (`.env`, `pnpm dev`).
- **Homologação**: *Environments → New Environment → Duplicate `production`* → `staging` (ganha PostgreSQL e Redis próprios). Use outro `AUTH_JWT_SECRET`, `APP_ENV=staging`/`VITE_APP_ENV=staging` e faça deploy de uma branch `staging`.
- **Produção**: ambiente `production`, deploy a partir de `main`, com *Wait for CI* habilitado.

## 7. Verificação pós-deploy

1. *Deploy Logs* da API: `[database] migrate: …` e `[database] seed: 2 seed files`.
2. `https://<api>/health/ready` → `{"status":"ok","checks":{"database":…ok,"redis":…ok}}`.
3. `https://<web>/healthz` → `ok`; abra o site, crie uma conta e conclua o perfil.
4. Logs do worker: `fandom-worker started` com `"smtp": true` quando o SMTP estiver configurado.

> O catálogo público (universos/planos) fica em cache por até 1–5 min; após alterar dados de referência, aguarde a expiração.

## 8. Operação

- **Logs**: JSON estruturado; correlação por `X-Request-Id`.
- **Restart**: `ON_FAILURE` (api/web), `ALWAYS` (worker); health checks durante o deploy.
- **Escala**: API e web são *stateless* (réplicas em *Settings → Deploy*). Rate limit distribuído via Redis; jobs com `SKIP LOCKED`.
- **Rollback**: *Deployments → ⋯ → Rollback*. Migrations são aditivas; desfazer schema exige nova migration.

## 9. Validação local das imagens

```bash
docker build -f infrastructure/docker/api.Dockerfile -t fandom-api .
docker build -f infrastructure/docker/worker.Dockerfile -t fandom-worker .
docker build -f infrastructure/docker/web.Dockerfile --build-arg VITE_API_URL=http://localhost:3000 -t fandom-web .
```
