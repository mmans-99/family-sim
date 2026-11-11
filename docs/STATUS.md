# Status — the handoff file

**Update this at the end of every session.**

## Current phase
Phase 1 is complete: Sarah (Mum) has needs, picks what to do, walks the house, uses the furniture, runs her bath, has a personality that changes her choices, and the game is saved in the browser and caught up when reopened (step L0 of LIFE_SYSTEMS.md). L1 (calendar) is built. Next is the landscape full-screen view (design agreed, waiting for approval to build), then L2 (stock engine and household money).

## Latest (2026-11-11, night) — landscape view built (branch `landscape-view`)
- The user approved the two open choices (auto-hide after 5 s; portrait kept with a hint) and the build.
- Built HOUSE_VIEW section 10 except edge scenery (10.5): follow camera with look-ahead and glide, edge clamp,
  zoom levels Close / Room (default) / Whole house, minimap with people dots and view box (tap to glide there),
  full-screen canvas with floating clock, speeds, faces and zoom buttons, side panel (sheet in portrait),
  auto-hide, dismissible portrait hint, away card, Full screen button, `manifest.webmanifest`.
- Floor buttons are gone; `?view=first|ground|garden` still opens a floor, `?view=all` the whole house.
- Tests: 86 passing (new `tests/follow.test.js`).
- Checked in headless Chrome at 844x390 and 390x844 (3x): room, close, whole, panel, first floor, garden,
  portrait room and sheet. No console errors except a 404 (the missing favicon, harmless).
- Fixed in the check: the portrait clock overlapped the speed buttons; the whole-house label was under
  the clock box; the zoom label and the button both said "Whole house".
- **Not done:** edge scenery (10.5); a home-screen icon; the minimap glide is checked by reasoning, not by a
  screenshot mid-glide; the auto-hide and the drag/pinch/wheel controls are untested on a real phone.
- **Not committed to main:** branch `landscape-view`. The sandbox cannot reach the user's phone or Pages.

## Earlier (2026-11-11, evening) — landscape view design agreed (docs only)
- The user asked for the house full screen in landscape, with the menus in the background, and an
  "open world" feel like *Shakedown: Hawaii*. The design is written up in `docs/HOUSE_VIEW.md`
  section 10: floating menus and a side panel, a follow camera that looks ahead, snap zoom levels,
  a minimap, and edge scenery (pavement, road, the other half of the semi, fences).
- Decided (DECISIONS 2026-11-11): art stays top-down; zoom snaps to whole pixels; the outside beyond
  the edge scenery stays text only until Phase 3. VISION, ROADMAP (new "Landscape view" section) and
  ARCHITECTURE (planned files) updated.
- **No code written.** Waiting on the user: auto-hide after 5 s (default) and portrait kept with a
  hint (default), then approval to build.

## Latest (2026-11-11, mid-afternoon) — life-like world plan
- The user supplied a design brief for a life-like world (clocks and ledgers, not scripted
  content). Saved as `docs/WORLD_PRINCIPLES.md`.
- Wrote `docs/LIFE_SYSTEMS.md`: the detailed build guide for it, made for other AI models
  to follow. Rules for all new sim code, then one section per system with files, JSON shapes,
  function signatures, how it plugs into `step()`, tests and mistakes to avoid, and a build
  order L0–L16 (section 16). **Docs only: no code written.**
- ROADMAP gains Phase 1b (L0–L5) before Phase 2; later steps are listed in Phases 2–5.
  CLAUDE.md, SIMULATION.md, ARCHITECTURE.md and DECISIONS.md point to the new guide.
- Waiting on the user: approve the calendar mapping (DECISIONS OPEN) before L1.

## Latest (2026-11-11, L1 calendar)
- The user approved the calendar mapping (DECISIONS, 2026-11-11). Built as LIFE_SYSTEMS section 2, with three refinements recorded in DECISIONS: the clock shows the game day's date range, game days partition the calendar exactly, weekdays are computed but not shown.
- **Dates on the clock.** The clock reads "Year 1, Day 3 (Spring) · 27 Mar 2026 – 8 Apr 2026 · 06:05 · 1x". Each game day is about 13 calendar days (365 ÷ 28); game day 1 is 1 March 2026.
- **Dated rules** (`data/calendar.json`): mortgage on the 1st at 06:00, payday on the 28th at 09:00, energy cap on 1 Jan/Apr/Jul/Oct at 00:00, Christmas Day at 07:00. Nothing owns them yet: each fires once at its hour, writes a "House" line and is counted in `world.calendar.fired`.
- **Household section** in the panel shows the last three House lines.
- A game that starts mid-day does not fire events already past.
- **Save format is version 2** (calendar queue and counts). Version 1 saves still load.
- Checked: 1 April 2026 at 06:00 shows "Mortgage payment (1 Apr 2026)" and the energy cap at 00:00; every floor (first, ground, garden) and the whole house looked at in screenshots; no errors in the browser console.
- Tests: 72 passing (new `tests/calendar.test.js`: dates, game-day spans, one game year 12/12/4/1, four years 48/47/16/4 (28 Feb 2030 falls in year 5), leap day, weekdays, firing in a live world, no firing twice).
- **Not committed to main:** on branch `l1-calendar` (from `phase-1-finish`, PR #1).
- Not yet: council tax months and school term dates (need sourcing first); owners for the events (money in L2, school in L6/L7).

## Latest (2026-11-11, finishing Phase 1)
- **Save and load.** The game is saved in the browser (localStorage) every 10 seconds, and when the page is hidden or closed. Reopening restores it exactly; the missed time is run on open at the speed it was running (paused = no time passes), capped at one game year, and a "while you were away" box lists the last few things she did. Only `src/save/store.js` touches browser storage; `src/sim/save.js` is pure logic. `?fresh=1` forgets the save and starts again. Checked in a real browser: 07:00 saved, reopened 90 minutes later at 1x: 21:24 with the summary, and a second reopen did not catch up twice.
- **Running the bath.** The bath now starts with a 6-minute "Running the bath" step at the bath, then she gets in (`prelude` in `data/actions.json`). Checked at 07:48 (filling) and 07:56 (in the bath, hidden by the cover).
- **Personality.** Five traits, 0 to 10, rolled from the seed for Sarah (`personality: "random"` in `data/people.json`), shown under her name. Tidy and active change her choices so far: laundry and washing up (tidy), garden (active, outgoing), naps (active, negative). Outgoing, kind and anxious have no effect until Phase 2. The why line shows the personality multiplier when it is not neutral.
- **Not committed or pushed:** this session can only read `mmans-99/family-sim`. Changes are in the working copy at `/home/claude/mmans-99/family-sim`.
- Tests: 63 passing (new `tests/save.test.js`: save round trip gives the same day, catch-up rate and cap, prelude order, personality direction, seeded roll).

## Known issues (added)
- Sarah potters a lot between meals because nothing else needs doing yet (unchanged).
- Saves are version 1. A save from a later, incompatible version is refused and a new game starts; the old save is overwritten when the new game first saves.
- The favicon 404 in the browser console is harmless (no icon file yet).

## Latest (2026-11-11, afternoon)
- **Why trace.** Every decision records why: the lowest need, score, squares, habit and the
  two next-best options (`person.why` and the log line). Shown under each person in the panel
  while `SHOW_WHY` (in `src/ui/panel.js`) is on. Turn it off before the finished view.
- **Bath steam.** Actions marked `steam` (the bath) draw a dithered puff over her while she is
  in them. First pass: it is subtle, and it still touches the wall edge above the bath; tune
  on the phone.
- **Frosted cover instead of blur.** The toilet and bath are covered by a moving frosted-glass
  mosaic (after the user's reference) while in use, so the figure is not visible (`hide` flag in
  `data/actions.json`). Tiles drift through the greys at their own pace, some hatched or dotted;
  rounded, dithered edge; hugs the furniture and the figure's visible pixels, so it stays off the
  walls. Checked: bath and toilet at two moments (pattern moves, nobody visible), whole house,
  ground floor, garden, phone size.
- How the cover works and how to check it are written in the comment above `paintFrost`
  (`src/render/house.js`) and in `docs/HOUSE_VIEW.md` ("Privacy cover over the toilet and bath").
- **Not done yet, as asked:** the bath's tap and filling steps; personality parameters (Mum
  first, then everyone). Tests: 55 passing.

## Latest fix (2026-11-11, night)
- **Teleport fixed.** The minute a walk was chosen, Sarah was already advanced 8 squares, so
  she appeared to jump. Now the walk starts on her first square and moves at most 8 squares
  a minute from the next minute. Test added (51 passing).
- Still to do in Phase 1: tap and bath-filling steps, personality parameters, save/load.

## Last session (2026-11-11, evening)
The user supplied Eris Esra's character template pack and an expression sheet pack, and
asked for them to be made into Mum.
- **Mum is animated now.** `tools/make_mum.py` paints Sarah (shoulder-length brown hair,
  teal top, jeans) over every frame of the template's idle, walk and interact animations
  in all 8 directions, plus a sitting pose and a sleeping head: 149 frames in
  `assets/people/sarah.png`. She walks with a walk cycle facing where she is going, works
  facing what she uses (back to you at the cooker), sits, and sleeps with eyes shut.
- **Faces:** the expression pack is a blank practice sheet (all 18 boxes hold the same empty
  face, checked in every .aseprite layer), so nothing from it is used. I drew content,
  happy, tired, uneasy and asleep faces; the face follows her needs (display only).
- **Licence:** the template may be used in games; a free game must credit and link it, so
  the footer now does. The template files are not in the repo (no repackaging allowed).
- Tests: 50 passing (facing, faces, every frame the renderer asks for is on the sheet).
- Checked: enlarged frames in every direction; screenshots of her waking, cooking, reading,
  pottering and asleep; phone size; a live run with no errors.

## Earlier (2026-11-11, late afternoon)
The user checked the new layout on the phone ("looks good") and asked for the next steps.
- **Sarah lives in the house.** `src/sim/housemap.js` builds a walking map from
  `house.json` (doors, stairs from their ends only, back door to the garden, furniture in
  the way). `src/sim/world.js` runs one game minute per step: needs drop, the brain scores
  the actions in `data/actions.json` and picks one, she walks there and uses it. Same
  seed, same day. Details: `docs/SIMULATION.md` section 0.
- A believable day (seed 1): toilet, breakfast, bath, washing up, reading, laundry, TV,
  nap, garden, dinner, bed at 22:00, up at 06:00. Chores have rules (laundry once a day,
  washing up after cooking) after the first run washed up ten times in a row.
- **Drawn:** our own Sarah sprites (standing, walking, sitting, head on the pillow or in
  the bath) on the extras sheet. She walks smoothly between squares, sits on the sofa,
  armchair, garden chair and toilet, lies in bed and bath, and is drawn in front of the
  stairs when climbing them.
- **Status:** a line under the clock (what she is doing, where) and a panel below the
  house: need bars (green, amber, red) and her last five log lines. Watch only.
- Walking speed set to 8 squares per game minute after watching it at 2 (too slow).
- Testing aid: `index.html?minutes=N` opens the page N game minutes in.
- Tests: 47 passing (new `tests/world.test.js`: routes via the stairs, banister, back door,
  every action has a usable piece, scoring, chores, same-seed days, a two-day run).
- Checked: screenshots of her cooking, on the stairs, in the bath, reading, napping, in
  the garden and asleep; whole house at phone size with the panel; a live run in a real
  browser at 4x with no errors.

## Earlier (2026-11-11, afternoon)
The user asked for the leftover block art to be replaced and for the first floor to be a
typical UK house, with every bedroom reached from the landing.
- **First floor, UK 3-bed semi:** master bedroom front left (door at the front end of the
  landing), Oliver's room back left (door at the back end), Ruby's box room front right,
  bathroom back right. All four open straight off the landing. Shower over the bath (the
  separate shower is gone); master dresser dropped for space; wardrobe moved off an inside
  wall. In this plan y = 0 is the front of the house (front door) and the garden is at the
  back (bottom of the screen).
- **Ground floor fixes** found by the new walking tests: the dining chairs were in front of
  the cooker and sink and cut off half the kitchen and the utility room. The table and
  three chairs now sit clear of the walkway. Shoe rack removed from the foot of the stairs.
- **Art:** the pack has no stairs, shed, tree, fence, lawn or path, and its rug pieces are
  autotiles. So `tools/make_extras.py` draws them in the pack's colours into
  `assets/extras/extras.png`: stairs and stairwell (one item each now), shed, tree (one
  item), grass tile, paving path, three rugs (any size, 9-piece), front wall face.
- **Walls** now use the pack's style (white with dark grey edge), windows are glass with an
  edge, the fence is wood with a post every square. The **front wall has a face** a square
  tall, with windows and the front door, so tall furniture stands against a wall.
- Whole-house view: first floor placed 8.8 squares up, top margin 1.1, so the art stays
  the same size as before on desktop and phone.
- Tests: 37 passing. New: every room can be walked to; every first-floor room opens off the
  landing; every used piece (bed, cooker, toilet...) has a reachable free square beside it.
- Screenshots checked: whole house, ground, first, garden at desktop size, and the whole
  house at phone size (390 wide, 3x). Not yet checked by the user on a real phone.
- `docs/HOUSE_VIEW.md` updated: extras sheet, face rule, no tall pieces on inside
  cross walls, walking tests, UK layout rule, new spacing, new mistakes.

## Earlier (2026-11-11, morning)
The user asked for the project to be read and the house view fixed. The view was broken: sprites were picked from the wrong places on the sheet, stretched to uneven pixels, and laid over a 3D block scene. Fixed:
- **View:** straight down, with the back wall (y = 0) at the top of the screen. Furniture against a back wall faces the viewer, as the pack draws it. `src/render/camera.js` is now a small plan camera.
- **Sharp pixels:** one grid square is always 16 art pixels (`UNIT_PX`), the pack's own size, so sprites are never stretched. Zoom changes the size of an art pixel in whole device pixels (`main.js`).
- **Sprites:** 32 furniture sprites re-picked by looking at the sheet (`SPRITE_RECTS` in `pack.js`), and 5 floor tiles from `floors-walls.png` (four 8x8 tiles per square).
- **Drawing order** (`house.js`): floors, then rugs and paths, then walls and furniture from the top of the screen down. Doorways are gaps. A sprite stands on the bottom edge of its squares; `z` in the data lifts it (TV on its unit, lamp on a bedside table).
- **Layout** (`data/house.json`): rearranged for this view. Stairs are one square wide at x = 5, so the hall is walkable. Lounge and master doors moved to y 5-6; front and back doors to x 6-7. The second WC door (from the kitchen) is gone. Kitchen is now counter, cooker, sink, fridge along the back wall. Beds are 2x2 and 1x2. The landing has a floor. Walls are 0.25 thick (4 pixels).
- **Removed:** the cutaway button and code (no near walls from above), the "All floors" view, the old 3D projection, face shading.
- The page can open on a floor: `index.html?view=first` (or `ground`, `garden`).
- **Whole house view (default):** first floor, ground floor and garden all on one screen, so people can be followed without changing view. The first floor is drawn above the ground floor (`place` in `VIEWS`, `main.js`). Single-floor buttons remain. Every view is fitted to the screen and the canvas takes the view's shape. Floor names are written on the drawing. Method and expansion rules: `docs/HOUSE_VIEW.md` section 5.
- Wrote `docs/HOUSE_VIEW.md`: the method, the rules, how to pick sprites and check the result, and the mistakes made. `CLAUDE.md` now tells every session to read it before touching the house view.
- Tests: 34 passing, including a check that furniture stays in its room and no two pieces share a square.
- Checked in screenshots at desktop size and at phone size (390 wide, 3x pixels). Not yet checked by the user on a real phone.

## Earlier (2026-11-10) — superseded where it differs from the above
- The house view is now straight down, like a plan (the pack is top-down art). Only zoom, pan and the floor buttons remain: Ground, First, Garden. The cutaway is off by default. Tests: 31 passing. A screenshot was checked; the user has not yet seen it on a phone.
- Correction: I had called the pack front/side-view. It isn't; the furniture shows its tops and the floors are flat top-down tiles. The flat front view was wrong and has been replaced.
- Mapped 17 furniture sprites from the Sierrassets sheet (`src/render/pack.js`): sofa, armchair, two beds, dining and coffee tables, bedside table, base and wall units, TV and TV unit, wardrobe, bookcase, fridge, washing machine, plant, chair. Turned sprites on again. Tests: 30 passing.
- The user uploaded the Sierrassets "Furniture pack" to replace Cryovex. The pack is flat front/side-view art, not isometric, so the camera changed to a flat view (decision recorded in DECISIONS.md).
- Committed the pack's two sheets in `assets/furniture-pack/`: `furniture.png` (628×356) and `floors-walls.png` (135×155). The user confirmed they may be distributed. The git-ignore rule for this folder was removed. The Cryovex folder (`assets/cryovex/`) is still git-ignored.
- The zip has no licence text. The user says the source page allows use. Recorded as OPEN until the wording is checked.

## Previous session (2026-11-09)
- Wired the Cryovex pack into the renderer (`src/render/pack.js`, `blitSprite` in `raster.js`, pack-aware `drawScene`). Images stay in `assets/cryovex/`, which git ignores. Camera tilt set to 30 degrees for the 2:1 tiles. Tests: 30 passing.
- Known problems from the last screenshot: floor tiles are not visible (needs checking), the wardrobe sprite is too big for its footprint, walls are still blocks, and sprites don't turn with the 90-degree camera yet (they only show the default angle).
- Received the Cryovex free pack (4 sheets: furniture, floor, wall, decoration). Found the licence forbids redistribution, so nothing from it is committed. Built a local prototype outside the repo to test the look.
- Trial camera: fixed isometric tilt, the house turns in 90-degree steps, one-finger drag pans. Look-down and level buttons removed. Tests: 30 passing.
- Found free pixel-art packs. Chose the Cryovex free isometric interior pack (commercial use and editing allowed, credit appreciated, no redistribution). The build sandbox can't reach itch.io (403), so the user must download the zip and attach it. Not in the repo yet.
- Step 1 of the hand-drawn plan is done: `src/render/raster.js` draws every face and outline pixel by pixel with no anti-aliasing, so edges are hard. Tests: 30 passing. The shapes are still plain blocks; sprites are step 3.
- Restyled the house view to a cosy Kairosoft-style look (warm cream backdrop, dark brown outlines, wood-tile floors, warm window light, two lamps). Snapped all furniture, doors, windows and stairs to whole grid tiles, and made key pieces chunkier. Files: `data/house.json`, `src/render/scene.js`, `src/render/house.js`, `src/render/palette.js`. Tests: 26 passing.
- This is a close approximation, not a copy of hand-drawn sprites. Sprites are still the open option.
- Fixed the blurry house view: every pixel is now snapped to a fixed palette (`src/render/palette.js`, `snapFrame` in `house.js`), and art pixels are whole screen-pixel blocks. The backdrop is navy and outlines dark violet, closer to the user's reference. Tests: 26 passing.
- Set the children's ages (Oliver 5, Ruby 1), the Birmingham setting, random personalities, and the mortgage and bill figures in `docs/FAMILY.md`.
- Clocks: 1 game hour = 6.25 real minutes, a game day = 2.5 real hours, a game year = 70 real hours. Speeds: pause, 1x, 2x, 4x.
- Built and pushed:
  - `src/sim/clock.js` and `src/sim/rng.js`: game clock and seeded random numbers. Pure logic.
  - `data/house.json`: the house (ground floor, first floor, garden), doorways, fence and all furniture.
  - `src/render/scene.js`: turns the data into solid boxes, with walls, doors, windows, stairs and furniture. Also the cutaway rule.
  - `src/render/camera.js`: free camera maths (turn, tilt, zoom, pan).
  - `src/render/house.js`: draws the scene with painter's-order sorting and a pixel-art look (low-resolution draw, limited palette, flat shading bands, dark outlines).
  - `src/ui/camera-controls.js`: drag, two-finger, pinch, wheel and button controls.
  - `src/main.js` and `index.html`: the page, clock, view buttons, cutaway toggle and camera buttons.
- The app is live on GitHub Pages at https://mmans-99.github.io/family-sim/. The user has confirmed it loads.
- The sandbox can't reach github.io, so the live page is checked by the user, not by me.

## Next step
1. User checks the landscape view on a real phone (sideways and upright), and the Full screen button.
2. Build edge scenery (`docs/HOUSE_VIEW.md` section 10.5), then screenshot it.
3. User checks the calendar on the phone (the date range on the clock and the Household section).
4. L2 (stock engine and household money: accounts, bills, mortgage as ledgers), `docs/LIFE_SYSTEMS.md` section 3. Show the user the plan and wait for approval before coding.
5. Source the council tax months and school term dates (needed before L6/L7).
6. Phase 2: Tom, Oliver and Ruby (L6 to L8).
7. Record the exact Sierrassets licence wording in DECISIONS.md.

## Known issues
- Household events have no owner yet: they only write a line (money and school come in L2 and L6/L7).
- The mortgage day, payday and Christmas times are tuning (labelled in `data/calendar.json`).
- Weekdays are computed but not shown: game days do not match real weekdays.
- Sarah potters about a lot between meals, because nothing else needs doing yet. Childcare (Phase 2) and later outings will fill the day.
- Actions are never interrupted: a bath runs its full time even if she badly needs the toilet.
- No thought bubbles or real mood yet; her face follows her needs as a stand-in.
- Her face only shows on front-facing frames; from the side or back it is the plain template face.
- The sleeping head is slightly wider than one pillow on the double bed.
- A new game starts at 07:00 on Day 1 with seed 1. A saved game is kept in the browser; `?fresh=1` starts again.
- The pack only has front views. The sofa faces the viewer, not the TV, and the lower dining chairs show their backs. A back-view sofa would need drawing.
- The kitchen table has three chairs. Ruby needs a high chair (to draw on the extras sheet).
- No pets or people sprites are used yet. The zip has a pets sheet; it is not in the repo.
- The pack's readme says "Thanks for buying", so it is a paid pack. Its sheets are in the public repo on the user's instruction (see DECISIONS).
- Rooms have no name labels (floors do, in the whole-house view).
- On a phone the whole-house canvas is tall, so the zoom buttons under it need a small scroll.
- A GitHub Pages build (run #1, 9 Nov) is still listed as queued. Harmless.

## Notes for next session
- GitHub Pages only serves files. It can't run the sim while the browser is closed; catch-up on open covers this.
- The always-on option needs a server (cloud or Chromebox). Parked for later.
- Pages builds can queue behind GitHub incidents. A fresh push starts a new build.
- To run locally: `python3 -m http.server 8000`, then open http://localhost:8000.
- Bill sources and the mortgage assumption are in `docs/FAMILY.md`.
