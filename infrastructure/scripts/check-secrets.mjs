#!/usr/bin/env node
/**
 * Fails if tracked files contain likely secrets. Runs in CI and via `pnpm check:secrets`.
 * Complements GitHub secret scanning; it is a guard rail, not a replacement.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PATTERNS = [
  [/-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/, 'private key'],
  [/\bsk_live_[0-9a-zA-Z]{16,}/, 'Stripe live secret key'],
  [/\brk_live_[0-9a-zA-Z]{16,}/, 'Stripe restricted key'],
  [/\bwhsec_[0-9a-zA-Z]{20,}/, 'Stripe webhook secret'],
  [/\bAPP_USR-\d{6,}-\d{6}-[0-9a-f]{32}/, 'Mercado Pago access token'],
  [/\bsb_secret_[0-9a-zA-Z_-]{20,}/, 'Supabase secret key'],
  [/eyJhbGciOi[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, 'JWT (possibly a Supabase service_role key)'],
  [/postgres(ql)?:\/\/[^:\s]+:[^@\s]{6,}@(?!localhost|127\.0\.0\.1|postgres[:/])[^\s'"]+/, 'database URL with password'],
  [/\bghp_[0-9a-zA-Z]{36}\b/, 'GitHub token'],
];
const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter((f) => !/\.(png|jpe?g|gif|webp|woff2?|ico)$/.test(f) && !f.startsWith('legacy/') && f !== 'pnpm-lock.yaml');
const findings = [];
for (const file of files) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  text.split('\n').forEach((line, i) => {
    for (const [re, label] of PATTERNS) if (re.test(line)) findings.push(`${file}:${i + 1}  ${label}`);
  });
}
if (findings.length) {
  console.error('Possible secrets found:\n' + findings.map((f) => '  ' + f).join('\n'));
  process.exit(1);
}
console.log(`check-secrets: ${files.length} tracked files clean`);
