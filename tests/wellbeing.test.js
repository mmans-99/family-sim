// Tests for stress, sleep debt, couplings, mood and interruptions (docs/LIFE_SYSTEMS.md 4d, L4).
// Each test builds a small world with the new data and forces the condition it needs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorld, step, scoreAction } from '../src/sim/world.js';
import { toSave, fromSave } from '../src/sim/save.js';
import { addStock, change, read, stepStocks, setTarget, ledger } from '../src/sim/stocks.js';
import {
  baseStress, applyCouplings, settleSleep, moodFactor, stressPenalty, stressLabel,
} from '../src/sim/wellbeing.js';
import { mood } from '../src/render/people.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const data = () => ({
  house: load('house.json'), actions: load('actions.json'), needs: load('needs.json'),
  people: load('people.json'), calendar: load('calendar.json'),
  wellbeing: load('wellbeing.json'), couplings: load('couplings.json'),
});
const withWellbeing = (seed = 3) => createWorld({ ...data(), seed, time: 7 * 60 });
const sarah = (w) => w.people[0];
const CFG = load('wellbeing.json');

// Step until the next whole game hour (the hour's couplings run on that step).
const stepToHour = (w) => { do step(w); while (w.time % 60 !== 0); };

test('setup: stress starts at its base and sleep debt at 0; without the data there is none', () => {
  const w = withWellbeing();
  const s = w.stocks['stress.sarah'];
  assert.equal(s.value, baseStress(sarah(w), CFG));
  assert.equal(s.target, s.value, 'no drift at the start');
  assert.equal(read(w, 'sleepdebt.sarah'), 0);
  assert.ok(w.couplings);
  const plain = createWorld({ ...data(), wellbeing: null, couplings: null, seed: 3 });
  assert.equal(plain.stocks['stress.sarah'], undefined);
  assert.equal(plain.couplings, undefined);
});

test('base stress follows the anxious trait: 5, 20 and 35 for anxious 0, 5 and 10', () => {
  const at = (anxious) => baseStress({ personality: { anxious } }, CFG);
  assert.equal(at(0), 5);
  assert.equal(at(5), 20);
  assert.equal(at(10), 35);
});

test('low needs push stress for an hour and the pull is slow, not instant', () => {
  const w = withWellbeing();
  const p = sarah(w);
  p.needs = { hunger: 22, energy: 80, bladder: 20, hygiene: 80, fun: 80, comfort: 80 };
  const base = baseStress(p, CFG);
  applyCouplings(w);
  assert.equal(w.couplings.fired.lowNeeds, 1);
  assert.equal(w.stocks['stress.sarah'].pushes.lowNeeds, 10, 'two needs under 25: 5 each');
  assert.equal(w.stocks['stress.sarah'].target, base + 10);
  stepStocks(w, 1);
  assert.equal(read(w, 'stress.sarah'), Math.round((base + 10 * (1 - 0.5 ** (1 / 48))) * 100) / 100);
  // Needs back to 80: the push goes, and the target falls back to base.
  p.needs = { hunger: 80, energy: 80, bladder: 80, hygiene: 80, fun: 80, comfort: 80 };
  applyCouplings(w);
  assert.equal(w.stocks['stress.sarah'].target, base);
  assert.equal(w.stocks['stress.sarah'].pushes.lowNeeds, undefined);
});

test('money pushes adults: a low joint account adds 20, and an overdraft adds 15 more', () => {
  const w = withWellbeing();
  addStock(w, { id: 'acct.joint', value: 2500, min: 0, floor: 'spill', spillTo: 'debt.overdraft' });
  addStock(w, { id: 'debt.overdraft', value: 0, min: 0, max: 1500, floor: 'hard', ceiling: 'hard' });
  const base = baseStress(sarah(w), CFG);
  change(w, 'acct.joint', -2400, 'test');
  applyCouplings(w);
  assert.equal(w.stocks['stress.sarah'].pushes.lowBalance, 20);
  assert.equal(w.stocks['stress.sarah'].target, base + 20);
  change(w, 'acct.joint', -300, 'test'); // past £0 into the overdraft
  applyCouplings(w);
  assert.equal(w.stocks['stress.sarah'].pushes.overdrawn, 15);
  assert.equal(w.stocks['stress.sarah'].target, base + 35);
});

test('a long sleep debt speeds up fun and energy loss and pushes stress', () => {
  const w = withWellbeing();
  change(w, 'sleepdebt.sarah', 7, 'test');
  applyCouplings(w);
  assert.deepEqual(sarah(w).rateTimes, { fun: 1.4, energy: 1.2 });
  assert.equal(w.stocks['stress.sarah'].pushes.sleepDebt, 15);
});

test('sleep debt: the first window is skipped; a short night adds debt; a long one repays at most 2 h', () => {
  const w = withWellbeing();
  const p = sarah(w);
  settleSleep(w, p); // the first check after a new game: part of a day
  assert.equal(read(w, 'sleepdebt.sarah'), 0);

  w.time += 1440; // one whole day later
  p.sleptMinutes = 300; // five hours of sleep
  settleSleep(w, p);
  assert.equal(read(w, 'sleepdebt.sarah'), 3);
  const entry = ledger(w, 'sleepdebt.sarah').at(-1);
  assert.equal(entry.reason, 'Sleep');
  assert.equal(entry.ref.slept, 300);

  w.time += 1440;
  p.sleptMinutes = 720; // twelve hours: repays 2 of the 3 hours owed
  settleSleep(w, p);
  assert.equal(read(w, 'sleepdebt.sarah'), 1);

  w.time += 1440;
  p.sleptMinutes = 1200; // twenty hours: repays the rest, never below 0
  settleSleep(w, p);
  assert.equal(read(w, 'sleepdebt.sarah'), 0);
});

test('mood and the chore penalty: no effect without the data; fun halves at stress 100', () => {
  const w = withWellbeing();
  const p = sarah(w);
  const tv = w.actions.find((a) => a.id === 'tv');
  const dishes = w.actions.find((a) => a.id === 'dishes');
  const plainTv = scoreAction(p, tv, 20);
  assert.equal(scoreAction(p, tv, 20, 0, CFG), plainTv, 'stress 0 changes nothing');
  assert.equal(scoreAction(p, tv, 20, 100, CFG), plainTv * 0.5);
  assert.equal(scoreAction(p, tv, 20, 100), plainTv, 'without cfg, stress makes no difference');
  assert.equal(scoreAction(p, dishes, 12, 40, CFG), scoreAction(p, dishes, 12));
  assert.ok(Math.abs(scoreAction(p, dishes, 12, 100, CFG) - (scoreAction(p, dishes, 12) - 5)) < 1e-9);
  assert.equal(moodFactor(100, tv, CFG), 0.5);
  assert.equal(stressPenalty(40, dishes, CFG), 0);
  assert.equal(stressLabel(20, CFG), 'calm');
  assert.equal(stressLabel(45, CFG), 'tense');
  assert.equal(stressLabel(80, CFG), 'stressed');
});

test('an interruption: a need under 10 stops reading, and the reason is logged and traced', () => {
  const w = withWellbeing();
  const p = sarah(w);
  const armchair = w.house.furniture.find((f) => f.name === 'armchair');
  const read = w.actions.find((a) => a.id === 'read');
  p.needs = { hunger: 80, energy: 80, bladder: 8, hygiene: 80, fun: 80, comfort: 80 };
  p.activity = { action: read, item: armchair, path: [p.at], pos: 0, phase: 'do', minutesLeft: 40 };
  step(w);
  assert.equal(p.activity.action.id, 'toilet');
  const stopped = w.log.find((e) => e.text.startsWith('Stopped'));
  assert.equal(stopped.text, 'Stopped reading in the armchair: bladder too low (8)');
  assert.deepEqual(p.why.interrupted, { action: 'read', need: 'bladder', value: 8 });
});

test('no interruption while asleep, and an interruption is not repeated at once', () => {
  const w = withWellbeing();
  const p = sarah(w);
  const sleep = w.actions.find((a) => a.id === 'sleep');
  const bed = w.house.furniture.find((f) => f.name === 'bed frame');
  p.needs = { hunger: 80, energy: 80, bladder: 5, hygiene: 80, fun: 80, comfort: 80 };
  p.activity = { action: sleep, item: bed, path: [p.at], pos: 0, phase: 'do', minutesLeft: 400 };
  step(w);
  assert.equal(p.activity.action.id, 'sleep', 'asleep: not stopped');

  const read = w.actions.find((a) => a.id === 'read');
  const armchair = w.house.furniture.find((f) => f.name === 'armchair');
  p.activity = { action: read, item: armchair, path: [p.at], pos: 0, phase: 'do', minutesLeft: 40 };
  p.needs.bladder = 8;
  step(w);
  const count = () => w.log.filter((e) => e.text.startsWith('Stopped')).length;
  const once = count();
  for (let i = 0; i < 10; i++) step(w);
  assert.equal(count(), once, 'no second stop for the same spell');
});

test('when nothing fills the need, the person is not stopped, waits, and draws no random number', () => {
  const actions = { ...load('actions.json') };
  actions.actions = actions.actions.filter((a) => a.id !== 'toilet');
  const w = createWorld({ ...data(), actions, seed: 3, time: 7 * 60 });
  const p = sarah(w);
  const read = w.actions.find((a) => a.id === 'read');
  const armchair = w.house.furniture.find((f) => f.name === 'armchair');
  p.needs = { hunger: 80, energy: 80, bladder: 8, hygiene: 80, fun: 80, comfort: 80 };
  p.activity = { action: read, item: armchair, path: [p.at], pos: 0, phase: 'do', minutesLeft: 40 };
  const before = w.rng.getState();
  step(w);
  assert.equal(p.activity.action.id, 'read', 'carries on reading');
  assert.equal(p.noInterruptBefore, w.time + CFG.interrupt.retryMinutes);
  assert.equal(w.rng.getState(), before, 'no random number drawn');
});

test('same seed, same two days, with the new systems', () => {
  const run = () => {
    const w = withWellbeing(3);
    for (let i = 0; i < 2 * 1440; i++) step(w);
    return JSON.stringify({ log: w.log, needs: w.people[0].needs, stocks: w.stocks, fired: w.couplings.fired });
  };
  assert.equal(run(), run());
});

test('save version 4 carries on exactly, and a version 3 save gets stress at base and sleep debt 0', () => {
  const live = withWellbeing(5);
  for (let i = 0; i < 2000; i++) step(live);
  const text = JSON.stringify(toSave(live, { totalMinutes: live.time, speed: 1, carryMs: 0 }, 0));
  const back = fromSave(JSON.parse(text), data());
  for (let i = 0; i < 3000; i++) { step(live); step(back); }
  assert.deepEqual(back.log, live.log);
  assert.deepEqual(back.stocks, live.stocks);
  assert.deepEqual(back.couplings, live.couplings);

  const old = JSON.parse(text);
  old.version = 3;
  delete old.couplings;
  delete old.stocks['stress.sarah'];
  delete old.stocks['sleepdebt.sarah'];
  delete old.people[0].rateTimes;
  const loaded = fromSave(old, data());
  assert.equal(loaded.stocks['stress.sarah'].value, baseStress(loaded.people[0], CFG));
  assert.equal(read(loaded, 'sleepdebt.sarah'), 0);
});

test('the face: stress 60 or more looks uneasy whatever the needs', () => {
  const happy = { hunger: 90, energy: 90, fun: 90 };
  assert.equal(mood(happy, 60), 'uneasy');
  assert.equal(mood(happy, 59), 'happy');
});

test('lagged stocks: setTarget keeps the target inside the limits and stores the pushes', () => {
  const w = withWellbeing();
  const t = setTarget(w, 'stress.sarah', 150, { x: 1 });
  assert.equal(t, 100);
  assert.deepEqual(w.stocks['stress.sarah'].pushes, { x: 1 });
});
