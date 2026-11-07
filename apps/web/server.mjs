/**
 * Production static server for fandom-web (Railway).
 * - Serves the Vite build with gzip/brotli compression and long-lived caching for hashed assets.
 * - SPA fallback to index.html for client-side routes.
 * - Security headers (CSP, HSTS, frame denial, referrer policy).
 * - GET /healthz for Railway health checks.
 */
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import sirv from 'sirv';

const root = process.env.WEB_ROOT || join(dirname(fileURLToPath(import.meta.url)), 'dist');
const port = Number(process.env.PORT ?? 8080);

const origin = (url) => {
  try {
    return url ? new URL(url).origin : '';
  } catch {
    return '';
  }
};
// CSP connect-src must allow the API (REST now, WebSocket in stage 8).
const api = origin(process.env.VITE_API_URL || 'http://localhost:3000');
const connect = ["'self'", api, api.replace(/^http/, 'ws')].filter(Boolean).join(' ');
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src ${connect}`,
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const security = (res) => {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
};

const assets = sirv(root, {
  etag: true,
  gzip: true,
  brotli: true,
  single: true, // SPA fallback → index.html
  setHeaders(res, pathname) {
    security(res);
    if (pathname.startsWith('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    else if (pathname === '/sw.js' || pathname.endsWith('.html') || pathname === '/') res.setHeader('Cache-Control', 'no-cache');
    else res.setHeader('Cache-Control', 'public, max-age=3600');
  },
});
const compress = compression();

const server = createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ status: 'ok', service: 'fandom-web' }));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  compress(req, res, () => assets(req, res, () => res.writeHead(404).end()));
});

server.on('error', (error) => {
  if (error.code === 'EAFNOSUPPORT') server.listen(port, '0.0.0.0');
  else throw error;
});
server.listen(port, '::', () => console.log(JSON.stringify({ level: 'info', service: 'fandom-web', message: `listening on :${port}` })));
const stop = () => server.close(() => process.exit(0));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
