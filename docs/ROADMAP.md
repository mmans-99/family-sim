# Roadmap

Each phase ends with something you can open and watch.

## Phase 0 — Planning
- [x] Vision, architecture, simulation design docs
- [x] Settle open decisions (see DECISIONS.md)
- [x] Create GitHub repo (`mmans-99/family-sim`, public)
- [x] GitHub Pages hosting turned on (live at mmans-99.github.io/family-sim)

## Phase 1 — The house and one person (complete)
- [x] Clock with speed controls (pause / 1x / 2x / 4x)
- [x] House map: top-down pixel-art plan of the ground floor, first floor and garden, with walls, doorways, windows, stairs and furniture drawn from the Sierrassets sprite pack, plus our own extras (stairs, shed, tree, lawn, path, rugs, front wall face). UK 3-bed semi layout, every room checked as walkable. Whole-house view on one screen, plus one view per floor. Pan and zoom.
- [x] Objects: bed, fridge, cooker, toilet, bath (shower over it), sofa, TV, armchair, basin, sink, washing machine, garden chairs (`data/actions.json`)
- [x] One adult who walks (pathfinding, stairs, back door) and uses objects: Sarah
- [x] Needs that drop over time; picks actions to fix them
- [x] Watch-only status line and panel: what she is doing, where, need bars, recent log
- [x] Save/load: the game is kept in the browser and reopened where it stopped; the time the page was closed is caught up on open, with a "while you were away" summary
- [x] Bath: running the bath (tap and filling) comes before getting in
- [x] Personality: five traits (outgoing, tidy, active, kind, anxious) rolled from the seed, affecting choices (tidy and active so far)

## Phase 1b — Life foundations (plan: `docs/LIFE_SYSTEMS.md`)
Build these before Phase 2: everything after rests on them. Step numbers match LIFE_SYSTEMS.md section 16.
- [x] L0 Save/load, saveable random state, one random stream per system (`src/sim/save.js`, `src/save/store.js`, `subRng` in `src/sim/rng.js`)
- [x] L1 Calendar and two clocks (each game day ≈ 13 calendar days; dated bills, paydays, holidays). `src/sim/calendar.js`, `data/calendar.json`; date range on the clock; Household log
- [x] L2 Stock engine + household money: accounts, bills, mortgage as ledgers (built 2026-11-11; see `docs/LIFE_SYSTEMS.md` 3a "as built"; panel Household block; save version 3)
- [ ] L3 Replay harness: run many seeds for years with no screen and report the lives
- [ ] L4 Couplings and lags: stress, sleep debt; low needs interrupt actions
- [ ] L5 Beliefs: people act on what they think, not the true values

## Landscape view (UI step, before L2)
Design agreed 2026-11-11: `docs/HOUSE_VIEW.md` section 10. Built 2026-11-11 after the user approved it (merged to `main`).
- [x] Full-screen landscape layout: menus float over the house; side panel holds needs, log, Household
- [x] Follow camera: glides with a person, looks ahead, stops at the world's edge; tap a face to follow
- [x] Snap zoom levels: Close, Room, Whole house
- [x] Minimap with people dots and the view box; tap to move the camera
- [x] Edge scenery: front garden, pavement, road, the other half of the semi, fences (drawing only). Built 2026-11-11; phone check and stairs/clamp checks still to do (`docs/HOUSE_VIEW.md` 10.5)
- [x] Portrait still works; full-screen button; web app manifest for "Add to Home Screen" (no icon file yet)
- [x] Auto-hide of buttons after 5 s (default approved)

## Phase 2 — The family
- [ ] L6 Obligations in the brain (school run, appointments, deadlines)
- [ ] L7 Age curves for needs and abilities; childcare
- [ ] L8 Invisible labour ledger, felt fairness, tension, household bargaining
- [ ] All four family members, with age-based abilities (toddler can't cook)
- [ ] Carers: adults must feed/change/supervise the toddler
- [ ] Personality traits affect choices
- [ ] Mood + emotions shown as bubbles
- [ ] Relationships between each pair (fondness, tension)
- [ ] Conversations / shared activities

## Phase 3 — Leaving the house
- [ ] L9 Positions and firms (jobs as positions with budgets and rigidity), labour market
- [ ] L10 Places, contacts graph, chance meetings, life radius
- [ ] Work, school, nursery schedules
- [ ] Off-screen activities (shopping, park, friends, gym)
- [ ] Running text commentary feed for people outside
- [ ] Money: wages, bills, food shopping, savings
- [ ] Visible street or neighbourhood beyond the house edge (follow camera goes with people outside; update VISION.md first)

## Phase 4 — The world
- [ ] L11 Economy as three loops (income, credit, shocks); energy cap; remortgage in spring 2029
- [ ] L12 Institutions as filters (queues, errors that rise with household chaos)
- [ ] L13 Holidays as dated obligations, gift ledger, anniversaries
- [ ] Weather + seasons (affects mood, plans, bills)
- [ ] Economy: prices, pay rises, job loss, recession/boom, energy price cap changes
- [ ] Random life events (illness, promotion, broken boiler, birthday)
- [ ] "While you were away" catch-up summary

## Phase 5 — Lives over time
- [ ] L14 Children's slow outcomes, life gates, relative timing, cohort scarring
- [ ] L15 Health shocks, mortality hazard, grief, estates, off-screen relatives
- [ ] L16 Status by domain, local norms, reputation
- [ ] Ageing and life stages (toddler → child → teen → adult → elder)
- [ ] Skills and school grades; career choices
- [ ] Friends, dating, marriage, moving out, new babies
- [ ] Old age, death, grief
- [ ] Family tree and per-person diary

## Phase 6 — Polish
- [ ] Better art and animation
- [ ] Sound
- [ ] Optional nudges / god mode
- [ ] Optional: sim runs 24/7 on a home server
