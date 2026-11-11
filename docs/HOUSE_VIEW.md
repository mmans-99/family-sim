# House view — how it was built, and how to change it safely

Read this before touching anything in `src/render/`, `data/house.json` or `assets/`.
It records the method that worked and the mistakes that were made on the way, so they
are not repeated.

## 1. Facts about the art (check these first, never guess)

The art is the Sierrassets "Furniture pack". Two sheets are in `assets/furniture-pack/`:

| File | Size | What it holds |
|---|---|---|
| `furniture.png` | 628 x 356 | About 500 furniture sprites, packed with no fixed grid |
| `floors-walls.png` | 135 x 155 | Floor and wall tiles, 8 x 8 pixels each, on a 9-pixel pitch |

- **View:** top-down, drawn as if you stand at the front of the room looking at the back
  wall. You see the top and the front of each piece. It is not isometric and not side-on.
- **Scale:** 16 sprite pixels = 1 grid square of the house. A double bed is 32 wide
  (2 squares), a fridge 16 wide (1 square), a chair about 10 wide.
- **Directions:** almost everything has a front view only. There is no back-view sofa.
  Dining chairs have a front view and a back view.
- **Floor tiles** start at x = 27. Rows: y = 1 plank, 10 dark plank, 19 parquet,
  28 blue tile, 37 white tile. The first tile in each row (x = 27) is the plain one;
  the others in the row carry wall shadows.
- There is no atlas file. The zip's "individual sprites" are only numbered slices with
  no names. Sprites must be found by looking.
- The pink, green and white blocks on `floors-walls.png` (x 27-135, y 46-155) are RPG-style
  autotiles. Every 8x8 piece carries part of an inner outline, so they do not cut into a
  whole rug or lawn. Do not try again; use the extras sheet below.
- The pack has **no stairs, shed, tree, fence, lawn or garden path.**

### Our own extras sheet
`assets/extras/extras.png` holds what the pack lacks: `stairs_up` and `stairs_down`
(16 x 64, one flight), `shed` (32 x 40), `tree` (32 x 44), `grass` and `paving` (16 x 16
repeating tiles), `rug_red`, `rug_blue`, `rug_gold` (24 x 24 templates, cut into nine 8 x 8
pieces so a rug can be any size in whole squares), `wall_face` and `window_face` (16 x 16),
and people: `sarah_stand`, `sarah_walk` (12 x 21), `sarah_sit` (12 x 17), `sarah_lie`
(10 x 9, just the head). People are drawn from letter grids in the script, one letter per
pixel, so a new person is a new colour table on the same grids.
It is drawn pixel by pixel by `tools/make_extras.py` in the pack's colours: black outlines
for objects (like the pack's furniture), dark grey (56, 56, 56) for floor-level things
(like the pack's tiles). To change or add a piece: edit the script, run
`python3 tools/make_extras.py` from the repo root, paste the printed rectangles into
`EXTRA_RECTS` in `pack.js`, and look at the sheet enlarged before using it.

### People: Mum's animated sheet
`assets/people/sarah.png` (+ `sarah.json`, frame name -> rectangle) is made by
`tools/make_mum.py` from Eris Esra's 16x32 character template (32 x 32 frames, figure about
16 x 25 pixels, feet on the bottom row). Frames are named `anim_direction_frame[_face]`:
- anim: `idle`, `walk`, `interact` (4 frames each), `sit` (front only), and `lie` (the head,
  eyes shut, for bed and bath);
- direction: `front`, `front_right`, `right`, `back_right`, `back`, and the mirrored
  `front_left`, `left`, `back_left`;
- face (front frames only): none (content), `_happy`, `_tired`, `_uneasy`.
The script paints by rules from each frame's own pixels (the head squashes and tilts
between frames, so a fixed hair image does not fit): hair from the head's outline per
direction, skin above the neck, top down to the hips, jeans below, shoes on each leg's
lowest pixel, hands wherever the arms reach past the hips. Then it outlines any hair that
sticks out past the old outline. To make another person: copy the script, change the
colours and the hair rules, run it, look at every frame enlarged.
- **Licence:** the template may be used in games; a free game must credit and link it (in
  the page footer); the template itself must not be redistributed, so it is not in the
  repo. Download it from https://erisesra.itch.io/character-templates-pack to re-run.
- The old simple Sarah sprites on the extras sheet remain as a fallback if the sheet
  fails to load.

## 2. The rules that make it look right

Break any one of these and the view looks wrong.

1. **Never stretch a sprite.** One grid square is always 16 art pixels (`UNIT_PX` in
   `camera.js`). Sprites are copied 1:1 into the small canvas.
2. **Zoom by making art pixels bigger, in whole device pixels** (`drawFrame` in
   `main.js`). Never zoom by scaling sprites.
3. **Top wall is the one facing the viewer.** y = 0 is the top of the screen and y grows
   downwards. On the house that top wall is the front (street side, front door); the
   garden is at the bottom. Furniture that stands against a wall goes on a room's top wall
   (its lowest y), so its front faces the viewer.
4. **Draw in this order** (`drawScene` in `house.js`): floor squares, then flat things
   (rugs, paths, the stairwell), then the front wall face, walls, windows, fences and
   furniture sorted by the screen row of their bottom edge, top of screen first (so a floor
   placed higher on the drawing is drawn first). Lower things overlap what is behind them.
5. **A sprite stands on the bottom edge of its squares, centred side to side.** Tall
   sprites (fridge, wardrobe) stick up above their square. That is intended.
6. **Things on top of other things use `z`** in `house.json` (TV on its unit, lamp on a
   bedside table). `z` lifts the sprite 16 pixels per unit and draws it after the thing
   below it.
7. **Do not palette-snap the frame when sprites are loaded.** `snapFrame` is only for
   the plain-block fallback; it would change the pack's colours.
8. **Floors never overlap on the drawing.** Seen from above, the first floor would cover
   the ground floor, so a view that shows both places them apart (section 5).
9. **The front wall has a face.** `scene.js` adds a `face` box one square tall above the
   front (top) outside wall, with its windows and the front door drawn on it. Tall sprites
   on that wall stand against it. Its windows are drawn on the face only, not again on the
   wall line. Other walls have no face: a face on an inside wall would cover the bottom row
   of the room above it.
10. **No tall sprites on inside walls that run across the screen.** A wardrobe or shower
   against such a wall sticks up into the room above it on the drawing. Put tall pieces on
   the front wall or against side walls.

## 3. How to find a sprite on the sheet (the step that went wrong before)

The first attempt typed rectangles from a quick look and got beds where bookcases
should be. Do it this way instead.

1. Find every separate shape on the sheet with a flood fill over non-transparent
   pixels (Python with Pillow). Save each shape's `[x, y, width, height]` with a number.
2. Cut the sheet into pieces of about 210 x 120 pixels. Enlarge each 5 times with
   nearest-neighbour, on a plain blue background, and draw each shape's box and number
   on it.
3. **Look at every piece** with the Read tool. Pick sprites by their number.
4. Print the rectangles for the chosen numbers and paste them into `SPRITE_RECTS` in
   `src/render/pack.js`. Never type a rectangle from memory or by estimating.
5. Check the size against the footprint: width / 16 = squares wide. If the sprite is
   32 wide, the item in `house.json` must have `w: 2`.

For floor tiles, enlarge `floors-walls.png` 7 times with a grid line every 8 pixels and
read the positions off it, then confirm with `getpixel` that the tile's corner is solid
and the pixel just outside it is transparent.

## 4. How to add or change furniture

1. Add the item to `furniture` in `data/house.json`: `floor`, `name`, `x`, `y`, `w`,
   `d`, `h`, `colour`, and `z` only if it sits on something. Whole numbers for
   `x`, `y`, `w`, `d`.
2. If it should be a sprite, find it (section 3), add it to `SPRITE_RECTS`, and map the
   item's `name` to it in `NAME_TO_SPRITE`. Without a mapping it is drawn as an
   outlined block in its `colour`, which is a fine fallback.
3. Keep it inside one room, off doorway squares, and off squares another standing piece
   uses. `tests/render.test.js` checks the first and last of these.
4. Keep a walking route: every room's door square and the squares in front of it stay
   empty. The stairs are one square wide at x = 5, y = 1 to 4, on purpose, and the square
   at each end (x 5, y 0 and y 5) stays clear. Two tests check routes: every room can be
   walked to, and every piece someone uses (bed, cooker, toilet, chair...) has a free
   square beside it that can be walked to. They caught dining chairs blocking the cooker
   and a bed boxed in by a wardrobe, so run them after every layout change.
5. The first floor follows a UK 3-bed semi: every bedroom and the bathroom opens straight
   off the landing (a test checks this). Doors onto the landing's left side can only be
   at y 0-1 or y 5-6, because the stairwell takes x = 5, y = 1 to 4.
6. Stairs, stairwell, shed and tree are one item each (`stairs`, `stairwell`, `shed`,
   `tree`), matching one sprite. Rugs are flat items named `rug`, `blue rug` or
   `gold rug`, at least one square each way; paths are `path`.
7. To change a room's floor, edit `ROOM_TILE` in `pack.js`.

## 5. Views: the whole house on one screen

The page opens on **Whole house**: every floor on one screen, so people can be followed
without changing view. The other buttons show one floor, bigger.

How it works (all in `VIEWS` in `src/main.js`, drawn by the same `drawScene`):

- A view is `{ label, floors, place, labels }`. `floors` lists floor ids from
  `house.json`. `place` moves a whole floor on the drawing, in grid squares.
- In the whole-house view the first floor has `place: { first: { x: 0, y: -8.8 } }`:
  it is drawn 8.8 squares up the screen, above the ground floor. The ground floor and
  garden are not moved; the garden already joins the back of the house at y = 6.
- `buildScene(house, floors, place)` in `scene.js` shifts every box of a placed floor and
  stamps each box with `b.floor`. Nothing else knows about the shift. `house.json` and
  the simulation always use the floor's own coordinates.
- `sceneBounds(boxes)` gives the rectangle that holds the view, including the front wall
  face. `main.js` adds `MARGIN` (1.1 squares on top, for the floor name) and then:
  - shapes the canvas to the view, capped at the screen height left after the buttons;
  - picks the biggest whole device-pixel size at which the whole view fits both ways;
  - centres the view (`cam.cx`, `cam.cy`).
- `labels` are floor names written above a floor's back wall, as normal page text over
  the canvas, so they stay readable.

Rules when expanding it:

1. **Leave at least 1.5 squares between a floor and the top of the front wall face of the
   floor below it on the drawing**, for the floor name. A test checks this. More space
   makes the whole view taller, which can drop the art pixel size on a phone.
2. **To add a floor** (loft, cellar, extension): add it to `floors` in `house.json` with
   its own id, add its id to the `all` view's `floors`, give it a `place` so it does not
   overlap, add a label, and add a button entry if it should have its own view. Phones
   are tall and narrow, so stack new floors up or down the screen, not sideways.
3. **People are drawn this way** (`src/render/people.js`): position = own floor
   coordinates plus `view.place[floorId]`, passed through `project()`. Not drawn if the
   view does not include that floor. The simulation never stores shifted coordinates.
   - Standing or walking: feet 0.8 down the square, centred. Walkers move smoothly using
     the part of the game minute that has passed; the step sprite alternates every half
     square.
   - Sitting (`on: "sit"`): centred on the furniture, feet 0.3 above its bottom edge, so
     the seat shows below them. Lying: head at the left end, near the top (pillow, bath).
   - Sort row: their feet, except on furniture (just after the furniture) and on the stairs
     (after the whole flight, which is one tall sprite, or they vanish behind it).
   - Frame choice: walking uses `walk` facing the step (down the screen = front), a full
     cycle per square. Using something while standing uses `interact` facing it (so she has
     her back to you at the cooker). Pottering uses `idle` facing front. Idle and interact
     step a frame every 220 ms of real time; that is display only.
4. **Someone on the stairs** is on the ground floor until they step off the top step onto
   the landing (first floor, x 5, y 5). They swap floors halfway across that step.
5. Tapping a person later should work in every view, so turn a tap back into grid squares
   by undoing `project()` and then subtracting the floor's `place`.

## 6. How to check the result (always look, never assume)

Run the tests, then look at real screenshots of all three floors and a phone size.

```
cd <repo folder>          # e.g. /home/claude/family-sim
node --test
setsid nohup python3 -m http.server 8123 >/tmp/srv.log 2>&1 &
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/index.html     # must print 200
google-chrome --headless=new --no-sandbox --disable-gpu --window-size=1000,1000 \
  --virtual-time-budget=5000 --screenshot=/tmp/ground.png "http://localhost:8123/index.html?view=ground"
```

- With no `?view=` the page opens on the whole house. Use `?view=ground`, `?view=first`
  and `?view=garden` to open each floor. Check the whole house and every single floor.
- For a phone, add `--force-device-scale-factor=3 --window-size=390,800`. Without the
  scale factor the house looks tiny, which is not what a real phone shows.
- The preview server often stops between commands. If curl prints `000`, start it again
  and retake the screenshot. A screenshot taken while it was down shows an error page.
- Open every screenshot with the Read tool and check: nothing cut off at the sides, no
  sprite covering another by accident, doorways are gaps, sprites face the viewer.
- The sandbox cannot open the live site (github.io). Only the user can check that.

## 7. Mistakes made, so they are not made again

| Mistake | What to do instead |
|---|---|
| Called the pack "front/side view" without looking closely, and built a side-on camera | Enlarge a few sprites and the floor sheet and look, before choosing any camera |
| Typed sprite rectangles from a rough look | Section 3: number the shapes, look at all of them, copy the rectangles |
| Scaled sprites to fit the old zoom (0.7x), giving uneven pixels | 16 art pixels per square, always; zoom changes pixel size |
| Laid sprites over the old 3D block scene | Top-down only; one drawing order (section 2) |
| Left helper blocks (sofa back, mattress, headboard) drawing over sprites | One item per piece of furniture in `house.json` |
| y = 0 at the bottom, so wall furniture showed its back | y = 0 at the top |
| Stairs two squares wide filled the hall | Check a walking route after every layout change |
| Said a change was done before looking at a screenshot | Screenshot all three floors first |
| A docs script failed halfway and one doc was left stale | After any script, run `git status` and re-read what changed |
| Dining chairs put in the walkway in front of the cooker and sink; a bed boxed in by a wardrobe | Run the walking tests after every layout change (section 4) |
| Windows drawn twice on the front wall (face and wall line) | Front wall windows go on the face only |
| Tried to cut rugs out of the pack's autotiles | They are autotiles; use the extras sheet |
| Covered a person with their whole sprite frame, so the cover spilled onto the wall | Use the sprite's visible pixels (`opaqueBounds` in `house.js`) plus one pixel |
| Described the pack's licence from the zip alone | The zip has no licence text; its readme says "Thanks for buying". Ask the user for the seller's wording |

## 8. Where things are

| File | Job |
|---|---|
| `data/house.json` | Rooms, doors, fences, furniture. The only place layout lives |
| `src/render/scene.js` | House data -> boxes (`kind`: slab, wall, window, door, fence, furniture); `place` shifts a floor; `sceneBounds` |
| `src/render/camera.js` | `project()`: grid position -> art pixels. `UNIT_PX`, `TARGET` |
| `src/render/pack.js` | `SPRITE_RECTS`, `EXTRA_RECTS`, `NAME_TO_SPRITE`, `NAME_TO_TILE`, `NAME_TO_RUG`, `FLOOR_TILES`, `ROOM_TILE`, loader |
| `tools/make_extras.py` | Draws `assets/extras/extras.png` |
| `src/render/house.js` | `drawScene()`: the drawing order in section 2, people sorted in |
| `src/render/people.js` | Where to draw each person, from the simulation |
| `src/render/raster.js` | `blitSprite()`: copies a sprite, skipping transparent pixels |
| `src/main.js` | `VIEWS` (which floors, where placed), fitting a view to the screen, zoom as pixel size, pan, floor names, the frame loop |

## 9. After any change

Follow "After every change" in `CLAUDE.md`: update STATUS, DECISIONS, ROADMAP and
ARCHITECTURE as needed, update this file if the method changed, commit, push, and copy
the changed docs to the Project.
