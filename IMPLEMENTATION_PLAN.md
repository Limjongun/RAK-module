# Rencana Implementasi: Rak Modul (Personal Study Reader)

**Tanggal**: 3 November 2026  
**Dokumen Referensi**:
- [blueprint-rak-modul (1).md](../blueprint-rak-modul%20(1).md)
- [rak-modul-ui-guide.md](../rak-modul-ui-guide.md)

---

## 1. Ringkasan Proyek & Arsitektur

**Rak Modul** adalah aplikasi web pribadi (PWA) serverless *offline-first* untuk membaca, mendengarkan (TTS), mencoret/menyorot, dan mencatat puluhan modul kuliah lintas format (PDF, DOCX, PPTX, Markdown) dalam satu kanonik format tampilan (PDF + teks terindeks).

### Prinsip Utama
- **Zero Cost / Serverless Tier**: Cloudflare Pages (Frontend), Cloudflare Worker (API tipis & presigned URL), Cloudflare R2 (Object storage), Supabase (Postgres, RLS, Auth, pgvector), GitHub Actions (Headless LibreOffice).
- **Format Kanonik**: Semua modul dikonversi ke PDF tampilan + ekstraksi teks per halaman ke tabel `pages`.
- **Anotasi Data Terpisah**: File PDF asli tidak pernah dimodifikasi saat mencoret. Koordinat anotasi disimpan ternormalisasi (0..1) relatif terhadap dimensi halaman PDF.
- **Offline-First**: IndexedDB (`idb`) dan Service Worker Cache Storage memungkinkan membaca dan mencoret tanpa koneksi internet.
- **Filosofi UI Meja Belajar**: Tiga alat tulis utama (pulpen biru `pen`, pulpen merah `correction`, 5 stabilo `mark-*`), Atkinson Hyperlegible Next untuk antarmuka, Literata untuk teks bacaan.

---

## 2. Struktur Proyek

```text
rak-modul/
├── index.html                       # Entry point HTML dengan font preload & meta PWA
├── package.json
├── vite.config.js                   # Konfigurasi Vite
├── wrangler.toml                    # Konfigurasi Cloudflare Worker & R2 binding
├── public/
│   ├── favicon.svg
│   ├── manifest.webmanifest         # Manifest PWA (standar standalone)
│   └── icons/
├── src/
│   ├── main.js                      # Router klien & inisialisasi aplikasi
│   ├── styles/
│   │   ├── tokens.css               # Token warna (light/dark), tipografi, spacing, radius
│   │   ├── components.css           # Styling komponen rm-* sesuai UI Guide
│   │   └── reader.css               # Styling layout viewport pdf.js & SVG layer
│   ├── router.js                    # Minimal hash/history SPA router
│   ├── data/
│   │   ├── supabase.js              # Klien Supabase & helper sesi auth
│   │   ├── local-db.js              # IndexedDB wrapper (idb) untuk dokumen & anotasi
│   │   └── sync.js                  # Background queue sync ke Supabase saat online
│   ├── reader/
│   │   ├── pdf-view.js              # Engine rendering pdfjs-dist + virtualisasi DOM
│   │   ├── text-layer.js            # Text selection extraction & pemetaan kalimat
│   │   ├── annot-layer.js           # SVG overlay (highlight, underline, strike, sticky)
│   │   ├── tts.js                   # Web Speech API controller + auto-scroll karaoke
│   │   └── toolbar.js               # Floating toolbar kontrol anotasi & swatches
│   ├── pages/
│   │   ├── library.js               # Route '/' (Rak modul, lanjut baca, filter course)
│   │   ├── reader.js                # Route '/read/:docId' (Layar baca utama)
│   │   ├── notes.js                 # Route '/notes' (Buku catatan global & filter tag)
│   │   ├── search.js                # Route '/search' (FTS Postgres lintas modul)
│   │   ├── upload.js                # Route '/upload' (Drag-drop uploader + status)
│   │   ├── review.js                # Route '/review' (Flashcards SM-2)
│   │   └── stats.js                 # Route '/stats' (Statistik baca & Pomodoro)
│   └── ui/
│       ├── icons.js                 # Helper SVG Lucide icons (stroke 1.75 round)
│       ├── toast.js                 # Notifikasi feedback aksi
│       └── modal.js                 # Dialog & prompt konfirmasi
├── worker/
│   ├── index.js                     # Handler Cloudflare Worker (S3 presigned URLs, auth check)
│   └── cron.js                      # Keep-alive ping Supabase setiap 3 hari
├── supabase/
│   └── migrations/
│       └── 20261103000000_init_schema.sql  # DDL lengkap sesuai blueprint
├── .github/
│   └── workflows/
│       └── convert.yml              # LibreOffice headless DOCX/PPTX to PDF
└── scripts/
    └── bulk-import.mjs              # Node.js CLI script untuk konversi & upload lokal masal
```

---

## 3. Tahapan Eksekusi

### Fase 1: Inti MVP (Pembaca PDF, Anotasi Dasar, Web Speech TTS, Rak Modul)
- Setup scaffolding, konfigurasi Vite, dan dependencies.
- Token CSS (`tokens.css`) & Komponen UI (`components.css`).
- Skema database Supabase & RLS (`20261103000000_init_schema.sql`).
- Worker API & integrasi Storage.
- Uploader PDF & ekstraksi teks halaman.
- Rak Modul (`/`), Core PDF Reader (`/read/:docId`), Anotasi SVG, dan TTS Karaoke (`.rm-speaking`).

### Fase 2: Multi-format, Offline PWA & Fitur Belajar
- Konversi DOCX/PPTX dengan LibreOffice di GitHub Actions & script bulk import.
- Coretan pena bebas stylus (`perfect-freehand`), penghapus, bentuk geometris.
- PWA offline caching & IndexedDB sync dua arah.
- Full-text search lintas dokumen (`/search`), buku catatan global (`/notes`), flashcards SM-2 (`/review`), dan Pomodoro (`/stats`).

### Fase 3: Fitur AI (RAG, Ringkas, Kuis, Eksplanasi)
- Supabase `pgvector` & Worker AI proxy.
- Tanya Modul (RAG) dengan kutipan nomor halaman.
- Ringkas bab & auto-quiz.

### Fase 4: Poles, Mode Podcast & Ekspor
- Mode podcast (Cloud TTS MP3 di R2) dengan Media Session API saat layar HP mati.
- Mode reflow artikel HTML dengan font Literata untuk mobile.
- Ekspor PDF beranotasi via `pdf-lib` dan Markdown / Obsidian.

