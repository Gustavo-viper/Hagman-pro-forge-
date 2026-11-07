# API REST — v1

Base: `https://<fandom-api>/` · Versionamento por URI (`/v1/...`). Health checks não são versionados.

**Autenticação:** `Authorization: Bearer <accessToken>` obtido em `/v1/auth/login`, `/register` ou `/refresh`. Toda rota exige token, exceto as marcadas como **pública**.

**Erros** seguem um envelope único; `code` é estável e traduzido pelo frontend:

```json
{ "statusCode": 409, "error": "Conflict", "code": "username_taken", "message": "Username already taken", "requestId": "…" }
```

Validação (`422 validation_failed`) inclui `details: [{ path, code, message }]`. Toda resposta traz `X-Request-Id`.

Rate limit: `RATE_LIMIT_MAX` requisições por `RATE_LIMIT_TTL_MS` por IP (`429 rate_limited`).

## Health

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/health` | pública | Liveness (não toca dependências) |
| GET | `/health/ready` | pública | PostgreSQL + Redis; `503` se o banco estiver fora |

## Autenticação

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/v1/auth/register` | pública · limite estrito | `{ email, password }` → `201 AuthSession`; envia e-mail de verificação (`409 email_taken`) |
| POST | `/v1/auth/login` | pública · limite estrito | `{ email, password }` → `200 AuthSession` (`401 invalid_credentials`, `429 too_many_attempts`, `403 account_suspended`) |
| POST | `/v1/auth/refresh` | pública | `{ refreshToken }` → nova `AuthSession` (o refresh token **rotaciona**; reuso → `401 refresh_token_reused` e toda a família é revogada) |
| POST | `/v1/auth/logout` | autenticado | Revoga a sessão atual → `204` (o access token deixa de valer na hora) |
| POST | `/v1/auth/email-verification` | autenticado | Reenvia o link → `202` (`409 email_already_verified`) |
| POST | `/v1/auth/email-verification/confirm` | pública | `{ token }` → `204` (`400 invalid_or_expired_token`) |
| POST | `/v1/auth/password-reset` | pública · limite estrito | `{ email }` → sempre `202` (não revela se a conta existe) |
| POST | `/v1/auth/password-reset/confirm` | pública | `{ token, password }` → `204`; encerra todas as sessões |

`AuthSession`: `{ accessToken, expiresIn, refreshToken, refreshExpiresAt, user: { id, email, emailVerified } }`. O access token (JWT HS256, 15 min) vai no cabeçalho `Authorization: Bearer`.

## Cobrança (Fandom Premium · InfinitePay)

Planos **pré-pagos** (a API da InfinitePay não tem cobrança recorrente): cada pagamento confirmado ativa ou estende a assinatura por 1 mês/1 ano. Lembrete por e-mail 3 dias antes do vencimento.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/v1/billing/config` | pública | `{ enabled, provider, currency, autoRenew:false }` |
| POST | `/v1/billing/checkout` | autenticado, adulto, e-mail verificado, onboarding | `{ planCode: plus\|ultra, interval: month\|year }` → `{ checkoutUrl, orderNsu, expiresAt }` (link de uso único, 24 h) |
| POST | `/v1/billing/confirm` | autenticado | `{ orderNsu, transactionNsu, slug }` (parâmetros do retorno) → confirmado no `/payment_check` da InfinitePay antes de ativar |
| GET | `/v1/billing/subscription` | autenticado | plano, validade, preço, histórico de pagamentos |
| POST | `/v1/billing/subscription/cancel` · `/reactivate` | autenticado | cancelamento mantém benefícios até o fim do período pago |
| POST | `/v1/billing/webhooks/infinitepay?token=…` | token secreto | aviso da InfinitePay (não assinado): armazenado e **sempre** reconfirmado no `/payment_check`; valor divergente não ativa |

Erros: `billing_unavailable`, `minor_purchase_blocked`, `email_not_verified`, `plan_change_unavailable`, `too_many_checkouts`, `payment_provider_error`, `payment_not_found`, `no_active_subscription`, `cannot_reactivate`, `invalid_webhook_token`.

## Universos

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/v1/universes` | pública | Universos ativos com tema e features (cache 60 s) |
| GET | `/v1/universes/:slug` | pública | Detalhe + `identityConfig` (casas, patentes…) |
| POST | `/v1/universes/:slug/membership` | autenticado + onboarding | Entra no universo (idempotente) → `UniverseMembership` |
| DELETE | `/v1/universes/:slug/membership` | autenticado | Sai do universo → `204` (`404 membership_not_found`) |

## Planos

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/v1/subscription-plans?currency=BRL` | pública | Planos ativos com preços **somente** na moeda pedida (sem conversão) |

## Usuário autenticado

| Método | Rota | Descrição |
|---|---|---|
| GET | `/v1/me` | Perfil + `subscription` (plano efetivo calculado no servidor) |
| GET | `/v1/me/dashboard` | Perfil, assinatura, XP/nível, participações e universos |
| GET | `/v1/me/username-availability?username=` | Disponibilidade de nome de usuário |
| POST | `/v1/me/onboarding` | Conclui o perfil, registra consentimentos (LGPD), aplica regras de menores, concede 50 XP (uma única vez) |
| PATCH | `/v1/me/preferences` | `{ locale?, timezone? }` |

### `POST /v1/me/onboarding`

```json
{
  "username": "luna_l", "displayName": "Luna", "birthdate": "2000-05-01",
  "country": "BR", "locale": "pt-BR", "timezone": "America/Sao_Paulo",
  "acceptTerms": true, "acceptPrivacy": true, "marketingEmail": false
}
```

Erros: `409 username_taken`, `409 onboarding_already_completed`, `403 age_restricted` (< 13 anos), `422 validation_failed`.

## Códigos de erro

`unauthorized`, `invalid_token`, `token_expired`, `session_revoked`, `invalid_credentials`, `email_taken`, `too_many_attempts`, `invalid_refresh_token`, `refresh_token_reused`, `invalid_or_expired_token`, `email_already_verified`, `account_suspended`, `account_deleted`, `insufficient_role`, `premium_required`, `onboarding_required`, `onboarding_already_completed`, `username_taken`, `age_restricted`, `invalid_birthdate`, `validation_failed`, `universe_not_found`, `membership_not_found`, `rate_limited`, `not_found`, `bad_request`, `internal_error`.

Os contratos TypeScript estão em `packages/types/src/index.ts`; os corpos de requisição em `packages/schemas`.
