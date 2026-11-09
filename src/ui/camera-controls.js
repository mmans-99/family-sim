// Camera controls for the house view.
//   One finger or left-drag: turn the house around.
//   Two fingers or right-drag (or shift-drag): move the view sideways.
//   Pinch or mouse wheel: zoom.
// The on-screen buttons call nudge().
import { createCamera, PITCH_MIN, PITCH_MAX } from '../render/camera.js';

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function attachCameraControls(canvas, cam) {
  canvas.style.touchAction = 'none'; // stop the phone scrolling the page while you drag
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const pointers = new Map();
  let pinch = null;

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey });
    pinch = null;
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;

    if (pointers.size === 1) {
      if (p.pan) {
        cam.panX += dx;
        cam.panY += dy;
      } else {
        cam.yaw += dx * 0.008;
        cam.pitch = clamp(cam.pitch + dy * 0.005, PITCH_MIN, PITCH_MAX);
      }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinch) {
        cam.zoomMul = clamp(cam.zoomMul * (dist / pinch.dist), MIN_ZOOM, MAX_ZOOM);
        cam.panX += mid.x - pinch.mid.x;
        cam.panY += mid.y - pinch.mid.y;
      }
      pinch = { dist, mid };
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
    cam.zoomMul = clamp(cam.zoomMul * Math.exp(-e.deltaY * 0.001), MIN_ZOOM, MAX_ZOOM);
  }, { passive: false });
}

// Button actions: turn, tilt, zoom, reset.
export function nudge(cam, action) {
  switch (action) {
    case 'left': cam.yaw -= 0.35; break;
    case 'right': cam.yaw += 0.35; break;
    case 'higher': cam.pitch = clamp(cam.pitch + 0.15, PITCH_MIN, PITCH_MAX); break;
    case 'lower': cam.pitch = clamp(cam.pitch - 0.15, PITCH_MIN, PITCH_MAX); break;
    case 'in': cam.zoomMul = clamp(cam.zoomMul * 1.25, MIN_ZOOM, MAX_ZOOM); break;
    case 'out': cam.zoomMul = clamp(cam.zoomMul / 1.25, MIN_ZOOM, MAX_ZOOM); break;
    case 'reset': Object.assign(cam, createCamera()); break;
    default: break;
  }
}
