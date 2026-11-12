// Tests for the replay harness (docs/LIFE_SYSTEMS.md 15a, Step 6). The harness is in tools/replay/.
// One game year and seeds 1 and 2 keep the file quick; the seed reports are built once at the top.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorld, step } from '../src/sim/world.js';
import { loadData } from '../tools/replay/load.js';
import { runSeed, runSeedDetailed, runMany } from '../tools/replay/run.js';
import { findTurningPoints } from '../tools/replay/turning.js';
import {
  checkFinite, checkLimits, checkReconciles, checkLedgerComplete, checkMortgageFalls,
  checkCalendarExact, checkNeedsInRange, checkStressInRange, checkLagNoOvershoot,
  checkSleepDebtInRange, checkWellbeingReconciles, INVARIANTS,
} from '../tools/replay/checks.js';
import { textSummary } from '../tools/replay/summary.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = loadData(ROOT);
const oneYear = (seed) => runSeedDetailed(data, { seed, years: 1 });

const first = oneYear(1);
const second = oneYear(2);

test('same seed, same report', () => {
  const again = runSeed(data, { seed: 1, years: 1 });
  assert.deepEqual(again, first.report);
});

test('the harness only reads: the world ends exactly as a plain run of the same minutes', () => {
  const plain = createWorld({ ...JSON.parse(JSON.stringify(data)), seed: 1 });
  const end = 1 * 28 * 1440 - 1; // the harness stops at 23:59 on the last game day
  while (plain.time < end) step(plain);
  const pick = (w) => JSON.stringify({ stocks: w.stocks, people: w.people, fired: w.calendar.fired, log: w.log });
  assert.equal(pick(first.world), pick(plain));
});

test('invariants pass for seeds 1 and 2; seed 1 ends with the hand-sum money and no turning points', () => {
  for (const r of [first.report, second.report]) {
    for (const inv of r.invariants) assert.equal(inv.ok, true, `seed ${r.seed} ${inv.id}: ${inv.detail}`);
  }
  // The joint account at 23:59 on the last game day: the hand sum in tests/household.test.js.
  assert.equal(first.report.run.money.stocks['acct.joint'].end, 19862.96);
  assert.deepEqual(first.report.turningPoints, []);
  const across = runMany(data, { seeds: 1, years: 1 }).across;
  assert.equal(across.singleCauseShare, null);
});

test('each invariant can fail, with a useful detail', () => {
  const bad = [
    checkFinite({ stock: 'acct.joint', day: 3, value: NaN }),
    checkLimits({ stock: 'debt.overdraft', low: -1, high: 0, min: 0, max: 1500 }),
    checkLimits({ stock: 'debt.overdraft', low: 0, high: 1501, min: 0, max: 1500 }),
    checkReconciles({ stock: 'acct.joint', start: 2500, end: 2600, total: 99.99 }),
    checkLedgerComplete({ stock: 'acct.joint', day: 9, ledgerKeep: 60, length: 60, oldestKeptT: 500, newestReadT: 100 }),
    checkMortgageFalls({ day: 4, from: 100, to: 101 }),
    checkCalendarExact({ rule: 'mortgage', expected: 12, fired: 13 }),
    checkNeedsInRange({ label: 'sarah.energy', low: 10, high: 101 }),
  ];
  for (const r of bad) {
    assert.equal(r.ok, false, `${r.id} should fail`);
    assert.ok(r.detail.length > 10, `${r.id} needs a detail`);
  }
  // And each passes on good input.
  assert.equal(checkLedgerComplete({ stock: 'acct.joint', day: 9, ledgerKeep: 60, length: 60, oldestKeptT: 50, newestReadT: 100 }).ok, true);
  assert.equal(checkReconciles({ stock: 'acct.joint', start: 2500, end: 2600, total: 100 }).ok, true);
});

test('seeds differ where they should; money is the same for every seed and the warning says so', () => {
  const runs = runMany(data, { seeds: 2, years: 1 });
  assert.notEqual(JSON.stringify(first.report.run.actions), JSON.stringify(second.report.run.actions));
  assert.equal(runs.across.moneyIdentical, true);
  assert.equal(runs.across.actionsDistinct, 2);
  assert.ok(runs.warnings.some((w) => w.startsWith('Every seed has the same money')));
});

test('turning points on made-up numbers: one point, causes largest first, two big', () => {
  const quiet = Array.from({ length: 20 }, (_, i) => ({
    gameDay: i, date: `d${i}`, stock: 'acct.joint', net: i % 2 ? 50 : -50, gross: 50, byReason: { Pay: i % 2 ? 50 : -50 },
  }));
  const shock = {
    gameDay: 20, date: 'shock', stock: 'acct.joint', net: -2000, gross: 2000,
    byReason: { Food: -500, Insurance: -1500 },
  };
  const cfg = { minChange: 1000, timesMedian: 3, bigCauseShare: 0.25, maxCauses: 3 };
  const points = findTurningPoints([...quiet, shock], cfg);
  assert.equal(points.length, 1);
  assert.equal(points[0].gameDay, 20);
  assert.deepEqual(points[0].causes.map((c) => c.reason), ['Insurance', 'Food']);
  assert.equal(points[0].bigCauses, 2);

  const small = { ...shock, net: -900, gross: 900, byReason: { Food: -900 } };
  assert.equal(findTurningPoints([...quiet, small], cfg).length, 0, 'a day of −£900 is below minChange');
});

test('two game years: two yearly entries, and year 2 starts where year 1 ended; calendar still exact', () => {
  const { report } = runSeedDetailed(data, { seed: 1, years: 2 });
  assert.equal(report.yearly.length, 2);
  const [y1, y2] = report.yearly;
  for (const id of Object.keys(y1.money)) {
    assert.equal(y2.money[id].start, y1.money[id].end, `${id} carries over`);
  }
  assert.equal(report.invariants.every((i) => i.ok), true, JSON.stringify(report.invariants));
});

test('command line: writes the report and summary, exits 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'replay-'));
  const cli = join(ROOT, 'tools', 'replay.js');
  execFileSync(process.execPath, [cli, '--seeds', '1', '--years', '1', '--out', dir, '--quiet'], { stdio: 'pipe' });
  assert.ok(existsSync(join(dir, 'replay-summary.txt')));
  const json = JSON.parse(readFileSync(join(dir, 'replay-report.json'), 'utf8'));
  assert.equal(json.ok, true);
  assert.match(textSummary(json), /Invariants: all passed/);
});

test('the wellbeing invariants can fail: out-of-range stress, an overshooting lag, a broken ledger', () => {
  assert.equal(checkStressInRange({ stock: 'stress.sarah', low: 4, high: 101 }).ok, false);
  assert.equal(checkStressInRange({ stock: 'stress.sarah', low: 4, high: 60 }).ok, true);
  assert.equal(checkSleepDebtInRange({ stock: 'sleepdebt.sarah', low: -0.5, high: 3 }).ok, false);
  const over = checkLagNoOvershoot({ stock: 'stress.sarah', t: 9, before: 20, amount: 6, target: 25 });
  assert.equal(over.ok, false);
  assert.match(over.detail, /stress\.sarah at minute 9/);
  assert.equal(checkLagNoOvershoot({ stock: 'stress.sarah', t: 9, before: 20, amount: 0.1, target: 25 }).ok, true);
  assert.equal(checkLagNoOvershoot({ stock: 'stress.sarah', t: 9, before: 20, amount: -0.1, target: 25 }).ok, false);
  assert.equal(checkWellbeingReconciles({ stock: 'stress.sarah', start: 20, end: 21, total: 0.5 }).ok, false);
  assert.equal(INVARIANTS.length, 11);
});

test('stress rests near its base over a year (plus the occasional low-bladder push)', () => {
  for (const r of [first.report, second.report]) {
    const base = 20 + 3 * (r.personality.sarah.anxious - 5);
    const mean = r.run.wellbeing.people.sarah.stress.mean;
    assert.ok(Math.abs(mean - base) <= 6, `seed ${r.seed}: mean ${mean} vs base ${base}`);
  }
});
