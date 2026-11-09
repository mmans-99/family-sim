// Entry point: wires the clock, the house drawing and the controls together.
import { createClock, advance, setSpeed, readClock, SPEEDS } from './sim/clock.js';
import { drawFloor } from './render/house.js';

const CELL = 40; // pixels per grid square
const clock = createClock();
const canvas = document.getElementById('house');
const ctx = canvas.getContext('2d');
const clockEl = document.getElementById('clock');
const speedBar = document.getElementById('speeds');
const floorBar = document.getElementById('floors');
const SPEED_LABELS = { 0: 'Pause', 1: '1x', 2: '2x', 4: '4x' };

let house = null;
let currentFloor = null;
let lastMinute = -1;
let lastTime = performance.now();

function floorById(id) {
  return house.floors.find((f) => f.id === id);
}

function showFloor(id) {
  currentFloor = id;
  for (const btn of floorBar.children) {
    btn.setAttribute('aria-pressed', String(btn.dataset.floor === id));
  }
  drawFloor(ctx, floorById(id), CELL);
}

function buildControls() {
  for (const speed of SPEEDS) {
    const btn = document.createElement('button');
    btn.textContent = SPEED_LABELS[speed];
    btn.dataset.speed = speed;
    btn.addEventListener('click', () => setSpeed(clock, speed));
    speedBar.appendChild(btn);
  }
  for (const floor of house.floors) {
    const btn = document.createElement('button');
    btn.textContent = floor.name;
    btn.dataset.floor = floor.id;
    btn.addEventListener('click', () => showFloor(floor.id));
    floorBar.appendChild(btn);
  }
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
    (t.speed === 0 ? 'paused' : `${SPEED_LABELS[t.speed]}`);
}

function frame(now) {
  advance(clock, now - lastTime);
  lastTime = now;
  if (clock.totalMinutes !== lastMinute) {
    lastMinute = clock.totalMinutes;
    renderClock();
  }
  updateSpeedButtons();
  requestAnimationFrame(frame);
}

async function start() {
  const res = await fetch('data/house.json');
  house = await res.json();
  buildControls();
  showFloor('ground');
  requestAnimationFrame((now) => {
    lastTime = now;
    requestAnimationFrame(frame);
  });
}

start().catch((err) => {
  clockEl.textContent = `Could not load the house: ${err.message}`;
  console.error(err);
});
