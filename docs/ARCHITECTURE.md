# Architecture

(Assumes the recommended browser platform; revise if DECISIONS changes it.)

## The big idea: three separate layers
1. **Simulation** (`src/sim/`) — pure logic. Knows people, needs, time, money.
   Never draws anything. Can run 1000x speed to catch up.
2. **Renderer** (`src/render/`) — reads the sim state and draws the house and
   people. Smoothly animates between sim steps.
3. **UI** (`src/ui/`) — clock, speed buttons, commentary feed, person panels,
   diary, family tree.

## Planned folder layout
```
simulator/
├── CLAUDE.md               working rules
├── docs/                   the memory of the project (see CLAUDE.md)
├── index.html              entry point
├── manifest.json, sw.js    offline PWA
├── data/                   content, not code
│   ├── house.json          rooms, walls, doors, object positions
│   ├── objects.json        what each object offers (fridge → eat, +hunger)
│   ├── actions.json        actions, durations, need effects, who can do them
│   ├── jobs.json           jobs, hours, pay
│   ├── traits.json         personality traits and their effects
│   ├── events.json         random life events
│   └── text/               commentary sentence templates
├── assets/                 sprites, tiles, sounds
├── src/
│   ├── main.js             starts everything
│   ├── sim/
│   │   ├── clock.js        game time, speeds, day/year
│   │   ├── rng.js          seeded random
│   │   ├── world.js        top-level state + tick()
│   │   ├── person.js       a person's data
│   │   ├── needs.js        need decay and effects
│   │   ├── brain.js        decides what to do next (utility AI)
│   │   ├── emotions.js     mood and emotions
│   │   ├── relationships.js
│   │   ├── schedule.js     work/school/nursery
│   │   ├── offsite.js      what happens outside the house
│   │   ├── life.js         ageing, life stages, births, deaths
│   │   ├── economy.js      money, prices, bills
│   │   ├── weather.js      weather and seasons
│   │   ├── events.js       random events
│   │   └── log.js          event log → commentary + diaries
│   ├── render/
│   │   ├── house.js        draws the map
│   │   ├── sprites.js      draws people, animations
│   │   ├── path.js         pathfinding (A*) on the grid
│   │   └── camera.js       pan/zoom for phone
│   ├── ui/
│   │   ├── controls.js     clock and speed
│   │   ├── feed.js         running commentary
│   │   ├── panel.js        tap a person → needs, mood, thoughts
│   │   └── tree.js         family tree, diaries
│   └── save/
│       └── store.js        save/load (IndexedDB), version upgrades
└── tests/                  sim tests (run headless)
```

## The tick
- Sim steps in fixed game-minutes (1 tick = 1 game minute).
- Each tick: clock → weather/economy (rarely) → each person: needs decay,
  continue current action or ask brain for a new one → log events.
- Renderer draws at screen frame rate, interpolating positions.

## Save format
One JSON object: `{ version, seed, time, world, people[], log[] }`.
`version` lets future sessions upgrade old saves instead of breaking them.
