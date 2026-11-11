"""Builds Mum (Sarah) from Eris Esra's 16x32 character template.

The template is a bald mannequin with idle, walk and interact animations, 4 frames each, in
5 directions (front, front three-quarter, side, back three-quarter, back), on 32 x 32 frames.
This script paints over every frame by rules worked out from that frame's own pixels:
shoulder-length brown hair, skin tone, a teal top, jeans and shoes. Left-facing frames are
mirror images. It also makes a sitting pose, a sleeping head, and a few faces for the
front-facing frames.

The template itself is NOT in this repo: its licence does not allow repackaging it. Download
"Character Templates Pack" from https://erisesra.itch.io/character-templates-pack, unzip it,
and run from the repo root:

    python3 tools/make_mum.py "<unzipped folder>/16x32"

Output: assets/people/sarah.png (the sheet) and assets/people/sarah.json (where each frame is).
Original character template created by Eris Esra: https://erisesra.itch.io/character-templates-pack
"""
import json
import sys
from pathlib import Path
from PIL import Image

FRAME = 32
DIRS = ['front', 'front_right', 'right', 'back_right', 'back']   # template rows, facing right
MIRROR = {'front_left': 'front_right', 'left': 'right', 'back_left': 'back_right'}
ANIMS = {'idle': 'Idle', 'walk': 'Walk', 'interact': 'Interact'}

# Template colours.
OUT = (47, 37, 34, 255)
BASE = (250, 243, 232, 255)
SHADE = (185, 179, 161, 255)
LIGHT = (231, 213, 198, 255)   # mouth and chin area
BLUSH = (209, 157, 167, 255)

# Mum's colours.
SKIN = {BASE: (240, 198, 164, 255), SHADE: (210, 156, 126, 255), LIGHT: (228, 180, 148, 255), BLUSH: (222, 140, 128, 255)}
HAIR = (122, 76, 46, 255)
HAIR_DARK = (88, 52, 32, 255)
HAIR_LIGHT = (156, 104, 66, 255)
TOP = (66, 156, 150, 255)
TOP_DARK = (44, 112, 112, 255)
JEANS = (72, 92, 142, 255)
JEANS_DARK = (52, 66, 108, 255)
SHOE = (92, 66, 54, 255)
SHOE_DARK = (64, 46, 38, 255)
CLEAR = (0, 0, 0, 0)


def opaque(im, x, y):
    return 0 <= x < im.width and 0 <= y < im.height and im.getpixel((x, y))[3] > 0


def top_row(im):
    for y in range(im.height):
        if any(opaque(im, x, y) for x in range(im.width)):
            return y
    return 0


def span(im, y, inner=False):
    """Leftmost and rightmost opaque pixel on a row (inner: not counting outline)."""
    xs = [x for x in range(im.width) if opaque(im, x, y) and (not inner or im.getpixel((x, y)) != OUT)]
    return (min(xs), max(xs)) if xs else None


def recolour(c, main, dark):
    if c in (BASE, LIGHT, BLUSH):
        return main
    if c == SHADE:
        return dark
    return c


def hair_mask(im, t, direction):
    """Squares to paint as hair, as a set of (x, y). Rules per direction, from the head's own
    outline, so squashed and tilted frames still fit."""
    hair = set()
    for r in range(0, 11):
        y = t + r
        sp = span(im, y, inner=True)
        if not sp:
            continue
        L, R = sp
        mid = (L + R) / 2
        for x in range(L, R + 1):
            if im.getpixel((x, y)) == OUT:
                continue
            if direction == 'back':
                hair.add((x, y))
            elif direction == 'back_right':
                if r <= 4 or x < R - 1:
                    hair.add((x, y))
            elif direction == 'right':
                if r <= 3 or (r == 4 and x < R - 1) or x <= mid:
                    hair.add((x, y))
            elif direction == 'front_right':
                if r <= 3 or (r == 4 and x < mid + 1) or (r <= 9 and x <= L + 1) or (r <= 6 and x == R):
                    hair.add((x, y))
            else:  # front
                if r <= 3 or (r == 4 and not (mid - 2 <= x <= mid)) or (r <= 9 and (x == L or x == R)):
                    hair.add((x, y))
    # Shoulder-length hair below the head: down the sides at the front, over the neck at the back.
    head = span(im, t + 7)
    if head:
        L, R = head
        for r in range(5, 13):
            y = t + r
            if direction == 'front':
                cols = [L, L + 1, R - 1, R] if r <= 10 else []
            elif direction == 'front_right':
                cols = [L, L + 1, L + 2]
            elif direction == 'right':
                cols = [L, L + 1, L + 2, L + 3]
            else:
                cols = list(range(L + 2, R - 1)) if r >= 10 else []
            for x in cols:
                if r >= 10 or not (L < x < R) or direction in ('right', 'front_right'):
                    hair.add((x, y))
    return hair


def paint(im, direction):
    im = im.copy()
    t = top_row(im)
    hair = hair_mask(im, t, direction)
    # Hip width from the legs' inside pixels (outline would include the hands beside them).
    hips = span(im, t + 20, inner=True) or span(im, t + 19, inner=True)
    if hips:
        hips = (hips[0] - 1, hips[1] + 1)
    src = im.copy()
    for y in range(im.height):
        for x in range(im.width):
            c = src.getpixel((x, y))
            if (x, y) in hair:
                continue
            if c[3] == 0 or c == OUT:
                continue
            r = y - t
            if r <= 11:
                im.putpixel((x, y), SKIN.get(c, c))
            elif r <= 18:
                hand = r >= 16 and hips and not (hips[0] <= x <= hips[1])
                im.putpixel((x, y), SKIN.get(c, c) if hand else recolour(c, TOP, TOP_DARK))
            else:
                hand = r <= 19 and hips and not (hips[0] <= x <= hips[1])
                below = any(opaque(src, x, yy) and src.getpixel((x, yy)) != OUT for yy in range(y + 1, im.height))
                if hand:
                    im.putpixel((x, y), SKIN.get(c, c))
                elif not below and r >= 21:
                    im.putpixel((x, y), recolour(c, SHOE, SHOE_DARK))
                else:
                    im.putpixel((x, y), recolour(c, JEANS, JEANS_DARK))
    for (x, y) in hair:
        if not (0 <= x < im.width and 0 <= y < im.height):
            continue
        c = src.getpixel((x, y))
        dark = c == SHADE or (y - t >= 9)
        im.putpixel((x, y), HAIR_DARK if dark else HAIR)
    # A highlight on the crown.
    sp = span(im, t + 2, inner=True)
    if sp and direction != 'back':
        for x in range(sp[0] + 2, min(sp[0] + 5, sp[1])):
            if (x, t + 2) in hair:
                im.putpixel((x, t + 2), HAIR_LIGHT)
    # Outline round hair that now sticks out past the old outline.
    for (x, y) in list(hair):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < im.width and 0 <= ny < im.height and im.getpixel((nx, ny))[3] == 0:
                im.putpixel((nx, ny), OUT)
    return im


# ---- Faces (front view only). Drawn over the template's eye and mouth rows. ----------------
# Eyes are the two 1-wide, 3-tall outline marks on rows t+6..t+8; the mouth row is t+8.

def face(im, mood):
    im = im.copy()
    t = top_row(im)
    marks = [x for x in range(im.width)
             if im.getpixel((x, t + 6)) == OUT and im.getpixel((x, t + 7)) == OUT
             and opaque(im, x - 1, t + 7) and im.getpixel((x - 1, t + 7)) != OUT
             and opaque(im, x + 1, t + 7) and im.getpixel((x + 1, t + 7)) != OUT]
    if len(marks) != 2:
        return im
    a, b = marks
    skin = SKIN[BASE]
    mouth_y = t + 8
    mx = (a + b) // 2
    if mood == 'asleep' or mood == 'tired':
        for x in (a, b):
            im.putpixel((x, t + 6), skin)
            if mood == 'asleep':
                im.putpixel((x, t + 7), skin)
                im.putpixel((x, t + 8), OUT)
                im.putpixel((x + (1 if x == a else -1), t + 8), OUT)
            else:
                im.putpixel((x, t + 7), OUT)
    if mood == 'happy':
        for x in range(mx - 1, mx + 2):
            im.putpixel((x, mouth_y + 1), OUT)
        im.putpixel((mx - 2, mouth_y), OUT)
        im.putpixel((mx + 2, mouth_y), OUT)
    elif mood == 'uneasy':
        im.putpixel((a - 1, t + 5), OUT)
        im.putpixel((b + 1, t + 5), OUT)
        for x, dy in ((mx - 1, 1), (mx, 0), (mx + 1, 1)):
            im.putpixel((x, mouth_y + dy), OUT)
    return im


MOODS = ['content', 'happy', 'tired', 'uneasy']


def mirror(im):
    return im.transpose(Image.FLIP_LEFT_RIGHT)


def sit_pose(im):
    """Front idle frame, legs cut short: thighs come towards the viewer, so only the hips,
    knees and shoes show below the top. The body drops down onto the seat."""
    t = top_row(im)
    bottom = max(y for y in range(im.height) if any(opaque(im, x, y) for x in range(im.width)))
    keep_to = t + 21            # rows 0 .. keep_to - 1: head, top, hips
    feet_from = bottom - 1      # the last two rows: knees and shoes
    gap = max(0, feet_from - keep_to)
    out = Image.new('RGBA', im.size, CLEAR)
    out.alpha_composite(im.crop((0, 0, FRAME, keep_to)), (0, gap))
    out.alpha_composite(im.crop((0, feet_from, FRAME, bottom + 1)), (0, feet_from))
    return out


def lie_head(im):
    """Head only, eyes shut, for bed and bath."""
    t = top_row(im)
    head = face(im, 'asleep').crop((0, t - 1, FRAME, t + 12))
    return head


def main(folder):
    folder = Path(folder)
    frames = {}   # name -> image
    for anim, file in ANIMS.items():
        sheet = Image.open(folder / f'16x32 {file}-Sheet.png').convert('RGBA')
        for d, direction in enumerate(DIRS):
            for f in range(4):
                im = sheet.crop((f * FRAME, d * FRAME, (f + 1) * FRAME, (d + 1) * FRAME))
                frames[f'{anim}_{direction}_{f}'] = paint(im, direction)
        for left, right in MIRROR.items():
            for f in range(4):
                frames[f'{anim}_{left}_{f}'] = mirror(frames[f'{anim}_{right}_{f}'])
    # Moods on front-facing frames.
    for name in [n for n in frames if '_front_' in n and n.split('_')[1] == 'front' and n.count('_') == 2]:
        for mood in MOODS[1:]:
            frames[f'{name}_{mood}'] = face(frames[name], mood)
    for f in range(4):
        frames[f'sit_front_{f}'] = sit_pose(frames[f'idle_front_{f}'])
        for mood in MOODS[1:]:
            frames[f'sit_front_{f}_{mood}'] = face(frames[f'sit_front_{f}'], mood)
    frames['lie'] = lie_head(frames['idle_front_0'])

    names = sorted(frames)
    cols = 16
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * FRAME, rows * FRAME), CLEAR)
    rects = {}
    for i, n in enumerate(names):
        x, y = (i % cols) * FRAME, (i // cols) * FRAME
        sheet.alpha_composite(frames[n], (x, y))
        rects[n] = [x, y, frames[n].width, frames[n].height]
    out = Path('assets/people')
    out.mkdir(parents=True, exist_ok=True)
    sheet.save(out / 'sarah.png')
    meta = {
        'about': 'Mum (Sarah), made by tools/make_mum.py from Eris Esra\'s 16x32 character template. '
                 'Original character template created by Eris Esra: https://erisesra.itch.io/character-templates-pack',
        'frame': FRAME,
        'moods': MOODS,
        'rects': rects,
    }
    (out / 'sarah.json').write_text(json.dumps(meta, indent=1) + '\n')
    print(len(names), 'frames ->', out / 'sarah.png', sheet.size)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '16x32')
