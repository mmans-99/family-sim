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
│   └── make_mum.py         builds assets/people/sarah.* from Eris Esra's 16x32 template (template not in repo)
├── data/
│   ├── house.json          house: floors, rooms, doorways, fences, stairs, furniture
│   ├── needs.json          needs and how fast they drop
│   ├── actions.json        what people can do with furniture, and what it gives them
│   └── people.json         who is simulated (Sarah for now) and where they start
├── src/
│   ├── main.js             starts everything: clock, views, camera, drawing loop
│   ├── sim/
│   │   ├── clock.js        game time, speeds, day/season/year reading
│   │   ├── rng.js          seeded random numbers (mulberry32)
│   │   ├── housemap.js     walking map from house.json: squares, steps, stairs, routes, where to stand to use furniture
│   │   └── world.js        people, needs, the brain, walking, actions, log; step() = one game minute
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
    ├── world.test.js       routes, stairs, back door, scoring, chores, same-seed days, a two-day run
    ├── render.test.js      scene contents, plan camera, sprite maps, furniture layout, walking routes
    ├── palette.test.js     palette snapping
    └── raster.test.js      pixel-exact fills and lines
```
Planned, not built yet: `schedule.js`, `offsite.js`, `economy.js`, `weather.js`, `events.js`, `life.js`, `log.js`, and `src/save/store.js`. Also `manifest.json` and `sw.js` for offline use.

## The tick
- The sim steps in fixed game minutes: `step(world)` in `src/sim/world.js` is one game minute.
- Each frame, `main.js` asks the clock how many whole game minutes passed and runs that many steps.
- Each step: each person's needs drop → if free, the brain picks an action → walk along the route, or use the furniture (needs rise) → log. (Later: weather and economy before the people.)
- The drawing loop runs every screen frame and reads the latest state. `people.js` moves walkers smoothly between minutes using the part of the minute that has passed; the sim itself never reads anything from the screen.
- Testing aid: `index.html?minutes=N` starts the page N game minutes in (same steps as the clock).
- Build-time views: `SHOW_WHY` in `src/ui/panel.js` shows each person's latest decision
  (`person.why`). Set it to `false` before the finished full-screen view.
- Drawing-only effects: an action's `steam` flag (`data/actions.json`) makes `people.js` pass a
  steam frame for that person; `house.js` draws the puff after the people. The sim never reads it.

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
