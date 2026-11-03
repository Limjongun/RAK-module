// Exporter: Ekspor Catatan ke Markdown / Obsidian & Ekspor PDF Beranotasi via pdf-lib
import { PDFDocument, rgb } from 'pdf-lib';
import { showToast } from '../ui/toast.js';

const COLOR_MAP_HEX = {
  yellow: '#f9e852',
  green: '#99e9a8',
  blue: '#a5d8ff',
  pink: '#ffc9c9',
  violet: '#e599f7'
};

const COLOR_LABEL_MAP = {
  yellow: 'Kuning (Penting)',
  green: 'Hijau (Definisi)',
  blue: 'Biru (Contoh)',
  pink: 'Merah Muda (Belum Paham)',
  violet: 'Ungu (Ujian)'
};

const COLOR_RGB_MAP = {
  yellow: rgb(0.98, 0.91, 0.32),
  green: rgb(0.60, 0.91, 0.66),
  blue: rgb(0.65, 0.85, 1.0),
  pink: rgb(1.0, 0.79, 0.79),
  violet: rgb(0.90, 0.60, 0.97)
};

// 1. Ekspor Seluruh Catatan & Sorotan ke Format Markdown (.md) Obsidian / Notion
export function exportNotesToMarkdown(doc, annotations = []) {
  if (!doc) return;

  const validAnnotations = annotations.filter(a => !a.deleted);
  const dateStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Urutkan berdasarkan nomor halaman lalu waktu
  const sorted = [...validAnnotations].sort((a, b) => {
    if (a.page_no !== b.page_no) return a.page_no - b.page_no;
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });

  // Kelompokkan per halaman
  const pageGroups = new Map();
  for (const a of sorted) {
    if (!pageGroups.has(a.page_no)) pageGroups.set(a.page_no, []);
    pageGroups.get(a.page_no).push(a);
  }

  let md = `# Catatan Modul: ${doc.title}\n\n`;
  md += `- **Mata Kuliah:** ${doc.course_name || 'Umum'} ${doc.course_code ? `(${doc.course_code})` : ''}\n`;
  md += `- **Format Asal:** ${(doc.source_type || 'PDF').toUpperCase()}\n`;
  md += `- **Tanggal Ekspor:** ${dateStr}\n`;
  md += `- **Total Anotasi:** ${validAnnotations.length} catatan/sorotan\n`;
  if (doc.tags && doc.tags.length > 0) {
    md += `- **Tag:** ${doc.tags.map(t => `#${t.replace(/\s+/g, '_')}`).join(' ')}\n`;
  }
  md += `\n---\n\n`;

  if (validAnnotations.length === 0) {
    md += `*Belum ada catatan atau sorotan yang dibuat pada modul ini.*\n`;
  } else {
    for (const [pageNo, items] of pageGroups.entries()) {
      md += `## Halaman ${pageNo}\n\n`;
      for (const item of items) {
        const colorLabel = COLOR_LABEL_MAP[item.color] || item.color || 'Sorotan';
        const kindLabel = item.kind === 'strike' ? 'Coretan' : item.kind === 'underline' ? 'Garis Bawah' : item.kind === 'ink' ? 'Coretan Pena' : 'Sorot';

        if (item.quote) {
          md += `> [!NOTE] ${kindLabel} · ${colorLabel}\n`;
          md += `> "${item.quote}"\n\n`;
        }

        if (item.note_md) {
          md += `**Catatan:**\n${item.note_md}\n\n`;
        }

        if (item.kind === 'ink') {
          md += `*✍️ Coretan tangan bebas di halaman ${pageNo}*\n\n`;
        }
      }
      md += `---\n\n`;
    }
  }

  md += `\n*Diekspor dari Rak Modul — Web Pembaca Modul Kuliah Pribadi*\n`;

  // Download file .md
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const filename = `Catatan_${(doc.title || 'Modul').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')}.md`;
  downloadBlob(blob, filename);
  showToast('Catatan berhasil diekspor ke format Markdown');
}

// 2. Ekspor File PDF Beranotasi (Mencetak sorotan & coretan langsung di lembar PDF)
export async function exportAnnotatedPdf(doc, annotations = [], originalPdfBlob) {
  if (!originalPdfBlob) {
    alert('File PDF asli tidak tersedia untuk diekspor.');
    return;
  }

  showToast('Menyiapkan ekspor PDF beranotasi…');

  try {
    const arrayBuffer = await originalPdfBlob.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pageCount = pdfDoc.getPageCount();

    const validAnnotations = annotations.filter(a => !a.deleted);

    for (const annot of validAnnotations) {
      const pageIndex = annot.page_no - 1;
      if (pageIndex < 0 || pageIndex >= pageCount) continue;

      const page = pdfDoc.getPage(pageIndex);
      const { width: pWidth, height: pHeight } = page.getSize();
      const rgbColor = COLOR_RGB_MAP[annot.color] || COLOR_RGB_MAP.yellow;

      // 1. Highlight
      if (annot.kind === 'highlight' && annot.geometry?.rects) {
        for (const r of annot.geometry.rects) {
          const x = r.x * pWidth;
          const y = pHeight - (r.y + r.h) * pHeight;
          const w = r.w * pWidth;
          const h = r.h * pHeight;

          page.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            color: rgbColor,
            opacity: 0.4
          });
        }
      }

      // 2. Underline
      if (annot.kind === 'underline' && annot.geometry?.rects) {
        for (const r of annot.geometry.rects) {
          const x1 = r.x * pWidth;
          const yPos = pHeight - (r.y + r.h) * pHeight;
          const x2 = (r.x + r.w) * pWidth;

          page.drawLine({
            start: { x: x1, y: yPos },
            end: { x: x2, y: yPos },
            thickness: 2,
            color: rgbColor,
            opacity: 0.9
          });
        }
      }

      // 3. Strikethrough
      if (annot.kind === 'strike' && annot.geometry?.rects) {
        for (const r of annot.geometry.rects) {
          const x1 = r.x * pWidth;
          const yPos = pHeight - (r.y + r.h * 0.5) * pHeight;
          const x2 = (r.x + r.w) * pWidth;

          page.drawLine({
            start: { x: x1, y: yPos },
            end: { x: x2, y: yPos },
            thickness: 1.5,
            color: rgb(0.85, 0.2, 0.2),
            opacity: 0.85
          });
        }
      }

      // 4. Freehand Ink (Coretan Pena Bebas)
      if (annot.kind === 'ink' && annot.geometry?.points) {
        const pts = annot.geometry.points;
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          page.drawLine({
            start: { x: p1[0] * pWidth, y: pHeight - p1[1] * pHeight },
            end: { x: p2[0] * pWidth, y: pHeight - p2[1] * pHeight },
            thickness: Math.max(1.5, (p1[2] || 0.5) * 4),
            color: rgbColor,
            opacity: 0.85
          });
        }
      }

      // 5. Catatan Tempel / Sticky note icon
      if (annot.kind === 'sticky' && annot.geometry?.point) {
        const pt = annot.geometry.point;
        page.drawCircle({
          x: pt.x * pWidth,
          y: pHeight - pt.y * pHeight,
          size: 6,
          color: rgb(0.15, 0.25, 0.69),
          opacity: 0.9
        });
      }
    }

    const modifiedBytes = await pdfDoc.save();
    const pdfBlob = new Blob([modifiedBytes], { type: 'application/pdf' });
    const filename = `Modul_${(doc.title || 'Kuliah').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')}_Beranotasi.pdf`;

    downloadBlob(pdfBlob, filename);
    showToast('PDF Beranotasi berhasil diunduh');
  } catch (err) {
    console.error('Gagal mengekspor PDF:', err);
    alert('Terjadi kesalahan saat memproses ekspor PDF: ' + err.message);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}

