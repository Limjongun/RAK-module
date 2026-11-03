// Buku Catatan Global (/notes)
import { initLocalDB, getAllLocalDocuments } from '../data/local-db.js';
import { openFlashcardModal } from '../ui/flashcard-modal.js';
import { icon } from '../ui/icons.js';

export function NotesPage({ container, router }) {
  let allNotes = [];
  let documentsMap = new Map();
  let selectedColor = 'all';

  async function loadData() {
    const db = await initLocalDB();
    const annots = await db.getAll('annotations');
    const docs = await getAllLocalDocuments();

    documentsMap = new Map(docs.map(d => [d.id, d]));
    allNotes = annots.filter(a => !a.deleted);

    render();
  }

  function render() {
    const filtered = selectedColor === 'all'
      ? allNotes
      : allNotes.filter(n => n.color === selectedColor);

    container.innerHTML = `
      <header class="rm-navbar">
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          <a href="#/" class="rm-btn rm-btn-ghost rm-btn-icon" aria-label="Kembali ke rak">
            ${icon('back')}
          </a>
          <span style="font-weight:600;font-size:17px;">Buku Catatan Global</span>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-2);">
          <span style="font-size:13px;color:var(--ink-muted);">Filter warna:</span>
          <span role="radiogroup" aria-label="Filter warna sorot" style="display:inline-flex;align-items:center;">
            <button class="rm-swatch rm-sw-all ${selectedColor === 'all' ? 'active' : ''}" data-color="all" style="width:20px;height:20px;border-radius:50%;background:var(--line-strong);" title="Semua"></button>
            <button class="rm-swatch rm-sw-yellow" data-color="yellow" title="Penting"></button>
            <button class="rm-swatch rm-sw-green" data-color="green" title="Definisi"></button>
            <button class="rm-swatch rm-sw-blue" data-color="blue" title="Contoh"></button>
            <button class="rm-swatch rm-sw-pink" data-color="pink" title="Belum paham"></button>
            <button class="rm-swatch rm-sw-violet" data-color="violet" title="Ujian"></button>
          </span>
        </div>
      </header>

      <main class="rm-container">
        ${filtered.length === 0 ? `
          <div style="text-align:center;padding:var(--space-12) 0;color:var(--ink-muted);">
            <p style="font-size:16px;">Belum ada catatan atau sorotan yang tersimpan.</p>
            <a href="#/" class="rm-btn rm-btn-primary" style="margin-top:var(--space-4);">Buka Rak Modul</a>
          </div>
        ` : `
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:var(--space-4);">
            ${filtered.map(note => {
      const doc = documentsMap.get(note.document_id);
      const docTitle = doc ? doc.title : 'Modul';
      return `
                <div class="rm-note" style="width:100%;cursor:pointer;" data-doc="${note.document_id}" data-page="${note.page_no}">
                  <p class="rm-card-meta" style="margin-bottom:6px;font-weight:600;color:var(--pen);">
                    ${docTitle} · Hal. ${note.page_no}
                  </p>
                  ${note.quote ? `<p class="rm-note-quote rm-mark-${note.color || 'yellow'}">${note.quote}</p>` : ''}
                  ${note.note_md ? `<p class="rm-note-body">${note.note_md}</p>` : ''}
                  <div class="rm-note-foot">
                    <span>${note.created_at ? new Date(note.created_at).toLocaleDateString('id-ID') : ''}</span>
                    <div style="display:flex;align-items:center;gap:6px;">
                      <button class="rm-btn rm-btn-ghost rm-btn-note-fc" data-doc="${note.document_id}" data-annot="${note.id}" data-quote="${escapeHtml(note.quote)}" data-note="${escapeHtml(note.note_md)}" style="height:24px;padding:0 6px;font-size:11px;color:var(--pen);" title="Jadikan Flashcard">
                        ${icon('cards', 'style="width:13px;height:13px;margin-right:2px;"')} Kartu
                      </button>
                      <span class="rm-btn rm-btn-ghost" style="height:24px;padding:0 4px;font-size:12px;">Buka &rarr;</span>
                    </div>
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        `}
      </main>
    `;

    container.querySelectorAll('.rm-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedColor = btn.dataset.color;
        render();
      });
    });

    container.querySelectorAll('.rm-btn-note-fc').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const doc = documentsMap.get(btn.dataset.doc);
        const quote = btn.dataset.quote || '';
        const noteText = btn.dataset.note || '';
        openFlashcardModal({
          front: '',
          back: quote + (noteText ? '\n\nCatatan: ' + noteText : ''),
          documentId: btn.dataset.doc,
          annotationId: btn.dataset.annot,
          courseName: doc ? doc.course_name : 'Umum'
        });
      });
    });

    container.querySelectorAll('.rm-note').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.rm-btn-note-fc')) return;
        const docId = card.dataset.doc;
        const pageNo = card.dataset.page;
        router.navigate(`/read/${docId}?p=${pageNo}`);
      });
    });
  }

  loadData();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

