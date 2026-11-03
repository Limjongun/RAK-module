// Halaman To-Do List & Agenda Belajar Mahasiswa (/todos)
import { 
  getAllTodos, 
  saveTodo, 
  deleteTodo, 
  toggleTodoComplete, 
  seedSampleTodosIfEmpty,
  getAllLocalDocuments
} from '../data/local-db.js';
import { icon } from '../ui/icons.js';

export function TodosPage({ container, router }) {
  let docs = [];
  let activeTab = 'all'; // 'all' | 'today' | 'overdue' | 'upcoming' | 'completed'
  let selectedPriority = 'all'; // 'all' | 'high' | 'medium' | 'low'
  let selectedCourse = 'all';
  let searchQuery = '';
  let showCompletedSection = true;

  // State untuk form edit
  let editingTodo = null;

  // Fallback storage key jika IndexedDB terhambat oleh banyak tab terbuka
  const LOCAL_STORAGE_KEY = 'rak_modul_todos_cache';

  function getLocalCachedTodos() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return null;
  }

  function saveLocalCachedTodos(items) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    } catch (_) {}
  }

  // Format tanggal & waktu lokal YYYY-MM-DDTHH:mm
  function toLocalDatetimeString(date) {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Buat teks preset waktu
  function getPresetDatetime(preset) {
    const now = new Date();
    if (preset === 'today_17') {
      now.setHours(17, 0, 0, 0);
      return toLocalDatetimeString(now);
    }
    if (preset === 'today_21') {
      now.setHours(21, 0, 0, 0);
      return toLocalDatetimeString(now);
    }
    if (preset === 'tomorrow_09') {
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0);
      return toLocalDatetimeString(now);
    }
    if (preset === 'tomorrow_17') {
      now.setDate(now.getDate() + 1);
      now.setHours(17, 0, 0, 0);
      return toLocalDatetimeString(now);
    }
    if (preset === 'weekend') {
      const day = now.getDay();
      const diff = (6 - day + 7) % 7 || 7;
      now.setDate(now.getDate() + diff);
      now.setHours(12, 0, 0, 0);
      return toLocalDatetimeString(now);
    }
    return toLocalDatetimeString(now);
  }

  // Data contoh awal agar tidak pernah kosong
  function generateStarterSamples() {
    return [
      {
        id: 'todo_seed_1',
        title: 'Review SOP Data Preprocessing & Outlier IQR',
        description: 'Baca modul SOP Data Preprocessing, pelajari rumus IQR, dan coba kode di Kode Bank.',
        due_datetime: getPresetDatetime('today_17'),
        priority: 'high',
        course_name: 'Data Analytics',
        duration_minutes: 45,
        completed: false,
        completed_at: null
      },
      {
        id: 'todo_seed_2',
        title: 'Latihan Query SQL Window Function DENSE_RANK',
        description: 'Selesaikan studi kasus retail mart dengan fungsi jendela LAG & RANK.',
        due_datetime: getPresetDatetime('tomorrow_17'),
        priority: 'medium',
        course_name: 'Basis Data & SQL',
        duration_minutes: 60,
        completed: false,
        completed_at: null
      },
      {
        id: 'todo_seed_3',
        title: 'Meringkas Materi Kuliah Machine Learning',
        description: 'Buat rangkuman materi Supervised Learning ke format Markdown untuk catatan ujian.',
        due_datetime: getPresetDatetime('weekend'),
        priority: 'low',
        course_name: 'Machine Learning',
        duration_minutes: 30,
        completed: false,
        completed_at: null
      }
    ];
  }

  // Inisialisasi daftar tugas (Gunakan Cache / Starter Sample Segera!)
  let todos = getLocalCachedTodos() || generateStarterSamples();

  // Sinkronisasi data di latar belakang
  async function init() {
    try {
      const dbTodos = await seedSampleTodosIfEmpty();
      if (dbTodos && dbTodos.length > 0) {
        todos = dbTodos;
        saveLocalCachedTodos(todos);
      }
    } catch (err) {
      console.warn('Gagal memuat todos dari IDB:', err);
    }

    try {
      docs = await getAllLocalDocuments();
    } catch (err) {
      docs = [];
    }
    render();
  }

  async function refresh() {
    try {
      const list = await getAllTodos();
      if (list && list.length > 0) {
        todos = list;
        saveLocalCachedTodos(todos);
      }
    } catch (err) {
      console.warn('Gagal refresh todos:', err);
    }
    render();
  }

  // -------------------------------------------------------------
  // HELPER FORMAT WAKTU & DATETIME
  // -------------------------------------------------------------

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function formatTime(d) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function formatDateShort(d) {
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  }

  function formatDateFull(d) {
    return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()} ${formatTime(d)}`;
  }

  // Menentukan status waktu real-time
  function getDueMeta(dueDatetime, completed) {
    if (completed) {
      return {
        group: 'completed',
        label: 'Selesai',
        badgeClass: 'rm-badge rm-badge-green',
        iconName: 'check-circle',
        isOverdue: false
      };
    }

    if (!dueDatetime) {
      return {
        group: 'no_due',
        label: 'Tanpa Tenggat',
        badgeClass: 'rm-todo-badge rm-todo-badge-upcoming',
        iconName: 'calendar',
        isOverdue: false
      };
    }

    const now = new Date();
    const due = new Date(dueDatetime);
    if (isNaN(due.getTime())) {
      return {
        group: 'no_due',
        label: 'Tanpa Tenggat',
        badgeClass: 'rm-todo-badge rm-todo-badge-upcoming',
        iconName: 'calendar',
        isOverdue: false
      };
    }

    const diffMs = due.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / (60 * 1000));

    // Jika sudah lewat dari waktu saat ini
    if (diffMinutes < 0) {
      const absMin = Math.abs(diffMinutes);
      let relText = '';
      if (absMin < 60) {
        relText = `${absMin} mnt lalu`;
      } else if (absMin < 1440) {
        relText = `${Math.round(absMin / 60)} jam lalu`;
      } else {
        relText = `${Math.round(absMin / 1440)} hari lalu`;
      }

      return {
        group: 'overdue',
        label: `Terlambat (${relText})`,
        subLabel: formatDateFull(due),
        badgeClass: 'rm-todo-badge rm-todo-badge-overdue',
        iconName: 'alert-triangle',
        isOverdue: true
      };
    }

    // Cek apakah tanggalnya sama dengan hari ini
    const isToday = now.getFullYear() === due.getFullYear() &&
                    now.getMonth() === due.getMonth() &&
                    now.getDate() === due.getDate();

    if (isToday) {
      let suffix = '';
      if (diffMinutes < 180) {
        suffix = ` (${Math.max(1, Math.round(diffMinutes / 60))} jam lagi)`;
      }
      return {
        group: 'today',
        label: `Hari ini, ${formatTime(due)}${suffix}`,
        subLabel: `Pukul ${formatTime(due)}`,
        badgeClass: 'rm-todo-badge rm-todo-badge-today',
        iconName: 'clock',
        isOverdue: false
      };
    }

    // Cek apakah besok
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = tomorrow.getFullYear() === due.getFullYear() &&
                       tomorrow.getMonth() === due.getMonth() &&
                       tomorrow.getDate() === due.getDate();

    if (isTomorrow) {
      return {
        group: 'upcoming',
        label: `Besok, ${formatTime(due)}`,
        subLabel: `${DAY_NAMES[due.getDay()]}, ${formatDateShort(due)}`,
        badgeClass: 'rm-todo-badge rm-todo-badge-upcoming',
        iconName: 'calendar',
        isOverdue: false
      };
    }

    // Minggu ini / Mendatang
    return {
      group: 'upcoming',
      label: `${DAY_NAMES[due.getDay()]}, ${formatDateShort(due)} • ${formatTime(due)}`,
      subLabel: formatDateFull(due),
      badgeClass: 'rm-todo-badge rm-todo-badge-upcoming',
      iconName: 'calendar',
      isOverdue: false
    };
  }

  // -------------------------------------------------------------
  // RENDER UTAMA
  // -------------------------------------------------------------

  function render() {
    const courses = Array.from(new Set(todos.map(t => t.course_name).filter(Boolean)));

    // Filter daftar tugas
    const filtered = todos.filter(t => {
      // Filter tab
      const meta = getDueMeta(t.due_datetime, t.completed);
      if (activeTab === 'today' && (meta.group !== 'today' && !t.completed)) return false;
      if (activeTab === 'overdue' && !meta.isOverdue) return false;
      if (activeTab === 'upcoming' && meta.group !== 'upcoming') return false;
      if (activeTab === 'completed' && !t.completed) return false;

      // Filter prioritas
      if (selectedPriority !== 'all' && t.priority !== selectedPriority) return false;

      // Filter mata kuliah
      if (selectedCourse !== 'all' && t.course_name !== selectedCourse) return false;

      // Filter pencarian
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title && t.title.toLowerCase().includes(q);
        const matchDesc = t.description && t.description.toLowerCase().includes(q);
        const matchCourse = t.course_name && t.course_name.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchCourse) return false;
      }

      return true;
    });

    // Hitung statistik
    const totalCount = todos.length;
    const completedCount = todos.filter(t => t.completed).length;
    const percentDone = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const overdueCount = todos.filter(t => !t.completed && getDueMeta(t.due_datetime, false).isOverdue).length;
    const todayCount = todos.filter(t => !t.completed && getDueMeta(t.due_datetime, false).group === 'today').length;

    // Hitung total estimasi waktu belajar (menit)
    const totalPendingMinutes = todos
      .filter(t => !t.completed)
      .reduce((sum, t) => sum + (Number(t.duration_minutes) || 30), 0);
    const estHours = Math.floor(totalPendingMinutes / 60);
    const estMins = totalPendingMinutes % 60;

    // Kelompokkan tugas jika tab 'all'
    const overdueGroup = [];
    const todayGroup = [];
    const upcomingGroup = [];
    const noDueGroup = [];
    const completedGroup = [];

    filtered.forEach(t => {
      if (t.completed) {
        completedGroup.push(t);
      } else {
        const meta = getDueMeta(t.due_datetime, false);
        if (meta.isOverdue) overdueGroup.push(t);
        else if (meta.group === 'today') todayGroup.push(t);
        else if (meta.group === 'upcoming') upcomingGroup.push(t);
        else noDueGroup.push(t);
      }
    });

    const now = new Date();
    const defaultDatetime = getPresetDatetime('today_21');

    container.innerHTML = `
      <header class="rm-navbar">
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          <a href="#/" class="rm-btn rm-btn-ghost rm-btn-icon" aria-label="Kembali ke rak">
            ${icon('back')}
          </a>
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            <span style="color:var(--pen);">${icon('list-todo', 'style="width:20px;height:20px;"')}</span>
            <span style="font-weight:600;font-size:17px;">Agenda & Target Belajar</span>
          </div>
          <span class="rm-badge" style="background:var(--pen-soft);color:var(--pen);font-size:11px;font-weight:600;">
            To-Do List
          </span>
        </div>
        <div class="rm-nav-actions" style="display:flex;align-items:center;gap:var(--space-2);">
          <button id="rm-btn-copy-agenda" class="rm-btn rm-btn-ghost" style="height:34px;font-size:12px;" title="Salin daftar agenda hari ini ke clipboard">
            ${icon('copy')} Salin Agenda Hari Ini
          </button>
        </div>
      </header>

      <main class="rm-todo-container">
        <!-- HEADER KARTU STATISTIK & PROGRESS -->
        <div class="rm-todo-header-card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-4);flex-wrap:wrap;">
            <div>
              <div style="font-size:12px;font-weight:600;text-transform:uppercase;color:var(--ink-muted);letter-spacing:0.5px;">
                ${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}
              </div>
              <h2 style="font-size:20px;font-weight:700;margin:4px 0 0 0;color:var(--ink);">
                Target & Agenda Belajar Anda
              </h2>
            </div>

            <!-- Metrik Ringkas -->
            <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap;">
              ${overdueCount > 0 ? `
                <div style="background:rgba(179,38,30,0.1);color:var(--correction);border:1px solid rgba(179,38,30,0.25);border-radius:var(--radius-md);padding:6px 12px;text-align:center;">
                  <b style="font-size:16px;">${overdueCount}</b>
                  <div style="font-size:11px;">Terlambat</div>
                </div>
              ` : ''}
              <div style="background:var(--pen-soft);color:var(--pen);border-radius:var(--radius-md);padding:6px 12px;text-align:center;">
                <b style="font-size:16px;">${todayCount}</b>
                <div style="font-size:11px;">Hari Ini</div>
              </div>
              <div style="background:var(--surface-sunken);color:var(--ink);border-radius:var(--radius-md);padding:6px 12px;text-align:center;">
                <b style="font-size:16px;">${estHours > 0 ? `${estHours}j ` : ''}${estMins}m</b>
                <div style="font-size:11px;">Estimasi Belajar</div>
              </div>
            </div>
          </div>

          <!-- Progress Bar -->
          <div style="margin-top:var(--space-4);">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink-muted);font-weight:500;">
              <span>Kemajuan: <b>${completedCount}</b> dari <b>${totalCount}</b> tugas selesai</span>
              <span><b>${percentDone}%</b></span>
            </div>
            <div class="rm-todo-progress-bar">
              <div class="rm-todo-progress-fill" style="width:${percentDone}%;"></div>
            </div>
          </div>
        </div>

        <!-- QUICK ADD BOX (Input Cepat & Efisien) -->
        <div class="rm-todo-quickbox">
          <input 
            id="rm-inp-quick-title" 
            type="text" 
            class="rm-todo-quick-input" 
            placeholder="+ Tambahkan tugas atau target belajar baru (tekan Enter untuk simpan)..." 
            autocomplete="off"
          />

          <div class="rm-todo-quick-controls">
            <!-- Preset Pilihan Waktu Cepat -->
            <div class="rm-todo-quick-presets">
              <span style="font-size:11.5px;color:var(--ink-muted);font-weight:600;">Waktu:</span>
              <button type="button" class="rm-todo-preset-btn active" data-preset="today_21">Malam ini (21:00)</button>
              <button type="button" class="rm-todo-preset-btn" data-preset="today_17">Sore ini (17:00)</button>
              <button type="button" class="rm-todo-preset-btn" data-preset="tomorrow_09">Besok (09:00)</button>
              <button type="button" class="rm-todo-preset-btn" data-preset="weekend">Akhir Pekan</button>
            </div>

            <!-- Kontrol Detail Tambahan -->
            <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;">
              <select id="rm-sel-quick-prio" class="rm-input" style="font-size:12px;height:28px;padding:2px 8px;">
                <option value="high">🔴 Prioritas Tinggi</option>
                <option value="medium" selected>🟡 Prioritas Sedang</option>
                <option value="low">⚪ Prioritas Rendah</option>
              </select>

              <input 
                id="rm-inp-quick-dt" 
                type="datetime-local" 
                class="rm-input" 
                value="${defaultDatetime}" 
                style="font-size:12px;height:28px;padding:2px 6px;"
              />

              <button id="rm-btn-submit-quick" class="rm-btn rm-btn-primary" style="height:28px;font-size:12px;padding:0 12px;">
                ${icon('plus')} Tambah
              </button>
            </div>
          </div>
        </div>

        <!-- SEARCH & FILTER TABS -->
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-3);">
          <div class="rm-todo-tabs" style="margin:0;">
            <button class="rm-todo-tab ${activeTab === 'all' ? 'active' : ''}" data-tab="all">
              Semua (${todos.length})
            </button>
            <button class="rm-todo-tab ${activeTab === 'today' ? 'active' : ''}" data-tab="today">
              Hari Ini (${todayCount})
            </button>
            ${overdueCount > 0 ? `
              <button class="rm-todo-tab ${activeTab === 'overdue' ? 'active' : ''}" data-tab="overdue" style="${activeTab !== 'overdue' ? 'color:var(--correction);border-color:rgba(179,38,30,0.3);' : ''}">
                Terlambat (${overdueCount})
              </button>
            ` : ''}
            <button class="rm-todo-tab ${activeTab === 'upcoming' ? 'active' : ''}" data-tab="upcoming">
              Mendatang
            </button>
            <button class="rm-todo-tab ${activeTab === 'completed' ? 'active' : ''}" data-tab="completed">
              Selesai (${completedCount})
            </button>
          </div>

          <!-- Filter Mata Kuliah & Cari -->
          <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;">
            ${courses.length > 0 ? `
              <select id="rm-filter-course" class="rm-input" style="font-size:12px;height:32px;padding:2px 8px;">
                <option value="all" ${selectedCourse === 'all' ? 'selected' : ''}>Semua MK</option>
                ${courses.map(c => `
                  <option value="${c}" ${selectedCourse === c ? 'selected' : ''}>${c}</option>
                `).join('')}
              </select>
            ` : ''}

            <input 
              id="rm-inp-todo-search" 
              type="search" 
              class="rm-input" 
              placeholder="Cari tugas..." 
              value="${searchQuery}" 
              style="font-size:12px;height:32px;width:150px;"
            />
          </div>
        </div>

        <!-- DAFTAR TUGAS BERDASARKAN GRUP -->
        ${filtered.length === 0 ? `
          <div style="text-align:center;padding:var(--space-12) 0;background:var(--surface);border:1px dashed var(--line);border-radius:var(--radius-lg);color:var(--ink-muted);">
            <div style="font-size:32px;margin-bottom:var(--space-2);">🎯</div>
            <h3 style="margin:0 0 var(--space-1) 0;font-size:16px;color:var(--ink);">Tidak ada tugas di kategori ini</h3>
            <p style="margin:0;font-size:13px;">Semua target selesai atau buat tugas baru lewat kotak di atas.</p>
          </div>
        ` : activeTab !== 'all' ? `
          <!-- Tampilan Tab Spesifik -->
          <div class="rm-todo-list">
            ${filtered.map(t => renderTodoItem(t)).join('')}
          </div>
        ` : `
          <!-- Tampilan Tab Semua (Dikelompokkan secara Cerdas) -->

          <!-- 1. GRUP TERLAMBAT (OVERDUE) -->
          ${overdueGroup.length > 0 ? `
            <div class="rm-todo-section">
              <div class="rm-todo-section-title" style="color:var(--correction);">
                <span style="color:var(--correction);">${icon('alert-triangle', 'style="width:16px;height:16px;"')}</span>
                <span>Tenggat Terlewat (${overdueGroup.length})</span>
              </div>
              ${overdueGroup.map(t => renderTodoItem(t, 'overdue')).join('')}
            </div>
          ` : ''}

          <!-- 2. GRUP HARI INI -->
          ${todayGroup.length > 0 ? `
            <div class="rm-todo-section">
              <div class="rm-todo-section-title" style="color:var(--pen);">
                <span style="color:var(--pen);">${icon('clock', 'style="width:16px;height:16px;"')}</span>
                <span>Target Hari Ini (${todayGroup.length})</span>
              </div>
              ${todayGroup.map(t => renderTodoItem(t, 'today')).join('')}
            </div>
          ` : ''}

          <!-- 3. GRUP MENDATANG -->
          ${upcomingGroup.length > 0 ? `
            <div class="rm-todo-section">
              <div class="rm-todo-section-title">
                <span>${icon('calendar', 'style="width:16px;height:16px;"')}</span>
                <span>Tugas Mendatang (${upcomingGroup.length})</span>
              </div>
              ${upcomingGroup.map(t => renderTodoItem(t, 'upcoming')).join('')}
            </div>
          ` : ''}

          <!-- 4. TANPA TENGGAT -->
          ${noDueGroup.length > 0 ? `
            <div class="rm-todo-section">
              <div class="rm-todo-section-title">
                <span>Target Fleksibel (${noDueGroup.length})</span>
              </div>
              ${noDueGroup.map(t => renderTodoItem(t)).join('')}
            </div>
          ` : ''}

          <!-- 5. TUGAS SELESAI -->
          ${completedGroup.length > 0 ? `
            <div class="rm-todo-section" style="margin-top:var(--space-8);">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3);">
                <div class="rm-todo-section-title" style="margin:0;color:var(--ink-muted);">
                  <span>${icon('check-circle', 'style="width:16px;height:16px;"')}</span>
                  <span>Tugas Selesai (${completedGroup.length})</span>
                </div>
                <button id="rm-btn-toggle-completed" class="rm-btn rm-btn-ghost" style="font-size:12px;height:24px;padding:0 6px;">
                  ${showCompletedSection ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
              ${showCompletedSection ? `
                <div>
                  ${completedGroup.map(t => renderTodoItem(t, 'completed')).join('')}
                </div>
              ` : ''}
            </div>
          ` : ''}
        `}
      </main>

      <!-- MODAL EDIT TUGAS LENGKAP -->
      <div id="rm-modal-edit-todo" class="rm-modal-backdrop" style="display:none;">
        <div class="rm-modal" style="max-width:500px;">
          <div class="rm-modal-header">
            <h3 class="rm-modal-title">Edit Tugas & Target Belajar</h3>
            <button id="rm-btn-close-edit-modal" class="rm-colab-btn-icon">${icon('close')}</button>
          </div>
          <div class="rm-modal-body" style="display:flex;flex-direction:column;gap:var(--space-3);">
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Judul Tugas</label>
              <input id="rm-edit-title" type="text" class="rm-input" style="width:100%;" />
            </div>

            <div>
              <label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Catatan / Deskripsi</label>
              <textarea id="rm-edit-desc" class="rm-input" rows="3" style="width:100%;resize:vertical;" placeholder="Tuliskan catatan penting atau instruksi belajar..."></textarea>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
              <div>
                <label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Tenggat Waktu & Tanggal</label>
                <input id="rm-edit-due" type="datetime-local" class="rm-input" style="width:100%;" />
              </div>

              <div>
                <label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Tingkat Prioritas</label>
                <select id="rm-edit-prio" class="rm-input" style="width:100%;">
                  <option value="high">🔴 Tinggi (Mendesak)</option>
                  <option value="medium">🟡 Sedang</option>
                  <option value="low">⚪ Rendah</option>
                </select>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
              <div>
                <label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Mata Kuliah / Kategori</label>
                <input id="rm-edit-course" type="text" class="rm-input" placeholder="Contoh: Machine Learning" style="width:100%;" />
              </div>

              <div>
                <label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Estimasi Waktu Belajar</label>
                <select id="rm-edit-duration" class="rm-input" style="width:100%;">
                  <option value="15">15 Menit</option>
                  <option value="25">25 Menit (1 Pomodoro)</option>
                  <option value="45">45 Menit</option>
                  <option value="60">60 Menit (1 Jam)</option>
                  <option value="90">90 Menit</option>
                  <option value="120">2 Jam</option>
                </select>
              </div>
            </div>

            ${docs.length > 0 ? `
              <div>
                <label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Hubungkan ke Modul Bacaan (Opsional)</label>
                <select id="rm-edit-doc-id" class="rm-input" style="width:100%;">
                  <option value="">-- Tanpa Rujukan Modul --</option>
                  ${docs.map(d => `
                    <option value="${d.id}">${d.title || 'Dokumen Tanpa Judul'}</option>
                  `).join('')}
                </select>
              </div>
            ` : ''}
          </div>
          <div class="rm-modal-footer">
            <button id="rm-btn-cancel-edit-modal" class="rm-btn rm-btn-ghost">Batal</button>
            <button id="rm-btn-save-edit-modal" class="rm-btn rm-btn-primary">Simpan Perubahan</button>
          </div>
        </div>
      </div>
    `;

    attachEvents();
  }

  // -------------------------------------------------------------
  // RENDER SATU ITEM TUGAS
  // -------------------------------------------------------------

  function renderTodoItem(todo, contextClass = '') {
    const meta = getDueMeta(todo.due_datetime, todo.completed);
    const prioLabel = todo.priority === 'high' ? 'Tinggi' : (todo.priority === 'low' ? 'Rendah' : 'Sedang');
    const prioClass = todo.priority === 'high' ? 'rm-todo-prio-high' : (todo.priority === 'low' ? 'rm-todo-prio-low' : 'rm-todo-prio-med');

    // Cari dokumen modul terkait jika ada
    const linkedDoc = todo.document_id ? docs.find(d => d.id === todo.document_id) : null;

    return `
      <div 
        class="rm-todo-item ${todo.completed ? 'completed' : ''} ${meta.isOverdue ? 'overdue' : ''} ${meta.group === 'today' ? 'today' : ''}" 
        data-todo-id="${todo.id}"
      >
        <!-- Checkbox Button -->
        <button 
          type="button" 
          class="rm-todo-check-btn ${todo.completed ? 'checked' : ''} rm-btn-toggle-todo" 
          data-todo-id="${todo.id}" 
          title="${todo.completed ? 'Tandai belum selesai' : 'Tandai selesai'}"
        >
          ${todo.completed ? icon('check', 'style="width:14px;height:14px;"') : ''}
        </button>

        <!-- Content -->
        <div class="rm-todo-content">
          <div class="rm-todo-title ${todo.completed ? 'struck' : ''}">
            ${escapeHtml(todo.title || 'Tanpa Judul')}
          </div>

          ${todo.description ? `
            <div class="rm-todo-desc">${escapeHtml(todo.description)}</div>
          ` : ''}

          <!-- Metadata Badges -->
          <div class="rm-todo-meta">
            <!-- Tenggat Waktu -->
            <span class="${meta.badgeClass}" title="${meta.subLabel || meta.label}">
              ${icon(meta.iconName, 'style="width:12px;height:12px;"')}
              <span>${meta.label}</span>
            </span>

            <!-- Prioritas -->
            <span class="rm-todo-badge ${prioClass}">
              ${prioLabel}
            </span>

            <!-- Mata Kuliah -->
            ${todo.course_name ? `
              <span class="rm-badge" style="font-size:11px;background:var(--surface-sunken);color:var(--ink-muted);">
                ${escapeHtml(todo.course_name)}
              </span>
            ` : ''}

            <!-- Durasi Estimasi -->
            ${todo.duration_minutes ? `
              <span style="color:var(--ink-muted);display:inline-flex;align-items:center;gap:3px;" title="Estimasi Durasi Belajar">
                ${icon('timer', 'style="width:12px;height:12px;"')} ${todo.duration_minutes}m
              </span>
            ` : ''}

            <!-- Link Modul Bacaan -->
            ${linkedDoc ? `
              <a href="#/read/${linkedDoc.id}" class="rm-badge" style="font-size:11px;background:var(--pen-soft);color:var(--pen);text-decoration:none;" title="Buka modul rujukan di Rak Modul">
                ${icon('book', 'style="width:12px;height:12px;"')} ${escapeHtml(linkedDoc.title.length > 25 ? linkedDoc.title.slice(0, 22) + '...' : linkedDoc.title)} ↗
              </a>
            ` : ''}
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="rm-todo-actions">
          <button class="rm-colab-btn-icon rm-btn-edit-todo" data-todo-id="${todo.id}" title="Edit Detail Tugas">
            ${icon('pen')}
          </button>
          <button class="rm-colab-btn-icon rm-danger rm-btn-del-todo" data-todo-id="${todo.id}" title="Hapus Tugas">
            ${icon('trash')}
          </button>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // EVENT LISTENERS & LOGIKA INTERAKSI
  // -------------------------------------------------------------

  function attachEvents() {
    // 1. Checkbox Centang Selesai
    container.querySelectorAll('.rm-btn-toggle-todo').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.todoId;
        const target = todos.find(t => t.id === id);
        if (target) {
          target.completed = !target.completed;
          target.completed_at = target.completed ? new Date().toISOString() : null;
          target.updated_at = new Date().toISOString();
          saveLocalCachedTodos(todos);
          render();
          toggleTodoComplete(id).catch(err => console.warn('toggle complete error:', err));
        }
      });
    });

    // 2. Preset Waktu di Quick Add
    const dtInput = container.querySelector('#rm-inp-quick-dt');
    container.querySelectorAll('.rm-todo-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.rm-todo-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const preset = btn.dataset.preset;
        if (dtInput) {
          dtInput.value = getPresetDatetime(preset);
        }
      });
    });

    // 3. Quick Add Form Submission
    const quickTitleInput = container.querySelector('#rm-inp-quick-title');
    const submitQuickBtn = container.querySelector('#rm-btn-submit-quick');

    async function handleQuickAdd() {
      const title = (quickTitleInput?.value || '').trim();
      if (!title) return;

      const prio = container.querySelector('#rm-sel-quick-prio')?.value || 'medium';
      const due = dtInput?.value || getPresetDatetime('today_21');

      const newTodo = {
        id: 'todo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        title,
        description: '',
        due_datetime: due,
        priority: prio,
        course_name: selectedCourse !== 'all' ? selectedCourse : 'Umum',
        duration_minutes: 30,
        completed: false,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Tambahkan ke memori segera & simpan cache lokal
      todos.unshift(newTodo);
      saveLocalCachedTodos(todos);
      render();

      // Simpan ke IDB di background
      saveTodo(newTodo).catch(err => console.warn('saveTodo error:', err));
    }

    if (submitQuickBtn) {
      submitQuickBtn.addEventListener('click', handleQuickAdd);
    }
    if (quickTitleInput) {
      quickTitleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleQuickAdd();
        }
      });
    }

    // 4. Tab Navigasi
    container.querySelectorAll('.rm-todo-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        render();
      });
    });

    // 5. Filter Mata Kuliah
    const courseSelect = container.querySelector('#rm-filter-course');
    if (courseSelect) {
      courseSelect.addEventListener('change', (e) => {
        selectedCourse = e.target.value;
        render();
      });
    }

    // 6. Pencarian Tugas
    const searchInput = container.querySelector('#rm-inp-todo-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        render();
      });
    }

    // 7. Toggle Tampilkan / Sembunyikan Selesai
    const toggleCompletedBtn = container.querySelector('#rm-btn-toggle-completed');
    if (toggleCompletedBtn) {
      toggleCompletedBtn.addEventListener('click', () => {
        showCompletedSection = !showCompletedSection;
        render();
      });
    }

    // 8. Hapus Tugas
    container.querySelectorAll('.rm-btn-del-todo').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.todoId;
        const target = todos.find(t => t.id === id);
        if (confirm(`Hapus tugas "${target?.title || 'ini'}"?`)) {
          todos = todos.filter(t => t.id !== id);
          saveLocalCachedTodos(todos);
          render();
          deleteTodo(id).catch(err => console.warn('deleteTodo error:', err));
        }
      });
    });

    // 9. Modal Edit Tugas
    const editModal = container.querySelector('#rm-modal-edit-todo');
    const closeEditBtn = container.querySelector('#rm-btn-close-edit-modal');
    const cancelEditBtn = container.querySelector('#rm-btn-cancel-edit-modal');
    const saveEditBtn = container.querySelector('#rm-btn-save-edit-modal');

    function closeEdit() {
      editingTodo = null;
      if (editModal) editModal.style.display = 'none';
    }

    if (closeEditBtn) closeEditBtn.addEventListener('click', closeEdit);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEdit);

    container.querySelectorAll('.rm-btn-edit-todo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.todoId;
        const target = todos.find(t => t.id === id);
        if (!target) return;

        editingTodo = target;
        if (editModal) {
          const editTitle = editModal.querySelector('#rm-edit-title');
          const editDesc = editModal.querySelector('#rm-edit-desc');
          const editDue = editModal.querySelector('#rm-edit-due');
          const editPrio = editModal.querySelector('#rm-edit-prio');
          const editCourse = editModal.querySelector('#rm-edit-course');
          const editDuration = editModal.querySelector('#rm-edit-duration');
          const editDoc = editModal.querySelector('#rm-edit-doc-id');

          if (editTitle) editTitle.value = target.title || '';
          if (editDesc) editDesc.value = target.description || '';
          if (editDue) editDue.value = target.due_datetime || '';
          if (editPrio) editPrio.value = target.priority || 'medium';
          if (editCourse) editCourse.value = target.course_name || '';
          if (editDuration) editDuration.value = target.duration_minutes || '30';
          if (editDoc) editDoc.value = target.document_id || '';

          editModal.style.display = 'flex';
          if (editTitle) editTitle.focus();
        }
      });
    });

    if (saveEditBtn) {
      saveEditBtn.addEventListener('click', async () => {
        if (!editingTodo) return;

        const editTitle = editModal.querySelector('#rm-edit-title');
        const editDesc = editModal.querySelector('#rm-edit-desc');
        const editDue = editModal.querySelector('#rm-edit-due');
        const editPrio = editModal.querySelector('#rm-edit-prio');
        const editCourse = editModal.querySelector('#rm-edit-course');
        const editDuration = editModal.querySelector('#rm-edit-duration');
        const editDoc = editModal.querySelector('#rm-edit-doc-id');

        editingTodo.title = (editTitle?.value || '').trim() || 'Tanpa Judul';
        editingTodo.description = (editDesc?.value || '').trim();
        editingTodo.due_datetime = editDue?.value || null;
        editingTodo.priority = editPrio?.value || 'medium';
        editingTodo.course_name = (editCourse?.value || '').trim() || 'Umum';
        editingTodo.duration_minutes = Number(editDuration?.value) || 30;
        editingTodo.document_id = editDoc?.value || null;
        editingTodo.updated_at = new Date().toISOString();

        saveLocalCachedTodos(todos);
        closeEdit();
        render();
        saveTodo(editingTodo).catch(err => console.warn('saveEdit error:', err));
      });
    }

    // 10. Salin Agenda Hari Ini ke Clipboard
    const copyAgendaBtn = container.querySelector('#rm-btn-copy-agenda');
    if (copyAgendaBtn) {
      copyAgendaBtn.addEventListener('click', () => {
        const todayTasks = todos.filter(t => {
          if (t.completed) return false;
          const meta = getDueMeta(t.due_datetime, false);
          return meta.group === 'today' || meta.isOverdue;
        });

        if (todayTasks.length === 0) {
          alert('Tidak ada tugas tertunda untuk hari ini!');
          return;
        }

        let text = `📋 AGENDA BELAJAR HARI INI (${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}):\n\n`;
        todayTasks.forEach((t, i) => {
          const meta = getDueMeta(t.due_datetime, false);
          text += `${i + 1}. [ ] ${t.title}\n`;
          text += `   • Tenggat: ${meta.label}\n`;
          text += `   • MK: ${t.course_name || 'Umum'} | Prioritas: ${t.priority.toUpperCase()}\n`;
          if (t.description) text += `   • Catatan: ${t.description}\n`;
          text += '\n';
        });

        navigator.clipboard.writeText(text).then(() => {
          const orig = copyAgendaBtn.innerHTML;
          copyAgendaBtn.innerHTML = `${icon('check')} Agenda Tersalin!`;
          copyAgendaBtn.style.color = 'var(--pen)';
          setTimeout(() => {
            copyAgendaBtn.innerHTML = orig;
            copyAgendaBtn.style.color = '';
          }, 1500);
        });
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Render langsung secara instan (0ms) agar layar tidak pernah blank!
  render();

  // Sinkronisasi dengan database di latar belakang
  init();
}
