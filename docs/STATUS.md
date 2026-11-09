# Status — the handoff file

**Update this at the end of every session.**

## Current phase
Phase 1 — first slice built: clock with speed controls, house floor plan. No people yet.

## Last session
- 2026-11-09: Checked bill figures (energy cap £1,723/yr, Birmingham Band D £2,363, Severn Trent water £587/yr) and recorded them in `docs/FAMILY.md`.
- Built the first Phase 1 slice:
  - `src/sim/clock.js`: game clock (1 game minute = 6.25 real seconds at 1x; day 2.5 h; year 70 h). Pure logic.
  - `src/sim/rng.js`: seeded random numbers.
  - `data/house.json`: 3-bed semi floor plan (ground, first, garden), top-down.
  - `src/render/house.js` and `src/main.js`: draws the floor, clock and speed buttons.
  - `tests/sim.test.js`: 12 tests, all passing (`npm test`).
- Not yet checked in a browser. The drawing and buttons have not been looked at on screen.

## Next step
1. Open the app locally (see below) and check that the clock, speed buttons and floor buttons work.
2. Add doors and an isometric pixel-art view of the house.
3. Add the first adult who walks around and has needs.

## Known bugs / problems
- Browser preview not yet tested. Expect small layout issues on phone screens.

## How to run it locally
ES modules don't load from `file://`, so run a small server from the project folder:
`python3 -m http.server 8000`, then open http://localhost:8000 in the browser.

## Notes for next session
- GitHub Pages only serves files. It can't run the sim while the browser is closed; catch-up on open covers this.
- The always-on option needs a server (cloud or Chromebox). Parked for later.
- Bill sources and the mortgage assumption are in `docs/FAMILY.md`.
