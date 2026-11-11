import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  artPixelFor, glideFactor, glide, aimPoint, clampCentre, stepZoom, viewSquares,
  artToGrid, mapFrame, toMap, fromMap, ZOOM_SQUARES, LOOK_AHEAD, GLIDE_PER_FRAME,
} from '../src/render/follow.js';
import { project, UNIT_PX } from '../src/render/camera.js';

const PHONE_LANDSCAPE = { w: 2532, h: 1170 }; // 844 x 390 CSS at 3x

test('the pixel size is a whole number that fits the squares', () => {
  for (const [w, h, sw, sh] of [[2532, 1170, 14, 8], [2532, 1170, 8, 5], [1170, 2532, 14, 8], [640, 480, 12, 17]]) {
    const px = artPixelFor(w, h, sw, sh);
    assert.equal(Number.isInteger(px), true);
    assert.ok(px >= 1);
    assert.ok(sw * UNIT_PX * px <= w, `${sw} squares x${px} fit ${w} wide`);
    assert.ok(sh * UNIT_PX * px <= h, `${sh} squares x${px} fit ${h} high`);
    // One more device pixel per art pixel would not fit both ways.
    assert.ok(sw * UNIT_PX * (px + 1) > w || sh * UNIT_PX * (px + 1) > h);
  }
});

test('every zoom level gives a whole pixel size on a phone in landscape', () => {
  for (const level of ['close', 'room']) {
    const sq = viewSquares(level, { w: 17, h: 13 });
    assert.deepEqual(sq, ZOOM_SQUARES[level]);
    const px = artPixelFor(PHONE_LANDSCAPE.w, PHONE_LANDSCAPE.h, sq.w, sq.h);
    assert.ok(Number.isInteger(px) && px >= 1);
  }
  assert.deepEqual(viewSquares('whole', { w: 17, h: 13 }), { w: 17, h: 13 });
});

test('closer zoom levels make art pixels bigger', () => {
  const close = artPixelFor(PHONE_LANDSCAPE.w, PHONE_LANDSCAPE.h, 8, 5);
  const room = artPixelFor(PHONE_LANDSCAPE.w, PHONE_LANDSCAPE.h, 14, 8);
  const whole = artPixelFor(PHONE_LANDSCAPE.w, PHONE_LANDSCAPE.h, 17, 13);
  assert.ok(close > room && room > whole, `${close} ${room} ${whole}`);
});

test('zooming steps between levels and stops at the ends', () => {
  assert.equal(stepZoom('whole', true), 'room');
  assert.equal(stepZoom('room', true), 'close');
  assert.equal(stepZoom('close', true), 'close');
  assert.equal(stepZoom('close', false), 'room');
  assert.equal(stepZoom('room', false), 'whole');
  assert.equal(stepZoom('whole', false), 'whole');
});

test('the glide covers about 15% a frame at 60 frames a second', () => {
  assert.ok(Math.abs(glideFactor(1000 / 60) - GLIDE_PER_FRAME) < 1e-12);
  assert.equal(glideFactor(0), 0);
});

test('the glide is the same speed at any frame rate', () => {
  // Two half-length frames cover the same distance as one full frame.
  const once = glide(0, 10, 1000 / 30);
  const twice = glide(glide(0, 10, 1000 / 60), 10, 1000 / 60);
  assert.ok(Math.abs(once - twice) < 1e-9, `${once} vs ${twice}`);
});

test('the glide approaches its target and never overshoots', () => {
  let v = 0;
  for (let i = 0; i < 400; i++) {
    const next = glide(v, 7, 16);
    assert.ok(next >= v && next <= 7, `step ${i}: ${next}`);
    v = next;
  }
  assert.ok(Math.abs(v - 7) < 1e-3);
});

test('a long pause does not make the camera jump', () => {
  assert.equal(glide(0, 10, 60000), glide(0, 10, 100));
});

test('the camera looks two squares ahead of a walker', () => {
  const p = aimPoint({ x: 4, y: 3 }, { x: 1, y: 0 });
  assert.deepEqual(p, { x: 4 + LOOK_AHEAD, y: 3 });
  const up = aimPoint({ x: 4, y: 3 }, { x: 0, y: -1 });
  assert.deepEqual(up, { x: 4, y: 3 - LOOK_AHEAD });
});

test('a standing person is aimed at directly', () => {
  assert.deepEqual(aimPoint({ x: 4, y: 3 }, { x: 0, y: 0 }), { x: 4, y: 3 });
});

test('the view stays inside the world', () => {
  // A 10-square view in a world from 0 to 20: the centre cannot go under 5 or over 15.
  assert.equal(clampCentre(0, 10, 0, 20), 5);
  assert.equal(clampCentre(30, 10, 0, 20), 15);
  assert.equal(clampCentre(9, 10, 0, 20), 9);
});

test('a world smaller than the view is centred', () => {
  assert.equal(clampCentre(0, 30, 0, 20), 10);
});

test('an art pixel maps back to the grid square it came from', () => {
  const cx = 6;
  const cy = 3;
  const lw = 224;
  const lh = 128;
  const cam = { cx, cy, panX: 0, panY: 0 };
  const p = project(cam, lw, lh, 4.25, 2.5);
  const g = artToGrid(cx, cy, lw, lh, p.sx, p.sy);
  assert.ok(Math.abs(g.x - 4.25) < 1e-9);
  assert.ok(Math.abs(g.y - 2.5) < 1e-9);
});

test('the minimap maps the world into its box and back', () => {
  const world = { x0: -1, y0: -9, x1: 12, y1: 8 };
  const frame = mapFrame(world, 120, 170);
  const corner = toMap(frame, world.x0, world.y0);
  assert.ok(corner.mx >= 0 && corner.my >= 0);
  const far = toMap(frame, world.x1, world.y1);
  assert.ok(far.mx <= 120 + 1e-9 && far.my <= 170 + 1e-9);
  const back = fromMap(frame, toMap(frame, 3.5, -2).mx, toMap(frame, 3.5, -2).my);
  assert.ok(Math.abs(back.x - 3.5) < 1e-9 && Math.abs(back.y + 2) < 1e-9);
});
