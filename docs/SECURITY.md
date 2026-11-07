# Segurança, privacidade e LGPD

## Implementado na Etapa 1

| Controle | Onde |
|---|---|
| Autenticação própria: senhas com scrypt (N=2¹⁷, sal único, comparação em tempo constante), JWT HS256 de 15 min (`iss`/`aud`/`exp` verificados), refresh token opaco rotativo com detecção de reuso (revoga a família), sessões revogáveis (logout invalida o access token na hora) | `apps/api/src/auth/*` |
| Bloqueio após 10 logins falhos por e-mail (15 min), limite por IP nas rotas de credenciais, resposta idêntica para conta inexistente e senha errada (com hash fictício para igualar o tempo) | `auth.service.ts`, `auth.controller.ts` |
| Links de verificação/redefinição de uso único, curta duração, armazenados só como SHA-256; redefinir senha encerra todas as sessões; recuperação não revela se o e-mail existe | `auth_tokens` |
| Guard global seguro por padrão (rota sem `@Public()` exige token) | `auth.guard.ts` |
| RBAC: Super Admin, Administrador, Moderador global, Moderador de universo, Editor, Suporte (`@Roles`) | `user_roles`, `access.guard.ts` |
| Áreas premium verificadas no backend (`@RequiresPlan`) com estado confirmado no banco | `entitlements.service.ts` |
| Contas suspensas/banidas bloqueadas em toda requisição | `auth.guard.ts` |
| Bootstrap de super admin restrito (e-mail verificado + apenas enquanto não existir nenhum) e auditado | `users.service.ts` |
| SQL sempre parametrizado (sem concatenação de entrada) | todos os serviços |
| Validação Zod de todas as entradas; corpo JSON limitado a 256 KB | `zod.pipe.ts`, `bootstrap.ts` |
| Erros sem stack/SQL/mensagens internas | `http-exception.filter.ts` |
| Rate limiting distribuído (Redis, script Lua atômico) | `redis-throttler.storage.ts` |
| Helmet, CORS por lista exata de origens, `trust proxy` de 1 salto | `bootstrap.ts` |
| CSP restritiva, HSTS, `X-Frame-Options: DENY`, `Permissions-Policy` no web | `apps/web/server.mjs` |
| XSS: React escapa saída; nomes rejeitam `<`, `>` e caracteres de controle | `schemas/common.ts` |
| Banco somente na rede privada da Railway; RLS habilitado em todas as tabelas (defesa em profundidade) | `database/policies` |
| TLS no banco (`verify-full` com CA) e obrigatoriedade de TLS remoto em produção | `config/env.ts` |
| Auditoria *append-only* | `audit_logs` |
| Idempotência de XP | `xp_transactions.idempotency_key` |
| Varredura de segredos no CI | `infrastructure/scripts/check-secrets.mjs` |
| Imagens Docker rodando como usuário não-root | `infrastructure/docker/*` |
| Service worker nunca armazena respostas da API | `apps/web/public/sw.js` |

## LGPD

- Registro de consentimento com versão do documento, data, IP e user-agent (`user_consents`), exigido no onboarding.
- Bases legais e direitos do titular descritos na Política de Privacidade (`/legal/privacy`).
- Data de nascimento nunca exibida; usada apenas para proteção de menores.
- Minimização: logs HTTP não registram cabeçalhos, tokens nem corpos.

## Proteção de menores

- Idade mínima de **13 anos** (bloqueio `age_restricted` no backend).
- Usuários de 13–17 anos (`is_minor`): perfil visível só para membros, mensagens apenas de amigos, status online oculto, **nunca** recebem marketing (mesmo se marcarem a opção).

## Pendente (ver ROADMAP.md)

Exclusão/exportação de conta self-service, moderação e denúncias, validação de uploads, proteção antispam, revisão jurídica dos documentos, consentimento parental verificável para 13–15 anos se exigido pela assessoria jurídica, testes de restauração de backup, pentest antes do lançamento.
