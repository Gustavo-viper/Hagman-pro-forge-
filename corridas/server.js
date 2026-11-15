'use strict';
/*
 * App de corridas — servidor (API REST + tempo real via Socket.IO + SQLite).
 * Sem etapa de build: `npm install && npm start`.
 */
process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'ExperimentalWarning') console.warn(w); });

const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const express = require('express');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT) || 3000;
const APP_NAME = (process.env.APP_NAME || 'Rota Livre').slice(0, 30);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const GEO_DISABLED = process.env.GEO_DISABLED === '1'; // usado nos testes
const SEARCH_TIMEOUT_S = Number(process.env.SEARCH_TIMEOUT_S) || 180;
const PRESENCE_TTL_MS = 90_000;
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  ADMIN_PASSWORD = crypto.randomBytes(9).toString('base64url');
  console.log(`[admin] ADMIN_PASSWORD não definida. Senha temporária desta execução: ${ADMIN_PASSWORD}`);
}

// ---------------------------------------------------------------- banco
const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK (role IN ('passenger','driver','admin')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','blocked')),
  rating_sum INTEGER NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  pix_key TEXT,
  cnh TEXT,
  car_brand TEXT, car_model TEXT, car_year INTEGER, car_color TEXT, car_plate TEXT, car_photo TEXT,
  commission_paid_cents INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passenger_id INTEGER NOT NULL REFERENCES users(id),
  driver_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL,
  pickup_lat REAL NOT NULL, pickup_lng REAL NOT NULL, pickup_addr TEXT NOT NULL,
  dest_lat REAL NOT NULL, dest_lng REAL NOT NULL, dest_addr TEXT NOT NULL,
  distance_m INTEGER NOT NULL, duration_s INTEGER NOT NULL,
  fare_cents INTEGER NOT NULL, commission_cents INTEGER NOT NULL DEFAULT 0,
  payment TEXT NOT NULL,
  pin TEXT NOT NULL,
  route TEXT,
  cancelled_by TEXT,
  driver_stars INTEGER, passenger_stars INTEGER,
  created_at INTEGER NOT NULL, accepted_at INTEGER, arrived_at INTEGER, started_at INTEGER, finished_at INTEGER
);
CREATE INDEX IF NOT EXISTS rides_passenger ON rides(passenger_id, id);
CREATE INDEX IF NOT EXISTS rides_driver ON rides(driver_id, id);
CREATE INDEX IF NOT EXISTS rides_status ON rides(status);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const ACTIVE = ['searching', 'accepted', 'arrived', 'in_progress'];
const ACTIVE_SQL = ACTIVE.map((s) => `'${s}'`).join(',');
const now = () => Date.now();
const q = (sql) => db.prepare(sql);

const SETTING_DEFAULTS = {
  fare_base: 4.0, // R$ fixo por corrida
  fare_km: 1.8, // R$ por km
  fare_min: 0.3, // R$ por minuto
  fare_minimum: 8.0, // valor mínimo da corrida
  commission_pct: 10, // % do app sobre cada corrida
  search_radius_km: 10, // raio para chamar motoristas
  driver_auto_approve: 0, // 1 = motorista entra sem aprovação manual
  support_whatsapp: '', // número de suporte exibido no app
};
function getSettings() {
  const out = { ...SETTING_DEFAULTS };
  for (const row of q('SELECT key, value FROM settings').all()) {
    if (!(row.key in SETTING_DEFAULTS)) continue;
    out[row.key] = typeof SETTING_DEFAULTS[row.key] === 'number' ? Number(row.value) : row.value;
  }
  return out;
}
function setSetting(key, value) {
  q('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
}

// usuário interno do painel admin
if (!q("SELECT id FROM users WHERE role='admin'").get()) {
  q("INSERT INTO users(role,name,phone,pass_hash,created_at) VALUES('admin','Administrador','admin','-',?)").run(now());
}
const ADMIN_ID = q("SELECT id FROM users WHERE role='admin'").get().id;

// ---------------------------------------------------------------- utilidades
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg, status = 400) => new HttpError(status, msg);

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return `${salt.toString('hex')}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
}
function checkPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 32);
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
function newSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  q('INSERT INTO sessions(token_hash,user_id,created_at) VALUES(?,?,?)').run(sha(token), userId, now());
  return token;
}
function userFromToken(token) {
  if (!token || typeof token !== 'string') return null;
  return q('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?').get(sha(token)) || null;
}

function normPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) throw bad('Informe um celular válido com DDD.');
  return d;
}
function str(v, label, min, max) {
  const s = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (s.length < min) throw bad(`${label}: preencha este campo.`);
  if (s.length > max) throw bad(`${label}: texto muito longo.`);
  return s;
}
function point(p, label) {
  const lat = Number(p?.lat), lng = Number(p?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw bad(`${label}: localização inválida.`);
  }
  return { lat, lng, addr: String(p.addr || '').trim().slice(0, 200) || `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
}
function haversine(a, b) {
  const R = 6371000, toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function fareCents(distanceM, durationS, s = getSettings()) {
  const raw = s.fare_base + (distanceM / 1000) * s.fare_km + (durationS / 60) * s.fare_min;
  return Math.round(Math.max(raw, s.fare_minimum) * 100);
}
const rating = (u) => (u.rating_count ? Math.round((u.rating_sum / u.rating_count) * 10) / 10 : null);

// limite simples de tentativas por IP (login/cadastro)
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, _res, next) => {
    const key = `${req.path}|${req.ip}`;
    const t = now();
    const rec = hits.get(key);
    if (!rec || t > rec.reset) hits.set(key, { n: 1, reset: t + windowMs });
    else if (++rec.n > max) return next(bad('Muitas tentativas. Aguarde alguns minutos.', 429));
    next();
  };
}
setInterval(() => { const t = now(); for (const [k, v] of hits) if (t > v.reset) hits.delete(k); }, 60_000).unref();

// ---------------------------------------------------------------- mapas (geocodificação e rota)
const UA = { 'User-Agent': `${APP_NAME.replace(/[^\w ]/g, '')} ride app` };
const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.exp > now()) return hit.val;
  const val = await fn();
  if (cache.size > 5000) cache.clear();
  cache.set(key, { val, exp: now() + ttlMs });
  return val;
}
async function getJson(url, ms = 6000) {
  if (GEO_DISABLED) throw new Error('geo disabled');
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
function photonLabel(p) {
  const street = [p.street, p.housenumber].filter(Boolean).join(', ');
  const parts = [p.name, street, p.district || p.locality, p.city || p.town || p.village || p.county, p.state];
  return [...new Set(parts.filter(Boolean))].join(' - ');
}
async function geoSearch(text, near) {
  const key = `s|${text.toLowerCase()}|${near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : ''}`;
  return cached(key, 3600_000, async () => {
    try {
      const bias = near ? `&lat=${near.lat}&lon=${near.lng}` : '';
      const j = await getJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=6${bias}`);
      return j.features.map((f) => ({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], addr: photonLabel(f.properties) })).filter((r) => r.addr);
    } catch {
      const box = near ? `&viewbox=${near.lng - 1},${near.lat + 1},${near.lng + 1},${near.lat - 1}` : '';
      const j = await getJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=pt-BR&q=${encodeURIComponent(text)}${box}`);
      return j.map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), addr: r.display_name.split(',').slice(0, 4).join(',') }));
    }
  });
}
async function geoReverse(p) {
  return cached(`r|${p.lat.toFixed(4)},${p.lng.toFixed(4)}`, 3600_000, async () => {
    try {
      const j = await getJson(`https://photon.komoot.io/reverse?lat=${p.lat}&lon=${p.lng}`);
      const label = j.features[0] && photonLabel(j.features[0].properties);
      if (label) return label;
      throw new Error('vazio');
    } catch {
      const j = await getJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=pt-BR&lat=${p.lat}&lon=${p.lng}`);
      return j.display_name.split(',').slice(0, 4).join(',');
    }
  });
}
async function route(a, b) {
  const key = `rt|${a.lat.toFixed(5)},${a.lng.toFixed(5)}|${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;
  return cached(key, 600_000, async () => {
    try {
      const j = await getJson(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=simplified&geometries=geojson`);
      const r = j.routes[0];
      return {
        distance_m: Math.round(r.distance),
        duration_s: Math.round(r.duration * 1.25), // folga para trânsito
        path: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]).slice(0, 800),
        approx: false,
      };
    } catch {
      // sem serviço de rotas: estima pela linha reta
      const d = haversine(a, b) * 1.35;
      return { distance_m: Math.round(d), duration_s: Math.round(d / (28 / 3.6)), path: [[a.lat, a.lng], [b.lat, b.lng]], approx: true };
    }
  });
}

// ---------------------------------------------------------------- presença dos motoristas (memória)
const presence = new Map(); // driverId -> { lat, lng, ts, online }
function driverLoc(id) {
  const p = presence.get(id);
  return p && now() - p.ts < PRESENCE_TTL_MS ? { lat: p.lat, lng: p.lng } : null;
}
function isAvailable(id) {
  const p = presence.get(id);
  return !!p && p.online && now() - p.ts < PRESENCE_TTL_MS;
}
const activeRideOf = (u) =>
  q(`SELECT * FROM rides WHERE ${u.role === 'driver' ? 'driver_id' : 'passenger_id'} = ? AND status IN (${ACTIVE_SQL}) ORDER BY id DESC LIMIT 1`).get(u.id);

// ---------------------------------------------------------------- visões
function publicUser(u) {
  const base = { id: u.id, role: u.role, name: u.name, phone: u.phone, status: u.status, rating: rating(u), rating_count: u.rating_count, pix_key: u.pix_key || '' };
  if (u.role === 'driver') {
    Object.assign(base, { car_brand: u.car_brand, car_model: u.car_model, car_year: u.car_year, car_color: u.car_color, car_plate: u.car_plate, car_photo: u.car_photo, online: isAvailable(u.id) });
  }
  return base;
}
function rideView(r, viewer) {
  const engaged = ['accepted', 'arrived', 'in_progress', 'completed'].includes(r.status);
  const isPassenger = viewer.id === r.passenger_id;
  const isDriver = viewer.id === r.driver_id;
  const admin = viewer.role === 'admin';
  const p = q('SELECT * FROM users WHERE id = ?').get(r.passenger_id);
  const d = r.driver_id ? q('SELECT * FROM users WHERE id = ?').get(r.driver_id) : null;
  const contact = (isPassenger || isDriver) && ACTIVE.includes(r.status);
  const view = {
    id: r.id, status: r.status, payment: r.payment, cancelled_by: r.cancelled_by,
    pickup: { lat: r.pickup_lat, lng: r.pickup_lng, addr: r.pickup_addr },
    dest: { lat: r.dest_lat, lng: r.dest_lng, addr: r.dest_addr },
    distance_m: r.distance_m, duration_s: r.duration_s, fare_cents: r.fare_cents,
    created_at: r.created_at, accepted_at: r.accepted_at, started_at: r.started_at, finished_at: r.finished_at,
    path: r.route ? JSON.parse(r.route) : null,
    search_timeout_s: SEARCH_TIMEOUT_S,
    passenger: { name: p.name, rating: rating(p), phone: contact || admin ? p.phone : undefined },
    driver: d && (engaged || admin) ? {
      name: d.name, rating: rating(d), phone: contact || admin ? d.phone : undefined,
      car_brand: d.car_brand, car_model: d.car_model, car_year: d.car_year, car_color: d.car_color, car_plate: d.car_plate, car_photo: d.car_photo,
      pix_key: d.pix_key || '', loc: ACTIVE.includes(r.status) ? driverLoc(d.id) : null,
    } : null,
    rated: isPassenger ? r.driver_stars != null : isDriver ? r.passenger_stars != null : undefined,
  };
  if (isPassenger && ['accepted', 'arrived'].includes(r.status)) view.pin = r.pin;
  if (isDriver || admin) view.commission_cents = r.commission_cents;
  return view;
}
function offerView(r, driverId) {
  const p = q('SELECT * FROM users WHERE id = ?').get(r.passenger_id);
  const loc = driverLoc(driverId);
  return {
    id: r.id, created_at: r.created_at, expires_at: r.created_at + SEARCH_TIMEOUT_S * 1000,
    pickup: { lat: r.pickup_lat, lng: r.pickup_lng, addr: r.pickup_addr },
    dest: { lat: r.dest_lat, lng: r.dest_lng, addr: r.dest_addr },
    distance_m: r.distance_m, duration_s: r.duration_s, fare_cents: r.fare_cents, payment: r.payment,
    to_pickup_m: loc ? Math.round(haversine(loc, { lat: r.pickup_lat, lng: r.pickup_lng })) : null,
    passenger: { name: p.name.split(' ')[0], rating: rating(p) },
  };
}

// ---------------------------------------------------------------- app
const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 20_000 });
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
  next();
});
app.use(express.json({ limit: '1mb' }));

const wrap = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res)).then((out) => { if (out !== undefined) res.json(out); }).catch(next);
function auth(...roles) {
  return (req, _res, next) => {
    const m = /^Bearer (.+)$/.exec(req.get('authorization') || '');
    const u = userFromToken(m && m[1]);
    if (!u) return next(bad('Sessão expirada. Entre novamente.', 401));
    if (u.status === 'blocked') return next(bad('Sua conta está bloqueada. Fale com o suporte.', 403));
    if (roles.length && !roles.includes(u.role)) return next(bad('Acesso não permitido.', 403));
    req.user = u;
    req.token = m[1];
    next();
  };
}

function notifyRide(r) {
  const p = q('SELECT * FROM users WHERE id = ?').get(r.passenger_id);
  io.to(`u:${p.id}`).emit('ride:update', rideView(r, p));
  if (r.driver_id) {
    const d = q('SELECT * FROM users WHERE id = ?').get(r.driver_id);
    io.to(`u:${d.id}`).emit('ride:update', rideView(r, d));
  }
}
const getRide = (id) => q('SELECT * FROM rides WHERE id = ?').get(Number(id));
function rideFor(req, role) {
  const r = getRide(req.params.id);
  if (!r) throw bad('Corrida não encontrada.', 404);
  const mine = role === 'driver' ? r.driver_id === req.user.id : role === 'passenger' ? r.passenger_id === req.user.id : r.driver_id === req.user.id || r.passenger_id === req.user.id;
  if (!mine) throw bad('Corrida não encontrada.', 404);
  return r;
}
function savePhoto(dataUrl, userId) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw bad('Foto do veículo inválida.');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > 600_000 || buf[0] !== 0xff || buf[1] !== 0xd8) throw bad('Foto do veículo inválida ou grande demais.');
  const name = `${userId}-${crypto.randomBytes(8).toString('hex')}.jpg`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}

// ---- público
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/api/config', wrap(() => {
  const s = getSettings();
  return { appName: APP_NAME, fare: { base: s.fare_base, km: s.fare_km, min: s.fare_min, minimum: s.fare_minimum }, support_whatsapp: s.support_whatsapp };
}));
app.get('/manifest.webmanifest', (_req, res) => {
  res.type('application/manifest+json').json({
    name: APP_NAME, short_name: APP_NAME, description: 'Peça ou ofereça corridas na sua cidade.',
    start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait', lang: 'pt-BR',
    background_color: '#0f172a', theme_color: '#0f172a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  });
});

// ---- conta
app.post('/api/register', rateLimit(15, 600_000), wrap((req) => {
  const b = req.body || {};
  const role = b.role === 'driver' ? 'driver' : 'passenger';
  const name = str(b.name, 'Nome', 3, 60);
  const phone = normPhone(b.phone);
  const password = String(b.password || '');
  if (password.length < 6 || password.length > 100) throw bad('A senha precisa ter pelo menos 6 caracteres.');
  if (b.accept_terms !== true) throw bad('É preciso aceitar os Termos de Uso e a Política de Privacidade.');
  if (q('SELECT 1 FROM users WHERE phone = ?').get(phone)) throw bad('Este celular já está cadastrado. Faça login.', 409);

  let car = {};
  if (role === 'driver') {
    const year = Number(b.car_year);
    if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1) throw bad('Ano do veículo inválido.');
    const plate = String(b.car_plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(plate)) throw bad('Placa inválida. Use o formato ABC1234 ou ABC1D23.');
    const cnh = String(b.cnh || '').replace(/\D/g, '');
    if (cnh.length < 9 || cnh.length > 11) throw bad('Número da CNH inválido.');
    if (b.car_ok !== true) throw bad('Confirme que o veículo está em bom estado de conservação.');
    car = { brand: str(b.car_brand, 'Marca', 2, 30), model: str(b.car_model, 'Modelo', 1, 40), year, color: str(b.car_color, 'Cor', 3, 20), plate, cnh };
  }
  const status = role === 'driver' && !getSettings().driver_auto_approve ? 'pending' : 'active';
  const info = q(`INSERT INTO users(role,name,phone,pass_hash,status,cnh,car_brand,car_model,car_year,car_color,car_plate,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(role, name, phone, hashPassword(password), status, car.cnh ?? null, car.brand ?? null, car.model ?? null, car.year ?? null, car.color ?? null, car.plate ?? null, now());
  const id = Number(info.lastInsertRowid);
  if (role === 'driver' && b.car_photo) {
    try { q('UPDATE users SET car_photo = ? WHERE id = ?').run(savePhoto(b.car_photo, id), id); } catch { /* foto opcional */ }
  }
  if (role === 'driver') io.to('admins').emit('admin:refresh');
  return { token: newSession(id), user: publicUser(q('SELECT * FROM users WHERE id = ?').get(id)) };
}));

app.post('/api/login', rateLimit(15, 600_000), wrap((req) => {
  const phone = normPhone(req.body?.phone);
  const u = q("SELECT * FROM users WHERE phone = ? AND role != 'admin'").get(phone);
  if (!u || !checkPassword(String(req.body?.password || ''), u.pass_hash)) throw bad('Celular ou senha incorretos.', 401);
  if (u.status === 'blocked') throw bad('Sua conta está bloqueada. Fale com o suporte.', 403);
  return { token: newSession(u.id), user: publicUser(u) };
}));
app.post('/api/logout', auth(), wrap((req) => {
  q('DELETE FROM sessions WHERE token_hash = ?').run(sha(req.token));
  if (req.user.role === 'driver') presence.delete(req.user.id);
  return { ok: true };
}));
app.get('/api/me', auth(), wrap((req) => {
  const r = req.user.role === 'admin' ? null : activeRideOf(req.user);
  return { user: publicUser(req.user), ride: r ? rideView(r, req.user) : null };
}));
app.put('/api/me', auth('passenger', 'driver'), wrap((req) => {
  const b = req.body || {};
  if (b.name !== undefined) q('UPDATE users SET name = ? WHERE id = ?').run(str(b.name, 'Nome', 3, 60), req.user.id);
  if (b.pix_key !== undefined) q('UPDATE users SET pix_key = ? WHERE id = ?').run(String(b.pix_key).trim().slice(0, 80), req.user.id);
  if (b.car_photo && req.user.role === 'driver') q('UPDATE users SET car_photo = ? WHERE id = ?').run(savePhoto(b.car_photo, req.user.id), req.user.id);
  if (b.password) {
    if (!checkPassword(String(b.current_password || ''), req.user.pass_hash)) throw bad('Senha atual incorreta.');
    if (String(b.password).length < 6) throw bad('A nova senha precisa ter pelo menos 6 caracteres.');
    q('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashPassword(String(b.password)), req.user.id);
  }
  return { user: publicUser(q('SELECT * FROM users WHERE id = ?').get(req.user.id)) };
}));

// ---- mapas
app.get('/api/geo/search', auth(), wrap(async (req) => {
  const text = String(req.query.q || '').trim().slice(0, 120);
  if (text.length < 3) return { results: [] };
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  try { return { results: await geoSearch(text, Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null) }; }
  catch { return { results: [], unavailable: true }; }
}));
app.get('/api/geo/reverse', auth(), wrap(async (req) => {
  const p = point({ lat: req.query.lat, lng: req.query.lng }, 'Local');
  try { return { addr: await geoReverse(p) }; } catch { return { addr: null }; }
}));
app.post('/api/estimate', auth('passenger'), wrap(async (req) => {
  const a = point(req.body?.pickup, 'Embarque'), b = point(req.body?.dest, 'Destino');
  const r = await route(a, b);
  if (r.distance_m < 100) throw bad('O destino está muito perto do embarque.');
  if (r.distance_m > 300_000) throw bad('Destino muito distante (máximo de 300 km).');
  const available = [...presence.keys()].filter((id) => isAvailable(id) && haversine(presence.get(id), a) <= getSettings().search_radius_km * 1000).length;
  return { ...r, fare_cents: fareCents(r.distance_m, r.duration_s), drivers_nearby: available };
}));
app.get('/api/drivers/nearby', auth('passenger'), wrap((req) => {
  const c = point({ lat: req.query.lat, lng: req.query.lng }, 'Local');
  const radius = getSettings().search_radius_km * 1000;
  const list = [];
  for (const [id, p] of presence) {
    if (isAvailable(id) && haversine(p, c) <= radius) list.push({ lat: Math.round(p.lat * 2000) / 2000, lng: Math.round(p.lng * 2000) / 2000 });
  }
  return { drivers: list.slice(0, 30) };
}));

// ---- corridas (passageiro)
function candidateDrivers(r) {
  const radius = getSettings().search_radius_km * 1000;
  const busy = new Set(q(`SELECT driver_id FROM rides WHERE driver_id IS NOT NULL AND status IN (${ACTIVE_SQL})`).all().map((x) => x.driver_id));
  const out = [];
  for (const [id, p] of presence) {
    if (!isAvailable(id) || busy.has(id)) continue;
    if (haversine(p, { lat: r.pickup_lat, lng: r.pickup_lng }) <= radius) out.push(id);
  }
  return out;
}
app.post('/api/rides', auth('passenger'), wrap(async (req) => {
  const a = point(req.body?.pickup, 'Embarque'), b = point(req.body?.dest, 'Destino');
  const payment = req.body?.payment === 'pix' ? 'pix' : 'cash';
  const rt = await route(a, b);
  if (rt.distance_m < 100) throw bad('O destino está muito perto do embarque.');
  if (rt.distance_m > 300_000) throw bad('Destino muito distante (máximo de 300 km).');
  if (activeRideOf(req.user)) throw bad('Você já tem uma corrida em andamento.', 409);
  const pin = String(crypto.randomInt(0, 10000)).padStart(4, '0');
  const info = q(`INSERT INTO rides(passenger_id,status,pickup_lat,pickup_lng,pickup_addr,dest_lat,dest_lng,dest_addr,distance_m,duration_s,fare_cents,payment,pin,route,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.user.id, 'searching', a.lat, a.lng, a.addr, b.lat, b.lng, b.addr, rt.distance_m, rt.duration_s, fareCents(rt.distance_m, rt.duration_s), payment, pin, JSON.stringify(rt.path), now());
  const r = getRide(info.lastInsertRowid);
  for (const id of candidateDrivers(r)) io.to(`u:${id}`).emit('offer:new', offerView(r, id));
  io.to('admins').emit('admin:refresh');
  return { ride: rideView(r, req.user) };
}));
app.get('/api/rides/history', auth('passenger', 'driver'), wrap((req) => {
  const col = req.user.role === 'driver' ? 'driver_id' : 'passenger_id';
  const rows = q(`SELECT * FROM rides WHERE ${col} = ? AND status IN ('completed','cancelled','expired') ORDER BY id DESC LIMIT 50`).all(req.user.id);
  return { rides: rows.map((r) => { const v = rideView(r, req.user); delete v.path; return v; }) };
}));
app.post('/api/rides/:id/cancel', auth('passenger', 'driver'), wrap((req) => {
  const r = rideFor(req);
  const allowed = req.user.role === 'passenger' ? ['searching', 'accepted', 'arrived'] : ['accepted', 'arrived'];
  const marks = allowed.map(() => '?').join(',');
  const res = q(`UPDATE rides SET status='cancelled', cancelled_by=?, finished_at=? WHERE id=? AND status IN (${marks})`).run(req.user.role, now(), r.id, ...allowed);
  if (!res.changes) throw bad('Esta corrida não pode mais ser cancelada.', 409);
  const fresh = getRide(r.id);
  notifyRide(fresh);
  io.to('drivers').emit('offer:gone', { id: r.id });
  io.to('admins').emit('admin:refresh');
  return { ride: rideView(fresh, req.user) };
}));
app.post('/api/rides/:id/rate', auth('passenger', 'driver'), wrap((req) => {
  const r = rideFor(req);
  const stars = Number(req.body?.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw bad('Avaliação inválida.');
  if (r.status !== 'completed') throw bad('Só é possível avaliar corridas concluídas.', 409);
  const col = req.user.role === 'passenger' ? 'driver_stars' : 'passenger_stars';
  const target = req.user.role === 'passenger' ? r.driver_id : r.passenger_id;
  const res = q(`UPDATE rides SET ${col} = ? WHERE id = ? AND ${col} IS NULL`).run(stars, r.id);
  if (res.changes) q('UPDATE users SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?').run(stars, target);
  return { ok: true };
}));

// ---- motorista
app.post('/api/driver/online', auth('driver'), wrap((req) => {
  const online = req.body?.online === true;
  if (!online) { presence.delete(req.user.id); return { online: false }; }
  if (req.user.status !== 'active') throw bad('Seu cadastro ainda está em análise.', 403);
  const p = point(req.body, 'Localização');
  presence.set(req.user.id, { lat: p.lat, lng: p.lng, ts: now(), online: true });
  return { online: true };
}));
app.get('/api/driver/offers', auth('driver'), wrap((req) => {
  if (!isAvailable(req.user.id) || activeRideOf(req.user)) return { offers: [] };
  const me = presence.get(req.user.id);
  const radius = getSettings().search_radius_km * 1000;
  const rows = q("SELECT * FROM rides WHERE status = 'searching' ORDER BY id").all();
  return { offers: rows.filter((r) => haversine(me, { lat: r.pickup_lat, lng: r.pickup_lng }) <= radius).map((r) => offerView(r, req.user.id)) };
}));
app.get('/api/driver/summary', auth('driver'), wrap((req) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const sum = (since) => q("SELECT COUNT(*) n, COALESCE(SUM(fare_cents),0) fare, COALESCE(SUM(commission_cents),0) fee FROM rides WHERE driver_id = ? AND status = 'completed' AND finished_at >= ?").get(req.user.id, since);
  const all = sum(0);
  return { today: sum(start.getTime()), total: all, commission_due_cents: Math.max(0, all.fee - req.user.commission_paid_cents) };
}));
app.post('/api/rides/:id/accept', auth('driver'), wrap((req) => {
  if (req.user.status !== 'active') throw bad('Seu cadastro ainda está em análise.', 403);
  if (!isAvailable(req.user.id)) throw bad('Fique online para aceitar corridas.', 409);
  if (activeRideOf(req.user)) throw bad('Finalize a corrida atual antes de aceitar outra.', 409);
  const res = q("UPDATE rides SET status='accepted', driver_id=?, accepted_at=? WHERE id=? AND status='searching'").run(req.user.id, now(), Number(req.params.id));
  if (!res.changes) throw bad('Esta corrida não está mais disponível.', 409);
  const r = getRide(req.params.id);
  notifyRide(r);
  io.to('drivers').emit('offer:gone', { id: r.id });
  io.to('admins').emit('admin:refresh');
  return { ride: rideView(r, req.user) };
}));
function step(from, to, timeCol, check) {
  return wrap((req) => {
    const r = rideFor(req, 'driver');
    if (check) check(req, r);
    const s = getSettings();
    const fee = to === 'completed' ? Math.round((r.fare_cents * s.commission_pct) / 100) : 0;
    const res = q(`UPDATE rides SET status=?, ${timeCol}=?, commission_cents=? WHERE id=? AND status=?`).run(to, now(), fee, r.id, from);
    if (!res.changes) throw bad('Ação não permitida no estado atual da corrida.', 409);
    const fresh = getRide(r.id);
    notifyRide(fresh);
    io.to('admins').emit('admin:refresh');
    return { ride: rideView(fresh, req.user) };
  });
}
app.post('/api/rides/:id/arrived', auth('driver'), step('accepted', 'arrived', 'arrived_at'));
app.post('/api/rides/:id/start', auth('driver'), rateLimit(30, 600_000), step('arrived', 'in_progress', 'started_at', (req, r) => {
  if (String(req.body?.pin || '').trim() !== r.pin) throw bad('Código incorreto. Peça o código de 4 dígitos ao passageiro.');
}));
app.post('/api/rides/:id/finish', auth('driver'), step('in_progress', 'completed', 'finished_at'));

// ---- admin
app.post('/api/admin/login', rateLimit(10, 600_000), wrap((req) => {
  const a = Buffer.from(sha(String(req.body?.password || ''))), b = Buffer.from(sha(ADMIN_PASSWORD));
  if (!crypto.timingSafeEqual(a, b)) throw bad('Senha incorreta.', 401);
  return { token: newSession(ADMIN_ID) };
}));
app.get('/api/admin/overview', auth('admin'), wrap(() => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const one = (sql, ...a) => q(sql).get(...a);
  const tot = one("SELECT COUNT(*) n, COALESCE(SUM(fare_cents),0) fare, COALESCE(SUM(commission_cents),0) fee FROM rides WHERE status='completed'");
  const today = one("SELECT COUNT(*) n, COALESCE(SUM(fare_cents),0) fare, COALESCE(SUM(commission_cents),0) fee FROM rides WHERE status='completed' AND finished_at >= ?", start.getTime());
  return {
    passengers: one("SELECT COUNT(*) n FROM users WHERE role='passenger'").n,
    drivers: one("SELECT COUNT(*) n FROM users WHERE role='driver' AND status='active'").n,
    drivers_pending: one("SELECT COUNT(*) n FROM users WHERE role='driver' AND status='pending'").n,
    drivers_online: [...presence.keys()].filter(isAvailable).length,
    rides_active: one(`SELECT COUNT(*) n FROM rides WHERE status IN (${ACTIVE_SQL})`).n,
    today, total: tot,
    commission_received_cents: one('SELECT COALESCE(SUM(commission_paid_cents),0) n FROM users').n,
  };
}));
app.get('/api/admin/users', auth('admin'), wrap((req) => {
  const role = req.query.role === 'driver' ? 'driver' : 'passenger';
  const rows = q('SELECT * FROM users WHERE role = ? ORDER BY (status = \'pending\') DESC, id DESC LIMIT 500').all(role);
  return {
    users: rows.map((u) => {
      const v = { ...publicUser(u), created_at: u.created_at };
      if (role === 'driver') {
        const s = q("SELECT COUNT(*) n, COALESCE(SUM(fare_cents),0) fare, COALESCE(SUM(commission_cents),0) fee FROM rides WHERE driver_id = ? AND status='completed'").get(u.id);
        Object.assign(v, { cnh: u.cnh, rides: s.n, fare_cents: s.fare, commission_cents: s.fee, commission_paid_cents: u.commission_paid_cents, commission_due_cents: Math.max(0, s.fee - u.commission_paid_cents) });
      } else {
        v.rides = q("SELECT COUNT(*) n FROM rides WHERE passenger_id = ? AND status='completed'").get(u.id).n;
      }
      return v;
    }),
  };
}));
app.post('/api/admin/users/:id/status', auth('admin'), wrap((req) => {
  const status = req.body?.status;
  if (!['active', 'blocked', 'pending'].includes(status)) throw bad('Status inválido.');
  const u = q("SELECT * FROM users WHERE id = ? AND role != 'admin'").get(Number(req.params.id));
  if (!u) throw bad('Usuário não encontrado.', 404);
  q('UPDATE users SET status = ? WHERE id = ?').run(status, u.id);
  if (status !== 'active') presence.delete(u.id);
  if (status === 'blocked') q('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  io.to(`u:${u.id}`).emit('account:update', { status });
  return { ok: true };
}));
app.post('/api/admin/users/:id/commission-paid', auth('admin'), wrap((req) => {
  const u = q("SELECT * FROM users WHERE id = ? AND role = 'driver'").get(Number(req.params.id));
  if (!u) throw bad('Motorista não encontrado.', 404);
  const fee = q("SELECT COALESCE(SUM(commission_cents),0) fee FROM rides WHERE driver_id = ? AND status='completed'").get(u.id).fee;
  q('UPDATE users SET commission_paid_cents = ? WHERE id = ?').run(fee, u.id);
  return { ok: true };
}));
app.get('/api/admin/rides', auth('admin'), wrap((req) => {
  const rows = q('SELECT * FROM rides ORDER BY id DESC LIMIT 200').all();
  return { rides: rows.map((r) => { const v = rideView(r, req.user); delete v.path; return v; }) };
}));
app.get('/api/admin/settings', auth('admin'), wrap(() => getSettings()));
app.put('/api/admin/settings', auth('admin'), wrap((req) => {
  const b = req.body || {};
  const limits = { fare_base: [0, 100], fare_km: [0, 50], fare_min: [0, 20], fare_minimum: [0, 200], commission_pct: [0, 50], search_radius_km: [1, 100], driver_auto_approve: [0, 1] };
  for (const [k, [lo, hi]] of Object.entries(limits)) {
    if (b[k] === undefined) continue;
    const n = Number(b[k]);
    if (!Number.isFinite(n) || n < lo || n > hi) throw bad(`Valor inválido para ${k} (entre ${lo} e ${hi}).`);
    setSetting(k, n);
  }
  if (b.support_whatsapp !== undefined) setSetting('support_whatsapp', String(b.support_whatsapp).replace(/\D/g, '').slice(0, 13));
  return getSettings();
}));

// ---- arquivos estáticos
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', index: false }));
app.use('/vendor/leaflet', express.static(path.join(__dirname, 'node_modules/leaflet/dist'), { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], setHeaders: (res) => res.set('Cache-Control', 'no-cache') }));
app.use('/api', (_req, _res, next) => next(bad('Rota não encontrada.', 404)));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || (err.type === 'entity.too.large' ? 413 : err instanceof SyntaxError ? 400 : 500);
  if (status >= 500) console.error(err);
  const msg = status === 413 ? 'Arquivo grande demais.' : status >= 500 ? 'Erro interno. Tente novamente.' : err.message;
  res.status(status).json({ error: msg });
});

// ---------------------------------------------------------------- tempo real
io.use((socket, next) => {
  const u = userFromToken(socket.handshake.auth?.token);
  if (!u || u.status === 'blocked') return next(new Error('unauthorized'));
  socket.data.userId = u.id;
  socket.data.role = u.role;
  next();
});
io.on('connection', (socket) => {
  const { userId, role } = socket.data;
  socket.join(`u:${userId}`);
  if (role === 'driver') socket.join('drivers');
  if (role === 'admin') socket.join('admins');

  socket.on('loc', (p) => {
    if (role !== 'driver') return;
    const lat = Number(p?.lat), lng = Number(p?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
    const cur = presence.get(userId);
    if (!cur) return; // só motoristas que ficaram online
    presence.set(userId, { lat, lng, ts: now(), online: true });
    const r = q(`SELECT id, passenger_id FROM rides WHERE driver_id = ? AND status IN ('accepted','arrived','in_progress')`).get(userId);
    if (r) io.to(`u:${r.passenger_id}`).emit('driver:loc', { ride_id: r.id, lat, lng });
  });
});

// corridas sem motorista expiram
setInterval(() => {
  const limit = now() - SEARCH_TIMEOUT_S * 1000;
  for (const r of q("SELECT * FROM rides WHERE status = 'searching' AND created_at < ?").all(limit)) {
    const res = q("UPDATE rides SET status='expired', finished_at=? WHERE id=? AND status='searching'").run(now(), r.id);
    if (!res.changes) continue;
    notifyRide(getRide(r.id));
    io.to('drivers').emit('offer:gone', { id: r.id });
  }
}, Math.min(15_000, SEARCH_TIMEOUT_S * 500)).unref();

server.listen(PORT, () => console.log(`${APP_NAME} rodando na porta ${PORT}`));
process.on('SIGTERM', () => { server.close(() => { db.close(); process.exit(0); }); setTimeout(() => process.exit(0), 3000).unref(); });
