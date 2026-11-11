"""Draws assets/extras/extras.png: the pieces the Sierrassets pack does not have.

The pack has no stairs, shed, tree, fence, garden path or lawn, and its rug pieces
are RPG-style autotiles that do not cut into whole rugs. These are drawn here, pixel
by pixel, in the pack's own colours and outline styles, at the pack's scale
(16 pixels = 1 grid square). They are our own work, so they can be shared freely.

Run from the repo root:  python3 tools/make_extras.py
Then copy the printed rectangles into EXTRA_RECTS in src/render/pack.js if they changed.
"""
from PIL import Image

INK = (0, 0, 0, 255)          # furniture sprites in the pack use black outlines
EDGE = (56, 56, 56, 255)      # floor and wall tiles in the pack use dark grey
CLEAR = (0, 0, 0, 0)

# Colours taken from the pack sheets.
WOOD_LIGHT = (210, 146, 97, 255)
WOOD = (184, 112, 61, 255)
WOOD_MID = (156, 91, 42, 255)
WOOD_DARK = (117, 63, 21, 255)
PLANK_LIGHT = (208, 192, 136, 255)
PLANK = (168, 136, 56, 255)
PLANK_DARK = (143, 101, 43, 255)
LAWN = (131, 201, 127, 255)
LAWN_PALE = (212, 224, 204, 255)
RUG_RED = (200, 120, 121, 255)
RUG_CREAM = (240, 216, 200, 255)
RUG_LINE = (201, 171, 161, 255)
WALL_WHITE = (243, 247, 243, 255)
WALL_GREY = (177, 182, 177, 255)

# Our own extra shades, chosen to sit with the pack's colours.
LAWN_DARK = (104, 172, 100, 255)
LAWN_LIGHT = (166, 220, 150, 255)
LEAF_DARK = (52, 110, 62, 255)
LEAF = (82, 150, 78, 255)
LEAF_LIGHT = (124, 186, 98, 255)
LEAF_SHINE = (170, 214, 120, 255)
STONE = (214, 206, 188, 255)
STONE_LIGHT = (232, 226, 210, 255)
STONE_JOINT = (170, 160, 140, 255)
RUG_BLUE = (118, 150, 196, 255)
RUG_BLUE_EDGE = (214, 226, 238, 255)
RUG_BLUE_LINE = (160, 180, 206, 255)
RUG_GOLD = (226, 178, 92, 255)
RUG_GOLD_EDGE = (246, 232, 196, 255)
RUG_GOLD_LINE = (214, 186, 140, 255)
SHED_ROOF = (110, 84, 70, 255)
SHED_ROOF_DARK = (82, 60, 52, 255)
SHED_ROOF_LIGHT = (140, 110, 92, 255)


def rect(im, x0, y0, x1, y1, c):
    """Fill x0..x1-1, y0..y1-1."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            im.putpixel((x, y), c)


def outline_box(im, x0, y0, x1, y1, fill, edge):
    rect(im, x0, y0, x1, y1, edge)
    rect(im, x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill)


# ---- Stairs, 1 x 4 squares (16 x 64) -------------------------------------------------

def stairs_up():
    """Ground floor flight. The bottom step is at the top of the drawing (y = 1, by the
    front door) and it climbs down the screen towards the viewer, to y = 4. Risers face
    away from the viewer, so only treads show, each edged with a dark line where it rises
    above the step behind it. Higher steps are lighter."""
    im = Image.new('RGBA', (16, 64), CLEAR)
    treads = [PLANK_DARK, PLANK, PLANK, PLANK_LIGHT]  # i = 0 is the bottom step
    for i in range(4):
        top = i * 16
        rect(im, 2, top, 13, top + 16, treads[i])
        rect(im, 2, top, 13, top + 1, INK)                # edge of this step
        rect(im, 3, top + 1, 12, top + 2, PLANK_LIGHT)    # nosing highlight
    # Stringers (side boards) and a handrail on the open (right) side.
    rect(im, 0, 0, 2, 64, WOOD_MID)
    rect(im, 0, 0, 1, 64, INK)
    rect(im, 13, 0, 16, 64, WOOD)
    rect(im, 13, 0, 14, 64, INK)
    rect(im, 15, 0, 16, 64, INK)
    for y in range(3, 64, 6):                              # balusters seen from above
        im.putpixel((14, y), WOOD_LIGHT)
    rect(im, 0, 0, 16, 1, INK)
    rect(im, 0, 63, 16, 64, INK)
    return im


def stairs_down():
    """First floor stairwell: looking down the flight, which drops towards the front.
    Treads only (risers face away). Lower steps are darker. A rail guards the open side."""
    im = Image.new('RGBA', (16, 64), CLEAR)
    shades = [(100, 76, 40, 255), PLANK_DARK, PLANK, PLANK_LIGHT]  # y = 1 lowest .. y = 4 top
    for i in range(4):
        top = i * 16
        rect(im, 2, top, 13, top + 16, shades[i])
        rect(im, 2, top, 13, top + 1, INK)                 # shadow line under the step above
        rect(im, 3, top + 2, 12, top + 3, PLANK_LIGHT if i == 3 else shades[min(3, i + 1)])
    rect(im, 0, 0, 2, 64, WOOD_MID)
    rect(im, 0, 0, 1, 64, INK)
    # Banister along the open side and across the front end.
    rect(im, 13, 0, 16, 64, WOOD_LIGHT)
    rect(im, 13, 0, 14, 64, INK)
    rect(im, 15, 0, 16, 64, INK)
    rect(im, 0, 0, 16, 3, WOOD_LIGHT)
    rect(im, 0, 0, 16, 1, INK)
    rect(im, 0, 2, 16, 3, INK)
    rect(im, 0, 63, 16, 64, INK)
    return im


# ---- Garden ---------------------------------------------------------------------------

def shed():
    """2 x 2 squares, standing 8 pixels taller than its footprint (32 x 40).
    Roof seen from above with the ridge running front to back, then the front gable wall
    and door facing the viewer."""
    im = Image.new('RGBA', (32, 40), CLEAR)
    # Roof: two slopes either side of a centre ridge.
    outline_box(im, 0, 0, 32, 26, SHED_ROOF, INK)
    rect(im, 1, 1, 16, 25, SHED_ROOF_LIGHT)             # sunny slope
    rect(im, 16, 1, 31, 25, SHED_ROOF)
    rect(im, 15, 1, 17, 25, SHED_ROOF_DARK)              # ridge
    for y in range(5, 25, 5):                            # felt strips
        rect(im, 1, y, 15, y + 1, SHED_ROOF)
        rect(im, 17, y, 31, y + 1, SHED_ROOF_DARK)
    # Front wall: vertical planks with a door.
    outline_box(im, 1, 25, 31, 40, WOOD, INK)
    for x in range(4, 30, 4):
        rect(im, x, 26, x + 1, 39, WOOD_MID)
    outline_box(im, 11, 28, 21, 40, WOOD_LIGHT, INK)     # door
    rect(im, 15, 29, 16, 39, WOOD)
    im.putpixel((19, 34), INK)                           # handle
    rect(im, 1, 25, 31, 26, INK)
    return im


def tree():
    """2 x 2 squares, standing 12 pixels taller (32 x 44): a round crown over a trunk."""
    im = Image.new('RGBA', (32, 44), CLEAR)
    # Trunk.
    outline_box(im, 13, 26, 19, 42, WOOD_MID, INK)
    rect(im, 14, 27, 15, 41, WOOD)
    # Shadow on the grass.
    for x in range(8, 24):
        im.putpixel((x, 42), LAWN_DARK)
        im.putpixel((x, 43), LAWN_DARK)
    rect(im, 13, 42, 19, 43, LEAF_DARK)
    # Crown: filled circle with outline, darker underneath, light on top-left.
    cx, cy, r = 15.5, 15.0, 15.0
    for y in range(0, 32):
        for x in range(0, 32):
            d = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) ** 0.5
            if d <= r:
                im.putpixel((x, y), INK)
            if d <= r - 1:
                lit = (x - cx) * -0.6 + (y - cy) * -0.8
                c = LEAF_DARK if lit < -7 else LEAF if lit < 1 else LEAF_LIGHT if lit < 8 else LEAF_SHINE
                im.putpixel((x, y), c)
    # Leaf clumps: a few darker curls so it is not a flat disc.
    for (x, y) in [(8, 9), (20, 7), (12, 18), (23, 16), (17, 23), (6, 17), (14, 4)]:
        for dx, dy in [(0, 0), (1, 0), (2, 1), (-1, 1)]:
            if im.getpixel((x + dx, y + dy))[3]:
                im.putpixel((x + dx, y + dy), LEAF_DARK if (x + y) % 2 else LEAF)
    return im


def grass():
    """16 x 16 lawn tile that repeats without seams."""
    im = Image.new('RGBA', (16, 16), LAWN)
    for (x, y) in [(2, 3), (9, 1), (13, 6), (5, 10), (11, 12), (1, 14), (7, 6)]:
        im.putpixel((x, y), LAWN_DARK)
        im.putpixel((x + 1, y - 1 if y else y), LAWN_DARK)
        im.putpixel((x, y + 1 if y < 15 else y), LAWN_LIGHT)
    return im


def paving():
    """16 x 16 tile of two paving slabs, for garden paths."""
    im = Image.new('RGBA', (16, 16), STONE)
    rect(im, 0, 0, 16, 1, STONE_JOINT)
    rect(im, 0, 8, 16, 9, STONE_JOINT)
    rect(im, 0, 0, 1, 16, STONE_JOINT)
    rect(im, 1, 1, 15, 2, STONE_LIGHT)
    rect(im, 1, 9, 15, 10, STONE_LIGHT)
    im.putpixel((11, 4), STONE_JOINT)
    im.putpixel((4, 12), STONE_JOINT)
    return im


def rug(main, edge, line):
    """24 x 24 rug template, cut into nine 8 x 8 pieces: corners stay, edges and
    centre repeat. Any rug size in whole squares can be built from it."""
    im = Image.new('RGBA', (24, 24), main)
    rect(im, 0, 0, 24, 24, EDGE)
    rect(im, 1, 1, 23, 23, edge)
    rect(im, 3, 3, 21, 4, line)
    rect(im, 3, 20, 21, 21, line)
    rect(im, 3, 3, 4, 21, line)
    rect(im, 20, 3, 21, 21, line)
    rect(im, 5, 5, 19, 19, main)
    return im


def wall_face():
    """16 x 16 strip of the front wall's outside face, from the pack's white wall
    pieces (white with a grey band). Repeats sideways."""
    im = Image.new('RGBA', (16, 16), WALL_WHITE)
    rect(im, 0, 0, 16, 1, EDGE)
    rect(im, 0, 3, 16, 4, WALL_GREY)
    rect(im, 0, 13, 16, 14, (222, 229, 229, 255))
    rect(im, 0, 14, 16, 16, WALL_GREY)
    return im


def window_face():
    """16 x 16 front-wall piece with a window in it."""
    im = wall_face()
    outline_box(im, 3, 5, 13, 13, (186, 220, 232, 255), EDGE)
    rect(im, 8, 6, 9, 12, WALL_WHITE)                    # glazing bar
    rect(im, 4, 6, 6, 7, (236, 248, 252, 255))           # shine
    return im


PIECES = [
    ('stairs_up', stairs_up()),
    ('stairs_down', stairs_down()),
    ('shed', shed()),
    ('tree', tree()),
    ('grass', grass()),
    ('paving', paving()),
    ('rug_red', rug(RUG_RED, RUG_CREAM, RUG_LINE)),
    ('rug_blue', rug(RUG_BLUE, RUG_BLUE_EDGE, RUG_BLUE_LINE)),
    ('rug_gold', rug(RUG_GOLD, RUG_GOLD_EDGE, RUG_GOLD_LINE)),
    ('wall_face', wall_face()),
    ('window_face', window_face()),
]


def main():
    gap = 2
    width = sum(p.width + gap for _, p in PIECES)
    height = max(p.height for _, p in PIECES)
    sheet = Image.new('RGBA', (width, height), CLEAR)
    x = 0
    rects = {}
    for name, p in PIECES:
        sheet.alpha_composite(p, (x, 0))
        rects[name] = [x, 0, p.width, p.height]
        x += p.width + gap
    sheet.save('assets/extras/extras.png')
    print('export const EXTRA_RECTS = {')
    for name, r in rects.items():
        print(f'  {name}: {r},')
    print('};')


if __name__ == '__main__':
    main()
