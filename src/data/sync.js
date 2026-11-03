// Two-Way Sync Engine between IndexedDB (Local-First) and Supabase (PostgreSQL Cloud)
import { initLocalDB } from './local-db.js';
import { supabase, isSupabaseConfigured } from './supabase.js';

let isSyncing = false;
let lastSyncTime = null;
let lastSyncError = null;

export function getSyncState() {
  return {
    isSyncing,
    lastSyncTime,
    lastSyncError,
    isConfigured: isSupabaseConfigured()
  };
}

function notifySyncChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rak-sync-changed', { detail: getSyncState() }));
  }
}

// 1. Menguras antrean perubahan offline (outbox queue)
export async function flushSyncQueue() {
  if (!isSupabaseConfigured() || isSyncing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  isSyncing = true;
  lastSyncError = null;
  notifySyncChange();

  try {
    const db = await initLocalDB();
    if (!db.objectStoreNames.contains('sync_queue')) {
      isSyncing = false;
      notifySyncChange();
      return;
    }

    const queue = await db.getAll('sync_queue');
    if (!queue || queue.length === 0) {
      isSyncing = false;
      notifySyncChange();
      return;
    }

    for (const item of queue) {
      try {
        if (item.action === 'upsert') {
          // Bersihkan file binary blob sebelum dikirim ke Supabase
          const payload = { ...item.data };
          delete payload._cachedBlob;

          const { error } = await supabase.from(item.table).upsert(payload);
          if (!error) {
            await db.delete('sync_queue', item.id);
          } else {
            console.warn(`Gagal sync item ${item.table}:`, error);
          }
        } else if (item.action === 'delete') {
          const { error } = await supabase.from(item.table).delete().eq('id', item.id);
          if (!error) {
            await db.delete('sync_queue', item.id);
          }
        }
      } catch (err) {
        console.warn('Sync queue error:', item, err);
      }
    }

    lastSyncTime = new Date().toISOString();
  } catch (err) {
    lastSyncError = err.message;
    console.error('Flush sync queue error:', err);
  } finally {
    isSyncing = false;
    notifySyncChange();
  }
}

// 2. Mendorong seluruh data lokal yang ada ke Supabase (Initial / Manual Push)
export async function pushAllLocalData() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase belum dikonfigurasi. Masukkan URL & Anon Key terlebih dahulu.');
  }

  isSyncing = true;
  notifySyncChange();

  try {
    const db = await initLocalDB();

    // 1. Documents (tanpa blob biner)
    if (db.objectStoreNames.contains('documents')) {
      const docs = await db.getAll('documents');
      if (docs.length > 0) {
        const cleanDocs = docs.map(d => {
          const c = { ...d };
          delete c._cachedBlob;
          return c;
        });
        await supabase.from('documents').upsert(cleanDocs);
      }
    }

    // 2. Pages Text
    if (db.objectStoreNames.contains('pages')) {
      const pages = await db.getAll('pages');
      if (pages.length > 0) {
        // Chunk per 100 pages agar aman dari batasan ukuran payload Supabase
        for (let i = 0; i < pages.length; i += 100) {
          await supabase.from('pages').upsert(pages.slice(i, i + 100));
        }
      }
    }

    // 3. Annotations
    if (db.objectStoreNames.contains('annotations')) {
      const annots = await db.getAll('annotations');
      if (annots.length > 0) {
        await supabase.from('annotations').upsert(annots);
      }
    }

    // 4. Reading Progress
    if (db.objectStoreNames.contains('reading_progress')) {
      const progresses = await db.getAll('reading_progress');
      if (progresses.length > 0) {
        await supabase.from('reading_progress').upsert(progresses);
      }
    }

    // 5. Todos (Agenda Belajar)
    if (db.objectStoreNames.contains('todos')) {
      const todos = await db.getAll('todos');
      if (todos.length > 0) {
        await supabase.from('todos').upsert(todos);
      }
    }

    // 6. Code Notebooks (Kode Bank)
    if (db.objectStoreNames.contains('code_notebooks')) {
      const notebooks = await db.getAll('code_notebooks');
      if (notebooks.length > 0) {
        await supabase.from('code_notebooks').upsert(notebooks);
      }
    }

    // 7. Flashcards
    if (db.objectStoreNames.contains('flashcards')) {
      const cards = await db.getAll('flashcards');
      if (cards.length > 0) {
        await supabase.from('flashcards').upsert(cards);
      }
    }

    // 8. Study Sessions
    if (db.objectStoreNames.contains('study_sessions')) {
      const sessions = await db.getAll('study_sessions');
      if (sessions.length > 0) {
        await supabase.from('study_sessions').upsert(sessions);
      }
    }

    lastSyncTime = new Date().toISOString();
  } catch (err) {
    lastSyncError = err.message;
    console.error('pushAllLocalData error:', err);
    throw err;
  } finally {
    isSyncing = false;
    notifySyncChange();
  }
}

// 3. Menarik seluruh data dari Supabase ke IndexedDB Lokal (Pull from Cloud)
export async function pullAllRemoteData() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase belum dikonfigurasi.');
  }

  isSyncing = true;
  notifySyncChange();

  try {
    const db = await initLocalDB();

    // 1. Documents
    const { data: remoteDocs } = await supabase.from('documents').select('*');
    if (remoteDocs && remoteDocs.length > 0) {
      const tx = db.transaction('documents', 'readwrite');
      for (const doc of remoteDocs) {
        const existing = await tx.store.get(doc.id);
        // Pertahankan _cachedBlob lokal jika ada
        const merged = { ...doc, _cachedBlob: existing?._cachedBlob || null };
        await tx.store.put(merged);
      }
      await tx.done;
    }

    // 2. Annotations
    const { data: remoteAnnots } = await supabase.from('annotations').select('*');
    if (remoteAnnots && remoteAnnots.length > 0) {
      const tx = db.transaction('annotations', 'readwrite');
      for (const a of remoteAnnots) {
        await tx.store.put(a);
      }
      await tx.done;
    }

    // 3. Reading Progress
    const { data: remoteProgress } = await supabase.from('reading_progress').select('*');
    if (remoteProgress && remoteProgress.length > 0) {
      const tx = db.transaction('reading_progress', 'readwrite');
      for (const p of remoteProgress) {
        await tx.store.put(p);
      }
      await tx.done;
    }

    // 4. Todos
    const { data: remoteTodos } = await supabase.from('todos').select('*');
    if (remoteTodos && remoteTodos.length > 0) {
      const tx = db.transaction('todos', 'readwrite');
      for (const t of remoteTodos) {
        await tx.store.put(t);
      }
      await tx.done;
      // Perbarui juga cache localStorage untuk ketahanan instan
      try {
        localStorage.setItem('rak_modul_todos_cache', JSON.stringify(remoteTodos));
      } catch (_) {}
    }

    // 5. Code Notebooks
    const { data: remoteNotebooks } = await supabase.from('code_notebooks').select('*');
    if (remoteNotebooks && remoteNotebooks.length > 0) {
      const tx = db.transaction('code_notebooks', 'readwrite');
      for (const nb of remoteNotebooks) {
        await tx.store.put(nb);
      }
      await tx.done;
    }

    // 6. Flashcards
    const { data: remoteCards } = await supabase.from('flashcards').select('*');
    if (remoteCards && remoteCards.length > 0) {
      const tx = db.transaction('flashcards', 'readwrite');
      for (const fc of remoteCards) {
        await tx.store.put(fc);
      }
      await tx.done;
    }

    // 7. Study Sessions
    const { data: remoteSessions } = await supabase.from('study_sessions').select('*');
    if (remoteSessions && remoteSessions.length > 0) {
      const tx = db.transaction('study_sessions', 'readwrite');
      for (const s of remoteSessions) {
        await tx.store.put(s);
      }
      await tx.done;
    }

    lastSyncTime = new Date().toISOString();
  } catch (err) {
    lastSyncError = err.message;
    console.error('pullAllRemoteData error:', err);
    throw err;
  } finally {
    isSyncing = false;
    notifySyncChange();
  }
}

// 4. Sinkronisasi Penuh Dua Arah (Full Two-Way Sync)
export async function fullSync() {
  if (!isSupabaseConfigured()) return { success: false, reason: 'unconfigured' };
  try {
    await flushSyncQueue();
    await pushAllLocalData();
    await pullAllRemoteData();
    return { success: true, time: lastSyncTime };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 5. Uji Koneksi ke Supabase
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

// Pasang listener online otomatis
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    fullSync().catch(err => console.warn('Auto-sync on online failed:', err));
  });
}
