# Status — the handoff file

**Update this at the end of every session.**

## Current phase
Phase 1 — house view built: a top-down pixel-art plan of each floor, drawn with the Sierrassets sprite pack. The clock is done. No people yet.

## Last session (2026-11-11)
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
1. User checks the new view on the phone (whole house and each floor).
2. Art still as blocks: stairs, garden shed and tree, rugs, fence, walls. The pack has wall tiles and rugs that could replace them.
3. Phase 1 continued: the first adult walks between rooms (the layout is now walkable), with needs and simple actions. Then the status panel (watch only).
4. Record the exact Sierrassets licence wording in DECISIONS.md.

## Known issues
- The pack only has front views. The sofa faces the viewer, not the TV, and the lower dining chairs show their backs. A back-view sofa would need drawing.
- Tall sprites on the back wall (fridge, bookcase, wardrobe, shower) stick up above the house outline. That is normal for this art style, but there is no wall face behind them.
- Ruby's room can only be reached through Oliver's room. Layout question for the user.
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
