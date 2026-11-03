// Cloudflare Worker API untuk Rak Modul
// Mendukung Cloudflare D1 SQL Serverless Database (Gratis 5 GB) & Static Assets

// Skema D1 SQLite Helper
async function ensureTables(db) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        user_id TEXT DEFAULT 'default_user',
        title TEXT NOT NULL,
        source_type TEXT,
        course_id TEXT,
        course_name TEXT DEFAULT 'Umum',
        original_key TEXT,
        pdf_key TEXT,
        thumb_key TEXT,
        page_count INTEGER DEFAULT 1,
        language TEXT DEFAULT 'id',
        tags TEXT DEFAULT '[]',
        status TEXT DEFAULT 'ready',
        created_at TEXT,
        updated_at TEXT
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS pages (
        document_id TEXT,
        page_no INTEGER,
        text TEXT,
        PRIMARY KEY (document_id, page_no)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS annotations (
        id TEXT PRIMARY KEY,
        user_id TEXT DEFAULT 'default_user',
        document_id TEXT,
        page_no INTEGER,
        kind TEXT,
        color TEXT,
        geometry TEXT,
        quote TEXT,
        note_md TEXT,
        tags TEXT DEFAULT '[]',
        updated_at TEXT,
        deleted INTEGER DEFAULT 0
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS reading_progress (
        document_id TEXT PRIMARY KEY,
        user_id TEXT DEFAULT 'default_user',
        last_page INTEGER DEFAULT 1,
        scroll_ratio REAL DEFAULT 0,
        tts_sentence INTEGER DEFAULT 0,
        percent REAL DEFAULT 0,
        updated_at TEXT
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        user_id TEXT DEFAULT 'default_user',
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        due_datetime TEXT,
        priority TEXT DEFAULT 'medium',
        course_name TEXT DEFAULT 'Umum',
        duration_minutes INTEGER DEFAULT 30,
        document_id TEXT,
        completed INTEGER DEFAULT 0,
        completed_at TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS code_notebooks (
        id TEXT PRIMARY KEY,
        user_id TEXT DEFAULT 'default_user',
        title TEXT NOT NULL,
        course_name TEXT DEFAULT 'Umum',
        language TEXT DEFAULT 'python',
        tags TEXT DEFAULT '[]',
        cells TEXT DEFAULT '[]',
        created_at TEXT,
        updated_at TEXT
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS flashcards (
        id TEXT PRIMARY KEY,
        user_id TEXT DEFAULT 'default_user',
        annotation_id TEXT,
        document_id TEXT,
        course_name TEXT DEFAULT 'Umum',
        front TEXT NOT NULL,
        back TEXT NOT NULL,
        due_at TEXT,
        interval_days REAL DEFAULT 0,
        ease REAL DEFAULT 2.5,
        reps INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT DEFAULT 'default_user',
        document_id TEXT,
        minutes INTEGER DEFAULT 25,
        pages_read INTEGER DEFAULT 0,
        started_at TEXT,
        created_at TEXT
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS document_files (
        document_id TEXT,
        chunk_index INTEGER,
        chunk_data TEXT,
        PRIMARY KEY (document_id, chunk_index)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS document_file_meta (
        document_id TEXT PRIMARY KEY,
        file_name TEXT,
        mime_type TEXT,
        file_size INTEGER,
        total_chunks INTEGER,
        updated_at TEXT
      )
    `)
  ]);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. GET /api/health
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        time: new Date().toISOString(),
        d1_configured: Boolean(env.DB)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. CLOUDFLARE D1 DATABASE SYNC ENDPOINTS
    if (url.pathname.startsWith('/api/db/')) {
      if (!env.DB) {
        return new Response(JSON.stringify({ 
          error: 'D1 Database belum terhubung (binding DB tidak ditemukan)' 
        }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Pastikan tabel selalu siap
      try {
        await ensureTables(env.DB);
      } catch (err) {
        console.warn('ensureTables error:', err);
      }

      // 2a. GET /api/db/status
      if (url.pathname === '/api/db/status') {
        try {
          const docCount = await env.DB.prepare('SELECT count(*) as count FROM documents').first();
          const todoCount = await env.DB.prepare('SELECT count(*) as count FROM todos').first();
          const nbCount = await env.DB.prepare('SELECT count(*) as count FROM code_notebooks').first();
          const annotCount = await env.DB.prepare('SELECT count(*) as count FROM annotations').first();

          return new Response(JSON.stringify({
            ok: true,
            database: 'rakmodule',
            counts: {
              documents: docCount?.count || 0,
              todos: todoCount?.count || 0,
              notebooks: nbCount?.count || 0,
              annotations: annotCount?.count || 0
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: e.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 2b. POST /api/db/sync (Push local changes into D1)
      if (url.pathname === '/api/db/sync' && request.method === 'POST') {
        try {
          const body = await request.json();
          const statements = [];

          // Todos
          if (Array.isArray(body.todos)) {
            for (const t of body.todos) {
              statements.push(env.DB.prepare(`
                INSERT INTO todos (id, user_id, title, description, due_datetime, priority, course_name, duration_minutes, document_id, completed, completed_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  title=excluded.title,
                  description=excluded.description,
                  due_datetime=excluded.due_datetime,
                  priority=excluded.priority,
                  course_name=excluded.course_name,
                  duration_minutes=excluded.duration_minutes,
                  document_id=excluded.document_id,
                  completed=excluded.completed,
                  completed_at=excluded.completed_at,
                  updated_at=excluded.updated_at
              `).bind(
                t.id, t.user_id || 'default_user', t.title || '', t.description || '',
                t.due_datetime || null, t.priority || 'medium', t.course_name || 'Umum',
                Number(t.duration_minutes) || 30, t.document_id || null,
                t.completed ? 1 : 0, t.completed_at || null,
                t.created_at || new Date().toISOString(), t.updated_at || new Date().toISOString()
              ));
            }
          }

          // Documents
          if (Array.isArray(body.documents)) {
            for (const d of body.documents) {
              statements.push(env.DB.prepare(`
                INSERT INTO documents (id, user_id, title, source_type, course_id, course_name, page_count, language, tags, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  title=excluded.title,
                  source_type=excluded.source_type,
                  course_name=excluded.course_name,
                  page_count=excluded.page_count,
                  tags=excluded.tags,
                  status=excluded.status,
                  updated_at=excluded.updated_at
              `).bind(
                d.id, d.user_id || 'default_user', d.title || 'Dokumen Tanpa Judul',
                d.source_type || 'pdf', d.course_id || null, d.course_name || 'Umum',
                Number(d.page_count) || 1, d.language || 'id',
                JSON.stringify(d.tags || []), d.status || 'ready',
                d.created_at || new Date().toISOString(), d.updated_at || new Date().toISOString()
              ));
            }
          }

          // Code Notebooks
          if (Array.isArray(body.code_notebooks)) {
            for (const nb of body.code_notebooks) {
              statements.push(env.DB.prepare(`
                INSERT INTO code_notebooks (id, user_id, title, course_name, language, tags, cells, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  title=excluded.title,
                  course_name=excluded.course_name,
                  language=excluded.language,
                  tags=excluded.tags,
                  cells=excluded.cells,
                  updated_at=excluded.updated_at
              `).bind(
                nb.id, nb.user_id || 'default_user', nb.title || 'Notebook',
                nb.course_name || 'Umum', nb.language || 'python',
                JSON.stringify(nb.tags || []), JSON.stringify(nb.cells || []),
                nb.created_at || new Date().toISOString(), nb.updated_at || new Date().toISOString()
              ));
            }
          }

          // Annotations
          if (Array.isArray(body.annotations)) {
            for (const a of body.annotations) {
              statements.push(env.DB.prepare(`
                INSERT INTO annotations (id, user_id, document_id, page_no, kind, color, geometry, quote, note_md, tags, updated_at, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  kind=excluded.kind,
                  color=excluded.color,
                  geometry=excluded.geometry,
                  quote=excluded.quote,
                  note_md=excluded.note_md,
                  tags=excluded.tags,
                  updated_at=excluded.updated_at,
                  deleted=excluded.deleted
              `).bind(
                a.id, a.user_id || 'default_user', a.document_id,
                Number(a.page_no) || 1, a.kind || 'highlight', a.color || 'yellow',
                typeof a.geometry === 'string' ? a.geometry : JSON.stringify(a.geometry || {}),
                a.quote || '', a.note_md || '', JSON.stringify(a.tags || []),
                a.updated_at || new Date().toISOString(), a.deleted ? 1 : 0
              ));
            }
          }

          // Reading Progress
          if (Array.isArray(body.reading_progress)) {
            for (const p of body.reading_progress) {
              statements.push(env.DB.prepare(`
                INSERT INTO reading_progress (document_id, user_id, last_page, scroll_ratio, tts_sentence, percent, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(document_id) DO UPDATE SET
                  last_page=excluded.last_page,
                  scroll_ratio=excluded.scroll_ratio,
                  tts_sentence=excluded.tts_sentence,
                  percent=excluded.percent,
                  updated_at=excluded.updated_at
              `).bind(
                p.document_id, p.user_id || 'default_user',
                Number(p.last_page) || 1, Number(p.scroll_ratio) || 0,
                Number(p.tts_sentence) || 0, Number(p.percent) || 0,
                p.updated_at || new Date().toISOString()
              ));
            }
          }

          // Flashcards
          if (Array.isArray(body.flashcards)) {
            for (const fc of body.flashcards) {
              statements.push(env.DB.prepare(`
                INSERT INTO flashcards (id, user_id, annotation_id, document_id, course_name, front, back, due_at, interval_days, ease, reps, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  front=excluded.front,
                  back=excluded.back,
                  due_at=excluded.due_at,
                  interval_days=excluded.interval_days,
                  ease=excluded.ease,
                  reps=excluded.reps,
                  updated_at=excluded.updated_at
              `).bind(
                fc.id, fc.user_id || 'default_user', fc.annotation_id || null,
                fc.document_id || null, fc.course_name || 'Umum',
                fc.front || '', fc.back || '', fc.due_at || new Date().toISOString(),
                Number(fc.interval_days) || 0, Number(fc.ease) || 2.5, Number(fc.reps) || 0,
                fc.created_at || new Date().toISOString(), fc.updated_at || new Date().toISOString()
              ));
            }
          }

          // Study Sessions
          if (Array.isArray(body.study_sessions)) {
            for (const s of body.study_sessions) {
              statements.push(env.DB.prepare(`
                INSERT INTO study_sessions (user_id, document_id, minutes, pages_read, started_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
              `).bind(
                s.user_id || 'default_user', s.document_id || null,
                Number(s.minutes) || 25, Number(s.pages_read) || 0,
                s.started_at || new Date().toISOString(),
                s.created_at || new Date().toISOString()
              ));
            }
          }

          // Extracted Pages Text
          if (Array.isArray(body.pages)) {
            for (const p of body.pages) {
              statements.push(env.DB.prepare(`
                INSERT INTO pages (document_id, page_no, text)
                VALUES (?, ?, ?)
                ON CONFLICT(document_id, page_no) DO UPDATE SET text = excluded.text
              `).bind(p.document_id, Number(p.page_no), p.text || ''));
            }
          }

          // Deletions
          if (Array.isArray(body.deletions)) {
            for (const del of body.deletions) {
              if (['documents', 'todos', 'code_notebooks', 'flashcards', 'annotations'].includes(del.table)) {
                statements.push(env.DB.prepare(`DELETE FROM ${del.table} WHERE id = ?`).bind(del.id));
                if (del.table === 'documents') {
                  statements.push(env.DB.prepare('DELETE FROM document_files WHERE document_id = ?').bind(del.id));
                  statements.push(env.DB.prepare('DELETE FROM document_file_meta WHERE document_id = ?').bind(del.id));
                  statements.push(env.DB.prepare('DELETE FROM pages WHERE document_id = ?').bind(del.id));
                  statements.push(env.DB.prepare('DELETE FROM reading_progress WHERE document_id = ?').bind(del.id));
                  statements.push(env.DB.prepare('DELETE FROM annotations WHERE document_id = ?').bind(del.id));
                }
              }
            }
          }

          if (statements.length > 0) {
            // Eksekusi batch per 50 statements agar aman
            for (let i = 0; i < statements.length; i += 50) {
              await env.DB.batch(statements.slice(i, i + 50));
            }
          }

          return new Response(JSON.stringify({ success: true, processed: statements.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (e) {
          console.error('D1 sync error:', e);
          return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 2c. GET /api/db/pull (Pull all rows from D1 to client)
      if (url.pathname === '/api/db/pull') {
        try {
          const docs = await env.DB.prepare('SELECT * FROM documents').all();
          const todos = await env.DB.prepare('SELECT * FROM todos').all();
          const notebooks = await env.DB.prepare('SELECT * FROM code_notebooks').all();
          const annots = await env.DB.prepare('SELECT * FROM annotations WHERE deleted = 0').all();
          const progress = await env.DB.prepare('SELECT * FROM reading_progress').all();
          const flashcards = await env.DB.prepare('SELECT * FROM flashcards').all();
          const sessions = await env.DB.prepare('SELECT * FROM study_sessions').all();

          // Normalisasi tipe data SQLite ke format objek JavaScript
          const parseJSON = (val, def) => {
            if (!val) return def;
            try { return JSON.parse(val); } catch (_) { return def; }
          };

          return new Response(JSON.stringify({
            documents: (docs.results || []).map(d => ({ ...d, tags: parseJSON(d.tags, []) })),
            todos: (todos.results || []).map(t => ({ ...t, completed: Boolean(t.completed) })),
            code_notebooks: (notebooks.results || []).map(nb => ({
              ...nb,
              tags: parseJSON(nb.tags, []),
              cells: parseJSON(nb.cells, [])
            })),
            annotations: (annots.results || []).map(a => ({
              ...a,
              geometry: parseJSON(a.geometry, {}),
              tags: parseJSON(a.tags, [])
            })),
            reading_progress: progress.results || [],
            flashcards: flashcards.results || [],
            study_sessions: sessions.results || []
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (e) {
          console.error('D1 pull error:', e);
          return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 2d. POST /api/db/file/chunk (Upload file chunk ke Cloudflare D1)
      if (url.pathname === '/api/db/file/chunk' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { document_id, chunk_index, total_chunks, chunk_data, file_name, mime_type, file_size } = body;

          if (!document_id || chunk_index === undefined || !chunk_data) {
            return new Response(JSON.stringify({ error: 'Parameter chunk tidak lengkap' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Simpan potongan chunk
          await env.DB.prepare(`
            INSERT INTO document_files (document_id, chunk_index, chunk_data)
            VALUES (?, ?, ?)
            ON CONFLICT(document_id, chunk_index) DO UPDATE SET chunk_data = excluded.chunk_data
          `).bind(document_id, Number(chunk_index), chunk_data).run();

          // Simpan metadata berkas
          await env.DB.prepare(`
            INSERT INTO document_file_meta (document_id, file_name, mime_type, file_size, total_chunks, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(document_id) DO UPDATE SET
              file_name=excluded.file_name,
              mime_type=excluded.mime_type,
              file_size=excluded.file_size,
              total_chunks=excluded.total_chunks,
              updated_at=excluded.updated_at
          `).bind(
            document_id, file_name || 'document',
            mime_type || 'application/octet-stream',
            Number(file_size) || 0,
            Number(total_chunks) || 1,
            new Date().toISOString()
          ).run();

          return new Response(JSON.stringify({ success: true, chunk_index, total_chunks }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (e) {
          console.error('File chunk upload error:', e);
          return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 2e. GET /api/db/file/:id/status (Periksa status ketersediaan file di Cloud D1)
      if (url.pathname.startsWith('/api/db/file/') && url.pathname.endsWith('/status') && request.method === 'GET') {
        try {
          const parts = url.pathname.split('/');
          const docId = parts[4]; // /api/db/file/:id/status
          const meta = await env.DB.prepare('SELECT * FROM document_file_meta WHERE document_id = ?').bind(docId).first();
          const count = await env.DB.prepare('SELECT count(*) as c FROM document_files WHERE document_id = ?').bind(docId).first();

          return new Response(JSON.stringify({
            exists: Boolean(meta),
            meta: meta || null,
            uploaded_chunks: count?.c || 0
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 2f. GET /api/db/file/:id (Unduh binary file langsung dari Cloudflare D1)
      if (url.pathname.startsWith('/api/db/file/') && request.method === 'GET') {
        const parts = url.pathname.split('/');
        const docId = parts[4]; // /api/db/file/{id}

        if (docId && docId !== 'chunk' && !docId.includes('status')) {
          try {
            const meta = await env.DB.prepare('SELECT * FROM document_file_meta WHERE document_id = ?').bind(docId).first();
            const chunks = await env.DB.prepare('SELECT chunk_data FROM document_files WHERE document_id = ? ORDER BY chunk_index ASC').bind(docId).all();

            if (!chunks.results || chunks.results.length === 0) {
              return new Response(JSON.stringify({ error: 'Berkas tidak ditemukan di Cloud D1' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            // Gabungkan potongan base64 dan dekode ke binary
            const totalBase64 = chunks.results.map(c => c.chunk_data).join('');
            const binaryString = atob(totalBase64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            const mimeType = (meta && meta.mime_type) || 'application/octet-stream';
            const fileName = (meta && meta.file_name) || `dokumen-${docId}`;

            return new Response(bytes.buffer, {
              headers: {
                ...corsHeaders,
                'Content-Type': mimeType,
                'Content-Length': String(bytes.length),
                'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
              }
            });
          } catch (e) {
            console.error('File download error:', e);
            return new Response(JSON.stringify({ error: e.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
      }
    }

    // Fallback: Layani file statis frontend (dist/) jika binding ASSETS tersedia
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};
