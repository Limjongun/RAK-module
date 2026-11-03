// IndexedDB Storage Layer using 'idb'
import { openDB } from 'idb';

const DB_NAME = 'rak-modul-db';
const DB_VERSION = 4;

export async function initLocalDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Store documents metadata & cached pdf blobs
      if (!db.objectStoreNames.contains('documents')) {
        const docStore = db.createObjectStore('documents', { keyPath: 'id' });
        docStore.createIndex('course_id', 'course_id', { unique: false });
        docStore.createIndex('updated_at', 'updated_at', { unique: false });
      }

      // Store courses
      if (!db.objectStoreNames.contains('courses')) {
        db.createObjectStore('courses', { keyPath: 'id' });
      }

      // Store pages text
      if (!db.objectStoreNames.contains('pages')) {
        const pageStore = db.createObjectStore('pages', { keyPath: ['document_id', 'page_no'] });
        pageStore.createIndex('document_id', 'document_id', { unique: false });
      }

      // Store annotations
      if (!db.objectStoreNames.contains('annotations')) {
        const annotStore = db.createObjectStore('annotations', { keyPath: 'id' });
        annotStore.createIndex('document_id', 'document_id', { unique: false });
        annotStore.createIndex('document_page', ['document_id', 'page_no'], { unique: false });
      }

      // Store reading progress
      if (!db.objectStoreNames.contains('reading_progress')) {
        db.createObjectStore('reading_progress', { keyPath: 'document_id' });
      }

      // Outbox for offline sync
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      }

      // Store flashcards
      if (!db.objectStoreNames.contains('flashcards')) {
        const cardStore = db.createObjectStore('flashcards', { keyPath: 'id' });
        cardStore.createIndex('due_at', 'due_at', { unique: false });
        cardStore.createIndex('document_id', 'document_id', { unique: false });
      }

      // Store study sessions (Pomodoro)
      if (!db.objectStoreNames.contains('study_sessions')) {
        const sessionStore = db.createObjectStore('study_sessions', { keyPath: 'id', autoIncrement: true });
        sessionStore.createIndex('document_id', 'document_id', { unique: false });
        sessionStore.createIndex('started_at', 'started_at', { unique: false });
      }

      // Store code notebooks (Kode Bank)
      if (!db.objectStoreNames.contains('code_notebooks')) {
        const nbStore = db.createObjectStore('code_notebooks', { keyPath: 'id' });
        nbStore.createIndex('updated_at', 'updated_at', { unique: false });
        nbStore.createIndex('course_name', 'course_name', { unique: false });
      }

      // Store to-do tasks (Agenda & Target Belajar)
      if (!db.objectStoreNames.contains('todos')) {
        const todoStore = db.createObjectStore('todos', { keyPath: 'id' });
        todoStore.createIndex('due_datetime', 'due_datetime', { unique: false });
        todoStore.createIndex('completed', 'completed', { unique: false });
        todoStore.createIndex('course_name', 'course_name', { unique: false });
        todoStore.createIndex('priority', 'priority', { unique: false });
      }
    },
    blocked() {
      console.warn('Database upgrade is blocked by another open tab.');
    },
    blocking(currentVersion, blockedVersion, event) {
      if (event && event.target && typeof event.target.close === 'function') {
        event.target.close();
      }
    }
  });
}

export async function saveLocalDocument(doc, pdfBlob = null) {
  const db = await initLocalDB();
  const item = { ...doc, updated_at: doc.updated_at || new Date().toISOString() };
  if (pdfBlob) {
    item._cachedBlob = pdfBlob;
  }
  await db.put('documents', item);
  return item;
}

export async function getLocalDocument(id) {
  const db = await initLocalDB();
  return db.get('documents', id);
}

export async function getAllLocalDocuments() {
  const db = await initLocalDB();
  return db.getAll('documents');
}

export async function saveLocalPages(pages) {
  const db = await initLocalDB();
  const tx = db.transaction('pages', 'readwrite');
  for (const page of pages) {
    await tx.store.put(page);
  }
  await tx.done;
}

export async function getLocalPages(documentId) {
  const db = await initLocalDB();
  const index = db.transaction('pages').store.index('document_id');
  return index.getAll(documentId);
}

export async function saveLocalAnnotation(annotation) {
  const db = await initLocalDB();
  annotation.updated_at = annotation.updated_at || new Date().toISOString();
  await db.put('annotations', annotation);
  // Add to sync queue if offline sync is needed
  await db.add('sync_queue', {
    table: 'annotations',
    action: 'upsert',
    data: annotation,
    created_at: new Date().toISOString()
  });
  return annotation;
}

export async function getLocalAnnotations(documentId) {
  const db = await initLocalDB();
  const index = db.transaction('annotations').store.index('document_id');
  const all = await index.getAll(documentId);
  return all.filter(a => !a.deleted);
}

export async function deleteLocalAnnotation(id) {
  const db = await initLocalDB();
  const existing = await db.get('annotations', id);
  if (existing) {
    existing.deleted = true;
    existing.updated_at = new Date().toISOString();
    await db.put('annotations', existing);
    await db.add('sync_queue', {
      table: 'annotations',
      action: 'delete',
      id,
      created_at: new Date().toISOString()
    });
  }
}

export async function saveLocalProgress(progress) {
  const db = await initLocalDB();
  progress.updated_at = new Date().toISOString();
  await db.put('reading_progress', progress);
  await db.add('sync_queue', {
    table: 'reading_progress',
    action: 'upsert',
    data: progress,
    created_at: new Date().toISOString()
  });
}

export async function getLocalProgress(documentId) {
  const db = await initLocalDB();
  return db.get('reading_progress', documentId);
}

// Flashcards Storage
export async function saveLocalFlashcard(card) {
  const db = await initLocalDB();
  const now = new Date().toISOString();
  const item = {
    id: card.id || crypto.randomUUID(),
    annotation_id: card.annotation_id || null,
    document_id: card.document_id || null,
    course_name: card.course_name || 'Umum',
    front: card.front || '',
    back: card.back || '',
    due_at: card.due_at || now,
    interval_days: card.interval_days || 0,
    ease: card.ease || 2.5,
    reps: card.reps || 0,
    created_at: card.created_at || now,
    updated_at: now
  };
  await db.put('flashcards', item);
  return item;
}

export async function getAllLocalFlashcards() {
  const db = await initLocalDB();
  return db.getAll('flashcards');
}

export async function getDueLocalFlashcards() {
  const all = await getAllLocalFlashcards();
  const now = new Date();
  return all.filter(c => new Date(c.due_at) <= now);
}

export async function deleteLocalFlashcard(id) {
  const db = await initLocalDB();
  return db.delete('flashcards', id);
}

// Study Sessions (Pomodoro & Reading Time Tracking)
export async function recordStudySession(session) {
  const db = await initLocalDB();
  const item = {
    document_id: session.document_id || null,
    minutes: session.minutes || 25,
    pages_read: session.pages_read || 0,
    started_at: session.started_at || new Date().toISOString(),
    created_at: new Date().toISOString()
  };
  const id = await db.add('study_sessions', item);
  return { id, ...item };
}

export async function getAllStudySessions() {
  const db = await initLocalDB();
  return db.getAll('study_sessions');
}

export async function getStudyStats() {
  const sessions = await getAllStudySessions();
  const docs = await getAllLocalDocuments();
  const docMap = new Map(docs.map(d => [d.id, d]));

  let totalMinutes = 0;
  let totalPages = 0;
  const daysMap = new Map(); // 'YYYY-MM-DD' -> minutes
  const courseMap = new Map(); // courseName -> minutes

  sessions.forEach(s => {
    totalMinutes += (s.minutes || 0);
    totalPages += (s.pages_read || 0);

    const dateKey = (s.started_at || s.created_at || '').slice(0, 10);
    if (dateKey) {
      daysMap.set(dateKey, (daysMap.get(dateKey) || 0) + (s.minutes || 0));
    }

    const doc = docMap.get(s.document_id);
    const course = doc?.course_name || 'Umum';
    courseMap.set(course, (courseMap.get(course) || 0) + (s.minutes || 0));
  });

  // Calculate streak
  let streak = 0;
  const today = new Date();
  let checkDate = new Date(today);

  // If today had activity, streak includes today; otherwise check starting from yesterday
  const todayKey = today.toISOString().slice(0, 10);
  if (!daysMap.has(todayKey)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const key = checkDate.toISOString().slice(0, 10);
    if (daysMap.has(key) && daysMap.get(key) > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // 7-day history (Last 7 days ending today)
  const last7Days = [];
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    last7Days.push({
      dateKey: key,
      dayName: dayNames[d.getDay()],
      minutes: daysMap.get(key) || 0
    });
  }

  return {
    totalMinutes,
    totalSessions: sessions.length,
    totalPages,
    streak,
    last7Days,
    courseDistribution: Array.from(courseMap.entries()).map(([course, minutes]) => ({
      course,
      minutes,
      percent: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0
    })),
    recentSessions: sessions.slice(-10).reverse().map(s => ({
      ...s,
      docTitle: docMap.get(s.document_id)?.title || 'Membaca Modul'
    }))
  };
}

// -------------------------------------------------------------
// Kode Bank (Code Notebook Vault) Storage Layer
// -------------------------------------------------------------

export async function getAllCodeNotebooks() {
  const db = await initLocalDB();
  const list = await db.getAll('code_notebooks');
  return list.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
}

export async function getCodeNotebook(id) {
  const db = await initLocalDB();
  return db.get('code_notebooks', id);
}

export async function saveCodeNotebook(notebook) {
  const db = await initLocalDB();
  const now = new Date().toISOString();
  const item = {
    ...notebook,
    created_at: notebook.created_at || now,
    updated_at: now
  };
  await db.put('code_notebooks', item);
  return item;
}

export async function deleteCodeNotebook(id) {
  const db = await initLocalDB();
  return db.delete('code_notebooks', id);
}

export async function seedSampleCodeNotebooksIfEmpty() {
  const existing = await getAllCodeNotebooks();
  if (existing.length > 0) return existing;

  const samples = [
    {
      id: 'nb_python_dataprep',
      title: 'SOP Data Preprocessing & Pembersihan Data',
      course_name: 'Data Analytics',
      language: 'python',
      tags: ['pandas', 'preprocessing', 'imputation', 'outliers'],
      cells: [
        {
          id: 'cell_dp_1',
          type: 'markdown',
          content: '## 1. Panduan Data Preprocessing & Pembersihan Data\nNotebook ini merangkum langkah-langkah standar pembersihan data mentah (*raw data*) sebelum tahap eksplorasi dan permodelan machine learning.'
        },
        {
          id: 'cell_dp_2',
          type: 'code',
          language: 'python',
          content: 'import numpy as np\nimport pandas as pd\n\n# 1. Membaca dataset transaksi mentah\ndf = pd.read_csv("dataset_transaksi.csv")\nprint("Dimensi data awal:", df.shape)\nprint("\\nRingkasan Missing Values:")\nprint(df.isnull().sum())',
          output_note: 'Dimensi data awal: (15000, 8)\nRingkasan Missing Values:\nid_transaksi       0\nnama_pelanggan     0\ntotal_belanja    124\nkategori           0\nwaktu_transaksi   45\ndtype: int64'
        },
        {
          id: 'cell_dp_3',
          type: 'markdown',
          content: '### 2. Penanganan Nilai Hilang (Missing Values Imputation)\nUntuk fitur numerik bertipe continuous (`total_belanja`), gunakan median jika data menceng (*skewed*), atau mean jika normal. Kolom tanggal/kategori dapat diisi dengan *forward fill*.'
        },
        {
          id: 'cell_dp_4',
          type: 'code',
          language: 'python',
          content: '# Imputasi total_belanja dengan Median\nmedian_belanja = df["total_belanja"].median()\ndf["total_belanja"].fillna(median_belanja, inplace=True)\n\n# Imputasi waktu transaksi dengan forward-fill\ndf["waktu_transaksi"].fillna(method="ffill", inplace=True)\n\nprint("Sisa missing values:", df.isnull().sum().sum())',
          output_note: 'Sisa missing values: 0\nNilai median yang digunakan: Rp 185.000,00'
        },
        {
          id: 'cell_dp_5',
          type: 'markdown',
          content: '### 3. Deteksi & Penanganan Outlier dengan Metode IQR\n- Batas Bawah = $Q_1 - 1.5 \\times IQR$\n- Batas Atas = $Q_3 + 1.5 \\times IQR$'
        },
        {
          id: 'cell_dp_6',
          type: 'code',
          language: 'python',
          content: 'Q1 = df["total_belanja"].quantile(0.25)\nQ3 = df["total_belanja"].quantile(0.75)\nIQR = Q3 - Q1\n\nlower_bound = Q1 - 1.5 * IQR\nupper_bound = Q3 + 1.5 * IQR\n\ndf_cleaned = df[(df["total_belanja"] >= lower_bound) & (df["total_belanja"] <= upper_bound)]\nprint(f"Batas bawah: {lower_bound:.2f}, Batas atas: {upper_bound:.2f}")\nprint("Jumlah baris setelah filter outlier:", len(df_cleaned))',
          output_note: 'Batas bawah: 12500.00, Batas atas: 540000.00\nJumlah baris setelah filter outlier: 14210 baris (dihapus 790 outlier)'
        }
      ]
    },
    {
      id: 'nb_sql_analytics',
      title: 'Query Analitik Bisnis & Window Functions',
      course_name: 'Basis Data & SQL',
      language: 'sql',
      tags: ['sql', 'window-function', 'ranking', 'growth'],
      cells: [
        {
          id: 'cell_sql_1',
          type: 'markdown',
          content: '## Analisis Transaksi E-Commerce & Performa Bisnis\nKoleksi query SQL analitik untuk reporting omset bulanan, produk terlaris per kategori, dan metrik pertumbuhan bisnis.'
        },
        {
          id: 'cell_sql_2',
          type: 'code',
          language: 'sql',
          content: '-- 1. Menghitung Top 3 Produk Terlaris per Kategori dengan DENSE_RANK()\nWITH ranked_sales AS (\n    SELECT \n        p.kategori_produk,\n        p.nama_produk,\n        SUM(td.kuantitas) AS total_terjual,\n        SUM(td.total_harga) AS total_omset,\n        DENSE_RANK() OVER (\n            PARTITION BY p.kategori_produk \n            ORDER BY SUM(td.total_harga) DESC\n        ) AS peringkat_omset\n    FROM transaksi_detail td\n    JOIN produk p ON td.produk_id = p.id\n    WHERE td.tanggal_transaksi >= CURRENT_DATE - INTERVAL \'30 days\'\n    GROUP BY p.kategori_produk, p.nama_produk\n)\nSELECT *\nFROM ranked_sales\nWHERE peringkat_omset <= 3\nORDER BY kategori_produk, peringkat_omset;',
          output_note: 'Menampilkan top 3 produk dengan pendapatan tertinggi pada tiap kategori dalam 30 hari terakhir.'
        },
        {
          id: 'cell_sql_3',
          type: 'markdown',
          content: '### 2. Analisis Pertumbuhan Pendapatan MoM (Month-over-Month)\nMenggunakan fungsi jendela `LAG()` untuk menghitung selisih dan persentase perubahan pendapatan dibanding bulan sebelumnya.'
        },
        {
          id: 'cell_sql_4',
          type: 'code',
          language: 'sql',
          content: 'WITH monthly_revenue AS (\n    SELECT \n        DATE_TRUNC(\'month\', tanggal) AS bulan,\n        SUM(total_omset) AS omset_aktual\n    FROM transaksi\n    GROUP BY DATE_TRUNC(\'month\', tanggal)\n)\nSELECT \n    TO_CHAR(bulan, \'YYYY-MM\') AS periode,\n    omset_aktual,\n    LAG(omset_aktual, 1) OVER (ORDER BY bulan) AS omset_bulan_lalu,\n    ROUND(\n        ((omset_aktual - LAG(omset_aktual, 1) OVER (ORDER BY bulan))::NUMERIC / \n        LAG(omset_aktual, 1) OVER (ORDER BY bulan)) * 100, \n        2\n    ) AS pertumbuhan_persen\nFROM monthly_revenue\nORDER BY periode;',
          output_note: 'periode  | omset_aktual | omset_bulan_lalu | pertumbuhan_persen\n2026-08  | 420.000.000  | 390.000.000      | +7.69%\n2026-09  | 465.000.000  | 420.000.000      | +10.71%\n2026-10  | 512.000.000  | 465.000.000      | +10.11%'
        }
      ]
    }
  ];

  for (const s of samples) {
    await saveCodeNotebook(s);
  }
  return getAllCodeNotebooks();
}

// -------------------------------------------------------------
// Agenda & To-Do List Storage Layer
// -------------------------------------------------------------

export async function getAllTodos() {
  try {
    const db = await initLocalDB();
    if (!db.objectStoreNames.contains('todos')) {
      return [];
    }
    const list = await db.getAll('todos');
    return list.sort((a, b) => {
      // Tugas yang belum selesai di atas
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      // Jika belum ada due_datetime, taruh di paling bawah
      if (!a.due_datetime) return 1;
      if (!b.due_datetime) return -1;
      // Urutkan berdasarkan waktu tenggat terdekat
      return new Date(a.due_datetime) - new Date(b.due_datetime);
    });
  } catch (err) {
    console.warn('getAllTodos error:', err);
    return [];
  }
}

export async function getTodo(id) {
  try {
    const db = await initLocalDB();
    if (!db.objectStoreNames.contains('todos')) return null;
    return db.get('todos', id);
  } catch (err) {
    console.warn('getTodo error:', err);
    return null;
  }
}

export async function saveTodo(todo) {
  try {
    const db = await initLocalDB();
    if (!db.objectStoreNames.contains('todos')) {
      return todo;
    }
    const now = new Date().toISOString();
    const item = {
      ...todo,
      created_at: todo.created_at || now,
      updated_at: now
    };
    await db.put('todos', item);
    return item;
  } catch (err) {
    console.warn('saveTodo error:', err);
    return todo;
  }
}

export async function deleteTodo(id) {
  try {
    const db = await initLocalDB();
    if (db.objectStoreNames.contains('todos')) {
      await db.delete('todos', id);
    }
  } catch (err) {
    console.warn('deleteTodo error:', err);
  }
}

export async function toggleTodoComplete(id) {
  try {
    const db = await initLocalDB();
    if (!db.objectStoreNames.contains('todos')) return null;
    const item = await db.get('todos', id);
    if (!item) return null;
    item.completed = !item.completed;
    item.completed_at = item.completed ? new Date().toISOString() : null;
    item.updated_at = new Date().toISOString();
    await db.put('todos', item);
    return item;
  } catch (err) {
    console.warn('toggleTodoComplete error:', err);
    return null;
  }
}

export async function seedSampleTodosIfEmpty() {
  try {
    const existing = await getAllTodos();
    if (existing.length > 0) return existing;

    const now = new Date();
    
    function toDatetimeLocal(d, hour, min) {
      const copy = new Date(d);
      copy.setHours(hour, min, 0, 0);
      const year = copy.getFullYear();
      const month = String(copy.getMonth() + 1).padStart(2, '0');
      const day = String(copy.getDate()).padStart(2, '0');
      const h = String(copy.getHours()).padStart(2, '0');
      const m = String(copy.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${h}:${m}`;
    }

    const todayDue = toDatetimeLocal(now, 17, 0);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDue = toDatetimeLocal(tomorrow, 13, 0);

    const upcoming = new Date(now);
    upcoming.setDate(upcoming.getDate() + 3);
    const upcomingDue = toDatetimeLocal(upcoming, 20, 0);

    const samples = [
      {
        id: 'todo_seed_1',
        title: 'Review SOP Data Preprocessing & Outlier IQR',
        description: 'Baca modul SOP Data Preprocessing, pelajari rumus IQR, dan coba kode di Kode Bank.',
        due_datetime: todayDue,
        priority: 'high',
        course_name: 'Data Analytics',
        duration_minutes: 45,
        completed: false,
        completed_at: null
      },
      {
        id: 'todo_seed_2',
        title: 'Latihan Query SQL Window Function DENSE_RANK',
        description: 'Selesaikan studi kasus retail mart dengan fungsi jendela LAG & RANK.',
        due_datetime: tomorrowDue,
        priority: 'medium',
        course_name: 'Basis Data & SQL',
        duration_minutes: 60,
        completed: false,
        completed_at: null
      },
      {
        id: 'todo_seed_3',
        title: 'Meringkas Materi Kuliah Machine Learning',
        description: 'Buat rangkuman materi Supervised Learning ke format Markdown untuk catatan ujian.',
        due_datetime: upcomingDue,
        priority: 'low',
        course_name: 'Machine Learning',
        duration_minutes: 30,
        completed: false,
        completed_at: null
      }
    ];

    for (const s of samples) {
      await saveTodo(s);
    }
    return getAllTodos();
  } catch (err) {
    console.warn('seedSampleTodosIfEmpty error:', err);
    return [];
  }
}

