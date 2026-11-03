// Two-Way Sync Engine: Cloudflare D1 (Primary Serverless SQL) & Supabase (Optional)
import { initLocalDB } from './local-db.js';
import { supabase, isSupabaseConfigured } from './supabase.js';

let isSyncing = false;
let lastSyncTime = null;
let lastSyncError = null;
let d1Available = null; // null: belum diuji, true: aktif, false: tidak ada

export function getSyncState() {
  return {
    isSyncing,
    lastSyncTime,
    lastSyncError,
    d1Available: Boolean(d1Available),
    isSupabaseConfigured: isSupabaseConfigured()
  };
}

function notifySyncChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rak-sync-changed', { detail: getSyncState() }));
  }
}

// -------------------------------------------------------------
// 1. CLOUDFLARE D1 SYNC ENGINE
// -------------------------------------------------------------

export async function checkD1Status() {
  try {
    const res = await fetch('/api/db/status');
    if (res.ok) {
      const data = await res.json();
      d1Available = Boolean(data.ok);
      return data;
    }
  } catch (_) {}
  d1Available = false;
  return { ok: false };
}

export async function pushAllToD1() {
  const db = await initLocalDB();
  const payload = {
    todos: [],
    documents: [],
    code_notebooks: [],
    annotations: [],
    reading_progress: [],
    flashcards: [],
    study_sessions: []
  };

  if (db.objectStoreNames.contains('todos')) {
    payload.todos = await db.getAll('todos');
  }
  if (db.objectStoreNames.contains('documents')) {
    const docs = await db.getAll('documents');
    payload.documents = docs.map(d => {
      const clean = { ...d };
      delete clean._cachedBlob;
      return clean;
    });
  }
  if (db.objectStoreNames.contains('code_notebooks')) {
    payload.code_notebooks = await db.getAll('code_notebooks');
  }
  if (db.objectStoreNames.contains('annotations')) {
    payload.annotations = await db.getAll('annotations');
  }
  if (db.objectStoreNames.contains('reading_progress')) {
    payload.reading_progress = await db.getAll('reading_progress');
  }
  if (db.objectStoreNames.contains('flashcards')) {
    payload.flashcards = await db.getAll('flashcards');
  }
  if (db.objectStoreNames.contains('study_sessions')) {
    payload.study_sessions = await db.getAll('study_sessions');
  }

  const res = await fetch('/api/db/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal push data ke Cloudflare D1');
  }

  return res.json();
}

export async function pullAllFromD1() {
  const res = await fetch('/api/db/pull');
  if (!res.ok) {
    throw new Error('Gagal pull data dari Cloudflare D1');
  }

  const data = await res.json();
  const db = await initLocalDB();

  // 1. Todos
  if (Array.isArray(data.todos) && data.todos.length > 0) {
    const tx = db.transaction('todos', 'readwrite');
    for (const t of data.todos) {
      await tx.store.put(t);
    }
    await tx.done;
    try {
      localStorage.setItem('rak_modul_todos_cache', JSON.stringify(data.todos));
    } catch (_) {}
  }

  // 2. Documents
  if (Array.isArray(data.documents) && data.documents.length > 0) {
    const tx = db.transaction('documents', 'readwrite');
    for (const d of data.documents) {
      const existing = await tx.store.get(d.id);
      await tx.store.put({ ...d, _cachedBlob: existing?._cachedBlob || null });
    }
    await tx.done;
  }

  // 3. Code Notebooks
  if (Array.isArray(data.code_notebooks) && data.code_notebooks.length > 0) {
    const tx = db.transaction('code_notebooks', 'readwrite');
    for (const nb of data.code_notebooks) {
      await tx.store.put(nb);
    }
    await tx.done;
  }

  // 4. Annotations
  if (Array.isArray(data.annotations) && data.annotations.length > 0) {
    const tx = db.transaction('annotations', 'readwrite');
    for (const a of data.annotations) {
      await tx.store.put(a);
    }
    await tx.done;
  }

  // 5. Reading Progress
  if (Array.isArray(data.reading_progress) && data.reading_progress.length > 0) {
    const tx = db.transaction('reading_progress', 'readwrite');
    for (const p of data.reading_progress) {
      await tx.store.put(p);
    }
    await tx.done;
  }

  // 6. Flashcards
  if (Array.isArray(data.flashcards) && data.flashcards.length > 0) {
    const tx = db.transaction('flashcards', 'readwrite');
    for (const fc of data.flashcards) {
      await tx.store.put(fc);
    }
    await tx.done;
  }

  return data;
}

// -------------------------------------------------------------
// 2. SUPABASE SYNC ENGINE (OPSIONAL FALLBACK)
// -------------------------------------------------------------

export async function flushSyncQueue() {
  if (!isSupabaseConfigured() || isSyncing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  try {
    const db = await initLocalDB();
    if (!db.objectStoreNames.contains('sync_queue')) return;

    const queue = await db.getAll('sync_queue');
    if (!queue || queue.length === 0) return;

    for (const item of queue) {
      try {
        if (item.action === 'upsert') {
          const payload = { ...item.data };
          delete payload._cachedBlob;
          const { error } = await supabase.from(item.table).upsert(payload);
          if (!error) await db.delete('sync_queue', item.id);
        } else if (item.action === 'delete') {
          const { error } = await supabase.from(item.table).delete().eq('id', item.id);
          if (!error) await db.delete('sync_queue', item.id);
        }
      } catch (err) {
        console.warn('Sync queue error:', item, err);
      }
    }
  } catch (err) {
    console.error('Flush sync queue error:', err);
  }
}

// -------------------------------------------------------------
// 3. FULL TWO-WAY SYNC (Prioritas: D1 -> Supabase)
// -------------------------------------------------------------

export async function testSupabaseConnection() {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'URL atau Anon Key Supabase belum diisi.' };
  }
  try {
    const { data, error } = await supabase.from('todos').select('id').limit(1);
    if (error) {
      return { ok: false, message: `Koneksi gagal: ${error.message}` };
    }
    return { ok: true, message: 'Koneksi ke database Supabase berhasil!' };
  } catch (err) {
    return { ok: false, message: `Error koneksi: ${err.message}` };
  }
}

export async function fullSync() {
  if (isSyncing) return { success: false, reason: 'already_syncing' };
  isSyncing = true;
  lastSyncError = null;
  notifySyncChange();

  try {
    // 1. Cek Cloudflare D1 terlebih dahulu
    const status = await checkD1Status();
    if (status && status.ok) {
      await pushAllToD1();
      await pullAllFromD1();
      lastSyncTime = new Date().toISOString();
      isSyncing = false;
      notifySyncChange();
      return { success: true, target: 'Cloudflare D1 (rakmodule)', time: lastSyncTime };
    }

    // 2. Jika D1 belum aktif, gunakan Supabase jika dikonfigurasi
    if (isSupabaseConfigured()) {
      await flushSyncQueue();
      lastSyncTime = new Date().toISOString();
      isSyncing = false;
      notifySyncChange();
      return { success: true, target: 'Supabase', time: lastSyncTime };
    }

    isSyncing = false;
    notifySyncChange();
    return { success: false, reason: 'unconfigured' };
  } catch (err) {
    lastSyncError = err.message;
    isSyncing = false;
    notifySyncChange();
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// AUTO-SYNC ON INITIAL LOAD & NETWORK ONLINE
// -------------------------------------------------------------

if (typeof window !== 'undefined') {
  // Sync otomatis saat web dibuka
  setTimeout(() => {
    fullSync().catch(err => console.log('Auto initial sync note:', err));
  }, 2000);

  // Sync saat koneksi internet kembali online
  window.addEventListener('online', () => {
    fullSync().catch(err => console.log('Auto online sync note:', err));
  });
}
