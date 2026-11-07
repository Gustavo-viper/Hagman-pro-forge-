# Relatório técnico — Etapa 1: Foundation Build

**Projeto:** Fandom Universe · **Empresa:** Forge Studios Tecnologias em Softwares LTDA. · **Data:** 2026-11-07

## 1. Análise do ambiente

Node.js 22, pnpm 10, PostgreSQL 16, Redis 7, Docker e Chromium/Playwright disponíveis. O repositório continha o jogo **Hangman Pro** (HTML/JS estático), preservado sem alterações em `legacy/hangman-pro/`.

Versões adotadas: React 19.3 · Vite 8 (Rolldown) · Tailwind CSS 4.3 · Framer Motion 14 · React Router 8 · TanStack Query 5 · i18next 27 · NestJS 12 (ESM) · Zod 4 · BullMQ 5 · Vitest 5 · Playwright 1.63 · TypeScript 7 · Turborepo 2.

## 2. Concluído

**Monorepositório** — pnpm + Turborepo, pacotes `shared`, `schemas`, `types`, `ui`, `database`, apps `web`, `api`, `worker`, `tests` (E2E).

**Banco de dados** — 6 migrations versionadas (14 tabelas, chaves estrangeiras, CHECKs alinhados às constantes de domínio, índices de ranking, triggers de `updated_at` e contagem de membros), política RLS para Supabase, seeds dos universos Harry Potter e Supernatural e dos planos Free/Plus/Ultra com preços oficiais em BRL. Executor com lock consultivo, transação por migration e checksum.

**Autenticação** — Supabase Auth no web (cadastro, confirmação de e-mail via PKCE, login, recuperação e redefinição de senha); API verifica JWT (JWKS ou HS256), espelha usuários, bloqueia suspensos, RBAC com 6 papéis, `@RequiresPlan` para áreas premium e bootstrap seguro de super admin.

**API** — health/readiness, universos (listar, detalhar, entrar, sair), planos por moeda, `/me`, dashboard, onboarding (consentimento LGPD, menores, +50 XP idempotente), preferências; erros com códigos estáveis; rate limit distribuído; cache Redis; logs JSON com request id.

**Worker** — BullMQ com agendador idempotente e job de ciclo de vida das assinaturas (pending expirado, tolerância past_due, cancelamento ao fim do período) com histórico e `SKIP LOCKED`; health check.

**Identidade visual e web** — paleta híbrida tecnologia + fantasia, logo original, partículas, vidro, gradientes, iluminação que segue o cursor, transições de página e microinterações; landing page, explorar universos, página temática de cada universo, login, cadastro, recuperação/redefinição de senha, callback, dashboard com onboarding, termos, privacidade e 404. Todas as páginas com estados de carregamento, erro, vazio e sucesso. PWA instalável. pt-BR e en.

**Railway** — Dockerfiles multi-stage (não-root), `railway.json` por serviço (health check, restart, watch patterns, pre-deploy de migrations), `.env.example` completo, CI no GitHub Actions, verificador de segredos, guia de implantação.

## 3. Testes executados

| Suíte | Resultado |
|---|---|
| `packages/shared` — níveis/XP, dinheiro, texto | 9 ✅ |
| `packages/schemas` — validações compartilhadas | 18 ✅ |
| `database` — migrations, idempotência, seeds, RLS, checksum, XP | 6 ✅ (PostgreSQL real) |
| `apps/api` — integração HTTP completa | 31 ✅ (PostgreSQL + Redis reais) |
| `apps/worker` — ciclo de vida de assinaturas | 3 ✅ (PostgreSQL real) |
| `apps/web` — i18n, erros, validação, planos | 6 ✅ |
| **E2E Playwright** (desktop + mobile) — landing, idioma, universo, 404, redirecionamento, validação, **onboarding → XP → entrar/sair de universo** | 13 ✅ |
| Typecheck (13 tarefas) · Build (7 tarefas) · `check:secrets` | ✅ |

Validações manuais: API e worker compilados iniciando com health/readiness, logs JSON, CORS restrito, desligamento gracioso; política RLS testada com roles `anon`/`authenticated`; bundles `pnpm deploy` de produção iniciando corretamente; screenshots desktop/mobile sem erros de console.

Defeitos encontrados e corrigidos pelos testes: vazamento de mensagem interna do parser JSON; corrida de conexão Redis no boot; falta de fallback IPv4; política RLS dependente do schema `auth`; erro de desmontagem de efeito no redirecionamento para login; plural "0 membro" em pt-BR; testes de integração concorrentes no mesmo banco.

## 4. Arquivos

**Criados:** `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.env.example`, `.gitignore`, `.dockerignore`, `.npmrc`, `.nvmrc`, `.editorconfig`, `README.md`, `.github/workflows/ci.yml`, `apps/{web,api,worker}/**`, `packages/{shared,schemas,types,ui}/**`, `database/**`, `tests/**`, `infrastructure/**`, `docs/**`.

**Modificados/movidos:** arquivos do Hangman Pro movidos (sem alterações de conteúdo) para `legacy/hangman-pro/`; o README original foi para `legacy/hangman-pro/README.md`.

## 5. Pendente

Ver [`ROADMAP.md`](ROADMAP.md). Itens dependentes de credenciais: projeto Supabase, conta Railway, provedor de pagamento, SMTP e revisão jurídica. O `docker build` não pôde ser executado neste ambiente por ausência de rede no builder; a etapa de empacotamento equivalente foi validada.

## 6. Como iniciar e implantar

Local: [`README.md` → Início rápido](../README.md#início-rápido-local). Railway: [`DEPLOYMENT.md`](DEPLOYMENT.md).
