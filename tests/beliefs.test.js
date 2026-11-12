// Tests for beliefs and observations (docs/LIFE_SYSTEMS.md 4c and the L5 brief in 4e).
// Each test builds a small world with the new data and forces the condition it needs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorld, step, scoreAction } from '../src/sim/world.js';
import { toSave, fromSave } from '../src/sim/save.js';
import { change, ledger } from '../src/sim/stocks.js';
import { runFlowsForRule, runWeeklyFlows } from '../src/sim/household.js';
import {
  setupBeliefs, truthOf, noticeFlow, checkSubject, driftBeliefs, worryScore, beliefAgeHours,
} from '../src/sim/beliefs.js';
import { applyCouplings } from '../src/sim/wellbeing.js';
import { whyText } from '../src/ui/panel.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const money = () => ({ stocks: load('stocks.json'), tax: load('tax.json'), flows: load('flows.json') });
const data = () => ({
  house: load('house.json'), actions: load('actions.json'), needs: load('needs.json'),
  people: load('people.json'), calendar: load('calendar.json'),
  wellbeing: load('wellbeing.json'), couplings: load('couplings.json'),
});
// A world with money, wellbeing and beliefs (the full L5 game), or without beliefs when asked.
const world = ({ seed = 3, beliefs = true, withMoney = true } = {}) => createWorld({
  ...data(),
  money: withMoney ? money() : null,
  beliefs: beliefs ? load('beliefs.json') : null,
  // 08:00: the 07:00 bills (energy, Oliver's club) have already been paid in the opening minute.
  seed, time: 8 * 60,
});
const sarah = (w) => w.people[0];
const belief = (w) => sarah(w).beliefs['money.joint'];
const CHECK = load('actions.json').actions.find((a) => a.id === 'checkBank');
const jointOf = (w) => w.stocks['acct.joint'].value;

test('setup: Sarah starts with a belief equal to the truth, known at the start', () => {
  const w = world();
  assert.equal(belief(w).value, truthOf(w, 'money.joint'));
  assert.equal(belief(w).value, 2500);
  assert.equal(belief(w).seenAt, w.time);
  assert.equal(belief(w).source, 'known at the start');
});

test('setup: a world without beliefs has none, and one without money has empty beliefs', () => {
  const plain = world({ beliefs: false });
  assert.equal(plain.beliefs, undefined);
  assert.equal(sarah(plain).beliefs, undefined);
  const noMoney = world({ withMoney: false });
  assert.deepEqual(sarah(noMoney).beliefs, {});
});

test('the truth is the joint account less the overdraft, to the penny', () => {
  const w = world();
  change(w, 'acct.joint', -2500, 'test');
  change(w, 'debt.overdraft', 150, 'test');
  assert.equal(truthOf(w, 'money.joint'), -150);
});

test('an unnoticed change moves the truth but not the belief', () => {
  const w = world();
  const before = belief(w).value;
  change(w, 'acct.joint', -500, 'a small purchase');
  assert.equal(truthOf(w, 'money.joint'), 2000);
  assert.equal(belief(w).value, before);
});

test('a noticed money event moves the belief by what was applied; an unnoticed one does not', () => {
  const w = world();
  const beforeBelief = belief(w).value;
  const beforeJoint = jointOf(w);
  runFlowsForRule(w, 'mortgage');
  const delta = Math.round((jointOf(w) - beforeJoint) * 100) / 100;
  assert.notEqual(delta, 0);
  assert.equal(Math.round((belief(w).value - beforeBelief) * 100) / 100, delta, 'the mortgage is noticed');

  const quiet = world();
  const quietBefore = belief(quiet).value;
  runFlowsForRule(quiet, 'bills20'); // broadband and phones: not on the noticed list
  assert.notEqual(jointOf(quiet), 2500, 'the bills were paid');
  assert.equal(belief(quiet).value, quietBefore, 'the bills went unnoticed');
});

test('weekly flows: food is noticed, everyday spending is not', () => {
  const w = world();
  const beforeBelief = belief(w).value;
  const ledgerBefore = ledger(w, 'acct.joint').length;
  runWeeklyFlows(w, 10 * 60);
  const fresh = ledger(w, 'acct.joint').slice(ledgerBefore);
  const food = fresh.filter((e) => e.ref === 'food').reduce((s, e) => s + e.amount, 0);
  const everyday = fresh.filter((e) => e.ref === 'everyday').reduce((s, e) => s + e.amount, 0);
  assert.notEqual(food, 0);
  assert.notEqual(everyday, 0);
  assert.equal(Math.round((belief(w).value - beforeBelief) * 100) / 100, Math.round(food * 100) / 100);
});

test('checking the bank app makes the belief exact, resets its age and says so in the log', () => {
  const w = world();
  const p = sarah(w);
  belief(w).value = 9999;
  belief(w).seenAt = w.time - 300;
  p.activity = { action: CHECK, item: null, path: [p.at], pos: 0, phase: 'do', minutesLeft: 1 };
  step(w);
  assert.equal(belief(w).value, truthOf(w, 'money.joint'));
  assert.equal(belief(w).seenAt, w.time);
  assert.equal(belief(w).source, 'checked the bank app');
  const line = w.log.findLast((e) => e.who === 'Sarah');
  assert.equal(line.text, 'Checked the bank app: £2,500.00 in the joint account');
});

test('a check that has not finished observes nothing', () => {
  const w = world();
  const p = sarah(w);
  belief(w).value = 9999;
  belief(w).seenAt = w.time - 300;
  p.activity = { action: CHECK, item: null, path: [p.at], pos: 0, phase: 'do', minutesLeft: 3 };
  step(w);
  assert.equal(belief(w).value, 9999);
});

test('old beliefs drift: anxious people down, calm people up, and the drift is capped', () => {
  const at = (anxious) => {
    const w = world();
    const p = sarah(w);
    p.personality = { ...p.personality, anxious };
    belief(w).seenAt = w.time - 2 * 1440;
    return { w, p };
  };
  const anxious = at(10);
  for (let i = 0; i < 24; i++) driftBeliefs(anxious.w);
  assert.equal(belief(anxious.w).value, 2425, 'a day at 15 pounds per point above 5, spread over the hours');

  const calm = at(0);
  for (let i = 0; i < 24; i++) driftBeliefs(calm.w);
  assert.equal(belief(calm.w).value, 2575);

  const steady = at(5);
  for (let i = 0; i < 24; i++) driftBeliefs(steady.w);
  assert.equal(belief(steady.w).value, 2500, 'anxious 5 does not drift');

  const fresh = world();
  fresh.people[0].personality = { ...fresh.people[0].personality, anxious: 10 };
  fresh.people[0].beliefs['money.joint'].seenAt = fresh.time - 120; // 2 hours old
  for (let i = 0; i < 24; i++) driftBeliefs(fresh);
  assert.equal(belief(fresh).value, 2500, 'a belief under 24 hours old does not drift');

  const long = at(10);
  for (let i = 0; i < 400; i++) driftBeliefs(long.w);
  assert.equal(belief(long.w).value, 1500, 'the total drift stops at 1,000 pounds');
});

test('the check is an anywhere action: no furniture, no walk', () => {
  const w = world();
  const p = sarah(w);
  // Only the bank check is worth doing: every need is met, and her personality is neutral.
  p.needs = Object.fromEntries(Object.keys(p.needs).map((k) => [k, 100]));
  p.personality = { outgoing: 5, tidy: 5, active: 5, kind: 5, anxious: 5 };
  belief(w).seenAt = w.time - 5 * 1440;
  const at = p.at;
  step(w);
  assert.equal(p.activity.action.id, 'checkBank');
  assert.equal(p.activity.item, null);
  assert.equal(p.activity.path.length, 1);
  assert.equal(p.activity.phase, 'do');
  assert.equal(p.at, at);
});

test('couplings read what people think, not the truth', () => {
  const low = world();
  change(low, 'acct.joint', -2400, 'test'); // truth: 100
  belief(low).value = 5000; // but she thinks 5,000
  applyCouplings(low);
  assert.equal(low.stocks['stress.sarah'].pushes.lowBalance, undefined);

  const high = world();
  change(high, 'acct.joint', -2500, 'test');
  change(high, 'debt.overdraft', 150, 'test'); // truth: -150, overdrawn
  belief(high).value = 100; // she thinks 100: not overdrawn, but under 200
  applyCouplings(high);
  assert.equal(high.stocks['stress.sarah'].pushes.lowBalance, 20);
  assert.equal(high.stocks['stress.sarah'].pushes.overdrawn, undefined);

  const plain = world({ beliefs: false });
  change(plain, 'acct.joint', -2450, 'test'); // truth 50, no beliefs: the L4 rule applies
  applyCouplings(plain);
  assert.equal(plain.stocks['stress.sarah'].pushes.lowBalance, 20);
});

test('worry score: from the belief only, scaled by age, low money and stress', () => {
  const w = world();
  const p = sarah(w);
  p.personality = { ...p.personality, anxious: 5 };
  const ctx = { time: w.time, world: w };
  const score = (hour = 12, stress = 0) => scoreAction(p, CHECK, hour, stress, null, ctx);

  assert.equal(scoreAction(p, CHECK, 12), 0, 'no ctx: the check scores 0');
  assert.equal(score(), 0, 'a fresh belief gives no worry');

  belief(w).seenAt = w.time - 1440;
  assert.ok(Math.abs(score() - 1.5) < 1e-9, 'a day old: 1.5');

  belief(w).value = 500;
  assert.ok(Math.abs(score() - 4.5) < 1e-9, 'under £1,000 adds 3');
  assert.ok(Math.abs(score(12, 50) - 6.75) < 1e-9, 'stress 50 makes it × 1.5');

  // Only the belief counts: changing the truth does not change the score.
  belief(w).value = 2500;
  const before = score();
  change(w, 'acct.joint', -2500, 'test');
  assert.equal(score(), before);

  // Anxious 10 scores three times anxious 0 (the likes weight of 0.5).
  const hi = world();
  const lo = world();
  for (const [w2, a] of [[hi, 10], [lo, 0]]) {
    sarah(w2).personality = { ...sarah(w2).personality, anxious: a };
    belief(w2).seenAt = w2.time - 1440;
  }
  const s = (w2) => scoreAction(sarah(w2), CHECK, 12, 0, null, { time: w2.time, world: w2 });
  assert.ok(Math.abs(s(hi) / s(lo) - 3) < 1e-9);
  assert.ok(worryScore(sarah(hi), CHECK, hi.time, hi, 0) > 0);
});

test('why trace: a check says what she thinks the money is, and what it really is', () => {
  const w = world();
  const p = sarah(w);
  p.needs = Object.fromEntries(Object.keys(p.needs).map((k) => [k, 100]));
  p.personality = { outgoing: 5, tidy: 5, active: 5, kind: 5, anxious: 5 };
  belief(w).seenAt = w.time - 5 * 1440;
  step(w);
  assert.equal(p.why.belief.subject, 'money.joint');
  assert.equal(p.why.belief.really, truthOf(w, 'money.joint'));
  assert.ok(whyText(p, w).includes('money: thinks £'));
});

test('no random numbers: the beliefs functions leave the random stream where it was', () => {
  const w = world();
  const before = JSON.stringify(w.rng.getState());
  driftBeliefs(w);
  noticeFlow(w, 'food', 'acct.joint', -50);
  checkSubject(w, sarah(w), 'money.joint');
  assert.equal(JSON.stringify(w.rng.getState()), before);
});

test('same seed, same two days with beliefs: the logs, needs, stocks and beliefs are equal', () => {
  const run = () => {
    const w = world({ seed: 3 });
    while (w.time < 2 * 1440) step(w);
    return JSON.stringify({ log: w.log, needs: w.people.map((p) => p.needs), stocks: w.stocks, beliefs: w.people.map((p) => p.beliefs) });
  };
  assert.equal(run(), run());
});

test('save version 5: a game with beliefs carries on exactly after reloading', () => {
  const live = world();
  while (live.time < 2000) step(live);
  const text = JSON.stringify(toSave(live, { totalMinutes: live.time, speed: 1, carryMs: 0 }, 0));
  const back = fromSave(JSON.parse(text), { ...data(), money: money(), beliefs: load('beliefs.json') });
  while (live.time < 5000) { step(live); step(back); }
  const pick = (w) => JSON.stringify({ log: w.log, stocks: w.stocks, beliefs: w.people.map((p) => p.beliefs) });
  assert.equal(pick(back), pick(live));
});

test('a version 4 save (no beliefs in it) loads with each belief at the truth, known now', () => {
  const live = world();
  while (live.time < 2000) step(live);
  const save = JSON.parse(JSON.stringify(toSave(live, { totalMinutes: live.time, speed: 1, carryMs: 0 }, 0)));
  save.version = 4;
  for (const p of save.people) delete p.beliefs;
  const loaded = fromSave(save, { ...data(), money: money(), beliefs: load('beliefs.json') });
  assert.equal(belief(loaded).value, truthOf(loaded, 'money.joint'));
  assert.equal(belief(loaded).seenAt, loaded.time);
  assert.equal(belief(loaded).source, 'known at the start');
});

// The setup helper (setupBeliefs) is exported for the save loader; keep it honest here too.
test('setupBeliefs resets every belief to the truth as known now', () => {
  const w = world();
  change(w, 'acct.joint', -100, 'test');
  setupBeliefs(w, load('beliefs.json'));
  assert.equal(belief(w).value, truthOf(w, 'money.joint'));
});
