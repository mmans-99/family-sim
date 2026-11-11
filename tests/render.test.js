import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cutOpenings, buildScene, sceneBounds, COLOURS } from '../src/render/scene.js';
import { createCamera, project, TARGET, UNIT_PX } from '../src/render/camera.js';
import { boxRect } from '../src/render/house.js';
import {
  NAME_TO_SPRITE, SPRITE_RECTS, ROOM_TILE, FLOOR_TILES, EXTRA_RECTS, NAME_TO_TILE, NAME_TO_RUG,
} from '../src/render/pack.js';

const house = JSON.parse(readFileSync(new URL('../data/house.json', import.meta.url), 'utf8'));

test('a doorway cuts a gap out of a wall', () => {
  const pieces = cutOpenings(
    { axis: 'v', at: 5, from: 0, to: 6 },
    [{ axis: 'v', at: 5, from: 2.5, to: 3.5 }],
  );
  assert.deepEqual(pieces, [{ from: 0, to: 2.5 }, { from: 3.5, to: 6 }]);
});

test('a doorway on a different line does not cut the wall', () => {
  const pieces = cutOpenings(
    { axis: 'h', at: 5, from: 0, to: 6 },
    [{ axis: 'v', at: 5, from: 2.5, to: 3.5 }],
  );
  assert.deepEqual(pieces, [{ from: 0, to: 6 }]);
});

test('the ground floor has brick outside walls and plain inside walls', () => {
  const boxes = buildScene(house, ['ground']);
  assert.ok(boxes.some((b) => b.colour === COLOURS.brick));
  assert.ok(boxes.some((b) => b.colour === COLOURS.wall));
});

test('the garden has no walls of its own, only fence', () => {
  const boxes = buildScene(house, ['garden']);
  assert.equal(boxes.some((b) => b.colour === COLOURS.brick || b.colour === COLOURS.wall), false);
  assert.ok(boxes.some((b) => b.colour === COLOURS.fence));
});

test('every box has a positive size', () => {
  for (const b of buildScene(house, ['ground', 'first', 'garden'])) {
    assert.ok(b.x1 > b.x0 && b.y1 > b.y0 && b.z1 > b.z0, JSON.stringify(b));
  }
});

test('the middle of the house lands in the middle of the screen', () => {
  const cam = createCamera();
  const p = project(cam, 400, 300, TARGET.x, TARGET.y);
  assert.equal(p.sx, 200);
  assert.equal(p.sy, 150);
});

test('one grid square is always UNIT_PX art pixels, so sprites are never stretched', () => {
  const cam = createCamera();
  cam.zoomMul = 3; // zoom changes the size of an art pixel on screen, not this maths
  const a = project(cam, 400, 300, 2, 2);
  const b = project(cam, 400, 300, 3, 3);
  assert.equal(b.sx - a.sx, UNIT_PX);
  assert.equal(b.sy - a.sy, UNIT_PX);
});

test('the back wall (y = 0) is at the top of the screen', () => {
  const cam = createCamera();
  assert.ok(project(cam, 400, 300, 6, 0).sy < project(cam, 400, 300, 6, 6).sy);
});

test('higher things have a smaller depth, so they are drawn on top', () => {
  const cam = createCamera();
  assert.ok(project(cam, 400, 300, 6, 5, 2.6).depth < project(cam, 400, 300, 6, 5, 0).depth);
});

test('a thin wall still covers at least one whole pixel', () => {
  const r = boxRect({ x0: 5, y0: 0, x1: 5.01, y1: 6 }, createCamera(), 400, 300);
  assert.equal(r.x1 - r.x0, 1);
  assert.equal(r.y1 - r.y0, 6 * UNIT_PX);
});

test('every sprite and floor tile named in the maps exists', () => {
  for (const sprite of Object.values(NAME_TO_SPRITE)) assert.ok(SPRITE_RECTS[sprite] || EXTRA_RECTS[sprite], sprite);
  for (const tile of Object.values(ROOM_TILE)) assert.ok(FLOOR_TILES[tile] || EXTRA_RECTS[tile], tile);
  for (const name of [...Object.values(NAME_TO_TILE), ...Object.values(NAME_TO_RUG)]) assert.ok(EXTRA_RECTS[name], name);
});

test('furniture stays inside its room and no two standing pieces share a square', () => {
  const used = new Set();
  for (const item of house.furniture) {
    const floor = house.floors.find((f) => f.id === item.floor);
    const inRoom = floor.rooms.some((r) => item.x >= r.x && item.y >= r.y
      && item.x + item.w <= r.x + r.w && item.y + item.d <= r.y + r.h);
    assert.ok(inRoom, `${item.name} is outside every room`);
    if (item.h < 0.05 || item.z || item.name.startsWith('tree')) continue; // rugs, things on top of others
    for (let x = item.x; x < item.x + item.w; x++) {
      for (let y = item.y; y < item.y + item.d; y++) {
        const key = `${item.floor}:${x}:${y}`;
        assert.ok(!used.has(key), `${item.name} overlaps another piece at ${key}`);
        used.add(key);
      }
    }
  }
});

test('placing a floor moves all of its boxes and nothing else', () => {
  const plain = sceneBounds(buildScene(house, ['first']));
  const moved = buildScene(house, ['first', 'ground'], { first: { x: 0, y: -8.8 } });
  const first = sceneBounds(moved.filter((b) => b.floor === 'first'));
  const ground = sceneBounds(moved.filter((b) => b.floor === 'ground'));
  assert.equal(first.y0, plain.y0 - 8.8);
  assert.equal(first.x0, plain.x0);
  assert.deepEqual(ground, sceneBounds(buildScene(house, ['ground'])));
});

test('in the whole-house layout the first floor does not touch the ground floor', () => {
  const boxes = buildScene(house, ['first', 'ground', 'garden'], { first: { x: 0, y: -8.8 } });
  const first = sceneBounds(boxes.filter((b) => b.floor === 'first'));
  const ground = sceneBounds(boxes.filter((b) => b.floor === 'ground'));
  // ground.y0 is the top of the ground floor's front-wall face, which tall sprites stand against.
  assert.ok(first.y1 + 1.5 <= ground.y0, 'leave a square and a half for the floor name');
});

test('a camera centre moves the middle of the screen', () => {
  const p = project({ panX: 0, panY: 0, cx: 1, cy: -4 }, 400, 300, 1, -4);
  assert.equal(p.sx, 200);
  assert.equal(p.sy, 150);
});

// Squares someone can stand on, and the steps between them: no wall in the way (or a doorway
// through it), and no standing furniture on the square. Rugs and things on top don't block.
function walkable(floorId) {
  const floor = house.floors.find((f) => f.id === floorId);
  const roomAt = new Map();
  for (const r of floor.rooms) {
    for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) roomAt.set(`${x},${y}`, r.id);
  }
  const blocked = new Set();
  for (const i of house.furniture) {
    if (i.floor !== floorId || i.h < 0.05 || i.z || /^(stairs|stairwell)$/.test(i.name)) continue;
    for (let x = i.x; x < i.x + i.w; x++) for (let y = i.y; y < i.y + i.d; y++) blocked.add(`${x},${y}`);
  }
  const doorBetween = (x, y, nx, ny) => (floor.doors ?? []).some((d) => (nx !== x
    ? d.axis === 'v' && d.at === Math.max(x, nx) && d.from <= y && d.to >= y + 1
    : d.axis === 'h' && d.at === Math.max(y, ny) && d.from <= x && d.to >= x + 1));
  const reach = (start) => {
    const seen = new Set([start]);
    const todo = [start];
    while (todo.length) {
      const [x, y] = todo.pop().split(',').map(Number);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const k = `${nx},${ny}`;
        if (seen.has(k) || !roomAt.has(k) || blocked.has(k)) continue;
        if (roomAt.get(k) !== roomAt.get(`${x},${y}`) && !doorBetween(x, y, nx, ny)) continue;
        seen.add(k);
        todo.push(k);
      }
    }
    return Object.assign(new Set([...seen].map((k) => roomAt.get(k))), { squares: seen });
  };
  return { floor, reach, doorBetween, roomAt };
}

test('every room on each floor can be walked to', () => {
  for (const [floorId, start] of [['ground', '6,1'], ['first', '6,5']]) {
    const { floor, reach } = walkable(floorId);
    const rooms = reach(start);
    for (const r of floor.rooms) assert.ok(rooms.has(r.id), `${r.name} cannot be reached on ${floorId}`);
  }
});

test('like a UK semi, every first-floor room opens straight off the landing', () => {
  const { floor, doorBetween, roomAt } = walkable('first');
  for (const r of floor.rooms.filter((room) => room.id !== 'landing')) {
    let found = false;
    for (let x = r.x; x < r.x + r.w; x++) {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (roomAt.get(`${nx},${ny}`) === 'landing' && doorBetween(x, y, nx, ny)) found = true;
        }
      }
    }
    assert.ok(found, `${r.name} has no door onto the landing`);
  }
});

test('every piece someone uses has a free square beside it that can be walked to', () => {
  const used = /bed|cot|cooker|sink|fridge|counter|toilet|basin|bath|washing|sofa|armchair|chair|table|wardrobe|dresser|drawers|TV unit|bookcase|toy box/;
  for (const [floorId, start] of [['ground', '6,1'], ['first', '6,5']]) {
    const { reach } = walkable(floorId);
    const squares = reach(start).squares;
    for (const i of house.furniture.filter((f) => f.floor === floorId && !f.z && used.test(f.name))) {
      let ok = false;
      for (let x = i.x - 1; x <= i.x + i.w; x++) {
        for (let y = i.y - 1; y <= i.y + i.d; y++) {
          const side = (x === i.x - 1 || x === i.x + i.w) !== (y === i.y - 1 || y === i.y + i.d);
          if (side && squares.has(`${x},${y}`)) ok = true;
        }
      }
      assert.ok(ok, `${i.name} at ${i.x},${i.y} on ${floorId} cannot be reached`);
    }
  }
});

test('steam is drawn only while someone is in an action marked steam (the bath)', async () => {
  const { createWorld, step } = await import('../src/sim/world.js');
  const { peopleToDraw } = await import('../src/render/people.js');
  const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
  const w = createWorld({ house: load('house.json'), actions: load('actions.json'), needs: load('needs.json'), people: load('people.json'), seed: 1, time: 7 * 60 });
  let seenBath = false;
  for (let m = 0; m < 1440; m++) {
    step(w);
    const out = peopleToDraw(w, ['ground', 'first', 'garden'], {}, 0, 0)[0];
    const a = w.people[0].activity;
    const inBath = a?.phase === 'do' && a.action.id === 'bath';
    if (inBath) { seenBath = true; assert.notEqual(out.steam, null); }
    else assert.equal(out.steam, null);
  }
  assert.ok(seenBath, 'Sarah has a bath within a day');
});

test('toilet and bath are blurred over the whole figure; other actions are not', async () => {
  const { createWorld, step } = await import('../src/sim/world.js');
  const { peopleToDraw } = await import('../src/render/people.js');
  const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
  const w = createWorld({ house: load('house.json'), actions: load('actions.json'), needs: load('needs.json'), people: load('people.json'), seed: 1, time: 7 * 60 });
  const seen = new Set();
  for (let m = 0; m < 1440; m++) {
    step(w);
    const out = peopleToDraw(w, ['ground', 'first', 'garden'], {}, 0, 0)[0];
    const a = w.people[0].activity;
    if (a?.phase === 'do') {
      seen.add(a.action.id);
      const expected = a.action.id === 'toilet' || a.action.id === 'bath';
      assert.equal(out.blur, expected, `${a.action.id} blur`);
    }
  }
  assert.ok(seen.has('toilet') && seen.has('bath'), 'the day has a toilet visit and a bath');
});
