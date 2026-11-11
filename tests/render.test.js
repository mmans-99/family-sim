import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cutOpenings, buildScene, sceneBounds, COLOURS } from '../src/render/scene.js';
import { createCamera, project, TARGET, UNIT_PX } from '../src/render/camera.js';
import { boxRect } from '../src/render/house.js';
import { NAME_TO_SPRITE, SPRITE_RECTS, ROOM_TILE, FLOOR_TILES } from '../src/render/pack.js';

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
  for (const sprite of Object.values(NAME_TO_SPRITE)) assert.ok(SPRITE_RECTS[sprite], sprite);
  for (const tile of Object.values(ROOM_TILE)) assert.ok(FLOOR_TILES[tile], tile);
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
  const moved = buildScene(house, ['first', 'ground'], { first: { x: 0, y: -8.5 } });
  const first = sceneBounds(moved.filter((b) => b.floor === 'first'));
  const ground = sceneBounds(moved.filter((b) => b.floor === 'ground'));
  assert.equal(first.y0, plain.y0 - 8.5);
  assert.equal(first.x0, plain.x0);
  assert.deepEqual(ground, sceneBounds(buildScene(house, ['ground'])));
});

test('in the whole-house layout the first floor does not touch the ground floor', () => {
  const boxes = buildScene(house, ['first', 'ground', 'garden'], { first: { x: 0, y: -8.5 } });
  const first = sceneBounds(boxes.filter((b) => b.floor === 'first'));
  const ground = sceneBounds(boxes.filter((b) => b.floor === 'ground'));
  assert.ok(first.y1 + 2 <= ground.y0, 'leave two squares for tall sprites and the floor name');
});

test('a camera centre moves the middle of the screen', () => {
  const p = project({ panX: 0, panY: 0, cx: 1, cy: -4 }, 400, 300, 1, -4);
  assert.equal(p.sx, 200);
  assert.equal(p.sy, 150);
});
