/**
 * TLS options for node-postgres, shared by api, worker and the migration runner.
 *
 *  - disable      local development (docker / native Postgres)
 *  - require      encrypted, server certificate NOT verified (e.g. Railway public proxy)
 *  - verify-full  encrypted + certificate verified (recommended in production:
 *                 set DATABASE_CA_CERT to the server CA certificate, PEM)
 */
export const DATABASE_SSL_MODES = ['disable', 'require', 'verify-full'] as const;
export type DatabaseSslMode = (typeof DATABASE_SSL_MODES)[number];

export type PgSslOption = false | { rejectUnauthorized: boolean; ca?: string };

export function pgSslConfig(mode: DatabaseSslMode, caCert?: string): PgSslOption {
  switch (mode) {
    case 'disable':
      return false;
    case 'require':
      return { rejectUnauthorized: false };
    case 'verify-full':
      // Env vars often store PEMs with literal "\n".
      return caCert
        ? { rejectUnauthorized: true, ca: caCert.replace(/\\n/g, '\n') }
        : { rejectUnauthorized: true };
  }
}

/** Removes `sslmode`/`ssl*` params so node-postgres uses the explicit `ssl` option above. */
export function stripSslParams(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('ssl')) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return connectionString;
  }
}

export function isDatabaseSslMode(value: unknown): value is DatabaseSslMode {
  return typeof value === 'string' && (DATABASE_SSL_MODES as readonly string[]).includes(value);
}
