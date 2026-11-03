// Pencarian Lintas Modul (/search)
import { initLocalDB, getAllLocalDocuments } from '../data/local-db.js';
import { icon } from '../ui/icons.js';

export function SearchPage({ container, query, router }) {
  const initialQuery = query.get('q') || '';
  let searchInputVal = initialQuery;
  let results = [];
  let isSearching = false;

  async function performSearch(searchTerm) {
    if (!searchTerm || searchTerm.trim().length === 0) {
      results = [];
      render();
      return;
    }

    isSearching = true;
    render();

    const db = await initLocalDB();
    const docs = await getAllLocalDocuments();
    const docsMap = new Map(docs.map(d => [d.id, d]));

    const allPages = await db.getAll('pages');
    const termLower = searchTerm.toLowerCase();

    const hits = [];
    for (const page of allPages) {
      if (!page.text) continue;
      const textLower = page.text.toLowerCase();
      const matchIndex = textLower.indexOf(termLower);

      if (matchIndex !== -1) {
        // Buat cuplikan 60 karakter sebelum dan sesudah
        const start = Math.max(0, matchIndex - 60);
        const end = Math.min(page.text.length, matchIndex + termLower.length + 60);
        const snippet = page.text.slice(start, end);

        hits.push({
          document_id: page.document_id,
          page_no: page.page_no,
          snippet,
          doc: docsMap.get(page.document_id)
        });

        if (hits.length >= 50) break; // batas 50 hasil
      }
    }

    results = hits;
    isSearching = false;
    render();
  }

  function render() {
    container.innerHTML = `
      <header class="rm-navbar">
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          <a href="#/" class="rm-btn rm-btn-ghost rm-btn-icon" aria-label="Kembali ke rak">
            ${icon('back')}
          </a>
          <label class="rm-search" style="width:480px;height:40px;">
            ${icon('search')}
            <input type="search" id="rm-search-input" value="${searchInputVal}" placeholder="Cari di semua modul…" aria-label="Cari di semua modul">
          </label>
        </div>
      </header>

      <main class="rm-container" style="max-width:720px;">
        ${isSearching ? `
          <p class="rm-muted" style="padding:var(--space-6) 0;">Mencari modul…</p>
        ` : results.length === 0 && searchInputVal ? `
          <div style="text-align:center;padding:var(--space-12) 0;color:var(--ink-muted);">
            <p style="font-size:16px;">Tidak ada hasil untuk "${searchInputVal}".</p>
            <p style="font-size:13px;">Coba gunakan kata kunci lain.</p>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-4);">
            ${results.map(hit => {
              const docTitle = hit.doc ? hit.doc.title : 'Modul';
              // Sorot kata kunci di cuplikan
              const escapedTerm = searchInputVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`(${escapedTerm})`, 'gi');
              const highlightedSnippet = hit.snippet.replace(regex, '<em>$1</em>');

              return `
                <div class="rm-hit" data-doc="${hit.document_id}" data-page="${hit.page_no}">
                  <p><b>${docTitle}</b> <span class="rm-muted" style="margin-left:6px;">hal. ${hit.page_no}</span></p>
                  <p class="rm-muted" style="margin-top:4px;">…${highlightedSnippet}…</p>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </main>
    `;

    const input = container.querySelector('#rm-search-input');
    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        searchInputVal = input.value.trim();
        performSearch(searchInputVal);
      }
    });

    container.querySelectorAll('.rm-hit').forEach(hitEl => {
      hitEl.addEventListener('click', () => {
        const docId = hitEl.dataset.doc;
        const pageNo = hitEl.dataset.page;
        router.navigate(`/read/${docId}?p=${pageNo}`);
      });
    });
  }

  if (initialQuery) {
    performSearch(initialQuery);
  } else {
    render();
  }
}

