<div align="center">

# FANDOM UNIVERSE

**ONE PLATFORM. INFINITE UNIVERSES.**

A rede social internacional de comunidades de fãs da **Forge Studios Tecnologias em Softwares LTDA.**

</div>

> Comunidade de fãs independente e não oficial. Não é afiliada, patrocinada ou endossada pelos detentores dos direitos das obras citadas.

---

## Visão geral

Fandom Universe é uma plataforma **multiuniverso**: cada universo (Harry Potter, Supernatural e os próximos) é um módulo de dados com identidade visual, sistema de identidade (casas, patentes de caçador…) e funcionalidades próprias — cadastrado no banco, sem rebuild do sistema. Um único usuário possui uma conta para todos os universos.

| Serviço | Pasta | Tecnologia | Railway |
|---|---|---|---|
| **fandom-web** | `apps/web` | React 19 · TypeScript · Vite · Tailwind CSS v4 · shadcn/ui · Framer Motion · PWA | `apps/web/railway.json` |
| **fandom-api** | `apps/api` | NestJS 12 · REST versionada (`/v1`) · Zod · Supabase Auth (JWT) | `apps/api/railway.json` |
| **fandom-worker** | `apps/worker` | BullMQ · jobs agendados | `apps/worker/railway.json` |
| **fandom-redis** | — | Redis 7 (cache, rate limit distribuído, filas) | template Redis |
| Banco | `database/` | PostgreSQL (Supabase) · migrations SQL versionadas · RLS | — |

Pacotes compartilhados: `packages/shared` (regras de domínio), `packages/schemas` (Zod — mesma validação no browser e na API), `packages/types` (contratos da API), `packages/ui` (design system).

## Estado atual — Etapa 1 (Foundation Build) ✅

Veja o relatório completo em [`docs/STAGE-01-REPORT.md`](docs/STAGE-01-REPORT.md) e o roadmap/pendências em [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Início rápido (local)

Pré-requisitos: **Node.js ≥ 22.22**, **pnpm 10** (`corepack enable`), PostgreSQL 16 e Redis 7 (nativos ou via Docker).

```bash
# 1. Dependências
pnpm install

# 2. Variáveis de ambiente
cp .env.example .env            # preencha SUPABASE_* e VITE_SUPABASE_* (ver docs/DEPLOYMENT.md §2)

# 3. PostgreSQL + Redis locais (opcional se já tiver instalados)
pnpm infra:up

# 4. Banco: migrations + políticas RLS + dados de referência
pnpm db:migrate && pnpm db:seed

# 5. Subir tudo (web :5173, api :3000, worker :3100)
pnpm dev
```

> Um único `.env` na raiz serve todos os serviços. Apenas variáveis `VITE_*` chegam ao navegador.

Sem credenciais do Supabase a aplicação funciona nas áreas públicas e mostra um aviso claro nas telas de autenticação.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | Todos os serviços em modo desenvolvimento (Turborepo) |
| `pnpm build` | Build de produção de todos os pacotes |
| `pnpm typecheck` | Verificação de tipos em todo o monorepo |
| `pnpm test` | Testes unitários e de integração (Vitest). Integração requer `TEST_DATABASE_URL` / `TEST_REDIS_URL` |
| `pnpm test:e2e` | Playwright contra a stack real (API compilada + build do web + PostgreSQL + Redis) |
| `pnpm db:migrate` / `db:seed` / `db:status` | Banco de dados |
| `pnpm check:secrets` | Bloqueia segredos commitados |

Testes de integração locais:

```bash
export TEST_DATABASE_URL=postgres://fandom:fandom@localhost:5432/fandom_test
export TEST_REDIS_URL=redis://localhost:6379/1
pnpm build && pnpm test && pnpm test:e2e
```

## Documentação

- [Arquitetura e decisões técnicas](docs/ARCHITECTURE.md)
- [API REST v1](docs/API.md)
- [Banco de dados](docs/DATABASE.md)
- [Implantação na Railway + Supabase](docs/DEPLOYMENT.md)
- [Segurança, LGPD e proteção de menores](docs/SECURITY.md)
- [Roadmap e pendências](docs/ROADMAP.md)

## Projeto legado

O jogo **Hangman Pro** que existia neste repositório foi preservado integralmente em [`legacy/hangman-pro/`](legacy/hangman-pro/) e continua funcionando de forma independente (abra `legacy/hangman-pro/index.html`).

---

© Forge Studios Tecnologias em Softwares LTDA. Todos os direitos reservados.
