import { describe, expect, it } from 'vitest';
import { hashPassword, randomToken, sha256, verifyPassword } from './crypto.js';

describe('password hashing', () => {
  it('verifies correct passwords and rejects wrong ones', async () => {
    const hash = await hashPassword('Senha123forte');
    expect(hash.startsWith('scrypt$131072$8$1$')).toBe(true);
    expect(await verifyPassword('Senha123forte', hash)).toBe(true);
    expect(await verifyPassword('senha123forte', hash)).toBe(false);
  });
  it('uses a unique salt per hash', async () => {
    expect(await hashPassword('same-pass-1')).not.toBe(await hashPassword('same-pass-1'));
  });
  it('rejects malformed hashes', async () => {
    expect(await verifyPassword('x', 'bcrypt$whatever')).toBe(false);
  });
});

describe('tokens', () => {
  it('are random, url-safe and hash to 64 hex chars', () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(randomToken());
    expect(sha256(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});
