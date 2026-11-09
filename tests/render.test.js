import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoPoint } from '../src/render/house.js';

test('the grid origin sits at the top corner of the diamond', () => {
  assert.deepEqual(isoPoint(0, 0, 40), { x: 0, y: 0 });
});

test('one cell along x goes down and to the right', () => {
  assert.deepEqual(isoPoint(1, 0, 40), { x: 20, y: 10 });
});

test('one cell along y goes down and to the left', () => {
  assert.deepEqual(isoPoint(0, 1, 40), { x: -20, y: 10 });
});
