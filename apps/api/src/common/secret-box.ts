import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for small secrets at rest (prize codes such as Steam keys or gift codes).
 * The key is derived with HKDF from the server secret, so no extra configuration is needed;
 * rotating AUTH_JWT_SECRET makes previously stored codes unreadable (re-enter them).
 */
export class SecretBox {
  private readonly key: Buffer;

  constructor(secret: string, purpose = 'prize-codes') {
    this.key = Buffer.from(hkdfSync('sha256', secret, 'fandom-universe', purpose, 32));
  }

  seal(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return `v1:${Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')}`;
  }

  open(sealed: string): string {
    if (!sealed.startsWith('v1:')) throw new Error('unknown secret format');
    const raw = Buffer.from(sealed.slice(3), 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  }
}
