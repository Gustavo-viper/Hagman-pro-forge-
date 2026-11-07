# API REST — v1

Base: `https://<fandom-api>/` · Versionamento por URI (`/v1/...`). Health checks não são versionados.

**Autenticação:** `Authorization: Bearer <access_token do Supabase>`. Toda rota exige token, exceto as marcadas como **pública**.

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

`unauthorized`, `invalid_token`, `token_expired`, `account_suspended`, `account_deleted`, `insufficient_role`, `premium_required`, `onboarding_required`, `onboarding_already_completed`, `username_taken`, `age_restricted`, `invalid_birthdate`, `validation_failed`, `universe_not_found`, `membership_not_found`, `rate_limited`, `not_found`, `bad_request`, `internal_error`.

Os contratos TypeScript estão em `packages/types/src/index.ts`; os corpos de requisição em `packages/schemas`.
