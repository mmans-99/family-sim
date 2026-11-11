import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMap, keyOf } from '../src/sim/housemap.js';
import { createWorld, step, inHours, scoreAction, allowed } from '../src/sim/world.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const data = () => ({ house: load('house.json'), actions: load('actions.json'), needs: load('needs.json'), people: load('people.json') });
const map = buildMap(load('house.json'));

function route(from, to) {
  const { prev } = map.distances(from);
  return map.pathTo(prev, from, to);
}

test('the route from the master bedroom to the kitchen goes down the stairs', () => {
  const path = route(keyOf('first', 3, 1), keyOf('ground', 8, 1));
  assert.ok(path, 'no route');
  assert.ok(path.includes(keyOf('ground', 5, 4)) && path.includes(keyOf('ground', 5, 1)), path.join(' '));
  assert.ok(path.includes(keyOf('first', 5, 5)), 'the stairs start at the landing');
});

test('the stairs can only be entered from their ends, not over the banister', () => {
  assert.ok(!map.neighbours(keyOf('ground', 6, 2)).includes(keyOf('ground', 5, 2)));
  assert.ok(map.neighbours(keyOf('ground', 5, 0)).includes(keyOf('ground', 5, 1)));
  assert.ok(!map.squares.has(keyOf('first', 5, 2)), 'the stairwell is a hole');
});

test('the garden is reached through the back door', () => {
  const path = route(keyOf('ground', 6, 1), keyOf('garden', 1, 9));
  assert.ok(path.includes(keyOf('ground', 6, 5)) && path.includes(keyOf('garden', 6, 6)), path.join(' '));
});

test('every action has at least one piece of furniture it can be done at', () => {
  const house = load('house.json');
  for (const a of load('actions.json').actions) {
    const items = house.furniture.filter((f) => f.name === a.object);
    assert.ok(items.some((i) => map.useSquares(i).length), a.id);
  }
});

test('hours can run across midnight', () => {
  assert.ok(inHours(23, [22, 7]) && inHours(3, [22, 7]) && !inHours(12, [22, 7]));
  assert.ok(inHours(9, [8, 20]) && !inHours(20, [8, 20]));
});

test('lower needs score higher', () => {
  const toilet = load('actions.json').actions.find((a) => a.id === 'toilet');
  assert.ok(scoreAction({ needs: { bladder: 20 } }, toilet, 12) > scoreAction({ needs: { bladder: 80 } }, toilet, 12));
});

test('washing up only follows cooking', () => {
  const dishes = load('actions.json').actions.find((a) => a.id === 'dishes');
  assert.equal(allowed({ lastDone: {} }, dishes, 600), false);
  assert.equal(allowed({ lastDone: { cook: 500 } }, dishes, 600), true);
  assert.equal(allowed({ lastDone: { cook: 500, dishes: 550 } }, dishes, 600), false);
});

test('same seed, same day', () => {
  const a = createWorld({ ...data(), seed: 7 });
  const b = createWorld({ ...data(), seed: 7 });
  for (let i = 0; i < 1440; i++) { step(a); step(b); }
  assert.deepEqual(a.log, b.log);
  assert.deepEqual(a.people[0].needs, b.people[0].needs);
});

test('over two days Sarah eats, sleeps at night, uses the toilet, and needs stay in range', () => {
  const w = createWorld({ ...data(), seed: 3 });
  const did = new Set();
  let sleptAtNight = false;
  let lowest = 100;
  for (let i = 0; i < 2 * 1440; i++) {
    step(w);
    const p = w.people[0];
    if (p.activity?.action.id) did.add(p.activity.action.id);
    const hour = Math.floor((w.time % 1440) / 60);
    if (p.activity?.phase === 'do' && p.activity.action.sleep && (hour >= 23 || hour < 4)) sleptAtNight = true;
    for (const v of Object.values(p.needs)) {
      assert.ok(v >= 0 && v <= 100);
      lowest = Math.min(lowest, v);
    }
    assert.ok(w.map.squares.has(p.at), `standing somewhere real: ${p.at}`);
  }
  for (const id of ['cook', 'toilet', 'sleep']) assert.ok(did.has(id), `never did ${id}`);
  assert.ok(sleptAtNight, 'should be asleep in the middle of the night');
  assert.ok(lowest > 15, `a need fell to ${lowest}`);
});

test('someone on the stairs is drawn after the flight, so they are not hidden by it', async () => {
  const { peopleToDraw } = await import('../src/render/people.js');
  const w = createWorld({ ...data(), seed: 1 });
  w.people[0].at = keyOf('ground', 5, 2);
  const [d] = peopleToDraw(w, ['ground']);
  assert.ok(d.row > 5, `row ${d.row}`);
});

test('people face the way they move: down the screen shows their front', async () => {
  const { facing } = await import('../src/render/people.js');
  assert.equal(facing(0, 1), 'front');
  assert.equal(facing(0, -1), 'back');
  assert.equal(facing(1, 0), 'right');
  assert.equal(facing(-1, 0), 'left');
  assert.equal(facing(-1, -1), 'back_left');
});

test('the face follows the needs', async () => {
  const { mood } = await import('../src/render/people.js');
  assert.equal(mood({ hunger: 90, energy: 90, fun: 90 }), 'happy');
  assert.equal(mood({ hunger: 90, energy: 25, fun: 90 }), 'tired');
  assert.equal(mood({ hunger: 10, energy: 90, fun: 90 }), 'uneasy');
  assert.equal(mood({ hunger: 60, energy: 60, fun: 60 }), 'content');
});

test('every frame people.js can ask for is on Mum\'s sheet', async () => {
  const meta = JSON.parse(readFileSync(new URL('../assets/people/sarah.json', import.meta.url), 'utf8'));
  const dirs = ['front', 'front_right', 'right', 'back_right', 'back', 'back_left', 'left', 'front_left'];
  for (const anim of ['idle', 'walk', 'interact']) {
    for (const d of dirs) for (let f = 0; f < 4; f++) assert.ok(meta.rects[`${anim}_${d}_${f}`], `${anim}_${d}_${f}`);
    for (const m of ['happy', 'tired', 'uneasy']) for (let f = 0; f < 4; f++) assert.ok(meta.rects[`${anim}_front_${f}_${m}`]);
  }
  for (let f = 0; f < 4; f++) assert.ok(meta.rects[`sit_front_${f}`]);
  assert.ok(meta.rects.lie);
});

test('a walk starts on the first square and moves at most 8 squares a minute', () => {
  const w = createWorld({ ...data(), seed: 7, time: 7 * 60 });
  const p = w.people[0];
  let walks = 0;
  let lastAct = null;
  let lastPos = 0;
  for (let m = 0; m < 600; m++) {
    const before = p.at;
    step(w);
    const a = p.activity;
    if (a && a !== lastAct && a.phase === 'walk') {
      walks++;
      assert.equal(a.pos, 0, 'a new walk starts at pos 0');
      assert.equal(p.at, before, 'still on the start square the minute it is chosen');
      assert.equal(a.path[0], before);
    } else if (a && a === lastAct && a.phase === 'walk') {
      assert.ok(a.pos - lastPos <= 8, `moved ${a.pos - lastPos} squares in one minute`);
    }
    lastAct = a;
    lastPos = a ? a.pos : 0;
  }
  assert.ok(walks > 0, 'Sarah walked somewhere in the test');
});
