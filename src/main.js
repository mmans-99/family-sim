// Entry point: clock, the house view with its follow camera, minimap and panels, wired together.
import { createClock, advance, setSpeed, readClock, SPEEDS, REAL_MS_PER_GAME_MINUTE } from './sim/clock.js';
import { createWorld, step, roomName } from './sim/world.js';
import { toSave, fromSave, minutesAway, catchUp } from './sim/save.js';
import { gameDayDates } from './sim/calendar.js';
import { readSave, writeSave, clearSave } from './save/store.js';
import { peopleToDraw } from './render/people.js';
import { renderPanel, renderStatusLine, clockText } from './ui/panel.js';
import { buildScene, sceneBounds } from './render/scene.js';
import { drawScene, snapFrame } from './render/house.js';
import { loadPack } from './render/pack.js';
import { project, UNIT_PX } from './render/camera.js';
import {
  artPixelFor, aimPoint, glide, clampCentre, stepZoom, viewSquares, mapFrame, fromMap,
} from './render/follow.js';
import { drawMinimap } from './render/minimap.js';
import { BACKGROUND, OUTLINE } from './render/palette.js';
import { attachCameraControls } from './ui/camera-controls.js';

// Empty grid squares kept around the house. The front wall's face (a square tall, already part
// of the drawing) is behind the tall sprites on that wall; the floor name sits above it.
const MARGIN = { top: 2.2, side: 0.4, bottom: 0.4 }; // room above the top floor for its name and the clock
const LABEL_RISE = 1.3; // floor names are written this many squares above the floor's back wall
const IDLE_MS = 5000;   // the floating buttons fade after this long without a touch
const MINIMAP_WIDTH = 120; // CSS pixels
const FACE_COLOURS = ['#e8a87c', '#7fb3d5', '#a3d9a5', '#d7bde2']; // one per person, in order

// The whole layout the camera moves over, in drawing coordinates (grid squares). Looking
// straight down, the first floor would cover the ground floor, so it is moved up the screen.
// The garden already joins the back of the ground floor (y = 6). `labels` names floors on the
// drawing: [text, floor id].
const WORLD = {
  floors: ['first', 'ground', 'garden'],
  place: { first: { x: 0, y: -8.8 } },
  labels: [['First floor', 'first'], ['Ground floor and garden', 'ground']],
};
const SPEED_LABELS = { 0: 'Pause', 1: '1x', 2: '2x', 4: '4x' };
const LEVEL_LABELS = { close: 'Close', room: 'Room', whole: 'Whole house' };

const SEED = 1; // the seed of a new game; a saved game keeps its own
const SAVE_EVERY_MS = 10000; // real time between saves while the page is open

const clock = createClock();
// The view: centre (x, y) in grid squares; level 'close' | 'room' | 'whole'; following a person.
const cam = { x: 6, y: 3, level: 'room', following: true, followId: null, goto: null };
const canvas = document.getElementById('house');
const ctx = canvas.getContext('2d');
const miniCanvas = document.getElementById('minimap');
const clockEl = document.getElementById('clock');
const statusEl = document.getElementById('status');
const panelEl = document.getElementById('panel');
const scrimEl = document.getElementById('scrim');
const peopleEl = document.getElementById('people');
const speedBar = document.getElementById('speeds');
const facesEl = document.getElementById('faces');
const zoomBar = document.getElementById('zoom');
const awayEl = document.getElementById('away');

// The scene is drawn small, then scaled up with hard edges for the pixel-art look.
const lowres = document.createElement('canvas');
const lowCtx = lowres.getContext('2d');

let house = null;
let world = null;  // the simulation (src/sim/world.js)
let pack = null;   // sprites, if the pack is present
let scene = [];    // every box of the world (buildScene of WORLD)
let bounds = null; // the world rectangle the camera may show, margins included
let pixel = 1;     // device pixels per art pixel at the current zoom level
let visW = 1;      // size of the view in grid squares
let visH = 1;
let lastMinute = -1;
let lastTime = performance.now();
let lastTouch = performance.now();

function touch() {
  lastTouch = performance.now();
  document.body.classList.remove('idle');
}

function manual() {
  cam.following = false;
  cam.goto = null;
}

function setLevel(level) {
  cam.level = level;
  if (level === 'whole') manual();
}

function zoom(zoomIn) {
  setLevel(stepZoom(cam.level, zoomIn));
}

function follow(id) {
  cam.followId = id;
  cam.following = true;
  cam.goto = null;
  if (cam.level === 'whole') cam.level = 'room';
}

function toggleFollow() {
  if (cam.following) manual();
  else follow(cam.followId ?? world.people[0]?.id ?? null);
}

// `?view=first` (or ground, garden) opens that floor at the Room level, following off.
function viewFloor(id) {
  const b = sceneBounds(buildScene(house, [id], WORLD.place));
  cam.x = (b.x0 + b.x1) / 2;
  cam.y = (b.y0 + b.y1) / 2;
  cam.level = 'room';
  cam.following = false;
  cam.goto = null;
}

function buildControls() {
  for (const speed of SPEEDS) {
    const btn = document.createElement('button');
    btn.textContent = SPEED_LABELS[speed];
    btn.dataset.speed = speed;
    btn.addEventListener('click', () => setSpeed(clock, speed));
    speedBar.appendChild(btn);
  }
  world.people.forEach((p, i) => {
    const btn = document.createElement('button');
    btn.className = 'face';
    btn.dataset.id = p.id;
    btn.style.background = FACE_COLOURS[i % FACE_COLOURS.length];
    btn.textContent = p.name.charAt(0);
    btn.setAttribute('aria-label', `Follow ${p.name}`);
    btn.title = `Follow ${p.name}`;
    btn.addEventListener('click', () => follow(p.id));
    facesEl.appendChild(btn);
  });
  const zoomButtons = [
    ['zoom-in', '＋', 'Zoom in', () => zoom(true)],
    ['zoom-out', '−', 'Zoom out', () => zoom(false)],
    ['follow', 'Follow', 'Follow the family (on or off)', toggleFollow],
    ['whole', 'Show all', 'Show the whole house', () => setLevel('whole')],
  ];
  for (const [id, label, title, action] of zoomButtons) {
    const btn = document.createElement('button');
    btn.id = `btn-${id}`;
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener('click', action);
    zoomBar.appendChild(btn);
  }
  // The minimap: tap a place to glide the view there (following turns off).
  miniCanvas.addEventListener('pointerdown', (e) => {
    touch();
    const f = mapFrame(bounds, miniCanvas.clientWidth, miniCanvas.clientHeight);
    const g = fromMap(f, e.offsetX, e.offsetY);
    cam.following = false;
    cam.goto = { x: g.x, y: g.y };
  });
}

// The canvas fills the screen (the CSS decides its size); the backing store matches the
// screen's device pixels so the art stays sharp. The minimap keeps the world's shape.
function resizeCanvas() {
  if (!bounds) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  const aspect = (bounds.y1 - bounds.y0) / (bounds.x1 - bounds.x0);
  miniCanvas.style.height = `${Math.round(MINIMAP_WIDTH * aspect)}px`;
  miniCanvas.width = Math.round(miniCanvas.clientWidth * dpr);
  miniCanvas.height = Math.round(miniCanvas.clientHeight * dpr);
}

function updateButtons() {
  for (const btn of speedBar.children) {
    btn.setAttribute('aria-pressed', String(Number(btn.dataset.speed) === clock.speed));
  }
  for (const btn of facesEl.children) {
    btn.setAttribute('aria-pressed', String(cam.following && btn.dataset.id === cam.followId));
  }
  document.getElementById('btn-follow').setAttribute('aria-pressed', String(cam.following));
  document.getElementById('btn-whole').setAttribute('aria-pressed', String(cam.level === 'whole'));
  document.getElementById('zoom-level').textContent = LEVEL_LABELS[cam.level];
}

function renderClock() {
  const t = readClock(clock);
  const hh = String(t.hour).padStart(2, '0');
  const mm = String(t.minute).padStart(2, '0');
  const date = gameDayDates(world.time, world.calendar.start);
  clockEl.textContent =
    `Year ${t.year}, Day ${t.day} (${t.season}) · ${date} · ${hh}:${mm} · ` +
    (t.speed === 0 ? 'paused' : SPEED_LABELS[t.speed]);
}

// The camera: a level sets how much is on screen; following glides the centre towards the
// person, a little ahead of where they walk; a tap on the minimap glides to that place. The
// centre always stays inside the world, so blank space is never shown.
function updateCamera(dt, people) {
  if (cam.level === 'whole') {
    cam.following = false;
    cam.goto = null;
    cam.x = (bounds.x0 + bounds.x1) / 2;
    cam.y = (bounds.y0 + bounds.y1) / 2;
  } else if (cam.goto) {
    cam.x = glide(cam.x, cam.goto.x, dt);
    cam.y = glide(cam.y, cam.goto.y, dt);
    if (Math.hypot(cam.goto.x - cam.x, cam.goto.y - cam.y) < 0.05) cam.goto = null;
  } else if (cam.following) {
    const p = people.find((q) => q.id === cam.followId) ?? people[0];
    if (p) {
      cam.followId = p.id;
      const aim = aimPoint({ x: p.x, y: p.y }, { x: p.dir[0], y: p.dir[1] });
      cam.x = glide(cam.x, aim.x, dt);
      cam.y = glide(cam.y, aim.y, dt);
    }
  }
  cam.x = clampCentre(cam.x, visW, bounds.x0, bounds.x1);
  cam.y = clampCentre(cam.y, visH, bounds.y0, bounds.y1);
}

// Draws the house and returns the people it drew (the camera and minimap use them).
function drawFrame(dt, now) {
  const w = canvas.width;
  const h = canvas.height;
  const dpr = w / canvas.clientWidth;
  const sq = viewSquares(cam.level, { w: bounds.x1 - bounds.x0, h: bounds.y1 - bounds.y0 });
  pixel = artPixelFor(w, h, sq.w, sq.h);
  const lw = Math.ceil(w / pixel);
  const lh = Math.ceil(h / pixel);
  if (lowres.width !== lw || lowres.height !== lh) {
    lowres.width = lw;
    lowres.height = lh;
  }
  visW = lw / UNIT_PX;
  visH = lh / UNIT_PX;
  // How far through the current game minute we are, so walkers move smoothly.
  const frac = clock.speed ? Math.min(1, clock.carryMs / REAL_MS_PER_GAME_MINUTE) : 0;
  const people = peopleToDraw(world, WORLD.floors, WORLD.place, frac, now);
  updateCamera(dt, people);

  const artCam = { cx: cam.x, cy: cam.y, panX: 0, panY: 0, zoomMul: 1 };
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
  for (const [text, floorId] of WORLD.labels) {
    const floor = house.floors.find((f) => f.id === floorId);
    const at = WORLD.place[floorId] ?? { x: 0, y: 0 };
    const x = Math.min(...floor.rooms.map((r) => r.x)) + at.x;
    const y = Math.min(...floor.rooms.map((r) => r.y)) + at.y - LABEL_RISE;
    const p = project(artCam, lw, lh, x, y);
    ctx.fillText(text, p.sx * pixel, p.sy * pixel);
  }
  return people;
}

function drawMini(people) {
  const mctx = miniCanvas.getContext('2d');
  const dpr = miniCanvas.width / miniCanvas.clientWidth;
  mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawMinimap(mctx, miniCanvas.clientWidth, miniCanvas.clientHeight, {
    boxes: scene,
    bounds,
    people,
    view: { x: cam.x, y: cam.y, w: visW, h: visH },
  });
}

function frame(now) {
  const dt = now - lastTime;
  lastTime = now;
  const minutes = advance(clock, dt);
  for (let i = 0; i < minutes; i++) step(world); // the family lives one game minute at a time
  if (clock.totalMinutes !== lastMinute) {
    lastMinute = clock.totalMinutes;
    renderClock();
    renderStatusLine(statusEl, world, roomName);
    renderPanel(peopleEl, world, roomName);
  }
  const people = drawFrame(dt, now);
  drawMini(people);
  if (now - lastTouch > IDLE_MS) document.body.classList.add('idle');
  updateButtons();
  requestAnimationFrame(frame);
}

// "While you were away": how much game time passed, and the last few things that happened.
function showAway(from, minutes) {
  const span = minutes >= 1440 ? `${(minutes / 1440).toFixed(1)} game days`
    : minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min`
      : `${minutes} min`;
  document.getElementById('away-text').textContent =
    `While you were away: ${span} of the family's day went by.`;
  const list = document.getElementById('away-log');
  list.replaceChildren(...world.log.filter((e) => e.time > from).slice(-8).map((e) => {
    const li = document.createElement('li');
    const when = readClock({ totalMinutes: e.time, speed: 0 });
    li.textContent = `Day ${when.day}, ${clockText(e.time)} · ${e.who}: ${e.text}`;
    return li;
  }));
  awayEl.hidden = false;
}

function saveNow() {
  writeSave(toSave(world, clock, Date.now()));
}

function setPanel(open) {
  panelEl.classList.toggle('open', open);
  scrimEl.hidden = !open;
}

async function start() {
  const load = async (file) => (await fetch(`data/${file}`)).json();
  const [actions, needs, people, calendar] = await Promise.all(
    ['actions.json', 'needs.json', 'people.json', 'calendar.json'].map(load),
  );
  house = await load('house.json');
  const data = { house, actions, needs, people, calendar };
  const params = new URLSearchParams(window.location.search);
  // Testing aid: index.html?fresh=1 forgets the saved game and starts a new one.
  if (params.has('fresh')) clearSave();
  const saved = params.has('fresh') ? null : readSave();
  let restored = null;
  if (saved) {
    try {
      restored = fromSave(saved, data);
    } catch (err) {
      console.warn('The saved game does not fit this version; starting a new one.', err);
    }
  }
  if (restored) {
    // The family keeps living while the page is closed: run the missed time now.
    const away = minutesAway(saved, Date.now());
    const from = restored.time;
    catchUp(restored, away.minutes);
    world = restored;
    Object.assign(clock, { totalMinutes: world.time, speed: saved.clock.speed, carryMs: away.carryMs });
    if (away.minutes > 0) showAway(from, away.minutes);
  } else {
    world = createWorld({ ...data, seed: SEED, time: clock.totalMinutes });
    // Testing aid: index.html?minutes=600 starts a new game 600 game minutes in, as if that
    // time had already been lived (the same steps the clock would take).
    const skip = Number(params.get('minutes')) || 0;
    for (let i = 0; i < Math.min(skip, 7 * 1440); i++) { clock.totalMinutes += 1; step(world); }
  }
  saveNow();
  setInterval(saveNow, SAVE_EVERY_MS);
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });
  document.getElementById('away-close').addEventListener('click', () => { awayEl.hidden = true; });

  // The whole layout, built once. The camera moves over it.
  scene = buildScene(house, WORLD.floors, WORLD.place);
  const b = sceneBounds(scene);
  bounds = { x0: b.x0 - MARGIN.side, x1: b.x1 + MARGIN.side, y0: b.y0 - MARGIN.top, y1: b.y1 + MARGIN.bottom };

  // Floor, furniture and people sprites, if the sheets are present.
  pack = await loadPack(undefined, world.people.map((p) => p.sprite));
  buildControls();
  attachCameraControls(canvas, cam, {
    pixel: () => pixel,
    dpr: () => (window.devicePixelRatio || 1),
    zoom,
    manual,
    touched: touch,
  });
  setPanel(false);
  document.getElementById('menu').addEventListener('click', () => setPanel(!panelEl.classList.contains('open')));
  document.getElementById('panel-close').addEventListener('click', () => setPanel(false));
  scrimEl.addEventListener('click', () => setPanel(false));
  document.getElementById('fullscreen').addEventListener('click', async () => {
    // Full screen first; the sideways lock only works once the page is full screen.
    try {
      await document.documentElement.requestFullscreen();
      await screen.orientation?.lock?.('landscape');
    } catch (err) {
      console.warn('Full screen is not available here.', err);
    }
  });
  const hint = document.getElementById('turn-hint');
  document.getElementById('turn-close').addEventListener('click', () => { hint.hidden = true; });
  document.addEventListener('pointerdown', touch);
  document.addEventListener('keydown', touch);
  window.addEventListener('resize', resizeCanvas);

  // The page opens on the family at the Room level. Testing aids: ?view=first (or ground,
  // garden) opens that floor, and ?view=all opens the whole house.
  const asked = params.get('view');
  if (asked === 'all') {
    setLevel('whole');
  } else if (asked && WORLD.floors.includes(asked)) {
    viewFloor(asked);
  } else {
    follow(world.people[0]?.id ?? null);
  }
  resizeCanvas();
  requestAnimationFrame((now) => {
    lastTime = now;
    lastTouch = now;
    requestAnimationFrame(frame);
  });
}

start().catch((err) => {
  clockEl.textContent = `Could not load the house: ${err.message}`;
  console.error(err);
});
