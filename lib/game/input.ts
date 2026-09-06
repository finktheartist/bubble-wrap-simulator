export type ToolInputHandlers = {
  playing: () => boolean;
  locked: () => boolean;
  down: () => void;
  up: () => void;
  look: (x: number, y: number) => void;
};

/** Tools work with or without pointer lock. Right-drag is the cursor-mode look control. */
export function bindToolInput(canvas: HTMLElement, doc: Document, handlers: ToolInputHandlers, signal: AbortSignal) {
  let dragging = false;
  let previousX = 0;
  let previousY = 0;
  doc.addEventListener('mousedown', event => {
    if (!handlers.playing() || (!handlers.locked() && event.target !== canvas)) return;
    if (event.button === 0) handlers.down();
    if (event.button === 2 && !handlers.locked()) {
      dragging = true;
      previousX = event.clientX;
      previousY = event.clientY;
    }
  }, { signal });
  doc.addEventListener('mousemove', event => {
    if (!handlers.playing()) { dragging = false; return; }
    if (handlers.locked()) handlers.look(event.movementX, event.movementY);
    else if (dragging) {
      handlers.look(event.clientX - previousX, event.clientY - previousY);
      previousX = event.clientX;
      previousY = event.clientY;
    }
  }, { signal });
  doc.addEventListener('mouseup', event => {
    if (event.button === 0) handlers.up();
    if (event.button === 2) dragging = false;
  }, { signal });
  doc.addEventListener('keydown', event => {
    const target = event.target as HTMLElement | null;
    if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return;
    if (event.code === 'KeyF' && handlers.playing()) {
      event.preventDefault();
      if (!event.repeat) handlers.down();
    }
  }, { signal });
  doc.addEventListener('keyup', event => { if (event.code === 'KeyF') handlers.up(); }, { signal });
}
