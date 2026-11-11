#!/usr/bin/env node
// The replay harness, command line (docs/LIFE_SYSTEMS.md section 15 and 15a, Step 7).
// Runs many seeds headless for some game years, checks the invariants, and writes a report.
// It never changes what the family does. Usage:
//   node tools/replay.js [--seeds 20] [--years 10] [--from 1] [--out replay-out] [--daily] [--quiet]
// Exit code: 1 if any invariant failed, 2 for bad arguments, 0 otherwise. Warnings never change it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData } from './replay/load.js';
import { runMany } from './replay/run.js';
import { textSummary } from './replay/summary.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'Usage: node tools/replay.js [--seeds 20] [--years 10] [--from 1] [--out replay-out] [--daily] [--quiet]';

function parseArgs(argv) {
  const o = { seeds: 20, years: 10, from: 1, out: 'replay-out', daily: false, quiet: false };
  const whole = (flag, value) => {
    if (!/^\d+$/.test(value ?? '') || Number(value) < 1) {
      throw new Error(`${flag} needs a whole number of at least 1, got "${value ?? ''}"`);
    }
    return Number(value);
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--seeds': o.seeds = whole(arg, argv[++i]); break;
      case '--years': o.years = whole(arg, argv[++i]); break;
      case '--from': o.from = whole(arg, argv[++i]); break;
      case '--out':
        if (!argv[i + 1]) throw new Error('--out needs a folder name');
        o.out = argv[++i];
        break;
      case '--daily': o.daily = true; break;
      case '--quiet': o.quiet = true; break;
      default: throw new Error(`Unknown argument "${arg}"`);
    }
  }
  return o;
}

function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(`${err.message}\n${USAGE}`);
    return 2;
  }
  const data = loadData(ROOT);
  const t0 = performance.now();
  let last = t0;
  const report = runMany(data, {
    ...opts,
    onSeed: (done, total) => {
      const now = performance.now();
      console.error(`seed ${done}/${total} … ${((now - last) / 1000).toFixed(1)} s`);
      last = now;
    },
  });
  report.seconds = Math.round((performance.now() - t0) / 100) / 10;

  const out = resolve(opts.out);
  mkdirSync(out, { recursive: true });
  const summary = textSummary(report);
  writeFileSync(resolve(out, 'replay-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(resolve(out, 'replay-summary.txt'), summary);
  if (!opts.quiet) console.log(summary);
  return report.ok ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));
