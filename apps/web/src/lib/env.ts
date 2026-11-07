/**
 * Public, build-time configuration (Vite inlines VITE_* at build time).
 * Only PUBLIC values belong here: the Supabase publishable (anon) key is designed to be
 * shipped to browsers and is safe only because every table has RLS (database/policies).
 */
const trimSlash = (v: string) => v.replace(/\/+$/, '');

export const env = {
  apiUrl: trimSlash(import.meta.env.VITE_API_URL || 'http://localhost:3000'),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ? trimSlash(import.meta.env.VITE_SUPABASE_URL) : '',
  supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
  appEnv: import.meta.env.VITE_APP_ENV ?? 'development',
};

export const authConfigured = Boolean(env.supabaseUrl && env.supabaseKey);
