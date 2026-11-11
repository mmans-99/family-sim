// The invariants (docs/LIFE_SYSTEMS.md 15a, Step 5). Each check is a pure function that takes the
// plain numbers it needs and returns { id, ok, detail }, so a test can feed it bad numbers.
// A run fails if any check fails. Warnings are not checks (see run.js).

export const INVARIANTS = [
  'finite', 'limits', 'reconciles', 'ledgerComplete', 'mortgageFalls', 'calendarExact', 'needsInRange',
];

const result = (id, ok, detail) => ({ id, ok, detail });
const cents = (x) => Math.round(x * 100) / 100;

// A money stock's end-of-day value is a real number (no NaN, no Infinity).
export function checkFinite({ stock, day, value }) {
  const good = Number.isFinite(value);
  return result('finite', good, good ? '' : `${stock} is ${value} at the end of game day ${day}`);
}

// A money stock stays within its min and max (a null max means no ceiling). low and high are the
// lowest and highest end-of-day values over the run.
export function checkLimits({ stock, low, high, min, max }) {
  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    return result('limits', false, `${stock} has no usable range (${low}..${high})`);
  }
  const bad = low < min || (max !== null && high > max);
  return result('limits', !bad,
    bad ? `${stock} went to ${low}..${high}, allowed ${min}..${max ?? 'no ceiling'}` : '');
}

// The change in a stock equals the sum of every ledger entry the money probe captured, to the penny.
export function checkReconciles({ stock, start, end, total }) {
  const off = cents(end - start - total);
  const good = Math.abs(off) < 0.005;
  return result('reconciles', good,
    good ? '' : `${stock} moved ${cents(end - start)} but its ledger entries add up to ${cents(total)} (off by ${off})`);
}

// No ledger entry was dropped before the probe read it. Safe when the ledger is not full, or when
// its oldest kept entry is no newer than the last entry already read.
export function checkLedgerComplete({ stock, day, ledgerKeep, length, oldestKeptT, newestReadT }) {
  const good = length < ledgerKeep || oldestKeptT <= newestReadT;
  return result('ledgerComplete', good,
    good ? '' : `${stock}: on game day ${day} the ledger was full and its oldest entry (minute ${oldestKeptT}) is newer than the last one read (minute ${newestReadT}), so entries were lost`);
}

// The mortgage balance never rises from one end of day to the next (true while the rate is fixed).
export function checkMortgageFalls({ day, from, to }) {
  const good = to <= from;
  return result('mortgageFalls', good,
    good ? '' : `debt.mortgage rose from ${from} to ${to} at the end of game day ${day}`);
}

// Each dated rule fired as many times as its dates say it should.
export function checkCalendarExact({ rule, expected, fired }) {
  const good = expected === fired;
  return result('calendarExact', good,
    good ? '' : `rule ${rule} fired ${fired} times, expected ${expected}`);
}

// A need stays between 0 and 100. low and high are the lowest and highest values seen in the run.
export function checkNeedsInRange({ label, low, high }) {
  const good = Number.isFinite(low) && Number.isFinite(high) && low >= 0 && high <= 100;
  return result('needsInRange', good, good ? '' : `${label} went to ${low}..${high}, allowed 0..100`);
}

// One line per invariant for the report: ok only if every check of that id passed. The detail
// gives the first few failures, or how many checks passed.
export function summarise(results) {
  return INVARIANTS.map((id) => {
    const mine = results.filter((r) => r.id === id);
    const bad = mine.filter((r) => !r.ok);
    return {
      id,
      ok: bad.length === 0,
      detail: bad.length ? bad.slice(0, 3).map((b) => b.detail).join('; ') : `${mine.length} checks passed`,
    };
  });
}
