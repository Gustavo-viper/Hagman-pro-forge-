# Arquitetura — Fandom Universe

## Visão de alto nível

```
                 ┌────────────────────────┐
  Navegador ───► │ fandom-web (Railway)   │  SPA React + PWA, servidor estático endurecido
  (PWA)          └──────────┬─────────────┘
       │                    │ HTTPS  Authorization: Bearer <access token>
       │  (login, e-mail)   ▼
       │         ┌────────────────────────┐      ┌───────────────────────┐
       └───────► │ fandom-api (Railway)   │ ───► │ PostgreSQL (Railway)  │
                 │ NestJS · REST /v1      │      │ migrations · RLS      │
                 └──────────┬─────────────┘      └──────────▲────────────┘
                            │ cache · rate limit           │
                            ▼                              │
                 ┌────────────────────────┐      ┌─────────┴─────────────┐
                 │ fandom-redis (Railway) │ ◄─── │ fandom-worker (Railway)│
                 └────────────────────────┘      │ BullMQ · jobs         │
                                                 └───────────────────────┘
```

## Monorepositório

pnpm workspaces + Turborepo. Pacotes internos são compilados para `dist/` (ESM) e consumidos por todos os apps. `turbo run build` respeita a ordem de dependências (`^build`).

```
apps/web        React · Vite · Tailwind v4 · shadcn/ui (via packages/ui) · Framer Motion
apps/api        NestJS 12 (ESM)
apps/worker     BullMQ
packages/shared regras de domínio puras (níveis/XP, dinheiro em centavos, constantes ↔ CHECKs do banco)
packages/schemas Zod — validação idêntica no browser e na API
packages/types  contratos de resposta da API
packages/ui     design system (Button, Card, Input, Badge, Progress, Alert…)
database/       migrations · policies (RLS) · seeds · executor
tests/          E2E Playwright contra a stack real
infrastructure/ Dockerfiles, docker-compose local, scripts
```

## Decisões técnicas (ADR resumidas)

| # | Decisão | Motivo |
|---|---|---|
| 0 | **Tudo na Railway**: `fandom-postgres` na rede privada, autenticação própria na API, e-mails pelo worker. | Um único provedor, latência mínima API↔banco, banco sem exposição pública, sem dependência de identidade externa. |
| 1 | **Backend é a única porta de dados.** O navegador nunca consulta tabelas via PostgREST. | Autorização centralizada e testável; regras de XP/assinatura nunca no cliente. RLS habilitado em todas as tabelas como defesa em profundidade contra uso indevido da chave pública. |
| 2 | **SQL puro versionado + executor próprio** (`database/src/runner.ts`) em vez de ORM. | Portável entre provedores PostgreSQL: RLS, triggers e índices parciais são SQL nativo. O executor usa *advisory lock* (deploys concorrentes), uma transação por migration e **checksum** (bloqueia edição de migration já aplicada). |
| 3 | **Autenticação própria**: scrypt, JWT HS256 curto (`jose`) + refresh token opaco rotativo com detecção de reuso, sessões revogáveis. | Nenhuma dependência externa; logout e redefinição de senha revogam sessões imediatamente. Tokens no `localStorage`, mitigado por CSP estrita (`script-src 'self'`). |
| 4 | **E-mails transacionais via fila** (API → Redis/BullMQ → worker → SMTP). | A requisição nunca espera o SMTP; novas tentativas com backoff; links nunca registrados em log. |
| 5 | **Guards globais seguros por padrão**: Throttler → Auth → Access (`@Roles`, `@RequiresPlan`). Rotas públicas exigem `@Public()` explícito. | Esquecer um decorator falha fechado, não aberto. |
| 6 | **Assinatura decidida só no backend** (`EntitlementsService.entitledPlan`), a partir do estado confirmado no banco. | Atende "nunca ativar pelo redirect de sucesso"; o estado só mudará via webhook validado (Etapa 10). Worker trata as transições temporais. |
| 7 | **XP como livro-razão com chave de idempotência única** (`xp_transactions.idempotency_key`). | Replays/duplicações não geram XP em dobro; totais atualizados na mesma transação. |
| 8 | **Dinheiro em centavos + moeda ISO**, preços configurados por moeda (`plan_prices`). | Sem float, sem conversão inventada. Só BRL foi semeado. |
| 9 | **Universos são dados** (`universes` + `universe_settings`: tema, features, identidade). | Novos universos pelo painel admin sem rebuild; o web aplica os tokens como CSS variables. |
| 10 | **Redis opcional em dev, obrigatório em produção** (validado no boot). | Cache e rate limit degradam com segurança localmente; em produção o limite é distribuído entre réplicas (script Lua atômico). |
| 11 | **Dockerfiles multi-stage + `pnpm deploy`** por serviço, config-as-code `railway.json`. | Builds reprodutíveis, imagens só com dependências de produção, deploy independente por `watchPatterns`. |
| 12 | **TypeScript 7 (tsc nativo)**; testes da API com Vitest + SWC (metadata de decorators). | Typecheck rápido; DI do NestJS funciona nos testes. |

## Frontend

- **Roteamento** com `react-router` 8 e *code splitting* por rota (`lazy`). Chunks de vendor separados (react, motion, i18n) para cache longo.
- **Dados** com TanStack Query (sem retry em 4xx, cancelamento por `AbortSignal`).
- **Estados**: toda página tem carregamento (skeletons), erro (com "tentar novamente"), vazio e sucesso.
- **i18n**: i18next com `pt-BR` e `en` (paridade de chaves testada); `Intl` para datas, números e moedas; idioma persistido no perfil.
- **Identidade visual**: tokens Tailwind (`void`, `arcane`, `mystic`, `gold`, `mist`), Cinzel (fantasia) + Inter (tecnologia), vidro, partículas em canvas (pausa em aba oculta e respeita `prefers-reduced-motion`), luz que segue o cursor nos cards, transições de página.
- **PWA**: manifest, ícones (inclui maskable) e service worker que **nunca** armazena respostas da API.

### Trilhas sonoras dos universos

Cada universo tem uma **trilha original** composta para o Fandom Universe (`apps/web/src/lib/music/`): não usamos nem imitamos músicas oficiais, que têm direitos autorais. A música é sintetizada no navegador com Web Audio (sem arquivos de áudio nem serviços externos):

- `synth.ts`: instrumentos (cordas, celesta, piano, metais, guitarra, baixo, bateria) e reverb gerado.
- `themes.ts`: tema por universo (tom, andamento, acordes, melodia e arranjo); universos novos usam um tema genérico até ganharem o seu.
- `player.ts`: agendador sobre o relógio de áudio (lookahead), crossfade entre universos, pausa com a aba oculta.
- `components/UniverseMusic.tsx`: toca nas páginas de um universo (e nas subpáginas: jogos, eventos, fórum), para ao sair, e tem botão de silenciar e volume, lembrados no aparelho. Pela regra de autoplay dos navegadores, o som começa no primeiro clique ou toque.

Os testes renderizam cada trilha offline no navegador e verificam volume audível, sem saturação.
