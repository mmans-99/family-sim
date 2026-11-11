// Entry point: clock, 3D house view and camera controls, wired together.
import { createClock, advance, setSpeed, readClock, SPEEDS } from './sim/clock.js';
import { buildScene } from './render/scene.js';
import { drawScene, snapFrame } from './render/house.js';
import { loadPack } from './render/pack.js';
import { createCamera, UNIT_PX, TARGET } from './render/camera.js';
import { BACKGROUND } from './render/palette.js';
import { attachCameraControls, nudge } from './ui/camera-controls.js';

// One art pixel is a whole number of device pixels, so every art pixel is the same size and
// the sprites stay sharp. At zoom 1 the screen is about this many grid squares wide.
const SQUARES_ACROSS = 12.5; // the house is 12 squares wide

const clock = createClock();
const cam = createCamera();
const canvas = document.getElementById('house');
const ctx = canvas.getContext('2d');
const clockEl = document.getElementById('clock');
const speedBar = document.getElementById('speeds');
const viewBar = document.getElementById('views');
const cameraBar = document.getElementById('camera');

// The scene is drawn small, then scaled up with hard edges for the pixel-art look.
const lowres = document.createElement('canvas');
const lowCtx = lowres.getContext('2d');

const SPEED_LABELS = { 0: 'Pause', 1: '1x', 2: '2x', 4: '4x' };
// Looking straight down, floors would sit on top of each other, so each view shows one floor.
const VIEWS = {
  ground: { label: 'Ground floor', floors: ['ground'], middleY: 3 },
  first: { label: 'First floor', floors: ['first'], middleY: 3 },
  garden: { label: 'Garden', floors: ['garden'], middleY: 8 },
};
const CAMERA_BUTTONS = [
  ['in', '＋ Zoom'],
  ['out', '− Zoom'],
  ['reset', 'Reset view'],
];

let house = null;
let pack = null; // sprites, if the pack is present
let scene = [];
let viewShift = 0; // art pixels to move up, so the chosen floor sits in the middle
let lastMinute = -1;
let lastTime = performance.now();

function showView(id) {
  scene = buildScene(house, VIEWS[id].floors);
  viewShift = (VIEWS[id].middleY - TARGET.y) * UNIT_PX;
  for (const btn of viewBar.children) {
    btn.setAttribute('aria-pressed', String(btn.dataset.view === id));
  }
}

function buildControls() {
  for (const speed of SPEEDS) {
    const btn = document.createElement('button');
    btn.textContent = SPEED_LABELS[speed];
    btn.dataset.speed = speed;
    btn.addEventListener('click', () => setSpeed(clock, speed));
    speedBar.appendChild(btn);
  }
  for (const [id, view] of Object.entries(VIEWS)) {
    const btn = document.createElement('button');
    btn.textContent = view.label;
    btn.dataset.view = id;
    btn.addEventListener('click', () => showView(id));
    viewBar.appendChild(btn);
  }
  for (const [action, label] of CAMERA_BUTTONS) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.addEventListener('click', () => nudge(cam, action));
    cameraBar.appendChild(btn);
  }
}

function resizeCanvas() {
  const cssW = canvas.clientWidth;
  const cssH = Math.max(300, Math.round(cssW * 0.8));
  const dpr = window.devicePixelRatio || 1;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
}

function updateButtons() {
  for (const btn of speedBar.children) {
    btn.setAttribute('aria-pressed', String(Number(btn.dataset.speed) === clock.speed));
  }
}

function renderClock() {
  const t = readClock(clock);
  const hh = String(t.hour).padStart(2, '0');
  const mm = String(t.minute).padStart(2, '0');
  clockEl.textContent =
    `Year ${t.year}, Day ${t.day} (${t.season}) · ${hh}:${mm} · ` +
    (t.speed === 0 ? 'paused' : SPEED_LABELS[t.speed]);
}

function drawFrame() {
  // Work in device pixels, so one art pixel is a whole number of real screen pixels.
  const w = canvas.width;
  const h = canvas.height;
  const dpr = w / canvas.clientWidth;
  const base = w / (SQUARES_ACROSS * UNIT_PX); // device pixels per art pixel at zoom 1
  const pixel = Math.max(1, Math.floor(base * cam.zoomMul)); // zooming makes art pixels bigger
  const lw = Math.ceil(w / pixel);
  const lh = Math.ceil(h / pixel);
  if (lowres.width !== lw || lowres.height !== lh) {
    lowres.width = lw;
    lowres.height = lh;
  }
  // Pan is in CSS pixels, so turn it into whole art pixels.
  const artCam = { ...cam, panX: Math.round((cam.panX * dpr) / pixel), panY: Math.round((cam.panY * dpr) / pixel) - viewShift };
  drawScene(lowCtx, scene, artCam, lw, lh, pack);
  if (!pack) snapFrame(lowCtx, lw, lh); // plain blocks only: keep to the fixed palette

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = `rgb(${BACKGROUND.join(', ')})`;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(lowres, 0, 0, lw * pixel, lh * pixel);
}

function frame(now) {
  advance(clock, now - lastTime);
  lastTime = now;
  if (clock.totalMinutes !== lastMinute) {
    lastMinute = clock.totalMinutes;
    renderClock();
  }
  drawFrame();
  updateButtons();
  requestAnimationFrame(frame);
}

async function start() {
  const res = await fetch('data/house.json');
  house = await res.json();
  pack = await loadPack(); // floor and furniture sprites, if the sheets are present
  buildControls();
  attachCameraControls(canvas, cam);
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  // The page can be opened on a chosen floor, e.g. index.html?view=first
  const asked = new URLSearchParams(window.location.search).get('view');
  showView(asked in VIEWS ? asked : 'ground');
  requestAnimationFrame((now) => {
    lastTime = now;
    requestAnimationFrame(frame);
  });
}

start().catch((err) => {
  clockEl.textContent = `Could not load the house: ${err.message}`;
  console.error(err);
});
