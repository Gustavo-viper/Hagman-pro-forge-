# App de corridas (Rota Livre)

Aplicativo de corridas completo: passageiro, motorista e painel administrativo, em um único servidor Node.js.
Funciona no navegador do celular e pode ser instalado na tela inicial (PWA).

## O que tem

- **Passageiro**: cadastro, embarque pelo GPS, destino por busca, toque no mapa ou destinos recentes, preço antes
  de confirmar, pagamento em dinheiro ou Pix direto ao motorista, carro no mapa em tempo real com tempo de chegada,
  código de 4 dígitos para iniciar, chat com o motorista, compartilhar viagem, botão de emergência (190),
  "pedir de novo", avaliação e histórico.
- **Motorista**: cadastro com qualquer carro de qualquer ano (declaração de bom estado + foto do carro e da CNH),
  ou a partir de uma conta de passageiro (Menu › Quero ser motorista). Fica online, recebe pedidos com som,
  vibração e notificação push, aceita, navega pelo Google Maps/Waze, conversa com o passageiro, inicia com o
  código, finaliza, vê ganhos e cadastra a chave Pix.
- **Conta**: mostrar senha, "esqueci minha senha" (a administração gera uma nova e envia pelo WhatsApp),
  troca de senha e exclusão da conta (LGPD).
- **Admin** (`/admin`): aprovar/recusar/bloquear motoristas (com foto da CNH), gerar nova senha, mapa ao vivo
  de motoristas e corridas, cancelar corrida travada, definir tarifas, comissão, raio de busca e WhatsApp de
  suporte, controlar comissão a receber e baixar backup do banco.

## Notificações push

O servidor gera as chaves (VAPID) sozinho na primeira execução e as guarda no banco. Os avisos chegam quando o
app está em segundo plano: novo pedido (motorista), motorista a caminho / chegou / cancelou, corrida sem
motorista, nova mensagem e cadastro aprovado.

- **Android**: funciona no Chrome, com ou sem instalar.
- **iPhone**: só funciona com o app adicionado à Tela de Início pelo Safari (iOS 16.4+). O app mostra o passo a passo.

## Rodar

```bash
cd corridas
npm install
ADMIN_PASSWORD=sua-senha npm start   # abre em http://localhost:3000
```

Requer Node.js 22.13 ou mais novo (usa o SQLite embutido). O GPS do navegador só funciona em HTTPS (ou localhost).

| Variável | Para quê |
| --- | --- |
| `ADMIN_PASSWORD` | Senha do painel `/admin` (se faltar, uma senha temporária aparece no log) |
| `APP_NAME` | Nome exibido no app (padrão: Rota Livre) |
| `DATA_DIR` | Pasta do banco e das fotos — precisa ser um volume persistente em produção |
| `PORT` | Porta HTTP |
| `ONLINE_TTL_MIN` | Minutos que o motorista continua online sem enviar localização (app em segundo plano). Padrão: 15 |
| `VAPID_SUBJECT` | Contato para o serviço de push (`mailto:` ou `https://`). No Railway usa o domínio público automaticamente |

## Teste

`npm test` percorre o fluxo inteiro no navegador (precisa do Playwright instalado).

## Limites conhecidos

- Mapas, busca de endereço e rotas usam serviços públicos gratuitos do OpenStreetMap (tiles OSM, Photon, OSRM).
  Servem para começar; com muito uso é preciso contratar um provedor de mapas. Se a rota falhar, o preço é
  estimado pela distância em linha reta.
- Não há pagamento online nem confirmação do celular por SMS.
- Com o app fechado (não só em segundo plano) e sem push ativado, o motorista não recebe pedidos.
- "Esqueci minha senha" depende da administração enviar a nova senha (não há SMS).
- Um único servidor com SQLite: suficiente para uma cidade pequena/média.
