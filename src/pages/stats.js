// Halaman Statistik & Pelacakan Waktu Belajar (#/stats)
import { getStudyStats, getAllLocalFlashcards } from '../data/local-db.js';
import { icon } from '../ui/icons.js';

export function StatsPage({ container, router }) {
  let stats = null;
  let flashcards = [];

  async function init() {
    stats = await getStudyStats();
    flashcards = await getAllLocalFlashcards();
    render();
  }

  function render() {
    const totalHours = Math.floor(stats.totalMinutes / 60);
    const remainingMins = stats.totalMinutes % 60;
    const timeFormatted = totalHours > 0 ? `${totalHours} Jam ${remainingMins} Menit` : `${remainingMins} Menit`;

    const maxDayMinutes = Math.max(30, ...stats.last7Days.map(d => d.minutes));
    const dueCardsCount = flashcards.filter(c => new Date(c.due_at) <= new Date()).length;

    container.innerHTML = `
      <header class="rm-navbar">
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          <a href="#/" class="rm-btn rm-btn-ghost rm-btn-icon" aria-label="Kembali ke rak">
            ${icon('back')}
          </a>
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            ${icon('chart', 'style="color:var(--pen);width:20px;height:20px;"')}
            <span style="font-weight:600;font-size:17px;">Statistik & Waktu Belajar</span>
          </div>
        </div>
      </header>

      <main class="rm-container" style="max-width: 760px; padding-top: var(--space-4);">
        <!-- 4 Kotak Metrik Ringkasan -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(135px, 1fr));gap:var(--space-3);margin-bottom:var(--space-6);">
          <!-- Total Waktu -->
          <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:var(--space-4);">
            <div style="display:flex;align-items:center;gap:var(--space-2);color:var(--pen);margin-bottom:4px;">
              ${icon('timer', 'style="width:18px;height:18px;"')}
              <span style="font-size:13px;font-weight:500;color:var(--ink-muted);">Total Belajar</span>
            </div>
            <div style="font-size:20px;font-weight:700;color:var(--ink);">${timeFormatted}</div>
          </div>

          <!-- Streak -->
          <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:var(--space-4);">
            <div style="display:flex;align-items:center;gap:var(--space-2);color:#e8590c;margin-bottom:4px;">
              ${icon('flame', 'style="width:18px;height:18px;"')}
              <span style="font-size:13px;font-weight:500;color:var(--ink-muted);">Streak Belajar</span>
            </div>
            <div style="font-size:20px;font-weight:700;color:var(--ink);">${stats.streak} Hari Berturut</div>
          </div>

          <!-- Sesi Pomodoro -->
          <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:var(--space-4);">
            <div style="display:flex;align-items:center;gap:var(--space-2);color:#2f9e44;margin-bottom:4px;">
              ${icon('check', 'style="width:18px;height:18px;"')}
              <span style="font-size:13px;font-weight:500;color:var(--ink-muted);">Sesi Selesai</span>
            </div>
            <div style="font-size:20px;font-weight:700;color:var(--ink);">${stats.totalSessions} Sesi</div>
          </div>

          <!-- Flashcards -->
          <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:var(--space-4);">
            <div style="display:flex;align-items:center;gap:var(--space-2);color:var(--pen);margin-bottom:4px;">
              ${icon('cards', 'style="width:18px;height:18px;"')}
              <span style="font-size:13px;font-weight:500;color:var(--ink-muted);">Total Flashcard</span>
            </div>
            <div style="font-size:20px;font-weight:700;color:var(--ink);">${flashcards.length} Kartu</div>
          </div>
        </div>

        <!-- Grafik Aktivitas Belajar 7 Hari Terakhir -->
        <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:var(--space-6);margin-bottom:var(--space-6);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-6);">
            <div>
              <h3 style="font-size:16px;font-weight:600;margin:0 0 2px;">Aktivitas 7 Hari Terakhir</h3>
              <p class="rm-muted" style="margin:0;font-size:13px;">Waktu membaca dan belajar per hari (dalam menit)</p>
            </div>
            <span class="rm-badge rm-badge-pen">${stats.totalMinutes} menit total</span>
          </div>

          <!-- Bar Chart Minimalis -->
          <div style="display:grid;grid-template-columns:repeat(7, 1fr);gap:var(--space-3);align-items:flex-end;height:140px;padding-top:var(--space-4);border-bottom:1px solid var(--line);">
            ${stats.last7Days.map(d => {
              const heightPercent = maxDayMinutes > 0 ? Math.max(4, Math.round((d.minutes / maxDayMinutes) * 100)) : 4;
              const hasActivity = d.minutes > 0;
              return `
                <div style="display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;">
                  <span style="font-size:11px;color:var(--ink-muted);margin-bottom:4px;">${d.minutes > 0 ? `${d.minutes}m` : ''}</span>
                  <div style="width:100%;max-width:32px;height:${heightPercent}%;background:${hasActivity ? 'var(--pen)' : 'var(--line)'};border-radius:4px 4px 0 0;transition:height 0.3s ease;" title="${d.dateKey}: ${d.minutes} menit"></div>
                  <span style="font-size:12px;font-weight:500;margin-top:6px;color:var(--ink);">${d.dayName}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Distribusi Waktu per Mata Kuliah -->
        <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:var(--space-6);margin-bottom:var(--space-6);">
          <h3 style="font-size:16px;font-weight:600;margin:0 0 var(--space-4);">Distribusi Belajar per Mata Kuliah</h3>
          ${stats.courseDistribution.length === 0 ? `
            <p class="rm-muted" style="font-size:13px;margin:0;">Belum ada catatan waktu sesi belajar. Aktifkan timer Pomodoro saat membaca modul.</p>
          ` : `
            <div style="display:flex;flex-direction:column;gap:var(--space-3);">
              ${stats.courseDistribution.map(c => `
                <div>
                  <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
                    <span style="font-weight:500;">${escapeHtml(c.course)}</span>
                    <span class="rm-muted">${c.minutes} Menit (${c.percent}%)</span>
                  </div>
                  <div class="rm-progress" style="height:6px;">
                    <i style="width:${c.percent}%;"></i>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Riwayat Sesi Terakhir -->
        <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:var(--space-6);">
          <h3 style="font-size:16px;font-weight:600;margin:0 0 var(--space-4);">Riwayat Sesi Belajar Terakhir</h3>
          ${stats.recentSessions.length === 0 ? `
            <p class="rm-muted" style="font-size:13px;margin:0;">Belum ada sesi belajar yang selesai. Buka modul dan mulai sesi fokus dengan Pomodoro.</p>
          ` : `
            <div style="display:flex;flex-direction:column;gap:var(--space-2);">
              ${stats.recentSessions.map(s => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-3);background:var(--surface-sunken);border-radius:var(--radius-md);">
                  <div style="display:flex;align-items:center;gap:var(--space-3);">
                    <div style="color:var(--pen);">${icon('timer')}</div>
                    <div>
                      <div style="font-size:14px;font-weight:500;">${escapeHtml(s.docTitle)}</div>
                      <div class="rm-muted" style="font-size:12px;">${formatDate(s.started_at)} · ± ${s.pages_read || 1} halaman</div>
                    </div>
                  </div>
                  <span class="rm-badge rm-badge-natural" style="font-weight:600;">${s.minutes} menit</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </main>
    `;
  }

  init();
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

