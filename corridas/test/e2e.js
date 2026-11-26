'use strict';
/*
 * Teste de ponta a ponta: sobe o servidor com banco temporário e percorre o fluxo
 * completo no navegador (cadastro, aprovação, pedido, aceite, código, viagem, avaliação).
 * Requer Playwright disponível no ambiente:  node test/e2e.js [pasta-para-screenshots]
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require('playwright');

const PORT = 3999, BASE = `http://localhost:${PORT}`;
const shots = process.argv[2];
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'corridas-'));
const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
  env: { ...process.env, PORT, DATA_DIR: dataDir, ADMIN_PASSWORD: 'admin-teste', GEO_DISABLED: '1', APP_NAME: 'Rota Livre' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOut = '';
server.stdout.on('data', (b) => { serverOut += b; process.stdout.write(b); });
server.stderr.on('data', (b) => { serverOut += b; process.stderr.write(b); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (page, name) => { if (shots) await page.screenshot({ path: path.join(shots, `${name}.png`) }); };

async function main() {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`${BASE}/health`)).ok) break; } catch { await sleep(100); } }
  const browser = await chromium.launch();
  const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: shots ? 2 : 1, isMobile: true, hasTouch: true, locale: 'pt-BR', permissions: ['geolocation'] };
  const pCtx = await browser.newContext({ ...phone, geolocation: { latitude: -23.5505, longitude: -46.6333 } });
  const dCtx = await browser.newContext({ ...phone, geolocation: { latitude: -23.556, longitude: -46.64 } });
  const aCtx = await browser.newContext({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: shots ? 2 : 1 });
  const qCtx = await browser.newContext({ ...phone, geolocation: { latitude: -23.55, longitude: -46.63 } });
  const P = await pCtx.newPage(), D = await dCtx.newPage(), A = await aCtx.newPage(), Q = await qCtx.newPage();
  const jpeg = await A.screenshot({ type: 'jpeg', quality: 40 });
  const img = (name) => ({ name, mimeType: 'image/jpeg', buffer: jpeg });
  const post = async (url, body, token) => {
    const res = await fetch(`${BASE}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body || {}) });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  const errors = [];
  for (const [n, pg] of [['passageiro', P], ['motorista', D], ['admin', A], ['outro', Q]]) {
    pg.on('pageerror', (e) => errors.push(`${n}: ${e.message}`));
    pg.on('dialog', (d) => d.accept());
  }

  // --- motorista se cadastra (carro antigo) e fica em análise
  await D.goto(BASE);
  await shot(D, '01-boas-vindas');
  await D.click('text=Quero ser motorista');
  await D.fill('[name=name]', 'Carlos Motorista');
  await D.fill('[name=phone]', '(11) 98888-0001');
  await D.fill('[name=password]', 'segredo1');
  await D.fill('[name=car_brand]', 'Fiat');
  await D.fill('[name=car_model]', 'Uno');
  await D.fill('[name=car_year]', '1998');
  await D.fill('[name=car_color]', 'Prata');
  await D.fill('[name=car_plate]', 'abc1d23');
  await D.fill('[name=cnh]', '12345678901');
  await D.setInputFiles('[name=photo]', img('carro.jpg'));
  await D.setInputFiles('[name=cnh_file]', img('cnh.jpg'));
  await D.click('[data-action=toggle-pw]');
  assert.equal(await D.getAttribute('[name=password]', 'type'), 'text');
  await D.click('button[type=submit]');
  await D.waitForSelector('text=É preciso aceitar'); // validação dos termos
  await D.check('[name=car_ok]');
  await D.check('[name=accept_terms]');
  await shot(D, '02-cadastro-motorista');
  await D.click('button[type=submit]');
  await D.waitForSelector('text=Cadastro em análise');
  await shot(D, '03-motorista-em-analise');

  // --- admin aprova
  await A.goto(`${BASE}/admin`);
  await A.fill('[name=password]', 'errada');
  await A.click('button[type=submit]');
  await A.waitForSelector('text=Senha incorreta');
  await A.fill('[name=password]', 'admin-teste');
  await A.click('button[type=submit]');
  await A.click('[data-tab=drivers]');
  await A.waitForSelector('text=Aguardando aprovação');
  await A.waitForSelector('text=Ver CNH');
  await shot(A, '04-admin-motoristas');
  await A.click('text=Aprovar');
  await D.waitForSelector('text=Você está offline');
  await D.click('text=Ficar online');
  await D.waitForSelector('text=Você está online');
  await shot(D, '05-motorista-online');

  // --- passageiro se cadastra e pede corrida
  await P.goto(BASE);
  await P.click('text=Quero pedir corridas');
  await P.fill('[name=name]', 'Ana Passageira');
  await P.fill('[name=phone]', '11977770002');
  await P.fill('[name=password]', 'segredo2');
  await P.check('[name=accept_terms]');
  await P.click('button[type=submit]');
  await P.waitForSelector('text=Para onde vamos, Ana?');
  await P.waitForFunction(() => document.querySelector('input[data-field=pickup]')?.value);
  await shot(P, '06-passageiro-inicio');
  await sleep(600);
  await P.mouse.click(320, 170); // marca o destino tocando no mapa
  await P.waitForSelector('text=Pedir corrida');
  assert.match(await P.textContent('#sheet'), /1 motorista por perto/);
  await P.click('text=Pix');
  await shot(P, '07-confirmar-corrida');
  await P.click('text=Pedir corrida');
  await P.waitForSelector('text=Procurando motorista');

  // --- motorista recebe e aceita
  await D.waitForSelector('text=Novo pedido');
  await shot(D, '08-motorista-novo-pedido');
  await D.click('text=Aceitar');
  await D.waitForSelector('text=Cheguei ao local');
  await P.waitForSelector('text=Seu motorista está chegando');
  await P.waitForSelector('.mk-car'); // carro do motorista no mapa
  const pin = (await P.textContent('.pinbox b')).trim();
  assert.match(pin, /^\d{4}$/);
  assert.match(await P.textContent('#sheet'), /Fiat Uno 1998.*ABC1D23/s);
  await P.waitForSelector('text=Chega em cerca de');
  await shot(P, '09-passageiro-motorista-a-caminho');
  await shot(D, '10-motorista-buscar-passageiro');

  // --- chat entre motorista e passageiro
  await D.click('text=Mensagens');
  await D.click('[data-action=chat-quick] >> text=Estou a caminho');
  await D.waitForSelector('.msg.mine >> text=Estou a caminho');
  await D.click('[data-action=close-page]');
  await P.waitForSelector('#sheet .badge >> text=1');
  await P.click('text=Mensagens');
  await P.waitForSelector('.msg:not(.mine) >> text=Estou a caminho');
  await P.fill('.chat-form input', 'Tudo bem, te espero na portaria');
  await P.click('.chat-form button');
  await P.waitForSelector('.msg.mine >> text=te espero na portaria');
  await shot(P, '09b-chat');
  await P.click('[data-action=close-page]');
  await D.waitForSelector('#sheet .badge >> text=1');

  // --- chegada, código e viagem
  await D.click('text=Cheguei ao local');
  await P.waitForSelector('text=Seu motorista chegou!');
  await D.fill('#pin', pin === '0000' ? '1111' : '0000');
  await D.click('text=Iniciar corrida');
  await D.waitForSelector('text=Código incorreto');
  await D.fill('#pin', pin);
  await shot(D, '11-motorista-codigo');
  await D.click('text=Iniciar corrida');
  await D.waitForSelector('text=Finalizar corrida');
  await P.waitForSelector('text=A caminho do destino');
  await P.waitForSelector('text=Emergência');
  await shot(P, '12-passageiro-em-viagem');
  await D.click('text=Finalizar corrida');
  await P.waitForSelector('text=Você chegou!');
  await D.waitForSelector('text=Corrida finalizada');
  await shot(P, '13-passageiro-pagamento-avaliacao');
  await P.click('#stars button[data-n="5"]');
  await D.click('#stars button[data-n="4"]');
  await P.waitForSelector('text=Para onde vamos, Ana?');
  await D.waitForSelector('text=Você está online');
  await D.waitForFunction(() => /Corridas hoje/.test(document.body.textContent) && /\b1\b/.test(document.querySelector('.kpis div:nth-child(2) b')?.textContent || ''));
  await shot(D, '14-motorista-ganhos');

  // --- histórico e segundo pedido cancelado pelo passageiro
  await P.click('[data-action=menu]');
  await P.click('text=Minhas corridas');
  await P.waitForSelector('text=Concluída');
  await shot(P, '15-historico');
  await P.click('[data-action=close-page]');
  await P.mouse.click(320, 170);
  await P.click('text=Pedir corrida');
  await D.waitForSelector('text=Novo pedido');
  await D.click('text=Aceitar');
  await D.click('text=Cancelar corrida');
  await P.waitForSelector('text=O motorista cancelou');
  await D.waitForSelector('text=Você está online');

  // --- push: motorista com o app em segundo plano recebe aviso (envio falha aqui, sem rede, mas o fluxo segue)
  const dTok = await D.evaluate(() => localStorage.getItem('token'));
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const sub = { endpoint: 'https://push.example.invalid/sub/123', keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
  assert.equal((await post('/api/push/subscribe', sub, dTok)).status, 200);
  assert.equal((await post('/api/push/subscribe', { endpoint: 'nada' }, dTok)).status, 400);
  const setHidden = (pg, hidden) => pg.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  await setHidden(D, true);
  await sleep(300);
  await P.click('text=Pedir de novo');
  await P.waitForSelector('text=Confirme sua corrida');
  await P.click('text=Pedir corrida');
  await D.waitForSelector('text=Novo pedido');
  for (let i = 0; i < 50 && !serverOut.includes('[push]'); i++) await sleep(100);
  assert.match(serverOut, /\[push\] falha ao enviar para usuário \d+/);
  await setHidden(D, false);
  await P.click('text=Cancelar pedido');
  await P.waitForSelector('text=Para onde vamos, Ana?');
  await D.waitForSelector('text=Você está online');

  // --- admin vê os números
  await A.click('[data-tab=overview]');
  await A.waitForFunction(() => /Corridas concluídas/.test(document.body.textContent));
  await shot(A, '16-admin-resumo');
  await A.click('[data-tab=rides]');
  await A.waitForSelector('text=Concluída');
  await A.click('[data-tab=settings]');
  await A.fill('[name=fare_km]', '2.5');
  await A.click('#settingsForm button[type=submit]');
  await A.waitForSelector('text=Ajustes salvos');
  const cfg = await (await fetch(`${BASE}/api/config`)).json();
  assert.equal(cfg.fare.km, 2.5);

  // --- regras de acesso da API
  const anon = await fetch(`${BASE}/api/admin/users?role=driver`);
  assert.equal(anon.status, 401);
  const pTok = await P.evaluate(() => localStorage.getItem('token'));
  const asPassenger = await fetch(`${BASE}/api/admin/overview`, { headers: { Authorization: `Bearer ${pTok}` } });
  assert.equal(asPassenger.status, 403);
  const acc = await fetch(`${BASE}/api/rides/1/accept`, { method: 'POST', headers: { Authorization: `Bearer ${pTok}` } });
  assert.equal(acc.status, 403);

  // --- esqueci a senha: pedido pelo app, nova senha gerada no painel
  await Q.goto(BASE);
  await Q.click('text=Já tenho conta — Entrar');
  await Q.click('text=Esqueci minha senha');
  await Q.fill('[name=phone]', '(11) 97777-0002');
  await Q.click('text=Pedir nova senha');
  await Q.waitForSelector('text=Pedido enviado');
  await A.click('[data-tab=passengers]');
  await A.waitForSelector('text=pediu nova senha');
  await A.click('[data-reset]');
  const newPw = (await A.textContent('[data-newpw]')).trim();
  assert.match(newPw, /^\d{6}$/);
  await shot(A, '17-admin-nova-senha');
  await Q.click('text=Voltar para entrar');
  await Q.fill('[name=phone]', '11977770002');
  await Q.fill('[name=password]', newPw);
  await Q.click('button[type=submit]');
  await Q.waitForSelector('text=Para onde vamos, Ana?');
  assert.equal((await post('/api/login', { phone: '11977770002', password: 'segredo2' })).status, 401);

  // --- admin cancela corrida travada
  const anaTok = (await post('/api/login', { phone: '11977770002', password: newPw })).body.token;
  const stuck = await post('/api/rides', { pickup: { lat: -23.55, lng: -46.63, addr: 'A' }, dest: { lat: -23.56, lng: -46.65, addr: 'B' }, payment: 'cash' }, anaTok);
  assert.equal(stuck.status, 200);
  await A.click('[data-tab=live]');
  await A.waitForFunction(() => /1 online · 1 corrida/.test(document.querySelector('#liveInfo')?.textContent || ''));
  await shot(A, '18-admin-mapa-ao-vivo');
  await A.click('[data-tab=rides]');
  await A.click(`[data-cancel-ride="${stuck.body.ride.id}"]`);
  await A.waitForSelector('text=Corrida cancelada.');
  await Q.waitForSelector('text=cancelada pela administração');
  assert.equal((await post(`/api/admin/rides/${stuck.body.ride.id}/cancel`, {}, await A.evaluate(() => sessionStorage.getItem('adminToken')))).status, 409);

  // --- backup do banco
  const admTok = await A.evaluate(() => sessionStorage.getItem('adminToken'));
  const bk = await fetch(`${BASE}/api/admin/backup`, { headers: { Authorization: `Bearer ${admTok}` } });
  assert.equal(bk.status, 200);
  assert.equal(Buffer.from(await bk.arrayBuffer()).subarray(0, 15).toString(), 'SQLite format 3');

  // --- passageiro vira motorista e depois exclui a conta
  const bruno = await post('/api/register', { role: 'passenger', name: 'Bruno Teste', phone: '11966660003', password: 'segredo3', accept_terms: true });
  assert.equal(bruno.status, 200);
  assert.equal((await post('/api/register', { role: 'driver', name: 'Bruno', phone: '11966660003', password: 'x12345', accept_terms: true })).status, 409);
  await Q.evaluate((t) => localStorage.setItem('token', t), bruno.body.token);
  await Q.reload();
  await Q.waitForSelector('text=Para onde vamos, Bruno?');
  await Q.click('[data-action=menu]');
  await Q.click('text=Quero ser motorista');
  await Q.fill('#page [name=car_brand]', 'Chevrolet');
  await Q.fill('#page [name=car_model]', 'Chevette');
  await Q.fill('#page [name=car_year]', '1987');
  await Q.fill('#page [name=car_color]', 'Azul');
  await Q.fill('#page [name=car_plate]', 'XYZ-9876');
  await Q.fill('#page [name=cnh]', '987654321');
  await Q.check('#page [name=car_ok]');
  await Q.click('text=Enviar cadastro de motorista');
  await Q.waitForSelector('text=Cadastro em análise');
  assert.match(await Q.textContent('#sheet'), /Chevette 1987/);
  await Q.click('[data-action=menu]');
  await Q.click('text=Minha conta');
  await Q.click('text=Excluir minha conta');
  await Q.fill('[data-form=delete] [name=password]', 'segredo3');
  await Q.click('text=Excluir conta definitivamente');
  await Q.waitForSelector('text=Como você quer usar?');
  assert.equal((await post('/api/login', { phone: '11966660003', password: 'segredo3' })).status, 401);
  // o número fica livre para um novo cadastro
  assert.equal((await post('/api/register', { role: 'passenger', name: 'Bruno Novo', phone: '11966660003', password: 'segredo4', accept_terms: true })).status, 200);

  assert.deepEqual(errors, []);
  await browser.close();
  console.log('\n✔ Fluxo completo OK');
}
main().then(() => 0, (e) => { console.error('\n✘ FALHOU:', e); return 1; }).then((code) => {
  server.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
  process.exit(code);
});
