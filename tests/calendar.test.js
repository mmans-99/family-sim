import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calendarDate, calendarSpan, dateAt, dueOnGameDay, weekday, formatDate, gameDayDates } from '../src/sim/calendar.js';
import { createWorld, step } from '../src/sim/world.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const cal = load('calendar.json');
const { start, rules } = cal;
const DAY = 1440;

// Count what fires over `years` game years, from the first game day.
function firingsOver(gameDays) {
  const counts = {};
  const seen = new Set();
  for (let g = 0; g < gameDays; g++) {
    for (const e of dueOnGameDay(g, rules, start)) {
      const key = `${e.id}@${e.date.year}-${e.date.month}-${e.date.day}`;
      assert.ok(!seen.has(key), `${key} fired twice`);
      seen.add(key);
      counts[e.id] = (counts[e.id] ?? 0) + 1;
    }
  }
  return counts;
}

test('game day 1 is 1 March 2026, and game year 1 ends at the end of February 2027', () => {
  assert.equal(formatDate(calendarDate(7 * 60, start)), '1 Mar 2026');
  assert.equal(formatDate(calendarDate(27 * DAY + 100, start)), '15 Feb 2027', 'the last game day starts mid-February');
  const [, last] = calendarSpan(27);
  assert.equal(formatDate(dateAt(last, start)), '28 Feb 2027');
});

test('the clock shows the whole game day, so every event that day is inside it', () => {
  assert.equal(gameDayDates(2 * DAY + 360, start), '27 Mar 2026 – 8 Apr 2026');
  for (let g = 0; g < 4 * 28; g++) {
    for (const e of dueOnGameDay(g, rules, start)) {
      const [first, last] = calendarSpan(g);
      const i = (Date.UTC(e.date.year, e.date.month - 1, e.date.day) - Date.UTC(start.year, start.month - 1, start.day)) / 86400000;
      assert.ok(i >= first && i <= last, `${formatDate(e.date)} is in game day ${g}`);
    }
  }
});

test('the spans of game days join up: no calendar day is skipped or repeated', () => {
  let expectNext = calendarSpan(0)[0];
  for (let g = 0; g < 4 * 28; g++) {
    const [first, last] = calendarSpan(g);
    assert.equal(first, expectNext, `game day ${g} starts where the last one stopped`);
    expectNext = last + 1;
  }
});

test('one game year: 12 mortgages, 12 paydays, 4 energy cap changes, 1 Christmas', () => {
  const c = firingsOver(28);
  assert.deepEqual(
    { mortgage: c.mortgage, payday: c.payday, energyCap: c.energyCap, christmas: c.christmas },
    { mortgage: 12, payday: 12, energyCap: 4, christmas: 1 },
  );
});

test('four game years (through leap year 2028): 48 mortgages, 47 paydays, 16 energy cap changes, 4 Christmases', () => {
  // Four game years are 1,460 calendar days, from 1 March 2026 to 27 February 2030. The payday
  // of 28 February 2030 falls in game year 5, so 47 paydays is correct here, not 48.
  const c = firingsOver(4 * 28);
  assert.deepEqual(
    { mortgage: c.mortgage, payday: c.payday, energyCap: c.energyCap, christmas: c.christmas },
    { mortgage: 48, payday: 47, energyCap: 16, christmas: 4 },
  );
});

test('a rule that falls on 29 February is not lost in a leap year', () => {
  const leap = [{ id: 'leap', label: 'Leap', repeat: 'yearly', month: 2, day: 29, hour: 0 }];
  const hits = [];
  for (let g = 0; g < 4 * 28; g++) for (const e of dueOnGameDay(g, leap, start)) hits.push(formatDate(e.date));
  assert.deepEqual(hits, ['29 Feb 2028']);
});

test('weekdays cycle Monday to Sunday every 7 game days, starting on game day 1', () => {
  const names = [];
  for (let g = 0; g < 8; g++) names.push(weekday(g * DAY + 7 * 60));
  assert.deepEqual(names, [0, 1, 2, 3, 4, 5, 6, 0]);
});

test('running the world fires each dated event once, at its hour, and writes it to the log', () => {
  const people = load('people.json');
  const w = createWorld({ house: load('house.json'), actions: load('actions.json'), needs: load('needs.json'), people, calendar: cal, seed: 1, time: 0 });
  // Start at midnight so the mortgage (06:00 on 1 March) is in the future.
  const logBefore = w.log.length;
  let fireTimes = [];
  for (let i = 0; i < 7 * DAY; i++) {
    const before = w.log.length;
    step(w);
    for (const e of w.log.slice(before)) if (e.who === 'House') fireTimes.push([w.time, e.text]);
  }
  // Seven game days cover three month-starts: 1 March, 1 April and 1 May, each once.
  assert.equal(w.calendar.fired.mortgage, 3);
  const [t, text] = fireTimes.find(([, x]) => x.startsWith('Mortgage')) ?? [];
  assert.equal(t, 6 * 60, 'at 06:00 game time');
  assert.equal(text, 'Mortgage payment (1 Mar 2026)');
  assert.ok(w.log.length >= logBefore);
});

test('a game that starts mid-day does not fire events that already passed that day', () => {
  const w = createWorld({ house: load('house.json'), actions: load('actions.json'), needs: load('needs.json'), people: load('people.json'), calendar: cal, seed: 1, time: 7 * 60 });
  assert.equal(w.calendar.queue.some((e) => e.id === 'mortgage'), false, 'the 06:00 mortgage is already past at 07:00');
});
