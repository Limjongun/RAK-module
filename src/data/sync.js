// Two-Way Sync Engine: Cloudflare D1 (Primary Serverless SQL) & Supabase (Optional)
import { initLocalDB } from './local-db.js';
import { supabase, isSupabaseConfigured } from './supabase.js';

let isSyncing = false;
let activeSyncPromise = null;
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

  // Jika perangkat ini baru dibuka dan masih kosong, tidak perlu kirim payload kosong
  const hasLocalData = Object.values(payload).some(arr => arr.length > 0);
  if (!hasLocalData) {
    return { success: true, processed: 0, note: 'empty_local' };
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
    for (const t of data.todos) {
      try {
        await db.put('todos', t);
      } catch (err) {
        console.warn('Gagal simpan todo ke IndexedDB:', t.id, err);
      }
    }
    try {
      localStorage.setItem('rak_modul_todos_cache', JSON.stringify(data.todos));
    } catch (_) {}
  }

  // 2. Documents
  if (Array.isArray(data.documents) && data.documents.length > 0) {
    for (const d of data.documents) {
      try {
        const existing = await db.get('documents', d.id);
        await db.put('documents', {
          ...d,
          _cachedBlob: existing?._cachedBlob || null
        });
      } catch (err) {
        console.warn('Gagal simpan dokumen ke IndexedDB:', d.id, err);
      }
    }
  }

  // 3. Code Notebooks
  if (Array.isArray(data.code_notebooks) && data.code_notebooks.length > 0) {
    for (const nb of data.code_notebooks) {
      try {
        await db.put('code_notebooks', nb);
      } catch (err) {
        console.warn('Gagal simpan notebook ke IndexedDB:', nb.id, err);
      }
    }
  }

  // 4. Annotations
  if (Array.isArray(data.annotations) && data.annotations.length > 0) {
    for (const a of data.annotations) {
      try {
        await db.put('annotations', a);
      } catch (err) {
        console.warn('Gagal simpan anotasi ke IndexedDB:', a.id, err);
      }
    }
  }

  // 5. Reading Progress
  if (Array.isArray(data.reading_progress) && data.reading_progress.length > 0) {
    for (const p of data.reading_progress) {
      try {
        await db.put('reading_progress', p);
      } catch (err) {
        console.warn('Gagal simpan reading_progress ke IndexedDB:', p.document_id, err);
      }
    }
  }

  // 6. Flashcards
  if (Array.isArray(data.flashcards) && data.flashcards.length > 0) {
    for (const fc of data.flashcards) {
      try {
        await db.put('flashcards', fc);
      } catch (err) {
        console.warn('Gagal simpan flashcard ke IndexedDB:', fc.id, err);
      }
    }
  }

  // 7. Study Sessions
  if (Array.isArray(data.study_sessions) && data.study_sessions.length > 0) {
    for (const s of data.study_sessions) {
      try {
        await db.put('study_sessions', s);
      } catch (err) {
        console.warn('Gagal simpan session ke IndexedDB:', s.id, err);
      }
    }
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
  // Jika sinkronisasi sedang berjalan, tunggu hingga proses selesai
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
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
        return { success: true, target: 'Cloudflare D1 (rakmodule)', time: lastSyncTime };
      }

      // 2. Jika D1 belum aktif, gunakan Supabase jika dikonfigurasi
      if (isSupabaseConfigured()) {
        await flushSyncQueue();
        lastSyncTime = new Date().toISOString();
        return { success: true, target: 'Supabase', time: lastSyncTime };
      }

      return { success: false, reason: 'unconfigured' };
    } catch (err) {
      console.error('fullSync error:', err);
      lastSyncError = err.message;
      return { success: false, error: err.message };
    } finally {
      isSyncing = false;
      activeSyncPromise = null;
      notifySyncChange();
    }
  })();

  return activeSyncPromise;
}

// -------------------------------------------------------------
// AUTO-SYNC ON INITIAL LOAD & NETWORK ONLINE
// -------------------------------------------------------------

if (typeof window !== 'undefined') {
  // Sync otomatis saat web dibuka (tunggu 500ms agar IndexedDB siap)
  setTimeout(() => {
    fullSync().catch(err => console.log('Auto initial sync note:', err));
  }, 500);

  // Sync saat koneksi internet kembali online
  window.addEventListener('online', () => {
    fullSync().catch(err => console.log('Auto online sync note:', err));
  });
}
