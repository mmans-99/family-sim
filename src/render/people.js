// Where to draw each person, and which animation frame, read from the simulation (the
// simulation never reads this). Positions are in grid squares on the drawing (a placed
// floor's shift already added), so house.js only has to project them. Between game minutes a
// walker is moved on smoothly by `frac`, the part of the current game minute that has passed.
//
// Frames come from the person's sheet (tools/make_mum.py), named like "walk_left_2":
//   anim: idle, walk, interact (using something while standing), sit; plus "lie" (head only)
//   direction: front, front_right, right, back_right, back, back_left, left, front_left
//   front-facing frames also come with a face: _happy, _tired, _uneasy (none = content).
import { parseKey } from '../sim/housemap.js';
import { WALK_SQUARES_PER_MINUTE } from '../sim/world.js';

const FEET = 0.8;           // a standing person's feet sit this far down their square
const FRAME_MS = 220;       // idle and interact animations: one frame this often (real time)
const FRAMES_PER_SQUARE = 4; // a whole walk cycle per square walked

// The way someone faces, from a direction (dx, dy) on the plan. y grows down the screen,
// towards the viewer, so moving down the screen shows their front.
export function facing(dx, dy) {
  if (dx === 0 && dy === 0) return 'front';
  const a = Math.atan2(dy, dx) * 180 / Math.PI; // 0 = right, 90 = down (front)
  const names = ['right', 'front_right', 'front', 'front_left', 'left', 'back_left', 'back', 'back_right'];
  return names[(Math.round(a / 45) + 8) % 8];
}

// A face for front-facing frames, from how the person's needs stand. Display only.
export function mood(needs) {
  const values = Object.values(needs);
  const lowest = Math.min(...values);
  const average = values.reduce((s, v) => s + v, 0) / values.length;
  if (lowest < 25) return 'uneasy';
  if ((needs.energy ?? 100) < 30) return 'tired';
  if (average >= 80) return 'happy';
  return 'content';
}

function frameName(anim, dir, frame, face) {
  const withFace = dir === 'front' && face !== 'content' ? `_${face}` : '';
  return `${anim}_${dir}_${frame}${withFace}`;
}

// One entry per person who is on a floor in the view:
//   { sprite, fallback, x, y, row }  x, y = grid point for the sprite's bottom middle;
//   row = grid y used to sort them among furniture (drawn after anything with a smaller row).
// now = real time in ms, only used to step the idle and interact animations.
export function peopleToDraw(world, floors, place = {}, frac = 0, now = 0) {
  const out = [];
  const tick = Math.floor(now / FRAME_MS) % 4;
  for (const p of world.people) {
    const a = p.activity;
    const face = mood(p.needs);
    let spot;
    if (a?.phase === 'walk') {
      const along = Math.min(a.path.length - 1, a.pos + WALK_SQUARES_PER_MINUTE * frac);
      const i = Math.floor(along);
      const t = along - i;
      const from = parseKey(a.path[i]);
      const to = parseKey(a.path[Math.min(i + 1, a.path.length - 1)]);
      const stairStep = world.map.onStairs.has(a.path[i]) || world.map.onStairs.has(a.path[Math.min(i + 1, a.path.length - 1)]);
      if (from.floor !== to.floor && stairStep) {
        // Top of the stairs: change floor halfway across the step.
        const s = t < 0.5 ? from : to;
        spot = { floor: s.floor, x: s.x + 0.5, y: s.y + FEET };
      } else {
        spot = { floor: t < 0.5 ? from.floor : to.floor, x: from.x + 0.5 + (to.x - from.x) * t, y: from.y + FEET + (to.y - from.y) * t };
      }
      const dir = facing(to.x - from.x, to.y - from.y);
      spot.frame = frameName('walk', dir, Math.floor(along * FRAMES_PER_SQUARE) % 4, face);
      spot.fallback = Math.floor(along * 2) % 2 ? 'walk' : 'stand';
      spot.row = spot.y;
      // On the stairs: drawn after the whole flight, which is one tall sprite.
      const flight = world.map.onStairs.get(a.path[i]) ?? world.map.onStairs.get(a.path[Math.min(i + 1, a.path.length - 1)]);
      if (flight && spot.floor === flight.floor) spot.row = flight.y1 + 1.01;
    } else if (a?.phase === 'do' && a.item && a.action.on) {
      const it = a.item;
      if (a.action.on === 'lie') {
        // Head on the pillow end (the left end of a bed or bath).
        spot = { floor: it.floor, x: it.x + 0.5, y: it.y + 0.95, frame: 'lie', fallback: 'lie' };
      } else {
        // Raised a little so the seat shows below them.
        spot = { floor: it.floor, x: it.x + it.w / 2, y: it.y + it.d - 0.3, frame: frameName('sit', 'front', tick, face), fallback: 'sit' };
      }
      spot.row = it.y + it.d + 0.01; // just after the furniture they are on
    } else {
      const s = parseKey(p.at);
      spot = { floor: s.floor, x: s.x + 0.5, y: s.y + FEET, fallback: 'stand' };
      if (a?.phase === 'do' && a.item) {
        // Using something while standing: face it and work at it.
        const dir = facing(a.item.x + a.item.w / 2 - (s.x + 0.5), a.item.y + a.item.d / 2 - (s.y + 0.5));
        spot.frame = frameName('interact', dir, tick, face);
      } else {
        spot.frame = frameName('idle', 'front', tick, face);
      }
      const flight = world.map.onStairs.get(p.at);
      spot.row = flight ? flight.y1 + 1.01 : spot.y;
    }
    if (!floors.includes(spot.floor)) continue;
    const shift = place[spot.floor] ?? { x: 0, y: 0 };
    out.push({
      id: p.id,
      sprite: `${p.sprite}:${spot.frame}`,
      fallback: `${p.sprite}_${spot.fallback}`,
      x: spot.x + (shift.x ?? 0), y: spot.y + (shift.y ?? 0), row: spot.row + (shift.y ?? 0),
      // Steam (from actions marked "steam" in the data): the animation frame to draw, else null.
      steam: a?.phase === 'do' && a.action.steam ? tick : null,
    });
  }
  return out;
}
