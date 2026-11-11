// Entry point: clock, house view and camera controls, wired together.
import { createClock, advance, setSpeed, readClock, SPEEDS, REAL_MS_PER_GAME_MINUTE } from './sim/clock.js';
import { createWorld, step, roomName } from './sim/world.js';
import { peopleToDraw } from './render/people.js';
import { renderPanel, renderStatusLine } from './ui/panel.js';
import { buildScene, sceneBounds } from './render/scene.js';
import { drawScene, snapFrame } from './render/house.js';
import { loadPack } from './render/pack.js';
import { createCamera, project, UNIT_PX } from './render/camera.js';
import { BACKGROUND, OUTLINE } from './render/palette.js';
import { attachCameraControls, nudge } from './ui/camera-controls.js';

// Empty grid squares kept around a view. The front wall's face (a square tall, already part
// of the view) is behind the tall sprites on that wall; the floor name sits above it.
const MARGIN = { top: 1.1, side: 0.4, bottom: 0.4 };
const LABEL_RISE = 1.3; // floor names are written this many squares above the floor's back wall
const CONTROLS_HEIGHT = 255; // CSS pixels of the screen kept for the buttons around the canvas

const clock = createClock();
const cam = createCamera();
const canvas = document.getElementById('house');
const ctx = canvas.getContext('2d');
const clockEl = document.getElementById('clock');
const statusEl = document.getElementById('status');
const panelEl = document.getElementById('people');
const speedBar = document.getElementById('speeds');
const viewBar = document.getElementById('views');
const cameraBar = document.getElementById('camera');

// The scene is drawn small, then scaled up with hard edges for the pixel-art look.
const lowres = document.createElement('canvas');
const lowCtx = lowres.getContext('2d');

const SPEED_LABELS = { 0: 'Pause', 1: '1x', 2: '2x', 4: '4x' };
// Each view lists its floors and where each one is placed on the drawing, in grid squares.
// Looking straight down, the first floor would cover the ground floor, so the "Whole house"
// view moves it up the screen instead: both storeys and the garden are visible at once and
// nobody is ever off screen. The garden already joins the back of the ground floor (y = 6).
// `labels` names floors on the drawing: [text, floor id].
const VIEWS = {
  all: {
    label: 'Whole house',
    floors: ['first', 'ground', 'garden'],
    place: { first: { x: 0, y: -8.8 } },
    labels: [['First floor', 'first'], ['Ground floor and garden', 'ground']],
  },
  ground: { label: 'Ground floor', floors: ['ground'] },
  first: { label: 'First floor', floors: ['first'] },
  garden: { label: 'Garden', floors: ['garden'] },
};
const CAMERA_BUTTONS = [
  ['in', '＋ Zoom'],
  ['out', '− Zoom'],
  ['reset', 'Reset view'],
];

const SEED = 1; // fixed for now; it becomes part of the save in a later step

let house = null;
let world = null;  // the simulation (src/sim/world.js)
let pack = null; // sprites, if the pack is present
let scene = [];
let view = null;   // the entry of VIEWS on screen
let bounds = null; // grid rectangle the view must fit, margins included
let lastMinute = -1;
let lastTime = performance.now();

function showView(id) {
  view = VIEWS[id];
  scene = buildScene(house, view.floors, view.place);
  const b = sceneBounds(scene);
  bounds = { x0: b.x0 - MARGIN.side, x1: b.x1 + MARGIN.side, y0: b.y0 - MARGIN.top, y1: b.y1 + MARGIN.bottom };
  Object.assign(cam, createCamera()); // a new view starts centred and fitted
  for (const btn of viewBar.children) {
    btn.setAttribute('aria-pressed', String(btn.dataset.view === id));
  }
  resizeCanvas();
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

// The canvas takes the shape of the view (tall for the whole house, wide for one floor),
// but never more height than the screen has left after the buttons.
function resizeCanvas() {
  if (!bounds) return;
  const cssW = canvas.clientWidth;
  const shape = (bounds.y1 - bounds.y0) / (bounds.x1 - bounds.x0);
  const room = Math.max(260, window.innerHeight - CONTROLS_HEIGHT);
  const cssH = Math.round(Math.min(cssW * shape, room));
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
  // At zoom 1 the whole view fits: the biggest whole pixel size that fits both ways.
  const cols = (bounds.x1 - bounds.x0) * UNIT_PX;
  const rows = (bounds.y1 - bounds.y0) * UNIT_PX;
  const fit = Math.max(1, Math.floor(Math.min(w / cols, h / rows)));
  const pixel = Math.max(1, Math.round(fit * cam.zoomMul)); // zooming makes art pixels bigger
  const lw = Math.ceil(w / pixel);
  const lh = Math.ceil(h / pixel);
  if (lowres.width !== lw || lowres.height !== lh) {
    lowres.width = lw;
    lowres.height = lh;
  }
  // The middle of the view goes in the middle of the screen. Pan is in CSS pixels, so turn it
  // into whole art pixels.
  const artCam = {
    ...cam,
    cx: (bounds.x0 + bounds.x1) / 2,
    cy: (bounds.y0 + bounds.y1) / 2,
    panX: Math.round((cam.panX * dpr) / pixel),
    panY: Math.round((cam.panY * dpr) / pixel),
  };
  // How far through the current game minute we are, so walkers move smoothly.
  const frac = clock.speed ? Math.min(1, clock.carryMs / REAL_MS_PER_GAME_MINUTE) : 0;
  const people = peopleToDraw(world, view.floors, view.place, frac);
  drawScene(lowCtx, scene, artCam, lw, lh, pack, people);
  if (!pack) snapFrame(lowCtx, lw, lh); // plain blocks only: keep to the fixed palette

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = `rgb(${BACKGROUND.join(', ')})`;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(lowres, 0, 0, lw * pixel, lh * pixel);

  // Floor names, written above each floor's back wall.
  ctx.fillStyle = `rgb(${OUTLINE.join(', ')})`;
  ctx.font = `600 ${Math.round(13 * dpr)}px system-ui, sans-serif`;
  ctx.textBaseline = 'bottom';
  for (const [text, floorId] of view.labels ?? []) {
    const floor = house.floors.find((f) => f.id === floorId);
    const at = view.place?.[floorId] ?? { x: 0, y: 0 };
    const x = Math.min(...floor.rooms.map((r) => r.x)) + at.x;
    const y = Math.min(...floor.rooms.map((r) => r.y)) + at.y - LABEL_RISE;
    const p = project(artCam, lw, lh, x, y);
    ctx.fillText(text, p.sx * pixel, p.sy * pixel);
  }
}

function frame(now) {
  const minutes = advance(clock, now - lastTime);
  lastTime = now;
  for (let i = 0; i < minutes; i++) step(world); // the family lives one game minute at a time
  if (clock.totalMinutes !== lastMinute) {
    lastMinute = clock.totalMinutes;
    renderClock();
    renderStatusLine(statusEl, world, roomName);
    renderPanel(panelEl, world, roomName);
  }
  drawFrame();
  updateButtons();
  requestAnimationFrame(frame);
}

async function start() {
  const load = async (file) => (await fetch(`data/${file}`)).json();
  const [actions, needs, people] = await Promise.all(['actions.json', 'needs.json', 'people.json'].map(load));
  house = await load('house.json');
  world = createWorld({ house, actions, needs, people, seed: SEED, time: clock.totalMinutes });
  // Testing aid: index.html?minutes=600 starts the page 600 game minutes in, as if that time
  // had already been lived (the same steps the clock would take).
  const skip = Number(new URLSearchParams(window.location.search).get('minutes')) || 0;
  for (let i = 0; i < Math.min(skip, 7 * 1440); i++) { clock.totalMinutes += 1; step(world); }
  pack = await loadPack(); // floor and furniture sprites, if the sheets are present
  buildControls();
  attachCameraControls(canvas, cam);
  window.addEventListener('resize', resizeCanvas);
  // The page opens on the whole house. It can be opened on one floor: index.html?view=first
  const asked = new URLSearchParams(window.location.search).get('view');
  showView(asked in VIEWS ? asked : 'all');
  requestAnimationFrame((now) => {
    lastTime = now;
    requestAnimationFrame(frame);
  });
}

start().catch((err) => {
  clockEl.textContent = `Could not load the house: ${err.message}`;
  console.error(err);
});
