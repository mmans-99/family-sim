import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillPolygon, drawLine, outlinePolygon } from '../src/render/raster.js';

const blank = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
const isSet = (buf, x, y) => buf.data[(y * buf.width + x) * 4 + 3] === 255;
const count = (buf) => { let n = 0; for (let y = 0; y < buf.height; y++) for (let x = 0; x < buf.width; x++) if (isSet(buf, x, y)) n++; return n; };

test('a square fill covers exactly its whole pixels', () => {
  const buf = blank(10, 10);
  fillPolygon(buf, [{ sx: 2, sy: 2 }, { sx: 6, sy: 2 }, { sx: 6, sy: 6 }, { sx: 2, sy: 6 }], [255, 0, 0]);
  assert.equal(count(buf), 16);
  assert.ok(isSet(buf, 2, 2) && isSet(buf, 5, 5));
  assert.ok(!isSet(buf, 6, 6) && !isSet(buf, 1, 1));
});

test('fills contain no partial pixels: every set pixel has the full colour', () => {
  const buf = blank(20, 20);
  fillPolygon(buf, [{ sx: 1.3, sy: 1.7 }, { sx: 15.6, sy: 4.2 }, { sx: 8.1, sy: 17.9 }], [9, 8, 7]);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const i = (y * 20 + x) * 4;
    if (isSet(buf, x, y)) assert.deepEqual([...buf.data.slice(i, i + 3)], [9, 8, 7]);
  }
});

test('a line between two points covers its end pixels and no gaps', () => {
  const buf = blank(10, 10);
  drawLine(buf, 1, 1, 8, 1, [0, 0, 0]);
  for (let x = 1; x <= 8; x++) assert.ok(isSet(buf, x, 1), `gap at ${x}`);
  assert.equal(count(buf), 8);
});

test('an outline draws its edges and leaves the inside empty', () => {
  const buf = blank(12, 12);
  outlinePolygon(buf, [{ sx: 2, sy: 2 }, { sx: 9, sy: 2 }, { sx: 9, sy: 9 }, { sx: 2, sy: 9 }], [0, 0, 0]);
  assert.ok(isSet(buf, 2, 5) && isSet(buf, 9, 5) && isSet(buf, 5, 2));
  assert.ok(!isSet(buf, 5, 5));
});
