// The short text summary (docs/LIFE_SYSTEMS.md 15a, Step 7). Pure: report in, string out.
import { pounds } from '../../src/sim/household.js';
import { INVARIANTS } from './checks.js';

export function textSummary(report) {
  const seeds = report.seeds;
  const n = seeds.length;
  const first = seeds[0];
  const money = first.run.money.stocks;
  const across = report.across;
  const unpaid = seeds.reduce((sum, s) => sum + (s.run.log?.unpaid ?? 0), 0);
  const failed = [];
  for (const s of seeds) {
    for (const inv of s.invariants) if (!inv.ok) failed.push(`${inv.id} (seed ${s.seed})`);
  }
  const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;

  const lines = [];
  const took = report.seconds === null ? '' : `, ${report.seconds} s`;
  lines.push(`Replay: ${plural(n, 'seed')} × ${plural(report.args.years, 'game year')} (${first.dates.from} – ${first.dates.to})${took}`);
  lines.push(failed.length
    ? `Invariants: FAILED: ${failed.join(', ')}`
    : `Invariants: all passed (${INVARIANTS.length} checks × ${plural(n, 'seed')})`);
  lines.push(`Seed ${first.seed} money: joint ${pounds(money['acct.joint'].start)} → ${pounds(money['acct.joint'].end)}; `
    + `savings ${pounds(money['acct.savings'].start)} → ${pounds(money['acct.savings'].end)}; `
    + `mortgage ${pounds(money['debt.mortgage'].start)} → ${pounds(money['debt.mortgage'].end)}`);
  lines.push(`Unpaid bills: ${unpaid ? `${unpaid} line(s) across the seeds` : 'none'}`);
  lines.push(`Seeds: money ${across.moneyIdentical ? 'identical' : 'differs'}; daily action counts differ `
    + `(${across.actionsDistinct} of ${n} seeds distinct)`);
  lines.push(`Turning points: ${across.turningPoints ? `${across.turningPoints} across the seeds` : 'none'}`);
  if (across.wellbeing) {
    const w = across.wellbeing;
    lines.push(`Stress (Sarah): seed means ${w.stressMeanRange[0]}–${w.stressMeanRange[1]}; highest ${w.stressHighest}; `
      + `sleep debt max ${w.sleepDebtMax.toFixed(1)} h; interruptions ${w.interruptions}`);
  }
  if (report.warnings.length) {
    lines.push('Warnings:');
    for (const w of report.warnings) lines.push(`- ${w}`);
  } else {
    lines.push('Warnings: none');
  }
  lines.push(`Not measured yet: ${first.notYet.map((x) => `${x.what} (${x.step})`).join(', ')}`);
  return `${lines.join('\n')}\n`;
}
