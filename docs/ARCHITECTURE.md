# Architecture

(Browser app, hosted on GitHub Pages. See DECISIONS.md.)

## The big idea: separate layers
1. **Simulation** (`src/sim/`) — pure logic. Knows time, and later people, needs, money. Never draws anything. Can run fast to catch up.
2. **Scene and rendering** (`src/render/`) — turns the house data into 3D boxes, projects them with the camera, and draws them in a pixel-art style.
3. **UI** (`src/ui/`, `src/main.js`) — buttons, camera controls, clock display. Later: commentary feed, person panels, diary, family tree.

## Folder layout (as built)
```
simulator/
├── CLAUDE.md               working rules
├── index.html              the page (loads src/main.js as a module)
├── package.json            `npm test` runs node --test
├── .nojekyll               tells GitHub Pages to skip Jekyll (plain static site)
├── docs/                   project memory (see CLAUDE.md)
├── data/
│   └── house.json          house: floors, rooms, doorways, fences, furniture
├── src/
│   ├── main.js             starts everything: clock, views, camera, drawing loop
│   ├── sim/
│   │   ├── clock.js        game time, speeds, day/season/year reading
│   │   └── rng.js          seeded random numbers (mulberry32)
│   ├── render/
│   │   ├── scene.js        house data -> list of solid boxes; cutaway rule
│   │   ├── camera.js       fixed isometric tilt, 90-degree turns, zoom, pan maths; projection; face visibility; shading
│   │   ├── house.js        draws the boxes (sorted faces, pixel-art colours and outlines)
│   │   ├── raster.js       pixel-exact polygon fill, 1-pixel lines, sprite blitting (no anti-aliasing)
│   │   ├── pack.js         sprite pack: sheet positions, item-to-sprite map, floor tiles, loader (images not in repo)
│   │   └── palette.js      the fixed pixel-art palette (10 levels per channel); snaps every pixel to its nearest colour
│   └── ui/
│       └── camera-controls.js   drag, two-finger, pinch, wheel; button actions
└── tests/
    ├── sim.test.js         clock and random numbers
    ├── render.test.js      cutaway, scene contents, camera maths
    ├── palette.test.js     palette snapping
    └── raster.test.js      pixel-exact fills and lines
```
Planned, not built yet: `src/sim/person.js`, `needs.js`, `brain.js`, `schedule.js`, `offsite.js`, `economy.js`, `weather.js`, `events.js`, `life.js`, `log.js`, and `src/save/store.js`. Also `manifest.json` and `sw.js` for offline use.

## The tick
- The sim steps in fixed game minutes (1 tick = 1 game minute at 1x).
- Each tick: clock → (later) weather and economy → each person: needs decay, continue current action or ask brain for a new one → log events.
- The drawing loop runs every screen frame and reads the latest state.

## The house view
- `scene.js` builds solid boxes for the chosen floors. Walls are built from room edges, with doorways cut out. Outside walls are brick and get windows. Furniture comes straight from `data/house.json`.
- The camera has a fixed 30-degree tilt (the 2:1 tile shape that pixel-art sprites use). The turn buttons move it in 90-degree steps (the four views are 90 degrees apart, starting at 45 degrees). Drag pans, pinch and wheel zoom.
- If the sprite pack is present in `assets/cryovex/` (git-ignored, not committed), floor tiles and furniture named in `pack.js` are drawn as sprites; otherwise they stay plain blocks. The art grid is 181 pixels across, so one grid tile is 16 pixels, matching the pack.
- `applyCutaway` runs every frame. Walls nearer the camera than the middle of the house drop to a low ledge, and their doors and windows are removed.
- Floors are drawn as one box per grid tile, alternate tiles a shade darker. Windows and doors are one tile wide. Furniture footprints are whole tiles (`data/house.json`).
- `house.js` projects each visible face, sorts far to near, adds a warm tint, then fills and outlines it pixel by pixel with `raster.js`. Nothing is anti-aliased, so edges are hard.
- `main.js` draws into a small canvas, then snaps every pixel to the palette (`snapFrame` in `house.js`, using `palette.js`) to remove blurry in-between colours, then scales it up with hard edges. One art pixel is a whole number of screen pixels (min 3), sized so the art grid is about 190 pixels across. Pan is scaled to match.

## Save format (planned)
One JSON object: `{ version, seed, time, world, people[], log[] }`.
`version` lets future sessions upgrade old saves instead of breaking them.
