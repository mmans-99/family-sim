// The run (docs/LIFE_SYSTEMS.md 15a, Step 3). Creates a world for a seed, steps it headless, and
// collects what each probe reports. Pure: no file access and no random numbers. It never changes
// the world: the only thing that moves time is step(). The harness works on its own copy of the
// data, so nothing it does can reach the game's data files.
import { createWorld, step } from '../../src/sim/world.js';
import { DAYS_PER_YEAR, MINUTES_PER_DAY, MINUTES_PER_YEAR } from '../../src/sim/clock.js';
import { calendarSpan, dateAt, formatDate, matches } from '../../src/sim/calendar.js';
import { DEFAULT_PROBES } from './probes.js';
import { checkCalendarExact, checkLimits, checkNeedsInRange, checkReconciles, summarise } from './checks.js';
import { findTurningPoints } from './turning.js';

const cents = (x) => Math.round(x * 100) / 100;
const round3 = (x) => Math.round(x * 1000) / 1000;

// The dates from the first calendar day of game day `first` to the last calendar day of `last`.
function datesBetween(first, last, start) {
  const [a] = calendarSpan(first);
  const [, b] = calendarSpan(last);
  return { from: formatDate(dateAt(a, start)), to: formatDate(dateAt(b, start)) };
}

// How many times each rule should have fired over the run, worked out from the calendar alone
// (every calendar day in the run, matched against each rule). Rules due on the first game day
// before the start time are not counted: the game does not fire what has already passed.
export function expectedFirings(calendar, startMinute, lastGameDay) {
  const { rules, start } = calendar;
  const [firstIndex, firstLast] = calendarSpan(0);
  const [, lastIndex] = calendarSpan(lastGameDay);
  const startOfDay = startMinute % MINUTES_PER_DAY;
  const counts = Object.fromEntries(rules.map((r) => [r.id, 0]));
  for (let i = firstIndex; i <= lastIndex; i++) {
    const date = dateAt(i, start);
    const onFirstDay = i <= firstLast;
    for (const rule of rules) {
      if (!matches(rule, date)) continue;
      if (onFirstDay && rule.hour * 60 < startOfDay) continue;
      counts[rule.id] += 1;
    }
  }
  return counts;
}

// Run one seed. Returns { report, world }: the report is plain JSON, the world is the game as it
// ended (tests use it to prove the harness changed nothing).
export function runSeedDetailed(data, { seed, years, probes = DEFAULT_PROBES, daily = false }) {
  const input = JSON.parse(JSON.stringify(data));
  const cfg = input.replay;
  const world = createWorld({ ...input, seed });
  const startMinute = world.time;
  const ctx = { seed, years, cfg, startTime: startMinute, probe: {} };
  const endTime = years * MINUTES_PER_YEAR - 1; // 23:59 on the last game day
  const lastGameDay = years * DAYS_PER_YEAR - 1;

  for (const p of probes) p.start?.(world, ctx);

  const yearly = [];
  while (world.time < endTime) {
    step(world);
    for (const p of probes) p.minute?.(world, ctx);
    if (world.time % MINUTES_PER_DAY === MINUTES_PER_DAY - 1) {
      const gameDay = Math.floor(world.time / MINUTES_PER_DAY);
      for (const p of probes) p.day?.(world, ctx, gameDay);
      if ((gameDay + 1) % DAYS_PER_YEAR === 0) {
        const yearIndex = (gameDay + 1) / DAYS_PER_YEAR - 1;
        const entry = {
          year: yearIndex + 1,
          dates: datesBetween(yearIndex * DAYS_PER_YEAR, gameDay, world.calendar.start),
        };
        for (const p of probes) {
          const block = p.year?.(world, ctx, yearIndex);
          if (block !== undefined) entry[p.id] = block;
        }
        yearly.push(entry);
      }
    }
  }

  const run = {};
  for (const p of probes) {
    const block = p.end?.(world, ctx);
    if (block !== undefined) run[p.id] = block;
  }

  // The checks that need the whole run.
  const results = [];
  const money = ctx.probe.money;
  if (money) {
    results.push(...money.results);
    for (const id of cfg.moneyStocks) {
      const s = world.stocks[id];
      results.push(checkLimits({ stock: id, low: money.low[id], high: money.high[id], min: s.min, max: s.max }));
      results.push(checkReconciles({ stock: id, start: money.start[id], end: s.value, total: money.captured[id] }));
    }
  }
  const expected = expectedFirings(input.calendar, startMinute, lastGameDay);
  for (const rule of input.calendar.rules) {
    results.push(checkCalendarExact({ rule: rule.id, expected: expected[rule.id], fired: world.calendar.fired[rule.id] ?? 0 }));
  }
  if (ctx.probe.needs) {
    for (const [pid, ranges] of Object.entries(ctx.probe.needs.range)) {
      for (const [need, r] of Object.entries(ranges)) {
        results.push(checkNeedsInRange({ label: `${pid}.${need}`, low: r.low, high: r.high }));
      }
    }
  }
  // The wellbeing probe's checks (its day-by-day ledger reads and its end-of-run checks).
  if (ctx.probe.wellbeing) results.push(...ctx.probe.wellbeing.results);
  // The beliefs probe's end-of-run checks (LIFE_SYSTEMS 4e, Step 6).
  if (ctx.probe.beliefs) results.push(...ctx.probe.beliefs.results);

  const warnings = [];
  const unpaid = run.log?.unpaid ?? 0;
  if (unpaid) warnings.push(`Seed ${seed}: ${unpaid} bill line(s) could not be paid in full`);
  const checksPerDay = cfg.beliefs?.warnChecksPerDay;
  if (run.beliefs && checksPerDay !== undefined) {
    const days = years * DAYS_PER_YEAR;
    for (const [pid, subjects] of Object.entries(run.beliefs.people)) {
      for (const [sid, block] of Object.entries(subjects)) {
        if (block.checks / days > checksPerDay) {
          warnings.push(`Seed ${seed}: ${(block.checks / days).toFixed(1)} checks a day for ${pid} (${sid}): check for a loop.`);
        }
      }
    }
  }
  const perDay = cfg.wellbeing?.warnInterruptsPerDay;
  if (run.wellbeing && perDay !== undefined) {
    const days = years * DAYS_PER_YEAR;
    for (const [pid, block] of Object.entries(run.wellbeing.people)) {
      if (block.interruptions / days > perDay) {
        warnings.push(`Seed ${seed}: ${(block.interruptions / days).toFixed(1)} interruptions a day for ${pid}: check for actions stopping and starting in a loop.`);
      }
    }
  }

  const report = {
    seed,
    years,
    dates: datesBetween(0, lastGameDay, world.calendar.start),
    personality: Object.fromEntries(world.people.map((p) => [p.id, { ...p.personality }])),
    yearly,
    run,
    turningPoints: money ? findTurningPoints(money.days, cfg.turningPoints) : [],
    invariants: summarise(results),
    warnings,
    notYet: cfg.notYet.map((x) => ({ ...x })),
    daily: daily && money ? money.endByDay : null,
  };
  return { report, world };
}

export function runSeed(data, opts) {
  return runSeedDetailed(data, opts).report;
}

const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Run many seeds and compare them. `seconds` is left null: the command line measures the time and
// fills it in, so this function stays pure.
export function runMany(data, { seeds, years, from = 1, daily = false, onSeed }) {
  const reports = [];
  for (let s = from; s < from + seeds; s++) {
    reports.push(runSeed(data, { seed: s, years, daily }));
    onSeed?.(reports.length, seeds);
  }
  const cfg = data.replay;

  const moneyOf = (r) => r.run.money.stocks;
  const moneyIdentical = reports.every((r) => sameJSON(moneyOf(r), moneyOf(reports[0])));
  const actionsDistinct = new Set(reports.map((r) => JSON.stringify(r.run.actions))).size;

  const points = reports.flatMap((r) => r.turningPoints);
  const singleCauseShare = points.length
    ? round3(points.filter((p) => p.bigCauses === 1).length / points.length)
    : null;

  const warnings = reports.flatMap((r) => r.warnings);
  const n = reports.length;

  // Wellbeing across the seeds (the first person; Sarah is the only one until L7).
  const firstPerson = (r) => Object.keys(r.run.wellbeing?.people ?? {})[0];
  const stressOf = (r) => r.run.wellbeing.people[firstPerson(r)].stress;
  const sleepOf = (r) => r.run.wellbeing.people[firstPerson(r)].sleepDebt;
  const hasWellbeing = n > 0 && reports.every((r) => r.run.wellbeing);
  const means = hasWellbeing ? reports.map((r) => stressOf(r).mean) : [];
  const wellbeingAcross = hasWellbeing ? {
    stressMeanRange: [Math.min(...means), Math.max(...means)],
    stressHighest: Math.max(...reports.map((r) => stressOf(r).max)),
    sleepDebtMax: Math.max(...reports.map((r) => sleepOf(r).max)),
    interruptions: reports.reduce((sum, r) => sum + Object.values(r.run.wellbeing.people)
      .reduce((s, b) => s + b.interruptions, 0), 0),
    couplingsHeld: Object.fromEntries(Object.keys(reports[0].run.wellbeing.couplings).map((id) => [
      id, reports.reduce((sum, r) => sum + (r.run.wellbeing.couplings[id] ?? 0), 0),
    ])),
  } : null;
  // Beliefs across the seeds (Sarah and the joint account; she is the only adult so far).
  const beliefOf = (r) => r.run.beliefs?.people?.[firstPerson(r)]?.['money.joint'];
  const hasBeliefs = n > 0 && reports.every((r) => beliefOf(r));
  const days = years * DAYS_PER_YEAR;
  const gaps = hasBeliefs ? reports.map((r) => beliefOf(r).meanAbsGap) : [];
  const perDay = hasBeliefs ? reports.map((r) => beliefOf(r).checks / days) : [];
  const beliefsAcross = hasBeliefs ? {
    meanAbsGapRange: [Math.min(...gaps), Math.max(...gaps)],
    maxAbsGap: Math.max(...reports.map((r) => beliefOf(r).maxAbsGap)),
    checksPerDayRange: [Math.round(Math.min(...perDay) * 100) / 100, Math.round(Math.max(...perDay) * 100) / 100],
    checks: reports.reduce((sum, r) => sum + beliefOf(r).checks, 0),
  } : null;
  if (beliefsAcross) {
    if (beliefsAcross.checks === 0) {
      warnings.push('Nobody checked the bank app: the check action never wins (a bug, or the worry score is too low).');
    }
    if (reports.every((r) => beliefOf(r).maxAbsGap < 1)) {
      warnings.push('Beliefs always matched the truth: the unnoticed flows are not working.');
    }
  }
  if (moneyIdentical && n > 1) {
    warnings.push('Every seed has the same money: nothing random touches money yet (expected until L9/L11).');
  }
  if (actionsDistinct === 1 && n > 1) {
    warnings.push('Every seed lived the same day: the seed has no effect.');
  }
  if (points.length === 0) {
    warnings.push('No turning points: money follows the same pattern every month (expected until shocks and job changes exist).');
  } else if (singleCauseShare >= cfg.turningPoints.warnSingleCauseShare) {
    warnings.push('Most turning points have a single cause: the world is still a stage (section 15).');
  }
  if (wellbeingAcross) {
    if (wellbeingAcross.interruptions === 0) {
      warnings.push('No interruptions: no need fell under 10 (expected until obligations and children exist, L6/L7).');
    }
    if (wellbeingAcross.sleepDebtMax === 0) {
      warnings.push('Sleep debt stayed at 0: sleep is never cut short yet (expected until L6/L7).');
    }
    const never = Object.keys(wellbeingAcross.couplingsHeld).filter((id) => wellbeingAcross.couplingsHeld[id] === 0);
    if (never.length) {
      warnings.push(`Coupling never held: ${never.join(', ')} (expected until money trouble and broken sleep exist).`);
    }
  }

  return {
    generatedBy: 'tools/replay.js',
    reportVersion: 1,
    args: { seeds, years, from, daily },
    seconds: null,
    seeds: reports,
    across: {
      moneyIdentical,
      actionsDistinct,
      singleCauseShare,
      turningPoints: points.length,
      ...(wellbeingAcross ? { wellbeing: wellbeingAcross } : {}),
      ...(beliefsAcross ? { beliefs: beliefsAcross } : {}),
    },
    warnings,
    ok: reports.every((r) => r.invariants.every((i) => i.ok)),
  };
}
