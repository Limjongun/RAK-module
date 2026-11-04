// Entry Point Aplikasi Rak Modul
import { Router } from './router.js';
import { LibraryPage } from './pages/library.js';
import { ReaderPage } from './pages/reader.js';
import { UploadPage } from './pages/upload.js';
import { ConvertPage } from './pages/convert.js';
import { NotesPage } from './pages/notes.js';
import { SearchPage } from './pages/search.js';
import { ReviewPage } from './pages/review.js';
import { StatsPage } from './pages/stats.js';
import { CodeBankPage } from './pages/code-bank.js';
import { TodosPage } from './pages/todos.js';
import { WriterPage } from './pages/writer.js';
import { flushSyncQueue } from './data/sync.js';
import './styles/writer.css';

// Setup Tema (Sistem / Saved)
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  document.documentElement.dataset.theme = savedTheme;
} else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.dataset.theme = 'dark';
} else {
  document.documentElement.dataset.theme = 'light';
}

// Inisialisasi Router
const routes = [
  { path: '/', component: LibraryPage },
  { path: '/read/:id', component: ReaderPage },
  { path: '/upload', component: UploadPage },
  { path: '/convert', component: ConvertPage },
  { path: '/notes', component: NotesPage },
  { path: '/search', component: SearchPage },
  { path: '/review', component: ReviewPage },
  { path: '/stats', component: StatsPage },
  { path: '/code', component: CodeBankPage },
  { path: '/todos', component: TodosPage },
  { path: '/tasks', component: TodosPage },
  { path: '/write', component: WriterPage },
  { path: '/write/:id', component: WriterPage }
];

const router = new Router(routes, 'app');
router.start();

// Flush antrean sinkronisasi offline jika terhubung
flushSyncQueue();

// Registrasi Service Worker PWA untuk offline-first
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('Rak Modul SW terdaftar:', reg.scope);
    }).catch((err) => {
      console.warn('Gagal registrasi SW:', err);
    });
  });
}

// Tangkap event PWA install prompt untuk tombol Pasang Aplikasi di HP/Laptop
window.deferredPWAInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPWAInstallPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa-installable'));
});

window.addEventListener('appinstalled', () => {
  window.deferredPWAInstallPrompt = null;
  console.log('Rak Modul berhasil dipasang sebagai aplikasi!');
});

