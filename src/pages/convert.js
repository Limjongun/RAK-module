// Halaman Alat Konversi Dokumen ke PDF (/convert)
import { processFileToCanonicalPdf } from '../reader/format-converter.js';
import { PdfViewer } from '../reader/pdf-view.js';
import { saveLocalDocument, saveLocalPages } from '../data/local-db.js';
import { icon } from '../ui/icons.js';
import { showToast } from '../ui/toast.js';

export function ConvertPage({ container, router }) {
  let selectedFile = null;
  let isConverting = false;
  let convertedResult = null; // { blob, pageCount, fileName, sourceType, extractedPages }

  function render() {
    container.innerHTML = `
      <header class="rm-navbar">
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          <a href="#/" class="rm-btn rm-btn-ghost rm-btn-icon" aria-label="Kembali ke rak">
            ${icon('back')}
          </a>
          <span style="font-weight:600;font-size:17px;">Konverter Dokumen ke PDF</span>
        </div>
      </header>

      <main class="rm-container" style="max-width: 680px;">
        <div style="text-align:center;margin-bottom:var(--space-6);">
          <h1 style="font-size:22px;font-weight:600;margin:0 0 var(--space-2);">Alat Konversi Dokumen Pribadi</h1>
          <p class="rm-muted" style="margin:0;font-size:14px;">
            Konversi file <b>Word (.docx)</b>, <b>PowerPoint (.pptx)</b>, <b>E-Book (.epub)</b>, <b>Teks (.txt, .md)</b>, atau <b>Gambar</b> menjadi dokumen PDF langsung di browser tanpa batas ukuran.
          </p>
        </div>

        <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:var(--space-6);">
          ${!convertedResult ? `
            <div id="rm-convert-dropzone" style="border:2px dashed var(--line-strong);border-radius:var(--radius-md);padding:var(--space-8);text-align:center;cursor:pointer;background:var(--surface-sunken);margin-bottom:var(--space-6);">
              <div style="color:var(--pen);margin-bottom:var(--space-2);">${icon('convert', 'style="width:36px;height:36px;"')}</div>
              <p style="font-weight:600;margin:0 0 4px;" id="rm-convert-text">Pilih atau seret file yang ingin dikonversi ke sini</p>
              <p class="rm-muted" style="font-size:13px;margin:0 0 6px;">Mendukung DOCX, PPTX, EPUB, TXT, MD, PNG, JPG</p>
              <input type="file" id="rm-convert-file-input" accept=".docx,.pptx,.epub,.txt,.md,.png,.jpg,.jpeg,.webp" style="display:none;">
            </div>

            <div style="display:flex;flex-direction:column;gap:var(--space-4);">
              <div>
                <label style="display:block;font-size:14px;font-weight:500;margin-bottom:4px;">Judul Dokumen (Opsional)</label>
                <input type="text" id="rm-convert-title" class="rm-search" style="width:100%;" placeholder="Otomatis mengikuti nama file asal">
              </div>

              <div style="display:flex;justify-content:flex-end;gap:var(--space-3);margin-top:var(--space-3);">
                <a href="#/" class="rm-btn rm-btn-ghost">Batal</a>
                <button class="rm-btn rm-btn-primary" id="rm-btn-start-convert" disabled>
                  ${icon('convert')} Konversi ke PDF
                </button>
              </div>
            </div>

            <div id="rm-convert-loading" style="display:none;margin-top:var(--space-4);text-align:center;">
              <p class="rm-muted" id="rm-convert-status">Mengonversi dan memformat lembar PDF…</p>
            </div>
          ` : `
            <!-- Hasil Konversi Selesai -->
            <div style="text-align:center;padding:var(--space-4) 0;">
              <div style="color:#2f9e44;margin-bottom:var(--space-2);">${icon('check', 'style="width:40px;height:40px;"')}</div>
              <h2 style="font-size:18px;font-weight:600;margin:0 0 4px;">Konversi Berhasil!</h2>
              <p class="rm-muted" style="font-size:14px;margin:0 0 var(--space-6);">
                File <b>${convertedResult.originalName}</b> berhasil diubah menjadi PDF (${convertedResult.pageCount} halaman, ${(convertedResult.pdfBlob.size / 1024).toFixed(1)} KB).
              </p>

              <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:var(--space-3);">
                <button class="rm-btn rm-btn-primary" id="rm-btn-download-pdf">
                  ${icon('download')} Unduh File PDF
                </button>
                <button class="rm-btn" id="rm-btn-save-to-shelf">
                  ${icon('book')} Buka & Simpan di Rak Modul
                </button>
                <button class="rm-btn rm-btn-ghost" id="rm-btn-convert-another">
                  Konversi File Lain
                </button>
              </div>
            </div>
          `}
        </div>

        <div style="margin-top:var(--space-6);display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:var(--space-4);">
          <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:var(--space-4);">
            <b style="display:block;font-size:14px;margin-bottom:4px;">100% Privat & Offline</b>
            <p class="rm-muted" style="font-size:13px;margin:0;">Dokumen Anda diproses langsung di mesin peramban laptop tanpa diunggah ke server konversi pihak ketiga.</p>
          </div>
          <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:var(--space-4);">
            <b style="display:block;font-size:14px;margin-bottom:4px;">Kualitas Kanonik A4</b>
            <p class="rm-muted" style="font-size:13px;margin:0;">Hasil konversi mempertahankan margin buku rapi, nomor halaman, dan pemenggalan paragraf yang nyaman dibaca.</p>
          </div>
        </div>
      </main>
    `;

    setupEvents();
  }

  function setupEvents() {
    if (!convertedResult) {
      const dropzone = container.querySelector('#rm-convert-dropzone');
      const fileInput = container.querySelector('#rm-convert-file-input');
      const titleInput = container.querySelector('#rm-convert-title');
      const convertBtn = container.querySelector('#rm-btn-start-convert');
      const dropText = container.querySelector('#rm-convert-text');
      const loadingBox = container.querySelector('#rm-convert-loading');

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
          handleFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
          handleFile(fileInput.files[0]);
        }
      });

      function handleFile(file) {
        selectedFile = file;
        dropText.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        if (!titleInput.value) {
          titleInput.value = file.name.replace(/\.[^.]+$/i, '').replace(/[-_]/g, ' ');
        }
        convertBtn.removeAttribute('disabled');
      }

      convertBtn.addEventListener('click', async () => {
        if (!selectedFile || isConverting) return;
        isConverting = true;
        convertBtn.setAttribute('disabled', 'true');
        convertBtn.textContent = 'Mengonversi…';
        loadingBox.style.display = 'block';

        try {
          const title = titleInput.value.trim() || selectedFile.name;
          const processed = await processFileToCanonicalPdf(selectedFile, title);

          // Baca thumbnail dan page count menggunakan PdfViewer
          const tempContainer = document.createElement('div');
          const pdfViewer = new PdfViewer({ container: tempContainer });
          await pdfViewer.load(processed.pdfBlob);

          const pageCount = pdfViewer.pageCount;
          const thumbData = await pdfViewer.renderThumbnail(1, 140);
          const extractedPages = processed.extractedPages || (await pdfViewer.extractAllPagesText());

          convertedResult = {
            pdfBlob: processed.pdfBlob,
            originalName: selectedFile.name,
            title,
            sourceType: processed.sourceType,
            pageCount,
            thumbData,
            extractedPages
          };

          isConverting = false;
          showToast('File berhasil dikonversi ke PDF');
          render();
        } catch (err) {
          console.error('Gagal konversi:', err);
          alert('Terjadi kesalahan saat mengonversi file: ' + err.message);
          isConverting = false;
          convertBtn.removeAttribute('disabled');
          convertBtn.textContent = 'Konversi ke PDF';
          loadingBox.style.display = 'none';
        }
      });
    } else {
      // Tombol unduh file PDF ke komputer
      container.querySelector('#rm-btn-download-pdf').addEventListener('click', () => {
        const url = URL.createObjectURL(convertedResult.pdfBlob);
        const a = document.createElement('a');
        const pdfFileName = convertedResult.originalName.replace(/\.[^.]+$/i, '') + '.pdf';
        a.href = url;
        a.download = pdfFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast(`Mengunduh ${pdfFileName}`);
      });

      // Tombol simpan ke Rak Modul
      container.querySelector('#rm-btn-save-to-shelf').addEventListener('click', async () => {
        const docId = crypto.randomUUID();
        const docRecord = {
          id: docId,
          title: convertedResult.title,
          course_name: 'Hasil Konversi',
          course_code: convertedResult.sourceType.toUpperCase(),
          source_type: convertedResult.sourceType,
          page_count: convertedResult.pageCount,
          thumb_data: convertedResult.thumbData,
          tags: ['konversi', convertedResult.sourceType],
          status: 'ready',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await saveLocalDocument(docRecord, convertedResult.pdfBlob);
        await saveLocalPages(
          convertedResult.extractedPages.map(p => ({
            document_id: docId,
            page_no: p.page_no,
            text: p.text
          }))
        );

        showToast('Dokumen tersimpan di Rak Modul');
        router.navigate(`/read/${docId}`);
      });

      // Tombol konversi file lain
      container.querySelector('#rm-btn-convert-another').addEventListener('click', () => {
        convertedResult = null;
        selectedFile = null;
        render();
      });
    }
  }

  render();
}

