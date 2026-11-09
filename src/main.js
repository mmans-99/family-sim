// Entry point: clock, 3D house view and camera controls, wired together.
import { createClock, advance, setSpeed, readClock, SPEEDS } from './sim/clock.js';
import { buildScene } from './render/scene.js';
import { drawScene } from './render/house.js';
import { createCamera } from './render/camera.js';
import { attachCameraControls, nudge } from './ui/camera-controls.js';

const clock = createClock();
const cam = createCamera();
const canvas = document.getElementById('house');
const ctx = canvas.getContext('2d');
const clockEl = document.getElementById('clock');
const speedBar = document.getElementById('speeds');
const viewBar = document.getElementById('views');
const cameraBar = document.getElementById('camera');

const SPEED_LABELS = { 0: 'Pause', 1: '1x', 2: '2x', 4: '4x' };
// "lift" pulls a floor up so the house can be seen in layers ("exploded" view).
const VIEWS = {
  all: { label: 'All floors', floors: ['ground', 'first', 'garden'], lift: { first: 1.2 } },
  ground: { label: 'Ground floor', floors: ['ground', 'garden'], lift: {} },
  first: { label: 'First floor', floors: ['first'], lift: {} },
  garden: { label: 'Garden', floors: ['garden'], lift: {} },
};
const CAMERA_BUTTONS = [
  ['left', '↺ Turn'],
  ['right', 'Turn ↻'],
  ['higher', 'Look down'],
  ['lower', 'Level'],
  ['in', '＋ Zoom'],
  ['out', '− Zoom'],
  ['reset', 'Reset view'],
];

let house = null;
let scene = [];
let lastMinute = -1;
let lastTime = performance.now();

function showView(id) {
  scene = buildScene(house, VIEWS[id].floors, VIEWS[id].lift);
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
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function updateSpeedButtons() {
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

function frame(now) {
  advance(clock, now - lastTime);
  lastTime = now;
  if (clock.totalMinutes !== lastMinute) {
    lastMinute = clock.totalMinutes;
    renderClock();
  }
  drawScene(ctx, scene, cam, canvas.clientWidth, canvas.clientHeight);
  updateSpeedButtons();
  requestAnimationFrame(frame);
}

async function start() {
  const res = await fetch('data/house.json');
  house = await res.json();
  buildControls();
  attachCameraControls(canvas, cam);
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  showView('all');
  requestAnimationFrame((now) => {
    lastTime = now;
    requestAnimationFrame(frame);
  });
}

start().catch((err) => {
  clockEl.textContent = `Could not load the house: ${err.message}`;
  console.error(err);
});
