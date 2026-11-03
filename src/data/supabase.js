// Supabase Client with graceful Offline / Mock fallback
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Auth helper
export async function getCurrentUser() {
  if (!supabase) return { id: 'local-user', email: 'user@local.dev' };
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

