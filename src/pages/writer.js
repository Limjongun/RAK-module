// Halaman Tulis Dokumen Cepat & Standar Lengkap (Document Writer)
import { getLocalDocument, saveLocalDocument, saveLocalPages } from '../data/local-db.js';
import { uploadFileToCloud } from '../data/cloud-db.js';
import { icon } from '../ui/icons.js';
import { showToast } from '../ui/toast.js';
import katex from 'katex';

export function WriterPage({ container, params, query, router }) {
  let docId = params.id || crypto.randomUUID();
  let doc = null;
  let saveTimer = null;
  let isSaving = false;
  let lastSavedHtml = '';

  async function init() {
    if (params.id) {
      doc = await getLocalDocument(params.id);
    }

    const initialTitle = doc?.title || 'Dokumen Tanpa Judul';
    const initialCourse = doc?.course_name || 'Umum';

    let initialHtml = '';
    if (doc) {
      if (doc._cachedBlob instanceof Blob) {
        initialHtml = await doc._cachedBlob.text();
      } else if (typeof doc._cachedBlob === 'string') {
        initialHtml = doc._cachedBlob;
      }
    }

    if (!initialHtml) {
      initialHtml = '<p>Mulai ketik isi dokumen Anda di sini…</p>';
    }

    container.innerHTML = `
      <div class="rm-writer-layout">
        <!-- HEADER ATAS -->
        <header class="rm-writer-header">
          <div class="rm-writer-header-left">
            <a href="#/" class="rm-btn rm-btn-ghost rm-btn-icon" title="Kembali ke Rak Modul">
              ${icon('back')}
            </a>
            <span class="rm-writer-save-status" id="rm-writer-status">
              <span style="color:#28a745;">●</span> Tersimpan di Cloud
            </span>
          </div>

          <div class="rm-writer-header-right">
            <div style="position:relative;">
              <button class="rm-btn rm-btn-ghost" id="rm-btn-writer-export" title="Ekspor Dokumen">
                ${icon('download')} <span class="rm-hide-mobile">Ekspor</span>
              </button>
              <div id="rm-export-popover" style="display:none;position:absolute;right:0;top:100%;margin-top:6px;min-width:180px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:var(--shadow-float);padding:4px;z-index:50;">
                <button class="rm-btn rm-btn-ghost" id="rm-export-md-btn" style="width:100%;justify-content:flex-start;font-size:13px;height:32px;padding:0 8px;">
                  ${icon('note', 'style="width:14px;height:14px;margin-right:6px;"')} Unduh Markdown (.md)
                </button>
                <button class="rm-btn rm-btn-ghost" id="rm-export-pdf-btn" style="width:100%;justify-content:flex-start;font-size:13px;height:32px;padding:0 8px;">
                  ${icon('book', 'style="width:14px;height:14px;margin-right:6px;"')} Cetak / Simpan PDF
                </button>
              </div>
            </div>

            <button class="rm-btn rm-btn-ghost" id="rm-btn-writer-save-manual" title="Simpan Dokumen">
              ${icon('check')} <span class="rm-hide-mobile">Simpan</span>
            </button>

            <a href="#/read/${docId}" class="rm-btn rm-btn-primary" id="rm-btn-to-reader" title="Buka di Reader dengan suara TTS dan Anotasi">
              ${icon('book')} Baca di Reader
            </a>
          </div>
        </header>

        <!-- TOOLBAR FORMATTING LENGKAP -->
        <div class="rm-writer-toolbar">
          <!-- Text Type / Headings -->
          <div class="rm-writer-toolbar-group">
            <select class="rm-writer-select" id="rm-writer-format-block" title="Gaya Teks">
              <option value="p">Paragraf Normal</option>
              <option value="h1">Heading 1 (Judul Bab)</option>
              <option value="h2">Heading 2 (Sub-bab)</option>
              <option value="h3">Heading 3 (Poin Penting)</option>
              <option value="blockquote">Kutipan / Quote</option>
            </select>
          </div>

          <span class="rm-writer-sep"></span>

          <!-- Inline Formatting -->
          <div class="rm-writer-toolbar-group">
            <button class="rm-writer-tool-btn" data-cmd="bold" title="Tebal (Ctrl+B)"><b>B</b></button>
            <button class="rm-writer-tool-btn" data-cmd="italic" title="Miring (Ctrl+I)"><i>I</i></button>
            <button class="rm-writer-tool-btn" data-cmd="underline" title="Garis Bawah (Ctrl+U)"><u>U</u></button>
            <button class="rm-writer-tool-btn" data-cmd="strikeThrough" title="Coret Teks"><s>S</s></button>
            <button class="rm-writer-tool-btn" id="rm-cmd-code-inline" title="Kode Singkat (Inline Code)">&lt;/&gt;</button>
          </div>

          <span class="rm-writer-sep"></span>

          <!-- Colors & Highlight -->
          <div class="rm-writer-toolbar-group">
            <label class="rm-writer-tool-btn" title="Warna Huruf" style="position:relative;cursor:pointer;">
              <span style="font-weight:bold;color:#0066cc;">A</span>
              <input type="color" id="rm-picker-color" value="#111827" style="position:absolute;opacity:0;width:100%;height:100%;cursor:pointer;">
            </label>
            <label class="rm-writer-tool-btn" title="Warna Stabilo / Sorotan" style="position:relative;cursor:pointer;">
              <span style="background:#ffeb3b;padding:0 4px;border-radius:2px;color:#000;font-size:11px;font-weight:bold;">HL</span>
              <input type="color" id="rm-picker-hilite" value="#fff59d" style="position:absolute;opacity:0;width:100%;height:100%;cursor:pointer;">
            </label>
          </div>

          <span class="rm-writer-sep"></span>

          <!-- Alignment -->
          <div class="rm-writer-toolbar-group">
            <button class="rm-writer-tool-btn" data-cmd="justifyLeft" title="Rata Kiri">${icon('align-left')}</button>
            <button class="rm-writer-tool-btn" data-cmd="justifyCenter" title="Rata Tengah">${icon('align-center')}</button>
            <button class="rm-writer-tool-btn" data-cmd="justifyRight" title="Rata Kanan">${icon('align-right')}</button>
            <button class="rm-writer-tool-btn" data-cmd="justifyFull" title="Rata Kanan-Kiri">${icon('align-justify')}</button>
          </div>

          <span class="rm-writer-sep"></span>

          <!-- Lists & Elements -->
          <div class="rm-writer-toolbar-group">
            <button class="rm-writer-tool-btn" data-cmd="insertUnorderedList" title="Daftar Butir (Bullet List)">• List</button>
            <button class="rm-writer-tool-btn" data-cmd="insertOrderedList" title="Daftar Angka (Numbered List)">1. List</button>
            <button class="rm-writer-tool-btn" id="rm-cmd-task-list" title="Daftar Tugas (Checklist)">☑ Tugas</button>
            <button class="rm-writer-tool-btn" data-cmd="insertHorizontalRule" title="Garis Pembatas">—</button>
          </div>

          <span class="rm-writer-sep"></span>

          <!-- Insert Rich Elements -->
          <div class="rm-writer-toolbar-group">
            <button class="rm-writer-tool-btn" id="rm-cmd-insert-table" title="Sisipkan Tabel">${icon('table')}</button>
            <label class="rm-writer-tool-btn" title="Sisipkan Gambar" style="cursor:pointer;">
              ${icon('image')}
              <input type="file" id="rm-writer-img-file" accept="image/*" style="display:none;">
            </label>
            <button class="rm-writer-tool-btn" id="rm-cmd-insert-link" title="Sisipkan Tautan (Link)">${icon('link')}</button>
            <button class="rm-writer-tool-btn" id="rm-cmd-insert-codeblock" title="Blok Kode Program">${icon('code')}</button>
            <button class="rm-writer-tool-btn" id="rm-cmd-insert-formula" title="Rumus Matematika (KaTeX)">${icon('formula')}</button>
          </div>

          <span class="rm-writer-sep"></span>

          <!-- Undo / Redo -->
          <div class="rm-writer-toolbar-group">
            <button class="rm-writer-tool-btn" data-cmd="undo" title="Urungkan (Ctrl+Z)">↶</button>
            <button class="rm-writer-tool-btn" data-cmd="redo" title="Ulangi (Ctrl+Y)">↷</button>
          </div>
        </div>

        <!-- AREA KERTAS MENULIS -->
        <div class="rm-writer-body">
          <div class="rm-writer-paper">
            <!-- Judul Dokumen -->
            <input type="text" id="rm-writer-title" class="rm-writer-title-input" placeholder="Judul Dokumen..." value="${initialTitle}">

            <!-- Kategori / Mata Kuliah -->
            <div class="rm-writer-meta-bar">
              <span style="font-size:12.5px;color:var(--ink-muted);">Kategori / Mata Kuliah:</span>
              <input type="text" id="rm-writer-course" class="rm-writer-course-input" placeholder="Umum" value="${initialCourse}">
            </div>

            <!-- Kanvas Tulis WYSIWYG -->
            <div id="rm-writer-canvas" class="rm-writer-canvas" contenteditable="true" spellcheck="true" placeholder="Mulai menulis dokumen di sini…">
              ${initialHtml}
            </div>
          </div>

          <!-- STATUS BAR BAWAH -->
          <footer class="rm-writer-footer-bar">
            <div id="rm-writer-counts">0 kata · 0 karakter · ~1 menit baca</div>
            <div>Format Dokumen Standar Rak Modul</div>
          </footer>
        </div>
      </div>
    `;

    bindEvents();
    updateWordCounts();
  }

  function bindEvents() {
    const canvas = container.querySelector('#rm-writer-canvas');
    const titleInput = container.querySelector('#rm-writer-title');
    const courseInput = container.querySelector('#rm-writer-course');
    const statusEl = container.querySelector('#rm-writer-status');
    const exportBtn = container.querySelector('#rm-btn-writer-export');
    const exportPopover = container.querySelector('#rm-export-popover');
    const exportMdBtn = container.querySelector('#rm-export-md-btn');
    const exportPdfBtn = container.querySelector('#rm-export-pdf-btn');
    const saveManualBtn = container.querySelector('#rm-btn-writer-save-manual');

    // 1. Trigger Autosave saat mengetik
    const scheduleAutosave = () => {
      statusEl.innerHTML = `<span style="color:#eab308;">●</span> Menyimpan…`;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveDocument(false);
      }, 1200);
      updateWordCounts();
    };

    canvas.addEventListener('input', scheduleAutosave);
    titleInput.addEventListener('input', scheduleAutosave);
    courseInput.addEventListener('input', scheduleAutosave);

    // 2. Toolbar Formatting Buttons
    container.querySelectorAll('.rm-writer-tool-btn[data-cmd]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const cmd = btn.dataset.cmd;
        document.execCommand(cmd, false, null);
        canvas.focus();
        scheduleAutosave();
      });
    });

    // Format Block (H1, H2, H3, p, blockquote)
    const formatSelect = container.querySelector('#rm-writer-format-block');
    if (formatSelect) {
      formatSelect.addEventListener('change', () => {
        const val = formatSelect.value;
        document.execCommand('formatBlock', false, val);
        canvas.focus();
        scheduleAutosave();
      });
    }

    // Colors
    const colorPicker = container.querySelector('#rm-picker-color');
    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        document.execCommand('foreColor', false, e.target.value);
        canvas.focus();
        scheduleAutosave();
      });
    }

    const hilitePicker = container.querySelector('#rm-picker-hilite');
    if (hilitePicker) {
      hilitePicker.addEventListener('input', (e) => {
        document.execCommand('hiliteColor', false, e.target.value);
        canvas.focus();
        scheduleAutosave();
      });
    }

    // Inline Code
    const codeBtn = container.querySelector('#rm-cmd-code-inline');
    if (codeBtn) {
      codeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const codeEl = document.createElement('code');
          codeEl.textContent = range.toString() || 'kode';
          range.deleteContents();
          range.insertNode(codeEl);
          scheduleAutosave();
        }
      });
    }

    // Task List / Checklist
    const taskBtn = container.querySelector('#rm-cmd-task-list');
    if (taskBtn) {
      taskBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const taskHtml = `
          <div class="rm-task-item">
            <input type="checkbox">
            <span contenteditable="true">Poin target baru</span>
          </div>
          <p><br></p>
        `;
        document.execCommand('insertHTML', false, taskHtml);
        scheduleAutosave();
      });
    }

    // Insert Table
    const tableBtn = container.querySelector('#rm-cmd-insert-table');
    if (tableBtn) {
      tableBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const rows = prompt('Jumlah baris tabel:', '3');
        const cols = prompt('Jumlah kolom tabel:', '3');
        const rCount = parseInt(rows, 10);
        const cCount = parseInt(cols, 10);

        if (rCount > 0 && cCount > 0) {
          let tblHtml = '<table><thead><tr>';
          for (let c = 0; c < cCount; c++) {
            tblHtml += `<th>Kolom ${c + 1}</th>`;
          }
          tblHtml += '</tr></thead><tbody>';
          for (let r = 0; r < rCount - 1; r++) {
            tblHtml += '<tr>';
            for (let c = 0; c < cCount; c++) {
              tblHtml += '<td>Teks sel</td>';
            }
            tblHtml += '</tr>';
          }
          tblHtml += '</tbody></table><p><br></p>';
          document.execCommand('insertHTML', false, tblHtml);
          scheduleAutosave();
        }
      });
    }

    // Insert Image
    const imgFileInput = container.querySelector('#rm-writer-img-file');
    if (imgFileInput) {
      imgFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (re) => {
            const imgHtml = `<p><img src="${re.target.result}" alt="Gambar Dokumen" style="max-width:100%;border-radius:6px;"></p><p><br></p>`;
            document.execCommand('insertHTML', false, imgHtml);
            scheduleAutosave();
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Insert Link
    const linkBtn = container.querySelector('#rm-cmd-insert-link');
    if (linkBtn) {
      linkBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const url = prompt('Masukkan URL tautan:', 'https://');
        if (url) {
          document.execCommand('createLink', false, url);
          scheduleAutosave();
        }
      });
    }

    // Insert Code Block
    const codeBlockBtn = container.querySelector('#rm-cmd-insert-codeblock');
    if (codeBlockBtn) {
      codeBlockBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const codeBlockHtml = `<pre><code># Tulis kode program di sini\ndef contoh():\n    return True</code></pre><p><br></p>`;
        document.execCommand('insertHTML', false, codeBlockHtml);
        scheduleAutosave();
      });
    }

    // Insert Formula (KaTeX)
    const formulaBtn = container.querySelector('#rm-cmd-insert-formula');
    if (formulaBtn) {
      formulaBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const tex = prompt('Masukkan rumus matematika LaTeX (misal: \\sum_{i=1}^n x_i atau E = mc^2):', 'E = mc^2');
        if (tex) {
          try {
            const rendered = katex.renderToString(tex, { throwOnError: false });
            const formulaHtml = `<span class="rm-formula" contenteditable="false" data-tex="${tex}" style="display:inline-block;padding:2px 6px;margin:0 2px;background:var(--surface-sunken);border:1px solid var(--line);border-radius:4px;">${rendered}</span> `;
            document.execCommand('insertHTML', false, formulaHtml);
            scheduleAutosave();
          } catch (err) {
            alert('Gagal merender rumus LaTeX: ' + err.message);
          }
        }
      });
    }

    // Manual Save
    if (saveManualBtn) {
      saveManualBtn.addEventListener('click', () => {
        saveDocument(true);
      });
    }

    // Export Popover
    if (exportBtn && exportPopover) {
      exportBtn.addEventListener('click', () => {
        exportPopover.style.display = exportPopover.style.display === 'none' ? 'block' : 'none';
      });

      document.addEventListener('click', (e) => {
        if (!exportBtn.contains(e.target) && !exportPopover.contains(e.target)) {
          exportPopover.style.display = 'none';
        }
      });
    }

    // Export Markdown
    if (exportMdBtn) {
      exportMdBtn.addEventListener('click', () => {
        if (exportPopover) exportPopover.style.display = 'none';
        const title = (titleInput.value || 'Dokumen').trim();
        const html = canvas.innerHTML;
        // Simple HTML to markdown conversion for title and text
        const plainText = canvas.innerText;
        const mdContent = `# ${title}\n\n*Kategori: ${courseInput.value || 'Umum'}*\n\n---\n\n${plainText}`;
        const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${title.replace(/[^a-zA-Z0-9_\-]/g, '_')}.md`;
        a.click();
        showToast('Dokumen diekspor ke Markdown (.md)');
      });
    }

    // Export PDF (Print dialog)
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => {
        if (exportPopover) exportPopover.style.display = 'none';
        window.print();
      });
    }
  }

  function updateWordCounts() {
    const canvas = container.querySelector('#rm-writer-canvas');
    const countsEl = container.querySelector('#rm-writer-counts');
    if (!canvas || !countsEl) return;

    const text = canvas.innerText.trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;
    const readMinutes = Math.max(1, Math.round(words / 200));

    countsEl.textContent = `${words.toLocaleString()} kata · ${chars.toLocaleString()} karakter · ~${readMinutes} menit baca`;
  }

  async function saveDocument(isManual = false) {
    if (isSaving) return;
    isSaving = true;

    const titleInput = container.querySelector('#rm-writer-title');
    const courseInput = container.querySelector('#rm-writer-course');
    const canvas = container.querySelector('#rm-writer-canvas');
    const statusEl = container.querySelector('#rm-writer-status');

    if (!titleInput || !canvas) {
      isSaving = false;
      return;
    }

    const title = (titleInput.value || 'Dokumen Tanpa Judul').trim();
    const courseName = (courseInput?.value || 'Umum').trim();
    const htmlContent = canvas.innerHTML;

    // Buat HTML blob untuk penyimpanan berkas
    const htmlBlob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });

    // Hitung halaman dan bagi teks per halaman untuk Reader View
    const plainText = canvas.innerText.trim();
    const words = plainText ? plainText.split(/\s+/) : [];
    const WORDS_PER_PAGE = 300;
    const totalPages = Math.max(1, Math.ceil(words.length / WORDS_PER_PAGE));

    const pageRecords = [];
    for (let p = 0; p < totalPages; p++) {
      const start = p * WORDS_PER_PAGE;
      const end = Math.min(start + WORDS_PER_PAGE, words.length);
      const pageText = words.slice(start, end).join(' ');
      pageRecords.push({
        document_id: docId,
        page_no: p + 1,
        text: pageText
      });
    }

    function generateDocCoverThumbnail(title, courseName) {
      try {
        const c = document.createElement('canvas');
        c.width = 320;
        c.height = 440;
        const ctx = c.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 320, 440);
        grad.addColorStop(0, '#1e293b');
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 320, 440);

        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(20, 24, 4, 392);

        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.fillRect(36, 36, 52, 24);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('DOC', 48, 52);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px sans-serif';
        ctx.fillText((courseName || 'UMUM').toUpperCase(), 36, 90);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 20px sans-serif';
        const words = (title || 'Dokumen').split(' ');
        let line = '';
        let y = 130;
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > 240 && n > 0) {
            ctx.fillText(line, 36, y);
            line = words[n] + ' ';
            y += 28;
            if (y > 320) break;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, 36, y);

        ctx.fillStyle = '#64748b';
        ctx.font = '11px sans-serif';
        ctx.fillText('Rak Modul · Catatan', 36, 400);

        return c.toDataURL('image/jpeg', 0.85);
      } catch (_) {
        return null;
      }
    }

    const docRecord = {
      id: docId,
      title,
      source_type: 'doc',
      course_name: courseName,
      page_count: totalPages,
      thumb_data: doc?.thumb_data || generateDocCoverThumbnail(title, courseName),
      status: 'ready',
      created_at: doc?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      await saveLocalDocument(docRecord, htmlBlob);
      await saveLocalPages(pageRecords);
      doc = docRecord;
      lastSavedHtml = htmlContent;

      if (statusEl) {
        statusEl.innerHTML = `<span style="color:#28a745;">●</span> Tersimpan di Cloud`;
      }
      if (isManual) {
        showToast('Dokumen berhasil disimpan ke Cloud Database');
      }
    } catch (err) {
      console.error('Gagal simpan dokumen:', err);
      if (statusEl) {
        statusEl.innerHTML = `<span style="color:var(--correction);">●</span> Gagal simpan: ${err.message}`;
      }
    } finally {
      isSaving = false;
    }
  }

  init();

  return () => {
    clearTimeout(saveTimer);
  };
}
