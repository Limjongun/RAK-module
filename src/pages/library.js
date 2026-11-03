// Rak Modul — Halaman Utama (Library / Shelf View)
import { getAllLocalDocuments, getLocalProgress, getLocalAnnotations, saveLocalDocument, saveLocalPages, getDueLocalFlashcards, getAllTodos } from '../data/local-db.js';
import { getSupabaseCredentials, saveSupabaseCredentials, isSupabaseConfigured } from '../data/supabase.js';
import { fullSync, testSupabaseConnection, getSyncState, checkD1Status } from '../data/sync.js';
import { uploadFileToCloud } from '../data/cloud-db.js';
import { PdfViewer } from '../reader/pdf-view.js';
import { showToast } from '../ui/toast.js';
import { icon } from '../ui/icons.js';

export function LibraryPage({ container, router }) {
  let isDarkMode = document.documentElement.dataset.theme === 'dark';
  let lastLoadedDocCount = -1;

  // Dengarkan event sinkronisasi cloud D1: jika modul baru ditarik dari cloud, segarkan rak otomatis
  const onSyncChanged = async (e) => {
    if (container.isConnected) {
      if (e.detail && !e.detail.isSyncing) {
        const freshDocs = await getAllLocalDocuments();
        if (freshDocs.length !== lastLoadedDocCount) {
          render();
        }
      }
    } else {
      window.removeEventListener('rak-sync-changed', onSyncChanged);
    }
  };
  window.addEventListener('rak-sync-changed', onSyncChanged);

  function toggleTheme() {
    isDarkMode = !isDarkMode;
    const theme = isDarkMode ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    render();
  }

  async function loadData() {
    const docs = await getAllLocalDocuments();
    // Urutkan berdasarkan waktu pembaruan
    docs.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

    // Auto-backfill file lokal ke Cloud D1 di latar belakang jika belum ada di cloud
    if (typeof window !== 'undefined' && navigator.onLine) {
      docs.forEach(doc => {
        if (doc._cachedBlob instanceof Blob) {
          fetch(`/api/db/file/${doc.id}/status`)
            .then(r => r.json())
            .then(st => {
              if (!st.exists || !st.uploaded_chunks) {
                uploadFileToCloud(doc.id, doc._cachedBlob, doc.title, doc.source_type);
              }
            })
            .catch(() => {});
        }
      });
    }

    // Ambil progress dan anotasi untuk tiap dokumen
    const enriched = await Promise.all(
      docs.map(async (doc) => {
        const progress = await getLocalProgress(doc.id);
        const annots = await getLocalAnnotations(doc.id);
        return {
          ...doc,
          progress: progress || { last_page: 1, percent: 0 },
          annotCount: annots.length
        };
      })
    );

    return enriched;
  }

  async function render() {
    const docs = await loadData();
    lastLoadedDocCount = docs.length;
    const dueCards = await getDueLocalFlashcards();
    const allTodos = await getAllTodos().catch(() => []);
    const pendingTodos = allTodos.filter(t => !t.completed);
    const recentDoc = docs.find(d => d.progress && d.progress.percent > 0) || docs[0];
    const isConfigured = isSupabaseConfigured();
    const credentials = getSupabaseCredentials();

    // Kelompokkan per mata kuliah
    const coursesMap = new Map();
    for (const doc of docs) {
      const courseName = doc.course_name || 'Umum';
      if (!coursesMap.has(courseName)) {
        coursesMap.set(courseName, []);
      }
      coursesMap.get(courseName).push(doc);
    }

    container.innerHTML = `
      <header class="rm-navbar">
        <a href="#/" class="rm-nav-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--pen)" stroke-width="2" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/></svg>
          <span>Rak Modul</span>
        </a>
        <div class="rm-nav-actions">
          <label class="rm-search" style="width: 240px; height: 36px;">
            ${icon('search')}
            <input type="search" id="rm-shelf-search" placeholder="Cari di semua modul" aria-label="Cari di semua modul">
            <span class="rm-kbd">/</span>
          </label>
          <button class="rm-btn rm-btn-ghost rm-btn-icon" id="rm-theme-toggle" aria-label="Ganti tema">
            ${isDarkMode ? icon('sun') : icon('moon')}
          </button>
          <button class="rm-btn rm-btn-ghost" id="rm-btn-cloud-sync" title="Pengaturan Sinkronisasi Supabase Cloud" style="display:inline-flex;align-items:center;gap:4px;">
            ${icon('cloud')}
            <span style="font-size:12px;">${isConfigured ? '🟢 Cloud' : 'Cloud'}</span>
          </button>
          <button class="rm-btn rm-btn-ghost" id="rm-btn-install-pwa" style="display:none;" title="Pasang Rak Modul ke Layar Utama HP / Laptop">
            ${icon('download')} Pasang Aplikasi
          </button>
          <a href="#/convert" class="rm-btn rm-btn-ghost" title="Konversi Dokumen">
            ${icon('convert')} Konversi
          </a>
          <a href="#/review" class="rm-btn rm-btn-ghost" title="Sesi Flashcards" style="position:relative;">
            ${icon('cards')} Flashcard
            ${dueCards.length > 0 ? `<span class="rm-badge rm-badge-pen" style="font-size:10px;padding:1px 5px;margin-left:2px;">${dueCards.length}</span>` : ''}
          </a>
          <a href="#/stats" class="rm-btn rm-btn-ghost" title="Statistik Belajar">
            ${icon('chart')} Statistik
          </a>
          <a href="#/notes" class="rm-btn rm-btn-ghost" title="Buku Catatan">
            ${icon('note')} Catatan
          </a>
          <a href="#/code" class="rm-btn rm-btn-ghost" title="Kode Bank (Format Colab)">
            ${icon('code')} Kode Bank
          </a>
          <a href="#/todos" class="rm-btn rm-btn-ghost" title="Agenda & Target Belajar (To-Do List)" style="position:relative;">
            ${icon('list-todo')} To-Do
            ${pendingTodos.length > 0 ? `<span class="rm-badge rm-badge-pen" style="font-size:10px;padding:1px 5px;margin-left:2px;">${pendingTodos.length}</span>` : ''}
          </a>
          <a href="#/upload" class="rm-btn rm-btn-primary">
            ${icon('upload')} Unggah modul
          </a>
        </div>
      </header>

      <main class="rm-container">
        <!-- Banner Pengingat Flashcards Jatuh Tempo -->
        ${dueCards.length > 0 ? `
          <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface);border:1px solid var(--pen);border-left:4px solid var(--pen);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-6);box-shadow:var(--shadow-sheet);">
            <div style="display:flex;align-items:center;gap:var(--space-3);">
              <span style="color:var(--pen);">${icon('cards', 'style="width:24px;height:24px;"')}</span>
              <div>
                <b style="font-size:14px;color:var(--ink);">Ada ${dueCards.length} kartu flashcard jatuh tempo hari ini</b>
                <p class="rm-muted" style="margin:0;font-size:13px;">Ulangi materi sekarang untuk memperkuat ingatan Spaced Repetition Anda.</p>
              </div>
            </div>
            <a href="#/review" class="rm-btn rm-btn-primary" style="height:32px;">Review Sekarang</a>
          </div>
        ` : ''}

        ${
          recentDoc
            ? `
          <section>
            <h2 style="font-size: 17px; font-weight: 600; margin-bottom: var(--space-3);">Lanjut membaca</h2>
            <div class="rm-continue-card">
              <div class="rm-continue-thumb">
                ${
                  recentDoc.thumb_data
                    ? `<img src="${recentDoc.thumb_data}" alt="Sampul">`
                    : `<svg viewBox="0 0 64 84" width="80" height="105"><rect width="100%" height="100%" fill="var(--surface-sunken)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="var(--ink-muted)" font-size="10">PDF</text></svg>`
                }
              </div>
              <div class="rm-continue-content">
                <h3 style="font-size: 20px; font-weight: 600; margin: 0 0 4px;">${recentDoc.title}</h3>
                <p class="rm-muted" style="margin: 0 0 var(--space-3); font-size: 14px;">
                  ${recentDoc.course_name ? `${recentDoc.course_name} · ` : ''}${recentDoc.page_count || 1} halaman · ${recentDoc.annotCount} catatan
                </p>
                <div class="rm-progress" style="width: 280px; margin-bottom: var(--space-4);">
                  <i style="width: ${recentDoc.progress.percent || 0}%"></i>
                </div>
                <a href="#/read/${recentDoc.id}?p=${recentDoc.progress.last_page || 1}" class="rm-btn rm-btn-primary">
                  Lanjut dari hal. ${recentDoc.progress.last_page || 1}
                </a>
              </div>
            </div>
          </section>
        `
            : ''
        }

        ${
          docs.length === 0
            ? `
          <div style="text-align: center; padding: var(--space-12) 0;">
            <p style="font-size: 17px; color: var(--ink-muted); margin-bottom: var(--space-4);">
              Rak masih kosong. Seret PDF ke sini untuk mulai membaca dan mencatat.
            </p>
            <div style="display:flex;justify-content:center;gap:var(--space-3);">
              <button id="rm-btn-load-sample" class="rm-btn rm-btn-ghost">
                ${icon('book')} Muat Contoh Modul (CS170)
              </button>
              <a href="#/upload" class="rm-btn rm-btn-primary">
                ${icon('upload')} Unggah Modul Pertama
              </a>
            </div>
          </div>
        `
            : Array.from(coursesMap.entries())
                .map(
                  ([courseName, courseDocs]) => `
          <section style="margin-bottom: var(--space-8);">
            <h2 style="font-size: 17px; font-weight: 600; margin-bottom: var(--space-2);">${courseName}</h2>
            <div class="rm-card-grid">
              ${courseDocs
                .map(
                  (doc) => `
                <a class="rm-card" href="#/read/${doc.id}?p=${doc.progress.last_page || 1}">
                  <span class="rm-thumb" aria-hidden="true">
                    ${
                      doc.thumb_data
                        ? `<img src="${doc.thumb_data}" alt="Sampul">`
                        : `<svg viewBox="0 0 64 84" width="64" height="84"><rect width="100%" height="100%" fill="var(--surface-sunken)"/></svg>`
                    }
                  </span>
                  <span class="rm-card-body">
                    <p class="rm-card-title">${doc.title}</p>
                    <p class="rm-card-meta">
                      <span class="rm-badge" style="font-size:10px;padding:0 4px;margin-right:4px;">${(doc.source_type || 'PDF').toUpperCase()}</span>
                      ${doc.course_code || courseName}, ${doc.page_count || 1} halaman
                    </p>
                    <span class="rm-progress" role="progressbar" aria-valuenow="${doc.progress.percent || 0}">
                      <i style="width: ${doc.progress.percent || 0}%"></i>
                    </span>
                    <span class="rm-card-foot">
                      <span>${doc.progress.percent > 0 ? `Hal. ${doc.progress.last_page}` : 'Belum dibuka'}</span>
                      <span>${doc.annotCount > 0 ? `${doc.annotCount} catatan` : ''}</span>
                    </span>
                  </span>
                </a>
              `
                )
                .join('')}
            </div>
          </section>
        `
                )
                .join('')
        }
      </main>

      <!-- MODAL PENGATURAN SINKRONISASI CLOUD -->
      <div id="rm-modal-cloud-sync" class="rm-modal-backdrop" style="display:none;">
        <div class="rm-modal" style="max-width:520px;">
          <div class="rm-modal-header">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="color:var(--pen);">${icon('cloud')}</span>
              <h3 class="rm-modal-title" style="margin:0;">Sinkronisasi Cloud Database</h3>
            </div>
            <button id="rm-btn-close-sync-modal" class="rm-colab-btn-icon">${icon('close')}</button>
          </div>
          <div class="rm-modal-body" style="display:flex;flex-direction:column;gap:var(--space-3);">
            <div style="padding:12px 14px;background:var(--surface-sunken);border-radius:var(--radius-md);font-size:12.5px;line-height:1.5;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <span style="font-weight:600;">Status Database:</span>
                <span id="rm-sync-status-badge" class="rm-badge rm-badge-green" style="font-size:11px;">
                  Mengecek koneksi...
                </span>
              </div>
              <p id="rm-sync-status-desc" style="margin:0;color:var(--ink-muted);font-size:12px;">
                Sinkronkan seluruh modul, halaman, coretan stylus/stabilo, catatan, progres baca, to-do list, kode bank, dan flashcards antara HP &amp; Laptop secara otomatis.
              </p>
            </div>

            <!-- Tombol Cepat Sync Cloudflare D1 -->
            <div id="rm-d1-action-box" style="display:none;padding:12px;background:var(--surface);border:1px solid var(--pen-soft);border-radius:var(--radius-md);text-align:center;">
              <div style="font-size:13px;font-weight:600;margin-bottom:4px;color:var(--ink);">Database Cloudflare D1 Aktif (Gratis 5 GB)</div>
              <div id="rm-d1-counts-info" style="font-size:12px;color:var(--ink-muted);margin-bottom:10px;">Semua data tersimpan otomatis di server edge Cloudflare.</div>
              <button id="rm-btn-trigger-d1-sync" class="rm-btn rm-btn-primary" style="width:100%;font-size:13px;height:34px;">
                ${icon('sync')} Sinkronkan Sekarang
              </button>
            </div>

            <details style="font-size:12px;color:var(--ink-muted);margin-top:4px;">
              <summary style="cursor:pointer;font-weight:600;color:var(--pen);">Opsi Tambahan: Sambungkan Supabase</summary>
              <div style="display:flex;flex-direction:column;gap:var(--space-2);margin-top:8px;">
                <div>
                  <label style="font-size:11px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:3px;">Project URL Supabase</label>
                  <input id="rm-sync-url" type="url" class="rm-input" style="width:100%;font-family:monospace;font-size:11.5px;" placeholder="https://xxxxxxxx.supabase.co" value="${credentials.url || ''}" />
                </div>
                <div>
                  <label style="font-size:11px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:3px;">Anon Public Key Supabase</label>
                  <input id="rm-sync-key" type="password" class="rm-input" style="width:100%;font-family:monospace;font-size:11.5px;" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..." value="${credentials.key || ''}" />
                </div>
                <button id="rm-btn-save-test-sync" class="rm-btn rm-btn-ghost" style="font-size:12px;height:30px;align-self:flex-start;">
                  ${icon('check')} Simpan Kredensial Supabase
                </button>
              </div>
            </details>

            <div id="rm-sync-msg-box" style="display:none;padding:8px 12px;border-radius:var(--radius-md);font-size:12.5px;"></div>
          </div>
        </div>
      </div>
    `;

    // Pasang Event Listeners
    container.querySelector('#rm-theme-toggle').addEventListener('click', toggleTheme);

    // Modal Cloud Sync
    const syncBtn = container.querySelector('#rm-btn-cloud-sync');
    const syncModal = container.querySelector('#rm-modal-cloud-sync');
    const closeSyncBtn = container.querySelector('#rm-btn-close-sync-modal');
    const saveTestBtn = container.querySelector('#rm-btn-save-test-sync');
    const triggerSyncBtn = container.querySelector('#rm-btn-trigger-sync');
    const disconnectBtn = container.querySelector('#rm-btn-disconnect-sync');
    const syncMsgBox = container.querySelector('#rm-sync-msg-box');
    const urlInput = container.querySelector('#rm-sync-url');
    const keyInput = container.querySelector('#rm-sync-key');
    const statusBadge = container.querySelector('#rm-sync-status-badge');
    const statusDesc = container.querySelector('#rm-sync-status-desc');
    const d1Box = container.querySelector('#rm-d1-action-box');
    const d1TriggerBtn = container.querySelector('#rm-btn-trigger-d1-sync');
    const d1CountsInfo = container.querySelector('#rm-d1-counts-info');

    async function updateSyncUI() {
      const d1 = await checkD1Status();
      if (d1 && d1.ok) {
        if (statusBadge) {
          statusBadge.className = 'rm-badge rm-badge-green';
          statusBadge.textContent = '🟢 Terhubung ke Cloudflare D1';
        }
        if (statusDesc) {
          statusDesc.textContent = 'Database serverless SQL resmi Cloudflare aktif. Seluruh to-do, modul, catatan, dan kode disinkronkan otomatis antara HP & Laptop.';
        }
        if (d1Box) d1Box.style.display = 'block';
        if (d1CountsInfo && d1.counts) {
          d1CountsInfo.textContent = `Tersimpan di Cloud: ${d1.counts.todos || 0} to-do, ${d1.counts.documents || 0} modul, ${d1.counts.notebooks || 0} kode bank.`;
        }
        const navPill = container.querySelector('#rm-btn-cloud-sync span');
        if (navPill) navPill.textContent = '🟢 Cloud (D1)';
      } else if (isConfigured) {
        if (statusBadge) {
          statusBadge.className = 'rm-badge rm-badge-green';
          statusBadge.textContent = '🟢 Terhubung ke Supabase';
        }
      } else {
        if (statusBadge) {
          statusBadge.className = 'rm-badge';
          statusBadge.textContent = '⚪ Mode Offline Lokal';
        }
      }
    }

    // Cek koneksi di awal secara non-blocking
    updateSyncUI();

    if (syncBtn && syncModal) {
      syncBtn.addEventListener('click', () => {
        syncModal.style.display = 'flex';
        if (syncMsgBox) syncMsgBox.style.display = 'none';
        updateSyncUI();
      });
    }

    if (d1TriggerBtn) {
      d1TriggerBtn.addEventListener('click', async () => {
        d1TriggerBtn.setAttribute('disabled', 'true');
        d1TriggerBtn.textContent = 'Menyinkronkan...';
        const res = await fullSync();
        d1TriggerBtn.removeAttribute('disabled');
        d1TriggerBtn.innerHTML = `${icon('sync')} Sinkronkan Sekarang`;
        if (res.success) {
          showToast('Sinkronisasi Cloudflare D1 berhasil!');
          updateSyncUI();
          render();
        } else {
          const errText = res.error || (res.reason === 'already_syncing' ? 'Sedang menyinkronkan...' : res.reason);
          showToast('Status sinkronisasi: ' + errText);
          updateSyncUI();
        }
      });
    }

    if (closeSyncBtn && syncModal) {
      closeSyncBtn.addEventListener('click', () => {
        syncModal.style.display = 'none';
      });
      syncModal.addEventListener('click', (e) => {
        if (e.target === syncModal) syncModal.style.display = 'none';
      });
    }

    if (saveTestBtn) {
      saveTestBtn.addEventListener('click', async () => {
        const url = (urlInput?.value || '').trim();
        const key = (keyInput?.value || '').trim();

        if (!url || !key) {
          if (syncMsgBox) {
            syncMsgBox.style.display = 'block';
            syncMsgBox.style.background = 'rgba(179,38,30,0.1)';
            syncMsgBox.style.color = 'var(--correction)';
            syncMsgBox.textContent = 'Harap isi Project URL dan Anon Key Supabase.';
          }
          return;
        }

        saveTestBtn.setAttribute('disabled', 'true');
        saveTestBtn.textContent = 'Menguji koneksi...';

        saveSupabaseCredentials(url, key);
        const testRes = await testSupabaseConnection();

        saveTestBtn.removeAttribute('disabled');
        saveTestBtn.innerHTML = `${icon('check')} Simpan & Uji Koneksi`;

        if (syncMsgBox) {
          syncMsgBox.style.display = 'block';
          if (testRes.ok) {
            syncMsgBox.style.background = 'rgba(40,167,69,0.1)';
            syncMsgBox.style.color = '#1e7e34';
            syncMsgBox.textContent = 'Koneksi Sukses! Menjalankan sinkronisasi dua arah...';
            showToast('Koneksi Supabase aktif');
            fullSync().then(() => {
              showToast('Seluruh modul, to-do, dan catatan tersinkronisasi');
              render();
            });
          } else {
            syncMsgBox.style.background = 'rgba(179,38,30,0.1)';
            syncMsgBox.style.color = 'var(--correction)';
            syncMsgBox.innerHTML = `<b>Koneksi Gagal:</b> ${testRes.message}<br><small style="margin-top:4px;display:block;">Pastikan Anda telah menjalankan skema SQL migration di Supabase SQL Editor.</small>`;
          }
        }
      });
    }

    if (triggerSyncBtn) {
      triggerSyncBtn.addEventListener('click', async () => {
        triggerSyncBtn.setAttribute('disabled', 'true');
        triggerSyncBtn.textContent = 'Menyinkronkan...';
        const res = await fullSync();
        triggerSyncBtn.removeAttribute('disabled');
        triggerSyncBtn.innerHTML = `${icon('sync')} Sinkronkan Sekarang`;
        if (res.success) {
          showToast('Sinkronisasi cloud berhasil!');
          render();
        } else {
          const errText = res.error || (res.reason === 'already_syncing' ? 'Sedang menyinkronkan...' : res.reason);
          showToast('Status sinkronisasi: ' + errText);
        }
      });
    }

    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => {
        if (confirm('Putuskan koneksi ke Supabase dan kembali ke mode penyimpanan lokal?')) {
          saveSupabaseCredentials('', '');
          showToast('Koneksi Supabase diputuskan');
          render();
        }
      });
    }

    const loadSampleBtn = container.querySelector('#rm-btn-load-sample');
    if (loadSampleBtn) {
      loadSampleBtn.addEventListener('click', async () => {
        loadSampleBtn.setAttribute('disabled', 'true');
        loadSampleBtn.textContent = 'Memuat…';
        try {
          const res = await fetch('/sample-module.pdf');
          const blob = await res.blob();
          const docId = crypto.randomUUID();

          const tempContainer = document.createElement('div');
          const pdfViewer = new PdfViewer({ container: tempContainer });
          await pdfViewer.load(blob);

          const thumbData = await pdfViewer.renderThumbnail(1, 140);
          const pages = await pdfViewer.extractAllPagesText();

          const docRecord = {
            id: docId,
            title: 'Jalur Terpendek pada DAG',
            course_name: 'Desain dan Analisis Algoritma',
            course_code: 'CS170',
            page_count: pdfViewer.pageCount,
            thumb_data: thumbData,
            tags: ['dag', 'algoritma', 'uts'],
            status: 'ready',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          await saveLocalDocument(docRecord, blob);
          await saveLocalPages(pages.map(p => ({
            document_id: docId,
            page_no: p.page_no,
            text: p.text
          })));

          showToast('Contoh modul CS170 berhasil dimuat');
          render();
        } catch (err) {
          console.error(err);
          alert('Gagal memuat contoh modul: ' + err.message);
          loadSampleBtn.removeAttribute('disabled');
        }
      });
    }

    // Dukungan Pasang Aplikasi (PWA Install Button)
    const installBtn = container.querySelector('#rm-btn-install-pwa');
    if (installBtn) {
      function checkInstallable() {
        if (window.deferredPWAInstallPrompt) {
          installBtn.style.display = 'inline-flex';
        }
      }
      checkInstallable();
      window.addEventListener('pwa-installable', checkInstallable);

      installBtn.addEventListener('click', async () => {
        if (!window.deferredPWAInstallPrompt) return;
        window.deferredPWAInstallPrompt.prompt();
        const choice = await window.deferredPWAInstallPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          showToast('Rak Modul berhasil dipasang di perangkat!');
          installBtn.style.display = 'none';
        }
        window.deferredPWAInstallPrompt = null;
      });
    }

    const searchInput = container.querySelector('#rm-shelf-search');
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && searchInput.value.trim()) {
        router.navigate(`/search?q=${encodeURIComponent(searchInput.value.trim())}`);
      }
    });

    // Pintasan keyboard '/' untuk fokus ke search
    window.addEventListener('keydown', function handleSlash(e) {
      if (e.key === '/' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        searchInput.focus();
      }
    });
  }

  render();
}
