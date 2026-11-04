// Reader View: Inti Pembaca PDF + Anotasi + Web Speech TTS + Side Drawer
import { PdfViewer } from '../reader/pdf-view.js';
import * as docx from 'docx-preview';
import { AnnotationToolbar } from '../reader/toolbar.js';
import { TtsController } from '../reader/tts.js';
import { PomodoroController } from '../reader/pomodoro.js';
import { openFlashcardModal } from '../ui/flashcard-modal.js';
import { getSelectionNormalizedCoords, segmentSentences } from '../reader/text-layer.js';
import { exportNotesToMarkdown, exportAnnotatedPdf } from '../reader/exporter.js';
import { processFileToCanonicalPdf } from '../reader/format-converter.js';
import {
  getLocalDocument,
  saveLocalDocument,
  getLocalAnnotations,
  saveLocalAnnotation,
  deleteLocalAnnotation,
  getLocalPages,
  saveLocalProgress,
  getLocalProgress
} from '../data/local-db.js';
import { downloadFileFromCloud } from '../data/cloud-db.js';
import { icon } from '../ui/icons.js';
import { showToast } from '../ui/toast.js';

export function ReaderPage({ container, params, query, router }) {
  const docId = params.id;
  const initialPage = parseInt(query.get('p') || '1', 10);

  let doc = null;
  let annotations = [];
  let pdfViewer = null;
  let docxWrapper = null;
  let docxScale = 1.0;
  let toolbar = null;
  let tts = null;
  let pomodoro = null;
  let currentPage = initialPage;
  let currentReadingPage = initialPage;
  let activeTab = 'notes'; // 'notes' atau 'outline'
  let outline = [];
  let activeTool = 'highlight';
  let activeColor = 'yellow';
  let isSidebarOpen = true;

  async function init() {
    doc = await getLocalDocument(docId);
    if (!doc) {
      container.innerHTML = `
        <div class="rm-container" style="text-align:center;padding:var(--space-12) 0;">
          <h2>Modul tidak ditemukan</h2>
          <p class="rm-muted">File modul mungkin telah dihapus atau belum diunggah.</p>
          <a href="#/" class="rm-btn rm-btn-primary" style="margin-top:var(--space-4);">Kembali ke Rak</a>
        </div>
      `;
      return;
    }

    annotations = await getLocalAnnotations(docId);
    renderLayout();
  }

  function renderLayout() {
    container.innerHTML = `
      <div class="rm-reader-layout">
        <header class="rm-reader-header">
          <div class="rm-reader-header-left">
            <a href="#/" class="rm-btn rm-btn-ghost rm-btn-icon" aria-label="Kembali ke rak">
              ${icon('back')}
            </a>
            <span class="rm-reader-title" title="${doc.title}">${doc.title}</span>
            <span class="rm-muted" style="font-size:13px;" id="rm-page-indicator">Hal. ${currentPage} dari ${doc.page_count || 1}</span>
          </div>

          <div style="display:flex;align-items:center;gap:var(--space-2);">
            ${doc.source_type === 'doc' || doc.source_type === 'note' ? `
              <a href="#/write/${doc.id}" class="rm-btn rm-btn-ghost rm-btn-icon" title="Edit Dokumen Ini di Writer" style="margin-right:2px;">
                ${icon('edit')}
              </a>
            ` : ''}

            <!-- Pomodoro Timer Widget -->
            <div class="rm-pomo-widget" style="display:flex;align-items:center;background:var(--surface-sunken);border:1px solid var(--line);border-radius:var(--radius-pill);padding:2px 8px;gap:6px;">
              <span style="color:var(--pen);display:flex;align-items:center;" title="Timer Belajar Pomodoro">${icon('timer', 'style="width:15px;height:15px;"')}</span>
              <span id="rm-pomo-time" style="font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;cursor:pointer;" title="Klik untuk pilih durasi (25m / 50m / 5m)">25:00</span>
              <button class="rm-btn rm-btn-ghost rm-btn-icon" id="rm-btn-pomo-toggle" style="width:22px;height:22px;padding:0;" title="Mulai / Jeda Timer">
                ${icon('play', 'style="width:11px;height:11px;"')}
              </button>
            </div>
            <span class="rm-sep" style="height:18px;"></span>

            <button class="rm-btn rm-btn-ghost rm-btn-icon" id="rm-btn-tts-start" aria-label="Bacakan halaman ini" title="Bacakan halaman ini">
              ${icon('speaker')}
            </button>
            <button class="rm-btn rm-btn-ghost rm-btn-icon" id="rm-btn-zoom-out" aria-label="Perkecil">
              <span style="font-size:18px;font-weight:bold;">−</span>
            </button>
            <span id="rm-zoom-val" style="font-size:13px;width:40px;text-align:center;">120%</span>
            <button class="rm-btn rm-btn-ghost rm-btn-icon" id="rm-btn-zoom-in" aria-label="Perbesar">
              <span style="font-size:18px;font-weight:bold;">+</span>
            </button>
            <span class="rm-sep" style="height:20px;"></span>

            <!-- Menu Ekspor Dokumen & Catatan -->
            <div style="position:relative;">
              <button class="rm-btn rm-btn-ghost rm-btn-icon" id="rm-btn-export-menu" aria-label="Ekspor dokumen & catatan" title="Ekspor Dokumen & Catatan">
                ${icon('download')}
              </button>
              <div class="rm-dropdown-menu" id="rm-export-dropdown" style="display:none;position:absolute;right:0;top:100%;margin-top:6px;min-width:245px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:var(--shadow-float);padding:6px;z-index:45;">
                <button class="rm-btn rm-btn-ghost" id="rm-btn-export-md" style="width:100%;justify-content:flex-start;height:34px;font-size:13px;padding:0 8px;">
                  ${icon('note', 'style="width:15px;height:15px;margin-right:8px;"')} Ekspor Catatan (.md Obsidian)
                </button>
                <button class="rm-btn rm-btn-ghost" id="rm-btn-export-pdf" style="width:100%;justify-content:flex-start;height:34px;font-size:13px;padding:0 8px;">
                  ${icon('book', 'style="width:15px;height:15px;margin-right:8px;"')} Ekspor PDF Beranotasi (.pdf)
                </button>
              </div>
            </div>

            <button class="rm-btn rm-btn-ghost rm-btn-icon" id="rm-btn-toggle-sidebar" aria-label="Panel samping" title="Buka/Tutup Catatan">
              ${icon('sidebar')}
            </button>
          </div>
        </header>

        <div class="rm-reader-body">
          <div class="rm-reader-viewport" id="rm-viewport">
            <div id="rm-pdf-container" class="rm-pdf-stage">
              <div style="padding:var(--space-8);color:var(--ink-muted);">Memuat lembar dokumen…</div>
            </div>
          </div>

          <!-- Side Drawer -->
          <aside class="rm-reader-sidebar" id="rm-sidebar">
            <div class="rm-sidebar-tabs">
              <button class="rm-sidebar-tab ${activeTab === 'notes' ? 'active' : ''}" data-tab="notes">Catatan (${annotations.length})</button>
              <button class="rm-sidebar-tab ${activeTab === 'outline' ? 'active' : ''}" data-tab="outline">Daftar Isi</button>
            </div>
            <div class="rm-sidebar-content" id="rm-sidebar-content">
              <!-- Content rendered dynamically -->
            </div>
          </aside>
        </div>
      </div>
    `;

    setupHeaderControls();
    setupViewer();
    setupToolbar();
    setupTTS();
    renderSidebarContent();
  }

  function setupHeaderControls() {
    // Setup Pomodoro Controller
    pomodoro = new PomodoroController({
      documentId: docId,
      onTick: (formattedTime, isRunning) => {
        const timeEl = container.querySelector('#rm-pomo-time');
        const toggleBtn = container.querySelector('#rm-btn-pomo-toggle');
        if (timeEl) timeEl.textContent = formattedTime;
        if (toggleBtn) {
          toggleBtn.innerHTML = isRunning
            ? icon('pause', 'style="width:11px;height:11px;"')
            : icon('play', 'style="width:11px;height:11px;"');
          toggleBtn.title = isRunning ? 'Jeda Pomodoro' : 'Mulai Pomodoro';
        }
      }
    });
    pomodoro.setDocument(docId, currentPage);

    const pomoToggle = container.querySelector('#rm-btn-pomo-toggle');
    if (pomoToggle) {
      pomoToggle.addEventListener('click', () => {
        if (pomodoro.isRunning) {
          pomodoro.pause();
        } else {
          pomodoro.start();
          showToast(`Timer Pomodoro (${pomodoro.durationMinutes}m) dimulai`);
        }
      });
    }

    const pomoTime = container.querySelector('#rm-pomo-time');
    if (pomoTime) {
      pomoTime.addEventListener('click', () => {
        const choice = prompt('Atur durasi Timer Belajar Pomodoro:\n1 = 25 menit (Standar)\n2 = 50 menit (Fokus Dalam)\n3 = 5 menit (Istirahat Singkat)\n4 = Reset Timer', '1');
        if (choice === '1') { pomodoro.setDuration(25); showToast('Durasi diatur ke 25 menit'); }
        else if (choice === '2') { pomodoro.setDuration(50); showToast('Durasi diatur ke 50 menit'); }
        else if (choice === '3') { pomodoro.setDuration(5); showToast('Durasi diatur ke 5 menit'); }
        else if (choice === '4') { pomodoro.reset(); showToast('Timer di-reset'); }
      });
    }

    container.querySelector('#rm-btn-toggle-sidebar').addEventListener('click', () => {
      isSidebarOpen = !isSidebarOpen;
      const sidebar = container.querySelector('#rm-sidebar');
      sidebar.classList.toggle('collapsed', !isSidebarOpen);
    });

    const zoomVal = container.querySelector('#rm-zoom-val');
    container.querySelector('#rm-btn-zoom-in').addEventListener('click', () => {
      if (doc && doc.source_type === 'docx') {
        if (docxScale < 2.4) {
          docxScale = Math.round((docxScale + 0.15) * 100) / 100;
          zoomVal.textContent = `${Math.round(docxScale * 100)}%`;
          if (docxWrapper) {
            docxWrapper.style.transform = `scale(${docxScale})`;
            docxWrapper.style.transformOrigin = 'top center';
          }
        }
        return;
      }
      if (pdfViewer && pdfViewer.scale < 2.5) {
        pdfViewer.scale = Math.round((pdfViewer.scale + 0.15) * 100) / 100;
        zoomVal.textContent = `${Math.round(pdfViewer.scale * 100)}%`;
        pdfViewer.renderAllPages({ annotations });
      }
    });

    container.querySelector('#rm-btn-zoom-out').addEventListener('click', () => {
      if (doc && doc.source_type === 'docx') {
        if (docxScale > 0.5) {
          docxScale = Math.round((docxScale - 0.15) * 100) / 100;
          zoomVal.textContent = `${Math.round(docxScale * 100)}%`;
          if (docxWrapper) {
            docxWrapper.style.transform = `scale(${docxScale})`;
            docxWrapper.style.transformOrigin = 'top center';
          }
        }
        return;
      }
      if (pdfViewer && pdfViewer.scale > 0.6) {
        pdfViewer.scale = Math.round((pdfViewer.scale - 0.15) * 100) / 100;
        zoomVal.textContent = `${Math.round(pdfViewer.scale * 100)}%`;
        pdfViewer.renderAllPages({ annotations });
      }
    });

    container.querySelector('#rm-btn-tts-start').addEventListener('click', async () => {
      startTTSFromPage(currentPage);
    });

    // Event Menu Ekspor (Markdown & PDF)
    const exportBtn = container.querySelector('#rm-btn-export-menu');
    const exportDropdown = container.querySelector('#rm-export-dropdown');
    if (exportBtn && exportDropdown) {
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportDropdown.style.display = exportDropdown.style.display === 'none' ? 'block' : 'none';
      });
      document.addEventListener('click', () => {
        if (exportDropdown) exportDropdown.style.display = 'none';
      });
    }

    const btnExportMd = container.querySelector('#rm-btn-export-md');
    if (btnExportMd) {
      btnExportMd.addEventListener('click', () => {
        if (exportDropdown) exportDropdown.style.display = 'none';
        exportNotesToMarkdown(doc, annotations);
      });
    }

    const btnExportPdf = container.querySelector('#rm-btn-export-pdf');
    if (btnExportPdf) {
      btnExportPdf.addEventListener('click', async () => {
        if (exportDropdown) exportDropdown.style.display = 'none';
        let blob = doc._cachedBlob;
        if (!blob && pdfViewer && pdfViewer.pdfDoc) {
          const data = await pdfViewer.pdfDoc.save();
          blob = new Blob([data], { type: 'application/pdf' });
        }
        if (doc && doc.source_type === 'docx' && blob && !blob.type.includes('pdf')) {
          showToast('Mengonversi Word ke PDF untuk diekspor…');
          const converted = await processFileToCanonicalPdf(blob, doc.title);
          blob = converted.pdfBlob;
        }
        await exportAnnotatedPdf(doc, annotations, blob);
      });
    }

    container.querySelectorAll('.rm-sidebar-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        container.querySelectorAll('.rm-sidebar-tab').forEach(t => t.classList.remove('active'));
        tabBtn.classList.add('active');
        activeTab = tabBtn.dataset.tab;
        renderSidebarContent();
      });
    });
  }

  async function setupViewer() {
    const pdfContainer = container.querySelector('#rm-pdf-container');
    const viewport = container.querySelector('#rm-viewport');

    let hasFileData = Boolean(doc._cachedBlob || doc.pdf_url || doc.pdf_key);
    if (!hasFileData) {
      pdfContainer.innerHTML = `
        <div style="padding:var(--space-8);color:var(--ink-muted);text-align:center;">
          <div style="margin-bottom:var(--space-2);">${icon('cloud', 'style="width:36px;height:36px;"')}</div>
          Mengunduh berkas modul dari Cloud Database…
        </div>
      `;
      try {
        const cloudBlob = await downloadFileFromCloud(doc.id);
        if (cloudBlob && cloudBlob.size > 0) {
          doc._cachedBlob = cloudBlob;
          hasFileData = true;
          // Simpan ke cache IndexedDB agar cepat saat dibuka kembali
          await saveLocalDocument(doc, cloudBlob);
        }
      } catch (err) {
        console.warn('Gagal unduh file dari cloud D1:', err);
      }
    }

    if (!hasFileData) {
      pdfContainer.innerHTML = `
        <div style="padding:var(--space-8);text-align:center;max-width:540px;margin:var(--space-8) auto;background:var(--surface);border:1px dashed var(--line);border-radius:var(--radius-lg);box-shadow:var(--shadow-float);">
          <div style="margin-bottom:var(--space-3);color:var(--pen);">${icon('cloud', 'style="width:48px;height:48px;"')}</div>
          <h3 style="font-size:18px;font-weight:600;margin-bottom:var(--space-2);">${doc.title}</h3>
          <p style="color:var(--ink-muted);font-size:14px;line-height:1.5;margin-bottom:var(--space-6);">
            Modul ini tersinkronisasi dari Cloud D1. Untuk membuka lembar halaman dokumen secara penuh di perangkat ini, silakan hubungkan file <b>.${doc.source_type || 'docx'}</b> dari komputer Anda.
          </p>
          <label class="rm-btn rm-btn-primary" style="cursor:pointer;display:inline-flex;align-items:center;gap:var(--space-2);padding:10px 20px;font-weight:600;">
            ${icon('upload')} Hubungkan File dari Komputer Ini
            <input type="file" id="rm-attach-local-file" accept="${doc.source_type === 'docx' ? '.docx' : '.pdf'}" style="display:none;">
          </label>
        </div>
      `;
      const attachInput = pdfContainer.querySelector('#rm-attach-local-file');
      if (attachInput) {
        attachInput.addEventListener('change', async (e) => {
          const file = e.target.files && e.target.files[0];
          if (file) {
            showToast('Menyimpan file dokumen ke Cloud…');
            await saveLocalDocument(doc, file);
            doc._cachedBlob = file;
            setupViewer();
          }
        });
      }
      return;
    }

    // Dokumen Buatan Sendiri (Format Tulis Dokumen Cepat .doc/.note)
    if (doc.source_type === 'doc' || doc.source_type === 'note') {
      let htmlText = '';
      if (doc._cachedBlob instanceof Blob) {
        htmlText = await doc._cachedBlob.text();
      } else if (typeof doc._cachedBlob === 'string') {
        htmlText = doc._cachedBlob;
      } else if (doc.pdf_url) {
        try {
          const resp = await fetch(doc.pdf_url);
          htmlText = await resp.text();
        } catch (_) {}
      }

      docxWrapper = document.createElement('div');
      docxWrapper.className = 'rm-docx-container';
      pdfContainer.innerHTML = '';
      pdfContainer.appendChild(docxWrapper);

      const sec = document.createElement('section');
      sec.className = 'docx rm-pdf-page';
      sec.dataset.pageNo = 1;
      sec.id = 'rm-page-1';
      sec.innerHTML = `<article style="padding:16px 8px;font-size:16px;line-height:1.7;">${htmlText}</article>`;
      docxWrapper.appendChild(sec);

      sec.querySelectorAll('table').forEach(tbl => {
        if (!tbl.parentElement.classList.contains('rm-table-scroll')) {
          const wrap = document.createElement('div');
          wrap.className = 'rm-table-scroll';
          tbl.parentElement.insertBefore(wrap, tbl);
          wrap.appendChild(tbl);
        }
      });

      doc.page_count = 1;
      const indicator = container.querySelector('#rm-page-indicator');
      if (indicator) indicator.textContent = `Hal. 1 dari 1`;

      pageTexts.set(1, sec.textContent || '');

      outline = [];
      const headingEls = docxWrapper.querySelectorAll('h1, h2, h3, h4');
      headingEls.forEach((hEl, idx) => {
        hEl.id = hEl.id || `rm-doc-h-${idx + 1}`;
        outline.push({ title: hEl.textContent.trim(), pageNo: 1, elementId: hEl.id });
      });
      renderSidebarContent();
      return;
    }

    if (doc.source_type === 'docx') {
      pdfContainer.innerHTML = `
        <div style="padding:var(--space-8);color:var(--ink-muted);text-align:center;">
          <div style="margin-bottom:var(--space-2);">${icon('book', 'style="width:32px;height:32px;"')}</div>
          Memuat dokumen Word asli, tabel, dan gambar…
        </div>
      `;

      try {
        let arrayBuffer;
        if (doc._cachedBlob instanceof Blob) {
          arrayBuffer = await doc._cachedBlob.arrayBuffer();
        } else if (doc._cachedBlob instanceof ArrayBuffer) {
          arrayBuffer = doc._cachedBlob;
        } else if (doc.pdf_url || doc.pdf_key) {
          const resp = await fetch(doc.pdf_url || doc.pdf_key);
          arrayBuffer = await resp.arrayBuffer();
        } else {
          throw new Error('Data file Word tidak ditemukan di penyimpanan lokal.');
        }

        docxWrapper = document.createElement('div');
        docxWrapper.className = 'rm-docx-container';
        pdfContainer.innerHTML = '';
        pdfContainer.appendChild(docxWrapper);

        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

        await docx.renderAsync(arrayBuffer, docxWrapper, null, {
          className: 'docx',
          inWrapper: false,
          breakPages: true,
          ignoreWidth: true,
          ignoreHeight: isMobile,
          renderHeaders: true,
          renderFooters: true
        });

        // Tag each section as a page and wrap wide tables
        const sections = docxWrapper.querySelectorAll('section.docx');
        const pageCount = sections.length > 0 ? sections.length : 1;
        doc.page_count = pageCount;

        const indicator = container.querySelector('#rm-page-indicator');
        if (indicator) indicator.textContent = `Hal. ${currentPage} dari ${pageCount}`;

        sections.forEach((sec, idx) => {
          const pageNo = idx + 1;
          sec.classList.add('rm-pdf-page');
          sec.dataset.pageNo = pageNo;
          sec.id = `rm-page-${pageNo}`;

          // Di mobile, paksa halaman Word fit 100% lebar layar dan hapus tinggi kosong berlebih
          if (isMobile) {
            sec.style.setProperty('width', '100%', 'important');
            sec.style.setProperty('max-width', '100%', 'important');
            sec.style.setProperty('min-width', '0px', 'important');
            sec.style.setProperty('min-height', 'auto', 'important');
            sec.style.setProperty('padding-left', '14px', 'important');
            sec.style.setProperty('padding-right', '14px', 'important');
            sec.style.setProperty('box-sizing', 'border-box', 'important');
          }

          // Bungkus tabel dengan container scroll aman agar tidak meluber keluar layar
          sec.querySelectorAll('table').forEach(tbl => {
            if (!tbl.parentElement.classList.contains('rm-table-scroll')) {
              const wrap = document.createElement('div');
              wrap.className = 'rm-table-scroll';
              tbl.parentElement.insertBefore(wrap, tbl);
              wrap.appendChild(tbl);
            }
          });
        });

        // Build outline from headings in Word document
        outline = [];
        const headingEls = docxWrapper.querySelectorAll('h1, h2, h3, h4, [class*="heading" i], [class*="title" i]');
        let hIdx = 0;
        headingEls.forEach(hEl => {
          const text = hEl.textContent.trim();
          if (text && text.length > 2 && text.length < 120) {
            hIdx++;
            hEl.id = hEl.id || `rm-docx-h-${hIdx}`;
            const sec = hEl.closest('section.docx');
            const pageNo = sec ? parseInt(sec.dataset.pageNo, 10) : 1;
            outline.push({
              title: text,
              elementId: hEl.id,
              pageNo
            });
          }
        });
        if (activeTab === 'outline') {
          renderSidebarContent();
        }

        // Setup scroll observer for page tracking & progress
        const observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
              const pageNo = parseInt(entry.target.dataset.pageNo, 10);
              currentPage = pageNo;
              if (indicator) indicator.textContent = `Hal. ${pageNo} dari ${pageCount}`;

              const percent = Math.round((pageNo / pageCount) * 100);
              saveLocalProgress({
                document_id: docId,
                last_page: pageNo,
                percent
              });
            }
          }
        }, { root: viewport, threshold: 0.3 });

        sections.forEach(pageEl => {
          observer.observe(pageEl);
        });

        if (initialPage > 1) {
          const targetEl = document.getElementById(`rm-page-${initialPage}`);
          if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth' });
        }

        setupTextSelectionListener();
        return;
      } catch (err) {
        console.error('Gagal merender dokumen DOCX:', err);
        pdfContainer.innerHTML = `
          <div style="padding:var(--space-8);color:var(--correction);text-align:center;">
            <p>Terjadi kesalahan saat memuat tampilan Word asli.</p>
            <p class="rm-muted" style="font-size:13px;">${err.message}</p>
          </div>
        `;
        return;
      }
    }

    pdfViewer = new PdfViewer({
      container: pdfContainer,
      onPageRendered: (pageNo) => {
        // Observer or scroll position update
      },
      onAnnotationClick: (annot) => {
        // Open edit or show note in sidebar
        activeTab = 'notes';
        renderSidebarContent();
        const noteEl = document.getElementById(`rm-note-item-${annot.id}`);
        if (noteEl) {
          noteEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          noteEl.style.borderColor = 'var(--pen)';
          setTimeout(() => { noteEl.style.borderColor = 'var(--line)'; }, 1500);
        }
      },
      onAnnotationDelete: async (annot) => {
        await deleteLocalAnnotation(annot.id);
        annotations = annotations.filter(a => a.id !== annot.id);
        if (pdfViewer) pdfViewer.updateAnnotations(annotations);
        renderSidebarContent();
        showToast('Anotasi dihapus');
      },
      onAddAnnotation: async (annotData) => {
        const annotId = crypto.randomUUID();
        const newAnnot = {
          id: annotId,
          document_id: docId,
          ...annotData,
          created_at: new Date().toISOString()
        };
        await saveLocalAnnotation(newAnnot);
        annotations.push(newAnnot);
        if (pdfViewer) pdfViewer.updateAnnotations(annotations);
        renderSidebarContent();
        showToast('Coretan pena disimpan');
      }
    });

    // Muat file PDF dari cachedBlob jika ada, atau buat dummy PDF
    if (doc._cachedBlob) {
      await pdfViewer.load(doc._cachedBlob);
    } else {
      // Jika remote URL atau stream
      await pdfViewer.load(doc.pdf_url || doc.pdf_key);
    }

    await pdfViewer.renderAllPages({ annotations });
    outline = await pdfViewer.getOutline();

    if (initialPage > 1) {
      pdfViewer.goToPage(initialPage);
    }

    // Intersection observer untuk update halaman aktif & simpan progress
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
          const pageNo = parseInt(entry.target.dataset.pageNo, 10);
          currentPage = pageNo;
          const indicator = container.querySelector('#rm-page-indicator');
          if (indicator) indicator.textContent = `Hal. ${pageNo} dari ${doc.page_count || 1}`;

          const percent = Math.round((pageNo / (doc.page_count || 1)) * 100);
          saveLocalProgress({
            document_id: docId,
            last_page: pageNo,
            percent
          });
        }
      }
    }, { root: viewport, threshold: 0.4 });

    pdfContainer.querySelectorAll('.rm-pdf-page').forEach(pageEl => {
      observer.observe(pageEl);
    });

    // Handle Text Selection for annotations
    setupTextSelectionListener();
  }

  function setupToolbar() {
    const viewport = container.querySelector('#rm-viewport');
    toolbar = new AnnotationToolbar({
      activeTool,
      activeColor,
      onToolChange: (tool) => {
        activeTool = tool;
        if (pdfViewer) pdfViewer.setDrawingTool(tool, activeColor);
        if (viewport) {
          if (tool === 'pen' || tool === 'eraser') {
            viewport.style.userSelect = 'none';
          } else {
            viewport.style.userSelect = 'text';
          }
        }
      },
      onColorChange: (color) => {
        activeColor = color;
        if (pdfViewer) pdfViewer.setDrawingTool(activeTool, color);
      }
    });

    const toolbarEl = toolbar.render();
    viewport.parentElement.appendChild(toolbarEl);
  }

  function setupTextSelectionListener() {
    document.addEventListener('mouseup', handleTextSelection);
  }

  async function handleTextSelection(e) {
    // Abaikan jika klik di dalam toolbar atau sidebar
    if (e.target.closest('.rm-toolbar') || e.target.closest('.rm-reader-sidebar') || e.target.closest('.rm-player')) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    // Temukan halaman PDF / DOCX tempat seleksi terjadi
    const range = selection.getRangeAt(0);
    const startNode = range.startContainer;
    const pageEl = startNode.nodeType === Node.ELEMENT_NODE
      ? startNode.closest('.rm-pdf-page')
      : startNode.parentElement?.closest('.rm-pdf-page');

    if (!pageEl) return;
    const pageNo = parseInt(pageEl.dataset.pageNo, 10);
    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    let coords = null;
    if (doc.source_type !== 'docx') {
      coords = getSelectionNormalizedCoords(pageEl);
      if (!coords || coords.rects.length === 0) return;
    }

    if (activeTool === 'highlight' || activeTool === 'underline' || activeTool === 'strike') {
      if (doc.source_type === 'docx') {
        try {
          const mark = document.createElement('mark');
          mark.className = `rm-mark-${activeColor} rm-annot-mark`;
          if (activeTool === 'underline') mark.style.textDecoration = 'underline';
          if (activeTool === 'strike') mark.style.textDecoration = 'line-through';
          range.surroundContents(mark);
        } catch {
          // Fallback if selection spans complex nodes
          const mark = document.createElement('mark');
          mark.className = `rm-mark-${activeColor} rm-annot-mark`;
          const fragment = range.extractContents();
          mark.appendChild(fragment);
          range.insertNode(mark);
        }
      }

      const newAnnot = {
        id: crypto.randomUUID(),
        document_id: docId,
        page_no: pageNo,
        kind: activeTool,
        color: activeColor,
        geometry: coords ? { rects: coords.rects } : { rects: [] },
        quote: coords ? coords.quote : selectedText,
        note_md: '',
        created_at: new Date().toISOString()
      };

      annotations.push(newAnnot);
      await saveLocalAnnotation(newAnnot);
      if (pdfViewer) pdfViewer.updateAnnotations(annotations);
      renderSidebarContent();
      selection.removeAllRanges();
      showToast('Anotasi ditambahkan');
    } else if (activeTool === 'note') {
      const quoteText = coords ? coords.quote : selectedText;
      const noteText = prompt(`Tulis catatan untuk kutipan: "${quoteText.slice(0, 40)}…"`);
      if (noteText && noteText.trim()) {
        if (doc.source_type === 'docx') {
          try {
            const mark = document.createElement('mark');
            mark.className = `rm-mark-${activeColor} rm-annot-mark`;
            range.surroundContents(mark);
          } catch {
            const mark = document.createElement('mark');
            mark.className = `rm-mark-${activeColor} rm-annot-mark`;
            const fragment = range.extractContents();
            mark.appendChild(fragment);
            range.insertNode(mark);
          }
        }

        const newAnnot = {
          id: crypto.randomUUID(),
          document_id: docId,
          page_no: pageNo,
          kind: 'highlight',
          color: activeColor,
          geometry: coords ? { rects: coords.rects } : { rects: [] },
          quote: quoteText,
          note_md: noteText.trim(),
          created_at: new Date().toISOString()
        };

        annotations.push(newAnnot);
        await saveLocalAnnotation(newAnnot);
        if (pdfViewer) pdfViewer.updateAnnotations(annotations);
        renderSidebarContent();
        selection.removeAllRanges();
        showToast('Catatan disimpan');
      }
    }
  }

  async function getTextForPage(pageNo) {
    let text = '';
    if (doc && doc.source_type === 'docx') {
      const sec = container.querySelector(`#rm-page-${pageNo}`);
      if (sec) {
        text = sec.innerText || sec.textContent || '';
      }
    }
    if (!text) {
      const pages = await getLocalPages(docId);
      const currentPageData = pages.find(p => p.page_no === pageNo);
      text = currentPageData ? currentPageData.text : (pdfViewer ? (pdfViewer.pageTexts.get(pageNo) || '') : '');
    }
    // Jika masih belum ada di cache dan pdfViewer memiliki dokumen, ekstrak langsung dari halaman PDF
    if (!text && pdfViewer && pdfViewer.pdfDoc && pageNo <= pdfViewer.pageCount) {
      try {
        const page = await pdfViewer.pdfDoc.getPage(pageNo);
        const textContent = await page.getTextContent();
        text = textContent.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('');
      } catch (e) {
        console.warn('Gagal ekstrak teks halaman PDF secara dinamis:', e);
      }
    }
    return text ? text.trim() : '';
  }

  async function advanceToNextPage() {
    const totalPages = (doc && doc.page_count) || (pdfViewer ? pdfViewer.pageCount : 1);
    let targetPage = currentReadingPage + 1;

    let sentences = [];
    while (targetPage <= totalPages) {
      const text = await getTextForPage(targetPage);
      sentences = segmentSentences(text);
      if (sentences.length > 0) break;
      targetPage++;
    }

    if (targetPage > totalPages || sentences.length === 0) {
      showToast('Selesai membacakan seluruh modul.');
      return false;
    }

    currentReadingPage = targetPage;
    currentPage = targetPage;

    // Gulir ke halaman target
    if (doc && doc.source_type === 'docx') {
      const pageEl = container.querySelector(`#rm-page-${targetPage}`);
      if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (pdfViewer) {
      pdfViewer.goToPage(targetPage);
    }

    // Perbarui label indikator halaman di navbar atas
    const indicator = container.querySelector('#rm-page-indicator');
    if (indicator) {
      indicator.textContent = `Hal. ${targetPage} dari ${totalPages}`;
    }

    tts.setPageInfo(targetPage, totalPages);
    tts.setSentences(sentences, 0);
    tts.play();
    return true;
  }

  async function advanceToPrevPage() {
    const totalPages = (doc && doc.page_count) || (pdfViewer ? pdfViewer.pageCount : 1);
    let targetPage = currentReadingPage - 1;

    let sentences = [];
    while (targetPage >= 1) {
      const text = await getTextForPage(targetPage);
      sentences = segmentSentences(text);
      if (sentences.length > 0) break;
      targetPage--;
    }

    if (targetPage < 1 || sentences.length === 0) {
      return false;
    }

    currentReadingPage = targetPage;
    currentPage = targetPage;

    if (doc && doc.source_type === 'docx') {
      const pageEl = container.querySelector(`#rm-page-${targetPage}`);
      if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (pdfViewer) {
      pdfViewer.goToPage(targetPage);
    }

    const indicator = container.querySelector('#rm-page-indicator');
    if (indicator) {
      indicator.textContent = `Hal. ${targetPage} dari ${totalPages}`;
    }

    tts.setPageInfo(targetPage, totalPages);
    tts.setSentences(sentences, sentences.length - 1);
    tts.play();
    return true;
  }

  function setupTTS() {
    tts = new TtsController({
      onSentenceChange: (idx, text) => {
        // Karaoke highlight class rm-speaking automatically handled by tts controller
      },
      onNextPage: async () => {
        return await advanceToNextPage();
      },
      onPrevPage: async () => {
        return await advanceToPrevPage();
      }
    });

    const playerEl = tts.mountPlayer(container.querySelector('.rm-reader-body'));
    playerEl.style.display = 'none'; // tersembunyi hingga tts dipicu
  }

  async function startTTSFromPage(pageNo) {
    currentReadingPage = pageNo;
    const totalPages = (doc && doc.page_count) || (pdfViewer ? pdfViewer.pageCount : 1);

    const textToRead = await getTextForPage(pageNo);
    let sentences = segmentSentences(textToRead);

    if (sentences.length === 0) {
      // Jika halaman ini tidak memiliki teks, otomatis cari halaman berikutnya yang memiliki teks
      const advanced = await advanceToNextPage();
      if (!advanced) {
        showToast('Tidak ada teks terbaca di halaman ini.');
      }
      return;
    }

    tts.setPageInfo(pageNo, totalPages);
    tts.setSentences(sentences, 0);
    if (tts.playerElement) {
      tts.playerElement.style.display = 'flex';
      tts.play();
    }
  }

  function renderSidebarContent() {
    const content = container.querySelector('#rm-sidebar-content');
    if (!content) return;

    if (activeTab === 'notes') {
      if (annotations.length === 0) {
        content.innerHTML = `
          <div style="text-align:center;padding:var(--space-6) 0;color:var(--ink-muted);">
            <p>Belum ada catatan di modul ini.</p>
            <p style="font-size:13px;">Seleksi teks dengan alat Sorot atau tekan <b>N</b> untuk membuat catatan.</p>
          </div>
        `;
        return;
      }

      content.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);padding-bottom:var(--space-2);border-bottom:1px solid var(--line);">
          <span style="font-size:12px;font-weight:600;color:var(--ink-muted);">${annotations.filter(a => !a.deleted).length} Catatan tersimpan</span>
          <button class="rm-btn rm-btn-ghost" id="rm-btn-notes-export-md" style="height:26px;padding:0 8px;font-size:12px;color:var(--pen);" title="Unduh semua catatan ke format Markdown Obsidian">
            ${icon('download', 'style="width:13px;height:13px;margin-right:4px;"')} Ekspor .md
          </button>
        </div>
        ${annotations
          .filter(a => !a.deleted)
          .map(a => `
          <div class="rm-note" id="rm-note-item-${a.id}" data-id="${a.id}" data-page="${a.page_no}">
            ${a.quote ? `<p class="rm-note-quote rm-mark-${a.color || 'yellow'}">${a.quote}</p>` : ''}
            ${a.note_md ? `<p class="rm-note-body">${a.note_md}</p>` : ''}
            ${a.kind === 'ink' ? `<p style="font-size:12px;font-style:italic;color:var(--ink-muted);margin:0 0 6px;">✍️ Coretan pena bebas</p>` : ''}
            <div class="rm-note-foot">
              <span>Hal. ${a.page_no}</span>
              <div style="display:flex;align-items:center;gap:4px;">
                <button class="rm-btn rm-btn-ghost rm-btn-make-fc" data-id="${a.id}" style="height:24px;padding:0 6px;font-size:11px;color:var(--pen);" title="Ubah menjadi kartu flashcard">
                  ${icon('cards', 'style="width:13px;height:13px;margin-right:2px;"')} Kartu
                </button>
                <button class="rm-btn rm-btn-ghost rm-btn-danger rm-btn-delete-note" data-id="${a.id}" style="height:24px;padding:0 6px;" aria-label="Hapus anotasi">
                  ${icon('trash', 'style="width:13px;height:13px;"')}
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      `;

      const notesExportMd = content.querySelector('#rm-btn-notes-export-md');
      if (notesExportMd) {
        notesExportMd.addEventListener('click', () => {
          exportNotesToMarkdown(doc, annotations);
        });
      }

      content.querySelectorAll('.rm-btn-make-fc').forEach(fcBtn => {
        fcBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const annotId = fcBtn.dataset.id;
          const annot = annotations.find(a => a.id === annotId);
          if (!annot) return;
          openFlashcardModal({
            front: '',
            back: annot.quote + (annot.note_md ? '\n\nCatatan: ' + annot.note_md : ''),
            documentId: docId,
            annotationId: annot.id,
            courseName: doc ? doc.course_name : 'Umum'
          });
        });
      });

      content.querySelectorAll('.rm-note').forEach(noteEl => {
        noteEl.addEventListener('click', (e) => {
          if (e.target.closest('.rm-btn-delete-note')) return;
          const pageNo = parseInt(noteEl.dataset.page, 10);
          if (doc.source_type === 'docx') {
            const targetPage = container.querySelector(`#rm-page-${pageNo}`);
            if (targetPage) targetPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else if (pdfViewer) {
            pdfViewer.goToPage(pageNo);
          }
        });
      });

      content.querySelectorAll('.rm-btn-delete-note').forEach(delBtn => {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const annotId = delBtn.dataset.id;
          await deleteLocalAnnotation(annotId);
          annotations = annotations.filter(a => a.id !== annotId);
          if (pdfViewer) pdfViewer.updateAnnotations(annotations);
          renderSidebarContent();
          showToast('Anotasi dihapus');
        });
      });
    } else if (activeTab === 'outline') {
      if (outline.length === 0) {
        content.innerHTML = `
          <div style="text-align:center;padding:var(--space-6) 0;color:var(--ink-muted);">
            <p>Tidak ada daftar isi di modul ini.</p>
          </div>
        `;
        return;
      }

      content.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:var(--space-2);">
          ${outline.map((item, idx) => `
            <button class="rm-btn rm-btn-ghost rm-outline-item" data-idx="${idx}" style="justify-content:flex-start;text-align:left;height:auto;padding:var(--space-2);">
              ${item.title}
            </button>
          `).join('')}
        </div>
      `;

      content.querySelectorAll('.rm-outline-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          const item = outline[idx];
          if (!item) return;
          if (item.elementId) {
            const targetEl = document.getElementById(item.elementId);
            if (targetEl) {
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              return;
            }
          }
          if (item.pageNo) {
            if (doc.source_type === 'docx') {
              const targetPage = container.querySelector(`#rm-page-${item.pageNo}`);
              if (targetPage) targetPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (pdfViewer) {
              pdfViewer.goToPage(item.pageNo);
            }
          }
        });
      });
    }
  }

  init();

  return () => {
    // Cleanup event listeners & objects on unmount
    document.removeEventListener('mouseup', handleTextSelection);
    if (toolbar) toolbar.destroy();
    if (tts) tts.destroy();
    if (pomodoro) pomodoro.destroy();
  };
}

