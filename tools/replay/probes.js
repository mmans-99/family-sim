// The probes (docs/LIFE_SYSTEMS.md 15a, Step 4). A probe is a plain object with an id and optional
// hooks: start, minute, day, year, end. Probes only READ the world. Each keeps its notes in
// ctx.probe[id], which run.js creates empty for every seed. Later steps add probes with `since`.
import { calendarDate, formatDate, gameDayDates } from '../../src/sim/calendar.js';
import { checkFinite, checkLedgerComplete, checkMortgageFalls } from './checks.js';

const cents = (x) => Math.round(x * 100) / 100;
const r1 = (x) => Math.round(x * 10) / 10;
const sortedKeys = (obj) => Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));

// 1. money: the money stocks, their ledgers, and each game day's movements (for turning points).
const money = {
  id: 'money',
  since: 'L3',
  start(world, ctx) {
    const st = (ctx.probe.money = {
      start: {}, last: {}, lastT: {}, captured: {}, low: {}, high: {},
      yStart: {}, yIn: {}, yOut: {}, lowest: null, days: [], endByDay: [], results: [],
    });
    for (const id of ctx.cfg.moneyStocks) {
      const s = world.stocks[id];
      st.start[id] = s.value;
      st.last[id] = s.value;
      st.lastT[id] = world.time; // the ledger is empty at the start: nothing is older than now
      st.captured[id] = 0;
      st.low[id] = null;
      st.high[id] = null;
      st.yStart[id] = s.value;
      st.yIn[id] = {};
      st.yOut[id] = {};
    }
  },
  day(world, ctx, gameDay) {
    const st = ctx.probe.money;
    const date = gameDayDates(world.time, world.calendar.start);
    for (const id of ctx.cfg.moneyStocks) {
      const s = world.stocks[id];
      const prevT = st.lastT[id];
      const fresh = s.ledger.filter((e) => e.t > prevT);
      st.results.push(checkLedgerComplete({
        stock: id, day: gameDay, ledgerKeep: s.ledgerKeep, length: s.ledger.length,
        oldestKeptT: s.ledger.length ? s.ledger[0].t : null, newestReadT: prevT,
      }));
      let net = 0;
      let gross = 0;
      const byReason = {};
      for (const e of fresh) {
        net = cents(net + e.amount);
        gross = cents(gross + Math.abs(e.amount));
        byReason[e.reason] = cents((byReason[e.reason] ?? 0) + e.amount);
        const bucket = e.amount >= 0 ? st.yIn[id] : st.yOut[id];
        bucket[e.reason] = cents((bucket[e.reason] ?? 0) + e.amount);
      }
      if (fresh.length) st.lastT[id] = fresh[fresh.length - 1].t;
      st.captured[id] = cents(st.captured[id] + net);

      const end = s.value;
      st.results.push(checkFinite({ stock: id, day: gameDay, value: end }));
      if (id === 'debt.mortgage') {
        st.results.push(checkMortgageFalls({ day: gameDay, from: st.last[id], to: end }));
      }
      st.last[id] = end;
      st.low[id] = st.low[id] === null ? end : Math.min(st.low[id], end);
      st.high[id] = st.high[id] === null ? end : Math.max(st.high[id], end);
      st.days.push({ gameDay, date, stock: id, net, gross, byReason });
      if (id === 'acct.joint' && (st.lowest === null || end < st.lowest.value)) {
        st.lowest = { value: end, date, gameDay };
      }
    }
    st.endByDay.push({
      gameDay,
      date,
      values: Object.fromEntries(ctx.cfg.moneyStocks.map((id) => [id, world.stocks[id].value])),
    });
  },
  year(world, ctx) {
    const st = ctx.probe.money;
    const out = {};
    for (const id of ctx.cfg.moneyStocks) {
      const end = world.stocks[id].value;
      out[id] = {
        start: st.yStart[id],
        end,
        in: sortedKeys(Object.fromEntries(Object.entries(st.yIn[id]).map(([k, v]) => [k, cents(v)]))),
        out: sortedKeys(Object.fromEntries(Object.entries(st.yOut[id]).map(([k, v]) => [k, cents(v)]))),
      };
      st.yStart[id] = end;
      st.yIn[id] = {};
      st.yOut[id] = {};
    }
    return out;
  },
  end(world, ctx) {
    const st = ctx.probe.money;
    const stocks = {};
    for (const id of ctx.cfg.moneyStocks) {
      stocks[id] = { start: st.start[id], end: world.stocks[id].value, lowest: st.low[id], highest: st.high[id] };
    }
    return { stocks, lowestJoint: st.lowest };
  },
};

// 2. calendar: how many times each dated rule fired (per year, and in total).
const calendar = {
  id: 'calendar',
  since: 'L3',
  start(world, ctx) {
    ctx.probe.calendar = { prev: { ...world.calendar.fired } };
  },
  year(world, ctx) {
    const st = ctx.probe.calendar;
    const counts = {};
    for (const id of Object.keys(world.calendar.fired).sort()) {
      counts[id] = (world.calendar.fired[id] ?? 0) - (st.prev[id] ?? 0);
    }
    st.prev = { ...world.calendar.fired };
    return counts;
  },
  end(world) {
    return sortedKeys({ ...world.calendar.fired });
  },
};

// Empty tally for one person's needs: sums and lowest values, plus minutes with any need under 10.
const emptyNeeds = (person) => ({
  lowMinutes: 0,
  needs: Object.fromEntries(Object.keys(person.needs).map((n) => [n, { sum: 0, n: 0, min: Infinity }])),
});

const tallyOut = (tally) => {
  const out = { lowMinutes: tally.lowMinutes };
  for (const [need, t] of Object.entries(tally.needs)) {
    out[need] = { min: r1(t.min), mean: r1(t.sum / t.n) };
  }
  return out;
};

// 3. needs: each need's lowest and average value per person, and minutes when any need was low.
const needs = {
  id: 'needs',
  since: 'L3',
  start(world, ctx) {
    const st = (ctx.probe.needs = { run: {}, year: {}, range: {} });
    for (const p of world.people) {
      st.run[p.id] = emptyNeeds(p);
      st.year[p.id] = emptyNeeds(p);
      st.range[p.id] = {};
      for (const [need, v] of Object.entries(p.needs)) {
        st.range[p.id][need] = { low: v, high: v };
      }
    }
  },
  minute(world, ctx) {
    const st = ctx.probe.needs;
    for (const p of world.people) {
      let low = false;
      for (const [need, v] of Object.entries(p.needs)) {
        for (const tally of [st.run[p.id], st.year[p.id]]) {
          const t = tally.needs[need];
          t.sum += v;
          t.n += 1;
          t.min = Math.min(t.min, v);
        }
        const range = st.range[p.id][need];
        range.low = Math.min(range.low, v);
        range.high = Math.max(range.high, v);
        if (v < 10) low = true;
      }
      if (low) {
        st.run[p.id].lowMinutes += 1;
        st.year[p.id].lowMinutes += 1;
      }
    }
  },
  year(world, ctx) {
    const st = ctx.probe.needs;
    const out = {};
    for (const p of world.people) {
      out[p.id] = tallyOut(st.year[p.id]);
      st.year[p.id] = emptyNeeds(p);
    }
    return out;
  },
  end(world, ctx) {
    const st = ctx.probe.needs;
    const out = {};
    for (const p of world.people) out[p.id] = tallyOut(st.run[p.id]);
    return out;
  },
};

// 4. actions: how many times each person started each action (a new activity object each time).
const actions = {
  id: 'actions',
  since: 'L3',
  start(world, ctx) {
    ctx.probe.actions = { lastSeen: {}, run: {}, year: {} };
    for (const p of world.people) {
      ctx.probe.actions.lastSeen[p.id] = p.activity;
      ctx.probe.actions.run[p.id] = {};
      ctx.probe.actions.year[p.id] = {};
    }
  },
  minute(world, ctx) {
    const st = ctx.probe.actions;
    for (const p of world.people) {
      const act = p.activity;
      if (!act || act === st.lastSeen[p.id]) {
        st.lastSeen[p.id] = act;
        continue;
      }
      st.lastSeen[p.id] = act;
      const id = act.action.id;
      st.run[p.id][id] = (st.run[p.id][id] ?? 0) + 1;
      st.year[p.id][id] = (st.year[p.id][id] ?? 0) + 1;
    }
  },
  year(world, ctx) {
    const st = ctx.probe.actions;
    const out = {};
    for (const p of world.people) {
      out[p.id] = byCount(st.year[p.id]);
      st.year[p.id] = {};
    }
    return out;
  },
  end(world, ctx) {
    const st = ctx.probe.actions;
    const out = {};
    for (const p of world.people) out[p.id] = byCount(st.run[p.id]);
    return out;
  },
};

// Counts sorted highest first (ties by name), so the report reads well and compares exactly.
function byCount(counts) {
  return Object.fromEntries(
    Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  );
}

// 5. log: lines written each minute (by who), and bills that could not be paid in full.
const log = {
  id: 'log',
  since: 'L3',
  start(world, ctx) {
    ctx.probe.log = {
      run: { lines: {}, unpaid: 0, first: [] },
      year: { lines: {}, unpaid: 0 },
    };
  },
  minute(world, ctx) {
    const st = ctx.probe.log;
    const prefix = ctx.cfg.unpaidPrefix;
    // The lines written in this step are the newest ones: they sit at the end with this time.
    for (let i = world.log.length - 1; i >= 0 && world.log[i].time === world.time; i--) {
      const e = world.log[i];
      st.run.lines[e.who] = (st.run.lines[e.who] ?? 0) + 1;
      st.year.lines[e.who] = (st.year.lines[e.who] ?? 0) + 1;
      if (e.who === 'House' && e.text.startsWith(prefix)) {
        st.run.unpaid += 1;
        st.year.unpaid += 1;
        if (st.run.first.length < 5) {
          st.run.first.push({ date: formatDate(calendarDate(world.time, world.calendar.start)), text: e.text });
        }
      }
    }
  },
  year(world, ctx) {
    const st = ctx.probe.log;
    const out = { lines: sortedKeys(st.year.lines), unpaid: st.year.unpaid };
    st.year = { lines: {}, unpaid: 0 };
    return out;
  },
  end(world, ctx) {
    const st = ctx.probe.log;
    return { lines: sortedKeys(st.run.lines), unpaid: st.run.unpaid, first: st.run.first };
  },
};

export const DEFAULT_PROBES = [money, calendar, needs, actions, log];
