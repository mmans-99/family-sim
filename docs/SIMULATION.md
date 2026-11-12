# Simulation design — how the people "think"

## 0. As built (Phase 1, one adult)
Code: `src/sim/world.js` (people, needs, brain), `src/sim/housemap.js` (walking map).
Data: `data/needs.json`, `data/actions.json`, `data/people.json`, `stairs` in `data/house.json`.
- **One step = one game minute** (`step(world)`). `main.js` runs as many steps as the
  clock says have passed. Only seeded random numbers are used (on each decision), so the
  same seed gives the same day. Tests check this.
- **Needs built so far:** Hunger, Energy, Bladder, Hygiene, Fun, Comfort, 0–100. Each drops
  by `perHour` (adult rates) while awake; asleep, `sleepFactor` scales it (hunger and
  bladder at half, energy not at all). Social waits for Phase 2 (it needs other people).
- **Actions** (`data/actions.json`): each is tied to a furniture name, lasts `minutes`, and
  adds its `gain` to needs a little each minute. `on: sit/lie` draws the person on the
  furniture. `hours` with `offHours` makes things fit the time of day (sleep 10pm–7am).
  Chores have a small `base` score; `cooldown` stops repeats (laundry once a day) and
  `after` ties one to another (washing up only after cooking).
- **The brain, as built:** when free, score every allowed action:
  `base + sum over needs of min(gain, 100 - need) × ((100 - need) / 100)²`, times
  `offHours` outside its hours, minus 0.15 per square of walking to the nearest usable
  piece. Keep actions scoring at least 1, take the best 3 and pick one weighted by
  score². If nothing qualifies, walk to a random square and potter about for 5–15 minutes.
  Actions are not interrupted once started.
- **Running the bath:** an action with `prelude` (the bath, `data/actions.json`) first does the prelude action at the same furniture (6 minutes standing at the bath, the tap running), then the action itself. The prelude is never chosen on its own (it has no score).
- **Personality:** five traits 0 to 10 (`personality` in `data/people.json`: `"random"` rolls them from the seed, or give numbers). An action's `likes` (weights) multiply its score by `traitFit`: 1 + Σ weight × (trait − 5) / 5, never below 0.2. Used so far: tidy (laundry, washing up), active (garden +, nap −), outgoing (garden). Kind and anxious have no effect until Phase 2 and the emotions work.
- **Walking:** shortest route over the walking map, 8 squares per game minute. The map
  joins floors at the same height (ground floor and garden, through the back door) and
  the floors through the stairs: a flight is entered only from its bottom end or from the
  landing square above its top step, never over the banister. Furniture is used from a
  free square beside it in the same room.
- **Dated events:** each game day, `queueDay` queues the rules that fall in it (`src/sim/calendar.js`); `fireDue` fires each at its hour. A rule with money flows (`data/flows.json`) runs them and logs what was paid; any other rule writes its label. Nothing owns the school events yet (L6/L7).
- **Money (L2, as built):** `src/sim/stocks.js` holds the balances (`world.stocks`) and changes them only through `change()`. Money out below £0 spills into the overdraft, which stops at its limit (the rest is not paid and the log says so). Money in repays the overdraft first. Every change writes a ledger entry with its reason. `src/sim/household.js` works out Tom's take-home pay from the 2026/27 rules, the mortgage repayment (interest on the balance, the rest is capital), the weekly food and everyday spend (booked at 10:00 on each game day, for the calendar days it covers) and the savings interest. The panel's Household block shows the balances and the next money event. Nothing in the money changes what the family does yet: they do not react to bills (L4 and L8).
- **Log:** each decision adds a line (`world.log`, last 50), shown in the status panel.
- **Why trace:** every decision also stores a `why` (on the log line and as `person.why`):
  the chosen action, the reason (`need`, or nothing scored high enough and she wanders), the
  lowest need and its value (chores are `routine`, they have no need), the score, the squares
  to walk, the habit (never done, or minutes since last), the two next-best options, and a
  snapshot of all needs. Shown in the panel while `SHOW_WHY` is on (`src/ui/panel.js`).
- **Steam:** actions marked `"steam": true` in `data/actions.json` (the bath) draw a dithered
  steam puff over the person while they are in them. Drawing only, no effect on the sim.
- **Frosted cover:** actions marked `"hide": true` (the toilet and the bath) cover the whole
  furniture and the figure in it with a moving frosted-glass mosaic while in use. Drawing only.

### Stress, sleep debt and interruptions (as built, L4)
Code: `src/sim/wellbeing.js`, plus the hourly hook and the interruption rule in `src/sim/world.js`. Data: `data/wellbeing.json`, `data/couplings.json`, `kind` and `countsAsSleep` in `data/actions.json`.
- **Stress** is a lagged stock per person, 0 to 100, with a half-life of 48 game hours. Its target is a base (20 + 3 × (anxious − 5), so 5 to 35) plus the pushes from couplings that hold this hour. It drifts towards the target; it never jumps.
- **Couplings** are checked once per game hour: a low need (any need under 25: +5 each), a long sleep debt (over 6 hours: +15, fun drops 1.4× as fast, energy 1.2×), a joint account under £200 (+20 for each adult), an overdraft (+15 for each adult), and stress over 60 (comfort drops 1.2× as fast).
- **Sleep debt** is settled at 18:00 each day: hours of sleep (including naps that count) against 8 hours owed. Repayment is at most 2 hours a day.
- **Mood:** fun actions score × (1 − stress / 200). **Chores** lose 0.1 points for each point of stress above 50.
- **Interruption:** a need under 10 stops the current action, unless it is sleep or the action fills that need. The person picks the best action that fills the need. If none does, they wait 30 minutes before trying again.
- The face looks uneasy from stress 60. The panel shows stress and sleep debt under each person's needs.
- Today's world rarely reaches these limits: no need falls under 10, sleep debt stays 0, and stress rests at base. They come alive with obligations and children (L6/L7) and money trouble (L9/L11).

### Beliefs and observations (as built, L5)
Code: `src/sim/beliefs.js`, plus the hooks in `src/sim/world.js` (the worry score, the anywhere action, the check at the end of the action, the hourly drift) and `src/sim/household.js` (noticed money). Data: `data/beliefs.json`, `data/actions.json` (`checkBank`), `data/couplings.json`.
- **A belief** is what a person thinks the joint account holds (the account less the overdraft). It starts at the truth and changes only through observations. People decide from the belief, never from the truth.
- **Checking** the bank app (`checkBank`, 3 minutes, done where she stands, at most every 4 game hours from 07:00 to 23:00) makes the belief exact and resets its age.
- **Noticed money:** pay, the mortgage, council tax, energy, water, insurance, and the food shop move the belief by what was paid. Everyday spending, clothing, phones, broadband and subscriptions do not, so the belief drifts away from the truth between checks.
- **Drift:** a belief older than a day slides down for anxious people (above 5) and up for calm ones, by £15 a day per point from 5, up to £1,000 in total since the last check.
- **The worry score** for checking is 1.5 a day of age, +3 when she thinks the account is under £1,000, scaled up by stress. It reads the belief only. Anxious people worry about three times as much as calm ones.
- **Couplings:** the low-balance and overdrawn stress pushes now read the belief. Without beliefs (an old save or a test world) they read the truth, as in L4.
- **The panel** shows `Thinks … · really …` under Sarah's stress, and the why line says what she thinks; both are build-time views only.
- Today Sarah checks about once a game day (0.7 to 2 across 20 seeds), and her belief sits on average £54 to £200 from the truth.

## Life-like world: where the plan lives
The plan for everything beyond section 0 (calendar, stocks and ledgers, couplings,
beliefs, households and invisible work, positions and firms, places and chance meetings,
the economy's three loops, institutions, holidays, health, death and grief) is in
`docs/LIFE_SYSTEMS.md`, built in steps L0–L16. The brief it follows is
`docs/WORLD_PRINCIPLES.md`. Where the sections below disagree with LIFE_SYSTEMS.md,
LIFE_SYSTEMS.md wins; update the section here as each step is built.

## 1. Needs (0–100, drop over time)
Hunger, Energy, Bladder, Hygiene, Fun, Social, Comfort.
Rates differ by age (toddlers tire fast, need help with most needs).

## 2. The brain (utility AI)
Every time a person finishes an action, they score every possible action:

    score = how much it fixes my needs (urgent needs count much more)
          × personality fit (lazy person likes sofa more)
          × mood modifier
          + obligations (work at 9, school run)
          − effort / travel time

Then pick from the top few with weighted randomness, so they're not robots.
Each person also has a few **goals** (get promoted, learn to ride a bike,
save for a car) that add score to related actions.

## 3. Personality
5 sliders (0–10): Outgoing, Tidy, Active, Kind, Anxious + a few traits
(e.g. bookworm, foodie, short-tempered). Children inherit a blend of parents
plus randomness.

## 4. Emotions and mood
- Mood = mostly from how satisfied needs are + recent events.
- Emotions are short-lived (happy, sad, angry, stressed, bored, excited,
  scared) caused by events and fading over hours/days.
- Memories: important events are stored and can be recalled
  ("still upset about losing the job").

## 5. Relationships
Each pair has Fondness and Tension. Changed by talks, arguments, help, time
spent together. Drives who chats, who argues, who gets married.

## 6. Life stages (on the life clock)
Baby · Toddler · Child · Teen · Young adult · Adult · Elder.
Each stage unlocks/locks actions (toddler can't use cooker, teen can get a
part-time job). Birthdays move people up stages.

## 7. Outside the house
Off-screen locations: work, school, nursery, shops, park, friend's house,
gym, doctor. While away, a person runs a simplified version of the sim and
produces commentary lines from templates in `data/text/`
(e.g. "{name} had a long meeting and feels {emotion}").

## 8. Economy
Household money; wages per job; bills weekly; food shopping. A world economy
value (boom ↔ recession) shifts prices, pay rises, job-loss chance.

## 9. Weather & seasons
Spring/Summer/Autumn/Winter. Daily weather (sun, rain, snow, heatwave).
Affects mood, outdoor plans, heating bills, illness chance.

## 10. Time (see DECISIONS #2)
Day clock and life clock run separately so days feel real but lives still
move at a watchable pace.

## 11. Growing the family
Adults can form partnerships with off-screen people (generated characters),
marry, have babies; grown children can move out (they leave the house view
but stay in the family tree and commentary).
