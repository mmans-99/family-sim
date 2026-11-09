import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cutOpenings, buildScene, COLOURS } from '../src/render/scene.js';
import { createCamera, project, facesViewer, TARGET } from '../src/render/camera.js';

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
  for (const b of buildScene(house, ['ground', 'first', 'garden'], { first: 1.2 })) {
    assert.ok(b.x1 > b.x0 && b.y1 > b.y0 && b.z1 > b.z0, JSON.stringify(b));
  }
});

test('the middle of the house lands in the middle of the screen', () => {
  const cam = createCamera();
  const p = project(cam, 400, 300, TARGET.x, TARGET.y, TARGET.z);
  assert.equal(p.sx, 200);
  assert.equal(p.sy, 150);
});

test('the top of a box faces the viewer and its underside does not', () => {
  const cam = createCamera();
  assert.equal(facesViewer(cam, [0, 0, 1]), true);
  assert.equal(facesViewer(cam, [0, 0, -1]), false);
});

test('with no turn, points further along +y have a bigger depth', () => {
  const cam = createCamera();
  cam.yaw = 0;
  const near = project(cam, 400, 300, 6, 1, 0);
  const far = project(cam, 400, 300, 6, 9, 0);
  assert.ok(far.depth > near.depth);
});

import { applyCutaway, CUT_HEIGHT } from '../src/render/scene.js';

test('cutaway lowers the walls nearest the camera and keeps the far ones', () => {
  const cam = createCamera();
  cam.yaw = 0;
  const cut = applyCutaway(buildScene(house, ['ground']), cam, true);
  const front = cut.filter((b) => b.kind === 'wall' && Math.abs((b.y0 + b.y1) / 2) < 0.1);
  const back = cut.filter((b) => b.kind === 'wall' && Math.abs((b.y0 + b.y1) / 2 - 6) < 0.1);
  assert.ok(front.length > 0 && back.length > 0);
  assert.ok(front.every((b) => Math.abs(b.z1 - b.z0 - CUT_HEIGHT) < 1e-9));
  assert.ok(back.every((b) => Math.abs(b.z1 - b.z0 - 2.6) < 1e-9));
});

test('cutaway also removes the doors and windows on the near walls', () => {
  const cam = createCamera();
  cam.yaw = 0;
  const cut = applyCutaway(buildScene(house, ['ground']), cam, true);
  const nearOpenings = cut.filter(
    (b) => (b.kind === 'door' || b.kind === 'window') && Math.abs(b.mid.y) < 0.1,
  );
  assert.equal(nearOpenings.length, 0);
});

test('turning cutaway off leaves the scene untouched', () => {
  const cam = createCamera();
  const boxes = buildScene(house, ['ground']);
  assert.equal(applyCutaway(boxes, cam, false), boxes);
});
