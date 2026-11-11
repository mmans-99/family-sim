// The simulated household, one game minute at a time. Pure logic: no drawing, no browser,
// no Math.random(). Same seed and same data give exactly the same day.
//
// Each person has needs (0 = desperate, 100 = fully met) that drop every minute. When they
// have nothing to do, the brain scores every action in data/actions.json and picks one of
// the best few, weighted by score, with the seeded random numbers. They walk to the
// furniture (shortest route, stairs included), use it for its minutes, and the action's
// gains are added a little each minute.
import { createRng } from './rng.js';
import { buildMap, keyOf, parseKey } from './housemap.js';

export const WALK_SQUARES_PER_MINUTE = 8; // about 1.3 squares a real second at 1x: easy to follow
const TOP_CHOICES = 3;    // pick among this many best-scoring actions
const MIN_SCORE = 1;      // below this an action is not worth getting up for
const TRAVEL_COST = 0.15; // score lost per square walked
const LOG_LENGTH = 50;

const clamp = (v) => Math.max(0, Math.min(100, v));

export function hourOf(time) {
  return Math.floor((time % 1440) / 60);
}

// Is the hour inside [from, to)? Works across midnight ([21, 7] = 9pm to 7am).
export function inHours(hour, [from, to]) {
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

export function createWorld({ house, actions, needs, people, seed = 1, time = 7 * 60 }) {
  const map = buildMap(house);
  const world = {
    time,
    rng: createRng(seed),
    house, map,
    actions: actions.actions,
    potter: actions.potter,
    needDefs: needs.needs,
    people: people.people.map((p) => ({
      id: p.id, name: p.name, role: p.role, age: p.age, sprite: p.sprite,
      at: keyOf(p.start.floor, p.start.x, p.start.y),
      needs: { ...p.needs },
      activity: null,
      lastDone: {}, // action id -> game minute it was last started
    })),
    log: [],
  };
  for (const p of world.people) {
    if (!map.free(p.at)) throw new Error(`${p.name} starts on a square nobody can stand on: ${p.at}`);
  }
  return world;
}

function say(world, person, text) {
  world.log.push({ time: world.time, who: person.name, text });
  if (world.log.length > LOG_LENGTH) world.log.shift();
}

// Is the action allowed at all right now? (Rest period since last time; washing up only
// after cooking.)
export function allowed(person, action, time) {
  const last = person.lastDone[action.id];
  if (action.cooldown && last !== undefined && time - last < action.cooldown) return false;
  if (action.after) {
    const before = person.lastDone[action.after];
    if (before === undefined || (last !== undefined && last >= before)) return false;
  }
  return true;
}

// How much an action is worth to this person right now, before travel.
export function scoreAction(person, action, hour) {
  let score = action.base ?? 0;
  for (const [need, gain] of Object.entries(action.gain)) {
    const now = person.needs[need] ?? 100;
    const useful = Math.min(gain, 100 - now);     // can't fill a need past full
    const urgency = ((100 - now) / 100) ** 2;    // low needs matter much more
    score += useful * urgency;
  }
  if (action.hours && !inHours(hour, action.hours)) score *= action.offHours ?? 0;
  return score;
}

// Choose what to do next and set off.
function decide(world, person) {
  const { map } = world;
  const hour = hourOf(world.time);
  const { dist, prev } = map.distances(person.at);

  const options = [];
  for (const action of world.actions) {
    if (!allowed(person, action, world.time)) continue;
    const base = scoreAction(person, action, hour);
    if (base <= 0) continue;
    // The nearest piece of furniture of the right kind that can be reached.
    let best = null;
    for (const item of world.house.furniture.filter((f) => f.name === action.object)) {
      for (const sq of map.useSquares(item)) {
        const d = dist.get(sq);
        if (d === undefined) continue;
        if (!best || d < best.d) best = { item, sq, d };
      }
    }
    if (!best) continue;
    const score = base - best.d * TRAVEL_COST;
    if (score >= MIN_SCORE) options.push({ action, ...best, score });
  }

  options.sort((a, b) => b.score - a.score || a.action.id.localeCompare(b.action.id));
  const top = options.slice(0, TOP_CHOICES);
  if (top.length) {
    const total = top.reduce((s, o) => s + o.score * o.score, 0);
    let roll = world.rng() * total;
    let pick = top[top.length - 1];
    for (const o of top) {
      roll -= o.score * o.score;
      if (roll < 0) { pick = o; break; }
    }
    const path = map.pathTo(prev, person.at, pick.sq);
    person.activity = {
      action: pick.action, item: pick.item, path, pos: 0,
      phase: path.length > 1 ? 'walk' : 'do',
      minutesLeft: pick.action.minutes,
    };
    person.lastDone[pick.action.id] = world.time;
    say(world, person, pick.action.label);
    return;
  }

  // Nothing needs doing: wander to a random square and potter about there.
  const reachable = map.walkable.filter((k) => dist.has(k) && k !== person.at);
  const to = reachable.length ? reachable[Math.floor(world.rng() * reachable.length)] : person.at;
  const { minMinutes, maxMinutes, label } = world.potter;
  const minutes = minMinutes + Math.floor(world.rng() * (maxMinutes - minMinutes + 1));
  const path = map.pathTo(prev, person.at, to);
  person.activity = {
    action: { id: 'potter', label, minutes, gain: {} }, item: null, path, pos: 0,
    phase: path.length > 1 ? 'walk' : 'do', minutesLeft: minutes,
  };
  const last = world.log.findLast((e) => e.who === person.name);
  if (last?.text !== label) say(world, person, label); // one line for a spell of pottering
}

function stepPerson(world, person) {
  const act = person.activity;
  const doing = act?.phase === 'do' ? act.action : null;
  const asleep = Boolean(doing?.sleep);

  // Needs drop, except the ones the current action is filling.
  for (const [need, def] of Object.entries(world.needDefs)) {
    if (doing && doing.gain[need]) continue;
    const rate = def.perHour * (asleep ? def.sleepFactor : 1);
    person.needs[need] = clamp(person.needs[need] - rate / 60);
  }

  if (!person.activity) decide(world, person);
  const a = person.activity;
  if (a.phase === 'walk') {
    a.pos = Math.min(a.path.length - 1, a.pos + WALK_SQUARES_PER_MINUTE);
    person.at = a.path[Math.floor(a.pos)];
    if (a.pos >= a.path.length - 1) a.phase = 'do';
    return;
  }
  for (const [need, gain] of Object.entries(a.action.gain)) {
    person.needs[need] = clamp(person.needs[need] + gain / a.action.minutes);
  }
  a.minutesLeft -= 1;
  if (a.minutesLeft <= 0) person.activity = null;
}

// Move the whole world on by one game minute.
export function step(world) {
  world.time += 1;
  for (const person of world.people) stepPerson(world, person);
}

// Where a person is, in words: the room's name.
export function roomName(world, person) {
  return world.map.squares.get(person.at)?.roomName ?? '';
}

export { parseKey };
