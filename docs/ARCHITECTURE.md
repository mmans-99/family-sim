# Architecture

(Browser app, hosted on GitHub Pages. See DECISIONS.md.)

## The big idea: separate layers
1. **Simulation** (`src/sim/`) — pure logic. Knows time, and later people, needs, money. Never draws anything. Can run fast to catch up.
2. **Scene and rendering** (`src/render/`) — turns the house data into boxes and draws them from above with pixel-art sprites.
3. **UI** (`src/ui/`, `src/main.js`) — buttons, camera controls, clock display. Later: commentary feed, person panels, diary, family tree.

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
│   └── extras/extras.png   our own pieces the pack lacks (stairs, shed, tree, lawn, path, rugs, front wall face)
├── tools/
│   └── make_extras.py      draws assets/extras/extras.png (Python + Pillow)
├── data/
│   └── house.json          house: floors, rooms, doorways, fences, furniture
├── src/
│   ├── main.js             starts everything: clock, views, camera, drawing loop
│   ├── sim/
│   │   ├── clock.js        game time, speeds, day/season/year reading
│   │   └── rng.js          seeded random numbers (mulberry32)
│   ├── render/
│   │   ├── scene.js        house data -> list of boxes (floor squares, walls, windows, doors, furniture)
│   │   ├── camera.js       plan camera: grid position -> art pixels (16 per square), pan
│   │   ├── house.js        draws the scene from above: floor tiles, flat items, then walls and sprites top to bottom
│   │   ├── raster.js       pixel-exact polygon fill, lines and sprite copying (no anti-aliasing)
│   │   ├── pack.js         sprite pack: positions on the sheets, item-to-sprite map, room floor tiles, loader
│   │   └── palette.js      fixed palette; only used to snap colours when the sprite pack is missing
│   └── ui/
│       └── camera-controls.js   drag, two-finger, pinch, wheel; button actions
└── tests/
    ├── sim.test.js         clock and random numbers
    ├── render.test.js      scene contents, plan camera, sprite maps, furniture layout, walking routes
    ├── palette.test.js     palette snapping
    └── raster.test.js      pixel-exact fills and lines
```
Planned, not built yet: `src/sim/person.js`, `needs.js`, `brain.js`, `schedule.js`, `offsite.js`, `economy.js`, `weather.js`, `events.js`, `life.js`, `log.js`, and `src/save/store.js`. Also `manifest.json` and `sw.js` for offline use.

## The tick
- The sim steps in fixed game minutes (1 tick = 1 game minute at 1x).
- Each tick: clock → (later) weather and economy → each person: needs decay, continue current action or ask brain for a new one → log events.
- The drawing loop runs every screen frame and reads the latest state.

## The house view
(Step-by-step method, rules and checks: `docs/HOUSE_VIEW.md`.)
- The view is straight down. The front of the house (y = 0, where the front door is) is at the top of the screen and the garden is at the bottom, and y grows down the screen. The default view shows the whole house on one screen, with the first floor placed above the ground floor and garden; buttons show one floor at a time.
- `scene.js` builds boxes for the chosen floor: one per floor square, walls from room edges with doorways cut out (outside walls marked `outer`), windows on outside walls, a `face` box one square tall above the front wall (with its windows and the front door), and furniture straight from `data/house.json`.
- `camera.js` turns a grid position into art pixels. One grid square is always 16 art pixels (`UNIT_PX`), the size the sprite pack is drawn at, so sprites are never stretched.
- `house.js` draws in this order: floor squares (pack tiles repeated, or a plain colour), flat items (rugs built from a 9-piece template, tiled paths, the stairwell), then the front wall face, walls, windows, fences and furniture sorted from the top of the screen down, so lower things overlap those behind. Walls, windows and fences use the pack's colours (white walls with a dark grey edge, wooden fence with posts). Doors are not drawn; a doorway is a gap in the wall.
- A furniture item whose name is in `NAME_TO_SPRITE` (`pack.js`) is drawn as a sprite, standing on the bottom edge of its squares and centred. Its `z` in the data lifts it up the screen (a TV on its unit). Other items are outlined blocks.
- A view (`VIEWS` in `main.js`) lists its floors and where each is placed on the drawing. `buildScene` shifts a placed floor's boxes; the house data and the simulation keep each floor's own coordinates. `main.js` fits the view's bounds to the screen.
- `main.js` draws into a small canvas and scales it up with hard edges. One art pixel is a whole number of device pixels. Zooming changes that number, so the art stays sharp at every zoom. Pan is turned into whole art pixels.
- The sheets are `assets/furniture-pack/furniture.png` and `floors-walls.png`, plus our own `assets/extras/extras.png`. If the pack fails to load, everything is drawn as plain blocks and snapped to the palette. If only the extras fail, those pieces fall back to blocks.

## Save format (planned)
One JSON object: `{ version, seed, time, world, people[], log[] }`.
`version` lets future sessions upgrade old saves instead of breaking them.
