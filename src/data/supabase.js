// Supabase Client with dynamic credentials & graceful offline fallback
import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'rak_supabase_url';
const STORAGE_KEY_KEY = 'rak_supabase_anon_key';

export function getSupabaseCredentials() {
  let url = '';
  let key = '';
  try {
    if (typeof localStorage !== 'undefined') {
      url = localStorage.getItem(STORAGE_KEY_URL) || '';
      key = localStorage.getItem(STORAGE_KEY_KEY) || '';
    }
  } catch (_) {}

  if (!url && typeof import.meta !== 'undefined' && import.meta.env) {
    url = import.meta.env.VITE_SUPABASE_URL || '';
  }
  if (!key && typeof import.meta !== 'undefined' && import.meta.env) {
    key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  }

  return { url: (url || '').trim(), key: (key || '').trim() };
}

export function saveSupabaseCredentials(url, key) {
  try {
    if (typeof localStorage !== 'undefined') {
      if (url && key) {
        localStorage.setItem(STORAGE_KEY_URL, url.trim());
        localStorage.setItem(STORAGE_KEY_KEY, key.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY_URL);
        localStorage.removeItem(STORAGE_KEY_KEY);
      }
    }
  } catch (_) {}
  reinitSupabase();
}

let clientInstance = null;

export function getSupabaseClient() {
  if (!clientInstance) {
    const { url, key } = getSupabaseCredentials();
    if (url && key) {
      try {
        clientInstance = createClient(url, key);
      } catch (err) {
        console.warn('Gagal inisialisasi Supabase client:', err);
        clientInstance = null;
      }
    }
  }
  return clientInstance;
}

export function reinitSupabase() {
  clientInstance = null;
  return getSupabaseClient();
}

export function isSupabaseConfigured() {
  const { url, key } = getSupabaseCredentials();
  return Boolean(url && key && getSupabaseClient());
}

// Proxied supabase export to maintain 100% backward compatibility
export const supabase = {
  from(table) {
    const client = getSupabaseClient();
    if (!client) {
      // Mock builder that fails gracefully
      return {
        select: () => Promise.resolve({ data: null, error: new Error('Supabase belum dikonfigurasi') }),
        upsert: () => Promise.resolve({ data: null, error: new Error('Supabase belum dikonfigurasi') }),
        insert: () => Promise.resolve({ data: null, error: new Error('Supabase belum dikonfigurasi') }),
        delete: () => Promise.resolve({ data: null, error: new Error('Supabase belum dikonfigurasi') }),
        eq: () => Promise.resolve({ data: null, error: new Error('Supabase belum dikonfigurasi') })
      };
    }
    return client.from(table);
  },
  auth: {
    async getUser() {
      const client = getSupabaseClient();
      if (!client) return { data: { user: { id: 'default_user', email: 'user@local.dev' } } };
      try {
        const res = await client.auth.getUser();
        if (res.data?.user) return res;
      } catch (_) {}
      return { data: { user: { id: 'default_user', email: 'user@local.dev' } } };
    }
  }
};

// Auth helper
export async function getCurrentUser() {
  return (await supabase.auth.getUser()).data.user;
}
