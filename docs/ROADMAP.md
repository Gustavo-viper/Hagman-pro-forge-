# Roadmap e pendências

Legenda: ✅ concluído e validado · 🟡 parcial (fundação pronta) · ⏳ próxima etapa

| Etapa | Escopo | Estado |
|---|---|---|
| 1 | Fundação: monorepo, web, api, worker, Railway | ✅ |
| 2 | Banco de dados e autenticação | 🟡 núcleo pronto (users, profiles, consents, roles, audit, XP, assinaturas). Faltam tabelas sociais/jogos/loja e fluxos de conta (exclusão, exportação) |
| 3 | Design system e interface | 🟡 identidade, tokens, componentes base, partículas, transições. Faltam componentes de feed, modais, toasts, tema por assinante |
| 4 | Perfis e usuários | ⏳ perfil público, avatar/capa (armazenamento de objetos — Railway Volume ou bucket S3 compatível), bio, seguidores, amigos, bloqueios, privacidade, histórico, exclusão de conta |
| 5 | Motor multiuniverso | ✅ 10 universos (incluindo Animes e Games), biblioteca de livros com estante pessoal em todos, todas as funcionalidades listadas ligadas a 5 motores (arquivo, comunidade, missões, eventos, disputa) + quizzes, identidade e ranking. Falta editor de conteúdo no admin |
| 6 | Feed e rede social | ⏳ posts, imagens, enquetes, reações, comentários aninhados, compartilhar, salvar, denúncias, paginação por cursor |
| 7 | Grupos e comunidades | 🟡 fóruns por universo e categoria, salões comunais por identidade, denúncias e moderação. Faltam grupos privados criados por usuários |
| 8 | Mensagens e notificações | ⏳ WebSocket (gateway NestJS + Redis adapter), DMs, grupos, notificações em tempo real |
| 9 | Jogos e gamificação | 🟡 25 quizzes (fácil/normal/difícil, 182 perguntas), desafio diário com sequência, contra o relógio, forca com 180 palavras, placares por jogo, desafios ligados aos jogos; quizzes com correção no servidor e XP anti-farm, rankings geral/mensal/semanal por universo. missões e eventos com sala ao vivo (chat em tempo real via SSE, placar do quiz da noite, link de live só para inscritos, lembretes por e-mail 24 h/1 h). Faltam conquistas/medalhas e editor de quizzes no admin |
| 10 | Premium, pagamentos, marketplace | 🟡 InfinitePay (checkout, confirmação server-side, webhooks, períodos pré-pagos, lembretes), `/premium` com comparação de planos, `/account/subscription`; vantagens reais: bônus de XP, limites maiores, Modo Sobrevivência, Sala VIP, missões Premium, selos. Faltam áreas exclusivas com conteúdo, Fandom Coins, inventário, loja |
| 11 | Painel administrativo | 🟡 `/admin`: indicadores, usuários, liberar/bloquear plano, suspender conta, auditoria. criar/editar/cancelar eventos, fila de denúncias. Faltam gestão de universos, conteúdo, cupons e papéis pela interface |
| 12 | Segurança, testes, otimização, lançamento | 🟡 ver SECURITY.md |

## Pendências que dependem de credenciais/decisões externas

| Item | Dependência | O que já está pronto |
|---|---|---|
| Envio de e-mails (verificação, redefinição de senha) | Provedor SMTP (`SMTP_URL` no `fandom-worker`) | Fila, templates pt-BR/en, novas tentativas; cadastro e login funcionam sem SMTP |
| Deploy | ✅ Concluído no projeto Railway `Trilha Demo` | Dockerfiles, serviços, pre-deploy de migrations, health checks |
| Build Docker | ✅ Validado na Railway. Antes: o sandbox de desenvolvimento não tem rede dentro do `docker build`. O empacotamento `pnpm deploy` usado pelos Dockerfiles foi executado e testado localmente | Executar `docker build` (DEPLOYMENT.md §7) ou o primeiro deploy na Railway |
| Pagamentos | Escolha e credenciais do provedor (Mercado Pago ou Stripe) | Tabelas de planos/preços/assinaturas/histórico, colunas `provider*`, lógica de entitlement e expiração |
| Preços internacionais | Definição comercial por moeda | `plan_prices` aceita qualquer moeda ISO; a API só exibe preços explicitamente configurados |
| Textos legais | Revisão jurídica | Termos e Política publicados com versão e aviso de revisão; consentimentos versionados |
| Consentimento parental (13–15) | Parecer jurídico | Regras de menor aplicadas (13–17) e bloqueio < 13 |

## Melhorias técnicas registradas

- Migrar `throttler` por IP para chave por usuário autenticado em rotas sensíveis.
- Observabilidade: exportar métricas/trace (OpenTelemetry) e alertas.
- Gerar OpenAPI a partir dos schemas Zod.
- Pré-compressão brotli dos assets no build.
