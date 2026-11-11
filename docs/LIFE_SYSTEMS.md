# Life systems — how to build the world so lives feel real

This is the build guide for turning `docs/WORLD_PRINCIPLES.md` (the design brief) into code.
It is written so any AI model (or person) can pick up one step, build it, test it and hand
over, without needing the chat history.

**Read first, every time:** `CLAUDE.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, then this
file's section 1 (rules) and the section for the step you are building. Read
`docs/SIMULATION.md` section 0 to see what is already built.

**Status of this plan:** written 2026-11-11. L0 is built (save/load, random streams). L1 is built
(calendar), with the mapping approved by the user on 2026-11-11 and the refinements listed in
the section 2 note below. Each later step must be approved by the user before its code is written
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
