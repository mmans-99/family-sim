// The stock engine (docs/LIFE_SYSTEMS.md section 3): a number that rises and falls, with limits
// and a ledger of why. Pure logic: no DOM, no random numbers. A stock is a plain object in
// world.stocks[id]. The only way to change one is change().
//
// Money is kept to the penny: every change is rounded to whole pence.

const cents = (x) => Math.round(x * 100) / 100;

function stockOf(world, id) {
  const s = world.stocks[id];
  if (!s) throw new Error(`No stock called ${id}`);
  return s;
}

// Put a stock into the world from its definition (data/stocks.json).
// floor: 'hard' (stop at min) or 'spill' (the rest goes into spillTo). ceiling: 'hard' stops at max.
export function addStock(world, def) {
  world.stocks[def.id] = {
    id: def.id,
    kind: def.kind ?? 'money',
    value: cents(def.value ?? 0),
    min: def.min ?? 0,
    max: def.max ?? null,
    floor: def.floor ?? 'hard',
    spillTo: def.spillTo ?? null,
    ceiling: def.ceiling ?? 'hard',
    ledger: [],
    ledgerTotals: {},
    ledgerKeep: def.ledgerKeep ?? 60,
  };
  return world.stocks[def.id];
}

export function read(world, id) {
  return stockOf(world, id).value;
}

// The ledger, newest last.
export function ledger(world, id) {
  return stockOf(world, id).ledger;
}

// Moves a stock by delta (positive = more, negative = less) as far as its limits allow. Returns
// what could NOT be moved (positive; 0 when all of it went through). A spill below the floor
// moves the shortfall into spillTo instead, and whatever spillTo cannot take comes back as unpaid.
function move(world, id, amount, reason, ref) {
  const s = stockOf(world, id);
  let delta = amount;
  // Money coming in clears the debt the account spilled into first (an overdraft is repaid
  // before the account grows). Repaying is not a shortfall, so it is not in the result.
  if (delta > 0 && s.spillTo && stockOf(world, s.spillTo).value > 0) {
    const repay = Math.min(delta, stockOf(world, s.spillTo).value);
    move(world, s.spillTo, -repay, reason, ref);
    delta = cents(delta - repay);
  }
  const before = s.value;
  let target = cents(before + delta);
  let unpaid = 0;
  if (target < s.min) {
    unpaid = cents(s.min - target);
    target = s.min;
    if (s.floor === 'spill' && s.spillTo) {
      unpaid = move(world, s.spillTo, unpaid, reason, ref);
    }
  } else if (s.max !== null && target > s.max && s.ceiling === 'hard') {
    unpaid = cents(target - s.max);
    target = s.max;
  }
  s.value = target;
  const applied = cents(target - before);
  if (applied !== 0) record(world, s, applied, reason, ref);
  return unpaid;
}

// Write one ledger entry. Once the ledger is longer than ledgerKeep, the oldest entries are
// rolled into ledgerTotals[reason] so the save does not grow for ever.
function record(world, s, amount, reason, ref) {
  s.ledger.push({ t: world.time, amount, reason, ref: ref ?? null });
  while (s.ledger.length > s.ledgerKeep) {
    const old = s.ledger.shift();
    s.ledgerTotals[old.reason] = cents((s.ledgerTotals[old.reason] ?? 0) + old.amount);
  }
}

// Change a stock by amount (negative = less). Returns the amount that actually took effect, with
// the same sign as amount: a bill the joint account and overdraft cannot cover returns less than
// was asked for, so the caller can say so.
export function change(world, id, amount, reason, ref = null) {
  const delta = cents(amount);
  if (delta === 0) return 0;
  const unpaid = move(world, id, delta, reason, ref);
  return cents(delta - Math.sign(delta) * unpaid);
}
