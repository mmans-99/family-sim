import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorld, step, traitFit, scoreAction } from '../src/sim/world.js';
import { toSave, fromSave, minutesAway, catchUp, SAVE_VERSION } from '../src/sim/save.js';
import { createClock } from '../src/sim/clock.js';
import { REAL_MS_PER_GAME_MINUTE, MINUTES_PER_YEAR } from '../src/sim/clock.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const data = () => ({ house: load("house.json"), actions: load("actions.json"), needs: load("needs.json"), people: load("people.json"), calendar: load("calendar.json") });

test('a saved game carries on exactly as if it had never stopped', () => {
  const live = createWorld({ ...data(), seed: 5, time: 7 * 60 });
  for (let i = 0; i < 900; i++) step(live); // stop part way through the morning and afternoon
  const clock = { ...createClock(live.time) };
  const text = JSON.stringify(toSave(live, clock, 0)); // through JSON, as storage does
  const back = fromSave(JSON.parse(text), data());
  for (let i = 0; i < 2000; i++) { step(live); step(back); }
  assert.deepEqual(back.log, live.log);
  assert.deepEqual(back.calendar, live.calendar, 'the calendar queue and counts carry on too');
  assert.deepEqual(back.people[0].needs, live.people[0].needs);
  assert.deepEqual(back.people[0].at, live.people[0].at);
});

test('a save rebuilds the activity, including furniture and the prelude', () => {
  const w = createWorld({ ...data(), seed: 5, time: 7 * 60 });
  let found = null;
  for (let i = 0; i < 3000 && !found; i++) {
    step(w);
    const a = w.people[0].activity;
    if (a && a.item && a.phase === 'do') found = a;
  }
  assert.ok(found, 'Sarah used some furniture');
  const back = fromSave(JSON.parse(JSON.stringify(toSave(w, createClock(w.time), 0))), data());
  const a = back.people[0].activity;
  const index = w.house.furniture.indexOf(found.item);
  assert.equal(a.item, back.house.furniture[index], 'the same piece of furniture, by its place in the house data');
  assert.equal(a.item.name, found.item.name);
});

test('a save from another version is refused, not guessed at', () => {
  const w = createWorld({ ...data(), seed: 1 });
  const save = toSave(w, createClock(w.time), 0);
  assert.throws(() => fromSave({ ...save, version: SAVE_VERSION + 1 }, data()));
});

test('the time away: real time at the running speed, one game minute per 6.25 s at 1x', () => {
  const save = { savedAt: 1000, clock: { speed: 1, carryMs: 0 } };
  assert.equal(minutesAway(save, 1000 + 60 * REAL_MS_PER_GAME_MINUTE).minutes, 60);
  assert.equal(minutesAway({ ...save, clock: { speed: 4, carryMs: 0 } }, 1000 + 60 * REAL_MS_PER_GAME_MINUTE).minutes, 240);
  assert.equal(minutesAway({ ...save, clock: { speed: 0, carryMs: 0 } }, 1000 + 999999999).minutes, 0, 'paused does not run');
  assert.equal(minutesAway(save, 500).minutes, 0, 'clock going backwards is nothing');
  assert.equal(minutesAway(save, 1e13).minutes, MINUTES_PER_YEAR, 'capped at one game year');
});

test('catching up runs the same steps as live play', () => {
  const live = createWorld({ ...data(), seed: 9, time: 7 * 60 });
  for (let i = 0; i < 500; i++) step(live);
  const late = createWorld({ ...data(), seed: 9, time: 7 * 60 });
  catchUp(late, 500);
  assert.deepEqual(late.log, live.log);
});

test('running a bath starts with the tap, then the bath', () => {
  let baths = 0;
  for (const seed of [1, 2, 3]) {
    const w = createWorld({ ...data(), seed, time: 7 * 60 });
    let prev = null;
    for (let i = 0; i < 3 * 1440; i++) {
      step(w);
      const a = w.people[0].activity;
      if (a && a !== prev && a.action.id === 'bath' && a.phase === 'do') {
        baths++;
        assert.equal(prev?.action.id, 'fillBath', 'the bath is only started straight after running it');
        assert.equal(prev.item, a.item, 'at the same bath');
      }
      prev = a;
    }
  }
  assert.ok(baths > 0, 'someone had a bath in the test');
});

test('personality changes what is wanted: a tidy person likes washing up more than a messy one', () => {
  const dishes = load('actions.json').actions.find((a) => a.id === 'dishes');
  const needs = { hunger: 100, energy: 100, bladder: 100, hygiene: 100, fun: 100, comfort: 100 };
  const tidy = scoreAction({ needs, personality: { tidy: 10 } }, dishes, 12);
  const messy = scoreAction({ needs, personality: { tidy: 0 } }, dishes, 12);
  assert.ok(tidy > messy, `${tidy} vs ${messy}`);
  assert.equal(traitFit({ active: 5 }, { active: 0.3 }), 1, 'a neutral trait changes nothing');
  assert.ok(traitFit({ active: 10 }, { active: 0.3 }) > 1 && traitFit({ active: 0 }, { active: 0.3 }) < 1);
});

test('personality rolled from the seed is the same every time, and between 0 and 10', () => {
  const a = createWorld({ ...data(), seed: 4 }).people[0].personality;
  const b = createWorld({ ...data(), seed: 4 }).people[0].personality;
  assert.deepEqual(a, b);
  for (const v of Object.values(a)) assert.ok(Number.isInteger(v) && v >= 0 && v <= 10);
});
