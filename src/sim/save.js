// Saving and loading a game. Pure logic: no browser, so it is tested in Node.
// A save is plain JSON (docs/ARCHITECTURE.md, "Save format"): the seed, the clock, the random
// number generator's position, each person's state, and the log. Furniture is saved as its
// index in data/house.json, so a loaded game must use the same house data.
import { createWorld, step } from './world.js';
import { createRng } from './rng.js';
import { advance, MINUTES_PER_YEAR } from './clock.js';

// Version 2 added the calendar (queue and counts). Version 1 saves still load: their calendar
// starts from the current game day, which createWorld already queues.
// Version 3 added money: the stocks (balances and ledgers) and the mortgage loan. Versions 1
// and 2 still load: they get their money from the data, for the save's date (setupMoney).
// Version 4 added stress, sleep debt and couplings (LIFE_SYSTEMS 4d). Version 3 still loads: its
// stocks are merged into the new ones, so stress starts at its base and sleep debt at 0.
export const SAVE_VERSION = 4;
const READABLE_VERSIONS = [1, 2, 3, 4];

// Plain JSON copy (the world holds only plain data).
const clone = (x) => JSON.parse(JSON.stringify(x));

const encodeActivity = (a, world) => ({
  action: { ...a.action },
  item: a.item ? world.house.furniture.indexOf(a.item) : null,
  path: [...a.path],
  pos: a.pos,
  phase: a.phase,
  minutesLeft: a.minutesLeft,
  next: a.next ? { action: { ...a.next.action }, item: world.house.furniture.indexOf(a.next.item) } : null,
});

const decodeActivity = (a, world) => {
  const item = (i) => (i === null || i === undefined ? null : world.house.furniture[i]);
  return {
    action: a.action,
    item: item(a.item),
    path: [...a.path],
    pos: a.pos,
    phase: a.phase,
    minutesLeft: a.minutesLeft,
    next: a.next ? { action: a.next.action, item: item(a.next.item) } : null,
  };
};

// The whole game as a plain object, ready for JSON.
export function toSave(world, clock, savedAt) {
  return {
    version: SAVE_VERSION,
    savedAt,                       // real time in ms when this was saved
    seed: world.seed,
    clock: { totalMinutes: clock.totalMinutes, speed: clock.speed, carryMs: clock.carryMs },
    time: world.time,
    rng: world.rng.getState(),
    people: world.people.map((p) => ({
      id: p.id,
      at: p.at,
      needs: { ...p.needs },
      personality: { ...p.personality },
      lastDone: { ...p.lastDone },
      why: p.why ?? null,
      activity: p.activity ? encodeActivity(p.activity, world) : null,
      // Wellbeing state (version 4), only in games that have it.
      ...(world.couplings ? {
        rateTimes: { ...p.rateTimes },
        sleptMinutes: p.sleptMinutes,
        sleepWindowStart: p.sleepWindowStart,
        noInterruptBefore: p.noInterruptBefore,
      } : {}),
    })),
    log: world.log.map((e) => ({ ...e })),
    calendar: { queue: world.calendar.queue.map((e) => ({ ...e })), fired: { ...world.calendar.fired } },
    stocks: clone(world.stocks),
    loans: clone(world.loans),
    couplings: world.couplings ? { fired: { ...world.couplings.fired } } : null,
  };
}

// Rebuild the world from a save. Throws if the save is from another version or does not fit
// the house data.
export function fromSave(save, { house, actions, needs, people, calendar, money, wellbeing = null, couplings = null }) {
  if (!READABLE_VERSIONS.includes(save?.version)) {
    throw new Error(`save version ${save?.version} is not one this game reads (${READABLE_VERSIONS.join(', ')})`);
  }
  const world = createWorld({
    house, actions, needs, people, calendar, money, wellbeing, couplings, seed: save.seed, time: save.time,
  });
  if (save.calendar) {
    world.calendar.queue = save.calendar.queue.map((e) => ({ ...e }));
    world.calendar.fired = { ...save.calendar.fired };
  }
  if (save.version >= 3) {
    // Version 3 has no stress stocks: keep the ones createWorld made, and take the saved money.
    world.stocks = save.version >= 4 ? clone(save.stocks) : { ...world.stocks, ...clone(save.stocks) };
    world.loans = clone(save.loans);
  }
  if (save.couplings && world.couplings) world.couplings.fired = { ...save.couplings.fired };
  world.rng = createRng(save.seed, save.rng);
  for (const s of save.people) {
    const p = world.people.find((x) => x.id === s.id);
    if (!p) throw new Error(`save has a person (${s.id}) the data does not`);
    p.at = s.at;
    p.needs = { ...s.needs };
    p.personality = { ...s.personality };
    p.lastDone = { ...s.lastDone };
    p.why = s.why ?? undefined;
    p.activity = s.activity ? decodeActivity(s.activity, world) : null;
    if (s.rateTimes !== undefined && world.couplings) {
      p.rateTimes = { ...s.rateTimes };
      p.sleptMinutes = s.sleptMinutes;
      p.sleepWindowStart = s.sleepWindowStart;
      p.noInterruptBefore = s.noInterruptBefore;
    }
    if (!world.map.free(p.at)) throw new Error(`${p.name} is saved on a square nobody can stand on`);
  }
  world.log = save.log.map((e) => ({ ...e }));
  return world;
}

// How many game minutes the game would have run while the page was closed: the real time
// since the save, at the speed the game was running, capped at one game year.
export function minutesAway(save, now) {
  const clock = { totalMinutes: 0, speed: save.clock.speed, carryMs: save.clock.carryMs };
  advance(clock, Math.max(0, now - save.savedAt));
  if (clock.totalMinutes >= MINUTES_PER_YEAR) return { minutes: MINUTES_PER_YEAR, carryMs: 0 };
  return { minutes: clock.totalMinutes, carryMs: clock.carryMs };
}

// Run the world on by the missed minutes, one minute at a time (the same steps as live play).
export function catchUp(world, minutes) {
  for (let i = 0; i < minutes; i++) step(world);
}
