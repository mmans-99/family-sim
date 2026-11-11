// Follow camera, zoom levels and minimap maths for the landscape view (docs/HOUSE_VIEW.md
// section 10). Pure maths, no DOM, so it can be tested with `node --test`.
// Units: positions are grid squares on the drawing (y grows down the screen); "art pixels"
// are UNIT_PX per square; "device pixels" are real screen pixels.
import { UNIT_PX } from './camera.js';

export const ZOOM_ORDER = ['close', 'room', 'whole']; // closest first
export const ZOOM_SQUARES = { close: { w: 8, h: 5 }, room: { w: 14, h: 8 } }; // 'whole' fits the world
export const LOOK_AHEAD = 2;         // squares ahead of a walker that the camera aims at
export const GLIDE_PER_FRAME = 0.15; // share of the remaining gap closed each 1/60 s
const FRAME_MS = 1000 / 60;
const MAX_STEP_MS = 100;             // a long pause (hidden tab) must not make the camera jump

// The biggest whole number of device pixels per art pixel at which `squaresW` x `squaresH`
// squares fit the screen. Never below 1. Whole numbers keep every sprite pixel sharp.
export function artPixelFor(width, height, squaresW, squaresH) {
  return Math.max(1, Math.floor(Math.min(width / (squaresW * UNIT_PX), height / (squaresH * UNIT_PX))));
}

// How much of the remaining distance the camera covers in one step of dtMs real milliseconds.
// About 15% per 1/60 s, so the glide is the same speed at any frame rate.
export function glideFactor(dtMs) {
  const dt = Math.min(Math.max(dtMs, 0), MAX_STEP_MS);
  return 1 - Math.pow(1 - GLIDE_PER_FRAME, dt / FRAME_MS);
}

export function glide(value, target, dtMs) {
  return value + (target - value) * glideFactor(dtMs);
}

// Where the camera aims for a person: their position, plus LOOK_AHEAD squares along the way
// they are walking (dir is the step they are taking; [0, 0] when they are not moving).
export function aimPoint(pos, dir) {
  const len = Math.hypot(dir.x, dir.y);
  if (len === 0) return { x: pos.x, y: pos.y };
  return { x: pos.x + (dir.x / len) * LOOK_AHEAD, y: pos.y + (dir.y / len) * LOOK_AHEAD };
}

// Keep a view `vis` squares wide (or tall) inside the world range [lo, hi], so blank space
// past the edge is never shown. A world smaller than the view is simply centred.
export function clampCentre(centre, vis, lo, hi) {
  if (vis >= hi - lo) return (lo + hi) / 2;
  return Math.min(hi - vis / 2, Math.max(lo + vis / 2, centre));
}

// Zoom in (closer) or out (wider) one level, stopping at the ends.
export function stepZoom(level, zoomIn) {
  const i = ZOOM_ORDER.indexOf(level);
  const j = Math.min(ZOOM_ORDER.length - 1, Math.max(0, zoomIn ? i - 1 : i + 1));
  return ZOOM_ORDER[j];
}

// Squares on screen for a zoom level. `world` = { w, h } is the whole layout (used for 'whole').
export function viewSquares(level, world) {
  return level === 'whole' ? world : ZOOM_SQUARES[level];
}

// Screen position (art pixels, from the top left of the drawing) -> grid square. The inverse of
// camera.js project(), for a view centred on (cx, cy) and drawn lw x lh art pixels big.
export function artToGrid(cx, cy, lw, lh, ax, ay) {
  return { x: cx + (ax - lw / 2) / UNIT_PX, y: cy + (ay - lh / 2) / UNIT_PX };
}

// The minimap shows the whole world rectangle {x0, y0, x1, y1} fitted into a w x h box.
// `frame` turns grid squares into minimap pixels and back.
export function mapFrame(world, w, h) {
  const ww = world.x1 - world.x0;
  const wh = world.y1 - world.y0;
  const s = Math.min(w / ww, h / wh);
  return {
    s,
    ox: (w - ww * s) / 2 - world.x0 * s,
    oy: (h - wh * s) / 2 - world.y0 * s,
  };
}

export function toMap(frame, x, y) {
  return { mx: x * frame.s + frame.ox, my: y * frame.s + frame.oy };
}

export function fromMap(frame, mx, my) {
  return { x: (mx - frame.ox) / frame.s, y: (my - frame.oy) / frame.s };
}
