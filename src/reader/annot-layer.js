// SVG Annotation Layer for Rendering & Drawing Annotations
// Coordinates are stored normalized (0..1) relative to page dimensions
import { getStroke } from 'perfect-freehand';

function getSvgPathFromStroke(stroke) {
  if (!stroke.length) return '';
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );
  d.push('Z');
  return d.join(' ');
}

export class AnnotLayer {
  constructor({ pageNo, container, annotations = [], onAnnotClick, onAnnotDelete, onAddAnnotation }) {
    this.pageNo = pageNo;
    this.container = container;
    this.annotations = annotations;
    this.onAnnotClick = onAnnotClick;
    this.onAnnotDelete = onAnnotDelete;
    this.onAddAnnotation = onAddAnnotation;
    this.svg = null;
    this.activeTool = 'highlight';
    this.activeColor = 'yellow';
  }

  mount() {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'rm-annot-layer');
    this.svg.setAttribute('data-page-no', this.pageNo);
    this.container.appendChild(this.svg);
    this.setupPointerEvents();
    this.render();
    return this.svg;
  }

  setDrawingTool(tool, color) {
    this.activeTool = tool;
    this.activeColor = color;
    if (!this.svg) return;

    if (tool === 'pen') {
      this.svg.style.pointerEvents = 'auto';
      this.svg.style.cursor = 'crosshair';
      this.svg.style.touchAction = 'none';
    } else if (tool === 'eraser') {
      this.svg.style.pointerEvents = 'auto';
      this.svg.style.cursor = 'cell';
      this.svg.style.touchAction = 'none';
    } else {
      this.svg.style.pointerEvents = 'none';
      this.svg.style.cursor = 'default';
      this.svg.style.touchAction = 'auto';
    }
  }

  setupPointerEvents() {
    let currentStroke = [];
    let livePath = null;

    const onPointerDown = (e) => {
      if (this.activeTool === 'eraser') {
        const item = e.target.closest('.rm-annot-item');
        if (item) {
          const id = item.dataset.annotId;
          const annot = this.annotations.find(a => a.id === id);
          if (annot && this.onAnnotDelete) {
            this.onAnnotDelete(annot);
          }
        }
        return;
      }

      if (this.activeTool !== 'pen') return;
      e.preventDefault();
      try {
        this.svg.setPointerCapture(e.pointerId);
      } catch {}

      const rect = this.container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;

      currentStroke = [[x, y, pressure]];

      livePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      livePath.setAttribute('class', 'rm-live-stroke');
      livePath.setAttribute('fill', `var(--mark-${this.activeColor || 'yellow'})`);
      livePath.setAttribute('opacity', '0.85');
      this.svg.appendChild(livePath);
    };

    const onPointerMove = (e) => {
      if (this.activeTool === 'eraser' && e.buttons === 1) {
        const item = e.target.closest('.rm-annot-item');
        if (item) {
          const id = item.dataset.annotId;
          const annot = this.annotations.find(a => a.id === id);
          if (annot && this.onAnnotDelete) {
            this.onAnnotDelete(annot);
          }
        }
        return;
      }

      if (!livePath || this.activeTool !== 'pen') return;
      e.preventDefault();

      const rect = this.container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;

      currentStroke.push([x, y, pressure]);

      const stroke = getStroke(currentStroke, {
        size: 3.5,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5
      });
      livePath.setAttribute('d', getSvgPathFromStroke(stroke));
    };

    const onPointerUp = (e) => {
      if (!livePath) return;
      try {
        this.svg.releasePointerCapture(e.pointerId);
      } catch {}

      if (currentStroke.length > 1) {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        const normalizedPoints = currentStroke.map(([x, y, p]) => [
          Math.max(0, Math.min(1, x / width)),
          Math.max(0, Math.min(1, y / height)),
          p
        ]);

        if (this.onAddAnnotation) {
          this.onAddAnnotation({
            page_no: this.pageNo,
            kind: 'ink',
            color: this.activeColor || 'yellow',
            geometry: { points: normalizedPoints },
            quote: '',
            note_md: ''
          });
        }
      }

      if (livePath && livePath.parentNode) {
        livePath.parentNode.removeChild(livePath);
      }
      livePath = null;
      currentStroke = [];
    };

    this.svg.addEventListener('pointerdown', onPointerDown);
    this.svg.addEventListener('pointermove', onPointerMove);
    this.svg.addEventListener('pointerup', onPointerUp);
    this.svg.addEventListener('pointercancel', onPointerUp);
  }

  updateAnnotations(annotations) {
    this.annotations = annotations;
    this.render();
  }

  render() {
    if (!this.svg) return;
    this.svg.innerHTML = '';

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.svg.setAttribute('width', width);
    this.svg.setAttribute('height', height);
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    for (const annot of this.annotations) {
      if (annot.deleted) continue;
      this.renderAnnotation(annot, width, height);
    }
  }

  renderAnnotation(annot, width, height) {
    const { kind, color = 'yellow', geometry, id } = annot;
    if (!geometry) return;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `rm-annot-item rm-annot-${kind}`);
    g.setAttribute('data-annot-id', id);
    g.style.cursor = this.activeTool === 'eraser' ? 'cell' : 'pointer';

    g.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.activeTool === 'eraser') {
        if (this.onAnnotDelete) this.onAnnotDelete(annot);
      } else {
        if (this.onAnnotClick) this.onAnnotClick(annot);
      }
    });

    if (kind === 'highlight' && geometry.rects) {
      for (const r of geometry.rects) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', r.x * width);
        rect.setAttribute('y', r.y * height);
        rect.setAttribute('width', r.w * width);
        rect.setAttribute('height', r.h * height);
        rect.setAttribute('rx', '2');
        rect.setAttribute('fill', `var(--mark-${color})`);
        g.appendChild(rect);
      }
    } else if (kind === 'underline' && geometry.rects) {
      for (const r of geometry.rects) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const yPos = (r.y + r.h) * height;
        line.setAttribute('x1', r.x * width);
        line.setAttribute('y1', yPos);
        line.setAttribute('x2', (r.x + r.w) * width);
        line.setAttribute('y2', yPos);
        line.setAttribute('stroke', `var(--mark-${color})`);
        line.setAttribute('stroke-width', '2.5');
        g.appendChild(line);
      }
    } else if (kind === 'strike' && geometry.rects) {
      for (const r of geometry.rects) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const yPos = (r.y + r.h * 0.5) * height;
        line.setAttribute('x1', r.x * width);
        line.setAttribute('y1', yPos);
        line.setAttribute('x2', (r.x + r.w) * width);
        line.setAttribute('y2', yPos);
        line.setAttribute('stroke', 'var(--correction)');
        line.setAttribute('stroke-width', '2');
        g.appendChild(line);
      }
    } else if (kind === 'ink' && geometry.points && geometry.points.length > 0) {
      const scaledPoints = geometry.points.map(([rx, ry, p]) => [
        rx * width,
        ry * height,
        p !== undefined ? p : 0.5
      ]);
      const stroke = getStroke(scaledPoints, {
        size: 3.5,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5
      });
      const pathData = getSvgPathFromStroke(stroke);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('fill', `var(--mark-${color})`);
      path.setAttribute('opacity', '0.85');
      g.appendChild(path);
    } else if (kind === 'sticky' && geometry.point) {
      const pin = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      pin.setAttribute('cx', geometry.point.x * width);
      pin.setAttribute('cy', geometry.point.y * height);
      pin.setAttribute('r', '8');
      pin.setAttribute('fill', 'var(--pen)');
      pin.setAttribute('stroke', 'var(--surface)');
      pin.setAttribute('stroke-width', '2');
      g.appendChild(pin);
    }

    this.svg.appendChild(g);
  }

  destroy() {
    if (this.svg && this.svg.parentNode) {
      this.svg.parentNode.removeChild(this.svg);
    }
  }
}
