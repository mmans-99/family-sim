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

## 2. The rules that make it look right

Break any one of these and the view looks wrong.

1. **Never stretch a sprite.** One grid square is always 16 art pixels (`UNIT_PX` in
   `camera.js`). Sprites are copied 1:1 into the small canvas.
2. **Zoom by making art pixels bigger, in whole device pixels** (`drawFrame` in
   `main.js`). Never zoom by scaling sprites.
3. **Back wall at the top.** y = 0 is the top of the screen and y grows downwards.
   Furniture that stands against a wall goes on a room's top wall (its lowest y), so its
   front faces the viewer.
4. **Draw in this order** (`drawScene` in `house.js`): floor squares, then flat things
   (rugs, paths), then walls and furniture sorted by the screen row of their bottom
   edge, top of screen first. Lower things overlap what is behind them.
5. **A sprite stands on the bottom edge of its squares, centred side to side.** Tall
   sprites (fridge, wardrobe) stick up above their square. That is intended.
6. **Things on top of other things use `z`** in `house.json` (TV on its unit, lamp on a
   bedside table). `z` lifts the sprite 16 pixels per unit and draws it after the thing
   below it.
7. **Do not palette-snap the frame when sprites are loaded.** `snapFrame` is only for
   the plain-block fallback; it would change the pack's colours.
8. **One floor per view.** Seen from above, floors cover each other.

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
   empty. The stairs are one square wide at x = 5, y = 1 to 4, on purpose.
5. To change a room's floor, edit `ROOM_TILE` in `pack.js`.

## 5. How to check the result (always look, never assume)

Run the tests, then look at real screenshots of all three floors and a phone size.

```
cd /home/claude/simulator
node --test
setsid nohup python3 -m http.server 8123 --directory /home/claude/simulator >/tmp/srv.log 2>&1 &
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/index.html     # must print 200
google-chrome --headless=new --no-sandbox --disable-gpu --window-size=1000,1000 \
  --virtual-time-budget=5000 --screenshot=/tmp/ground.png "http://localhost:8123/index.html?view=ground"
```

- Use `?view=ground`, `?view=first` and `?view=garden` to open each floor.
- For a phone, add `--force-device-scale-factor=3 --window-size=390,800`. Without the
  scale factor the house looks tiny, which is not what a real phone shows.
- The preview server often stops between commands. If curl prints `000`, start it again
  and retake the screenshot. A screenshot taken while it was down shows an error page.
- Open every screenshot with the Read tool and check: nothing cut off at the sides, no
  sprite covering another by accident, doorways are gaps, sprites face the viewer.
- The sandbox cannot open the live site (github.io). Only the user can check that.

## 6. Mistakes made, so they are not made again

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
| Described the pack's licence from the zip alone | The zip has no licence text; its readme says "Thanks for buying". Ask the user for the seller's wording |

## 7. Where things are

| File | Job |
|---|---|
| `data/house.json` | Rooms, doors, fences, furniture. The only place layout lives |
| `src/render/scene.js` | House data -> boxes (`kind`: slab, wall, window, door, fence, furniture) |
| `src/render/camera.js` | `project()`: grid position -> art pixels. `UNIT_PX`, `TARGET` |
| `src/render/pack.js` | `SPRITE_RECTS`, `NAME_TO_SPRITE`, `FLOOR_TILES`, `ROOM_TILE`, loader |
| `src/render/house.js` | `drawScene()`: the drawing order in section 2 |
| `src/render/raster.js` | `blitSprite()`: copies a sprite, skipping transparent pixels |
| `src/main.js` | Views, zoom as pixel size, pan, the frame loop |

## 8. After any change

Follow "After every change" in `CLAUDE.md`: update STATUS, DECISIONS, ROADMAP and
ARCHITECTURE as needed, update this file if the method changed, commit, push, and copy
the changed docs to the Project.
