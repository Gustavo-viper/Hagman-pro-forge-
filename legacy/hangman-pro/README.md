# Hangman Pro — Forge Studios

Versão offline-first do Hangman Pro.

## Novidades desta versão

- Jogo preparado para funcionar offline após o primeiro carregamento no navegador/PWA.
- Service Worker com cache local dos arquivos do jogo.
- Progresso, moedas, XP, conquistas, itens e histórico de palavras salvos em `localStorage`.
- **1.200 palavras únicas**, distribuídas em 12 categorias.
- Cada palavra recebe dificuldade automática por tamanho: Fácil (até 7), Normal (8–10), Difícil (11+).
- O jogo registra as palavras já utilizadas por categoria/dificuldade e não as repete até o conjunto ser concluído.
- Todas as palavras possuem dica desbloqueável.
- Botão de dica corrigido: custa 25 moedas, revela a dica e muda para “DICA DESBLOQUEADA”.
- Loja expandida com skins independentes para **o boneco** e para **a forca**, além de temas, fundos, avatar e efeitos.
- Manifesto PWA para instalação no navegador compatível.

## Estrutura

- `index.html` — interface
- `style.css` — visual
- `app.js` — lógica do jogo, progressão, loja e salvamento
- `words.js` — banco local de 1.200 palavras e dicas
- `sw.js` — cache offline
- `manifest.json` — instalação como aplicativo
- `assets/hangman-pro-logo.jpg` — logo

## Observação sobre o modo offline

Na versão Web/PWA, o navegador precisa abrir o jogo pelo menos uma vez com internet para instalar o Service Worker e armazenar os arquivos. Depois disso, o jogo pode continuar funcionando sem internet. Em um futuro APK, esses mesmos arquivos podem ser empacotados dentro do aplicativo para permitir a abertura offline desde a instalação.
