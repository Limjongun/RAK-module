// Halaman Unggah Modul Multi-Format (PDF, Word DOCX, TXT, MD, Gambar PNG/JPG)
import { PdfViewer } from '../reader/pdf-view.js';
import { processFileToCanonicalPdf } from '../reader/format-converter.js';
import { saveLocalDocument, saveLocalPages } from '../data/local-db.js';
import { supabase, isSupabaseConfigured } from '../data/supabase.js';
import { showToast } from '../ui/toast.js';
import { icon } from '../ui/icons.js';
import mammoth from 'mammoth';

function createDocxThumbnail(title, courseCode) {
  const canvas = document.createElement('canvas');
  canvas.width = 140;
  canvas.height = 185;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 140, 185);

  // Top header bar (Word blue)
  ctx.fillStyle = '#2b579a';
  ctx.fillRect(0, 0, 140, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('WORD DOCX', 10, 20);

  // Title
  ctx.fillStyle = '#1b2420';
  ctx.font = 'bold 12px sans-serif';
  const words = title.split(' ');
  let line = '';
  let y = 55;
  for (let w of words) {
    if ((line + w).length > 15) {
      ctx.fillText(line, 10, y);
      line = w + ' ';
      y += 16;
      if (y > 110) break;
    } else {
      line += w + ' ';
    }
  }
  if (line && y <= 110) ctx.fillText(line, 10, y);

  // Decorative table representation
  ctx.strokeStyle = '#d3d8d0';
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 125, 120, 45);
  ctx.beginPath();
  ctx.moveTo(10, 140); ctx.lineTo(130, 140);
  ctx.moveTo(10, 155); ctx.lineTo(130, 155);
  ctx.moveTo(50, 125); ctx.lineTo(50, 170);
  ctx.moveTo(90, 125); ctx.lineTo(90, 170);
  ctx.stroke();

  return canvas.toDataURL('image/webp', 0.9);
}

export function UploadPage({ container, router }) {
  let selectedFile = null;
  let isProcessing = false;

  function render() {
    container.innerHTML = `
      <header class="rm-navbar">
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          <a href="#/" class="rm-btn rm-btn-ghost rm-btn-icon" aria-label="Kembali ke rak">
            ${icon('back')}
          </a>
          <span style="font-weight:600;font-size:17px;">Unggah Modul Kuliah</span>
        </div>
      </header>

      <main class="rm-container" style="max-width: 640px;">
        <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:var(--space-6);">
          <div id="rm-dropzone" style="border:2px dashed var(--line-strong);border-radius:var(--radius-md);padding:var(--space-8);text-align:center;cursor:pointer;background:var(--surface-sunken);margin-bottom:var(--space-6);">
            <div style="color:var(--pen);margin-bottom:var(--space-2);">${icon('upload', 'style="width:36px;height:36px;"')}</div>
            <p style="font-weight:600;margin:0 0 4px;" id="rm-drop-text">Pilih atau seret file ke sini</p>
            <p class="rm-muted" style="font-size:13px;margin:0 0 6px;">Format didukung: <b>PDF</b>, <b>PowerPoint (.pptx)</b>, <b>E-Book (.epub)</b>, <b>Word (.docx)</b>, <b>Teks (.txt, .md)</b>, dan <b>Gambar (.png, .jpg)</b></p>
            <span class="rm-badge rm-badge-natural">Dikonversi otomatis ke format kanonik PDF</span>
            <input type="file" id="rm-file-input" accept=".pdf,.pptx,.epub,.docx,.txt,.md,.png,.jpg,.jpeg,.webp" style="display:none;">
          </div>

          <div style="display:flex;flex-direction:column;gap:var(--space-4);">
            <div>
              <label style="display:block;font-size:14px;font-weight:500;margin-bottom:4px;">Judul Modul</label>
              <input type="text" id="rm-input-title" class="rm-search" style="width:100%;" placeholder="Contoh: Jalur Terpendek dan DAG">
            </div>

            <div style="display:grid;grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-3);">
              <div>
                <label style="display:block;font-size:14px;font-weight:500;margin-bottom:4px;">Nama Mata Kuliah</label>
                <input type="text" id="rm-input-course" class="rm-search" style="width:100%;" placeholder="Contoh: Algoritma & Struktur Data">
              </div>
              <div>
                <label style="display:block;font-size:14px;font-weight:500;margin-bottom:4px;">Kode Mata Kuliah</label>
                <input type="text" id="rm-input-code" class="rm-search" style="width:100%;" placeholder="Contoh: CS170">
              </div>
            </div>

            <div>
              <label style="display:block;font-size:14px;font-weight:500;margin-bottom:4px;">Tag (pisahkan dengan koma)</label>
              <input type="text" id="rm-input-tags" class="rm-search" style="width:100%;" placeholder="uts, penting, bab-4">
            </div>

            <div style="display:flex;justify-content:flex-end;gap:var(--space-3);margin-top:var(--space-4);">
              <a href="#/" class="rm-btn rm-btn-ghost">Batal</a>
              <button class="rm-btn rm-btn-primary" id="rm-btn-submit" disabled>
                Unggah modul
              </button>
            </div>
          </div>
        </div>

        <div id="rm-processing-status" style="display:none;margin-top:var(--space-4);text-align:center;">
          <p class="rm-muted" id="rm-status-text">Mengekstrak halaman dan membuat indeks teks…</p>
        </div>
      </main>
    `;

    const dropzone = container.querySelector('#rm-dropzone');
    const fileInput = container.querySelector('#rm-file-input');
    const titleInput = container.querySelector('#rm-input-title');
    const submitBtn = container.querySelector('#rm-btn-submit');
    const dropText = container.querySelector('#rm-drop-text');

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--pen)';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'var(--line-strong)';
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--line-strong)';
      if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        handleFileSelect(fileInput.files[0]);
      }
    });

    function handleFileSelect(file) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      const supported = ['.pdf', '.pptx', '.epub', '.docx', '.txt', '.md', '.png', '.jpg', '.jpeg', '.webp'];

      if (!supported.includes(ext)) {
        alert(`Format file "${ext}" belum didukung. Gunakan PDF, PowerPoint (.pptx), E-Book (.epub), Word (.docx), TXT, MD, atau Gambar.`);
        return;
      }

      selectedFile = file;
      dropText.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
      if (!titleInput.value) {
        titleInput.value = file.name.replace(/\.[^.]+$/i, '').replace(/[-_]/g, ' ');
      }
      submitBtn.removeAttribute('disabled');
    }

    submitBtn.addEventListener('click', async () => {
      if (!selectedFile || isProcessing) return;
      isProcessing = true;
      submitBtn.setAttribute('disabled', 'true');
      submitBtn.textContent = 'Memproses…';

      const statusBox = container.querySelector('#rm-processing-status');
      const statusText = container.querySelector('#rm-status-text');
      statusBox.style.display = 'block';

      try {
        const docId = crypto.randomUUID();
        const title = titleInput.value.trim() || selectedFile.name;
        const courseName = container.querySelector('#rm-input-course').value.trim() || 'Umum';
        const courseCode = container.querySelector('#rm-input-code').value.trim() || '';
        const tags = container.querySelector('#rm-input-tags').value
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);

        if (selectedFile.name.toLowerCase().endsWith('.docx')) {
          statusText.textContent = 'Membaca dokumen Word asli, tabel, dan gambar…';
          const arrayBuffer = await selectedFile.arrayBuffer();
          const { value: rawText } = await mammoth.extractRawText({ arrayBuffer });

          const textChunks = [];
          const chunkSize = 2500;
          for (let i = 0; i < rawText.length; i += chunkSize) {
            textChunks.push(rawText.slice(i, i + chunkSize));
          }
          const pageCount = Math.max(1, textChunks.length);
          const thumbData = createDocxThumbnail(title, courseCode);

          const docRecord = {
            id: docId,
            title,
            course_name: courseName,
            course_code: courseCode,
            source_type: 'docx',
            page_count: pageCount,
            thumb_data: thumbData,
            tags,
            status: 'ready',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          statusText.textContent = 'Menyimpan dokumen Word asli ke memori lokal…';
          await saveLocalDocument(docRecord, selectedFile);

          const pageRecords = textChunks.map((t, idx) => ({
            document_id: docId,
            page_no: idx + 1,
            text: t
          }));
          await saveLocalPages(pageRecords);

          showToast('Dokumen Word berhasil dimuat dengan format asli');
          router.navigate(`/read/${docId}`);
          return;
        }

        statusText.textContent = 'Mengonversi file ke format kanonik PDF…';
        const processed = await processFileToCanonicalPdf(selectedFile, title);

        statusText.textContent = 'Membaca struktur dan halaman PDF…';
        const tempContainer = document.createElement('div');
        const pdfViewer = new PdfViewer({ container: tempContainer });
        await pdfViewer.load(processed.pdfBlob);

        const pageCount = pdfViewer.pageCount;

        statusText.textContent = 'Membuat thumbnail sampul…';
        const thumbData = await pdfViewer.renderThumbnail(1, 140);

        statusText.textContent = 'Mengekstrak teks per halaman untuk pencarian & TTS…';
        let extractedPages = [];
        if (processed.extractedPages && processed.extractedPages.length > 0) {
          extractedPages = processed.extractedPages;
        } else {
          extractedPages = await pdfViewer.extractAllPagesText();
        }

        const docRecord = {
          id: docId,
          title,
          course_name: courseName,
          course_code: courseCode,
          source_type: processed.sourceType,
          page_count: pageCount,
          thumb_data: thumbData,
          tags,
          status: 'ready',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        statusText.textContent = 'Menyimpan ke memori lokal (IndexedDB)…';
        await saveLocalDocument(docRecord, processed.pdfBlob);

        const pageRecords = extractedPages.map(p => ({
          document_id: docId,
          page_no: p.page_no,
          text: p.text
        }));
        await saveLocalPages(pageRecords);

        // Jika Supabase aktif, simpan juga secara remote
        if (isSupabaseConfigured) {
          try {
            await supabase.from('documents').upsert({
              id: docId,
              title,
              source_type: processed.sourceType,
              page_count: pageCount,
              tags,
              status: 'ready'
            });
            await supabase.from('pages').upsert(pageRecords);
          } catch (e) {
            console.warn('Gagal sinkron remote, tersimpan lokal:', e);
          }
        }

        showToast('Modul berhasil diunggah');
        router.navigate(`/read/${docId}`);
      } catch (err) {
        console.error('Gagal mengunggah:', err);
        alert('Terjadi kesalahan saat memproses file: ' + err.message);
        submitBtn.removeAttribute('disabled');
        submitBtn.textContent = 'Unggah modul';
        statusBox.style.display = 'none';
        isProcessing = false;
      }
    });
  }

  render();
}
