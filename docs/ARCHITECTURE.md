# Architecture

(Browser app, hosted on GitHub Pages. See DECISIONS.md.)

## The big idea: separate layers
1. **Simulation** (`src/sim/`) — pure logic. Knows time, and later people, needs, money. Never draws anything. Can run fast to catch up.
2. **Scene and rendering** (`src/render/`) — turns the house data into boxes and draws them from above with pixel-art sprites.
3. **UI** (`src/ui/`, `src/main.js`) — buttons, camera controls, clock display, status line and person panel. Later: commentary feed, diary, family tree.

## Folder layout (as built)
```
simulator/
├── CLAUDE.md               working rules
├── index.html              the page (loads src/main.js as a module)
├── package.json            `npm test` runs node --test
├── .nojekyll               tells GitHub Pages to skip Jekyll (plain static site)
├── docs/                   project memory (see CLAUDE.md)
├── assets/
│   ├── furniture-pack/     Sierrassets sheets: furniture.png, floors-walls.png
│   ├── extras/extras.png   our own pieces the pack lacks (stairs, shed, tree, lawn, path, rugs, front wall face)
│   └── people/sarah.png    Mum: every animation frame (+ sarah.json listing where each frame is)
├── tools/
│   ├── make_extras.py      draws assets/extras/extras.png (Python + Pillow)
│   ├── make_mum.py         builds assets/people/sarah.* from Eris Esra's 16x32 template (template not in repo)
│   ├── replay.js           replay harness command line: `node tools/replay.js --seeds 20 --years 10` (writes replay-out/, ignored by git)
│   └── replay/             replay harness (LIFE_SYSTEMS 15a): load.js (reads data/, the only file access), run.js (seeds, runMany), probes.js (money, calendar, needs, actions, log, wellbeing), checks.js (eleven invariants: seven for money and calendar, four for wellbeing), turning.js (turning points), summary.js (text summary)
├── data/
│   ├── house.json          house: floors, rooms, doorways, fences, stairs, furniture
│   ├── calendar.json       calendar start (1 Mar 2026) and dated rules: mortgage, pay, bills, savings interest, energy cap, Christmas
│   ├── stocks.json         the money at the start: joint account, savings, overdraft limit, mortgage loan, Tom's salary
│   ├── flows.json          the money flows: pay, mortgage, council tax, water, energy, broadband, phones, interest, food, everyday
│   ├── tax.json            2026/27 income tax and employee NI rules (sourced in docs/FAMILY.md)
│   ├── needs.json          needs and how fast they drop
│   ├── actions.json        what people can do with furniture, and what it gives them
│   ├── people.json         who is simulated (Sarah for now) and where they start
│   ├── replay.json         replay harness settings: money stocks, turning-point thresholds, wellbeing thresholds, what is not measured yet (tuning)
│   ├── wellbeing.json      stress (lagged, half-life 48 game hours), sleep debt, mood and interrupt settings (tuning; sleep need cited)
│   ├── couplings.json      rules that push the stress target or change a need's rate, checked hourly; money rules read beliefs, with the true-value fallback (tuning)
│   └── beliefs.json        what people think the joint account holds: the truth it sums, what they notice, drift and the check (tuning)
├── src/
│   ├── main.js             starts everything: clock, views, camera, drawing loop
│   ├── sim/
│   │   ├── clock.js        game time, speeds, day/season/year reading
│   │   ├── calendar.js     real dates on the life clock: 365/28 calendar days per game day, dated rules (incl. day "last"), weekday (pure)
│   │   ├── stocks.js       money stocks: change() is the only way to move one; overdraft spill and limits; ledger with roll-up (pure)
│   │   ├── household.js    take-home pay, mortgage schedule and repayment, flows on their dates, weekly spend, next event (pure)
│   │   ├── rng.js          seeded random numbers (mulberry32), saveable state, subRng for separate streams
│   │   ├── housemap.js     walking map from house.json: squares, steps, stairs, routes, where to stand to use furniture
│   │   ├── world.js        people, needs, the brain, walking, actions, personality, log; step() = one game minute
│   │   ├── save.js         save to plain JSON, load from it, time away, catch-up (pure logic)
│   │   ├── wellbeing.js    stress, sleep debt, couplings, mood factor, chore penalty, stress label (pure logic; opt-in)
│   │   └── beliefs.js      what people think the money is: truth, setup, the check, noticed flows, drift, worry score (pure logic; opt-in)
│   ├── save/
│   │   └── store.js        keeps the save in the browser (localStorage); the only save code that touches the browser
│   ├── render/
│   │   ├── scene.js        house data -> list of boxes (floor squares, walls, windows, doors, furniture)
│   │   ├── camera.js       plan camera: grid position -> art pixels (16 per square), pan
│   │   ├── house.js        draws the scene from above: floor tiles, flat items, then walls and sprites top to bottom
│   │   ├── raster.js       pixel-exact polygon fill, lines and sprite copying (no anti-aliasing)
│   │   ├── pack.js         sprite pack: positions on the sheets, item-to-sprite map, room floor tiles, loader
│   │   ├── people.js       where to draw each person and which frame: walk/idle/interact/sit/lie, facing, face from needs
│   │   └── palette.js      fixed palette; only used to snap colours when the sprite pack is missing
│   └── ui/
│       ├── camera-controls.js   drag, two-finger, pinch, wheel; button actions
│       └── panel.js        watch-only status line and panel: doing, room, need bars, recent log
└── tests/
    ├── sim.test.js         clock and random numbers
    ├── calendar.test.js    dates, game-day spans, yearly counts (incl. leap year), no double firing, firing in the world, day "last"
    ├── stocks.test.js      spill, full overdraft, floors and ceilings, money in clears the overdraft, ledger roll-up
    ├── household.test.js   tax and NI, mortgage schedule, start balances, next event, one game year as a hand sum, save with money
    ├── world.test.js       routes, stairs, back door, scoring, chores, same-seed days, a two-day run
    ├── save.test.js        save round trip, time away, catch-up, bath prelude, personality
    ├── wellbeing.test.js   stress setup and base, lags, money pushes, sleep debt, mood and penalty, interruptions, same seed, save v4 and v3, face
    ├── beliefs.test.js     beliefs setup, truth, noticed and unnoticed money, the check, drift, anywhere action, couplings read beliefs, worry score, why trace, save v5 and v4
    ├── render.test.js      scene contents, plan camera, sprite maps, furniture layout, walking routes
    ├── palette.test.js     palette snapping
    ├── raster.test.js      pixel-exact fills and lines
    └── replay.test.js      replay harness: same seed, read only, invariants fail when they should, turning points, two years, command line
```
Planned, not built yet (details and order in `docs/LIFE_SYSTEMS.md`): `src/sim/random.js` (random helpers), the labour ledger and bargaining (L8), `firms.js` (positions, firms, labour market), `places.js` (places, contacts, encounters), `economy.js`, `institutions.js`, `holidays.js`, `health.js`, `life.js`, `weather.js`, `commentary.js`, `src/save/store.js`, and `tools/replay.js` (headless multi-seed replay). Data to come: `couplings.json`, `obligations.json`, `labour.json`, `agecurves.json`, `lifecourse.json`, `firms.json`, `positions.json`, `places.json`, `economy.json`, `institutions.json`, `holidays.json`, `text/*.json`. Also `manifest.json` and `sw.js` for offline use.

## The tick
- The sim steps in fixed game minutes: `step(world)` in `src/sim/world.js` is one game minute.
- Each frame, `main.js` asks the clock how many whole game minutes passed and runs that many steps.
- Two speeds (planned, LIFE_SYSTEMS.md rule 5): people in the house step every game minute; off-screen agents (firms, institutions, economy, relatives) step once per game day at 00:00. Dated calendar rules fire at their hour on the game day that contains their date.
- Each step: each person's needs drop → if free, the brain picks an action → walk along the route, or use the furniture (needs rise) → log. (Later: weather and economy before the people.)
- The drawing loop runs every screen frame and reads the latest state. `people.js` moves walkers smoothly between minutes using the part of the minute that has passed; the sim itself never reads anything from the screen.
- Testing aids: `index.html?minutes=N` starts a new game N game minutes in (same steps as the clock); `index.html?fresh=1` forgets the save and starts a new game.
- Build-time views: `SHOW_WHY` in `src/ui/panel.js` shows each person's latest decision
  (`person.why`). Set it to `false` before the finished full-screen view.
- Drawing-only effects: an action's `steam` flag (`data/actions.json`) makes `people.js` pass a
  steam frame for that person; `house.js` draws the puff after the people. The sim never reads it.
- Frosted cover: an action's `hide` flag (toilet, bath) makes `people.js` pass the furniture
  footprint and the real time; `house.js` paints `paintFrost` over the footprint plus the
  figure's visible pixels (`opaqueBounds`), one pixel wider, after everything else. Each 4-pixel
  tile drifts through six greys at its own pace (about 2.6 s a cycle), some tiles are hatched
  (the hatching slides) or dotted, the corners are rounded and the edge is dithered.

## The house view
(Step-by-step method, rules and checks: `docs/HOUSE_VIEW.md`.)
- The view is straight down. The front of the house (y = 0, where the front door is) is at the top of the screen and the garden is at the bottom, and y grows down the screen. The default view shows the whole house on one screen, with the first floor placed above the ground floor and garden; buttons show one floor at a time.
- `scene.js` builds the edge scenery first (`house.json` `scenery`, drawn only, kind `scenery`), then boxes for the chosen floor: one per floor square, walls from room edges with doorways cut out (outside walls marked `outer`), windows on outside walls, a `face` box one square tall above the front wall (with its windows and the front door), and furniture straight from `data/house.json`.
- `camera.js` turns a grid position into art pixels. One grid square is always 16 art pixels (`UNIT_PX`), the size the sprite pack is drawn at, so sprites are never stretched.
- `house.js` draws in this order: edge scenery first (road, pavement, grass, roof, all from the extras sheet), then floor squares (pack tiles repeated, or a plain colour), flat items (rugs built from a 9-piece template, tiled paths, the stairwell), then the front wall face, walls, windows, fences and furniture sorted from the top of the screen down, so lower things overlap those behind. Walls, windows and fences use the pack's colours (white walls with a dark grey edge, wooden fence with posts). Doors are not drawn; a doorway is a gap in the wall.
- A furniture item whose name is in `NAME_TO_SPRITE` (`pack.js`) is drawn as a sprite, standing on the bottom edge of its squares and centred. Its `z` in the data lifts it up the screen (a TV on its unit). Other items are outlined blocks.
- A view (`VIEWS` in `main.js`) lists its floors and where each is placed on the drawing. `buildScene` shifts a placed floor's boxes; the house data and the simulation keep each floor's own coordinates. `main.js` fits the view's bounds to the screen.
- `main.js` draws into a small canvas and scales it up with hard edges. One art pixel is a whole number of device pixels. Zooming changes that number, so the art stays sharp at every zoom. Pan is turned into whole art pixels.
- The sheets are `assets/furniture-pack/furniture.png` and `floors-walls.png`, plus our own `assets/extras/extras.png`. If the pack fails to load, everything is drawn as plain blocks and snapped to the palette. If only the extras fail, those pieces fall back to blocks.

### Landscape view (as built 2026-11-11)
Design in `docs/HOUSE_VIEW.md` section 10. `src/render/follow.js` is the pure follow-camera maths (aim with look-ahead, glide, edge clamp, zoom levels, minimap mapping; tested in `tests/follow.test.js`). `src/render/minimap.js` draws the minimap canvas. `src/ui/camera-controls.js` handles drag, pinch and wheel through hooks. `src/main.js` holds `WORLD` (the floors and their placement, which the camera moves over), the camera state, the frame loop and the panel and face controls. The floating overlays and the side panel are HTML and CSS in `index.html`. There is no separate `hud.js`. `manifest.webmanifest` sets full screen, with orientation "any" so portrait still works. `src/sim/` and the save format do not change.

## Save format (version 5, as built)
`src/sim/save.js` writes one plain JSON object: `{ version, savedAt, seed, clock: {totalMinutes, speed, carryMs}, time, rng, people[], log[], calendar: {queue, fired}, stocks, loans, couplings: {fired} | null }`. Version 3 adds money (`stocks`: each stock's value, ledger and ledger totals; `loans`: the mortgage's rate, term, fixed-until date and monthly payment). Version 4 adds the wellbeing state: each person's `rateTimes`, `sleptMinutes`, `sleepWindowStart` and `noInterruptBefore` (only in games with the couplings), and `couplings.fired`. Stress and sleep-debt stocks are in `stocks`. Version 3 saves still load: their money is merged in and stress starts at its base with sleep debt 0. Versions 2 and 1 still load: they get their money from `data/` for the save's date (`setupMoney`). Flow definitions, tax rules, wellbeing and coupling rules are not saved: they come from `data/`.
- `calendar` holds the queue of dated events not yet fired and the count of each rule's firings. The rules come from `data/calendar.json`.
- `savedAt` is real time in ms; the time away is the real time since then, at the saved speed, capped at one game year.
- `rng` is the main random generator's position (`getState()`); `people[]` holds each person's `at`, `needs`, `personality`, `lastDone`, `why` and `activity`.
- An activity stores its action as a copy and its furniture as an index in `data/house.json` (`furniture`). A loaded game must use the same house data.
- A save from a version this game does not read is refused. The file is stored by `src/save/store.js` under the key `family-sim.save`. Saves happen every 10 s, on `pagehide`, and when the page is hidden.
- Version 5 adds each person's `beliefs` (what they think the joint account holds: `value`, `seenAt`, `source`, `drifted`). Versions 1 to 4 load with each belief at the truth as known when the save loads.
- New systems add their state to the save as they are built (`stocks`, `flows`, `calendar`, `household`, `economy`, `contacts`, ...) and bump `version` when the shape changes.
