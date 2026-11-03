// Halaman Kode Bank (Bank Kode Format Google Colab / Jupyter Notebook)
import { 
  getAllCodeNotebooks, 
  getCodeNotebook, 
  saveCodeNotebook, 
  deleteCodeNotebook, 
  seedSampleCodeNotebooksIfEmpty 
} from '../data/local-db.js';
import { icon } from '../ui/icons.js';
import { marked } from 'marked';
import { createCodeEditor } from '../ui/code-editor.js';

export function CodeBankPage({ container, router }) {
  let notebooks = [];
  let activeNotebookId = null;
  let activeNotebook = null;
  let searchQuery = '';
  let selectedCourse = 'all';
  let editingCellIds = new Set(); // cells in edit mode (markdown)

  // Inisialisasi data
  async function init() {
    notebooks = await seedSampleCodeNotebooksIfEmpty();
    if (!notebooks || notebooks.length === 0) {
      notebooks = await getAllCodeNotebooks();
    }
    
    // Pilih notebook pertama secara default jika ada
    if (notebooks.length > 0) {
      activeNotebookId = notebooks[0].id;
      activeNotebook = notebooks[0];
    }
    render();
  }

  // Refresh data dari database
  async function refreshData(preserveActiveId = null) {
    notebooks = await getAllCodeNotebooks();
    if (preserveActiveId && notebooks.some(n => n.id === preserveActiveId)) {
      activeNotebookId = preserveActiveId;
      activeNotebook = notebooks.find(n => n.id === preserveActiveId);
    } else if (notebooks.length > 0) {
      activeNotebookId = notebooks[0].id;
      activeNotebook = notebooks[0];
    } else {
      activeNotebookId = null;
      activeNotebook = null;
    }
    render();
  }

  // Generate nomor baris untuk gutter
  function generateGutter(text) {
    const lines = (text || '').split('\n').length;
    const nums = [];
    for (let i = 1; i <= Math.max(1, lines); i++) {
      nums.push(i);
    }
    return nums.join('\n');
  }

  // Ekspor ke format Google Colab / Jupyter Notebook (.ipynb v4)
  function exportToIpynb(nb) {
    if (!nb) return;
    const ipynbData = {
      nbformat: 4,
      nbformat_minor: 2,
      metadata: {
        colab: {
          name: nb.title,
          provenance: []
        },
        kernelspec: {
          display_name: nb.language === 'python' ? 'Python 3' : nb.language.toUpperCase(),
          name: nb.language === 'python' ? 'python3' : nb.language
        },
        language_info: {
          name: nb.language || 'python'
        }
      },
      cells: (nb.cells || []).map(cell => {
        if (cell.type === 'markdown') {
          return {
            cell_type: 'markdown',
            metadata: {},
            source: cell.content ? cell.content.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l) : []
          };
        } else {
          const outputs = [];
          if (cell.output_note && cell.output_note.trim()) {
            outputs.push({
              name: 'stdout',
              output_type: 'stream',
              text: cell.output_note.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l)
            });
          }
          return {
            cell_type: 'code',
            execution_count: null,
            metadata: {},
            outputs: outputs,
            source: cell.content ? cell.content.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l) : []
          };
        }
      })
    };

    const jsonStr = JSON.stringify(ipynbData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/x-ipynb+json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(nb.title || 'notebook').replace(/[^a-zA-Z0-9_-]/g, '_')}.ipynb`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Ekspor ke Markdown (.md) untuk Obsidian / catatan belajar
  function exportToMarkdown(nb) {
    if (!nb) return;
    let md = `# ${nb.title}\n\n`;
    md += `> **Mata Kuliah:** ${nb.course_name || 'Umum'} | **Bahasa:** ${nb.language || 'python'}\n`;
    if (nb.tags && nb.tags.length > 0) {
      md += `> **Tags:** ${nb.tags.map(t => '#' + t).join(' ')}\n`;
    }
    md += `\n---\n\n`;

    (nb.cells || []).forEach((c, idx) => {
      if (c.type === 'markdown') {
        md += `${c.content || ''}\n\n`;
      } else {
        md += `\`\`\`${c.language || nb.language || 'python'}\n${c.content || ''}\n\`\`\`\n\n`;
        if (c.output_note && c.output_note.trim()) {
          md += `*Output / Penjelasan Logika:*\n\`\`\`\n${c.output_note}\n\`\`\`\n\n`;
        }
      }
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(nb.title || 'catatan_kode').replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Salin seluruh isi kode notebook
  function copyAllCode(nb, btn) {
    if (!nb || !nb.cells) return;
    const allCode = nb.cells
      .filter(c => c.type === 'code' && c.content)
      .map(c => `# [${c.language || 'code'}]\n${c.content}`)
      .join('\n\n# ----------------------------------------\n\n');

    navigator.clipboard.writeText(allCode).then(() => {
      const orig = btn.innerHTML;
      btn.innerHTML = `${icon('check')} Tersalin!`;
      setTimeout(() => { btn.innerHTML = orig; }, 1500);
    });
  }

  // Render halaman utama
  function render() {
    // Kumpulkan mata kuliah unik untuk filter
    const courses = Array.from(new Set(notebooks.map(n => n.course_name).filter(Boolean)));

    // Filter daftar notebook
    const filteredNotebooks = notebooks.filter(n => {
      const matchCourse = selectedCourse === 'all' || n.course_name === selectedCourse;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || 
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.course_name && n.course_name.toLowerCase().includes(q)) ||
        (n.tags && n.tags.some(t => t.toLowerCase().includes(q))) ||
        (n.cells && n.cells.some(c => c.content && c.content.toLowerCase().includes(q)));
      return matchCourse && matchQuery;
    });

    container.innerHTML = `
      <header class="rm-navbar">
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          <a href="#/" class="rm-btn rm-btn-ghost rm-btn-icon" aria-label="Kembali ke rak">
            ${icon('back')}
          </a>
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            <span style="color:var(--pen);">${icon('code', 'style="width:20px;height:20px;"')}</span>
            <span style="font-weight:600;font-size:17px;">Kode Bank</span>
          </div>
          <span class="rm-badge" style="background:var(--pen-soft);color:var(--pen);font-size:11px;font-weight:600;">
            Format Colab
          </span>
        </div>
        <div class="rm-nav-actions" style="display:flex;align-items:center;gap:var(--space-2);">
          <button id="rm-btn-new-nb" class="rm-btn rm-btn-primary" style="height:34px;">
            ${icon('plus')} Notebook Baru
          </button>
        </div>
      </header>

      <div class="rm-codebank-layout">
        <!-- SIDEBAR: DAFTAR NOTEBOOK -->
        <aside class="rm-codebank-sidebar">
          <div style="display:flex;flex-direction:column;gap:var(--space-2);">
            <div style="position:relative;">
              <input 
                id="rm-nb-search" 
                type="search" 
                class="rm-input" 
                placeholder="Cari kode, judul, atau tag..." 
                value="${searchQuery}" 
                style="padding-left:32px;font-size:13px;height:34px;width:100%;"
              />
              <span style="position:absolute;left:10px;top:8px;color:var(--ink-muted);pointer-events:none;">
                ${icon('search', 'style="width:16px;height:16px;"')}
              </span>
            </div>

            ${courses.length > 0 ? `
              <select id="rm-nb-course-filter" class="rm-input" style="font-size:12px;height:32px;padding:2px 8px;">
                <option value="all" ${selectedCourse === 'all' ? 'selected' : ''}>Semua Mata Kuliah (${notebooks.length})</option>
                ${courses.map(c => `
                  <option value="${c}" ${selectedCourse === c ? 'selected' : ''}>${c}</option>
                `).join('')}
              </select>
            ` : ''}
          </div>

          <div style="display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-2);">
            ${filteredNotebooks.length === 0 ? `
              <div style="text-align:center;padding:var(--space-6) 0;color:var(--ink-muted);font-size:13px;">
                Tidak ada notebook ditemukan.
              </div>
            ` : filteredNotebooks.map(nb => {
              const isActive = nb.id === activeNotebookId;
              const codeCount = (nb.cells || []).filter(c => c.type === 'code').length;
              const textCount = (nb.cells || []).filter(c => c.type === 'markdown').length;
              return `
                <div 
                  class="rm-card rm-nb-item ${isActive ? 'rm-colab-active' : ''}" 
                  data-nb-id="${nb.id}"
                  style="cursor:pointer;padding:var(--space-3);border-radius:var(--radius-md);border:1px solid ${isActive ? 'var(--pen)' : 'var(--line)'};background:${isActive ? 'var(--surface)' : 'var(--surface)'};transition:all 0.15s ease;"
                >
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-2);">
                    <b style="font-size:14px;color:var(--ink);line-height:18px;">${nb.title || 'Tanpa Judul'}</b>
                    <span class="rm-badge" style="font-size:10px;padding:1px 6px;text-transform:uppercase;background:var(--surface-sunken);color:var(--ink-muted);flex-shrink:0;">
                      ${nb.language || 'python'}
                    </span>
                  </div>
                  <div style="display:flex;align-items:center;gap:var(--space-2);margin-top:6px;font-size:12px;color:var(--ink-muted);">
                    <span>${nb.course_name || 'Umum'}</span>
                    <span>•</span>
                    <span>${codeCount} kode, ${textCount} teks</span>
                  </div>
                  ${nb.tags && nb.tags.length > 0 ? `
                    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">
                      ${nb.tags.slice(0, 3).map(t => `
                        <span style="font-size:10px;color:var(--pen);background:var(--pen-soft);padding:1px 6px;border-radius:10px;">#${t}</span>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </aside>

        <!-- MAIN: AREA WORKSPACE NOTEBOOK (GOOGLE COLAB VIEW) -->
        <main class="rm-codebank-main">
          ${activeNotebook ? renderNotebookWorkspace(activeNotebook) : `
            <div style="text-align:center;padding:var(--space-12) 0;color:var(--ink-muted);">
              <h3>Pilih notebook dari daftar di sebelah kiri atau buat baru</h3>
            </div>
          `}
        </main>
      </div>

      <!-- MODAL BUAT NOTEBOOK BARU -->
      <div id="rm-modal-new-nb" class="rm-modal-backdrop" style="display:none;">
        <div class="rm-modal" style="max-width:440px;">
          <div class="rm-modal-header">
            <h3 class="rm-modal-title">Buat Notebook Baru</h3>
            <button id="rm-btn-close-modal" class="rm-colab-btn-icon">${icon('close')}</button>
          </div>
          <div class="rm-modal-body" style="display:flex;flex-direction:column;gap:var(--space-3);">
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Judul Notebook</label>
              <input id="rm-inp-nb-title" type="text" class="rm-input" placeholder="Contoh: Regresi Linier & Evaluasi MSE" style="width:100%;" />
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Mata Kuliah / Kategori</label>
              <input id="rm-inp-nb-course" type="text" class="rm-input" placeholder="Contoh: Machine Learning" style="width:100%;" />
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Bahasa Utama</label>
              <select id="rm-inp-nb-lang" class="rm-input" style="width:100%;">
                <option value="python">Python</option>
                <option value="sql">SQL</option>
                <option value="javascript">JavaScript</option>
                <option value="r">R</option>
                <option value="html">HTML / CSS</option>
                <option value="bash">Bash / Shell</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
              </select>
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Tags (pisahkan koma)</label>
              <input id="rm-inp-nb-tags" type="text" class="rm-input" placeholder="numpy, sklearn, linear-regression" style="width:100%;" />
            </div>
          </div>
          <div class="rm-modal-footer">
            <button id="rm-btn-cancel-modal" class="rm-btn rm-btn-ghost">Batal</button>
            <button id="rm-btn-submit-modal" class="rm-btn rm-btn-primary">Buat Notebook</button>
          </div>
        </div>
      </div>
    `;

    attachEvents();
  }

  // Render area kerja notebook
  function renderNotebookWorkspace(nb) {
    const cells = nb.cells || [];

    return `
      <div class="rm-codebank-header">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-4);flex-wrap:wrap;">
          <div style="flex:1;min-width:240px;">
            <input 
              id="rm-nb-title-input" 
              class="rm-codebank-nb-title" 
              value="${nb.title || 'Tanpa Judul'}" 
              title="Klik untuk mengubah judul notebook"
            />
            <div style="display:flex;align-items:center;gap:var(--space-2);margin-top:4px;flex-wrap:wrap;">
              <span class="rm-badge" style="background:var(--surface-sunken);color:var(--ink);font-size:12px;">
                ${nb.course_name || 'Umum'}
              </span>
              <span class="rm-badge" style="background:var(--pen-soft);color:var(--pen);font-size:12px;font-weight:600;text-transform:uppercase;">
                ${nb.language || 'python'}
              </span>
              ${(nb.tags || []).map(t => `
                <span style="font-size:11px;color:var(--ink-muted);background:var(--paper);border:1px solid var(--line);padding:1px 6px;border-radius:10px;">#${t}</span>
              `).join('')}
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;">
            <button id="rm-btn-top-add-text" class="rm-btn rm-btn-ghost" style="height:32px;font-size:12px;">
              ${icon('plus')} Teks
            </button>
            <button id="rm-btn-top-add-code" class="rm-btn rm-btn-ghost" style="height:32px;font-size:12px;">
              ${icon('plus')} Kode
            </button>
            <button id="rm-btn-copy-all" class="rm-btn rm-btn-ghost" style="height:32px;font-size:12px;" title="Salin seluruh kode">
              ${icon('copy')} Salin Semua
            </button>
            <button id="rm-btn-export-ipynb" class="rm-btn rm-btn-primary" style="height:32px;font-size:12px;" title="Unduh format Google Colab / Jupyter">
              ${icon('download')} Unduh .ipynb
            </button>
            <button id="rm-btn-export-md" class="rm-btn rm-btn-ghost" style="height:32px;font-size:12px;" title="Unduh format Markdown">
              ${icon('download')} .md
            </button>
            <button id="rm-btn-delete-nb" class="rm-colab-btn-icon rm-danger" title="Hapus Notebook Ini">
              ${icon('trash')}
            </button>
          </div>
        </div>
      </div>

      <!-- DAFTAR SEL (CELLS) -->
      <div class="rm-colab-cells-container">
        <!-- Divider Sel Paling Atas -->
        ${renderDivider(-1)}

        ${cells.length === 0 ? `
          <div style="text-align:center;padding:var(--space-8);background:var(--surface);border:1px dashed var(--line);border-radius:var(--radius-md);color:var(--ink-muted);">
            <p style="margin:0 0 var(--space-3) 0;">Notebook ini masih kosong. Klik tombol di bawah untuk menambahkan sel pertama.</p>
            <div style="display:inline-flex;gap:var(--space-2);">
              <button class="rm-btn rm-btn-primary rm-btn-add-cell" data-type="markdown" data-index="-1">${icon('plus')} Tambah Teks (Markdown)</button>
              <button class="rm-btn rm-btn-primary rm-btn-add-cell" data-type="code" data-index="-1">${icon('plus')} Tambah Kode</button>
            </div>
          </div>
        ` : cells.map((cell, idx) => `
          ${renderCell(cell, idx, cells.length, nb)}
          ${renderDivider(idx)}
        `).join('')}
      </div>
    `;
  }

  // Render Divider Colab (+ Kode / + Teks)
  function renderDivider(afterIndex) {
    return `
      <div class="rm-colab-divider">
        <div class="rm-colab-divider-actions">
          <button class="rm-colab-add-btn rm-btn-add-cell" data-type="code" data-index="${afterIndex}" title="Tambah Sel Kode di posisi ini">
            ${icon('code', 'style="width:14px;height:14px;"')} + Kode
          </button>
          <button class="rm-colab-add-btn rm-btn-add-cell" data-type="markdown" data-index="${afterIndex}" title="Tambah Sel Penjelasan Teks di posisi ini">
            ${icon('note', 'style="width:14px;height:14px;"')} + Teks
          </button>
        </div>
      </div>
    `;
  }

  // Render satu sel (Markdown atau Kode)
  function renderCell(cell, idx, total, nb) {
    if (cell.type === 'markdown') {
      const isEditing = editingCellIds.has(cell.id);
      let renderedHtml = '';
      try {
        renderedHtml = marked.parse(cell.content || '*Klik tombol edit atau klik dua kali untuk menulis penjelasan...*');
      } catch (err) {
        renderedHtml = cell.content || '';
      }

      return `
        <div class="rm-colab-cell rm-colab-cell-markdown" data-cell-id="${cell.id}">
          <div class="rm-colab-cell-header">
            <span class="rm-colab-cell-badge">
              <span style="color:var(--ink-muted);">${icon('note', 'style="width:15px;height:15px;"')}</span>
              <span>Teks / Penjelasan [${idx + 1}]</span>
            </span>
            <div class="rm-colab-cell-actions">
              <button class="rm-colab-btn-icon rm-btn-toggle-edit" data-cell-id="${cell.id}" title="${isEditing ? 'Selesai Edit' : 'Edit Teks'}">
                ${isEditing ? icon('check') : icon('pen')}
              </button>
              <button class="rm-colab-btn-icon rm-btn-move-cell" data-cell-id="${cell.id}" data-dir="-1" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''} title="Pindah ke Atas">
                ${icon('arrow-up')}
              </button>
              <button class="rm-colab-btn-icon rm-btn-move-cell" data-cell-id="${cell.id}" data-dir="1" ${idx === total - 1 ? 'disabled style="opacity:0.3;"' : ''} title="Pindah ke Bawah">
                ${icon('arrow-down')}
              </button>
              <button class="rm-colab-btn-icon rm-danger rm-btn-del-cell" data-cell-id="${cell.id}" title="Hapus Sel Ini">
                ${icon('trash')}
              </button>
            </div>
          </div>

          ${isEditing ? `
            <div style="padding:var(--space-2);background:var(--surface);">
              <textarea 
                class="rm-colab-md-input rm-cell-md-input" 
                data-cell-id="${cell.id}" 
                placeholder="Tulis penjelasan dengan format Markdown (# Judul, **tebal**, rumus KaTeX, link, dll.)..."
              >${cell.content || ''}</textarea>
              <div style="display:flex;justify-content:flex-end;padding:var(--space-2);">
                <button class="rm-btn rm-btn-primary rm-btn-toggle-edit" data-cell-id="${cell.id}" style="height:28px;font-size:12px;">
                  ${icon('check')} Selesai Edit
                </button>
              </div>
            </div>
          ` : `
            <div class="rm-colab-md-box rm-cell-md-view" data-cell-id="${cell.id}" title="Klik dua kali untuk mengedit teks">
              ${renderedHtml}
            </div>
          `}
        </div>
      `;
    } else {
      // Cell Kode
      const lang = cell.language || nb.language || 'python';

      return `
        <div class="rm-colab-cell rm-colab-cell-code" data-cell-id="${cell.id}">
          <div class="rm-colab-cell-header">
            <div style="display:flex;align-items:center;gap:var(--space-2);">
              <span class="rm-colab-cell-badge">
                <span style="color:var(--pen);">${icon('code', 'style="width:15px;height:15px;"')}</span>
                <span>[${idx + 1}]</span>
              </span>
              <select class="rm-input rm-cell-lang-select" data-cell-id="${cell.id}" style="font-size:11px;height:24px;padding:0 6px;text-transform:uppercase;background:var(--surface);border-color:var(--line);">
                <option value="python" ${lang === 'python' ? 'selected' : ''}>Python</option>
                <option value="sql" ${lang === 'sql' ? 'selected' : ''}>SQL</option>
                <option value="javascript" ${lang === 'javascript' ? 'selected' : ''}>JavaScript</option>
                <option value="r" ${lang === 'r' ? 'selected' : ''}>R</option>
                <option value="html" ${lang === 'html' ? 'selected' : ''}>HTML</option>
                <option value="bash" ${lang === 'bash' ? 'selected' : ''}>Bash</option>
                <option value="cpp" ${lang === 'cpp' ? 'selected' : ''}>C++</option>
                <option value="java" ${lang === 'java' ? 'selected' : ''}>Java</option>
              </select>
            </div>

            <div class="rm-colab-cell-actions">
              <button class="rm-btn rm-btn-ghost rm-btn-copy-code" data-cell-id="${cell.id}" style="height:24px;font-size:11px;padding:0 8px;" title="Salin cuplikan kode ini">
                ${icon('copy', 'style="width:13px;height:13px;"')} Salin
              </button>
              <button class="rm-colab-btn-icon rm-btn-move-cell" data-cell-id="${cell.id}" data-dir="-1" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''} title="Pindah ke Atas">
                ${icon('arrow-up')}
              </button>
              <button class="rm-colab-btn-icon rm-btn-move-cell" data-cell-id="${cell.id}" data-dir="1" ${idx === total - 1 ? 'disabled style="opacity:0.3;"' : ''} title="Pindah ke Bawah">
                ${icon('arrow-down')}
              </button>
              <button class="rm-colab-btn-icon rm-danger rm-btn-del-cell" data-cell-id="${cell.id}" title="Hapus Sel Ini">
                ${icon('trash')}
              </button>
            </div>
          </div>

          <!-- IDE Editor Container Mount -->
          <div class="rm-cell-ide-mount" data-cell-id="${cell.id}"></div>

          <!-- Output Note Box (Penjelasan Hasil Eksekusi / Logika Kode) -->
          <div class="rm-colab-output-box">
            <div class="rm-colab-output-label">
              <span>Output / Catatan Hasil Logika:</span>
            </div>
            <textarea 
              class="rm-colab-output-input rm-cell-output-input" 
              data-cell-id="${cell.id}" 
              rows="${cell.output_note ? Math.min(6, cell.output_note.split('\n').length + 1) : 2}" 
              placeholder="Tuliskan output yang diharapkan, contoh hasil console, atau penjelasan alur logika dari kode ini..."
            >${cell.output_note || ''}</textarea>
          </div>
        </div>
      `;
    }
  }

  // Pasang Event Listeners
  function attachEvents() {
    // 1. Pencarian notebook
    const searchInput = container.querySelector('#rm-nb-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        render();
      });
    }

    // 2. Filter mata kuliah
    const courseFilter = container.querySelector('#rm-nb-course-filter');
    if (courseFilter) {
      courseFilter.addEventListener('change', (e) => {
        selectedCourse = e.target.value;
        render();
      });
    }

    // 3. Klik kartu notebook di sidebar
    container.querySelectorAll('.rm-nb-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.nbId;
        if (id && id !== activeNotebookId) {
          activeNotebookId = id;
          activeNotebook = notebooks.find(n => n.id === id);
          editingCellIds.clear();
          render();
        }
      });
    });

    // 4. Modal Buat Notebook Baru
    const newNbBtn = container.querySelector('#rm-btn-new-nb');
    const modal = container.querySelector('#rm-modal-new-nb');
    const closeModalBtn = container.querySelector('#rm-btn-close-modal');
    const cancelModalBtn = container.querySelector('#rm-btn-cancel-modal');
    const submitModalBtn = container.querySelector('#rm-btn-submit-modal');

    function openModal() {
      if (modal) modal.style.display = 'flex';
      const inp = container.querySelector('#rm-inp-nb-title');
      if (inp) inp.focus();
    }
    function closeModal() {
      if (modal) modal.style.display = 'none';
    }

    if (newNbBtn) newNbBtn.addEventListener('click', openModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

    if (submitModalBtn) {
      submitModalBtn.addEventListener('click', async () => {
        const titleInp = container.querySelector('#rm-inp-nb-title');
        const courseInp = container.querySelector('#rm-inp-nb-course');
        const langInp = container.querySelector('#rm-inp-nb-lang');
        const tagsInp = container.querySelector('#rm-inp-nb-tags');

        const title = (titleInp?.value || '').trim() || 'Notebook Baru';
        const course = (courseInp?.value || '').trim() || 'Umum';
        const lang = langInp?.value || 'python';
        const tags = (tagsInp?.value || '')
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);

        const newNb = {
          id: 'nb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          title,
          course_name: course,
          language: lang,
          tags,
          cells: [
            {
              id: 'c_' + Date.now() + '_1',
              type: 'markdown',
              content: `## ${title}\nPenjelasan materi dan implementasi kode untuk mata kuliah ${course}.`
            },
            {
              id: 'c_' + Date.now() + '_2',
              type: 'code',
              language: lang,
              content: lang === 'python' ? '# Tulis kode Python Anda di sini\nimport os\nprint("Halo dari Kode Bank!")' : '// Tulis kode Anda di sini\n',
              output_note: ''
            }
          ]
        };

        await saveCodeNotebook(newNb);
        closeModal();
        await refreshData(newNb.id);
      });
    }

    if (!activeNotebook) return;

    // 5. Ubah Judul Notebook
    const titleInput = container.querySelector('#rm-nb-title-input');
    if (titleInput) {
      titleInput.addEventListener('change', async (e) => {
        const newTitle = e.target.value.trim() || 'Tanpa Judul';
        activeNotebook.title = newTitle;
        await saveCodeNotebook(activeNotebook);
        // Refresh sidebar
        notebooks = await getAllCodeNotebooks();
        render();
      });
    }

    // 6. Ekspor Colab (.ipynb) & Markdown (.md)
    const exportIpynbBtn = container.querySelector('#rm-btn-export-ipynb');
    if (exportIpynbBtn) {
      exportIpynbBtn.addEventListener('click', () => exportToIpynb(activeNotebook));
    }
    const exportMdBtn = container.querySelector('#rm-btn-export-md');
    if (exportMdBtn) {
      exportMdBtn.addEventListener('click', () => exportToMarkdown(activeNotebook));
    }

    // 7. Salin Semua Kode
    const copyAllBtn = container.querySelector('#rm-btn-copy-all');
    if (copyAllBtn) {
      copyAllBtn.addEventListener('click', () => copyAllCode(activeNotebook, copyAllBtn));
    }

    // 8. Hapus Notebook
    const deleteNbBtn = container.querySelector('#rm-btn-delete-nb');
    if (deleteNbBtn) {
      deleteNbBtn.addEventListener('click', async () => {
        if (confirm(`Yakin ingin menghapus notebook "${activeNotebook.title}"?`)) {
          await deleteCodeNotebook(activeNotebook.id);
          await refreshData();
        }
      });
    }

    // 9. Tombol Top Add (+ Teks / + Kode)
    const topAddText = container.querySelector('#rm-btn-top-add-text');
    if (topAddText) {
      topAddText.addEventListener('click', () => addCell('markdown', -1));
    }
    const topAddCode = container.querySelector('#rm-btn-top-add-code');
    if (topAddCode) {
      topAddCode.addEventListener('click', () => addCell('code', -1));
    }

    // 10. Tombol Add Cell di Divider
    container.querySelectorAll('.rm-btn-add-cell').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const index = parseInt(btn.dataset.index, 10);
        addCell(type, index);
      });
    });

    // 11. Salin Kode Sel Perorangan (1-klik)
    container.querySelectorAll('.rm-btn-copy-code').forEach(btn => {
      btn.addEventListener('click', () => {
        const cellId = btn.dataset.cellId;
        const cell = activeNotebook.cells.find(c => c.id === cellId);
        if (cell && cell.content) {
          navigator.clipboard.writeText(cell.content).then(() => {
            const orig = btn.innerHTML;
            btn.innerHTML = `${icon('check', 'style="width:13px;height:13px;"')} Tersalin!`;
            btn.style.color = 'var(--pen)';
            setTimeout(() => {
              btn.innerHTML = orig;
              btn.style.color = '';
            }, 1400);
          });
        }
      });
    });

    // 12. Pindah Sel ke Atas / Bawah
    container.querySelectorAll('.rm-btn-move-cell').forEach(btn => {
      btn.addEventListener('click', () => {
        const cellId = btn.dataset.cellId;
        const dir = parseInt(btn.dataset.dir, 10);
        moveCell(cellId, dir);
      });
    });

    // 13. Hapus Sel
    container.querySelectorAll('.rm-btn-del-cell').forEach(btn => {
      btn.addEventListener('click', () => {
        const cellId = btn.dataset.cellId;
        deleteCell(cellId);
      });
    });

    // 14. Inisialisasi Editor Kode Gaya IDE untuk Setiap Sel Kode
    const editorsMap = new Map();
    let saveTimeout = null;
    function debouncedSave() {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        await saveCodeNotebook(activeNotebook);
      }, 400);
    }

    container.querySelectorAll('.rm-cell-ide-mount').forEach(mount => {
      const cellId = mount.dataset.cellId;
      const cell = activeNotebook.cells.find(c => c.id === cellId);
      if (!cell) return;

      const editor = createCodeEditor({
        container: mount,
        initialValue: cell.content || '',
        language: cell.language || activeNotebook.language || 'python',
        onChange: (newVal) => {
          cell.content = newVal;
          debouncedSave();
        }
      });

      editorsMap.set(cellId, editor);
    });

    // 15. Ganti Bahasa Sel Kode
    container.querySelectorAll('.rm-cell-lang-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const cellId = sel.dataset.cellId;
        const cell = activeNotebook.cells.find(c => c.id === cellId);
        if (cell) {
          cell.language = e.target.value;
          const editor = editorsMap.get(cellId);
          if (editor) editor.setLanguage(e.target.value);
          await saveCodeNotebook(activeNotebook);
        }
      });
    });

    // 16. Output Note Input
    container.querySelectorAll('.rm-cell-output-input').forEach(ta => {
      ta.addEventListener('input', (e) => {
        const cellId = ta.dataset.cellId;
        const cell = activeNotebook.cells.find(c => c.id === cellId);
        if (cell) {
          cell.output_note = e.target.value;
        }
      });

      ta.addEventListener('blur', async () => {
        await saveCodeNotebook(activeNotebook);
      });
    });

    // 17. Toggle Edit Mode Sel Markdown
    container.querySelectorAll('.rm-btn-toggle-edit').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cellId = btn.dataset.cellId;
        if (editingCellIds.has(cellId)) {
          // Menyimpan hasil edit
          const ta = container.querySelector(`.rm-cell-md-input[data-cell-id="${cellId}"]`);
          if (ta) {
            const cell = activeNotebook.cells.find(c => c.id === cellId);
            if (cell) cell.content = ta.value;
            await saveCodeNotebook(activeNotebook);
          }
          editingCellIds.delete(cellId);
        } else {
          editingCellIds.add(cellId);
        }
        render();
      });
    });

    // 18. Double click pada rendered markdown untuk mengedit
    container.querySelectorAll('.rm-cell-md-view').forEach(view => {
      view.addEventListener('dblclick', () => {
        const cellId = view.dataset.cellId;
        editingCellIds.add(cellId);
        render();
      });
    });
  }

  // Tambah sel baru di posisi setelah afterIndex
  async function addCell(type, afterIndex) {
    if (!activeNotebook) return;
    const newCell = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type: type,
      language: type === 'code' ? (activeNotebook.language || 'python') : undefined,
      content: type === 'code' ? '' : '### Judul Penjelasan Baru\nTuliskan penjelasan konsep di sini...',
      output_note: ''
    };

    if (!activeNotebook.cells) activeNotebook.cells = [];

    if (afterIndex === -1) {
      activeNotebook.cells.unshift(newCell);
    } else {
      activeNotebook.cells.splice(afterIndex + 1, 0, newCell);
    }

    if (type === 'markdown') {
      editingCellIds.add(newCell.id);
    }

    await saveCodeNotebook(activeNotebook);
    render();

    // Auto-focus ke input sel baru
    setTimeout(() => {
      if (type === 'code') {
        const ta = container.querySelector(`.rm-cell-ide-mount[data-cell-id="${newCell.id}"] .rm-ide-textarea`);
        if (ta) ta.focus();
      } else {
        const ta = container.querySelector(`.rm-cell-md-input[data-cell-id="${newCell.id}"]`);
        if (ta) ta.focus();
      }
    }, 50);
  }

  // Pindahkan sel ke atas / bawah
  async function moveCell(cellId, dir) {
    if (!activeNotebook || !activeNotebook.cells) return;
    const idx = activeNotebook.cells.findIndex(c => c.id === cellId);
    if (idx === -1) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= activeNotebook.cells.length) return;

    const temp = activeNotebook.cells[idx];
    activeNotebook.cells[idx] = activeNotebook.cells[targetIdx];
    activeNotebook.cells[targetIdx] = temp;

    await saveCodeNotebook(activeNotebook);
    render();
  }

  // Hapus sel
  async function deleteCell(cellId) {
    if (!activeNotebook || !activeNotebook.cells) return;
    if (confirm('Hapus sel ini?')) {
      activeNotebook.cells = activeNotebook.cells.filter(c => c.id !== cellId);
      editingCellIds.delete(cellId);
      await saveCodeNotebook(activeNotebook);
      render();
    }
  }

  // Mulai halaman
  init();
}

