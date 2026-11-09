# Status — the handoff file

**Update this at the end of every session.**

## Current phase
Phase 1 — house view built (3D dollhouse, pixel-art style, cutaway, free camera). The clock is done. No people yet.

## Last session (2026-11-09)
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
1. Fix the known problems above: floor tiles, sprite sizes, then walls.
2. Once the user makes the repo private, commit the pack images (the licence forbids public redistribution). Note: GitHub Pages won't publish a private repo on a free account.
2. Get feedback on the house view on the phone (cutaway, camera, text size).
3. Phase 1 continued (after the art): the first adult walks between rooms, with needs and simple actions. Then the status panel (watch only).

## Known issues
- A GitHub Pages build (run #1, from 18:26 on 9 Nov) is still listed as queued. It's harmless: a later build succeeded.
- Rooms have no name labels in the 3D view yet.
- No roof. Walls are plain. The look is rendered from 3D shapes, so it's close to, not the same as, the hand-drawn reference. Colours are a first pass and may need tuning on a phone.
- Floor tiles and furniture colours are busy in places. Needs a visual pass after the user's feedback.
- The house view has only been tested in a desktop-sized preview, not on a real phone.

## Notes for next session
- GitHub Pages only serves files. It can't run the sim while the browser is closed; catch-up on open covers this.
- The always-on option needs a server (cloud or Chromebox). Parked for later.
- Pages builds can queue behind GitHub incidents. A fresh push starts a new build.
- To run locally: `python3 -m http.server 8000`, then open http://localhost:8000.
- Bill sources and the mortgage assumption are in `docs/FAMILY.md`.
