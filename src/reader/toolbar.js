// Floating Annotation Toolbar Component
import { icon } from '../ui/icons.js';

export class AnnotationToolbar {
  constructor({ onToolChange, onColorChange, activeTool = 'highlight', activeColor = 'yellow' }) {
    this.onToolChange = onToolChange;
    this.onColorChange = onColorChange;
    this.activeTool = activeTool;
    this.activeColor = activeColor;
    this.element = null;
  }

  render() {
    const div = document.createElement('div');
    div.className = 'rm-toolbar rm-floating-toolbar';
    div.setAttribute('role', 'toolbar');
    div.setAttribute('aria-label', 'Alat anotasi');

    div.innerHTML = `
      <button class="rm-tool" data-tool="highlight" aria-pressed="${this.activeTool === 'highlight'}" aria-label="Sorot (H)" title="Sorot (H)">
        ${icon('highlight')}
      </button>
      <button class="rm-tool" data-tool="underline" aria-pressed="${this.activeTool === 'underline'}" aria-label="Garis bawah (U)" title="Garis bawah (U)">
        ${icon('underline')}
      </button>
      <button class="rm-tool" data-tool="strike" aria-pressed="${this.activeTool === 'strike'}" aria-label="Coret (S)" title="Coret (S)">
        ${icon('strike')}
      </button>
      <button class="rm-tool" data-tool="pen" aria-pressed="${this.activeTool === 'pen'}" aria-label="Pena (P)" title="Pena (P)">
        ${icon('pen')}
      </button>
      <button class="rm-tool" data-tool="note" aria-pressed="${this.activeTool === 'note'}" aria-label="Catatan (N)" title="Catatan (N)">
        ${icon('note')}
      </button>
      <button class="rm-tool" data-tool="eraser" aria-pressed="${this.activeTool === 'eraser'}" aria-label="Penghapus (E)" title="Penghapus (E)">
        ${icon('eraser')}
      </button>
      <span class="rm-sep" aria-hidden="true"></span>
      <span role="radiogroup" aria-label="Warna sorot" style="display:inline-flex;align-items:center;padding:0 4px">
        <button class="rm-swatch rm-sw-yellow" data-color="yellow" role="radio" aria-checked="${this.activeColor === 'yellow'}" aria-label="Kuning: penting" title="Kuning: penting"></button>
        <button class="rm-swatch rm-sw-green" data-color="green" role="radio" aria-checked="${this.activeColor === 'green'}" aria-label="Hijau: definisi" title="Hijau: definisi"></button>
        <button class="rm-swatch rm-sw-blue" data-color="blue" role="radio" aria-checked="${this.activeColor === 'blue'}" aria-label="Biru: contoh" title="Biru: contoh"></button>
        <button class="rm-swatch rm-sw-pink" data-color="pink" role="radio" aria-checked="${this.activeColor === 'pink'}" aria-label="Merah muda: belum paham" title="Merah muda: belum paham"></button>
        <button class="rm-swatch rm-sw-violet" data-color="violet" role="radio" aria-checked="${this.activeColor === 'violet'}" aria-label="Ungu: ujian" title="Ungu: ujian"></button>
      </span>
    `;

    // Tool click
    div.querySelectorAll('.rm-tool').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        this.setTool(tool);
      });
    });

    // Swatch click
    div.querySelectorAll('.rm-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        this.setColor(color);
      });
    });

    // Keyboard shortcuts
    this.keyHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toUpperCase();
      if (key === 'H') this.setTool('highlight');
      else if (key === 'U') this.setTool('underline');
      else if (key === 'S') this.setTool('strike');
      else if (key === 'P') this.setTool('pen');
      else if (key === 'N') this.setTool('note');
      else if (key === 'E') this.setTool('eraser');
    };
    window.addEventListener('keydown', this.keyHandler);

    this.element = div;
    return div;
  }

  setTool(tool) {
    this.activeTool = tool;
    if (this.element) {
      this.element.querySelectorAll('.rm-tool').forEach(btn => {
        btn.setAttribute('aria-pressed', btn.dataset.tool === tool ? 'true' : 'false');
      });
    }
    if (this.onToolChange) this.onToolChange(tool);
  }

  setColor(color) {
    this.activeColor = color;
    if (this.element) {
      this.element.querySelectorAll('.rm-swatch').forEach(btn => {
        btn.setAttribute('aria-checked', btn.dataset.color === color ? 'true' : 'false');
      });
    }
    if (this.onColorChange) this.onColorChange(color);
  }

  destroy() {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

