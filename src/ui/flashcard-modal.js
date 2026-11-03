// Dialog Pembuatan Flashcard Baru — Mendukung Drag & Drop (Mouse Desktop & Touch Mobile)
import { saveLocalFlashcard } from '../data/local-db.js';
import { makeDraggable } from './drag.js';
import { icon } from './icons.js';
import { showToast } from './toast.js';

export function openFlashcardModal({ front = '', back = '', documentId = null, annotationId = null, courseName = 'Umum' }) {
  const existing = document.getElementById('rm-flashcard-modal');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'rm-flashcard-modal';
  backdrop.className = 'rm-modal-backdrop';
  backdrop.innerHTML = `
    <div class="rm-modal" id="rm-fc-dialog" style="max-width: 500px; width: 100%;" role="dialog" aria-modal="true" aria-labelledby="rm-fc-title">
      <!-- Header dengan drag handle -->
      <div class="rm-modal-header" id="rm-fc-header" title="Tahan & geser untuk memindahkan posisi dialog">
        <div style="display:flex;align-items:center;gap:var(--space-2);font-weight:600;font-size:15px;color:var(--ink);">
          <span style="color:var(--pen);display:flex;align-items:center;">${icon('cards')}</span>
          <span id="rm-fc-title">Buat Flashcard Baru</span>
          <span style="color:var(--ink-muted);font-size:14px;letter-spacing:1px;margin-left:4px;" title="Area pegangan geser">⋮⋮</span>
        </div>
        <button class="rm-btn rm-btn-ghost rm-btn-icon" id="rm-fc-close" aria-label="Tutup dialog" style="width:28px;height:28px;padding:0;">
          ${icon('close')}
        </button>
      </div>

      <!-- Body Form -->
      <div class="rm-modal-body" style="display:flex;flex-direction:column;gap:var(--space-4);padding:var(--space-4);">
        <div>
          <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:var(--ink-muted);">
            Pertanyaan / Konsep (Bagian Depan Kartu)
          </label>
          <input type="text" id="rm-fc-front" class="rm-search" style="width:100%;height:38px;padding:0 var(--space-3);" placeholder="Contoh: Apa tujuan dari normalisasi Min-Max?" value="${escapeHtml(front)}">
        </div>

        <div>
          <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:var(--ink-muted);">
            Jawaban / Penjelasan (Bagian Belakang Kartu)
          </label>
          <textarea id="rm-fc-back" class="rm-search" style="width:100%;height:120px;resize:vertical;font-family:inherit;padding:var(--space-3);line-height:1.5;" placeholder="Tulis jawaban lengkap atau kutipan modul...">${escapeHtml(back)}</textarea>
        </div>
      </div>

      <!-- Footer Tombol -->
      <div class="rm-modal-footer">
        <span class="rm-badge rm-badge-natural" style="font-size:12px;">MK: ${escapeHtml(courseName)}</span>
        <div style="display:flex;gap:var(--space-2);">
          <button class="rm-btn rm-btn-ghost" id="rm-fc-cancel">Batal</button>
          <button class="rm-btn rm-btn-primary" id="rm-fc-save">
            ${icon('check')} Simpan Flashcard
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const modalDialog = backdrop.querySelector('#rm-fc-dialog');
  const headerEl = backdrop.querySelector('#rm-fc-header');
  const frontInput = backdrop.querySelector('#rm-fc-front');
  const backInput = backdrop.querySelector('#rm-fc-back');
  const closeBtn = backdrop.querySelector('#rm-fc-close');
  const cancelBtn = backdrop.querySelector('#rm-fc-cancel');
  const saveBtn = backdrop.querySelector('#rm-fc-save');

  // Aktifkan draggable dengan mouse & touch mobile
  const cleanupDrag = makeDraggable(modalDialog, headerEl);

  const close = () => {
    cleanupDrag();
    backdrop.remove();
  };

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  // Hotkey Esc untuk menutup
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      window.removeEventListener('keydown', handleKeyDown);
      close();
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  frontInput.focus();

  saveBtn.addEventListener('click', async () => {
    const frontVal = frontInput.value.trim();
    const backVal = backInput.value.trim();

    if (!frontVal || !backVal) {
      alert('Mohon isi bagian depan (pertanyaan) dan belakang (jawaban) kartu.');
      return;
    }

    await saveLocalFlashcard({
      front: frontVal,
      back: backVal,
      document_id: documentId,
      annotation_id: annotationId,
      course_name: courseName
    });

    close();
    showToast('Flashcard berhasil disimpan! Siap diulang di menu Flashcard.');
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
