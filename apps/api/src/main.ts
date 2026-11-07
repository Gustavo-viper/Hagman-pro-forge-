import { Logger } from '@nestjs/common';
import { createApp } from './bootstrap.js';
import { ENV } from './config/config.module.js';
import type { Env } from './config/env.js';

async function main(): Promise<void> {
  const app = await createApp();
  const env = app.get<Env>(ENV);
  // Bind to :: so Railway private networking (IPv6) and the public proxy (IPv4) both reach us.
  // Fall back to IPv4 on hosts without IPv6 support.
  try {
    await app.listen(env.PORT, '::');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EAFNOSUPPORT') throw error;
    await app.listen(env.PORT, '0.0.0.0');
  }
  Logger.log(`fandom-api listening on :${env.PORT} (${env.APP_ENV})`, 'Bootstrap');
}

main().catch((error: unknown) => {
  console.error('fatal: failed to start fandom-api', error);
  process.exit(1);
});
