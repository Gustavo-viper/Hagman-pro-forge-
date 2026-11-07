import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { authConfigured, env } from './env';

/** null when Supabase credentials are not configured (auth UI shows a setup notice). */
export const supabase: SupabaseClient | null = authConfigured
  ? createClient(env.supabaseUrl, env.supabaseKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
