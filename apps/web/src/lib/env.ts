/**
 * Public, build-time configuration (Vite inlines VITE_* at build time).
 * Only PUBLIC values belong here — never secrets.
 */
const trimSlash = (v: string) => v.replace(/\/+$/, '');

export const env = {
  apiUrl: trimSlash(import.meta.env.VITE_API_URL || 'http://localhost:3000'),
  appEnv: import.meta.env.VITE_APP_ENV ?? 'development',
};
