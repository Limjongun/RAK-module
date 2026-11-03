// Text Layer utilities: Normalized selection coordinates & Sentence segmentation

export function getSelectionNormalizedCoords(pageElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const pageRect = pageElement.getBoundingClientRect();
  const clientRects = range.getClientRects();

  if (clientRects.length === 0) return null;

  const rects = [];
  for (let i = 0; i < clientRects.length; i++) {
    const r = clientRects[i];
    // Pastikan berada di dalam halaman
    if (r.width > 0 && r.height > 0) {
      rects.push({
        x: Math.max(0, (r.left - pageRect.left) / pageRect.width),
        y: Math.max(0, (r.top - pageRect.top) / pageRect.height),
        w: Math.min(1, r.width / pageRect.width),
        h: Math.min(1, r.height / pageRect.height)
      });
    }
  }

  const quote = selection.toString().trim();
  return { rects, quote };
}

// Segment page text into sentences with sentence boundaries for TTS
export function segmentSentences(rawText) {
  if (!rawText) return [];

  // Normalisasi bullet point, tanda pisah, dan pemisah baris menjadi pembatas kalimat alami
  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/(?:^|\n)\s*[-•●■◆*]\s*/g, '.\n') // bullet di awal baris
    .replace(/\s+[-•●■◆]\s+/g, '.\n')          // bullet di tengah kalimat
    .replace(/\n{2,}/g, '.\n')
    .replace(/\n/g, '.\n');                     // baris baru diperlakukan sebagai jeda kalimat

  // Use Intl.Segmenter if supported by browser
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('id', { granularity: 'sentence' });
    const segments = [...segmenter.segment(normalized)];
    return segments
      .map(s => s.segment.replace(/^[.\s\-_–—]+|[.\s\-_–—]+$/g, '').trim())
      .filter(s => s.length > 2 && !/^\d+$/.test(s)); // filter out standalone page numbers
  }

  // Fallback regex segmentation
  return normalized
    .split(/(?<=[.?!;])\s+|\n+/)
    .map(s => s.replace(/^[.\s\-_–—]+|[.\s\-_–—]+$/g, '').trim())
    .filter(s => s.length > 2 && !/^\d+$/.test(s));
}

