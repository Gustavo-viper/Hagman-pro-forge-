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

## Administração (equipe Forge Studios)

Todas as rotas exigem papel verificado no servidor: **visualizar** = `admin` ou `support`; **alterar** = `admin` (`super_admin` sempre pode). Toda alteração exige motivo e gera `audit_logs`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/v1/admin/stats` | usuários (total, novos 7 dias, verificados, suspensos), assinantes por plano, receita do mês e 30 dias |
| GET | `/v1/admin/users?search=&plan=&status=&cursor=&limit=` | lista paginada por cursor; busca por e-mail, @usuário ou nome |
| GET | `/v1/admin/users/:id` | detalhes, pagamentos, histórico da assinatura e auditoria |
| POST | `/v1/admin/users/:id/grant-plan` | `{ planCode, days (1–730), reason }` — libera ou estende (mesmo plano soma dias; outro plano substitui) e avisa o usuário por e-mail |
| POST | `/v1/admin/users/:id/revoke-plan` | `{ reason }` — corta o premium na hora (conta continua Free) |
| POST | `/v1/admin/users/:id/suspend` · `/reactivate` | `{ reason }` — suspende login e encerra sessões / reativa |

Primeiro admin: `BOOTSTRAP_SUPER_ADMIN_EMAILS` (concedido no login ou na verificação de e-mail, apenas enquanto não existir super admin) ou `cli.ts grant-role`.

## Universos

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/v1/universes` | pública | Universos ativos com tema e features (cache 60 s) |
| GET | `/v1/universes/:slug` | pública | Detalhe + `identityConfig` (casas, patentes…) |
| POST | `/v1/universes/:slug/membership` | autenticado + onboarding | Entra no universo (idempotente) → `UniverseMembership` |
| DELETE | `/v1/universes/:slug/membership` | autenticado | Sai do universo → `204` (`404 membership_not_found`) |

### Tema oficial do universo

`officialTheme: { youtubeId, title, artist } | null` vem em `GET /v1/universes` e `GET /v1/universes/:slug`. No site, o botão "Tema oficial" na barra de música abre o player do YouTube (`youtube-nocookie.com`, só após o clique) e pausa a trilha original de fundo. Nenhum áudio de terceiros é hospedado pela plataforma; MP3 próprios/licenciados continuam possíveis via `apps/web/public/music` + `src/lib/music/tracks.ts`.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| PUT | `/v1/universes/:slug/official-theme` | admin/editor | `{ theme: { url, title, artist? } \| null }` — aceita links youtube.com/youtu.be/embed/shorts (`invalid_youtube_url`); `null` remove (o seed não recoloca) |

## Quizzes, identidade e ranking

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/v1/universes/:slug/quizzes` | pública | quizzes publicados (sem respostas) |
| GET | `/v1/quizzes/:id` | pública | perguntas e opções — **nunca** a resposta certa |
| POST | `/v1/quizzes/:id/attempts` | membro do universo | `{ answers: { [questionId]: key } }` → correção no servidor, revisão com explicações, XP. XP escala com a nota e é limitado à recompensa do quiz (melhorar paga só a diferença; repetir não gera XP). Quizzes de personalidade definem a identidade (ex.: casa) |
| GET | `/v1/universes/:slug/quiz-progress` | autenticado | tentativas, melhor nota e XP por quiz |
| PUT | `/v1/universes/:slug/identity` | membro | `{ key }` — escolha manual (`409 identity_requires_quiz` quando o universo usa teste, como a seleção de casa) |
| GET | `/v1/universes/:slug/ranking?period=all\|month\|week` | pública | top 50 por XP do universo |

## Seções dos universos

Cada funcionalidade em `universe_settings.features` é ligada a um motor (`packages/shared/src/sections.ts`). Novos universos reutilizam os motores.

| Motor | Rotas | Regras |
|---|---|---|
| Arquivo | `GET /v1/universes/:slug/archive/:section` | pública; 404 se a seção não pertence ao universo |
| Comunidade | `GET /v1/universes/:slug/forum/:category` (cursor) · `POST` (criar) · `GET /v1/forum/topics/:id` · `POST /v1/forum/topics/:id/replies` · `DELETE /v1/forum/topics/:id` · `DELETE /v1/forum/replies/:id` · `POST /v1/reports` | leitura pública; postar exige ser membro e ter e-mail verificado; texto puro (renderizado escapado); máx. 5 posts/min por pessoa + limite por IP; salões comunais visíveis só para quem tem a mesma identidade; autor apaga o próprio conteúdo |
| Missões | `GET /v1/universes/:slug/missions` · `GET …/missions/progress` · `POST /v1/missions/:id/claim` | progresso calculado da atividade real (quizzes, gabaritos, tópicos, respostas a outros, identidade, eventos); XP uma única vez |
| Eventos | `GET /v1/universes/:slug/events` · `GET …/events/mine` · `POST/DELETE /v1/events/:id/registration` | membro; capacidade com bloqueio de linha; eventos Premium checados no servidor (`premium_required`) |
| Disputa | `GET /v1/universes/:slug/standings` | XP somado por identidade (taça das casas) |

### Biblioteca de livros e estante pessoal

Todo universo tem a seção de arquivo `books` (`GET /v1/universes/:slug/archive/books`): livros reais com título, autor e ano no subtítulo, resumo original e uma etiqueta de tipo (`oficial`, `hq`, `manga`, `romance`, `bastidores`, `recomendado`, `inspiracao`). Não vendemos nem distribuímos os livros.

| Rota | Regras |
|---|---|
| `GET /v1/universes/:slug/books/shelf` | usuário autenticado; `{ items: [{ entryId, status }], counts: { want, reading, read } }` só daquele universo |
| `PUT /v1/books/:entryId/shelf { status: want\|reading\|read\|null }` | só entradas da seção `books` (`book_not_found`); `null` remove da estante |

### Jogos dos universos

Todos os jogos são conferidos no servidor: respostas e palavras secretas nunca saem da API antes da hora, o XP entra pelo livro-razão (`source = 'game'`) uma única vez por partida e há limites diários (dia no fuso America/Sao_Paulo).

| Rota | Regras |
|---|---|
| `GET /v1/universes/:slug/games/me` | resumo do jogador: desafio de hoje, sequência de dias, recordes, vitórias e partida de forca em andamento |
| `GET /v1/universes/:slug/games/leaderboard?game=daily\|speed\|hangman` | público; diário = resultados de hoje; relógio = melhor rodada em 7 dias; forca = vitórias em 7 dias |
| `GET /v1/universes/:slug/games/daily` · `POST …/games/daily { answers }` | 5 perguntas sorteadas de forma determinística por dia (iguais para todos) do banco de perguntas de trivia do universo; 1 envio por dia (`daily_already_played`); 8 XP por acerto + 10 XP se gabaritar |
| `POST /v1/universes/:slug/games/speed` · `POST /v1/games/speed/:id/answers { questionId, key }` · `POST /v1/games/speed/:id/finish` | 60 s com prazo controlado pelo servidor (tolerância de 3 s); uma pergunta por vez (`wrong_question`); 3 XP por acerto, máx. 60 XP/dia; iniciar uma nova rodada encerra a anterior |
| `POST /v1/universes/:slug/games/hangman` · `GET /v1/games/hangman/:id` · `POST /v1/games/hangman/:id/guesses { letter }` | palavra sorteada (evita as 15 últimas); letras A–Z sem diferenciar acento/maiúscula; 6 vidas; 15 XP por vitória nas 5 primeiras vitórias do dia; letra repetida não custa vida |
| `POST /v1/games/hangman/:id/clues` | revela a próxima dica de cena/curiosidade da palavra (3 por palavra); não custa vida; a palavra continua oculta |

Jogar exige ser membro do universo (`membership_required`). Novos objetivos de missões: `daily_complete`, `daily_perfect`, `speed_score` (melhor rodada) e `hangman_win`.

### Sala do evento (tempo real)

| Rota | Regras |
|---|---|
| `GET /v1/events/:id/room` | inscrito no evento (ou moderador); devolve evento, `opensAt`/`closesAt` (abre 30 min antes, fecha 1 h depois do fim), link externo (só para inscritos e só com a sala aberta), quiz da noite, últimas mensagens e placar |
| `GET /v1/events/:id/room/stream` | Server-Sent Events autenticados pelo cabeçalho `Authorization` (nunca pela URL); eventos `ready`, `message`, `removed`, `leaderboard-changed`, `cancelled` e `ping` a cada 20 s; fan-out entre réplicas via Redis pub/sub |
| `POST /v1/events/:id/room/messages { body }` | sala aberta; texto puro 1–500 caracteres; 1 mensagem a cada 2 s por pessoa (`posting_too_fast`) |
| `DELETE /v1/events/:id/room/messages/:messageId` | autor ou moderador |

O placar é o melhor resultado de cada inscrito no quiz vinculado, contado só durante a janela da sala.

### Eventos no admin

`GET /v1/admin/events` (admin, editor, suporte) · `POST /v1/admin/events` · `PATCH /v1/admin/events/:id` · `POST /v1/admin/events/:id/cancel` (admin, editor). Datas ISO com fuso; link externo só `https://`; o quiz precisa ser do mesmo universo (`invalid_quiz`). Mudar o início rearma os lembretes; cancelar envia e-mail a cada inscrito e fecha a sala ao vivo. Tudo auditado.

Lembretes: o worker verifica a cada 5 min e envia e-mail 24 h e 1 h antes do início, uma única vez por inscrito, com link para a sala.

Moderação: `GET /v1/admin/reports?status=open` (admin, suporte, moderador global) e `POST /v1/admin/reports/:id/resolve { action: hide|dismiss }` (admin, moderador global), auditados.

## Planos

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/v1/subscription-plans?currency=BRL` | pública | Planos ativos com preços **somente** na moeda pedida (sem conversão) |


Preços oficiais (BRL): **Plus R$ 29,90/mês ou R$ 299,00/ano · Ultra R$ 59,90/mês ou R$ 599,00/ano · VIP R$ 79,90/mês** (migração `0022` atualiza bancos existentes só se o preço ainda for o anterior).

### Convide amigos (desconto por indicação)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/v1/me/referrals` | autenticado | código e link pessoal (`/convite/CÓDIGO`), amigos confirmados/aguardando, desconto atual e próximo nível |
| POST | `/v1/auth/register { …, referralCode? }` | pública | vincula a nova conta a quem convidou (códigos desconhecidos são ignorados; cada pessoa só pode ser indicada uma vez) |
| GET | `/v1/admin/users/:id/referrals` | admin, support | indicações do usuário (com e-mail dos convidados) |
| POST | `/v1/admin/referrals/:id/revoke { reason }` | admin | cancela indicação fraudulenta (auditado); deixa de contar na hora |

Um amigo **conta** quando confirmou o e-mail e entrou em pelo menos um universo (calculado na leitura). Níveis: **3 amigos = 5% · 5 = 10% · 10 = 20% · 20 = 30%** (`REFERRAL_TIERS` em `packages/shared`). O desconto é aplicado pelo servidor no checkout dos planos pagos enquanto o usuário mantiver os convites; `payment_transactions` guarda `list_amount_minor` e `discount_percent`, e a confirmação do pagamento compara com o valor com desconto.

### Vantagens do Fandom Premium

Os números ficam em um único lugar, `packages/shared/src/premium.ts` (`PREMIUM_PERKS`), usado pela API (que aplica as regras) e pelo site (que mostra a comparação), para que o anunciado seja exatamente o entregue. O plano efetivo vem de `public.effective_plan(user_id)` no SQL, que espelha `entitledPlan` (há teste comparando os dois).

| Vantagem | Free | Plus | Ultra | Onde é aplicada |
|---|---|---|---|---|
| Bônus de XP em quizzes, jogos e missões | — | +20% | +50% | `XpService.awardWithBonus`: lançamento separado no livro-razão (`{chave}:premium`, `source_ref = premium:{plano}`); os limites anti-farm usam só a base |
| XP por dia no contra o relógio | 60 | 120 | 200 | `GamesService.finishSpeed` |
| Vitórias com XP por dia na forca | 5 | 10 | 20 | `GamesService.guess` |
| Modo Sobrevivência (`POST /v1/universes/:slug/games/survival`, `POST /v1/games/survival/:id/answers`, `…/finish`) | — | 100 XP/dia | 160 XP/dia | 20 s por pergunta controlados pelo servidor; erro ou tempo esgotado encerra |
| Sala VIP (`/forum/vip_lounge`) | — | ✓ | ✓ | ler e postar exigem o plano (`premium_required`) |
| Missões Premium (`missions.premium_plan`) | — | Plus | Plus + Ultra | resgate checa o plano |
| Selo no nome (`plan` em autores, rankings e placares) | — | Plus | Ultra | `effective_plan()` nas consultas |

Respostas com XP trazem `xpBonus`; `GET /v1/universes/:slug/games/me` traz `plan` e `limits` do jogador.

| Também | Free | Plus | Ultra | Onde |
|---|---|---|---|---|
| Proteção da sequência diária | — | 1 dia perdido/semana | 2 dias/semana | `streakInfo()` em `games.service.ts`; `games/me` traz `shieldsPerWeek` e `shieldsUsed` |
| Estatísticas detalhadas (`GET /v1/me/stats`) | — | ✓ | ✓ | `@RequiresPlan('plus')`: XP por dia (30 dias, fuso do usuário, bônus separado), XP por fonte, precisão, recordes por universo |

### Teste grátis do Fandom Plus

`GET /v1/billing/trial` → `{ eligible, reason, plan: 'plus', days: 7 }` · `POST /v1/billing/trial`.

- Uma vez por conta: só quem nunca teve assinatura, adulto, com e-mail verificado e perfil completo (`trial_unavailable`, `email_not_verified`, `onboarding_required`).
- Não pede cartão e nunca cobra: é uma assinatura `provider = 'trial'` com status `cancelled` e fim do período em 7 dias, então simplesmente expira (sem carência) pelo job de ciclo de vida.
- Durante o teste: pagar o Plus soma o mês aos dias restantes e converte a assinatura em `infinitepay`; o Ultra pode ser comprado na hora (o teste é encerrado); "reativar" não se aplica.
- O worker envia um e-mail `trial_ending` 2 dias antes do fim (uma vez), com link para os planos.
- Auditoria: `billing.trial_started`.

### Fandom VIP (R$ 79,90/mês)

Plano `vip` (rank 3, só mensal): tudo do Ultra + número da sorte nos sorteios VIP autorizados + selo VIP. Vendido pelo mesmo checkout InfinitePay (sem simulação em produção).

## Prêmios: sorteios VIP e concursos culturais

### Sorteios VIP (com trava legal)

Sorteio promocional exige autorização prévia da SPA/MF (Lei 5.768/71). Um rascunho **só abre** com `certificateNumber` e `regulationUrl` (https) — trava no serviço (`409 authorization_required`) e no banco (CHECK).

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/v1/draws` · `/v1/draws/:id` | pública (usuário opcional) | Sorteios publicados (nunca rascunhos), certificado, regulamento, `myNumber`, `eligible`/`ineligibleReason` (`sign_in`, `plan_required`, `minor`, `email_not_verified`, `closed`) e resultado |
| POST | `/v1/draws/:id/entries` | VIP adulto com e-mail verificado | Gera o número da sorte (sequencial, um por pessoa) |
| GET/POST | `/v1/admin/draws` | admin | Lista / cria rascunho |
| PATCH | `/v1/admin/draws/:id` | admin | Edita rascunho (certificado, regulamento, datas…) |
| POST | `/v1/admin/draws/:id/open` · `/cancel` · `/run` | admin | Abre (gera semente e publica `sha256(seed)`), cancela, apura após o fim (`{ externalValue }`) |
| PUT | `/v1/admin/prizes/:id/code` | admin | Entrega o código (chave Steam / vale) — guardado cifrado (AES-256-GCM), nunca vai por e-mail |

Apuração verificável: ganhador k = `sha256(seed:externalValue:k) mod restantes` sobre os números ordenados; a semente é revelada no resultado.

### Concursos culturais (papel de parede)

Gratuitos, por mérito, para todo adulto com e-mail verificado e perfil completo (Lei 5.768/71, art. 3º, II) — nunca exclusivos de assinantes. Fases: `upcoming → submissions → voting → judging → finished`.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/v1/contests` · `/v1/contests/:slug` | pública | Concursos publicados, regulamento, galeria aprovada (votos ocultos até a votação terminar), `myEntry`, `canSubmit`/`submitBlockReason` |
| POST | `/v1/contests/:slug/entries` | usuário | multipart `image` (JPG/PNG/WebP ≤ 6 MB, ≥ 1080×720) + `title`, `description`, `ownWork=true`; reprocessada para WebP sem metadados (EXIF/GPS); entra como `pending` |
| DELETE | `/v1/contests/:slug/entries/mine` | usuário | Retira a inscrição (durante as inscrições) |
| PUT | `/v1/contests/:slug/vote` | usuário | `{ entryId }` — 1 voto por concurso, pode trocar; não vale na própria arte (`own_entry`) |
| GET | `/v1/contest-entries/:id/image?size=thumb` | pública | Imagem aprovada (`Cross-Origin-Resource-Policy: cross-origin`) |
| GET | `/v1/me/prizes` | usuário | Prêmios ganhos e códigos entregues |
| GET/POST | `/v1/admin/contests` | admin/editor (moderador vê) | Lista / cria |
| POST | `/v1/admin/contests/:id/publish` · `/cancel` | admin/editor | Publica / cancela |
| POST | `/v1/admin/contest-entries/:id/review` | admin/editor/moderador global | `{ action: 'approve' \| 'reject' }` |
| POST | `/v1/admin/contests/:id/winner` | admin | `{ entryId }` após a votação (júri decide; voto da comunidade orienta) |

Prêmio padrão: 1 mês de Crunchyroll (vale-presente comprado pela Forge Studios; sem parceria oficial). E-mails: `prize_won`, `prize_delivered`. Limite de envio: `UPLOAD_RATE_LIMIT_MAX` (padrão 10/h).

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
