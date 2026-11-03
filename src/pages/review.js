// Halaman Sesi Belajar Flashcards & Spaced Repetition (#/review)
import { getAllLocalFlashcards, getDueLocalFlashcards, saveLocalFlashcard, deleteLocalFlashcard } from '../data/local-db.js';
import { calculateNextReview, formatIntervalLabel } from '../reader/sm2.js';
import { openFlashcardModal } from '../ui/flashcard-modal.js';
import { icon } from '../ui/icons.js';
import { showToast } from '../ui/toast.js';

export function ReviewPage({ container, router }) {
  let allCards = [];
  let queue = [];
  let currentIndex = 0;
  let isFlipped = false;
  let selectedCourse = 'all';
  let reviewedCount = 0;

  async function init() {
    allCards = await getAllLocalFlashcards();
    filterQueue();
    render();
  }

  function filterQueue(forceAll = false) {
    const now = new Date();
    let cards = forceAll ? [...allCards] : allCards.filter(c => new Date(c.due_at) <= now);

    if (selectedCourse !== 'all') {
      cards = cards.filter(c => c.course_name === selectedCourse);
    }

    queue = cards;
    currentIndex = 0;
    isFlipped = false;
  }

  function render() {
    const courses = Array.from(new Set(allCards.map(c => c.course_name || 'Umum'))).filter(Boolean);
    const dueCount = allCards.filter(c => new Date(c.due_at) <= new Date()).length;

    container.innerHTML = `
      <header class="rm-navbar">
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          <a href="#/" class="rm-btn rm-btn-ghost rm-btn-icon" aria-label="Kembali ke rak">
            ${icon('back')}
          </a>
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            ${icon('cards', 'style="color:var(--pen);width:20px;height:20px;"')}
            <span style="font-weight:600;font-size:17px;">Flashcards & Spaced Repetition</span>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:var(--space-2);">
          <button class="rm-btn rm-btn-ghost" id="rm-btn-new-card">
            ${icon('plus')} Buat Kartu
          </button>
          <span class="rm-badge ${dueCount > 0 ? 'rm-badge-pen' : 'rm-badge-natural'}">
            ${dueCount} Jatuh Tempo
          </span>
        </div>
      </header>

      <main class="rm-container" style="max-width: 680px; padding-top: var(--space-4);">
        <!-- Filter Mata Kuliah -->
        <div style="display:flex;gap:var(--space-2);overflow-x:auto;padding-bottom:var(--space-3);margin-bottom:var(--space-4);">
          <button class="rm-btn ${selectedCourse === 'all' ? 'rm-btn-primary' : 'rm-btn-ghost'} rm-course-filter" data-course="all">
            Semua (${allCards.length})
          </button>
          ${courses.map(c => `
            <button class="rm-btn ${selectedCourse === c ? 'rm-btn-primary' : 'rm-btn-ghost'} rm-course-filter" data-course="${escapeHtml(c)}">
              ${escapeHtml(c)} (${allCards.filter(x => x.course_name === c).length})
            </button>
          `).join('')}
        </div>

        <div id="rm-review-card-area">
          <!-- Area Kartu / Selesai dinamis -->
        </div>
      </main>
    `;

    setupHeaderEvents();
    renderCardArea();
  }

  function setupHeaderEvents() {
    container.querySelector('#rm-btn-new-card').addEventListener('click', () => {
      openFlashcardModal({
        courseName: selectedCourse !== 'all' ? selectedCourse : 'Umum'
      });
      setTimeout(() => init(), 500);
    });

    container.querySelectorAll('.rm-course-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedCourse = btn.dataset.course;
        filterQueue();
        render();
      });
    });
  }

  function renderCardArea() {
    const area = container.querySelector('#rm-review-card-area');
    if (!area) return;

    // Kasus: Antrean kosong (Semua sudah diulang hari ini)
    if (queue.length === 0 || currentIndex >= queue.length) {
      area.innerHTML = `
        <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:var(--space-8);text-align:center;">
          <div style="color:#2f9e44;margin-bottom:var(--space-3);">
            ${icon('check', 'style="width:48px;height:48px;"')}
          </div>
          <h2 style="font-size:20px;font-weight:600;margin:0 0 var(--space-2);">Semua Kartu Sudah Diulang!</h2>
          <p class="rm-muted" style="margin:0 0 var(--space-6);font-size:14px;max-width:440px;margin-inline:auto;">
            ${reviewedCount > 0 ? `Bagus sekali! Anda telah menyelesaikan <b>${reviewedCount} kartu</b> pada sesi ini. ` : ''}
            Algoritma SM-2 telah menjadwalkan repetisi berikutnya secara adaptif.
          </p>
          <div style="display:flex;justify-content:center;gap:var(--space-3);flex-wrap:wrap;">
            <a href="#/" class="rm-btn rm-btn-primary">
              Kembali ke Rak Modul
            </a>
            ${allCards.length > 0 ? `
              <button class="rm-btn rm-btn-ghost" id="rm-btn-review-all">
                ${icon('rotate')} Ulangi Semua Kartu Sekarang
              </button>
            ` : ''}
          </div>
        </div>
      `;

      const reviewAllBtn = area.querySelector('#rm-btn-review-all');
      if (reviewAllBtn) {
        reviewAllBtn.addEventListener('click', () => {
          filterQueue(true);
          renderCardArea();
        });
      }
      return;
    }

    const currentCard = queue[currentIndex];
    const progressPercent = Math.round(((currentIndex) / queue.length) * 100);

    area.innerHTML = `
      <!-- Progress Bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-2);font-size:13px;color:var(--ink-muted);">
        <span>Kartu ${currentIndex + 1} dari ${queue.length}</span>
        <span>${progressPercent}% Selesai</span>
      </div>
      <div class="rm-progress" style="margin-bottom:var(--space-4);">
        <i style="width:${progressPercent}%"></i>
      </div>

      <!-- Kartu Interaktif -->
      <div id="rm-active-flashcard" class="rm-card-interactive" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);box-shadow:var(--shadow-sheet);min-height:280px;display:flex;flex-direction:column;cursor:pointer;position:relative;transition:all 0.2s ease;">
        <!-- Header Kartu -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-4);border-bottom:1px solid var(--line-soft);">
          <span class="rm-badge rm-badge-pen" style="font-size:12px;">${escapeHtml(currentCard.course_name || 'Umum')}</span>
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            <button class="rm-btn rm-btn-ghost rm-btn-danger rm-btn-icon" id="rm-btn-delete-card" title="Hapus kartu" style="width:28px;height:28px;padding:0;">
              ${icon('trash')}
            </button>
          </div>
        </div>

        <!-- Badan Kartu: Depan vs Belakang -->
        <div style="padding:var(--space-6);flex:1;display:flex;flex-direction:column;justify-content:center;">
          ${!isFlipped ? `
            <!-- Tampilan Depan (Pertanyaan) -->
            <div style="text-align:center;">
              <span class="rm-muted" style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:var(--space-2);">Pertanyaan / Konsep</span>
              <p style="font-size:18px;font-weight:600;line-height:1.5;margin:0 0 var(--space-4);color:var(--ink);">
                ${escapeHtml(currentCard.front)}
              </p>
              <span class="rm-badge rm-badge-natural" style="font-size:12px;">
                ${icon('rotate', 'style="width:14px;height:14px;margin-right:4px;"')} Klik kartu atau tekan [Spasi] untuk melihat jawaban
              </span>
            </div>
          ` : `
            <!-- Tampilan Belakang (Jawaban) -->
            <div>
              <span class="rm-muted" style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:var(--space-1);">Pertanyaan</span>
              <p style="font-size:14px;font-weight:500;margin:0 0 var(--space-4);color:var(--ink-muted);">
                ${escapeHtml(currentCard.front)}
              </p>

              <hr style="border:0;border-top:1px dashed var(--line);margin:var(--space-3) 0;">

              <span class="rm-muted" style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:var(--space-1);">Jawaban / Penjelasan</span>
              <div style="font-size:16px;line-height:1.6;font-family:var(--font-reading);color:var(--ink);white-space:pre-wrap;background:var(--surface-sunken);padding:var(--space-3);border-radius:var(--radius-md);">
                ${escapeHtml(currentCard.back)}
              </div>
            </div>
          `}
        </div>

        <!-- Footer Tombol Rating SM-2 saat Kartu Dibalik -->
        ${isFlipped ? `
          <div style="padding:var(--space-4);border-top:1px solid var(--line-soft);background:var(--surface-sunken);border-bottom-left-radius:var(--radius-lg);border-bottom-right-radius:var(--radius-lg);" id="rm-rating-bar">
            <p style="text-align:center;font-size:12px;color:var(--ink-muted);margin:0 0 var(--space-3);">
              Berapa baik Anda mengingat konsep ini?
            </p>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));gap:var(--space-2);">
              <button class="rm-btn rm-btn-ghost rm-btn-danger rm-rating-btn" data-rating="1" style="flex-direction:column;gap:2px;padding:8px 4px;height:auto;">
                <span style="font-weight:600;font-size:13px;">1. Ulangi</span>
                <span style="font-size:11px;opacity:0.8;">${formatIntervalLabel(1, currentCard)}</span>
              </button>

              <button class="rm-btn rm-btn-ghost rm-rating-btn" data-rating="2" style="flex-direction:column;gap:2px;padding:8px 4px;height:auto;color:#d9480f;border-color:#ffa94d;">
                <span style="font-weight:600;font-size:13px;">2. Sulit</span>
                <span style="font-size:11px;opacity:0.8;">${formatIntervalLabel(2, currentCard)}</span>
              </button>

              <button class="rm-btn rm-btn-ghost rm-rating-btn" data-rating="3" style="flex-direction:column;gap:2px;padding:8px 4px;height:auto;color:var(--pen);border-color:var(--pen);">
                <span style="font-weight:600;font-size:13px;">3. Baik</span>
                <span style="font-size:11px;opacity:0.8;">${formatIntervalLabel(3, currentCard)}</span>
              </button>

              <button class="rm-btn rm-btn-ghost rm-rating-btn" data-rating="4" style="flex-direction:column;gap:2px;padding:8px 4px;height:auto;color:#2f9e44;border-color:#8ce99a;">
                <span style="font-weight:600;font-size:13px;">4. Mudah</span>
                <span style="font-size:11px;opacity:0.8;">${formatIntervalLabel(4, currentCard)}</span>
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    setupCardEvents(currentCard);
  }

  function setupCardEvents(currentCard) {
    const cardEl = container.querySelector('#rm-active-flashcard');
    const deleteBtn = container.querySelector('#rm-btn-delete-card');

    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Hapus kartu flashcard ini?')) {
          await deleteLocalFlashcard(currentCard.id);
          allCards = allCards.filter(c => c.id !== currentCard.id);
          queue.splice(currentIndex, 1);
          showToast('Kartu berhasil dihapus');
          renderCardArea();
        }
      });
    }

    if (cardEl) {
      cardEl.addEventListener('click', (e) => {
        if (e.target.closest('#rm-rating-bar') || e.target.closest('#rm-btn-delete-card')) return;
        isFlipped = !isFlipped;
        renderCardArea();
      });
    }

    container.querySelectorAll('.rm-rating-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const rating = parseInt(btn.dataset.rating, 10);
        await handleRateCard(currentCard, rating);
      });
    });
  }

  async function handleRateCard(card, rating) {
    const updated = calculateNextReview(card, rating);
    await saveLocalFlashcard(updated);

    // Update state
    reviewedCount++;
    currentIndex++;
    isFlipped = false;
    renderCardArea();
  }

  // Keyboard shortcut listener
  function handleKeyDown(e) {
    if (e.target.matches('input, textarea')) return;

    if (e.code === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      if (queue.length > 0 && currentIndex < queue.length) {
        isFlipped = !isFlipped;
        renderCardArea();
      }
    } else if (['1', '2', '3', '4'].includes(e.key) && isFlipped) {
      const currentCard = queue[currentIndex];
      if (currentCard) {
        handleRateCard(currentCard, parseInt(e.key, 10));
      }
    }
  }

  window.addEventListener('keydown', handleKeyDown);
  init();

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

