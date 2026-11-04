# MCP Context: Rak Modul (Personal University Study & Lecture Reader)

> **Dokumen Konteks Komprehensif untuk Model Context Protocol (MCP) Server & Autonomous Coding/Research Agent**  
> *Versi Arsitektur:* 2.0 (Full Cloudflare D1 Edge-First + PWA Offline-First)  
> *Terakhir Diperbarui:* November 2026  
> *URL Produksi Live:* `https://rak-module.ekoalem55.workers.dev`  
> *Repositori GitHub:* `https://github.com/Limjongun/RAK-module.git`

---

## 1. Ikhtisar Sistem & Filosofi Desain

### 1.1 Apa itu Rak Modul?
**Rak Modul** adalah aplikasi web personal (*single-user*, *offline-first*) yang dirancang khusus sebagai brankas belajar mahasiswa: membaca, mendengarkan (TTS), mencoret dengan stylus, menyorot dengan 5 stabilo fungsional, mencatat, mengelola agenda to-do list, menyusun bank kode Python/Colab, dan menghafal materi dengan flashcard Spaced Repetition (SM-2).

### 1.2 Prinsip Desain Fundamental
1. **Satu Pengguna Utama (*Single-User Vault*)**: Tidak memerlukan registrasi rumit atau sistem multi-tenant berbayar; berfokus pada performa kilat, privasi tinggi, dan zero-maintenance.
2. **Format Kanonik & Anotasi Non-Destruktif**: File dokumen asli (PDF, DOCX) tidak pernah dimodifikasi saat dicoret. Seluruh coretan stylus, sorotan, garis bawah, dan catatan disimpan sebagai koordinat normalisasi `(0..1)` relatif terhadap halaman.
3. **Arsitektur Cloud-First + Offline-First**:
   - Single Source of Truth (SSOT): **Cloudflare D1 SQL Serverless Database (Gratis 5 GB)**.
   - Cache Klien: **IndexedDB (`idb`)** + **Service Worker (PWA Cache)**.
   - Otomatis sinkron dua arah saat online dan tetap dapat membaca/mencatat 100% saat offline.
4. **Desain Berbasis Alat Tulis Meja Belajar (*Paper-Digital Aesthetic*)**:
   - Pulpen Biru (`--pen: #1a56db`): Aksi primer, fokus, navigasi.
   - Pulpen Merah (`--correction: #b3261e`): Garis coret dan aksi hapus.
   - 5 Warna Stabilo Berarti:
     - 🟡 **Kuning** (`#fff59d`): Poin Penting.
     - 🟢 **Hijau** (`#c8e6c9`): Definisi & Istilah.
     - 🔵 **Biru** (`#bbdefb`): Contoh Kasus & Analogi.
     - 🔴 **Merah Muda** (`#ffcdd2`): Belum Paham / Perlu Ditanyakan ke Dosen.
     - 🟣 **Ungu** (`#e1bee7`): Prediksi Ujian (UTS/UAS).
   - Tipografi: *Atkinson Hyperlegible Next* (UI ramah disleksia) dan *Literata* (teks bacaan).

---

## 2. Diagram Arsitektur & Aliran Data

```text
               +-------------------------------------------------------+
               |                  Browser Klien (PWA)                  |
               |  SPA Hash Router (#/) + pdf.js + docx-preview + KaTeX  |
               +-------------------------------------------------------+
                                  |                 ^
             (Baca / Tulis Cepat) |                 | (Tarik Cache)
                                  v                 |
                       +-------------------------------+
                       |   Penyimpanan Lokal Browser   |
                       | - IndexedDB: 'rak-modul-db'   |
                       | - CacheStorage: PWA Service   |
                       | - localStorage: Kredensial    |
                       +-------------------------------+
                                  |                 ^
                (Antrean Outbox)  |                 | (Tarik Delta)
                                  v                 |
+-----------------------------------------------------------------------------------+
|                        Cloudflare Global Edge Network                             |
|                                                                                   |
|  [ Cloudflare Worker API: 'rak-module' ]                                         |
|  - Static Assets Hosting: ./dist (Single Page Application SPA routing)           |
|  - API Router: /api/db/*, /api/health, /api/file/*                                |
|  - Cron Trigger: '0 0 */3 * *' (Pencegah auto-pause database)                    |
|                                                                                   |
|  [ Cloudflare D1 SQL Serverless: 'rakmodule' ]                                    |
|  - documents, pages, annotations, reading_progress, todos,                        |
|    code_notebooks, flashcards, study_sessions, document_files, document_file_meta |
+-----------------------------------------------------------------------------------+
                                  |
              (Sinkronisasi Opsional / Dual-Engine Cadangan)
                                  v
                       +-------------------------------+
                       |    Supabase Cloud Database    |
                       |  PostgreSQL + Row-Level Sec   |
                       +-------------------------------+
```

---

## 3. Skema Database Lengkap (Cloudflare D1 & IndexedDB)

Setiap tabel di Cloudflare D1 SQLite memiliki padanan Object Store yang identik di IndexedDB (`rak-modul-db`, version 4).

### 3.1 Tabel `documents` (Metadata Modul & Catatan)
Menyimpan informasi identitas buku, slide kuliah, jurnal, atau dokumen tulisan.
```sql
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,                       -- UUID v4
  user_id TEXT DEFAULT 'default_user',       -- Identitas pengguna
  title TEXT NOT NULL,                       -- Judul dokumen
  source_type TEXT,                          -- 'pdf' | 'docx' | 'doc' | 'note' | 'pptx'
  course_id TEXT,                            -- ID mata kuliah
  course_name TEXT DEFAULT 'Umum',           -- Nama mata kuliah (e.g., 'Basis Data')
  original_key TEXT,                         -- Key berkas asli
  pdf_key TEXT,                              -- Key file PDF hasil render
  thumb_key TEXT,                            -- Key thumbnail R2 (opsional)
  thumb_data TEXT,                           -- Data URL Base64 gambar cover (~320x440 JPEG, ~25KB)
  page_count INTEGER DEFAULT 1,              -- Total halaman dokumen
  language TEXT DEFAULT 'id',                -- Kode bahasa ('id' atau 'en')
  tags TEXT DEFAULT '[]',                    -- JSON string array tags
  status TEXT DEFAULT 'ready',               -- 'processing' | 'ready' | 'error'
  created_at TEXT,                           -- ISO 8601 Timestamp
  updated_at TEXT                            -- ISO 8601 Timestamp
);
```

### 3.2 Tabel `pages` (Indeks Teks Lengkap per Halaman)
Menyediakan teks mentah per halaman untuk fitur Full-Text Search (FTS) dan Text-to-Speech (TTS).
```sql
CREATE TABLE IF NOT EXISTS pages (
  document_id TEXT,                          -- Foreign key ke documents.id
  page_no INTEGER,                           -- Nomor halaman (1-based)
  text TEXT,                                 -- Teks diekstrak dari halaman
  PRIMARY KEY (document_id, page_no)
);
```

### 3.3 Tabel `annotations` (Stabilo, Coretan Stylus, & Catatan Tempel)
```sql
CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,                       -- UUID v4
  user_id TEXT DEFAULT 'default_user',
  document_id TEXT NOT NULL,                 -- Relasi ke documents.id
  page_no INTEGER NOT NULL,                  -- Nomor halaman
  kind TEXT NOT NULL,                        -- 'highlight' | 'underline' | 'strike' | 'pen' | 'note'
  color TEXT NOT NULL,                       -- 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | hex
  geometry TEXT,                             -- JSON string: { rects: [{x, y, w, h}], path: [...] }
  quote TEXT,                                -- Potongan teks yang disorot
  note_md TEXT,                              -- Isi catatan penjelasan markdown
  tags TEXT DEFAULT '[]',                    -- JSON string array tag (e.g. ["uts", "rumus"])
  updated_at TEXT,                           -- ISO 8601 Timestamp
  deleted INTEGER DEFAULT 0                  -- Soft-delete flag (0 = aktif, 1 = dihapus)
);
```

### 3.4 Tabel `reading_progress` (Posisi Membaca Terakhir)
```sql
CREATE TABLE IF NOT EXISTS reading_progress (
  document_id TEXT PRIMARY KEY,              -- Relasi 1-to-1 ke documents.id
  user_id TEXT DEFAULT 'default_user',
  last_page INTEGER DEFAULT 1,               -- Halaman terakhir dibuka
  scroll_ratio REAL DEFAULT 0,               -- Posisi scroll vertikal (0.0 .. 1.0)
  tts_sentence INTEGER DEFAULT 0,            -- Indeks kalimat terakhir pemutar audio
  percent REAL DEFAULT 0,                    -- Persentase selesai membaca (0 .. 100)
  updated_at TEXT
);
```

### 3.5 Tabel `todos` (Target & Agenda Belajar)
```sql
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,                       -- UUID v4
  user_id TEXT DEFAULT 'default_user',
  title TEXT NOT NULL,                       -- Judul tugas
  description TEXT DEFAULT '',               -- Deskripsi / rincian tugas
  due_datetime TEXT,                         -- Format ISO datetime string
  priority TEXT DEFAULT 'medium',            -- 'low' | 'medium' | 'high'
  course_name TEXT DEFAULT 'Umum',           -- Kategori mata kuliah
  duration_minutes INTEGER DEFAULT 30,       -- Estimasi alokasi waktu fokus (menit)
  document_id TEXT,                          -- Tautan langsung ke modul perkuliahan
  completed INTEGER DEFAULT 0,               -- 0 = aktif, 1 = selesai
  completed_at TEXT,                         -- Waktu diselesaikan
  created_at TEXT,
  updated_at TEXT
);
```

### 3.6 Tabel `code_notebooks` (Bank Kode Format Google Colab / Jupyter)
```sql
CREATE TABLE IF NOT EXISTS code_notebooks (
  id TEXT PRIMARY KEY,                       -- UUID v4
  user_id TEXT DEFAULT 'default_user',
  title TEXT NOT NULL,                       -- Judul notebook kode
  course_name TEXT DEFAULT 'Umum',           -- Mata kuliah (e.g., 'Pemrograman Web')
  language TEXT DEFAULT 'python',            -- 'python' | 'javascript' | 'sql'
  tags TEXT DEFAULT '[]',                    -- JSON array tags
  cells TEXT DEFAULT '[]',                   -- JSON array sel notebook: [{id, type, source, output}]
  created_at TEXT,
  updated_at TEXT
);
```

### 3.7 Tabel `flashcards` (Kartu Spaced Repetition Algoritma SM-2)
```sql
CREATE TABLE IF NOT EXISTS flashcards (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'default_user',
  annotation_id TEXT,                        -- Tautan opsional ke highlight
  document_id TEXT,                          -- Tautan opsional ke modul
  course_name TEXT DEFAULT 'Umum',
  front TEXT NOT NULL,                       -- Pertanyaan / sisi depan
  back TEXT NOT NULL,                        -- Jawaban / sisi belakang
  due_at TEXT,                               -- Waktu jatuh tempo review (ISO string)
  interval_days REAL DEFAULT 0,              -- Interval hari pengulangan
  ease REAL DEFAULT 2.5,                     -- Faktor kemudahan SM-2 (default 2.5, min 1.3)
  reps INTEGER DEFAULT 0,                    -- Jumlah repetisi berhasil beruntun
  created_at TEXT,
  updated_at TEXT
);
```

### 3.8 Tabel Penyimpanan Berkas Dokumen di D1 (`document_files` & `document_file_meta`)
Menyimpan file biner asli (PDF/DOCX) secara chunking tanpa memerlukan S3/R2 eksternal.
```sql
CREATE TABLE IF NOT EXISTS document_files (
  document_id TEXT,                          -- ID dokumen
  chunk_index INTEGER,                       -- Indeks potongan (0, 1, 2, ...)
  chunk_data TEXT,                           -- Data biner terenkode Base64 (ukuran raw 384 KB)
  PRIMARY KEY (document_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS document_file_meta (
  document_id TEXT PRIMARY KEY,
  file_name TEXT,
  mime_type TEXT,
  file_size INTEGER,
  total_chunks INTEGER,
  updated_at TEXT
);
```

---

## 4. Spesifikasi Kontrak Cloudflare Worker REST API

Semua request beroperasi di bawah host dasar:
`https://rak-module.ekoalem55.workers.dev`

### 4.1 `GET /api/health`
Memeriksa integritas worker dan konektivitas database D1.
- **Method:** `GET`
- **Response `200 OK`:**
  ```json
  {
    "status": "ok",
    "time": "2026-11-04T01:48:13.829Z",
    "d1_configured": true
  }
  ```

### 4.2 `GET /api/db/status`
Mendapatkan statistik ringkasan data di cloud.
- **Method:** `GET`
- **Response `200 OK`:**
  ```json
  {
    "ok": true,
    "database": "rakmodule",
    "counts": {
      "documents": 3,
      "todos": 5,
      "notebooks": 2,
      "annotations": 18
    }
  }
  ```

### 4.3 `POST /api/db/sync`
Endpoint sinkronisasi dua arah. Digunakan klien untuk mengirimkan delta data lokal ke Cloud D1.
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Payload Schema:**
  ```json
  {
    "documents": [ { "id": "uuid", "title": "...", ... } ],
    "todos": [ { "id": "uuid", "title": "...", "completed": 0, ... } ],
    "code_notebooks": [ { "id": "uuid", "title": "...", "cells": [...], ... } ],
    "annotations": [ { "id": "uuid", "kind": "highlight", ... } ],
    "reading_progress": [ { "document_id": "uuid", "last_page": 4, "percent": 50 } ],
    "flashcards": [ { "id": "uuid", "front": "...", "back": "...", ... } ],
    "study_sessions": [ { "document_id": "uuid", "minutes": 25, ... } ],
    "pages": [ { "document_id": "uuid", "page_no": 1, "text": "..." } ],
    "deletions": [
      { "table": "documents", "id": "doc-uuid" },
      { "table": "todos", "id": "todo-uuid" }
    ]
  }
  ```
- **Cascade Behavior saat Deletions:**
  Jika `{ table: "documents", id: "<id>" }` dikirim, worker otomatis mengeksekusi cascading delete di tabel `document_files`, `document_file_meta`, `pages`, `reading_progress`, dan `annotations`.

### 4.4 `GET /api/db/pull`
Menarik seluruh snapshot data terbaru dari Cloud D1 untuk hidrasi cache IndexedDB lokal.
- **Method:** `GET`
- **Response `200 OK`:**
  Objek JSON berisi array untuk masing-masing entitas (`documents`, `todos`, `code_notebooks`, `annotations`, `reading_progress`, `flashcards`, `study_sessions`).

### 4.5 `POST /api/db/file/chunk` & `GET /api/db/file/:id`
- **Upload:** Mengirim potongan biner base64 (`chunk_data`, `chunk_index`, `total_chunks`, `mime_type`).
- **Download:** Menggabungkan kembali seluruh potongan dan mengirimkan stream biner dokumen asli dengan `Content-Type` yang sesuai (`application/pdf` atau `application/vnd.openxmlformats-officedocument.wordprocessingml.document`).
- **Status:** `GET /api/db/file/:id/status` mengembalikan `{ exists: true, uploaded_chunks: 5, total_chunks: 5 }`.

---

## 5. Fitur-Fitur Aplikasi & Rute URL Klien

Aplikasi menggunakan Hash Routing (`#/`) sehingga kompatibel 100% dengan hosting statis CDN tanpa kendala 404.

| Rute URL | Nama Halaman | Modul Sumber | Deskripsi Fungsionalitas |
|---|---|---|---|
| `#/` | **Rak Modul (Shelf)** | `src/pages/library.js` | Tampilan utama seluruh modul per mata kuliah, kartu hero "Lanjut Membaca", tombol ganti cover modul (dengan auto kompresi Canvas ~320x440), menu hapus modul, pencarian cepat, modal status cloud sync, dan pintasan pasang PWA. |
| `#/read/:id` | **Unified Reader** | `src/pages/reader.js` | Engine pembaca multi-format: PDF (`pdfjs-dist`), Word DOCX (`docx-preview`), dan Dokumen Tulis (`doc`/`note`). Dilengkapi audio TTS karaoke, timer Pomodoro (25/5 menit), coretan stylus bebas (`perfect-freehand`), 5 warna stabilo, dan sidebar catatan. |
| `#/write` | **Tulis Dokumen Baru** | `src/pages/writer.js` | Editor WYSIWYG untuk membuat catatan & materi cepat. Toolbar: Headings (H1-H3), Bold/Italic/Underline/Strike/Inline Code, Warna & Stabilo, Perataan Paragraf, Tabel, Gambar, Link, Blok Kode, KaTeX Rumus Matematika, Checklist Tugas. Ekspor Markdown (`.md`) dan Cetak PDF. Autosave real-time ke Cloud D1. |
| `#/write/:id` | **Edit Dokumen** | `src/pages/writer.js` | Membuka dokumen tulisan yang sudah ada untuk disunting kembali. |
| `#/upload` | **Unggah Modul** | `src/pages/upload.js` | Drag-and-drop uploader untuk berkas PDF, DOCX, TXT, dan Markdown. Otomatis mengekstrak teks tiap halaman, merender cover thumbnail pertama, dan memotong berkas ke cloud D1. |
| `#/notes` | **Buku Catatan** | `src/pages/notes.js` | Mengagregasi seluruh sorotan dan catatan dari semua modul kuliah. Filter per warna stabilo, filter tag (#uts, #tanya-dosen), pencarian catatan, dan ekspor ke format Obsidian Markdown. |
| `#/code` | **Kode Bank (Colab)** | `src/pages/code.js` | Editor kode Python/JavaScript interaktif dengan sel Markdown & Code format Jupyter `.ipynb` v4. Dilengkapi validator PEP 8 (indent guides), runner simulasi, dan tombol ekspor `.ipynb`. |
| `#/todos` | **Agenda & To-Do** | `src/pages/todos.js` | Manajemen target belajar dengan durasi menit, batas waktu, pengelompokan (Hari ini, Mendatang, Selesai, Terlambat), dan integrasi langsung ke modul bacaan. |
| `#/review` | **Flashcard Review** | `src/pages/review.js` | Sesi menghafal Spaced Repetition dengan algoritma SuperMemo SM-2. Menampilkan jumlah kartu jatuh tempo hari ini, kartu bolak-balik, dan penilaian memori (Ulangi, Sulit, Bagus, Mudah). |
| `#/stats` | **Statistik Belajar** | `src/pages/stats.js` | Dasbor analitik: Total menit fokus membaca, heatmap aktivitas harian, rekor streak membaca, dan jumlah halaman terselesaikan per mata kuliah. |
| `#/convert` | **Konversi Dokumen** | `src/pages/convert.js` | Pemicu konversi dokumen Word/PowerPoint ke PDF kanonik menggunakan GitHub Actions LibreOffice Headless. |
| `#/search` | **Pencarian Global** | `src/pages/search.js` | Mesin telusur teks di seluruh halaman modul dengan cuplikan kata kunci berhighlight kuning dan navigasi langsung ke halaman target. |

---

## 6. Peta Struktur File Proyek

```text
d:\note vault\rak-modul/
├── package.json                         # Dependencies & script run/build/deploy
├── vite.config.js                       # Konfigurasi bundler Vite & manual code-splitting
├── wrangler.toml                        # Konfigurasi Cloudflare Worker, D1 Database & Static Assets
├── index.html                           # Entry HTML & Font Atkinson/Literata
├── public/
│   ├── favicon.svg                      # Ikon logo buku rak modul
│   ├── icon-192.png / icon-512.png      # Aset ikon PWA Android & iOS
│   ├── manifest.webmanifest             # Manifest Web App (PWA standalone)
│   ├── sw.js                            # Service Worker untuk cache aset offline
│   └── sample-module.pdf                # Modul dummy CS170 DAG untuk tes cepat
├── src/
│   ├── main.js                          # Titik masuk utama klien & registrasi rute
│   ├── router.js                        # Router Hash klien
│   ├── ui/
│   │   ├── icons.js                     # Koleksi ikon SVG standar garis 1.75px
│   │   └── toast.js                     # Komponen notifikasi pop-up toast
│   ├── styles/
│   │   ├── tokens.css                   # Variabel CSS warna alat tulis, radius, font
│   │   ├── components.css               # Komponen UI: kartu modul, modal, tombol, grid
│   │   ├── reader.css                   # Layout reader view, SVG annotation layer, audio player
│   │   └── writer.css                   # Stylesheet lengkap editor dokumen WYSIWYG
│   ├── data/
│   │   ├── local-db.js                  # Adapter IndexedDB (idb) & sync queue
│   │   ├── cloud-db.js                  # Adapter Cloudflare D1 Full Cloud Sync & chunking
│   │   ├── sync.js                      # Orkestrator sinkronisasi dua arah Cloud-Local
│   │   └── supabase.js                  # Adapter cadangan Supabase
│   ├── reader/
│   │   ├── pdf-view.js                  # pdfjs-dist renderer, thumbnail generator
│   │   ├── annot-layer.js               # Renderer SVG overlay anotasi non-destruktif
│   │   ├── text-layer.js                # Normalisasi koordinat teks (0..1)
│   │   ├── toolbar.js                   # Toolbar seleksi melayang saat memilih teks
│   │   └── tts.js                       # Engine pembaca suara (Web Speech API + karaoke)
│   └── pages/                           # Seluruh implementasi halaman web (lihat Tabel Rute)
├── worker/
│   └── index.js                         # Source code Cloudflare Worker API & D1 SQLite Handler
├── tests/
│   └── comprehensive-test.mjs           # Suite pengujian unit otomatis (66 tes lulus)
└── .github/workflows/
    └── convert.yml                      # Workflow GitHub Actions LibreOffice converter
```

---

## 7. Cetak Biru Alat MCP (MCP Tools Blueprint untuk AI Agent)

Jika sebuah MCP Server dipasang untuk berinteraksi dengan aplikasi Rak Modul ini, agen AI dapat menggunakan fungsi-fungsi berikut untuk membaca modul, mencari materi, membuat kartu belajar, dan menyinkronkan tugas:

### Tool 1: `list_modules`
- **Tujuan:** Mengambil seluruh daftar modul kuliah, jumlah halaman, dan progres membaca pengguna.
- **Backend Call:** `GET /api/db/pull` -> ambil array `documents` dan `reading_progress`.
- **Parameter:** `{ course_name?: string }`
- **Output:**
  ```json
  [
    {
      "id": "7724ea0f-b675-491c-ac28-d17a1df39390",
      "title": "Makalah Pendidikan Seksual AUD Kasus2",
      "course_name": "Umum",
      "page_count": 8,
      "last_page_read": 2,
      "percent_completed": 25
    }
  ]
  ```

### Tool 2: `get_module_page_text`
- **Tujuan:** Membaca isi teks asli dari halaman tertentu di modul untuk keperluan peringkasan, tanya-jawab (RAG), atau pembuatan soal kuis.
- **Backend Call:** Query D1 SQLite: `SELECT text FROM pages WHERE document_id = ? AND page_no = ?`.
- **Parameter:** `{ document_id: string, page_no: number }`
- **Output:** `{ document_id: "...", page_no: 1, text: "Identitas Artikel: Pendidikan Karakter..." }`

### Tool 3: `search_module_contents`
- **Tujuan:** Melakukan pencarian teks di seluruh modul dan mengembalikan cuplikan paragraf yang relevan.
- **Backend Call:** Query D1: `SELECT document_id, page_no, text FROM pages WHERE text LIKE ? LIMIT 10`.
- **Parameter:** `{ query: string }`
- **Output:** Array kecocokan kata kunci beserta nomor halaman.

### Tool 4: `create_study_flashcard`
- **Tujuan:** Membuat kartu Spaced Repetition baru dari modul atau catatan yang sedang dianalisis.
- **Backend Call:** `POST /api/db/sync` dengan entitas `flashcards`.
- **Parameter:**
  - `front` (string): Pertanyaan atau istilah.
  - `back` (string): Jawaban atau definisi.
  - `course_name` (string): Nama mata kuliah.
  - `document_id` (opsional): UUID dokumen sumber.
- **Output:** `{ success: true, card_id: "uuid" }`

### Tool 5: `create_study_todo`
- **Tujuan:** Menambahkan agenda target belajar baru ke To-Do List pengguna.
- **Backend Call:** `POST /api/db/sync` dengan entitas `todos`.
- **Parameter:**
  - `title` (string): Target tugas (contoh: "Baca Bab 3 Algoritma Greedy").
  - `due_datetime` (ISO string): Batas waktu.
  - `priority` ("low" | "medium" | "high").
  - `duration_minutes` (number): Perkiraan menit belajar.
  - `course_name` (string): Mata kuliah.
- **Output:** `{ success: true, todo_id: "uuid" }`

### Tool 6: `save_written_document`
- **Tujuan:** Membuat atau memperbarui dokumen tulisan/catatan rangkuman perkuliahan ke Rak Modul.
- **Backend Call:** `POST /api/db/sync` dengan entitas `documents` (`source_type: "doc"`) dan potongan teks halaman `pages`.
- **Parameter:**
  - `title` (string): Judul dokumen.
  - `course_name` (string): Mata kuliah.
  - `html_content` (string): Konten dokumen dalam HTML terformat rapi.
- **Output:** `{ success: true, document_id: "uuid" }`

---

## 8. Panduan Menjalankan & Memverifikasi Sistem

### Menjalankan Development Server Lokal
```powershell
cd "d:\note vault\rak-modul"
npm run dev
# Server terbuka di http://localhost:3000
```

### Menjalankan Suite Pengujian Otomatis
```powershell
cd "d:\note vault\rak-modul"
npm test
# Menjalankan tests/comprehensive-test.mjs (66 / 66 pengujian wajib lulus)
```

### Membangun Paket Produksi (Build)
```powershell
cd "d:\note vault\rak-modul"
npm run build
# Menghasilkan folder ./dist dengan code-splitting optimal (vendor-pdf, vendor-docs, index)
```

### Mendeploy Pembaruan ke Cloudflare Worker & D1
```powershell
cd "d:\note vault\rak-modul"
npm run deploy
# Menjalankan 'wrangler deploy' yang mengunggah static assets ./dist dan worker/index.js ke serverless edge
```

---

*Dokumen ini dirancang khusus sebagai panduan konteks mandiri (self-contained context) bagi AI Agent, LLM, atau MCP Server untuk memahami, mengoperasikan, dan mengembangkan sistem Rak Modul secara aman dan konsisten.*
