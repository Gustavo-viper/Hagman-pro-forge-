# Hangman Pro — Versão Completa Local
Forge Studios

## O que já está pronto
- Logo oficial fornecida pelo projeto em `assets/hangman-pro-logo.jpg`
- Tela inicial
- Menu
- Categorias
- 3 dificuldades
- Partida jogável
- Teclado virtual
- Forca animada por erros
- Sistema de vitória/derrota
- XP
- Coins
- Níveis
- Sequência de vitórias
- Missões
- Ranking local
- Loja com inventário
- Dicas com custo
- Perfil
- Salvamento automático em localStorage
- Responsivo para celular e PC

## Abrir
Abra `index.html` no navegador ou use Live Server no VS Code.

## Próxima integração
Para transformar em versão online:
1. Supabase Auth
2. Tabela profiles
3. Tabela player_progress
4. Tabela leaderboard
5. Tabela achievements
6. Tabela missions
7. Tabela inventory
8. RLS por jogador
9. Ranking global
10. Login/Google/Email

A logo não é recriada por CSS: o site usa diretamente o arquivo `assets/hangman-pro-logo.jpg`.


## Sistema de temas — corrigido
Agora os temas da loja funcionam de verdade:
- Ao comprar um tema, ele é automaticamente equipado.
- O tema altera as cores do site inteiro.
- O tema altera a tela de partida, teclado, bordas, botões, HUD e elementos neon.
- Temas comprados podem ser equipados novamente sem pagar.
- O tema ativo é salvo no `localStorage` e continua ativo ao recarregar a página.
- O botão da loja mostra `✓ EQUIPADO` no tema ativo e `EQUIPAR` nos temas já comprados.
