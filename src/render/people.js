// Where to draw each person, read from the simulation (the simulation never reads this).
// Positions are in grid squares on the drawing (a placed floor's shift already added), so
// house.js only has to project them. Between game minutes a walker is moved on smoothly by
// `frac`, the part of the current game minute that has passed.
import { parseKey } from '../sim/housemap.js';
import { WALK_SQUARES_PER_MINUTE } from '../sim/world.js';

const FEET = 0.8; // a standing person's feet sit this far down their square

// One entry per person who is on a floor in the view:
//   { sprite, x, y, row }  x, y = grid point for the sprite's bottom middle;
//   row = grid y used to sort them among furniture (drawn after anything with a smaller row).
export function peopleToDraw(world, floors, place = {}, frac = 0) {
  const out = [];
  for (const p of world.people) {
    const a = p.activity;
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
      spot.sprite = Math.floor(along * 2) % 2 ? 'walk' : 'stand';
      spot.row = spot.y;
      // On the stairs: drawn after the whole flight, which is one tall sprite.
      const flight = world.map.onStairs.get(a.path[i]) ?? world.map.onStairs.get(a.path[Math.min(i + 1, a.path.length - 1)]);
      if (flight && spot.floor === flight.floor) spot.row = flight.y1 + 1.01;
    } else if (a?.phase === 'do' && a.item && a.action.on) {
      const it = a.item;
      spot = a.action.on === 'lie'
        // Head on the pillow end (the left end of a bed or bath).
        ? { floor: it.floor, x: it.x + 0.5, y: it.y + 0.95, sprite: 'lie' }
        : { floor: it.floor, x: it.x + it.w / 2, y: it.y + it.d - 0.3, sprite: 'sit' }; // raised so the seat shows
      spot.row = it.y + it.d + 0.01; // just after the furniture they are on
    } else {
      const s = parseKey(p.at);
      spot = { floor: s.floor, x: s.x + 0.5, y: s.y + FEET, sprite: 'stand' };
      const flight = world.map.onStairs.get(p.at);
      spot.row = flight ? flight.y1 + 1.01 : spot.y;
    }
    if (!floors.includes(spot.floor)) continue;
    const shift = place[spot.floor] ?? { x: 0, y: 0 };
    out.push({
      id: p.id, sprite: `${p.sprite}_${spot.sprite}`,
      x: spot.x + (shift.x ?? 0), y: spot.y + (shift.y ?? 0), row: spot.row + (shift.y ?? 0),
    });
  }
  return out;
}
