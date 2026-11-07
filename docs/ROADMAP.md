# Roadmap e pendências

Legenda: ✅ concluído e validado · 🟡 parcial (fundação pronta) · ⏳ próxima etapa

| Etapa | Escopo | Estado |
|---|---|---|
| 1 | Fundação: monorepo, web, api, worker, Railway | ✅ |
| 2 | Banco de dados e autenticação | 🟡 núcleo pronto (users, profiles, consents, roles, audit, XP, assinaturas). Faltam tabelas sociais/jogos/loja e fluxos de conta (exclusão, exportação) |
| 3 | Design system e interface | 🟡 identidade, tokens, componentes base, partículas, transições. Faltam componentes de feed, modais, toasts, tema por assinante |
| 4 | Perfis e usuários | ⏳ perfil público, avatar/capa (armazenamento de objetos — Railway Volume ou bucket S3 compatível), bio, seguidores, amigos, bloqueios, privacidade, histórico, exclusão de conta |
| 5 | Motor multiuniverso | 🟡 universos como dados, temas, identidade, participação. Faltam: teste de seleção de casa, salões comunais, bestiário, investigações, conteúdo por universo |
| 6 | Feed e rede social | ⏳ posts, imagens, enquetes, reações, comentários aninhados, compartilhar, salvar, denúncias, paginação por cursor |
| 7 | Grupos e comunidades | ⏳ grupos públicos/privados, fóruns, tópicos, moderação |
| 8 | Mensagens e notificações | ⏳ WebSocket (gateway NestJS + Redis adapter), DMs, grupos, notificações em tempo real |
| 9 | Jogos e gamificação | 🟡 livro-razão de XP idempotente e curva de níveis prontos. Faltam quizzes, missões, conquistas, rankings semanais/mensais/gerais |
| 10 | Premium, pagamentos, marketplace | 🟡 planos/preços/estado/entitlements/job de ciclo de vida/`@RequiresPlan`. Faltam provedor, checkout, webhooks, `/premium`, `/account/subscription`, Fandom Coins, inventário |
| 11 | Painel administrativo | 🟡 RBAC + auditoria + bootstrap de super admin. Falta `/admin` (dashboard, gestão, cadastro de universos) |
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
