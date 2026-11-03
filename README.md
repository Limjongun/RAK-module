# Rak Modul — Pembaca Modul Kuliah Pribadi

Web aplikasi pribadi (*offline-first*) untuk membaca, mendengarkan, mencoret, dan mencatat puluhan modul kuliah (PDF, Word, PowerPoint, Markdown, hasil LaTeX) di satu tempat dengan antarmuka yang dirancang khusus untuk kenyamanan belajar jangka panjang.

Dibangun dengan arsitektur **serverless zero-maintenance** dan sistem desain berbasis alat tulis meja belajar:
- **Pulpen Biru (`pen`)**: Aksi utama, fokus, dan tautan.
- **Pulpen Merah (`correction`)**: Garis coret dan aksi hapus.
- **5 Stabilo (`mark-*`)**: Kuning (Penting), Hijau (Definisi), Biru (Contoh), Merah Muda (Belum paham), dan Ungu (Keluar di ujian).
- **Tipografi Ramah Baca**: *Atkinson Hyperlegible Next* untuk elemen antarmuka dan *Literata* untuk teks bacaan.

---

## Fitur Utama (Fase 1 MVP Selesai)

1. **Rak Modul (`#/`)**:
   - Grid modul per mata kuliah dengan sampul kertas berbayang (*paper sheet shadow*).
   - Indikator progres baca (%) dan jumlah catatan.
   - Kartu "Lanjut membaca" dengan akses cepat ke halaman terakhir.
   - Tombol 1-klik "Muat Contoh Modul (CS170)" untuk mencoba langsung.

2. **Pembaca Dokumen Terpadu (`#/read/:id`)**:
   - Engine rendering PDF berbasis `pdfjs-dist` dengan 3-layer: *Canvas*, *Text Layer*, dan *SVG Annotation Overlay*.
   - Navigasi halaman, zoom perbesaran/perkecil, indikator halaman aktif.
   - Perekaman progres baca otomatis ke memori lokal.

3. **Sistem Anotasi & Coretan Data Terpisah**:
   - **Sorot (Highlight)**: 5 warna stabilo fungsional.
   - **Garis Bawah (Underline)**: Penanda 2px biru.
   - **Coret (Strikethrough)**: Pulpen merah untuk bagian yang keliru.
   - **Catatan Seleksi / Tempel**: Terhubung ke kutipan modul, dapat diedit dan dihapus.
   - Koordinat anotasi dinormalisasi (0..1) relatif terhadap halaman sehingga posisi tetap presisi saat zoom atau berganti layar.
   - File PDF asli tetap utuh; data anotasi disimpan di IndexedDB & Supabase.

4. **Mesin Bacakan (Web Speech API + Karaoke)**:
   - Pemutar bacakan melayang (`rm-player`) dengan kontrol putar, jeda, kalimat sebelum/sesudah, dan pengaturan kecepatan baca (0,75× hingga 2×).
   - Efek sorot karaoke (`rm-speaking`) yang otomatis mengikuti kalimat yang sedang dibaca dan menggulirkan layar.
   - Pemilihan suara bahasa Indonesia alami (`id-ID`).

5. **Pencarian Lintas Modul (`#/search`) & Buku Catatan (`#/notes`)**:
   - Pencarian teks lengkap di seluruh modul dengan cuplikan berhighlight kata kunci.
   - Buku catatan terpusat untuk meninjau seluruh catatan dan sorotan lintas mata kuliah.

---

## Cara Menjalankan Aplikasi

### 1. Mode Pengembangan (Development Server)
Jalankan dev server dengan Vite:
```bash
cd "rak-modul"
npm run dev
```
Buka browser di URL yang muncul (biasanya `http://localhost:3000` atau `http://localhost:5173`).

### 2. Membangun untuk Produksi (Build)
```bash
npm run build
```
Hasil build siap dideploy statis di folder `dist/` (kompatibel langsung dengan Cloudflare Pages, GitHub Pages, atau Vercel).

---

## Struktur Direktori

```text
rak-modul/
├── index.html                       # Entry HTML
├── package.json                     # Dependencies
├── vite.config.js                   # Konfigurasi Vite
├── wrangler.toml                    # Konfigurasi Cloudflare Worker & R2
├── public/
│   ├── favicon.svg
│   └── sample-module.pdf            # Modul simulasi (CS170 DAG)
├── src/
│   ├── main.js                      # Router klien & inisialisasi tema
│   ├── router.js                    # Minimal SPA hash router
│   ├── styles/
│   │   ├── tokens.css               # Token warna, tipografi, radius, shadow
│   │   ├── components.css           # Kelas CSS rm-* sesuai UI Guide
│   │   └── reader.css               # Layout viewport reader & SVG layer
│   ├── data/
│   │   ├── local-db.js              # IndexedDB wrapper (idb)
│   │   ├── supabase.js              # Supabase client dengan offline fallback
│   │   └── sync.js                  # Engine sync queue dua arah
│   ├── reader/
│   │   ├── pdf-view.js              # pdf.js engine & thumbnail generator
│   │   ├── annot-layer.js           # SVG annotation layer
│   │   ├── text-layer.js            # Normalized coordinates & sentence splitter
│   │   ├── toolbar.js               # Floating annotation toolbar
│   │   └── tts.js                   # Web Speech API + karaoke player
│   └── pages/
│       ├── library.js               # Rak modul (/)
│       ├── reader.js                # Layar baca utama (/read/:id)
│       ├── upload.js                # Uploader drag & drop (/upload)
│       ├── notes.js                 # Buku catatan (/notes)
│       └── search.js                # Pencarian lintas modul (/search)
├── worker/
│   └── index.js                     # Cloudflare Worker API & cron keep-alive
├── supabase/
│   └── migrations/
│       └── 20261103000000_init_schema.sql  # DDL lengkap Supabase + RLS
└── scripts/
    ├── bulk-import.mjs              # Skrip konversi batch LibreOffice
    └── generate-sample-pdf.mjs      # Generator sample lecture PDF
```

---

## Menghubungkan ke Supabase & Cloudflare R2 (Opsional)

Aplikasi sudah memiliki sistem **Offline-First**: dapat dipakai langsung 100% menggunakan memori lokal peramban (IndexedDB) tanpa konfigurasi awal.

Jika ingin mengaktifkan sinkronisasi multi-perangkat via Cloudflare dan Supabase:
1. Buat proyek gratis di [Supabase](https://supabase.com).
2. Jalankan skrip SQL di `supabase/migrations/20261103000000_init_schema.sql` pada SQL Editor Supabase.
3. Buat file `.env` di dalam folder `rak-modul`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Deploy worker ke Cloudflare:
   ```bash
   npx wrangler deploy
   ```

