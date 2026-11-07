/**
 * Test double of the InfinitePay Checkout API (E2E only — never used in production).
 * Implements POST /links and POST /payment_check as documented, enforcing X-Api-Key + handle.
 * The returned "checkout URL" simulates a buyer who paid and was redirected back.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.FAKE_IP_PORT ?? 3902);
const WEB = process.env.FAKE_IP_WEB_URL ?? 'http://localhost:4901';
const KEY = 'inchk_e2e_key';
const HANDLE = 'fandome2e';
const links = new Map();

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true });
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    if (req.headers['x-api-key'] !== KEY) return json(res, 403, { error: 'invalid api key' });
    const body = JSON.parse(raw || '{}');
    if (body.handle !== HANDLE) return json(res, 403, { error: 'handle mismatch' });
    if (req.method === 'POST' && req.url === '/links') {
      const item = body.items?.[0];
      if (!body.order_nsu || !item || item.price < 100 || !body.options?.single_payment) return json(res, 400, { error: 'bad payload' });
      links.set(body.order_nsu, { amount: item.price, tx: `tx-${body.order_nsu}`, slug: `inv-${body.order_nsu}` });
      const back = new URL('/account/subscription', WEB);
      back.searchParams.set('order_nsu', body.order_nsu);
      back.searchParams.set('transaction_nsu', `tx-${body.order_nsu}`);
      back.searchParams.set('slug', `inv-${body.order_nsu}`);
      back.searchParams.set('capture_method', 'pix');
      return json(res, 200, { url: back.toString() });
    }
    if (req.method === 'POST' && req.url === '/payment_check') {
      const l = links.get(body.order_nsu);
      const ok = l && l.tx === body.transaction_nsu && l.slug === body.slug;
      return json(res, 200, ok
        ? { success: true, paid: true, amount: l.amount, paid_amount: l.amount, installments: 1, capture_method: 'pix' }
        : { success: false, paid: false });
    }
    json(res, 404, { error: 'not found' });
  });
}).listen(PORT, '127.0.0.1');
