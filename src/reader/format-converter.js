// In-Browser Multi-format to Canonical PDF Converter
// Supports:
// - PDF (.pdf)
// - Word (.docx)
// - PowerPoint Presentations (.pptx)
// - E-Books (.epub)
// - Text & Markdown (.txt, .md)
// - Images / Scanned Notes (.png, .jpg, .jpeg, .webp)

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import mammoth from 'mammoth';
import JSZip from 'jszip';

// Cache karakter yang valid untuk WinAnsi
const validCharCache = new Map();

function isEncodable(char, font) {
  if (validCharCache.has(char)) return validCharCache.get(char);
  try {
    font.encodeText(char);
    validCharCache.set(char, true);
    return true;
  } catch {
    validCharCache.set(char, false);
    return false;
  }
}

// Sanitasi karakter Unicode ke format yang didukung WinAnsi di pdf-lib
export function sanitizeForPdf(text, font) {
  if (!text) return '';
  let s = text
    // Panah (Arrows)
    .replace(/[\u2192\u2794\u279C\u27A1\u21E2\u21FE]/g, '->')
    .replace(/[\u2190\u21E0\u21FD]/g, '<-')
    .replace(/[\u2194\u21E4]/g, '<->')
    .replace(/[\u21D2\u21E8]/g, '=>')
    .replace(/[\u21D0\u21E6]/g, '<=')
    .replace(/\u21D4/g, '<=>')
    .replace(/[\u2191\u25B2\u21E1]/g, '^')
    .replace(/[\u2193\u25BC\u21E3]/g, 'v')
    // Simbol Matematika & Pembanding
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u2260/g, '!=')
    .replace(/\u2248/g, '~=')
    .replace(/\u00D7/g, 'x')
    .replace(/\u00F7/g, '/')
    .replace(/[\u221E\u221D]/g, 'inf')
    .replace(/\u221A/g, 'sqrt')
    .replace(/\u2211/g, 'Sum')
    .replace(/\u220F/g, 'Prod')
    .replace(/\u2208/g, 'in')
    .replace(/\u2209/g, 'not in')
    .replace(/[\u2282\u2286]/g, 'subset')
    // Huruf Yunani umum
    .replace(/[\u03B1\u0391]/g, 'alpha')
    .replace(/[\u03B2\u0392]/g, 'beta')
    .replace(/[\u03B3\u0393]/g, 'gamma')
    .replace(/[\u03B4\u0394]/g, 'delta')
    .replace(/[\u03B8\u0398]/g, 'theta')
    .replace(/[\u03BB\u039B]/g, 'lambda')
    .replace(/[\u03BC\u039C]/g, 'mu')
    .replace(/[\u03C0\u03A0]/g, 'pi')
    .replace(/[\u03C3\u03A3]/g, 'sigma')
    // Tanda petik, tanda pisah, bullet points
    .replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u2013\u2014\u2015]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u25CF\u25AA\u25BA\u25C6\u25A0\u2023\u2043]/g, '-')
    .replace(/[\u2713\u2714\u2611]/g, '[v]')
    .replace(/[\u2717\u2718\u2612]/g, '[x]')
    .replace(/\t/g, '    ');

  let out = '';
  for (const c of s) {
    out += isEncodable(c, font) ? c : ' ';
  }
  return out;
}

// Word wrapping helper for pdf-lib dengan proteksi WinAnsi
function wrapText(text, maxWidth, fontSize, font) {
  if (!text) return [''];
  const safeText = sanitizeForPdf(text, font);
  const words = safeText.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// 1. Convert Word (.docx) to Canonical PDF
export async function convertDocxToPdf(file, title = '') {
  const arrayBuffer = await file.arrayBuffer();
  const { value: rawText } = await mammoth.extractRawText({ arrayBuffer });
  const docTitle = title || file.name.replace(/\.docx?$/i, '');

  return textToPdf(rawText, docTitle, 'docx');
}

// 2. Convert PowerPoint (.pptx) to Canonical Landscape Slide PDF
export async function convertPptxToPdf(file, title = '') {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const slideFiles = [];
  zip.forEach((relativePath) => {
    if (/^ppt\/slides\/slide\d+\.xml$/i.test(relativePath)) {
      slideFiles.push(relativePath);
    }
  });

  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)\.xml/i)[1], 10);
    const numB = parseInt(b.match(/slide(\d+)\.xml/i)[1], 10);
    return numA - numB;
  });

  if (slideFiles.length === 0) {
    throw new Error('Tidak ditemukan slide di dalam file PowerPoint ini.');
  }

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const slideWidth = 842; // A4 Landscape (16:9 lecture format)
  const slideHeight = 595;
  const marginX = 60;
  const marginTop = 55;
  const marginBottom = 45;
  const contentWidth = slideWidth - marginX * 2;

  const extractedPages = [];
  const docTitle = title || file.name.replace(/\.pptx?$/i, '');

  for (let idx = 0; idx < slideFiles.length; idx++) {
    const slidePath = slideFiles[idx];
    const xmlContent = await zip.file(slidePath).async('text');

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

    const pElements = xmlDoc.getElementsByTagNameNS('*', 'p');
    const slideParagraphs = [];

    for (let p of pElements) {
      let pText = '';
      const tElements = p.getElementsByTagNameNS('*', 't');
      for (let t of tElements) {
        pText += t.textContent;
      }
      pText = pText.trim();
      if (pText) slideParagraphs.push(pText);
    }

    const page = pdfDoc.addPage([slideWidth, slideHeight]);
    let currentY = slideHeight - marginTop;

    const rawHeading = slideParagraphs[0] || `Slide ${idx + 1}`;
    const slideHeading = sanitizeForPdf(rawHeading.slice(0, 75), fontBold);
    page.drawText(slideHeading, {
      x: marginX,
      y: currentY,
      size: 20,
      font: fontBold,
      color: rgb(0.15, 0.25, 0.69)
    });
    currentY -= 30;

    const subHeader = sanitizeForPdf(`${docTitle} · Slide ${idx + 1} dari ${slideFiles.length}`, fontRegular);
    page.drawText(subHeader, {
      x: marginX,
      y: currentY,
      size: 10,
      font: fontRegular,
      color: rgb(0.45, 0.50, 0.48)
    });
    currentY -= 32;

    const bodyParas = slideParagraphs.slice(1);
    const pageTextParts = [slideHeading];

    for (const para of bodyParas) {
      const bulletText = `•  ${para}`;
      const lines = wrapText(bulletText, contentWidth, 13, fontRegular);

      for (const line of lines) {
        if (currentY < marginBottom + 20) break;
        page.drawText(line, {
          x: marginX,
          y: currentY,
          size: 13,
          font: fontRegular,
          color: rgb(0.11, 0.14, 0.13)
        });
        currentY -= 22;
      }
      currentY -= 8;
      pageTextParts.push(para);
    }

    page.drawText(`Slide ${idx + 1}`, {
      x: slideWidth - marginX - 35,
      y: 25,
      size: 9,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5)
    });

    extractedPages.push({
      page_no: idx + 1,
      text: pageTextParts.join('\n')
    });
  }

  const pdfBytes = await pdfDoc.save();
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

  return { pdfBlob, extractedPages, pageCount: slideFiles.length };
}

// 3. Convert E-Book (.epub) to Canonical Book PDF
export async function convertEpubToPdf(file, title = '') {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  let opfPath = 'OEBPS/content.opf';
  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (containerXml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(containerXml, 'application/xml');
    const rootfile = doc.querySelector('rootfile');
    if (rootfile && rootfile.getAttribute('full-path')) {
      opfPath = rootfile.getAttribute('full-path');
    }
  }

  const opfContent = await zip.file(opfPath)?.async('text');
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

  let htmlFiles = [];
  if (opfContent) {
    const parser = new DOMParser();
    const opfDoc = parser.parseFromString(opfContent, 'application/xml');
    const manifestItems = new Map();
    opfDoc.querySelectorAll('manifest > item').forEach(item => {
      manifestItems.set(item.getAttribute('id'), item.getAttribute('href'));
    });

    opfDoc.querySelectorAll('spine > itemref').forEach(itemref => {
      const idref = itemref.getAttribute('idref');
      const href = manifestItems.get(idref);
      if (href) {
        htmlFiles.push(opfDir + href);
      }
    });
  }

  if (htmlFiles.length === 0) {
    zip.forEach((path) => {
      if (/\.(xhtml|html|htm)$/i.test(path) && !/toc/i.test(path)) {
        htmlFiles.push(path);
      }
    });
  }

  const parser = new DOMParser();
  const fullBookText = [];

  for (const hPath of htmlFiles) {
    const zFile = zip.file(hPath);
    if (!zFile) continue;
    const html = await zFile.async('text');
    const doc = parser.parseFromString(html, 'text/html');

    doc.querySelectorAll('script, style').forEach(el => el.remove());

    const paragraphs = Array.from(doc.querySelectorAll('h1, h2, h3, p, blockquote'))
      .map(p => p.textContent.trim())
      .filter(Boolean);

    if (paragraphs.length > 0) {
      fullBookText.push(paragraphs.join('\n\n'));
    }
  }

  const docTitle = title || file.name.replace(/\.epub$/i, '');
  return textToPdf(fullBookText.join('\n\n---\n\n'), docTitle, 'epub');
}

// 4. Convert Text / Markdown (.txt, .md) to Canonical PDF
export async function convertTextToPdf(file, title = '') {
  const rawText = await file.text();
  const docTitle = title || file.name.replace(/\.(txt|md)$/i, '');

  return textToPdf(rawText, docTitle, file.name.endsWith('.md') ? 'md' : 'txt');
}

// Common text paginator to PDF dengan sanitasi WinAnsi
async function textToPdf(rawText, docTitle, sourceType = 'txt') {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595; // A4
  const pageHeight = 842;
  const marginX = 50;
  const marginTop = 60;
  const marginBottom = 60;
  const contentWidth = pageWidth - marginX * 2;
  const fontSize = 11;
  const lineHeight = 18;

  const paragraphs = rawText.split(/\r?\n\r?\n/);
  const allLines = [];

  for (const para of paragraphs) {
    const cleanPara = para.replace(/\r?\n/g, ' ').trim();
    if (!cleanPara) continue;
    const lines = wrapText(cleanPara, contentWidth, fontSize, fontRegular);
    allLines.push(...lines);
    allLines.push('');
  }

  const usableHeight = pageHeight - marginTop - marginBottom;
  let pageIndex = 0;
  let linePtr = 0;
  const extractedPages = [];

  while (linePtr < allLines.length || pageIndex === 0) {
    pageIndex++;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - marginTop;
    const pageLines = [];

    if (pageIndex === 1) {
      const safeTitle = sanitizeForPdf(docTitle.slice(0, 60), fontBold);
      page.drawText(safeTitle, {
        x: marginX,
        y: currentY,
        size: 18,
        font: fontBold,
        color: rgb(0.15, 0.25, 0.69)
      });
      currentY -= 28;

      const safeBadge = sanitizeForPdf(`Format Asal: ${sourceType.toUpperCase()} · Dikonversi ke Format Kanonik Rak Modul`, fontRegular);
      page.drawText(safeBadge, {
        x: marginX,
        y: currentY,
        size: 9,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.42)
      });
      currentY -= 24;
    } else {
      const safeHeader = sanitizeForPdf(docTitle.slice(0, 50), fontRegular);
      page.drawText(safeHeader, {
        x: marginX,
        y: pageHeight - 35,
        size: 9,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5)
      });
    }

    const availableLinesThisPage = Math.floor((currentY - marginBottom) / lineHeight);
    const takeCount = Math.min(availableLinesThisPage, allLines.length - linePtr);

    for (let i = 0; i < takeCount; i++) {
      const line = allLines[linePtr + i];
      if (line) {
        page.drawText(line, {
          x: marginX,
          y: currentY,
          size: fontSize,
          font: fontRegular,
          color: rgb(0.1, 0.14, 0.12)
        });
        pageLines.push(line);
      }
      currentY -= lineHeight;
    }

    linePtr += takeCount;

    page.drawText(`Hal. ${pageIndex}`, {
      x: pageWidth - marginX - 35,
      y: 35,
      size: 9,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5)
    });

    extractedPages.push({
      page_no: pageIndex,
      text: pageLines.join(' ')
    });

    if (linePtr >= allLines.length) break;
  }

  const pdfBytes = await pdfDoc.save();
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

  return { pdfBlob, extractedPages, pageCount: pageIndex };
}

// 5. Convert Image (.png, .jpg, .jpeg, .webp) to Canonical PDF
export async function convertImageToPdf(file, title = '') {
  const pdfDoc = await PDFDocument.create();
  const imageBytes = await file.arrayBuffer();

  let embeddedImage;
  const type = file.type.toLowerCase();
  if (type.includes('png')) {
    embeddedImage = await pdfDoc.embedPng(imageBytes);
  } else {
    embeddedImage = await pdfDoc.embedJpg(imageBytes);
  }

  const imgWidth = embeddedImage.width;
  const imgHeight = embeddedImage.height;

  const page = pdfDoc.addPage([imgWidth, imgHeight]);
  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: imgWidth,
    height: imgHeight
  });

  const pdfBytes = await pdfDoc.save();
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
  const docTitle = title || file.name.replace(/\.[^.]+$/i, '');

  return {
    pdfBlob,
    extractedPages: [
      { page_no: 1, text: `${docTitle} (Gambar / Dokumen Scan)` }
    ],
    pageCount: 1
  };
}

// Master Dispatcher
export async function processFileToCanonicalPdf(file, title = '') {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();

  if (ext === '.pdf') {
    return {
      pdfBlob: file,
      isNativePdf: true,
      sourceType: 'pdf'
    };
  }

  if (ext === '.pptx') {
    const res = await convertPptxToPdf(file, title);
    return { ...res, isNativePdf: false, sourceType: 'pptx' };
  }

  if (ext === '.epub') {
    const res = await convertEpubToPdf(file, title);
    return { ...res, isNativePdf: false, sourceType: 'epub' };
  }

  if (ext === '.docx') {
    const res = await convertDocxToPdf(file, title);
    return { ...res, isNativePdf: false, sourceType: 'docx' };
  }

  if (ext === '.txt' || ext === '.md') {
    const res = await convertTextToPdf(file, title);
    return { ...res, isNativePdf: false, sourceType: ext.slice(1) };
  }

  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    const res = await convertImageToPdf(file, title);
    return { ...res, isNativePdf: false, sourceType: 'image' };
  }

  if (ext === '.ppt') {
    throw new Error('Format PowerPoint lama (.ppt) terdeteksi. Silakan simpan ulang sebagai .pptx di PowerPoint / Google Slides agar dapat dikonversi langsung.');
  }

  throw new Error(`Format file "${ext}" belum didukung. Gunakan PDF, PPTX, EPUB, DOCX, TXT, MD, atau Gambar.`);
}
