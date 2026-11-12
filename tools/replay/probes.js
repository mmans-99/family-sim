// The probes (docs/LIFE_SYSTEMS.md 15a, Step 4). A probe is a plain object with an id and optional
// hooks: start, minute, day, year, end. Probes only READ the world. Each keeps its notes in
// ctx.probe[id], which run.js creates empty for every seed. Later steps add probes with `since`.
import { calendarDate, formatDate, gameDayDates } from '../../src/sim/calendar.js';
import {
  checkFinite, checkLedgerComplete, checkMortgageFalls, checkLagNoOvershoot,
  checkStressInRange, checkSleepDebtInRange, checkWellbeingReconciles,
} from './checks.js';
import { stressId, sleepId } from '../../src/sim/wellbeing.js';

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

// 6. wellbeing (since L4): stress and sleep debt per person, interruptions, and how often each
// coupling held. Read only. The range and reconciling checks are made in end().
const wellbeingStock = () => ({
  start: null, last: null, lastT: -1, captured: 0, low: null, high: null, sum: 0, n: 0, minutesHigh: 0,
  yStart: null, yLow: null, yHigh: null, ySum: 0, yN: 0, yMinutesHigh: 0,
  dayMax: null, dayAbove4: 0, dayN: 0, daySum: 0,
});
const fmt = (x) => (x === null ? null : r1(x));
const wbBlock = (st, ws) => ({ start: fmt(st.start), end: fmt(ws.value), min: fmt(st.low), mean: st.n ? r1(st.sum / st.n) : null, max: fmt(st.high), minutesHigh: st.minutesHigh });

const wellbeing = {
  id: 'wellbeing',
  since: 'L4',
  start(world, ctx) {
    const cfg = world.wellbeing;
    if (!cfg) return;
    const st = (ctx.probe.wellbeing = { people: {}, results: [], fired: { ...world.couplings.fired }, interruptions: {}, yInterruptions: {}, yFired: { ...world.couplings.fired } });
    for (const p of world.people) {
      const stress = wellbeingStock();
      const sleep = wellbeingStock();
      stress.start = stress.last = world.stocks[stressId(cfg, p.id)].value;
      sleep.start = sleep.last = world.stocks[sleepId(cfg, p.id)].value;
      stress.lastT = sleep.lastT = world.time;
      st.people[p.id] = { stress, sleep };
      st.interruptions[p.id] = 0;
      st.yInterruptions[p.id] = 0;
    }
  },
  minute(world, ctx) {
    const st = ctx.probe.wellbeing;
    if (!st) return;
    const cfg = world.wellbeing;
    for (const p of world.people) {
      const rec = st.people[p.id];
      const sv = world.stocks[stressId(cfg, p.id)].value;
      for (const [s, v] of [[rec.stress, sv], [rec.sleep, world.stocks[sleepId(cfg, p.id)].value]]) {
        s.low = s.low === null ? v : Math.min(s.low, v);
        s.high = s.high === null ? v : Math.max(s.high, v);
        s.sum += v;
        s.n += 1;
        s.yLow = s.yLow === null ? v : Math.min(s.yLow, v);
        s.yHigh = s.yHigh === null ? v : Math.max(s.yHigh, v);
        s.ySum += v;
        s.yN += 1;
      }
      if (sv >= cfg.high) { rec.stress.minutesHigh += 1; rec.stress.yMinutesHigh += 1; }
    }
    // Lines written this step that say a need stopped the person's action.
    for (let i = world.log.length - 1; i >= 0 && world.log[i].time === world.time; i--) {
      const e = world.log[i];
      if (e.text.startsWith(world.wellbeing.interrupt.logPrefix) && e.who !== 'House') {
        const pid = world.people.find((p) => p.name === e.who)?.id;
        if (pid) { st.interruptions[pid] += 1; st.yInterruptions[pid] += 1; }
      }
    }
  },
  day(world, ctx, gameDay) {
    const st = ctx.probe.wellbeing;
    if (!st) return;
    const cfg = world.wellbeing;
    for (const p of world.people) {
      const rec = st.people[p.id];
      for (const [kind, id, ws] of [['stress', stressId(cfg, p.id), rec.stress], ['sleep', sleepId(cfg, p.id), rec.sleep]]) {
        const s = world.stocks[id];
        const fresh = s.ledger.filter((e) => e.t > ws.lastT);
        st.results.push(checkLedgerComplete({
          stock: id, day: gameDay, ledgerKeep: s.ledgerKeep, length: s.ledger.length,
          oldestKeptT: s.ledger.length ? s.ledger[0].t : null, newestReadT: ws.lastT,
        }));
        for (const e of fresh) {
          ws.captured = cents(ws.captured + e.amount);
          if (e.reason === 'Drift' && e.ref) {
            st.results.push(checkLagNoOvershoot({ stock: id, t: e.t, before: e.ref.before, amount: e.amount, target: e.ref.target }));
          }
        }
        if (fresh.length) ws.lastT = fresh[fresh.length - 1].t;
        ws.last = s.value;
        if (kind === 'sleep') {
          ws.dayMax = ws.dayMax === null ? s.value : Math.max(ws.dayMax, s.value);
          ws.daySum += s.value;
          ws.dayN += 1;
          if (s.value > 4) ws.dayAbove4 += 1;
        }
      }
    }
  },
  year(world, ctx) {
    const st = ctx.probe.wellbeing;
    if (!st) return undefined;
    const out = { people: {}, couplings: {} };
    for (const p of world.people) {
      const rec = st.people[p.id];
      const sleepBlock = {
        mean: rec.sleep.dayN ? r1(rec.sleep.daySum / rec.sleep.dayN) : null,
        max: fmt(rec.sleep.dayMax),
        daysAbove4: rec.sleep.dayAbove4,
      };
      out.people[p.id] = {
        stress: {
          start: fmt(rec.stress.yStart ?? rec.stress.start),
          end: fmt(world.stocks[stressId(world.wellbeing, p.id)].value),
          min: fmt(rec.stress.yLow), mean: rec.stress.yN ? r1(rec.stress.ySum / rec.stress.yN) : null,
          max: fmt(rec.stress.yHigh), minutesHigh: rec.stress.yMinutesHigh,
        },
        sleepDebt: sleepBlock,
        interruptions: st.yInterruptions[p.id],
      };
      rec.stress.yStart = world.stocks[stressId(world.wellbeing, p.id)].value;
      rec.stress.yLow = rec.stress.yHigh = null;
      rec.stress.ySum = 0; rec.stress.yN = 0; rec.stress.yMinutesHigh = 0;
      rec.sleep.yLow = rec.sleep.yHigh = null; rec.sleep.ySum = 0; rec.sleep.yN = 0;
      rec.sleep.dayMax = null; rec.sleep.dayAbove4 = 0; rec.sleep.dayN = 0; rec.sleep.daySum = 0;
      st.yInterruptions[p.id] = 0;
    }
    for (const id of Object.keys(world.couplings.fired).sort()) {
      out.couplings[id] = (world.couplings.fired[id] ?? 0) - (st.yFired[id] ?? 0);
    }
    st.yFired = { ...world.couplings.fired };
    return out;
  },
  end(world, ctx) {
    const st = ctx.probe.wellbeing;
    if (!st) return undefined;
    const cfg = world.wellbeing;
    const people = {};
    for (const p of world.people) {
      const rec = st.people[p.id];
      const ss = world.stocks[stressId(cfg, p.id)];
      const sl = world.stocks[sleepId(cfg, p.id)];
      const stressBlock = wbBlock(rec.stress, ss);
      const sleepBlock = {
        end: fmt(sl.value), min: fmt(rec.sleep.low), max: fmt(rec.sleep.high),
        mean: rec.sleep.n ? r1(rec.sleep.sum / rec.sleep.n) : null,
      };
      people[p.id] = { stress: stressBlock, sleepDebt: sleepBlock, interruptions: st.interruptions[p.id] };
      // Whole-run checks: the values stay in range, and the stock moved by what its ledger says.
      st.results.push(checkStressInRange({ stock: ss.id, low: rec.stress.low, high: rec.stress.high, min: ss.min, max: ss.max }));
      st.results.push(checkSleepDebtInRange({ stock: sl.id, low: rec.sleep.low, high: rec.sleep.high, min: sl.min, max: sl.max }));
      st.results.push(checkWellbeingReconciles({ stock: ss.id, start: rec.stress.start, end: ss.value, total: rec.stress.captured }));
      st.results.push(checkWellbeingReconciles({ stock: sl.id, start: rec.sleep.start, end: sl.value, total: rec.sleep.captured }));
    }
    const couplings = {};
    for (const id of Object.keys(world.couplings.fired).sort()) {
      couplings[id] = world.couplings.fired[id] ?? 0;
    }
    return { people, couplings };
  },
};

export const DEFAULT_PROBES = [money, calendar, needs, actions, log, wellbeing];
