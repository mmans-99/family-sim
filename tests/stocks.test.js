import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addStock, change, read, ledger } from '../src/sim/stocks.js';

// A small world with only money in it: no people, no calendar.
const fresh = () => {
  const w = { time: 0, stocks: {} };
  addStock(w, { id: 'acct.joint', value: 100, min: 0, floor: 'spill', spillTo: 'debt.overdraft' });
  addStock(w, { id: 'acct.savings', value: 8000, min: 0, floor: 'hard' });
  addStock(w, { id: 'debt.overdraft', value: 0, min: 0, max: 1500, floor: 'hard', ceiling: 'hard' });
  return w;
};

test('money out below £0 spills into the overdraft and returns the full amount', () => {
  const w = fresh();
  assert.equal(change(w, 'acct.joint', -250, 'Bill'), -250);
  assert.equal(read(w, 'acct.joint'), 0);
  assert.equal(read(w, 'debt.overdraft'), 150);
});

test('a full overdraft pays only part of a bill, and returns the part that was paid', () => {
  const w = fresh();
  w.stocks['debt.overdraft'].value = 1400;
  assert.equal(change(w, 'acct.joint', -300, 'Bill'), -200, 'the £100 in the account, then £100 of overdraft room; £200 unpaid');
  assert.equal(read(w, 'acct.joint'), 0);
  assert.equal(read(w, 'debt.overdraft'), 1500);
});

test('a hard floor stops at the floor', () => {
  const w = fresh();
  assert.equal(change(w, 'acct.savings', -9000, 'Big spend'), -8000);
  assert.equal(read(w, 'acct.savings'), 0);
});

test('a hard ceiling stops a credit at its maximum', () => {
  const w = fresh();
  w.stocks['debt.overdraft'].value = 1400;
  assert.equal(change(w, 'debt.overdraft', 200, 'Borrowed'), 100);
  assert.equal(read(w, 'debt.overdraft'), 1500);
});

test('money in clears the overdraft before the account grows', () => {
  const w = fresh();
  w.stocks['acct.joint'].value = 0;
  w.stocks['debt.overdraft'].value = 150;
  assert.equal(change(w, 'acct.joint', 400, 'Pay'), 400);
  assert.equal(read(w, 'debt.overdraft'), 0);
  assert.equal(read(w, 'acct.joint'), 250);
});

test('a change of zero writes nothing', () => {
  const w = fresh();
  assert.equal(change(w, 'acct.joint', 0, 'Nothing'), 0);
  assert.equal(ledger(w, 'acct.joint').length, 0);
});

test('amounts are kept to the penny', () => {
  const w = fresh();
  w.stocks['acct.joint'].value = 0;
  change(w, 'acct.joint', 0.1, 'a');
  change(w, 'acct.joint', 0.2, 'a');
  assert.equal(read(w, 'acct.joint'), 0.3);
});

test('the ledger keeps the newest entries and rolls the rest into totals by reason', () => {
  const w = fresh();
  addStock(w, { id: 'acct.tea', value: 10, min: 0, ledgerKeep: 3 });
  for (let i = 0; i < 5; i++) {
    w.time = i;
    change(w, 'acct.tea', -1, 'Tea', `cup ${i}`);
  }
  const entries = ledger(w, 'acct.tea');
  assert.equal(entries.length, 3);
  assert.deepEqual(entries.map((e) => e.t), [2, 3, 4], 'newest last');
  assert.equal(entries[2].ref, 'cup 4');
  assert.equal(w.stocks['acct.tea'].ledgerTotals.Tea, -2, 'the two oldest rolled up');
  const kept = entries.reduce((sum, e) => sum + e.amount, 0);
  assert.equal(kept + w.stocks['acct.tea'].ledgerTotals.Tea, -5, 'nothing is lost in the roll-up');
});

test('the ledger records what moved on each stock, with its reason', () => {
  const w = fresh();
  w.time = 42;
  w.stocks['acct.joint'].value = 0;
  change(w, 'acct.joint', -50, 'Water', 'water');
  assert.equal(ledger(w, 'acct.joint').length, 0, 'nothing moved on the account, so nothing is written');
  assert.deepEqual(ledger(w, 'debt.overdraft'), [{ t: 42, amount: 50, reason: 'Water', ref: 'water' }], 'the overdraft took it');
});

test('an unknown stock is an error, not a silent zero', () => {
  assert.throws(() => read(fresh(), 'acct.nope'), /No stock called acct.nope/);
});
