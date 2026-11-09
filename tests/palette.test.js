import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestColour, OUTLINE, BACKGROUND } from '../src/render/palette.js';

const LEVELS = [0, 36, 73, 109, 146, 182, 219, 255];

test('palette entries map to themselves', () => {
  assert.deepEqual(nearestColour(...OUTLINE), OUTLINE);
  assert.deepEqual(nearestColour(...BACKGROUND), BACKGROUND);
  assert.deepEqual(nearestColour(255, 255, 255), [255, 255, 255]);
});

test('a blended pixel between outline and wall snaps to a palette colour, not grey', () => {
  const mid = nearestColour(142, 140, 152);
  const onLevels = mid.every((c) => LEVELS.includes(c));
  const isOutlineOrBackground = [OUTLINE, BACKGROUND].some((p) => p.every((v, i) => v === mid[i]));
  assert.ok(onLevels || isOutlineOrBackground, `unexpected colour ${mid}`);
});

test('any input maps to a palette colour', () => {
  for (const v of [0, 17, 90, 200, 251]) {
    const c = nearestColour(v, v + 3, 255 - v);
    const ok = c.every((x) => LEVELS.includes(x)) ||
      [OUTLINE, BACKGROUND].some((p) => p.every((x, i) => x === c[i]));
    assert.ok(ok, `not a palette colour: ${c}`);
  }
});
