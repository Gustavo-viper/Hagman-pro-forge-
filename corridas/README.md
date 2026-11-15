# App de corridas (Rota Livre)

Aplicativo de corridas completo: passageiro, motorista e painel administrativo, em um único servidor Node.js.
Funciona no navegador do celular e pode ser instalado na tela inicial (PWA).

## O que tem

- **Passageiro**: cadastro, embarque pelo GPS, destino por busca ou toque no mapa, preço antes de confirmar,
  pagamento em dinheiro ou Pix direto ao motorista, acompanhamento do carro em tempo real, código de 4 dígitos
  para iniciar, compartilhar viagem, avaliação e histórico.
- **Motorista**: cadastro com qualquer carro de qualquer ano (declaração de bom estado + foto), ficar online,
  receber pedidos com som/vibração, aceitar, navegar pelo Google Maps/Waze, iniciar com o código, finalizar,
  ganhos do dia e chave Pix.
- **Admin** (`/admin`): aprovar/recusar/bloquear motoristas, ver passageiros e corridas, definir tarifas,
  comissão, raio de busca e WhatsApp de suporte, controlar comissão a receber.

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

## Teste

`npm test` percorre o fluxo inteiro no navegador (precisa do Playwright instalado).

## Limites conhecidos

- Mapas, busca de endereço e rotas usam serviços públicos gratuitos do OpenStreetMap (tiles OSM, Photon, OSRM).
  Servem para começar; com muito uso é preciso contratar um provedor de mapas. Se a rota falhar, o preço é
  estimado pela distância em linha reta.
- Não há pagamento online nem confirmação do celular por SMS.
- O motorista precisa manter o app aberto para receber pedidos (não há notificação push).
- Um único servidor com SQLite: suficiente para uma cidade pequena/média.
