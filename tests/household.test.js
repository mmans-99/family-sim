import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorld, step } from '../src/sim/world.js';
import { incomeTax, nationalInsurance, netAnnualPay, netMonthlyPay, monthlyRepayment, balanceAfter, balanceOn, paymentsDueBy, nextMoneyEvent } from '../src/sim/household.js';
import { read } from '../src/sim/stocks.js';
import { toSave, fromSave } from '../src/sim/save.js';
import { createClock } from '../src/sim/clock.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const tax = load('tax.json');
const stocks = load('stocks.json');
const flows = load('flows.json');
const money = () => ({ stocks, tax, flows });
const data = () => ({ house: load('house.json'), actions: load('actions.json'), needs: load('needs.json'), people: load('people.json'), calendar: load('calendar.json'), money: money() });
const cents = (x) => Math.round(x * 100) / 100;

test('income tax on £71,250 (£75,000 less the £3,750 pension) is £15,932', () => {
  // Personal allowance £12,570. Taxable £58,680. Basic: £37,700 × 20% = £7,540.
  // Higher: £58,680 − £37,700 = £20,980 × 40% = £8,392. Total £15,932.
  assert.equal(incomeTax(tax, 71250), 15932);
});

test('income tax at the band edges and in the taper', () => {
  assert.equal(incomeTax(tax, 50270), 7540, 'the basic band ends at £50,270');
  assert.equal(incomeTax(tax, 100000), 27432, '£7,540 + (£87,430 − £37,700) × 40%');
  // Above £100,000 the allowance falls by £1 for each £2: £110,000 keeps £7,570 of it.
  assert.equal(incomeTax(tax, 110000), 33432, '£7,540 + (£102,430 − £37,700) × 40%');
});

test('National Insurance on £75,000 is £3,510.60', () => {
  // Main 8% on £50,270 − £12,570 = £37,700 → £3,016. Upper 2% on £75,000 − £50,270 = £24,730 → £494.60.
  assert.equal(nationalInsurance(tax, 75000), 3510.6);
});

test('take-home pay for £75,000 with a 5% net-pay pension is £51,807.40 a year, £4,317.28 a month', () => {
  // 75,000 − 3,750 (pension) − 15,932 (income tax) − 3,510.60 (NI) = 51,807.40.
  // The pension is taken before income tax but not before NI. Checked by hand, not against a
  // published worked example yet (see docs/FAMILY.md).
  assert.equal(netAnnualPay(tax, stocks.salary), 51807.4);
  assert.equal(netMonthlyPay(tax, stocks.salary), 4317.28);
});

test('the mortgage repayment on £238,500 at 4.6% over 300 months is about £1,339', () => {
  const m = stocks.mortgage;
  const payment = monthlyRepayment(m.loan, m.rate, m.termMonths);
  assert.ok(Math.abs(payment - 1339.23) < 0.005, `got ${payment}`);
});

test('the balance after 12 repayments matches a month-by-month schedule within £1', () => {
  const m = stocks.mortgage;
  const payment = monthlyRepayment(m.loan, m.rate, m.termMonths);
  let balance = m.loan;
  for (let k = 0; k < 12; k++) balance = cents(balance + balance * (m.rate / 12) - payment);
  assert.ok(Math.abs(balanceAfter(m, 12) - balance) <= 1, `${balanceAfter(m, 12)} vs ${balance}`);
});

test('at the start (1 March 2026) 23 repayments are counted: May 2024 to March 2026', () => {
  // The first 1 March payment is at 06:00, before the game opens at 07:00, so it is already in
  // the opening balance. The brief said 22 (to February); this makes the start and the
  // mortgage's first in-game payment (1 April 2026) agree. See DECISIONS.
  const m = stocks.mortgage;
  const date = { year: 2026, month: 3, day: 1 };
  assert.equal(paymentsDueBy(m, date), 23);
  assert.equal(balanceOn(m, date), balanceAfter(m, 23));
});

test('the start: the money is set up from the data', () => {
  const w = createWorld({ ...data(), seed: 1, time: 7 * 60 });
  assert.equal(read(w, 'acct.joint'), 2500);
  assert.equal(read(w, 'acct.savings'), 8000);
  assert.equal(read(w, 'debt.overdraft'), 0);
  assert.equal(read(w, 'debt.mortgage'), balanceAfter(stocks.mortgage, 23));
  assert.equal(w.loans.mortgage.payment, 1339.23);
});

test('the next money event from the start is Oliver\'s club on 3 March 2026', () => {
  const w = createWorld({ ...data(), seed: 1, time: 7 * 60 });
  assert.deepEqual(nextMoneyEvent(w), { label: "Oliver's club", date: '3 Mar 2026' });
});

test('one game year from 1 March 2026: every bill once, the money as a hand sum', () => {
  const w = createWorld({ ...data(), seed: 1, time: 7 * 60 });
  const lines = [];
  // 28 game days run from 07:00 on day 0 to 00:00 on day 28: 1 March 2026 to 28 February 2027.
  for (let i = 0; i < 28 * 1440 - 7 * 60; i++) {
    step(w);
    for (const e of w.log) if (e.time === w.time && e.who === 'House') lines.push(e.text);
  }
  assert.deepEqual(w.calendar.fired, {
    mortgage: 11, payday: 12, councilTax: 10, water: 12, energy: 12, bills20: 12, interest: 12,
    subs: 12, clubs: 11, insurance: 1, energyCap: 4, christmas: 1,
  });
  assert.equal(lines.some((t) => t.startsWith('Could not pay')), false, 'nothing went unpaid');
  assert.equal(read(w, 'debt.overdraft'), 0, 'the surplus never reaches the overdraft');
  // Hand sum (pounds): 2,500.00 start
  //   + 12 × 4,317.28 pay              = 51,807.36
  //   − 11 × 1,339.23 mortgage         = 14,731.53
  //   − 10 × 210.04 council tax (£2,100.36 ÷ 10, rounded) = 2,100.40
  //   − 12 × 48.92 water (£587 ÷ 12)   =   587.04
  //   − 12 × 143.58 energy (£1,723 ÷ 12) = 1,722.96
  //   − 12 × 32.00 broadband           =   384.00
  //   − 12 × 37.20 phones              =   446.40
  //   − food and everyday, £216.62 a week over 365 days, rounded each game day = 11,295.07
  //   − insurance £260 + £140 (1 June) =   400.00
  //   − 12 × 20.00 life cover + 12 × 15.00 TV Licence + 12 × 22.00 streaming
  //     + 12 × 4.00 apps               =   742.00
  //   − 11 × 20.00 Oliver's club (not August) = 220.00
  //   − household goods and clothing, £35 a week over 365 days, rounded each game day = 1,825.00
  //   = 19,862.96
  assert.equal(read(w, 'acct.joint'), 19862.96);
  // Savings: £8,000 with 2.53% a year, paid monthly on the last day of the month, rounded each month.
  let savings = 8000;
  for (let k = 0; k < 12; k++) savings = cents(savings + cents((savings * 0.0253) / 12));
  assert.equal(read(w, 'acct.savings'), savings);
  // The mortgage: 34 repayments from May 2024 (the start had 23, and 11 more were made).
  assert.ok(Math.abs(read(w, 'debt.mortgage') - balanceAfter(stocks.mortgage, 34)) <= 1);
});

test('a save keeps the money: the same game goes on exactly after reloading', () => {
  const live = createWorld({ ...data(), seed: 5, time: 7 * 60 });
  for (let i = 0; i < 2000; i++) step(live);
  const text = JSON.stringify(toSave(live, createClock(live.time), 0));
  const back = fromSave(JSON.parse(text), data());
  for (let i = 0; i < 3000; i++) { step(live); step(back); }
  assert.deepEqual(back.stocks, live.stocks);
  assert.deepEqual(back.loans, live.loans);
  assert.deepEqual(back.log, live.log);
});

test('a version 2 save (no money in it) loads and gets its money from the data, on its date', () => {
  const w = createWorld({ ...data(), seed: 5, time: 7 * 60 });
  const save = JSON.parse(JSON.stringify(toSave(w, createClock(w.time), 0)));
  save.version = 2;
  delete save.stocks;
  delete save.loans;
  const back = fromSave(save, data());
  assert.equal(read(back, 'acct.joint'), 2500);
  assert.equal(read(back, 'debt.mortgage'), balanceAfter(stocks.mortgage, 23));
});
