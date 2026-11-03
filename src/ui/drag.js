// Utility untuk membuat elemen modal dapat digeser (draggable)
// Mendukung Mouse di Desktop, Stylus/Pen, dan Touch Gestures di Layar HP/Mobile

export function makeDraggable(modalEl, handleEl) {
  let isDragging = false;
  let startPointerX = 0;
  let startPointerY = 0;
  let initialTranslateX = 0;
  let initialTranslateY = 0;
  let currentTranslateX = 0;
  let currentTranslateY = 0;

  handleEl.style.cursor = 'grab';
  handleEl.style.touchAction = 'none';

  function onPointerDown(e) {
    if (e.target.closest('button, input, textarea, select, a, [data-no-drag]')) {
      return;
    }

    isDragging = true;
    startPointerX = e.clientX;
    startPointerY = e.clientY;
    initialTranslateX = currentTranslateX;
    initialTranslateY = currentTranslateY;

    handleEl.style.cursor = 'grabbing';
    try {
      handleEl.setPointerCapture(e.pointerId);
    } catch {}

    const onPointerMove = (ev) => {
      if (!isDragging) return;
      const deltaX = ev.clientX - startPointerX;
      const deltaY = ev.clientY - startPointerY;
      currentTranslateX = initialTranslateX + deltaX;
      currentTranslateY = initialTranslateY + deltaY;

      modalEl.style.transform = `translate(${currentTranslateX}px, ${currentTranslateY}px)`;
    };

    const onPointerUp = (ev) => {
      if (!isDragging) return;
      isDragging = false;
      handleEl.style.cursor = 'grab';
      try {
        handleEl.releasePointerCapture(ev.pointerId);
      } catch {}
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  handleEl.addEventListener('pointerdown', onPointerDown);

  return () => {
    handleEl.removeEventListener('pointerdown', onPointerDown);
  };
}

