// Stress, sleep debt, couplings and mood (docs/LIFE_SYSTEMS.md 3b, 4b and the L4 brief in 4d).
// Pure logic: no DOM, no random numbers. Everything here is opt-in: a world built without
// data/wellbeing.json and data/couplings.json has none of it (setupWellbeing is not called).
//
// Stress is a lagged stock per person (0 calm .. 100 overwhelmed). Its target is the person's
// base (from the anxious trait) plus the pushes from couplings that hold this hour. Couplings
// run once per game hour; sleep debt is settled once per game day at checkHour.
import { addStock, change, setTarget } from './stocks.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fill = (template, id) => template.replace('{p}', id);

export const stressId = (cfg, id) => fill(cfg.stress.id, id);
export const sleepId = (cfg, id) => fill(cfg.sleepDebt.id, id);

// Where stress rests with no pressure on it: base + perPoint × (anxious − 5), clamped to 0..100.
export function baseStress(person, cfg) {
  const anxious = person.personality?.anxious ?? 5;
  return clamp(cfg.stress.base + cfg.stress.anxiousPerPoint * (anxious - 5), 0, 100);
}

// Give every person their stress and sleep-debt stocks, and the couplings. Called by createWorld
// only when both data files are given.
export function setupWellbeing(world, wellbeing, couplings) {
  world.wellbeing = clone(wellbeing);
  world.couplings = {
    rules: clone(couplings.rules),
    fired: Object.fromEntries(couplings.rules.map((r) => [r.id, 0])),
  };
  const cfg = world.wellbeing;
  for (const p of world.people) {
    const base = baseStress(p, cfg);
    addStock(world, {
      id: stressId(cfg, p.id), kind: 'wellbeing', value: base,
      min: cfg.stress.min, max: cfg.stress.max, floor: cfg.stress.floor, ceiling: cfg.stress.ceiling,
      ledgerKeep: cfg.stress.ledgerKeep, halfLifeHours: cfg.stress.halfLifeHours,
      target: base, pushes: {}, base,
    });
    addStock(world, {
      id: sleepId(cfg, p.id), kind: 'sleep', value: 0,
      min: cfg.sleepDebt.min, max: cfg.sleepDebt.max, floor: cfg.sleepDebt.floor,
      ceiling: cfg.sleepDebt.ceiling, ledgerKeep: cfg.sleepDebt.ledgerKeep,
    });
    p.rateTimes = {};
    p.sleptMinutes = 0;
    p.sleepWindowStart = world.time;
    p.noInterruptBefore = 0;
  }
}

const whoMatches = (who, person) => who === 'each' || (who === 'adults' && person.age >= 18);

// How many times a condition holds for this person: null when its stock does not exist (the rule
// is then skipped), otherwise a count. A need condition counts each need below the level ('any')
// or 0/1 for one named need; a stock condition is 1 or 0.
function matchesFor(world, cond, person) {
  if (cond.need !== undefined) {
    const test = (v) => (cond.below !== undefined ? v < cond.below : true)
      && (cond.above !== undefined ? v > cond.above : true);
    if (cond.need === 'any') return Object.values(person.needs).filter(test).length;
    return test(person.needs[cond.need] ?? 100) ? 1 : 0;
  }
  const s = world.stocks[fill(cond.stock, person.id)];
  if (!s) return null;
  const ok = (cond.below === undefined || s.value < cond.below)
    && (cond.above === undefined || s.value > cond.above);
  return ok ? 1 : 0;
}

// Once per game hour: work out each person's pushes and rate multipliers from the couplings that
// hold right now, then set the stress target. Rates are rebuilt every hour, so a coupling that
// stops holding stops mattering at the next hour.
export function applyCouplings(world) {
  const cfg = world.wellbeing;
  for (const person of world.people) {
    const pushes = {};
    const rateTimes = {};
    for (const rule of world.couplings.rules) {
      if (!whoMatches(rule.who, person)) continue;
      const m = matchesFor(world, rule.if, person);
      if (m === null || m === 0) continue;
      world.couplings.fired[rule.id] = (world.couplings.fired[rule.id] ?? 0) + 1;
      for (const eff of rule.then) {
        if (eff.target !== undefined) {
          const add = eff.add * (eff.perMatch ? m : 1);
          pushes[rule.id] = (pushes[rule.id] ?? 0) + add;
        }
        if (eff.need !== undefined) {
          rateTimes[eff.need] = (rateTimes[eff.need] ?? 1) * eff.rateTimes;
        }
      }
    }
    person.rateTimes = rateTimes;
    const total = Object.values(pushes).reduce((s, v) => s + v, 0);
    setTarget(world, stressId(cfg, person.id), baseStress(person, cfg) + total, pushes);
  }
}

// Once per game day, at checkHour: count last night's sleep and the naps (sleptMinutes), and
// move the sleep debt. A short night adds debt; a long one repays at most maxRepayPerDay hours.
// The first window after a new game (or an old save) is only a part day, so it is skipped.
export function settleSleep(world, person) {
  const cfg = world.wellbeing.sleepDebt;
  const window = world.time - person.sleepWindowStart;
  if (window >= 1440) {
    let owed = cfg.needHours - person.sleptMinutes / 60;
    if (owed < 0) owed = Math.max(owed, -cfg.maxRepayPerDay);
    change(world, sleepId(world.wellbeing, person.id), owed, 'Sleep', { slept: person.sleptMinutes });
  }
  person.sleptMinutes = 0;
  person.sleepWindowStart = world.time;
}

// Stressed people enjoy fun things less: fun actions score × (1 − stress / factorPer).
export function moodFactor(stress, action, cfg) {
  if (!cfg || !action.kind || !cfg.mood.kinds.includes(action.kind)) return 1;
  return 1 - stress / cfg.mood.factorPer;
}

// Stress makes chores less attractive above a level: perPoint × (stress − from), taken off the score.
export function stressPenalty(stress, action, cfg) {
  if (!cfg || !action.kind || !cfg.stressPenalty.kinds.includes(action.kind)) return 0;
  return cfg.stressPenalty.perPoint * Math.max(0, stress - cfg.stressPenalty.from);
}

// "calm", "tense" or "stressed", from the bands in data/wellbeing.json.
export function stressLabel(stress, cfg) {
  const band = cfg.stress.bands.find((b) => stress < b.below) ?? cfg.stress.bands[cfg.stress.bands.length - 1];
  return band.label;
}
