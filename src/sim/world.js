// The simulated household, one game minute at a time. Pure logic: no drawing, no browser,
// no Math.random(). Same seed and same data give exactly the same day.
//
// Each person has needs (0 = desperate, 100 = fully met) that drop every minute. When they
// have nothing to do, the brain scores every action in data/actions.json and picks one of
// the best few, weighted by score, with the seeded random numbers. They walk to the
// furniture (shortest route, stairs included), use it for its minutes, and the action's
// gains are added a little each minute.
import { createRng, subRng } from './rng.js';
import { MINUTES_PER_DAY } from './clock.js';
import { dueOnGameDay, formatDate } from './calendar.js';
import { runFlowsForRule, runWeeklyFlows, setupMoney } from './household.js';
import { buildMap, keyOf, parseKey } from './housemap.js';

export const WALK_SQUARES_PER_MINUTE = 8; // about 1.3 squares a real second at 1x: easy to follow
const TOP_CHOICES = 3;    // pick among this many best-scoring actions
const MIN_SCORE = 1;      // below this an action is not worth getting up for
const TRAVEL_COST = 0.15; // score lost per square walked
const LOG_LENGTH = 50;
const MIN_FIT = 0.2;      // a personality can make an action less wanted, but never impossible

export const TRAITS = ['outgoing', 'tidy', 'active', 'kind', 'anxious'];

const clamp = (v) => Math.max(0, Math.min(100, v));

// Five traits, each 0 to 10, rolled from the seed (5 is neutral).
export function rollPersonality(rng) {
  return Object.fromEntries(TRAITS.map((t) => [t, Math.floor(rng() * 11)]));
}

// How much a personality fits an action: 1 is neutral. Each liked trait adds or takes away
// `weight` for each step away from 5 (out of 5).
export function traitFit(personality, likes = {}) {
  let fit = 1;
  for (const [trait, weight] of Object.entries(likes)) {
    fit += weight * ((personality?.[trait] ?? 5) - 5) / 5;
  }
  return Math.max(MIN_FIT, fit);
}

export function hourOf(time) {
  return Math.floor((time % 1440) / 60);
}

// Is the hour inside [from, to)? Works across midnight ([21, 7] = 9pm to 7am).
export function inHours(hour, [from, to]) {
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

const DEFAULT_CALENDAR = { start: { year: 2026, month: 3, day: 1 }, rules: [] };

export function createWorld({ house, actions, needs, people, calendar = DEFAULT_CALENDAR, money = null, seed = 1, time = 7 * 60 }) {
  const map = buildMap(house);
  const world = {
    seed,
    time,
    rng: createRng(seed),
    // Dated events (LIFE_SYSTEMS section 2). The rules and the start date come from data;
    // the queue holds today's events not yet fired; fired counts each rule's firings.
    calendar: { start: calendar.start, rules: calendar.rules, queue: [], fired: {} },
    house, map,
    // Money (LIFE_SYSTEMS 3a). Empty until setupMoney runs; plain JSON throughout.
    stocks: {}, flows: [], loans: {}, tax: null, salary: null,
    actions: actions.actions,
    potter: actions.potter,
    needDefs: needs.needs,
    people: people.people.map((p) => ({
      id: p.id, name: p.name, role: p.role, age: p.age, sprite: p.sprite,
      at: keyOf(p.start.floor, p.start.x, p.start.y),
      needs: { ...p.needs },
      personality: p.personality === 'random' || !p.personality
        ? rollPersonality(subRng(seed, `personality:${p.id}`))
        : { ...p.personality },
      activity: null,
      lastDone: {}, // action id -> game minute it was last started
    })),
    log: [],
  };
  for (const p of world.people) {
    if (!map.free(p.at)) throw new Error(`${p.name} starts on a square nobody can stand on: ${p.at}`);
  }
  if (money) setupMoney(world, money);
  queueDay(world, true); // a game that starts mid-day does not fire the events that already passed
  return world;
}

// Queue the dated events of the current game day. skipPast leaves out events whose hour has
// already gone (used when a game starts or is restored mid-day).
export function queueDay(world, skipPast) {
  const now = world.time % MINUTES_PER_DAY;
  const gameDay = Math.floor(world.time / MINUTES_PER_DAY);
  for (const e of dueOnGameDay(gameDay, world.calendar.rules, world.calendar.start)) {
    if (skipPast && e.hour * 60 < now) continue;
    world.calendar.queue.push(e);
  }
}

// A line in the household's log (the panel's Household block).
function houseLog(world, text) {
  world.log.push({ time: world.time, who: 'House', text, why: null });
  if (world.log.length > LOG_LENGTH) world.log.shift();
}

// Fire the queued events whose hour has come. Each one is counted. A rule with money flows
// (data/flows.json) runs them and logs what was paid; any other rule just writes its label.
function fireDue(world) {
  const now = world.time % MINUTES_PER_DAY;
  const cal = world.calendar;
  const due = cal.queue.filter((e) => e.hour * 60 <= now);
  if (due.length === 0) return;
  cal.queue = cal.queue.filter((e) => e.hour * 60 > now);
  for (const e of due) {
    cal.fired[e.id] = (cal.fired[e.id] ?? 0) + 1;
    const lines = runFlowsForRule(world, e.id);
    if (lines.length === 0) lines.push(`${e.label} (${formatDate(e.date)})`);
    for (const text of lines) houseLog(world, text);
  }
}

function say(world, person, text, why = null) {
  world.log.push({ time: world.time, who: person.name, text, why });
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
  score *= traitFit(person.personality, action.likes);
  if (action.hours && !inHours(hour, action.hours)) score *= action.offHours ?? 0;
  return score;
}

// The need that makes an action worth doing most, for the "why" trace.
function dominantNeed(person, action) {
  let best = null;
  let bestValue = -1;
  for (const [need, gain] of Object.entries(action.gain)) {
    const now = person.needs[need] ?? 100;
    const value = Math.min(gain, 100 - now) * ((100 - now) / 100) ** 2;
    if (value > bestValue) { best = need; bestValue = value; }
  }
  return best;
}

const snapshotNeeds = (person) => Object.fromEntries(
  Object.entries(person.needs).map(([k, v]) => [k, Math.round(v)]),
);

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
    if (score >= MIN_SCORE) options.push({ action, ...best, score, fit: traitFit(person.personality, action.likes) });
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
    const chosen = { action: pick.action, item: pick.item };
    if (pick.action.prelude) {
      // Something has to be done first (running the bath). It is done at the same furniture.
      const first = world.actions.find((a) => a.id === pick.action.prelude);
      person.activity = {
        action: first, item: pick.item, path, pos: 0,
        phase: path.length > 1 ? 'walk' : 'do',
        minutesLeft: first.minutes, next: chosen,
      };
      person.lastDone[first.id] = world.time;
    } else {
      person.activity = {
        action: pick.action, item: pick.item, path, pos: 0,
        phase: path.length > 1 ? 'walk' : 'do',
        minutesLeft: pick.action.minutes,
      };
    }
    const last = person.lastDone[pick.action.id];
    const why = {
      chosen: pick.action.label,
      reason: 'need',
      need: dominantNeed(person, pick.action) ?? 'routine', // chores have no need, only a base score
      needs: snapshotNeeds(person),
      score: Math.round(pick.score * 10) / 10,
      squares: pick.d,
      habit: last === undefined ? 'never done' : `last done ${world.time - last} min ago`,
      fit: Math.round(pick.fit * 100) / 100,
      next: top.filter((o) => o !== pick).slice(0, 2)
        .map((o) => ({ label: o.action.label, score: Math.round(o.score * 10) / 10 })),
    };
    person.lastDone[pick.action.id] = world.time;
    person.why = why;
    say(world, person, pick.action.label, why);
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
  const why = {
    chosen: label, reason: `nothing scored at least ${MIN_SCORE}`,
    needs: snapshotNeeds(person), squares: path.length - 1, habit: null, next: [],
  };
  person.why = why;
  const last = world.log.findLast((e) => e.who === person.name);
  if (last?.text !== label) say(world, person, label, why); // one line for a spell of pottering
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

  let decidedNow = false;
  if (!person.activity) {
    decide(world, person);
    decidedNow = true;
  }
  const a = person.activity;
  if (a.phase === 'walk') {
    // The minute a walk is chosen, she is still on the first square; the walk starts next minute.
    if (decidedNow) return;
    a.pos = Math.min(a.path.length - 1, a.pos + WALK_SQUARES_PER_MINUTE);
    person.at = a.path[Math.floor(a.pos)];
    if (a.pos >= a.path.length - 1) a.phase = 'do';
    return;
  }
  for (const [need, gain] of Object.entries(a.action.gain)) {
    person.needs[need] = clamp(person.needs[need] + gain / a.action.minutes);
  }
  a.minutesLeft -= 1;
  if (a.minutesLeft <= 0) {
    if (a.next) {
      // The prelude is done: go straight on to the real action, at the same furniture.
      person.activity = {
        action: a.next.action, item: a.next.item, path: [person.at], pos: 0,
        phase: 'do', minutesLeft: a.next.action.minutes,
      };
    } else {
      person.activity = null;
    }
  }
}

// Move the whole world on by one game minute.
export function step(world) {
  world.time += 1;
  if (world.time % MINUTES_PER_DAY === 0) queueDay(world, false);
  fireDue(world);
  for (const line of runWeeklyFlows(world, world.time % MINUTES_PER_DAY)) houseLog(world, line);
  for (const person of world.people) stepPerson(world, person);
}

// Where a person is, in words: the room's name.
export function roomName(world, person) {
  return world.map.squares.get(person.at)?.roomName ?? '';
}

export { parseKey };
