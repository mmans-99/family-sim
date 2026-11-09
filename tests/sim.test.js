import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createClock, advance, readClock, setSpeed, MINUTES_PER_DAY,
} from '../src/sim/clock.js';
import { createRng } from '../src/sim/rng.js';

const seconds = (s) => s * 1000;
const hours = (h) => h * 3600 * 1000;

test('1x: one game minute passes every 6.25 real seconds', () => {
  const c = createClock(0);
  assert.equal(advance(c, seconds(6.25)), 1);
});

test('1x: a game hour takes 6.25 real minutes', () => {
  const c = createClock(0);
  assert.equal(advance(c, 6.25 * 60 * 1000), 60);
});

test('1x: a game day takes 2.5 real hours', () => {
  const c = createClock(0);
  assert.equal(advance(c, hours(2.5)), MINUTES_PER_DAY);
});

test('1x: a game year takes 70 real hours and rolls into Year 2', () => {
  const c = createClock(0);
  advance(c, hours(70));
  const t = readClock(c);
  assert.equal(t.year, 2);
  assert.equal(t.day, 1);
});

test('pause stops time completely', () => {
  const c = createClock(0);
  setSpeed(c, 0);
  assert.equal(advance(c, hours(10)), 0);
});

test('2x runs twice as fast', () => {
  const c = createClock(0);
  setSpeed(c, 2);
  assert.equal(advance(c, seconds(62.5)), 20);
});

test('part-minutes are carried over, not lost', () => {
  const c = createClock(0);
  assert.equal(advance(c, seconds(3)), 0);
  assert.equal(advance(c, seconds(3.25)), 1);
});

test('readClock gives hour, day and season', () => {
  const t = readClock(createClock(7 * 60));
  assert.deepEqual(
    { year: t.year, day: t.day, season: t.season, hour: t.hour, minute: t.minute },
    { year: 1, day: 1, season: 'Spring', hour: 7, minute: 0 },
  );
});

test('the seasons change every 7 game days', () => {
  const summerStart = createClock(7 * MINUTES_PER_DAY);
  assert.equal(readClock(summerStart).season, 'Summer');
});

test('unknown speeds are rejected', () => {
  assert.throws(() => setSpeed(createClock(), 3));
});

test('the same seed gives the same numbers', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test('random numbers stay between 0 and 1', () => {
  const r = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const n = r();
    assert.ok(n >= 0 && n < 1);
  }
});
