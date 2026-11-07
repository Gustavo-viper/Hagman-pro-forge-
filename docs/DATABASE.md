# Banco de dados

PostgreSQL 16 — serviço **`fandom-postgres` na Railway** em produção (rede privada). Estrutura:

```
database/
  migrations/  NNNN_nome.sql   aplicadas uma única vez, em ordem, cada uma em transação
  policies/    NNNN_nome.sql   reaplicadas (idempotentes) após cada migrate — RLS
  seeds/       NNNN_nome.sql   dados de referência idempotentes (ON CONFLICT DO NOTHING)
  src/         executor (migrate · seed · status)
```

Regras: **nunca edite uma migration aplicada** (o executor compara checksums e aborta); crie uma nova. Execuções concorrentes são serializadas por *advisory lock*.

## Tabelas (Etapa 1)

| Tabela | Finalidade | Destaques |
|---|---|---|
| `users` | Conta da plataforma | `status` (active/suspended/banned/deleted), e-mail único entre contas não excluídas |
| `profiles` | Perfil global | `username` único (regex = Zod), `is_minor`, `privacy` jsonb, `xp_total ≥ 0`, `onboarding_completed_at` |
| `user_consents` | Prova de consentimento (LGPD) — *append-only* | tipo, versão do documento, IP, user-agent |
| `universes` | Universos (dados, não código) | textos localizados jsonb, `status`, `member_count` mantido por trigger |
| `universe_settings` | Tema (tokens CSS), features, sistema de identidade | validações `jsonb_typeof` |
| `universe_members` | Participação usuário ↔ universo | PK composta |
| `universe_profiles` | Identidade e XP por universo | FK composta para `universe_members` (cascade), índice de ranking `(universe_id, xp desc)` |
| `user_roles` | RBAC da equipe | `universe_moderator` obrigatoriamente com `universe_id` (CHECK) |
| `audit_logs` | Trilha de auditoria — *append-only* | ator, ação, alvo, metadata, IP, request id |
| `xp_transactions` | Livro-razão de XP | `idempotency_key` **UNIQUE**, limites de valor, índices para rankings semanais/mensais |
| `subscription_plans` | Free · Plus · Ultra | benefícios localizados |
| `plan_prices` | Preço por plano × intervalo × moeda | centavos, `UNIQUE(plan, interval, currency)`, id do preço no provedor (Etapa 10) |
| `subscriptions` | Estado da assinatura | status pending/active/past_due/cancelled/expired; **no máximo uma aberta por usuário** (índice parcial único) |
| `auth_credentials` | Hash scrypt da senha | 1:1 com `users` |
| `auth_sessions` | Sessões/refresh tokens (hash SHA-256) | família para detecção de reuso, revogação, expiração |
| `auth_tokens` | Links de verificação e redefinição (hash SHA-256) | uso único, expiração curta |
| `subscription_status_history` | Histórico de mudanças de status | motivo + ator |

Planejadas para as próximas etapas (ver `ROADMAP.md`): posts, comments, reactions, friendships, follows, groups, group_members, conversations, message_participants, messages, notifications, quizzes, questions, quiz_attempts, missions, achievements, user_achievements, wallets, wallet_transactions, inventory, products, payment_transactions, payment_webhook_events, events, event_participants, reports, moderation_actions.

## RLS

`policies/0001_rls.sql` habilita RLS em **todas** as tabelas, sem políticas: o banco fica só na rede privada da Railway e apenas a API/worker (donos das tabelas) acessam; qualquer outra role criada no futuro não enxerga linhas sem uma política explícita.

## Conexão

- Produção (Railway): `DATABASE_URL=${{fandom-postgres.DATABASE_URL}}` — host `fandom-postgres.railway.internal`, só acessível pela rede privada do projeto; `DATABASE_SSL=disable`.
- Acesso externo pontual: `DATABASE_PUBLIC_URL` com `DATABASE_SSL=require`.
- O executor de migrations usa `DATABASE_MIGRATION_URL` se definido, senão `DATABASE_URL`.

## Backups e recuperação

Railway: habilite *Backups* agendados no serviço `fandom-postgres` (diário/semanal, restauração pelo painel). Procedimento de restauração e testes periódicos estão listados em `ROADMAP.md` (Etapa 12).
