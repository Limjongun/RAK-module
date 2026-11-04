// Cloud Database Adapter (Full Cloud Layer via Cloudflare D1)
import { initLocalDB } from './local-db.js';

let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { isOnline = true; });
  window.addEventListener('offline', () => { isOnline = false; });
}

/**
 * Konversi Uint8Array ke Base64 (Standard Web API tanpa buffer eksternal)
 */
export function uint8ToBase64(uint8) {
  let binary = '';
  const len = uint8.byteLength;
  const sliceSize = 8192;
  for (let i = 0; i < len; i += sliceSize) {
    binary += String.fromCharCode.apply(null, uint8.subarray(i, Math.min(i + sliceSize, len)));
  }
  return btoa(binary);
}

/**
 * Unggah berkas dokumen (PDF / DOCX) ke Cloudflare D1 dalam potongan chunk 384 KB
 */
export async function uploadFileToCloud(documentId, fileBlob, fileName = 'dokumen', mimeType = '') {
  if (!fileBlob || !(fileBlob instanceof Blob)) return false;

  try {
    const arrayBuffer = await fileBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const totalSize = bytes.length;
    const CHUNK_SIZE = 384 * 1024; // 384 KB raw -> ~512 KB base64
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE) || 1;
    const resolvedMime = mimeType || fileBlob.type || (fileName.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf');

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunkBytes = bytes.subarray(start, end);
      const chunkData = uint8ToBase64(chunkBytes);

      const payload = {
        document_id: documentId,
        chunk_index: i,
        total_chunks: totalChunks,
        chunk_data: chunkData,
        file_name: fileName,
        mime_type: resolvedMime,
        file_size: totalSize
      };

      const res = await fetch('/api/db/file/chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        console.warn(`Gagal unggah chunk ${i + 1}/${totalChunks}`);
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error('uploadFileToCloud error:', err);
    return false;
  }
}

/**
 * Unduh berkas dokumen biner dari Cloudflare D1
 */
export async function downloadFileFromCloud(documentId) {
  try {
    const res = await fetch(`/api/db/file/${documentId}`);
    if (!res.ok) return null;
    return await res.blob();
  } catch (err) {
    console.warn('downloadFileFromCloud error:', err);
    return null;
  }
}

/**
 * Kirim pembaruan atau penghapusan item tunggal ke Cloudflare D1 secara instan
 */
export async function dispatchCloudSync(table, action, dataOrId) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  try {
    const payload = {};
    if (action === 'delete') {
      payload.deletions = [{ table, id: dataOrId }];
    } else {
      const clean = { ...dataOrId };
      delete clean._cachedBlob;
      payload[table] = [clean];
    }

    await fetch('/api/db/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn(`dispatchCloudSync [${table}] error:`, err);
  }
}

/**
 * Tarik seluruh data terbaru dari Cloudflare D1 dan perbarui cache IndexedDB
 */
export async function syncFromCloudToLocal() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;

  try {
    const res = await fetch('/api/db/pull');
    if (!res.ok) return null;

    const data = await res.json();
    const db = await initLocalDB();

    // 1. Documents
    if (Array.isArray(data.documents)) {
      for (const d of data.documents) {
        try {
          const existing = await db.get('documents', d.id);
          await db.put('documents', {
            ...d,
            thumb_data: d.thumb_data || existing?.thumb_data || null,
            _cachedBlob: existing?._cachedBlob || null
          });
        } catch (_) {}
      }
    }

    // 2. Todos
    if (Array.isArray(data.todos)) {
      for (const t of data.todos) {
        try {
          await db.put('todos', t);
        } catch (_) {}
      }
      try {
        localStorage.setItem('rak_modul_todos_cache', JSON.stringify(data.todos));
      } catch (_) {}
    }

    // 3. Code Notebooks
    if (Array.isArray(data.code_notebooks)) {
      for (const nb of data.code_notebooks) {
        try {
          await db.put('code_notebooks', nb);
        } catch (_) {}
      }
    }

    // 4. Annotations
    if (Array.isArray(data.annotations)) {
      for (const a of data.annotations) {
        try {
          await db.put('annotations', a);
        } catch (_) {}
      }
    }

    // 5. Reading Progress
    if (Array.isArray(data.reading_progress)) {
      for (const p of data.reading_progress) {
        try {
          await db.put('reading_progress', p);
        } catch (_) {}
      }
    }

    // 6. Flashcards
    if (Array.isArray(data.flashcards)) {
      for (const fc of data.flashcards) {
        try {
          await db.put('flashcards', fc);
        } catch (_) {}
      }
    }

    // 7. Study Sessions
    if (Array.isArray(data.study_sessions)) {
      for (const s of data.study_sessions) {
        try {
          await db.put('study_sessions', s);
        } catch (_) {}
      }
    }

    return data;
  } catch (err) {
    console.warn('syncFromCloudToLocal error:', err);
    return null;
  }
}

