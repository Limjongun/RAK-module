// PDF View Engine using pdfjs-dist 4.x
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { AnnotLayer } from './annot-layer.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export class PdfViewer {
  constructor({ container, onPageRendered, onAnnotationClick, onAnnotationDelete, onAddAnnotation }) {
    this.container = container;
    this.onPageRendered = onPageRendered;
    this.onAnnotationClick = onAnnotationClick;
    this.onAnnotationDelete = onAnnotationDelete;
    this.onAddAnnotation = onAddAnnotation;
    this.pdfDoc = null;
    this.scale = 1.2;
    this.pageCount = 0;
    this.pagesRendered = new Map();
    this.annotLayers = new Map();
    this.pageTexts = new Map();
    this.activeTool = 'highlight';
    this.activeColor = 'yellow';
  }

  async load(src) {
    let loadingTask;
    if (src instanceof Blob) {
      const buffer = await src.arrayBuffer();
      loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    } else if (src instanceof ArrayBuffer || src instanceof Uint8Array) {
      loadingTask = pdfjsLib.getDocument({ data: src });
    } else {
      loadingTask = pdfjsLib.getDocument(src);
    }

    this.pdfDoc = await loadingTask.promise;
    this.pageCount = this.pdfDoc.numPages;
    return this.pdfDoc;
  }

  async renderAllPages({ annotations = [] } = {}) {
    this.container.innerHTML = '';
    this.pagesRendered.clear();
    this.annotLayers.clear();

    for (let pageNo = 1; pageNo <= this.pageCount; pageNo++) {
      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'rm-pdf-page';
      pageWrapper.id = `rm-page-${pageNo}`;
      pageWrapper.dataset.pageNo = pageNo;

      this.container.appendChild(pageWrapper);
      await this.renderPage(pageNo, pageWrapper, annotations.filter(a => a.page_no === pageNo));
    }
  }

  async renderPage(pageNo, pageWrapper, pageAnnotations = []) {
    const page = await this.pdfDoc.getPage(pageNo);

    // Auto-fit skala responsif: Jika di mobile atau lebar container lebih sempit dari viewport
    let effectiveScale = this.scale;
    const containerWidth = (this.container && this.container.clientWidth) || (typeof window !== 'undefined' ? window.innerWidth : 800);
    const unscaledViewport = page.getViewport({ scale: 1.0 });

    if (containerWidth > 0 && containerWidth < unscaledViewport.width * this.scale) {
      effectiveScale = Math.max(0.35, (containerWidth - 16) / unscaledViewport.width);
    }

    const viewport = page.getViewport({ scale: effectiveScale });

    pageWrapper.style.width = `${viewport.width}px`;
    pageWrapper.style.height = `${viewport.height}px`;

    // 1. Canvas Layer
    const canvas = document.createElement('canvas');
    canvas.className = 'rm-pdf-canvas';
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    ctx.scale(dpr, dpr);

    pageWrapper.innerHTML = '';
    pageWrapper.appendChild(canvas);

    await page.render({ canvasContext: ctx, viewport }).promise;

    // 2. Text Layer
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.width = `${viewport.width}px`;
    textLayerDiv.style.height = `${viewport.height}px`;
    pageWrapper.appendChild(textLayerDiv);

    const textContent = await page.getTextContent();
    const textLayer = new pdfjsLib.TextLayer({
      textContentSource: textContent,
      container: textLayerDiv,
      viewport
    });
    await textLayer.render();

    // Cache plain text for search and TTS
    const fullText = textContent.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('');
    this.pageTexts.set(pageNo, fullText);

    // 3. SVG Annotation Layer
    const annotLayer = new AnnotLayer({
      pageNo,
      container: pageWrapper,
      annotations: pageAnnotations,
      onAnnotClick: (annot) => {
        if (this.onAnnotationClick) this.onAnnotationClick(annot);
      },
      onAnnotDelete: (annot) => {
        if (this.onAnnotationDelete) this.onAnnotationDelete(annot);
      },
      onAddAnnotation: (annot) => {
        if (this.onAddAnnotation) this.onAddAnnotation(annot);
      }
    });
    annotLayer.mount();
    annotLayer.setDrawingTool(this.activeTool, this.activeColor);
    this.annotLayers.set(pageNo, annotLayer);

    this.pagesRendered.set(pageNo, { pageWrapper, page, viewport });
    if (this.onPageRendered) this.onPageRendered(pageNo, fullText);
  }

  setDrawingTool(tool, color) {
    this.activeTool = tool;
    this.activeColor = color;
    for (const layer of this.annotLayers.values()) {
      layer.setDrawingTool(tool, color);
    }
  }

  updateAnnotations(annotations) {
    for (let pageNo = 1; pageNo <= this.pageCount; pageNo++) {
      const layer = this.annotLayers.get(pageNo);
      if (layer) {
        layer.updateAnnotations(annotations.filter(a => a.page_no === pageNo));
      }
    }
  }

  async extractAllPagesText() {
    const results = [];
    for (let pageNo = 1; pageNo <= this.pageCount; pageNo++) {
      if (this.pageTexts.has(pageNo)) {
        results.push({ page_no: pageNo, text: this.pageTexts.get(pageNo) });
      } else {
        const page = await this.pdfDoc.getPage(pageNo);
        const textContent = await page.getTextContent();
        const text = textContent.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('');
        results.push({ page_no: pageNo, text });
      }
    }
    return results;
  }

  async getOutline() {
    if (!this.pdfDoc) return [];
    try {
      const outline = await this.pdfDoc.getOutline();
      return outline || [];
    } catch {
      return [];
    }
  }

  goToPage(pageNo) {
    const pageEl = document.getElementById(`rm-page-${pageNo}`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async renderThumbnail(pageNo = 1, maxWidth = 120) {
    if (!this.pdfDoc) return null;
    const page = await this.pdfDoc.getPage(pageNo);
    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = maxWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/webp', 0.85);
  }
}

