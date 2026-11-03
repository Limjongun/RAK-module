// Sync Engine between IndexedDB outbox and Supabase Postgres
import { initLocalDB } from './local-db.js';
import { supabase, isSupabaseConfigured } from './supabase.js';

let isSyncing = false;

export async function flushSyncQueue() {
  if (!isSupabaseConfigured || isSyncing || !navigator.onLine) return;
  isSyncing = true;

  try {
    const db = await initLocalDB();
    const queue = await db.getAll('sync_queue');
    if (!queue || queue.length === 0) {
      isSyncing = false;
      return;
    }

    for (const item of queue) {
      try {
        if (item.action === 'upsert') {
          const { error } = await supabase.from(item.table).upsert(item.data);
          if (!error) {
            await db.delete('sync_queue', item.id);
          }
        } else if (item.action === 'delete') {
          const { error } = await supabase.from(item.table).delete().eq('id', item.id);
          if (!error) {
            await db.delete('sync_queue', item.id);
          }
        }
      } catch (err) {
        console.warn('Sync item failed:', item, err);
      }
    }
  } catch (err) {
    console.error('Flush sync queue error:', err);
  } finally {
    isSyncing = false;
  }
}

// Listen to network changes
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushSyncQueue();
  });
}

