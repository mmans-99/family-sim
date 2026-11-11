# Life systems — how to build the world so lives feel real

This is the build guide for turning `docs/WORLD_PRINCIPLES.md` (the design brief) into code.
It is written so any AI model (or person) can pick up one step, build it, test it and hand
over, without needing the chat history.

**Read first, every time:** `CLAUDE.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, then this
file's section 1 (rules) and the section for the step you are building. Read
`docs/SIMULATION.md` section 0 to see what is already built.

**Status of this plan:** written 2026-11-11. L0 is built (save/load, random streams). L1 is built
(calendar). L2 is built (money, 2026-11-11; see 3a "as built"), with the mapping approved by the user on 2026-11-11 and the refinements listed in
the section 2 note below. L3 (replay harness) is built (2026-11-11; see 15a "as built"). L4 (stress, sleep debt, couplings, interruptions) has a detailed brief in 4d, not built yet. Each later step must be approved by the user before its code is written
(CLAUDE.md rule). Tick the matching item in `docs/ROADMAP.md` when a step is finished.

---

## 0. The idea in one paragraph

The world is not content (scenes, scripted events). It is **clocks and ledgers**: stocks of
things (money, sleep, health, trust, attention) that rise and fall at set rates, have floors
they can't go below, and come due on dates. People, households, firms and institutions each
own stocks and follow simple rules. Holidays, job losses, arguments and funerals are never
scripted. They happen because stocks, dates and chance meet. If you can name a scene in
advance, it is content, and we don't build content.

### Words used in this file
- **Stock** — a quantity that changes over time: Sarah's hunger, the joint account, Tom's
  health, how fond Oliver is of his dad. Always a number.
- **Flow** — a rate that moves a stock up (inflow) or down (outflow), e.g. hunger −5 an hour,
  salary +£X a month.
- **Floor / ceiling** — the lowest and highest value a stock can take. Some floors are hard
  (energy can't go below 0); some spill into a debt (money below 0 becomes overdraft).
- **Ledger** — the list of entries that changed a stock, with the reason. Lets us explain
  why something happened, and lets people hold grudges (promised vs delivered).
- **Maturity / due date** — when something must be paid or done (rent day, a deadline).
- **Lag** — a stock moves towards its target slowly, not in one tick. Written as a
  *half-life*: the time it takes to close half the gap.
- **Coupling** — one stock changing the rates of others (illness drains money and sleep).
- **Hazard** — a chance per unit of time that something happens (yearly chance of death at
  a given age). Drawn with the seeded random numbers.
- **Poisson process** — events that happen at random but at an average rate (on average 2
  chance meetings a week at the shops). Built by drawing the wait until the next one.
- **Agent** — anything that makes its own decisions in the sim: a person, a firm, a school.
- **Off-screen** — simulated but not drawn. Everything outside the house is off-screen and
  shows up only as text commentary (VISION.md scope rule).
- **Belief** — what a person *thinks* a value is. Can be old or wrong.

---

## 1. Rules for every step (do not break these)

1. **`src/sim/` never touches the screen.** No `document`, no `window`, no canvas. New
   systems are plain functions on the `world` object. The renderer and panel only read.
2. **Seeded random only.** Never `Math.random()`. And give every new system its **own
   random stream** (see 1a) so adding the economy does not change what Sarah has for
   breakfast with the same seed.
3. **Everything in `world` must be plain JSON.** No `Map`, `Set`, class instances or
   functions stored in the world state that needs saving. (The walking map is rebuilt from
   `house.json` on load, so it is fine as it is.) This keeps save/load and catch-up simple.
4. **Content goes in `data/`.** Rates, prices, jobs, places, holidays, text lines: JSON.
   Code holds only the rules. If you are typing a number like `1340` into a `.js` file, it
   belongs in `data/`.
5. **Two speeds of stepping.** People inside the house step every game minute (as now).
   Off-screen agents (firms, institutions, the economy, relatives) step **once per game day**
   at 00:00, or once per calendar day as section 2 explains. Never per minute: catch-up on
   a phone must stay fast.
6. **No scripts.** Never write "on day 30, Tom loses his job". Write the rule (firm revenue
   falls → headcount pressure → redundancy chance by exposure) and let the seed decide.
7. **Watch only.** Nothing added gives the player control. New information shows in the
   panel or the commentary, read-only.
8. **Every number gets a source or a label.** Real-world figures (bills, rates, life tables)
   need a source in `docs/FAMILY.md` or the JSON file's `"about"`/`"source"` field. Made-up
   tuning numbers are labelled `"tuning": true` so later sessions know they can change them.
9. **The why trace grows with the brain.** Every new thing that changes a decision's score
   (an obligation, a belief, stress, a personality slider) adds a field to `person.why`, so
   the build-time "why" view keeps explaining every choice.
10. **Small steps.** Each step below ends with tests passing and something visible in the
    panel or commentary. Update the docs after every step (CLAUDE.md "After every change").

### 1a. Random streams
`src/sim/rng.js` makes one stream from a seed. Add a helper and use one stream per system:

```js
// rng.js
export function hashString(s) {            // small, stable string hash (FNV-1a)
  let h = 0x811c9dc5;
  for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}
export function subRng(seed, name) { return createRng((seed ^ hashString(name)) >>> 0); }
```

`world.rng` stays as it is for the people's brain (so existing same-seed tests still pass).
New systems use `world.rngs.economy`, `world.rngs.encounters`, `world.rngs.health`, etc.

For saving, the random state must be readable. Change `createRng` to keep its state on an
object (`{ s }`) or add `getState()/setState()`. Do this in the save/load step.

### 1b. Random helpers (put in `src/sim/random.js`, all take a stream `r`)
```js
export const chance = (r, p) => r() < p;                          // true with probability p
export const between = (r, a, b) => a + r() * (b - a);
export const waitFor = (r, ratePerDay) => -Math.log(1 - r()) / ratePerDay; // days to next Poisson event
export const pick = (r, list) => list[Math.floor(r() * list.length)];
export function weighted(r, items, weightOf) { /* like the brain's score² pick */ }
export function normal(r, mean, sd) {                              // Box–Muller
  const u = 1 - r(), v = r();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
```
Test each one: same seed gives the same numbers; averages over 10,000 draws land near the
expected value.

---

## 2. The two clocks and the calendar (build this first)

### The problem
The game year is 28 game days (DECISIONS: 1 game day = 2.5 real hours). Real life runs on a
365-day calendar: monthly mortgage, quarterly energy cap, school terms, Christmas, a 5-year
mortgage fix ending in spring 2029. If bills came every 30 *game* days, the family would pay
the mortgage once a year. If they came every 30 *calendar* days on a 28-day year, nothing
lines up with seasons or ageing.

### The answer (approved 2026-11-11; built in L1)

> **Built version (refinements to the proposal below):** the date shown changes once per game day,
> and the clock shows the whole game day's span as a range ("27 Mar 2026 – 8 Apr 2026"), so every
> dated event that fires that day is inside it. Game days partition the calendar exactly: a
> calendar day belongs to one game day only (`calendarSpan`). Weekdays are computed (`weekday`) but
> not shown, because game-day weekdays would not match real weekdays. School terms and council tax
> months are not in `data/calendar.json` yet (they need sourcing first).
Keep the **day clock** (minutes and hours, as now) for what people do. Add a **calendar**
that runs on the **life clock**: each game day stands for **365 / 28 ≈ 13.04 calendar days**.

- Game day 1 of year 1 = **1 March** of the start year (spring, matching `clock.js`, where
  days 1–7 are Spring). Start year: 2026 (so the mortgage fix ends spring 2029 = game year 4).
- The calendar date moves forward smoothly through the game day: at game time `t` minutes,
  `calendarDayIndex = floor(t / 1440 * 365 / 28)` counted from 1 March of the start year.
- Anything due on a calendar date (mortgage on the 1st, pay on the 28th, Christmas Day,
  Oliver's birthday) **fires during the game day whose span contains that date**, at a fixed
  hour from the data (e.g. bills at 06:00, pay at 09:00). If two fall in one game day, both fire.
- **Weekdays follow the game days, not the calendar.** Game day 1 is a Monday; the week
  repeats every 7 game days. So Tom works game Mon–Fri, Oliver has school game Mon–Fri in
  term. The game day the family lives is "a typical day standing for the fortnight around it".
  Seasons stay 7 game days each, as now.
- Ageing runs on the calendar: someone born on 12 June has a birthday on the game day
  containing 12 June. One game year = one year of age.

This gives about 2.3 mortgage payments per in-game week and 28 lived days a year: money and
ageing move at a watchable pace while every day is still a full day with meals and bedtime.

### Files
- `src/sim/calendar.js` — pure functions:
  ```js
  export const CAL_DAYS_PER_GAME_DAY = 365 / 28;
  export function calendarDate(time, start)      // -> { year, month (1-12), day, dayIndex }
  export function weekday(time)                   // -> 0..6, 0 = Monday, from game days
  export function calendarSpan(gameDayIndex, start) // -> [firstDayIndex, lastDayIndex] covered by that game day
  export function dueToday(rule, gameDayIndex, start) // does a repeating rule fall in this game day? -> list of dates
  ```
  Handle month lengths and leap years with plain date arithmetic. Use `Date.UTC` only for
  converting a day index to y/m/d (no time zones, no `new Date()` with the current time).
- `data/calendar.json`:
  ```json
  {
    "about": "Calendar start and dated rules. Times are game hours on the game day that contains the date.",
    "start": { "year": 2026, "month": 3, "day": 1 },
    "rules": [
      { "id": "mortgage",  "repeat": "monthly", "day": 1,  "hour": 6 },
      { "id": "payday",    "repeat": "monthly", "day": 28, "hour": 9 },
      { "id": "councilTax","repeat": "monthly", "day": 1,  "hour": 6, "months": [4,5,6,7,8,9,10,11,12,1] },
      { "id": "energyCap", "repeat": "quarterly", "months": [1,4,7,10], "day": 1, "hour": 0 },
      { "id": "christmas", "repeat": "yearly", "month": 12, "day": 25, "hour": 7 }
    ],
    "schoolTerms": [ { "from": "09-03", "to": "10-23" }, { "from": "11-02", "to": "12-18" } ]
  }
  ```
  (School term dates: look up Birmingham City Council's published dates and cite them.
  Council tax in England is commonly paid in 10 monthly instalments, April–January: check.)
- `world.calendar = { start }` and `world.firedToday = []` (ids fired this game day, cleared at
  00:00) so rules fire exactly once.

### How it plugs in
In `step(world)`, at the start of each minute: if `world.time % 1440 === 0` run
`startOfGameDay(world)` (works out which rules fall today and queues them by hour). Each minute,
fire queued rules whose hour has come: `fire(world, rule, date)` calls the system that owns
the rule (money, school, holidays). A rule with no owner yet just logs a line.

### Tests (`tests/calendar.test.js`)
- Game day 1 → 1 March 2026; game day 28 ends on about 28 February 2027.
- Over one game year exactly 12 `mortgage` fires, 12 `payday` fires, 4 `energyCap` fires,
  1 `christmas`. Over four years, 48/48/16/4 (leap year 2028 included).
- No rule fires twice for the same date. No date is skipped at year boundaries.
- `weekday` cycles Monday..Sunday every 7 game days.

### Watchable result
The status line shows the calendar date ("Sat 14 Mar 2026") beside the clock, and the log
shows "Mortgage due" at 06:00 on the right game days.

---

## 3. The stock engine

### Goal
One small engine for every quantity that rises, falls, has limits and a history. Needs
already work like this; money, sleep debt, health, stress, relationships and a child's
wellbeing will all use it.

### Shape of a stock (plain JSON, lives in `world.stocks[id]`)
```json
{
  "id": "acct.joint", "owner": "household", "kind": "money",
  "value": 4200, "min": -1500, "max": null,
  "floor": "spill", "spillTo": "debt.overdraft",
  "target": null, "halfLifeHours": null,
  "ledger": [ { "t": 10080, "amount": -1340, "reason": "mortgage", "ref": "mortgage" } ],
  "ledgerKeep": 60
}
```
- `floor`: `"hard"` (stop at min), `"spill"` (the amount past min goes into `spillTo`, e.g.
  overdraft or sleep debt). `max: null` means no ceiling.
- `target` + `halfLifeHours`: a **lagged** stock. Each step it moves towards `target` by
  `gap × (1 − 0.5^(dtHours / halfLifeHours))`. Mood, health, a child's wellbeing and a
  neighbourhood's reputation are lagged: you change the target, the value follows slowly.
- `ledger`: last `ledgerKeep` entries. Older ones are rolled into `ledgerTotals[reason]` so
  the file doesn't grow forever.

### Flows (`world.flows`, plain JSON)
```json
{ "id": "salary.tom", "stock": "acct.joint", "amount": 4100, "rule": "payday", "reason": "Tom's pay" }
{ "id": "food.weekly", "stock": "acct.joint", "amount": -140, "every": "calendarWeek", "reason": "food shop" }
{ "id": "stress.decay", "stock": "stress.sarah", "perHour": -0.5 }
```
A flow is either **dated** (`rule` from `calendar.json`, fires once per due date), **per
calendar period** (`every`: spread over the calendar days a game day covers — a weekly £140
food spend becomes about £260 per game day, booked at a set hour), or **continuous**
(`perHour`, applied each minute as `perHour / 60`).

### API (`src/sim/stocks.js`)
```js
export function addStock(world, def)                      // from data/stocks.json at start
export function change(world, id, amount, reason, ref)   // the ONLY way to change a stock: clamps, spills, writes the ledger
export function setTarget(world, id, target)             // for lagged stocks
export function stepStocks(world, minutes = 1)           // continuous flows + lags
export function runDatedFlows(world, ruleId, date)       // called by calendar fire()
export function read(world, id)                          // value
```
`change` must return the amount actually applied (after clamping) so callers can react,
e.g. "couldn't pay the full bill".

### Data
- `data/stocks.json` — the starting stocks. Household money from `docs/FAMILY.md` (savings,
  current account, mortgage balance £238,500 at about 4.6% fixed to spring 2029, monthly
  repayment about £1,340, energy £1,723/yr, council tax, water £587/yr). Any figure not in
  FAMILY.md (broadband, phones, food, car) must be looked up and cited there first.
- `data/flows.json` — the flows above.
- The **mortgage** is a stock too: `debt.mortgage`, value = balance. Each repayment moves
  money out of `acct.joint` and reduces `debt.mortgage` by the capital part. Monthly interest
  = balance × annual rate / 12. Keep the rate in `world.loans.mortgage.rate` with `fixedUntil`.

### What *not* to change yet
Leave `person.needs` as it is in this step. The needs already work and have tests.
Migrating needs into stocks is optional and comes later (step 3c) if it helps coupling.

### Tests (`tests/stocks.test.js`)
- `change` clamps at a hard floor and spills past a spill floor into the right stock.
- A lagged stock with half-life 24h closes half its gap after 24 game hours (±1%).
- Run one game year with only bills and pay: the joint account ends at the value you work
  out by hand (write the hand sum in the test comment).
- Mortgage: after 12 repayments the balance matches a standard repayment schedule to within £1.
- Ledger stays at most `ledgerKeep` entries and totals are kept.

### Watchable result
The panel gets a **Household** line: account balance, savings, days to next mortgage. The log
shows "Paid the mortgage (£1,340)" and "Tom was paid".

### 3a. L2 build brief (approved 2026-11-11; built 2026-11-11)
**As built.** Steps 0 to 7 are done. Where the build differs from this brief, the reason is in DECISIONS (2026-11-11): 23 repayments are counted at the start, not 22 (the 1 March 2026 payment is at 06:00, before the game opens, so it is in the opening balance; the year has 11 mortgage payments, not 12); money in repays the overdraft first (not in the brief); the pension is 5% of the whole salary; no published worked example for take-home pay was found, so the test uses a hand sum; the Step 0 gaps are labelled `tuning` in the data and listed in `docs/FAMILY.md`. Extra work beyond the brief: `nextMoneyEvent` (the panel's "Next" line), `runWeeklyFlows` (called from `step()` at each flow's hour), and the ledger roll-up (oldest entries into `ledgerTotals` by reason) is in `stocks.js` `record()`.
This is the exact plan for step L2. The user approved it on 2026-11-11 with these choices
(DECISIONS 2026-11-11): council tax **Band C**, **no car**, **Child Benefit not claimed**,
starting balances **£2,500** joint account and **£8,000** savings (tuning), Tom on **£75,000**
with a **5% workplace pension** and **no student loan**. Where this brief and the general text
above differ, this brief wins.

Terms: a *stock* is a number that rises and falls (a balance); a *flow* moves it (pay in, a
bill out); a *ledger* is the list of changes with reasons. Money is in pounds, kept to the
penny (round with `Math.round(x * 100) / 100` after each change).

**Addendum (decided and built 2026-11-11):** insurance and subscriptions are added as
flows, using the items and tuning figures in `docs/FAMILY.md` ("Insurance and subscriptions").
They need: annual flows with `{ "perYear", "over": 1 }` on a new yearly rule (`insurance`, 1 June,
07:00); a monthly rule `subs` (22nd, 07:00) for life cover, TV Licence, streaming and apps; a
monthly club flow on the 3rd, using `months` to skip August; and a weekly flow `clothing` for
household goods and clothing (£35 a week). Built on the user's approval the same day (tests: 112 passing).

#### Step 0. Source the figures (web search, before any code)
Write each figure, its date and its link into `docs/FAMILY.md` (Household bills table, or a new
"Income" table), then into the data file's `"source"` field. Do not guess any of these:
1. 2026/27 Income Tax (England): personal allowance, basic rate band and rate, higher rate
   band and rate, and the £100k allowance taper (not reached at £75k, but put it in the data).
   Expected (verify): £12,570 allowance; 20% to £50,270; 40% above.
2. 2026/27 employee National Insurance (Class 1): primary threshold, upper earnings limit,
   main and upper rates. Expected (verify): 8% from £12,570 to £50,270, 2% above.
3. Birmingham council tax 2026/27 **Band C** total (all precepts), and how the default
   instalments run (expected: 10 monthly payments, April to January; verify).
4. Typical UK broadband bill and typical mobile phone bill per month (two adult phones). Use
   Ofcom or a comparison site with a date.
5. Weekly household food and non-alcoholic drink spend, and weekly "everyday" spending
   (household goods, personal care, recreation, clothing) for a couple with two children:
   ONS *Family spending in the UK*, latest edition. Say which table and which year.
6. A typical easy-access savings rate (Bank of England or Moneyfacts), dated.
If a figure cannot be found, label it `"tuning": true` with a short reason, and tell the user.

#### Step 1. Data files
`data/tax.json` — the 2026/27 rules from Step 0:
```json
{ "about": "...", "source": "...", "year": "2026/27",
  "incomeTax": { "allowance": 12570, "taperFrom": 100000, "bands": [ { "upTo": 50270, "rate": 0.2 }, { "upTo": null, "rate": 0.4 } ] },
  "ni": { "from": 12570, "upper": 50270, "main": 0.08, "above": 0.02 } }
```
(Bands are on income above the allowance where the source says so: follow the source's
method and test it against a published worked example.)

`data/stocks.json`:
```json
{ "about": "...", "stocks": [
  { "id": "acct.joint", "kind": "money", "value": 2500, "min": 0, "floor": "spill", "spillTo": "debt.overdraft", "ledgerKeep": 60, "tuning": true },
  { "id": "acct.savings", "kind": "money", "value": 8000, "min": 0, "floor": "hard", "ledgerKeep": 60, "tuning": true },
  { "id": "debt.overdraft", "kind": "money", "value": 0, "min": 0, "max": 1500, "ceiling": "hard", "ledgerKeep": 60, "tuning": true },
  { "id": "debt.mortgage", "kind": "money", "value": null, "min": 0, "floor": "hard", "ledgerKeep": 60 }
],
  "mortgage": { "loan": 238500, "rate": 0.046, "termMonths": 300, "firstPayment": { "year": 2024, "month": 5, "day": 1 }, "fixedUntil": { "year": 2029, "month": 4, "day": 30 }, "source": "docs/FAMILY.md (assumption, not a quote); first payment date is tuning" },
  "salary": { "who": "tom", "gross": 75000, "pension": 0.05, "pensionMethod": "netPay", "studentLoan": false, "tuning": "user choice 2026-11-11" } }
```
- `debt.mortgage` starts at `null`: the code works out the balance on the game's start date
  from the loan (see Step 3). Never type the balance in.
- Debts are positive numbers (what is owed). The overdraft fills when the joint account would
  go below £0. If the overdraft is full, the rest is **not paid**: `change` returns the part
  that was applied and the log says "Could not pay <bill> in full (£X short)".
- No transfers between accounts in L2 (who moves money is behaviour, from L5/L8 on).

`data/flows.json` — every flow has `id`, `stock`, `amount` (negative = money out), `reason`
(the log text), and either `rule` (a calendar rule id) or `every`:
| id | stock | when | amount |
|---|---|---|---|
| `pay.tom` | `acct.joint` | rule `payday` (28th, 09:00) | `"net"`: worked out from `tax.json` and `salary` ÷ 12 |
| `mortgage` | `acct.joint` | rule `mortgage` (1st, 06:00) | `"mortgage"`: the fixed repayment (about £1,339) |
| `counciltax` | `acct.joint` | new rule `councilTax` (1st, 07:00, months 4–1) | Band C yearly ÷ 10 |
| `water` | `acct.joint` | new rule `water` (15th, 07:00) | 587 ÷ 12 |
| `energy` | `acct.joint` | new rule `energy` (10th, 07:00) | 1723 ÷ 12 (flat in L2) |
| `broadband` | `acct.joint` | new rule `bills20` (20th, 07:00) | from Step 0 |
| `phones` | `acct.joint` | rule `bills20` | from Step 0 |
| `savings.interest` | `acct.savings` | new rule `interest` (last calendar day, 23:00) | `"interest"`: balance × rate ÷ 12 |
| `food` | `acct.joint` | `every: "calendarWeek"`, 10:00 | weekly figure from Step 0 |
| `everyday` | `acct.joint` | `every: "calendarWeek"`, 10:00 | weekly figure from Step 0 |
Add the new rules to `data/calendar.json` (all `"tuning": true` for the day and hour except
where a source gives the date). `calendar.js` already lets a monthly rule list `months`.
"Last calendar day" needs a small addition: `day: "last"` in `matches()` in `src/sim/calendar.js`; add a test.

#### Step 2. `src/sim/stocks.js` (pure, no DOM, no random numbers)
```js
export function addStock(world, def)                  // copies the def into world.stocks[id]; ledger [], ledgerTotals {}
export function read(world, id)                       // value
export function change(world, id, amount, reason, ref) // the ONLY way to change a stock. Returns the amount applied.
export function ledger(world, id)                     // newest last
```
`change`: add `amount`; if the result is below `min` and `floor` is `"spill"`, keep it at `min`
and put the shortfall into `spillTo` (as a positive debt) via `change` on that stock; if
`"hard"`, stop at `min` (and at `max` when `ceiling` is `"hard"`). Write one ledger entry
`{ t: world.time, amount: applied, reason, ref }` per stock touched. When the ledger is longer
than `ledgerKeep`, drop the oldest and add its amount to `ledgerTotals[reason]`.
Lags (`target`, `halfLifeHours`) and `stepStocks` are **not** needed for L2; leave them for L4.

#### Step 3. `src/sim/household.js` (pure)
```js
export function netMonthlyPay(tax, salary)       // gross − pension (net-pay: before tax) − income tax − NI, ÷ 12
export function monthlyRepayment(loan, rate, n)  // P·r / (1 − (1+r)^−n), r = rate / 12
export function balanceOn(mortgage, date)        // balance after every payment due on or before `date`
export function payMortgage(world, date)         // interest = balance·r; capital = payment − interest
export function setupMoney(world, data)          // stocks from stocks.json, debt.mortgage = balanceOn(start)
export function runFlow(world, flow, date)       // works out the amount ("net", "mortgage", "interest", or a number) and calls change()
export function runWeeklyFlows(world, span)      // every "calendarWeek" flow: amount × days in span ÷ 7
```
- `payMortgage`: `change(acct.joint, −payment, "Mortgage")` and
  `change(debt.mortgage, −capital, "Capital repaid")`. Interest is in the ledger entry's `ref`.
- **Weekly flows:** once per game day at 10:00, for the calendar days that game day covers
  (13 or 14 days: `calendarSpan(gameDay)` in `src/sim/calendar.js` gives the first and last calendar-day index; `dateAt` turns an index into a date). Log one line, e.g. "Food shop and
  spending for 27 Mar – 8 Apr (£X)".
- **Hook into the calendar:** `fireDue(world)` in `src/sim/world.js` fires each due rule today
  (it only writes a House log line and counts it in `world.calendar.fired`). Keep the count, and call `runFlowsForRule(world, ruleId, date)` instead: run every flow
  with that `rule`, log "Paid the mortgage (£1,339.10)", "Tom was paid (£X)", etc. Rules with no
  flow (Christmas, the energy cap) keep their current log line. The energy cap line becomes
  "Energy price cap reviewed (prices change from L11)".
- Call `setupMoney` in `createWorld`. Money uses **no** random numbers, so Sarah's same-seed day
  must not change.

#### Step 4. Save format version 3
Add `stocks` (each stock's value, ledger and ledgerTotals) and `loans.mortgage` (rate,
fixedUntil, payment) to `toSave`/`fromSave` in `src/sim/save.js`. Flow definitions come from
`data/` and are not saved. Version 1 and 2 saves still load: they get money from `setupMoney`
for the save's current date (mortgage balance for that date). Catch-up runs bills and pay
through the same calendar path, so a long absence pays every bill on its date.

#### Step 5. Panel (watch only)
In `src/ui/panel.js`, the Household block shows, above the House log lines:
"Joint account £X · Savings £Y · Mortgage left £Z", "Overdraft £W" only when above £0, and
"Next: <label> on <date>" (the next queued calendar event with a flow). Money formatted with
`toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })`.

#### Step 6. Tests (`tests/stocks.test.js`, `tests/household.test.js`)
- `change`: spills below £0 into the overdraft; a full overdraft returns a partial amount;
  a hard floor stops; ledger keeps `ledgerKeep` entries and rolls the rest into totals.
- `netMonthlyPay` matches a published 2026/27 worked example (cite it in the test) and the
  £75,000 / 5% case to the penny against a hand sum written in the comment.
- `monthlyRepayment(238500, 0.046, 300)` ≈ £1,339 (±£1); the balance after 12 payments matches
  a standard schedule within £1; `balanceOn` at 1 Mar 2026 equals 22 payments made
  (May 2024 to Feb 2026).
- `day: "last"` matches 28/29 Feb, 30 Apr, 31 Dec.
- One game year (28 game days) headless from 1 Mar 2026: count of each bill (12 mortgages,
  12 pays, 10 council tax, …) and the joint account's final value equal to a hand sum written in
  the comment.
- Save round trip with money; a version 2 save loads and gets money.
- Old tests unchanged: Sarah's same-seed day, calendar counts.

#### Step 7. Check and docs
Open the page (`?fresh=1`, then `?minutes=` to reach 1 Apr 06:00 and a 28th 09:00) and look at
the panel at phone size, sideways and upright. Then CLAUDE.md "After every change": STATUS,
DECISIONS, ROADMAP (tick L2), ARCHITECTURE (files, save v3), SIMULATION (as built), FAMILY
(sourced figures), this section's heading to "as built". Commit and push to `main` (no branches).

### 3b. Coupling and lags (`data/couplings.json`)
Couplings are rules that change **rates or targets** when a stock crosses a level:
```json
{
  "about": "If a stock is past a level, multiply other rates or push targets. tuning: true",
  "rules": [
    { "if": { "stock": "sleepdebt.{p}", "above": 6 },  "then": [ { "need": "fun",    "rateTimes": 1.4 },
                                                                 { "target": "stress.{p}", "add": 15 } ] },
    { "if": { "stock": "acct.joint", "below": 200 },   "then": [ { "target": "stress.{adults}", "add": 20 } ] },
    { "if": { "stock": "health.{p}", "below": 40 },    "then": [ { "need": "energy", "rateTimes": 1.6 },
                                                                 { "flag": "{p}.cantWork" } ] }
  ]
}
```
`{p}` means "for each person", `{adults}` for each adult. Evaluate couplings once per game hour
(not every minute) in `applyCouplings(world)`. Each person gets new stocks: `stress.<id>` (lagged,
half-life ~2 game days) and `sleepdebt.<id>` (rises when sleep ends early or is short, falls when
they sleep long). Stress feeds the brain (step 4) and the face.

Tests: with the account under £200 for a day, Sarah's stress rises towards its pushed target
and not instantly; removing the cause lets it fall back.

### 3c. (Optional, later) Needs as stocks
If coupling needs to touch needs often, move `person.needs` into stocks `need.<need>.<id>`
and keep a getter so old code still reads `person.needs.hunger`. Only do this with all
existing tests passing before and after.

---

## 4. The brain gets obligations, stress and beliefs

The current score (SIMULATION.md section 0) is:
`base + Σ need gain × urgency² − travel`. Extend it, one term at a time, each shown in `why`:

```
score = (base + needTerm) × personalityFit × moodFactor
        + obligationTerm
        − travelCost
        − stressPenalty (for effortful actions when stressed)
```

### 4a. Obligations (`data/obligations.json`)
An obligation is a dated or weekly duty with a time window and a cost of missing it:
```json
{ "id": "schoolRun", "who": "carer", "weekdays": [0,1,2,3,4], "inTerm": true,
  "window": [8.25, 8.75], "action": "leaveHouse", "dest": "school", "missCost": { "stress": 25, "tension": 10 } }
```
In the window, the matching action gets a large bonus (bigger than any need except a desperate
one). Missing it applies `missCost`. **Schedule rigidity** (section 7) decides which
obligations can move.

### 4b. Stress and mood
`moodFactor = 1 − stress/200` for fun and social actions (stressed people enjoy less), and
`stressPenalty` grows for chores when stress is high (things slide). Add the
**interruption rule** the known-issues list asks for: a need under 10 interrupts any action
except sleep and leaving the house.

### 4c. Beliefs — the observation layer
People never read the true world values. Each person has `person.beliefs`:
```json
{ "acct.joint": { "value": 2100, "seenAt": 9800, "source": "checked app" },
  "job.tom.safe": { "value": 0.9, "seenAt": 7000, "source": "Tom said" } }
```
- Beliefs update only through **observations**: checking the bank app (an action), being
  told by someone (a conversation, Phase 2), a letter arriving (a calendar or institution event),
  commentary-level news. Each observation copies the true value, maybe with noise
  (`normal(r, value, value × noise)`), and stamps the time.
- Old beliefs drift towards the person's bias: an anxious person's belief about money drifts
  down, an optimist's up (`personality.anxious` slider).
- The brain scores money-related actions (spending, worrying, checking) from the **belief**.
- The why trace shows both: `money: thinks £2,100 (3 days old), really £800`. This is the
  build-time view only; it will be hidden with `SHOW_WHY` at the end.

Tests: after the account drops, Sarah's belief stays at the old value until she checks; an
anxious and a calm Sarah given the same old belief drift in opposite directions.

### 4d. L4 build brief: stress, sleep debt, couplings, interruptions (written 2026-11-11; not built, waiting for the user's approval)

This is the exact plan for step L4. It is written so another model can build it without the
chat history. It builds sections **3b** (couplings and lags) and **4b** (stress, mood and the
interruption rule). Where this brief and those sections differ, **this brief wins**. Section 4a
(obligations) and 4c (beliefs) are **not** part of L4.

**Words used here.**
- *Stress*: a number from 0 (calm) to 100 (overwhelmed) per person, kept as a stock
  `stress.<id>`. It does not jump: it drifts towards a *target* (see lag).
- *Target*: where a lagged stock is heading. Stress's target is the person's *base* (from the
  anxious trait) plus the *pushes* from couplings that hold right now.
- *Lag / half-life*: each game hour the value closes part of the gap to its target. The
  half-life is the time it takes to close half the gap (48 game hours for stress).
- *Coupling*: a rule in `data/couplings.json`: "if this stock or need is past a level, then push
  that target, or make that need drop faster". Checked once per game hour.
- *Push*: one coupling's contribution to a target, kept by name, so the why trace and the
  ledger can say what is causing the stress.
- *Sleep debt*: hours of sleep owed, `sleepdebt.<id>`, from 0 to 24. Settled once a game day.
- *Mood factor*: stressed people enjoy things less: fun actions score × `1 − stress / 200`.
- *Stress penalty*: when stress is high, chores score less (things slide).
- *Interruption*: a need under 10 stops what a person is doing, so they can deal with it.

#### What exists now (checked 2026-11-11, so the brief matches the code)
- `src/sim/stocks.js` has `addStock`, `read`, `ledger`, `change`. A stock already copies `min`,
  `max`, `floor`, `ceiling`, `ledgerKeep`. There is **no** `target`, `halfLifeHours` or
  `stepStocks` yet. `change()` rounds to 0.01 (`cents`) and writes one ledger entry
  `{ t, amount, reason, ref }`.
- `step(world)` in `src/sim/world.js`: `time += 1`; at 00:00 `queueDay`; `fireDue`; weekly flows;
  then `stepPerson` for each person. `stepPerson` drops needs by `perHour / 60` (× `sleepFactor`
  while the action has `sleep: true`), decides if free, walks or does. Actions are never
  interrupted. `decide()` scores with `scoreAction(person, action, hour)` (exported, used by
  `tests/save.test.js`), keeps the best 3, picks with `world.rng`, else potters.
- `createWorld({ house, actions, needs, people, calendar, money, seed, time })`. `money` is
  optional: tests that leave it out get no money. L4 copies this pattern (below).
- `src/sim/save.js`: version 3; `stocks: clone(world.stocks)` saves **every** stock with all its
  fields; `fromSave` for version ≥ 3 **replaces** `world.stocks` with the saved ones.
- `src/main.js` line ~325 loads the data files with `fetch` in a list; `src/ui/panel.js`
  `renderPanel` draws need bars per person and `whyText`; `src/render/people.js` `mood(needs)`
  picks the face (any need < 25 uneasy, energy < 30 tired, average ≥ 80 happy, else content).
- The replay harness (15a) exists: `node tools/replay.js`. Probes in `tools/replay/probes.js`,
  invariants in `tools/replay/checks.js`, settings in `data/replay.json`.
- **Measured in the current game (5 seeds, one game year each, 2026-11-11):**
  - Sarah's needs never fall below about **24** (lowest seen: bladder 23.9, hunger 39, energy 50,
    hygiene 47, fun 65, comfort 66). No need is ever under 20.
  - She sleeps **exactly 8 hours** every night (sleep is a fixed 480-minute action, started
    between 22:00 and 00:15) and naps 0.5 to 1.3 hours most afternoons.
  - About 1,700 actions started per game year. One game year headless ≈ 0.4–0.5 s.
- **What this means (say it in STATUS, do not hide it):** with today's world, the interruption
  rule will **never** fire (no need goes under 10), sleep debt will stay at **0** (sleep is never
  cut short), and stress will settle at each person's **base** plus a small, occasional push when
  bladder dips under 25. That is correct. These mechanisms come alive when something presses on
  the day: obligations (L6), the children waking at night and needing care (L7), money trouble
  (L9/L11). L4 builds and proves the machinery with tests that force the conditions; the replay
  harness reports which parts never fired, as warnings.

#### Rules for this step
1. Everything in LIFE_SYSTEMS section 1 (no DOM in `src/sim/`, seeded random only, plain JSON
   state, numbers in `data/` with a source or `"tuning": true`, the why trace grows).
2. **No new random numbers.** Stress, lags, couplings and sleep debt use none. The only random
   draws stay the brain's (`world.rng`). Sarah's same-seed day **will** change (the mood factor
   changes scores, so different options win). That is expected. Two runs of the same seed must
   still be identical.
3. **Opt-in data, like money.** `createWorld` takes two new optional inputs, `wellbeing` and
   `couplings`. Without them the world behaves exactly as now: no stress stocks, no couplings, no
   mood factor, no interruptions. This keeps every existing test unchanged and passing (they
   build worlds without the new files). The game (`main.js`), the save loader and the replay
   harness pass both files.
4. **Hourly, not per minute.** Couplings and lags run once per game hour (at hh:00), not every
   minute (rule 5 in section 1; catch-up must stay fast on a phone).
5. **Every stress change goes through `change()`** and so has a ledger entry with its causes.
6. **Do not add a fix for the vicious circle** (stress → less fun → fun need falls → more stress).
   It is meant to be there (WORLD_PRINCIPLES).
7. Work on `main`; ask before changing anything outside the files listed here.

#### Step 1. Data files

`data/wellbeing.json` (new):
```json
{
  "about": "Stress, sleep debt, mood and interruptions (LIFE_SYSTEMS 4d). All numbers are tuning unless a source is given.",
  "tuning": true,
  "stress": {
    "id": "stress.{p}", "min": 0, "max": 100, "floor": "hard", "ceiling": "hard", "ledgerKeep": 60,
    "halfLifeHours": 48,
    "base": 20, "anxiousPerPoint": 3,
    "bands": [ { "below": 30, "label": "calm" }, { "below": 60, "label": "tense" }, { "below": 101, "label": "stressed" } ]
  },
  "sleepDebt": {
    "id": "sleepdebt.{p}", "min": 0, "max": 24, "floor": "hard", "ceiling": "hard", "ledgerKeep": 60,
    "needHours": 8, "needSource": "NHS: most adults need 7 to 9 hours a night (look up the page, cite it here with the date)",
    "checkHour": 18, "maxRepayPerDay": 2
  },
  "mood": { "factorPer": 200, "kinds": ["fun"] },
  "stressPenalty": { "from": 50, "perPoint": 0.1, "kinds": ["chore"] },
  "interrupt": { "below": 10, "retryMinutes": 30, "logPrefix": "Stopped" }
}
```
- `{p}` is replaced by each person's id (`stress.sarah`, `sleepdebt.sarah`).
- **Base stress** = `base + anxiousPerPoint × (anxious − 5)`, clamped to 0..100. Anxious 0 → 5,
  5 → 20, 10 → 35. The stock starts at its base, with its target at its base (no drift at the start).
- `checkHour` 18: sleep is settled at 18:00, after the afternoon nap and before bed, so each
  check counts one night and one day's naps.
- `maxRepayPerDay` 2: lost sleep is paid back slowly; a long sleep repays at most 2 hours a day.

`data/couplings.json` (new): the rules from 3b, in this exact shape:
```json
{
  "about": "Couplings (LIFE_SYSTEMS 3b, 4d): if a stock or need is past a level, push a target or change how fast a need drops. Checked once per game hour. who: each (every person) or adults (age 18 and over). {p} is the person's id. All numbers are tuning.",
  "tuning": true,
  "rules": [
    { "id": "lowNeeds",   "who": "each",   "if": { "need": "any", "below": 25 },
      "then": [ { "target": "stress.{p}", "add": 5, "perMatch": true } ] },
    { "id": "sleepDebt",  "who": "each",   "if": { "stock": "sleepdebt.{p}", "above": 6 },
      "then": [ { "target": "stress.{p}", "add": 15 }, { "need": "fun", "rateTimes": 1.4 }, { "need": "energy", "rateTimes": 1.2 } ] },
    { "id": "lowBalance", "who": "adults", "if": { "stock": "acct.joint", "below": 200 },
      "then": [ { "target": "stress.{p}", "add": 20 } ] },
    { "id": "overdrawn",  "who": "adults", "if": { "stock": "debt.overdraft", "above": 0 },
      "then": [ { "target": "stress.{p}", "add": 15 } ] },
    { "id": "highStress", "who": "each",   "if": { "stock": "stress.{p}", "above": 60 },
      "then": [ { "need": "comfort", "rateTimes": 1.2 } ] }
  ]
}
```
- A `need` condition counts *matches*: `"any"` matches each of the person's needs below the
  level (so two low needs = 2 matches); a named need (`"need": "hunger"`) matches 0 or 1. With
  `"perMatch": true` the `add` is multiplied by the matches. A `stock` condition is 1 match or 0.
- `below` means strictly less than; `above` strictly more than.
- If a rule names a stock that does not exist (a world without money), the rule is skipped and
  not counted. No error.

`data/actions.json` (edit, no behaviour change on its own): add a `kind` to these actions:
`"kind": "fun"` on `tv`, `read`, `books`, `garden`; `"kind": "chore"` on `laundry`, `dishes`.
Add `"countsAsSleep": true` to `nap`. Update the file's `about` to explain both fields.
Do **not** put `sleep: true` on the nap (that would change how needs drop during it).

`data/people.json`: no change. "Adult" means `age >= 18` (Sarah is 34). Update the `about` to
say the anxious trait now sets base stress.

#### Step 2. Lags in `src/sim/stocks.js`
```js
export function setTarget(world, id, target, pushes = {})  // clamps target to min..max; stores stock.target and stock.pushes (plain object, reason -> amount)
export function stepStocks(world, hours = 1)                // every stock with halfLifeHours: move towards target
```
- `addStock` also copies `halfLifeHours` (default `null`), `target` (default `null`), `pushes`
  (default `{}`) and `base` (default `null`).
- `stepStocks`: for each stock with a `halfLifeHours` and a non-null `target`:
  `gap = target − value`; `move = cents(gap × (1 − 0.5 ** (hours / halfLifeHours)))`;
  if `move !== 0`, `change(world, id, move, 'Drift', { target, before: value, pushes: { ...pushes } })`.
  A move never passes the target (the formula cannot overshoot; keep it that way). When the gap
  is so small that the move rounds to 0, nothing is written: that is the resting state.
- Iterate stocks in key order (`Object.keys(world.stocks).sort()`) so the ledger order is fixed.
- Ledger load: at most 24 Drift entries per game day per stress stock, well under `ledgerKeep` 60.

#### Step 3. `src/sim/wellbeing.js` (new, pure)
```js
export function setupWellbeing(world, wellbeing, couplings)  // stocks per person, world.wellbeing, world.couplings
export function baseStress(person, cfg)                     // base + anxiousPerPoint × (anxious − 5), clamped 0..100
export function applyCouplings(world)                       // once per game hour: targets, rate multipliers, fired counts
export function settleSleep(world, person)                  // once per game day at checkHour: sleep debt
export function moodFactor(stress, action, cfg)             // 1 − stress / factorPer for kinds in cfg.mood.kinds, else 1
export function stressPenalty(stress, action, cfg)          // perPoint × max(0, stress − from) for kinds in cfg.stressPenalty.kinds, else 0
export function stressLabel(stress, cfg)                    // "calm" / "tense" / "stressed" from the bands
```
- `setupWellbeing`: stores `world.wellbeing = clone(wellbeing)` and
  `world.couplings = { rules: clone(couplings.rules), fired: {} }`. For each person: `addStock` for
  `stress.<id>` (value = target = base = `baseStress`) and `sleepdebt.<id>` (value 0, no lag); set
  `person.rateTimes = {}`, `person.sleptMinutes = 0`, `person.sleepWindowStart = world.time`,
  `person.noInterruptBefore = 0`. All plain JSON.
- `applyCouplings`, for each person: start with `pushes = {}` and `rateTimes = {}`. For each rule
  whose `who` includes the person, work out the matches (skip the rule if its stock is missing).
  If matches > 0: count `world.couplings.fired[rule.id] += 1` (once per rule per hour, however
  many people it holds for: count it once per person, so two adults count 2), and for each `then`:
  - `target`: `pushes[rule.id] = (pushes[rule.id] ?? 0) + add × (perMatch ? matches : 1)`;
  - `need`: `rateTimes[need] = (rateTimes[need] ?? 1) × rateTimes`.
  Then `setTarget(world, 'stress.<id>', base + Σ pushes, pushes)` and `person.rateTimes = rateTimes`.
  Rules run in file order; people in `world.people` order.
- `settleSleep(world, person)`: if `world.time − person.sleepWindowStart < 1440` (the first, partial
  window after a new game or a loaded old save), just reset and return. Otherwise
  `owed = needHours − sleptMinutes / 60`; if `owed < 0`, `owed = max(owed, −maxRepayPerDay)`;
  `change(world, 'sleepdebt.<id>', owed, 'Sleep', { slept: sleptMinutes })` (the stock's floor and
  ceiling clamp it). Then `sleptMinutes = 0`, `sleepWindowStart = world.time`.
  With today's game: 8 h sleep + a nap → owed ≤ 0 → the debt stays 0. That is expected.

#### Step 4. Hook into `step()` and the brain (`src/sim/world.js`)
`step(world)` becomes (new lines marked):
```js
world.time += 1;
if (world.time % MINUTES_PER_DAY === 0) queueDay(world, false);
fireDue(world);
weekly flows…
if (world.couplings && world.time % 60 === 0) {                 // new
  applyCouplings(world);                                        // new
  stepStocks(world, 1);                                         // new
  if (hourOf(world.time) === world.wellbeing.sleepDebt.checkHour) {
    for (const p of world.people) settleSleep(world, p);        // new
  }
}
for (const person of world.people) stepPerson(world, person);
```
In `stepPerson`:
1. **Need rates:** multiply each need's drop by `person.rateTimes?.[need] ?? 1`.
2. **Sleep minutes:** while the activity is in phase `do` and its action has `sleep: true` or
   `countsAsSleep: true`, add 1 to `person.sleptMinutes`.
3. **Interruption** (only when `world.wellbeing` exists), checked **before** the walk/do code and
   after the needs drop:
   - Skip if there is no activity, if the action (or the activity's `next`) has `sleep: true`, or if
     `world.time < person.noInterruptBefore`.
   - Find the lowest need under `interrupt.below` (10) that the current action does **not** gain
     (`!(action.gain[need] > 0)`, and the same for `activity.next?.action`). If none, carry on.
   - Ask the brain for an option that fills it: refactor `decide(world, person)` into
     `decide(world, person, onlyFor = null)`. With `onlyFor` set, keep only options whose action
     has `gain[onlyFor] > 0`, and **do not potter** if none qualify: return `false` without drawing
     any random number. Otherwise it behaves exactly as now and returns `true`.
   - If an option was found: before it replaces the activity, log
     `${interrupt.logPrefix} ${oldLabel.toLowerCase()}: ${needLabel.toLowerCase()} too low (${Math.round(value)})`
     (e.g. "Stopped reading in the armchair: bladder too low (8)") as a line by that person,
     and add `interrupted: { action: oldId, need, value: Math.round(value) }` to the new `person.why`.
     The new activity starts as any decision does (walk next minute).
   - If none was found: `person.noInterruptBefore = world.time + retryMinutes` and carry on.
   - The gains already given by the stopped action stay (they are added a minute at a time).
4. **Scoring:** in `decide`, read `stress = world.stocks['stress.<id>']?.value ?? 0` and pass it
   on. Change `scoreAction(person, action, hour, stress = 0, cfg = null)`: after the personality
   fit and the off-hours factor, `score *= moodFactor(stress, action, cfg)` and then
   `score -= stressPenalty(stress, action, cfg)` (only if `cfg` is given). With `cfg` null the
   score is exactly as now, so `tests/save.test.js` keeps passing unchanged.
5. **Why trace:** add `stress` (rounded), `mood` (the factor, 2 decimals, only when not 1) and
   `penalty` (only when above 0) to `why`; `interrupted` as above.

`createWorld({ …, wellbeing = null, couplings = null })`: after `setupMoney`, if both are given,
call `setupWellbeing(world, wellbeing, couplings)`. If only one is given, throw a clear error.

#### Step 5. Save format version 4 (`src/sim/save.js`)
- `SAVE_VERSION = 4`; `READABLE_VERSIONS = [1, 2, 3, 4]`.
- `toSave` adds per person `rateTimes`, `sleptMinutes`, `sleepWindowStart`, `noInterruptBefore`, and
  top-level `couplings: { fired }` (the rules come from data, not the save). Stocks are already
  saved whole, so `stress.*` and `sleepdebt.*` (with `target`, `pushes`, `base`) come for free.
- `fromSave(save, data)` takes `wellbeing` and `couplings` in `data` too and passes them to
  `createWorld`. **Careful:** for version 3 the loader replaces `world.stocks` with the saved money
  stocks, which would throw away the new stress stocks. For versions below 4, merge instead:
  `world.stocks = { ...world.stocks, ...clone(save.stocks) }` (the new stocks from `setupWellbeing`
  stay, at base stress and zero debt); people keep the defaults from `setupWellbeing`
  (`sleepWindowStart` = the save's time, so the first sleep check is skipped).
- For version 4: restore everything saved, as for the other fields.

#### Step 6. Panel, face and page (watch only)
- `src/main.js`: add `'wellbeing.json'` and `'couplings.json'` to the list it fetches, and pass
  them in `data` (they flow into `createWorld` and `fromSave`).
- `src/ui/panel.js`, under each person's need bars: one line
  `Stress 23 (calm) · Sleep debt 0.0 h`, with a small bar for stress coloured like the need bars
  but reversed (green under 30, amber under 60, red from 60). Only when the stock exists.
  `whyText` adds `mood ×0.88` when `why.mood` is set, `stress penalty −1.5` when `why.penalty` is set,
  and starts with `Stopped <action> (<need> <value>) · ` when `why.interrupted` is set.
- `src/render/people.js`: `mood(needs, stress = 0)` returns `'uneasy'` when `stress >= 60`, before
  the other rules; the caller passes `world.stocks['stress.<id>']?.value ?? 0`. **This is a visual
  change:** follow HOUSE_VIEW's screenshot steps (every floor, phone size, landscape and portrait)
  even though, with today's numbers, stress never reaches 60 (a test covers the rule).

#### Step 7. Replay harness (`tools/replay/`, `data/replay.json`)
- `tools/replay/load.js`: also load `wellbeing.json` and `couplings.json` (inside `data`).
- `data/replay.json`: remove the `notYet` line for L4; add
  `"wellbeing": { "high": 60, "warnInterruptsPerDay": 6 }` (tuning).
- New probe **wellbeing** (`since: 'L4'`) in `probes.js`, added to `DEFAULT_PROBES` after `needs`:
  - `minute`: for each person, read `stress.<id>` and `sleepdebt.<id>`; keep sum, count, min, max,
    and minutes with stress ≥ `high`. Count interruption lines: the person's new log lines (same
    way as the log probe) starting with `world.wellbeing.interrupt.logPrefix`.
  - `day` (at 23:59): read new ledger entries of both stocks exactly as the money probe does (last
    `t` seen), keep their sum for reconciling, and run `checkLedgerComplete` on them; for each new
    `Drift` entry run the new `checkLagNoOvershoot` (below).
  - `year` / `end`: per person `stress { start, end, min, mean, max, minutesHigh }`,
    `sleepDebt { mean, max, daysAbove4 }` (end-of-day values), `interruptions`, and the coupling
    counts: the difference in `world.couplings.fired` (per rule; every rule listed, 0 when it never
    held).
- New invariants in `checks.js` (add the ids to `INVARIANTS`):
  - `stressInRange`: every stress value seen is within 0..100; `sleepDebtInRange`: within 0..24.
  - `wellbeingReconciles`: for each stress and sleep-debt stock, `end − start` equals the captured
    ledger sum to 0.01 (reuse the shape of `checkReconciles`).
  - `lagNoOvershoot({ stock, t, before, amount, target })`: the move has the sign of
    `target − before` and `|amount| ≤ |target − before| + 0.005`.
- New warnings in `runMany` (all expected with today's game, so say "expected until …"):
  - no interruptions in any seed → *"No interruptions: no need fell under 10 (expected until obligations and children exist, L6/L7)."*
  - every seed's sleep-debt max is 0 → *"Sleep debt stayed at 0: sleep is never cut short yet (expected until L6/L7)."*
  - each coupling rule that never held in any seed → one line *"Coupling never held: lowBalance, overdrawn, sleepDebt, highStress (expected until money trouble and broken sleep exist)."*
  - any seed with more than `warnInterruptsPerDay` interruptions per game day on average →
    *"Seed N: X interruptions a day: check for actions stopping and starting in a loop."* (this one
    would be a bug, not expected).
- `across` gains `stressMeanRange: [lowest seed mean, highest seed mean]` (Sarah only for now).
- `summary.js`: one new line after "Seeds:":
  `Stress (Sarah): seed means 6.1–34.8; highest 36.2; sleep debt max 0.0 h; interruptions 0`
  (figures here are an example of the layout, not expected values).

#### Step 8. Tests
Keep each new file under about 5 seconds. Build worlds **with** `wellbeing` and `couplings` (load
them like the other data files). Tests may set needs or stock values directly to force a
condition (tests are not the harness; the harness rule "read only" is unchanged).

`tests/stocks.test.js` (add):
1. A lagged stock with half-life 24 h, value 0, target 100: after 24 calls of `stepStocks(world, 1)`
   it is 50 ± 0.5; it never passes 100 over 500 calls; each call writes one `Drift` entry with
   `ref.target` and `ref.before`; once the move rounds to 0 no entry is written.
2. `setTarget` clamps to `min`..`max` and stores `pushes`.

`tests/wellbeing.test.js` (new):
3. **Setup:** a world with the new data gives Sarah `stress.sarah` = `baseStress` (check the formula
   for anxious 0, 5 and 10: 5, 20, 35) and `sleepdebt.sarah` = 0. A world **without** them has no
   such stocks and `world.couplings` is undefined.
4. **Low needs push stress, slowly:** set every need to 80, then bladder to 20 and hunger to 22,
   and step to the next hh:00 (the needs drop a little on the way; none of the others reaches 25):
   `pushes.lowNeeds` is 10, the target is base + 10, `couplings.fired.lowNeeds` went up by 1, and the
   value moved by `cents(10 × (1 − 0.5 ** (1/48)))` (about 0.14), not 10. Set the needs back to 80:
   at the next hh:00 the push is gone and the value drifts back down.
5. **Money pushes adults:** `change(world, 'acct.joint', −2400, 'test')` (balance under £200):
   at the next hh:00 `pushes.lowBalance` is 20 for Sarah (adult). Go past £0 into the overdraft:
   `overdrawn` adds 15 too.
6. **Rate multipliers:** set `sleepdebt.sarah` to 7 via `change()`; after the next hh:00
   `person.rateTimes` is `{ fun: 1.4, energy: 1.2 }`; over the following 60 minutes (while awake and
   not doing a fun or energy action — force an activity of washing up) fun drops 1.4 × as far as in a
   control world.
7. **Sleep debt:** the first check after a new game is skipped (debt stays 0). Then with
   `sleptMinutes` = 300 at the next check: debt +3. With `sleptMinutes` = 720 the next day: −2
   at most (repay cap), never under 0. Check the ledger reason `Sleep` and `ref.slept`.
8. **Mood and penalty:** `scoreAction(sarah, tv, 20, 0, cfg)` equals the old score;
   at stress 100 it is half. `dishes` at stress 40 is unchanged; at stress 100 it loses
   `0.1 × 50 = 5`. Without `cfg`, stress makes no difference.
9. **Interruption:** put Sarah in `read` (phase `do`) with bladder 8: after one `step` her new
   activity is `toilet`, the log has "Stopped reading in the armchair: bladder too low (8)", and
   `why.interrupted` is `{ action: 'read', need: 'bladder', value: 8 }`.
10. **Not while asleep, not twice:** in `sleep` with bladder 5 → not interrupted. After the
    interruption in test 9, stepping 10 more minutes gives no second "Stopped" line.
11. **Nothing fills the need:** in a world whose actions list has no `toilet`, bladder 8 while
    reading → no interruption, `noInterruptBefore` = now + 30, and no random number was drawn
    (compare `world.rng.getState()` before and after).
12. **Same seed, same day** with the new data: two runs of seed 3 for two game days give equal logs,
    needs and stocks.
13. **Save version 4:** a world with wellbeing saved after 2,000 minutes and loaded carries on equal
    to the live world for 3,000 more (stocks, people, couplings.fired, log). A version 3 save (built
    by deleting the new fields and setting `version: 3`) loads, keeps its money, and gets stress at
    base and sleep debt 0.
14. **Face:** `mood(needs, 60)` is `'uneasy'` with every need at 90; `mood(needs, 59)` follows the
    needs as before.

`tests/replay.test.js` (add):
15. Seeds 1 and 2, one year: every invariant passes, including the four new ones; the joint account
    still ends at **£19,862.96** (money does not depend on stress); each seed's stress `mean` is
    within ±6 of its base (it rests at base, plus the occasional low-bladder push).
16. `checkLagNoOvershoot` and `checkStressInRange` fail on hand-made bad input with a useful detail.

All old tests must pass **unchanged** (they build worlds without the new data). If an old test
fails, the opt-in rule (rule 3) was broken: fix the code, not the test.

#### Step 9. Check and docs
1. `npm test`: everything passes.
2. `node tools/replay.js --seeds 20 --years 10`. **Expected:** all invariants pass (now 11 per
   seed); warnings: same money, no turning points, no interruptions, sleep debt stayed at 0,
   couplings never held (sleepDebt, lowBalance, overdrawn, highStress). `lowNeeds` should hold
   for a few hours a year in most seeds (bladder dips to about 24). Stress seed means spread
   roughly 5–35 with the anxious trait. If anything else shows up (for example interruptions, or
   stress far from base), stop and tell the user before changing code. Note the run time (it was
   70 s; the hourly work should add little).
3. Open the page (`python3 -m http.server 8000`, `?fresh=1`): the panel shows the stress line;
   the why line shows `mood ×…` on fun choices. Screenshots as in HOUSE_VIEW (the face change).
4. Docs (CLAUDE.md "After every change"): STATUS (what was built, the summary's first lines, the
   "dormant until L6/L7" note), DECISIONS (anything decided while building), ROADMAP (tick L4),
   ARCHITECTURE (`src/sim/wellbeing.js`, `data/wellbeing.json`, `data/couplings.json`, save v4,
   `tests/wellbeing.test.js`), SIMULATION section 0 (stress, couplings, sleep debt, interruptions,
   the new score formula), this section's heading to "built" with an "As built" note, and the
   STATUS known issue "Actions are never interrupted" replaced.
5. Commit and push to `main` (no branches), then copy the changed docs to the Project.

#### What this step does not do
No obligations (L6), no beliefs (L5), no other family members (L7), no change to money flows (the
family does not spend less when stressed: that is behaviour for L5/L8), no stress turning points in
the harness (turning points stay money-only until a stress shock exists), no thought bubbles.

---

## 5. Households: shared money and invisible work (with Phase 2)

Build alongside Tom joining (ROADMAP Phase 2).

### 5a. Who controls the money
`world.household = { accounts: ["acct.joint", "acct.tom", "acct.sarah"], control: { "acct.joint": ["tom","sarah"] }, pooling: 0.8 }`.
`pooling` = share of each wage that goes to the joint account. Control is **not** the same as
contribution: Sarah has no wage but controls the joint account with Tom. Who can spend from
which account is a rule in data, and a source of tension later.

### 5b. Invisible labour ledger (`data/labour.json`)
Tag actions with the kind of household work they are:
```json
{ "cook": "food", "wash_up": "cleaning", "laundry": "cleaning", "feedRuby": "childcare",
  "schoolRun": "childcare", "payBills": "admin", "rememberBirthday": "remembering", "comfortChild": "emotional" }
```
Every minute spent on a tagged action is credited in `household.labour[person][kind]`, a
rolling 7-game-day window. Some work is invisible and has no furniture: **remembering**
(birthdays, appointments: credited when someone acts on a calendar item before it's due) and
**emotional** (comforting a child or a stressed partner).

Each adult has a **felt fairness**: their share of the last week's labour compared with what
they think is fair (a personality slider plus their belief about the other's work, which can be
wrong: people under-count others' invisible work by default, say 30%, `tuning: true`). The gap
raises `tension.<pair>` slowly. Arguments (Phase 2 conversations) become more likely as tension
rises, and a quarrel can be *about* the biggest gap kind ("the washing up again").

### 5c. Household bargaining
When a household choice comes up (who does the school run, a big purchase, whether Sarah
takes a job), each adult scores the options for themselves; the weight of each adult's score
is their **bargaining power** = f(income share, control of accounts, outside options,
personality). The pick is weighted-random by combined score. Log who "won" in the why trace.
Keep this to a few named household decisions in `data/householdDecisions.json`; don't let it
grow into a general system until it's needed.

Tests: a week where Sarah does 90% of the labour raises tension; a week split evenly does
not; Tom's belief about Sarah's labour is lower than the truth by the bias.

---

## 6. Children as agents and the life course (Phases 2 and 5)

### 6a. Needs that ramp with age (`data/agecurves.json`)
Needs rates and abilities depend on age through curves, not fixed stages:
```json
{ "needRateTimes": { "energy": [[1, 1.8], [5, 1.3], [12, 1.0], [70, 1.2]] },
  "abilities": { "cook": 12, "walkAlone": 9, "beLeftAlone": 12, "useToilet": 3 } }
```
Read a curve by straight-line interpolation between points. Ruby (1) needs a carer for most
actions: an action for Ruby can only start if a carer starts a linked care action (Phase 2
childcare). Children demand attention: `attention.<child>` drains and is refilled by time
with a parent; low attention pushes a child towards attention-seeking actions (crying, mess).

### 6b. Slow outcomes
Each child has lagged stocks with **very long half-lives** (game months to years):
`wellbeing.<child>`, `school.<child>` (grades), `confidence.<child>`. Their targets are set
each game day from household stress, time with parents, sleep and money. Because the
half-life is long, a hard year shows up in the child a year later. This is the
"parenthood feels like this" effect: don't shorten the half-lives to make it visible faster.

### 6c. Life stages as gates (`data/lifecourse.json`)
Each stage change is a **gate** with requirements, a queue and an exit cost:
```json
{ "id": "secondarySchool", "age": 11, "requires": [], "queue": "admissions", "choice": "nearestWithPlace" },
{ "id": "firstJob", "minAge": 16, "requires": ["credential:any"], "via": "labourMarket" },
{ "id": "moveOut", "minAge": 18, "requires": ["income>rentShare"], "exitCost": { "weakTies": 0.6 } }
```
Gates are checked once per game day. Nothing passes a gate just because of age; age only
opens it.

### 6d. Relative timing and cohorts
Each adult has a **reference schedule** (`data/lifecourse.json`, `expectedAges`: own home 32,
first child 31, etc., tuning) and a reference group (friends in the contacts graph, section 8).
Being behind the group's median by more than 2 years pushes `stress` and lowers
`satisfaction`. Record the **entry cohort**: the economy value in the year a person took their
first job (section 9). It permanently scales their wage growth and risk appetite (a "scar").

---

## 7. Positions, not jobs (Phase 3)

### Data (`data/firms.json`, `data/positions.json`)
```json
{ "firms": [ { "id": "acmeSoft", "sector": "software", "revenue": 1.0, "headcount": 120,
               "budgetGrowth": 0.03, "exposure": { "rates": 0.6, "consumer": 0.3 } } ] }
{ "positions": [ { "id": "acmeSoft.se2", "firm": "acmeSoft", "title": "Software engineer",
                   "pay": 75000, "hours": 37.5, "rigidity": 0.3, "remote": true,
                   "autonomy": 0.7, "toll": 0.2, "status": 0.7, "redundancyRisk": 0.05,
                   "holder": "tom", "since": "2023-05-01" } ] }
```
- **Rigidity** (0–1) is the key number: how much the hours can move. The brain may move a
  work block by up to `(1 − rigidity) × 3` hours to fit a school run or a sick child.
  High rigidity is what makes caring hard.
- The firm is an off-screen agent stepped **once per game day**: revenue follows the economy
  (section 9) times its exposure; if revenue falls behind headcount × pay for long enough,
  it freezes hiring, then cuts hours, then makes redundancies, choosing positions by risk.
- A position outlives its holder. If Tom quits or is let go, the position becomes vacant and
  is refilled by a generated off-screen person (`world.offscreenPeople`), whose life we track
  only in numbers.
- **Promotion** is a scarce slot: a firm has N senior positions; one opens only when its
  holder leaves. Candidates are scored on skill, tenure and network; one wins.
- Tom works from home (FAMILY.md): his work blocks are actions at a desk in the house
  (needs a desk in `house.json`; follow HOUSE_VIEW.md to add one).

### The labour market
`data/labourMarket.json`: vacancy rate by sector (from the economy), credential gates,
time-to-hire distribution, and a **network bonus**: candidates who know someone at the firm
(section 8) are much more likely to hear of the job and to get it. Searching is an action
(off-screen, "Sarah looked at job ads") that costs attention.

Tests: with falling revenue the firm's actions come in order (freeze → hours → redundancy);
a vacated position is refilled; two candidates for one promotion slot can't both win.

---

## 8. Places, people met by chance, and the life radius (Phase 3)

### Places (`data/places.json`)
Off-screen places with opening hours, cost, and who goes there:
```json
{ "id": "schoolGate", "kind": "school", "opens": [[8.25, 9], [15, 15.5]], "weekdays": [0,1,2,3,4] },
{ "id": "parkLocal", "kind": "park", "opens": [[7, 20]], "weather": "dry" },
{ "id": "shopCorner", "kind": "shop", "opens": [[7, 22]] }
```

### Contacts graph (`world.contacts`)
Every person the family knows: generated off-screen people with a few numbers (age, job
sector, neighbourhood, which places they use). Each tie has `strength` (0–1, decays slowly
without contact: half-life ~3 game months, `tuning`), `kind` (family, friend, colleague,
neighbour, school-parent) and `lastContact`. Weak ties (strength < 0.3) carry **opportunity**
(job news, a cheaper flat, a childminder's number). Strong ties carry **support** (lend money,
take Ruby for an afternoon).

### Encounters (Poisson, rate-based)
When a person is at a place, for each regular there (and a pool of strangers) draw whether
they meet: rate per hour = `base × routineOverlap × placeSociability`. Use
`waitFor(world.rngs.encounters, rate)`. A meeting raises tie strength and may pass
information (belief updates, job leads). Whether a meeting turns into anything depends on the
person's needs, mood and attention: a stressed person says hello and leaves.

### Life radius
`radius.<person>` = the set of places visited in the last 14 game days. When stress is high
or money is short, the brain scores going out lower, so the radius shrinks, so fewer weak
ties are met, so fewer opportunities arrive. **Do not add any rule that fixes this loop**: it
is meant to be there (WORLD_PRINCIPLES design law 4).

### Moving house (later)
Moving keeps strong ties but cuts weak ties tied to the old area (multiply their strength by
`exitCost.weakTies`). This is why people get stuck.

Tests: the same seed gives the same meetings; halving time out roughly halves meetings over
a game month; a shrunk radius leads to fewer job leads over a year (statistical test over
20 seeds).

---

## 9. The economy as three loops (Phase 4)

Do **not** build a macro model. Build three small loops, stepped once per game day, in
`src/sim/economy.js`, with numbers in `data/economy.json`.

1. **Income loop:** `world.economy.demand` (around 1.0) moves slowly towards
   `1 + 0.5 × (confidence − 0.5)`; firm revenue = demand × sector exposure. Confidence falls
   when unemployment in the contacts graph rises and when shocks hit. Momentum: half-life of
   demand ~ 1 game year.
2. **Credit loop:** `world.economy.baseRate` starts at 4% (BoE, 5 Nov 2026, FAMILY.md). It
   moves in steps of 0.25 at most at scheduled decision dates (8 a year, calendar rules), with
   a drift that follows inflation pressure (`tuning`). House prices follow 1 / (rate + margin)
   slowly. The mortgage fix ends spring 2029 (calendar): the new rate = baseRate + margin at
   that date, and the monthly payment is recalculated. That date can become a turning point
   with no script at all.
3. **Shock generator:** a Poisson process (`rate` per game year in data) that emits shocks
   with `reach` (one firm, one sector, the city, the country), `size`, and `duration`.
   Examples: a firm loses a client, an energy price spike, a sector downturn. Each shock moves
   demand, prices or one firm's revenue. **What it does to a person depends on exposure**:
   sector, seniority, tenure, savings buffer, how specific their skills are.

Also: the **energy price cap** changes quarterly (calendar rule `energyCap`); the new value =
old × (1 + drift + shock), and the household's energy flow is updated.

### The cardinal rule
The family never sees economy numbers. They see changes in their own constraints, through
people and places, late: commentary lines like "The corner shop has shut" or "Tom heard two
people were let go on the other team". Write these as templates in `data/text/economy.json`.
The economy numbers can appear in the build-time why view only.

Tests: with no shocks, demand stays near 1 for 10 years; a sector shock raises redundancy
chance only for firms with that sector's exposure; the remortgage recalculates the payment
on the right date.

---

## 10. Institutions as agents (Phase 4)

`data/institutions.json`:
```json
{ "id": "gp", "kind": "health", "queue": { "meanDays": 14, "sdDays": 7 },
  "errorBase": 0.05, "errorChaos": 0.25, "failure": ["lost referral", "wrong letter", "not believed"] },
{ "id": "council", "kind": "tax", "queue": { "meanDays": 30, "sdDays": 15 }, "errorBase": 0.03, "errorChaos": 0.2 },
{ "id": "bank", "kind": "lending", "rules": { "maxLoanToIncome": 4.5 }, "errorBase": 0.02, "errorChaos": 0.1 }
```
An institution is a **filter**: a request goes in (a GP appointment, a remortgage, a school
place, a council tax change), waits in a queue (calendar days, drawn from the distribution),
then is decided. The chance it goes wrong is
`errorBase + errorChaos × household.chaos`, where `household.chaos` (0–1) is worked out
daily from missed obligations, low sleep, unpaid bills and moves. So it fails most when life
is already hard. A wrong result creates follow-up work (phone calls, letters: labour of kind
`admin`) and stress. **Eligibility cliffs:** a rule like "help only if income < £X" is a hard
edge, so £1 over means no help. Put these in data.

Tests: a calm household gets fewer errors over 100 requests than a chaotic one (seeded);
queue times match the distribution.

---

## 11. Holidays, rituals and anniversaries (Phase 4)

A holiday is a **dated obligation**, not an event. `data/holidays.json`:
```json
{ "id": "christmas", "date": "12-25", "leadDays": 30, "costs": { "gifts": 400, "food": 120, "travel": 60 },
  "copresence": ["grandparents", "aunt"], "script": { "mood": 70, "together": true } }
```
- In the lead days the household gets prep obligations (gift shopping, food, travel plans):
  more labour, mostly `remembering` and `admin`, and costs on the account.
- **Gift ledger:** who gave whom what, last time. Giving much less than you got raises
  tension with that relative.
- **Co-presence:** the people listed come to the house (on-screen, as visitors) or the family
  goes to them (off-screen). Unresolved tension between people present raises the chance of
  conflict that day.
- **Script vs reality:** the day has an expected mood (`script.mood`). The gap between the
  household's real average mood and the script sets the emotion of the day ("it wasn't the
  Christmas she'd hoped for"). That gap is where the feeling lives.
- Which holidays the family keeps is a family fact: ask the user, then record in FAMILY.md.
  Don't assume.

**Anniversaries:** any memory marked important (a death, a wedding, a job loss) gets a
yearly date. On it, the related emotion spikes back to `spike × decay^years` and fades over a
day or two. It never quite reaches zero.

---

## 12. Health, death and grief (Phase 5)

- `health.<person>`: a lagged stock. Its target declines slowly with age (curve in
  `data/agecurves.json`) and is pushed down by long stress, sleep debt and hard physical work
  (position `toll`), and up by rest and exercise. **Shocks:** illnesses arrive as a Poisson
  process whose rate rises with age, stress and season (flu in winter). Each illness has a
  duration, a `cantWork` flag, and a care need.
- **Access:** seeing a doctor goes through the GP institution (queue + error). Taking a day
  off depends on the position (rigidity, sick pay).
- **Cascades** are just couplings (section 3b): illness → no work → less money → stress →
  smaller radius.
- **Death:** each person (including off-screen relatives) faces a yearly hazard by age and
  health, from the ONS National Life Tables (look up, cite the edition in `data/agecurves.json`,
  and scale by health). Draw once per game day with the probability converted to the
  calendar span of that day. No plot beats.
- **Grief:** a stock per bereaved person, pushed to a level by closeness to the dead person,
  with a long half-life, plus anniversary spikes. While high: lower energy and fun, smaller
  radius, more crying actions.
- **Estate:** a ledger to settle (debts, house, belongings) that creates months of `admin`
  labour and institution contact.
- The family needs off-screen relatives for this to mean anything (grandparents first). Add
  them to `data/people.json` with `"offscreen": true` once the user picks who they are.

---

## 13. Culture, status and reputation (later)

Keep this small:
- Each person has `status` per domain (`work`, `school-gate`, `family`), not one number.
- Norms are local: `data/norms.json` lists a few norms per group (school parents: on time,
  dressed; family: Sunday visits). Breaking one costs disapproval (tension with the group's
  ties) only if someone in that group sees it or hears of it (beliefs again).
- Reputation spreads along the contacts graph: an observed event passes to ties with
  probability by tie strength, a few hops at most.

---

## 14. Commentary: how off-screen life is shown

Everything off-screen reaches the player as text, from templates in `data/text/*.json`:
```json
{ "redundancyNews": ["{name} heard {count} people at {firm} were let go.", "{name} came home quiet: cuts at work."] }
```
- Pick lines with the commentary random stream. Never the same line twice in a row.
- Only write lines for things a person in the family **could know**: things they saw, were
  told, or got a letter about. Not world numbers.
- Lines go into `world.log` with `who` and a `kind` so the panel can filter.

---

## 15. "How you know it works": the replay harness

Build this early (straight after section 3) and run it after every step.

`tools/replay.js` (Node, no browser): creates a world for seeds 1..N, runs it headless for
Y game years (fast mode: off-screen daily stepping; people inside step every minute, or a
coarse daily mode once that exists), and writes `replay-report.json` + a short text summary:
- address history, income per calendar year, savings, mortgage balance,
- stress and health curves per adult,
- contacts graph size by year (ties gained, lost, reactivated),
- every **turning point**: a day where a big stock moved a lot (job, money, health,
  relationship), with the three biggest contributing causes from the ledgers.

Checks (`tests/replay.test.js`, run with a small N and Y so tests stay quick):
- Different seeds give clearly different lives (income curves differ; not all the same shape).
- Income has jumps, gaps or plateaus in at least some seeds; it is not a straight line.
- Health tracks stress and money (correlation above zero across seeds).
- Turning points usually have **more than one** big cause. If almost every turning point has
  a single cause, the world is still a stage: report it as a warning.

Run it with `node tools/replay.js --seeds 20 --years 10` and put a line in `docs/STATUS.md`
with the results after each step.

### 15a. L3 build brief (approved 2026-11-11; built 2026-11-11)

**As built.** Steps 1 to 8 are done, with the files in Step 2 (`tools/replay.js` and `tools/replay/`, `data/replay.json`, `tests/replay.test.js`; `replay-out/` is git-ignored). No change to `src/sim/`. Choices the brief left open are in DECISIONS (2026-11-11): what `actionsDistinct` counts and when the warnings fire; the run gives each seed its own copy of the data and leaves run time to the command line. Result on 20 seeds × 10 game years: all seven invariants pass, the two expected warnings (same money; no turning points), about 70 s. The 8 new tests and the 112 old ones pass (120).

This is the exact plan for step L3. It is written so another model can build it without the
chat history. Where this brief and the general text of section 15 differ, **this brief wins**:
section 15 lists checks for systems that do not exist yet (stress, health, contacts, moving
house), and L3 builds only what can be measured now.

**Words used here.**
- *Headless*: run with no screen and no browser, in Node, from the command line.
- *Seed*: the number that starts the random numbers. Same seed, same life (CLAUDE.md rule).
- *Harness*: the program that creates worlds, runs them, watches them and writes a report.
  It never changes what the family does.
- *Probe*: one small watcher inside the harness (money, needs, actions...). Each probe adds one
  block to the report. Later steps add probes; that is how the harness grows.
- *Invariant*: a rule that must always be true (a balance is never `NaN`). If one fails, the
  run fails.
- *Warning*: something worth a human look that is not a bug (every seed has the same money).
- *Turning point*: a game day on which a stock moved much more than usual (section 15).

#### What exists now (checked 2026-11-11, so the brief matches the code)
- `createWorld({ house, actions, needs, people, calendar, money, seed, time })` in
  `src/sim/world.js`; `time` defaults to 07:00 (420). `step(world)` moves one game minute.
  `money` is `{ stocks, tax, flows }` from `data/stocks.json`, `data/tax.json`, `data/flows.json`.
  `tests/household.test.js` shows how to load every data file in Node (`readFileSync` + `new URL`).
- One headless game year (28 × 1440 steps) takes about **0.55 s** in the build sandbox. So
  `--seeds 20 --years 10` takes about two minutes. That is fine for the tool; tests stay small.
- `world.log` keeps only the last **50** lines (`LOG_LENGTH` in `world.js`); a game day already
  writes up to about 42 (measured, seed 1), and Tom and the children (L7) will push it past 50.
  **The harness must read new log lines after every step**: the lines added by a
  step are the entries at the end of `world.log` whose `time === world.time`.
- Each stock keeps its last `ledgerKeep` (60) entries `{ t, amount, reason, ref }` and rolls older
  ones into `ledgerTotals`. The harness reads new ledger entries (`t` greater than the last one it
  saw) once per game day. A game day writes up to 11 entries to the joint account (measured), so 60 is
  enough, but the harness must check it (invariant `ledgerComplete` below).
- `world.calendar.fired[ruleId]` counts every firing. `matches(rule, date)`, `dateAt(index, start)`,
  `calendarSpan(gameDay)` and `formatDate(d)` are exported from `src/sim/calendar.js`.
- Money uses **no** random numbers, so every seed has identical money. Only Sarah's personality
  (rolled from `subRng(seed, 'personality:sarah')`) and her choices (`world.rng`) differ by seed.
  The report must say this plainly (a warning), not hide it.
- **Money moves in a saw-tooth.** A game day covers about 13 calendar days, so Tom's pay (the
  28th) lands on roughly every other game day: the joint account's daily change swings between
  about +£2,200 to +£3,700 and −£650 to −£2,600 (seed 1, year 1; median size about £2,180). This is
  correct, not a bug. With the thresholds below, **L2 money gives no turning points at all**; that
  is expected until shocks and job changes exist.
- Sarah is the only person. `person.needs` holds six needs from 0 to 100. `person.activity` is
  `null` or `{ action, item, ... }`; a new object means she started something new.

#### Rules for this step
1. **Read only.** The harness never changes `world`, never calls `change()`, never moves time
   except by calling `step()`. A test checks this (Step 6, test 2).
2. **No change to `src/sim/`.** L3 adds no game behaviour. If the harness finds a bug in the
   sim, stop, record it in DECISIONS and STATUS, and ask the user before fixing it.
3. **No random numbers in the harness**, not even seeded ones. `Math.random()` is banned anyway.
4. **Thresholds live in `data/replay.json`**, labelled `"tuning": true`, not in code.
5. **Output files are not committed.** They go in `replay-out/` (add it to `.gitignore`).
6. Plain Node ES modules, no packages to install (the sandbox has no network for npm).

#### Step 1. `data/replay.json`
```json
{
  "about": "Settings for the replay harness (tools/replay.js, LIFE_SYSTEMS 15a). All thresholds are tuning.",
  "tuning": true,
  "moneyStocks": ["acct.joint", "acct.savings", "debt.overdraft", "debt.mortgage"],
  "turningPoints": {
    "minChange": 1000,
    "timesMedian": 3,
    "bigCauseShare": 0.25,
    "maxCauses": 3,
    "warnSingleCauseShare": 0.8
  },
  "unpaidPrefix": "Could not pay",
  "notYet": [
    { "what": "stress and sleep debt per adult", "step": "L4" },
    { "what": "beliefs against the truth", "step": "L5" },
    { "what": "other family members", "step": "L7" },
    { "what": "income with jumps or gaps (job changes)", "step": "L9" },
    { "what": "contacts graph size by year", "step": "L10" },
    { "what": "price changes and the 2029 remortgage", "step": "L11" },
    { "what": "health curves and deaths", "step": "L15" },
    { "what": "address history (moving house)", "step": "later" }
  ]
}
```
- `minChange` (£) and `timesMedian`: a game day is a turning point for a stock when its net
  change is at least `minChange` **and** at least `timesMedian` × the median size of that stock's
  daily change over the run.
- `bigCauseShare`: a cause counts as *big* when it is at least this share of the day's total
  movement for that stock (the sum of the sizes of every entry that day).
- When a later step adds a probe, it removes its line from `notYet`.

#### Step 2. Files
```
tools/replay.js            CLI only: reads arguments, loads data, runs seeds, writes files, sets the exit code
tools/replay/load.js       loadData(rootDir) -> { house, actions, needs, people, calendar, money, replay } (uses fs)
tools/replay/run.js        runSeed(data, opts) and runMany(data, opts): pure, no fs
tools/replay/probes.js     the probes (DEFAULT_PROBES), each a plain object
tools/replay/checks.js     the invariants, each a pure function
tools/replay/turning.js    findTurningPoints(...): pure
tools/replay/summary.js    textSummary(report) -> string
tests/replay.test.js       the tests in Step 6
```
Put a comment block at the top of each file saying what it does and which section of this brief
it follows.

#### Step 3. The run (`tools/replay/run.js`)
```js
export function runSeed(data, { seed, years, probes = DEFAULT_PROBES, daily = false })  // -> seed report
export function runMany(data, { seeds, years, from = 1, daily = false })               // -> whole report
```
`runSeed`:
1. `world = createWorld({ ...data, seed })` (start 07:00 on 1 March 2026, the game's default).
2. `ctx = { seed, years, cfg: data.replay, startTime: world.time, probe: {} }`; each probe gets its
   own `ctx.probe[id]` object to keep its notes in.
3. Call every probe's `start(world, ctx)`.
4. Step until `world.time === years × MINUTES_PER_YEAR − 1` (23:59 on the last game day; import
   `MINUTES_PER_YEAR` and `MINUTES_PER_DAY` from `src/sim/clock.js`). After **each** step call every
   probe's `minute(world, ctx)` if it has one. When `world.time % MINUTES_PER_DAY === MINUTES_PER_DAY − 1`
   (23:59) call `day(world, ctx, gameDay)` with `gameDay = Math.floor(world.time / MINUTES_PER_DAY)`
   (0 = the first game day). When that game day is the last of a game year (`(gameDay + 1) % 28 === 0`)
   call `year(world, ctx, yearIndex)` and keep what it returns.
5. Call `end(world, ctx)` on every probe and keep what it returns.
6. Run the invariants (Step 4) and the turning points (Step 5).
7. Return:
```json
{
  "seed": 1, "years": 1,
  "dates": { "from": "1 Mar 2026", "to": "28 Feb 2027" },
  "personality": { "sarah": { "outgoing": 4, "tidy": 7, "active": 3, "kind": 6, "anxious": 5 } },
  "yearly": [ { "year": 1, "dates": { "from": "...", "to": "..." }, "money": {...}, "calendar": {...}, "needs": {...}, "actions": {...}, "log": {...} } ],
  "run": { "money": {...}, "calendar": {...}, "needs": {...}, "actions": {...}, "log": {...} },
  "turningPoints": [ ... ],
  "invariants": [ { "id": "finite", "ok": true, "detail": "" } ],
  "warnings": [ "..." ],
  "notYet": [ ... copied from data/replay.json ... ],
  "daily": null
}
```
`daily` holds each money stock's end-of-day value per game day only when `daily: true`
(`--daily` on the command line); otherwise `null`, to keep the file small.

`runMany` runs `runSeed` for `from … from + seeds − 1`, then compares the seeds:
```json
{
  "generatedBy": "tools/replay.js", "reportVersion": 1,
  "args": { "seeds": 20, "years": 10, "from": 1 },
  "seconds": 112.4,
  "seeds": [ ...seed reports... ],
  "across": {
    "moneyIdentical": true,
    "actionsDistinct": 17,
    "singleCauseShare": null,
    "turningPoints": 0
  },
  "warnings": [ "..." ],
  "ok": true
}
```
- `moneyIdentical`: every seed's end-of-run money balances are equal to the penny. When true, add
  the warning *"Every seed has the same money: nothing random touches money yet (expected until L9/L11)."*
- `actionsDistinct`: how many seeds have a different action-count table from every other seed.
  If it is 1 with more than one seed, warn *"Every seed lived the same day: the seed has no effect."*
- `singleCauseShare`: the share of all turning points that have exactly one big cause, or `null`
  when there are none. When there are none, warn *"No turning points: money follows the same
  pattern every month (expected until shocks and job changes exist)."* If it is at least
  `warnSingleCauseShare`, warn *"Most turning points have a single cause: the world is still a
  stage (section 15)."* Either warning is **expected** with L2 money; they are the reason later steps exist.
- `ok` is false if any invariant failed in any seed.
- `seconds` is measured with `performance.now()` in the CLI and passed in, so `runMany` stays pure
  and its report is identical between two runs except for `seconds`. (Tests compare reports with
  `seconds` removed.)

#### Step 4. Probes (`tools/replay/probes.js`)
A probe is a plain object:
```js
{
  id: 'money',           // the key of its block in "yearly" and "run"
  since: 'L3',           // the step that added it
  start(world, ctx) {},  // optional: before the first step
  minute(world, ctx) {}, // optional: after every step; keep it cheap
  day(world, ctx, gameDay) {},      // optional: at 23:59 of each game day
  year(world, ctx, yearIndex) {},   // optional: returns this year's block
  end(world, ctx) {},               // optional: returns the run block
}
```
`DEFAULT_PROBES = [money, calendar, needs, actions, log]`. Build these five:

1. **money** (reads `world.stocks` only).
   - `start`: record each money stock's value, and the newest ledger `t` per stock (or −1).
   - `day`: for each money stock, take the ledger entries with `t` greater than the last seen
     `t`, add them to this day's list (keep `{ t, amount, reason }`), remember the newest `t`, and
     record the end-of-day value. Keep, per game day and stock: `net` (sum of amounts), `gross`
     (sum of absolute amounts) and the entries grouped by `reason` (sum per reason). These feed
     the turning points.
   - `year`: per stock, `start`, `end`, `in` (object: reason → total of positive amounts),
     `out` (reason → total of negative amounts), all to the penny (`Math.round(x * 100) / 100`).
   - `end`: per stock `start` and `end` for the whole run, and the lowest end-of-day value of
     `acct.joint` with its date.
2. **calendar**: `year` returns how many times each rule fired that year (the difference in
   `world.calendar.fired` since the previous year); `end` returns the totals.
3. **needs**: `minute` adds each need of each person to a running sum and keeps the minimum;
   `year` returns per person and need `{ min, mean }` (mean to one decimal place) and the number of
   game minutes any need was below 10 (`lowMinutes`); `end` the same for the run.
4. **actions**: `minute` notes, per person, when `person.activity` is a different object from the
   one seen the minute before and is not `null`; it counts `activity.action.id`. `year` returns
   per person the counts (sorted by count, highest first) and `end` the totals.
5. **log**: `minute` reads the lines added this step (the entries at the end of `world.log` with
   `time === world.time`); it counts lines per `who`, and counts House lines starting with
   `cfg.unpaidPrefix` (unpaid bills), keeping the first five such lines with their date. `year` and
   `end` return the counts.

Dates: a single date for a game time is `formatDate(calendarDate(time, world.calendar.start))`
(the first calendar date of that game day); a game day's range is
`gameDayDates(time, world.calendar.start)` ("27 Mar 2026 – 8 Apr 2026", the clock's own text). The
last date of a run or year is `formatDate(dateAt(calendarSpan(lastGameDay)[1], start))`. All four
helpers are exported from `src/sim/calendar.js`; do not write new date arithmetic.

#### Step 5. Invariants and turning points
`tools/replay/checks.js` exports one pure function per invariant. Each takes the plain numbers it
needs (not the world) and returns `{ id, ok, detail }`, so a test can feed it bad numbers.
1. `finite`: every money stock's end-of-day value is a finite number (no `NaN`, no `Infinity`).
2. `limits`: every money stock stays within its `min` and `max` from `data/stocks.json` (a `null`
   max means no ceiling) at every end of day.
3. `reconciles`: for each money stock, `end − start` equals the sum of every ledger entry the
   money probe captured, to the penny. This proves the engine and the capture agree.
4. `ledgerComplete`: on no day did a stock's ledger drop an entry the probe had not yet read
   (the oldest entry still in the ledger is older than, or equal to, the newest entry already
   read, or the ledger is shorter than `ledgerKeep`). If it fails, say which stock and day.
5. `mortgageFalls`: `debt.mortgage` never rises from one day to the next (true while the rate is
   fixed; L11 changes this check when remortgaging arrives).
6. `calendarExact`: each rule fired exactly as many times as there are matching dates in the
   run, worked out independently: walk every calendar-day index from the first game day's span to
   the last game day's span (`calendarSpan`), turn it into a date (`dateAt`) and count
   `matches(rule, date)`; then subtract the rules due on the first game day whose
   `hour × 60` is before the start time (a game started at 07:00 does not fire the 06:00
   mortgage). The harness count must equal `world.calendar.fired[rule.id]` for every rule.
7. `needsInRange`: every need stays between 0 and 100.

`tools/replay/turning.js`:
```js
export function findTurningPoints(days, cfg)
// days: [{ gameDay, date, stock, net, gross, byReason: { reason: amount } }]  (from the money probe)
// -> [{ gameDay, date, stock, change, causes: [{ reason, amount, big }], bigCauses }]
```
For each stock: work out the median of `|net|` over all its days. A day is a turning point when
`|net| ≥ cfg.minChange` and `|net| ≥ cfg.timesMedian × median`. Its causes are the reasons sorted
by `|amount|`, largest first, at most `cfg.maxCauses`; a cause is `big` when
`|amount| ≥ cfg.bigCauseShare × gross`. `bigCauses` is how many are big. Sort the turning points by
game day, then stock id.

#### Step 6. Tests (`tests/replay.test.js`)
Keep the whole file under about 10 seconds: use one game year and seeds 1 and 2, and build the
two seed reports once at the top of the file for the tests that only read them.
1. **Same seed, same report.** `runSeed(seed 1, 1 year)` twice gives deep-equal reports.
2. **Read only.** Run seed 1 for one game year with the harness, and a second world with plain
   `step()` calls for the same number of minutes. `JSON.stringify` of `stocks`, `people`,
   `calendar.fired` and `log` is the same for both worlds.
3. **Invariants pass** for seeds 1 and 2 (every `ok` is true), and the year's money matches the
   L2 hand sum: joint account ends at **£19,862.96** at 23:59 on the last game day (the figure in
   `tests/household.test.js`; checked: stopping at 23:59 gives the same value). Seed 1, one year,
   has **no** turning points and `singleCauseShare` is `null`.
4. **Each invariant can fail.** Call each function in `checks.js` with a hand-made bad input (a
   `NaN` balance, a value under `min`, a sum £0.01 out, a dropped ledger entry, a mortgage that
   rises, a rule fired once too often, a need of 101) and check `ok` is false with a useful
   `detail`.
5. **Seeds differ where they should.** Seeds 1 and 2: Sarah's personality or action counts differ;
   money is identical, and `runMany` gives `moneyIdentical: true` with the expected warning.
6. **Turning points on made-up numbers.** Feed `findTurningPoints` a hand-made series: 20 quiet
   days of ±£50 and one day of −£2,000 made of −£1,500 "Insurance" and −£500 "Food". It returns
   one point on that day, causes in that order, `bigCauses` 2. A day of −£900 is not a point
   (`minChange`).
7. **Year boundary.** Seed 1 for two game years: `yearly` has two entries, and year 2's `start`
   for every money stock equals year 1's `end`. The `calendarExact` invariant passes across
   1 March 2027.
8. **Command line.** Run `node tools/replay.js --seeds 1 --years 1 --out <a temp folder>` with
   `child_process.execFileSync`: exit code 0, `replay-report.json` and `replay-summary.txt` exist,
   and the JSON parses with `ok: true`.

All old tests must still pass unchanged (Sarah's same-seed day, calendar counts, L2 money).

#### Step 7. The command line (`tools/replay.js`)
```
node tools/replay.js [--seeds 20] [--years 10] [--from 1] [--out replay-out] [--daily] [--quiet]
```
- Defaults: 20 seeds, 10 years, from seed 1, folder `replay-out/`.
- Writes `<out>/replay-report.json` (two-space indents) and `<out>/replay-summary.txt`, and prints
  the summary unless `--quiet`. Prints a progress line per seed to stderr (`seed 3/20 … 5.4 s`).
- Exit code **1** if any invariant failed, **2** for bad arguments (with a usage line), else 0.
  Warnings never change the exit code.
- Wrong or missing arguments: say what was wrong and show the usage line. No other options.

`textSummary(report)` (in `summary.js`) gives at most about 15 lines, for example:
```
Replay: 20 seeds × 10 game years (1 Mar 2026 – 28 Feb 2036), 112 s
Invariants: all passed (7 checks × 20 seeds)
Seed 1 money: joint £2,500.00 → £…; savings £8,000.00 → £…; mortgage £228,302.03 → £…
Unpaid bills: none
Seeds: money identical; Sarah's days differ (17 of 20 seeds distinct)
Turning points: none
Warnings:
- Every seed has the same money: nothing random touches money yet (expected until L9/L11).
- No turning points: money follows the same pattern every month (expected until shocks and job changes exist).
Not measured yet: stress (L4), beliefs (L5), family (L7), job changes (L9), contacts (L10), prices and remortgage (L11), health (L15), moving house (later)
```
The figures above are an example of the layout, not expected values.

#### Step 8. Check and docs
1. `npm test`: everything passes.
2. Run `node tools/replay.js --seeds 20 --years 10`. Read the summary. Expect: all invariants
   pass; the two warnings above (same money, no turning points); no unpaid bills (the family has a surplus of about £1,450 a
   month). If anything else shows up, stop and tell the user before changing code.
3. Note the run time; if 20 × 10 takes more than about 5 minutes, say so in STATUS (a coarse
   daily mode for Sarah is a later step, not L3).
4. Docs (CLAUDE.md "After every change"): STATUS (what was built, the summary's first six lines,
   next step), DECISIONS (anything decided while building, with the reason), ROADMAP (tick L3),
   ARCHITECTURE (the new `tools/replay/` files, `data/replay.json`, `replay-out/` ignored), this
   section's heading to "built" with an "As built" note, and section 16's "What a session on one
   step looks like" item 5 stays as it is (run the harness after every step).
5. Commit and push to `main` (no branches), then copy the changed docs to the Project.

#### What later steps do with the harness
Each later step that adds a system adds one probe (with `since` set to that step), removes its
line from `notYet`, and adds any invariant its system needs (L4: stress stays in range; L11: the
mortgage payment changes only on the remortgage date, and `mortgageFalls` allows that one day).
Then it runs `node tools/replay.js --seeds 20 --years 10` and puts the summary's first lines in
STATUS.

---

## 16. Build order (one session each, ask before coding)

| Step | What | Section | Roadmap phase |
|---|---|---|---|
| L0 | Save/load + random state saveable + random streams (`subRng`) | 1a, ARCHITECTURE save format | 1 |
| L1 | Calendar and two clocks | 2 | 1b |
| L2 | Stock engine + household money, bills, mortgage | 3 | 1b |
| L3 | Replay harness (early, so every later step is checked) | 15 | 1b |
| L4 | Couplings, stress, sleep debt; interruption rule | 3b, 4b | 1b |
| L5 | Beliefs and observations; why trace shows belief vs truth | 4c | 1b |
| L6 | Obligations in the brain | 4a | 2 |
| L7 | Tom, Oliver, Ruby + age curves + childcare | 6a | 2 |
| L8 | Invisible labour ledger, fairness, tension, bargaining | 5 | 2 |
| L9 | Positions, firms, Tom's work blocks, labour market | 7 | 3 |
| L10 | Places, contacts graph, encounters, life radius, commentary | 8, 14 | 3 |
| L11 | Economy loops, energy cap, remortgage 2029 | 9 | 4 |
| L12 | Institutions and household chaos | 10 | 4 |
| L13 | Holidays, gift ledger, co-presence, anniversaries | 11 | 4 |
| L14 | Children's slow outcomes, life gates, relative timing, cohorts | 6b–6d | 5 |
| L15 | Health shocks, mortality, grief, estate, relatives | 12 | 5 |
| L16 | Status, norms, reputation | 13 | 5 |

### What a session on one step looks like
1. Read `CLAUDE.md`, `STATUS.md`, `DECISIONS.md`, this file's sections 1 and the step's section.
2. Tell the user what the step will add and what they will see. Wait for approval.
3. Write the data file(s) first, then the code, then the tests listed in the section.
4. `npm test` — everything must pass, old tests included. If a same-seed test of Sarah's
   day changes, you used `world.rng` in a new system: switch to a sub-stream (1a).
5. `node tools/replay.js` (once it exists) and look at the summary.
6. Open the page (`python3 -m http.server 8000`) and check the new panel line or log lines.
   If anything in the house view changed, follow HOUSE_VIEW.md's screenshot checks.
7. Update STATUS, DECISIONS, ROADMAP, SIMULATION (section 0 "as built"), ARCHITECTURE (file
   list), FAMILY (if money facts changed), and **this file** if the design changed while
   building. Commit and push.

### Common mistakes to avoid
- Writing an event instead of a mechanism ("recession on day 40"). Make the rule instead.
- Making stocks change instantly. Almost everything needs a half-life.
- Letting a person read a true world value. Go through beliefs.
- Stepping off-screen agents every minute. Once per game day.
- Using `world.rng` for a new system and breaking the same-seed tests.
- Putting numbers in code. They go in `data/` with a source or `tuning: true`.
- Forgetting the calendar maps 13 days onto each game day: a "weekly" cost is about two weeks
  of money per game day.
- Adding a fix for a vicious circle (scarcity → smaller radius → more scarcity). Those loops
  are the point.
- Showing world numbers (unemployment, base rate) to the player. Only the why view, at build time.
