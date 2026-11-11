// The household's money (docs/LIFE_SYSTEMS.md 3a, Step 3). Pure logic: no DOM, no random numbers.
// Tax and NI rules, the mortgage, and the flows that move money on their dates. Every change to
// a balance goes through stocks.js change().
import { addStock, change, read } from './stocks.js';
import { calendarDate, calendarSpan, dueOnGameDay, formatDate, gameDayDates } from './calendar.js';
import { MINUTES_PER_DAY } from './clock.js';

const cents = (x) => Math.round(x * 100) / 100;
const clone = (x) => JSON.parse(JSON.stringify(x));

// Money as pounds for the log and panel, e.g. £1,339.31.
export const pounds = (x) => Number(x).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

// Income tax on income (gross pay less the net-pay pension): the personal allowance (tapered
// above £100,000), then the bands, each as a width of taxable income.
export function incomeTax(tax, income) {
  const { allowance, taperFrom, bands } = tax.incomeTax;
  const lost = Math.max(0, income - taperFrom) / 2;
  const personal = Math.max(0, allowance - lost);
  let left = Math.max(0, income - personal);
  let total = 0;
  for (const band of bands) {
    const slice = band.width === null ? left : Math.min(left, band.width);
    total += slice * band.rate;
    left -= slice;
    if (left <= 0) break;
  }
  return cents(total);
}

// Employee National Insurance (Class 1) on gross pay.
export function nationalInsurance(tax, gross) {
  const { from, upper, main, above } = tax.ni;
  const mainSlice = Math.max(0, Math.min(gross, upper) - from);
  const upperSlice = Math.max(0, gross - upper);
  return cents(mainSlice * main + upperSlice * above);
}

// Take-home pay for a year: gross, less pension (net-pay: taken before income tax, but not
// before NI), less income tax and NI. There is no student loan (salary.studentLoan is false).
export function netAnnualPay(tax, salary) {
  if (salary.pensionMethod !== 'netPay') throw new Error(`Pension method "${salary.pensionMethod}" is not modelled yet`);
  const gross = salary.gross;
  const pension = cents(gross * salary.pension);
  return cents(gross - pension - incomeTax(tax, gross - pension) - nationalInsurance(tax, gross));
}

export function netMonthlyPay(tax, salary) {
  return cents(netAnnualPay(tax, salary) / 12);
}

// The fixed monthly repayment on a loan: P·r / (1 − (1 + r)^−n), r = annual rate ÷ 12.
export function monthlyRepayment(loan, rate, months) {
  const r = rate / 12;
  return cents((loan * r) / (1 - (1 + r) ** -months));
}

// The date of repayment k (0 = the first), on the same day of each month as the first one.
const paymentDate = (m, k) => {
  const f = m.firstPayment;
  const month = f.month - 1 + k;
  return { year: f.year + Math.floor(month / 12), month: (month % 12) + 1, day: f.day };
};
const dateKey = (d) => d.year * 10000 + d.month * 100 + d.day;

// How many repayments fall on or before this date.
export function paymentsDueBy(m, date) {
  let k = 0;
  while (k < m.termMonths && dateKey(paymentDate(m, k)) <= dateKey(date)) k++;
  return k;
}

// The balance after n repayments: P(1 + r)^n − M((1 + r)^n − 1) / r.
export function balanceAfter(m, n) {
  const r = m.rate / 12;
  const payment = monthlyRepayment(m.loan, m.rate, m.termMonths);
  const growth = (1 + r) ** n;
  return cents(Math.max(0, m.loan * growth - (payment * (growth - 1)) / r));
}

// The balance on a date: after every repayment due on or before it.
export function balanceOn(m, date) {
  return balanceAfter(m, paymentsDueBy(m, date));
}

// Set up the money at the world's start. data = { stocks (data/stocks.json), tax (data/tax.json),
// flows (data/flows.json) }. The mortgage balance comes from the loan and the start date.
export function setupMoney(world, { stocks, tax, flows }) {
  const m = stocks.mortgage;
  const date = calendarDate(world.time, world.calendar.start);
  world.stocks = {};
  world.tax = clone(tax);
  world.salary = clone(stocks.salary);
  world.flows = clone(flows.flows);
  world.loans = {
    mortgage: {
      loan: m.loan,
      rate: m.rate,
      termMonths: m.termMonths,
      firstPayment: clone(m.firstPayment),
      fixedUntil: clone(m.fixedUntil),
      payment: monthlyRepayment(m.loan, m.rate, m.termMonths),
    },
  };
  for (const def of stocks.stocks) {
    addStock(world, def.id === 'debt.mortgage' ? { ...def, value: balanceOn(m, date) } : def);
  }
}

// The mortgage repayment: interest is balance × rate ÷ 12, the rest of the payment is capital.
// If the account cannot pay in full, only the part paid reduces the loan.
function payMortgage(world, flow) {
  const loan = world.loans.mortgage;
  const balance = read(world, 'debt.mortgage');
  const interest = cents((balance * loan.rate) / 12);
  const payment = cents(Math.min(loan.payment, balance + interest));
  const applied = change(world, flow.stock, -payment, flow.name, { flow: flow.id, interest });
  const paid = -applied;
  const capital = cents(Math.min(balance, Math.max(0, paid - interest)));
  if (capital > 0) change(world, 'debt.mortgage', -capital, 'Capital repaid', { flow: flow.id, interest });
  return { requested: -payment, applied };
}

// The amount a flow asks for (negative = out). Weekly flows are handled by runWeeklyFlows.
function flowAmount(world, flow) {
  const a = flow.amount;
  if (a === 'net') return netMonthlyPay(world.tax, world.salary);
  if (a === 'interest') return cents((read(world, flow.stock) * flow.annualRate) / 12);
  if (typeof a === 'number') return a;
  if (a && typeof a === 'object' && 'perYear' in a) return cents(a.perYear / a.over);
  throw new Error(`Flow ${flow.id} has an amount this code does not know: ${JSON.stringify(a)}`);
}

// The log line for a flow that ran: what happened, and any shortfall.
function logLine(flow, requested, applied) {
  const short = cents(Math.abs(requested) - Math.abs(applied));
  if (short > 0.005) return `Could not pay ${flow.name.toLowerCase()} in full (${pounds(short)} short)`;
  return `${flow.log} (${pounds(Math.abs(applied))})`;
}

// Run every flow on a dated rule (data/calendar.json). Returns the log lines.
export function runFlowsForRule(world, ruleId) {
  const lines = [];
  for (const flow of world.flows.filter((f) => f.rule === ruleId)) {
    if (flow.amount === 'mortgage') {
      const { requested, applied } = payMortgage(world, flow);
      lines.push(logLine(flow, requested, applied));
    } else {
      const requested = flowAmount(world, flow);
      const applied = change(world, flow.stock, requested, flow.name, flow.id);
      lines.push(logLine(flow, requested, applied));
    }
  }
  return lines;
}

// Every calendar-week flow due at this minute of the game day: its amount for the calendar days
// this game day covers (13 or 14 days, a seventh of a week's spend each). Returns the log lines.
export function runWeeklyFlows(world, minuteOfDay) {
  const lines = [];
  const gameDay = Math.floor(world.time / MINUTES_PER_DAY);
  const [first, last] = calendarSpan(gameDay);
  const days = last - first + 1;
  for (const flow of world.flows.filter((f) => f.every === 'calendarWeek' && f.hour * 60 === minuteOfDay)) {
    const requested = cents((flow.amount * days) / 7);
    const applied = change(world, flow.stock, requested, flow.name, flow.id);
    const short = cents(Math.abs(requested) - Math.abs(applied));
    const dates = gameDayDates(world.time, world.calendar.start);
    lines.push(short > 0.005
      ? `Could not pay ${flow.name.toLowerCase()} in full (${pounds(short)} short)`
      : `${flow.log} for ${dates} (${pounds(Math.abs(applied))})`);
  }
  return lines;
}

// The next dated money event (a rule that has a flow) from now, looking ahead `days` game days.
// Events already passed today are skipped (an event due this minute is still ahead). Returns
// { label, date } or null.
export function nextMoneyEvent(world, days = 31) {
  const rules = new Set(world.flows.map((f) => f.rule).filter(Boolean));
  const today = Math.floor(world.time / MINUTES_PER_DAY);
  const minuteOfDay = world.time % MINUTES_PER_DAY;
  for (let g = today; g <= today + days; g++) {
    const due = dueOnGameDay(g, world.calendar.rules, world.calendar.start)
      .filter((e) => rules.has(e.id))
      .filter((e) => g > today || e.hour * 60 >= minuteOfDay); // the same rule as queueDay
    if (due.length) return { label: due[0].label, date: formatDate(due[0].date) };
  }
  return null;
}
