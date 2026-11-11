// Touch and mouse controls for the house view. The player only looks: nothing here changes
// what the family does (docs/HOUSE_VIEW.md section 10).
//   One finger or left-drag: move the view. This stops following (hooks.manual).
//   Pinch or mouse wheel: step between the zoom levels (hooks.zoom).
// hooks = { pixel(): art pixel size in device pixels, dpr(): device pixels per CSS pixel,
//           zoom(zoomIn: boolean), manual() }
// The view's centre is cam.x, cam.y in grid squares.
import { UNIT_PX } from '../render/camera.js';

const PINCH_STEP = 1.3;  // a pinch this much bigger or smaller steps one zoom level
const WHEEL_STEP = 100;  // this much wheel movement steps one zoom level

export function attachCameraControls(canvas, cam, hooks) {
  canvas.style.touchAction = 'none'; // stop the phone scrolling the page while you drag
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const pointers = new Map();
  let pinch = null;
  let wheel = 0;

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch = null;
    hooks.touched?.();
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    hooks.touched?.();

    if (pointers.size === 1) {
      if (dx === 0 && dy === 0) return;
      hooks.manual();
      // Screen pixels -> art pixels -> grid squares. Dragging right moves the view left.
      const perSquare = hooks.pixel() * UNIT_PX;
      cam.x -= (dx * hooks.dpr()) / perSquare;
      cam.y -= (dy * hooks.dpr()) / perSquare;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) {
        const r = dist / pinch.dist;
        if (r > PINCH_STEP) { hooks.zoom(true); pinch.dist = dist; }
        else if (r < 1 / PINCH_STEP) { hooks.zoom(false); pinch.dist = dist; }
      } else {
        pinch = { dist };
      }
    }
  });

  const release = (e) => {
    pointers.delete(e.pointerId);
    pinch = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    hooks.touched?.();
    wheel += e.deltaY;
    if (Math.abs(wheel) >= WHEEL_STEP) {
      hooks.zoom(wheel < 0); // scrolling up zooms in
      wheel = 0;
    }
  }, { passive: false });
}
