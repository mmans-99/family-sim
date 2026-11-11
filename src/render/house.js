// Draws the house from straight above, in a pixel-art style. Floors go down first, then rugs
// and paths, then walls and furniture from the top of the screen to the bottom, so things
// lower down overlap the things behind them. Everything is drawn pixel by pixel (no blur).
import { project, UNIT_PX } from './camera.js';
import { OUTLINE, BACKGROUND, nearestColour } from './palette.js';
import { blitSprite } from './raster.js';
import { NAME_TO_SPRITE, NAME_TO_TILE, NAME_TO_RUG, RUG_PIECE_PX } from './pack.js';

const FLAT_HEIGHT = 0.05; // items thinner than this (rugs, paths) lie on the floor

// Colours for walls, windows and fences when the pack is loaded, taken from the pack's
// own wall tiles (white with a dark grey edge) and wood.
const PACK_STYLE = {
  edge: [56, 56, 56],
  ink: [0, 0, 0],
  wall: [243, 247, 243],
  outerWall: [222, 229, 229],
  glass: [186, 220, 232],
  fence: [210, 146, 97],
  post: [156, 91, 42],
  door: [184, 112, 61],
};

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Fill a rectangle of whole pixels, with an optional 1-pixel outline inside its edge.
function fillRect(buf, x0, y0, x1, y1, fill, outline = null) {
  for (let y = Math.max(0, y0); y < Math.min(buf.height, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(buf.width, x1); x++) {
      const edge = outline && (x === x0 || x === x1 - 1 || y === y0 || y === y1 - 1);
      const c = edge ? outline : fill;
      const i = (y * buf.width + x) * 4;
      buf.data[i] = c[0];
      buf.data[i + 1] = c[1];
      buf.data[i + 2] = c[2];
      buf.data[i + 3] = 255;
    }
  }
}

// The pixel rectangle a box covers, seen from above. Never thinner than 1 pixel.
export function boxRect(b, cam, width, height) {
  const a = project(cam, width, height, b.x0, b.y0);
  const c = project(cam, width, height, b.x1, b.y1);
  const x0 = Math.round(a.sx);
  const y0 = Math.round(a.sy);
  return { x0, y0, x1: Math.max(x0 + 1, Math.round(c.sx)), y1: Math.max(y0 + 1, Math.round(c.sy)) };
}

// Cover a rectangle with a repeating tile. (ox, oy) is where a tile's top-left corner falls,
// so neighbouring areas line up.
function paintTiled(buf, tile, x0, y0, x1, y1, ox = x0, oy = y0) {
  const mod = (a, n) => ((a % n) + n) % n;
  for (let y = Math.max(0, y0); y < Math.min(buf.height, y1); y++) {
    const ty = mod(y - oy, tile.height);
    for (let x = Math.max(0, x0); x < Math.min(buf.width, x1); x++) {
      const si = (ty * tile.width + mod(x - ox, tile.width)) * 4;
      if (tile.data[si + 3] === 0) continue;
      const di = (y * buf.width + x) * 4;
      buf.data[di] = tile.data[si];
      buf.data[di + 1] = tile.data[si + 1];
      buf.data[di + 2] = tile.data[si + 2];
      buf.data[di + 3] = 255;
    }
  }
}

// A rug of any size from a 24 x 24 template: corners as drawn, edges and middle repeated.
function paintRug(buf, rug, x0, y0, x1, y1) {
  const p = RUG_PIECE_PX;
  const part = (sx, sy) => ({
    width: p, height: p,
    data: (() => {
      const d = new Uint8ClampedArray(p * p * 4);
      for (let r = 0; r < p; r++) d.set(rug.data.subarray(((sy + r) * rug.width + sx) * 4, ((sy + r) * rug.width + sx + p) * 4), r * p * 4);
      return d;
    })(),
  });
  const cols = [[x0, x0 + p, 0], [x0 + p, x1 - p, p], [x1 - p, x1, 2 * p]];
  const rows = [[y0, y0 + p, 0], [y0 + p, y1 - p, p], [y1 - p, y1, 2 * p]];
  for (const [ya, yb, sy] of rows) {
    for (const [xa, xb, sx] of cols) {
      if (xb > xa && yb > ya) paintTiled(buf, part(sx, sy), xa, ya, xb, yb);
    }
  }
}

// The outside face of the front wall, seen above its top edge: wall pieces, with a window
// piece over each window and a door where the front door is.
function paintFace(buf, b, r, pack) {
  if (b.door) {
    fillRect(buf, r.x0, r.y0 + 1, r.x1, r.y1, PACK_STYLE.door, PACK_STYLE.ink);
    fillRect(buf, r.x1 - 4, r.y0 + 8, r.x1 - 3, r.y0 + 9, PACK_STYLE.ink); // handle
    return;
  }
  const wall = pack.sprites.wall_face;
  const win = pack.sprites.window_face;
  const top = r.y1 - wall.height;
  paintTiled(buf, wall, r.x0, top, r.x1, r.y1, r.x0, top);
  for (const off of b.windows ?? []) {
    const x = r.x0 + Math.round(off * UNIT_PX);
    paintTiled(buf, win, x, top, x + win.width, r.y1, x, top);
  }
  // Edge lines only at the house corners and beside the front door.
  if (b.ends?.[0]) fillRect(buf, r.x0, top, r.x0 + 1, r.y1, PACK_STYLE.edge);
  if (b.ends?.[1]) fillRect(buf, r.x1 - 1, top, r.x1, r.y1, PACK_STYLE.edge);
}

// Walls, windows and fences in the pack's style.
function paintStructure(buf, b, r) {
  if (b.kind === 'wall') {
    fillRect(buf, r.x0, r.y0, r.x1, r.y1, b.outer ? PACK_STYLE.outerWall : PACK_STYLE.wall, PACK_STYLE.edge);
  } else if (b.kind === 'window') {
    fillRect(buf, r.x0, r.y0, r.x1, r.y1, PACK_STYLE.glass, PACK_STYLE.edge);
  } else if (b.kind === 'fence') {
    fillRect(buf, r.x0, r.y0, r.x1, r.y1, PACK_STYLE.fence, PACK_STYLE.ink);
    // A post at every whole grid square along the fence.
    const along = r.x1 - r.x0 > r.y1 - r.y0;
    const len = along ? r.x1 - r.x0 : r.y1 - r.y0;
    for (let at = 0; at <= len; at += UNIT_PX) {
      const c = Math.min(Math.max(at, 3), len - 3);
      if (along) fillRect(buf, r.x0 + c - 3, r.y0 - 1, r.x0 + c + 3, r.y1 + 1, PACK_STYLE.post, PACK_STYLE.ink);
      else fillRect(buf, r.x0 - 1, r.y0 + c - 3, r.x1 + 1, r.y0 + c + 3, PACK_STYLE.post, PACK_STYLE.ink);
    }
  }
}

// Snap every pixel of a w x h canvas to the palette. Only used when there are no sprites:
// the sprites have their own hand-picked colours, which must not be changed.
// Frosted cover: a grid of pale tiles in the greys and whites of the frosted-glass reference,
// shuffled every animation frame so it shimmers rather than sitting still. Every tile is opaque,
// so nothing underneath (the furniture or the figure) shows through.
const FROST = [
  [255, 255, 255], [246, 247, 249], [238, 240, 242], [226, 230, 235], [212, 217, 224], [200, 206, 214],
];
const FROST_CELL = 4; // art pixels per tile
function paintFrost(buf, x0, y0, x1, y1, tick) {
  const left = Math.max(0, Math.floor(x0));
  const top = Math.max(0, Math.floor(y0));
  const right = Math.min(buf.width, Math.ceil(x1));
  const bottom = Math.min(buf.height, Math.ceil(y1));
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const cx = Math.floor((x - left) / FROST_CELL);
      const cy = Math.floor((y - top) / FROST_CELL);
      // A simple hash of the tile position and the frame: a different shade each frame.
      const h = ((cx * 73856093) ^ (cy * 19349663) ^ (tick * 83492791)) >>> 0;
      let shade = FROST[h % FROST.length];
      if (((x + y + tick) & 3) === 0 && (h >> 8) % 3 === 0) shade = FROST[(h % FROST.length + 1) % FROST.length]; // dotted accent
      const i = (y * buf.width + x) * 4;
      buf.data[i] = shade[0];
      buf.data[i + 1] = shade[1];
      buf.data[i + 2] = shade[2];
      buf.data[i + 3] = 255;
    }
  }
}

// Steam: a few pale dotted puffs that rise and drift, one step per animation frame. The
// dots are alternate pixels, so it reads as a soft blur rather than a solid shape.
const STEAM = [226, 234, 240];
function paintSteam(buf, x, y, tick) {
  for (let k = 0; k < 3; k++) {
    const rise = (tick + k * 3) % 8;
    const cx = x + (k - 1) * 6;
    const cy = y - 15 - rise; // over the bath, clear of the head, and not up into the next room
    for (let dy = -2; dy <= 0; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if ((dx + dy + tick + k) % 2 !== 0) continue; // dither: every other pixel
        const px = cx + dx;
        const py = cy + dy;
        if (px < 0 || py < 0 || px >= buf.width || py >= buf.height) continue;
        const i = (py * buf.width + px) * 4;
        buf.data[i] = STEAM[0];
        buf.data[i + 1] = STEAM[1];
        buf.data[i + 2] = STEAM[2];
        buf.data[i + 3] = 255;
      }
    }
  }
}

export function snapFrame(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = nearestColour(d[i], d[i + 1], d[i + 2]);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// Draw the whole scene. width and height are in art pixels (the size of ctx's canvas).
// If a sprite pack is loaded (pack.js), floors and furniture use its sprites.
// people: from peopleToDraw (people.js), sorted in among the furniture by their row.
export function drawScene(ctx, boxes, cam, width, height, pack = null, people = []) {
  const buf = ctx.createImageData(width, height);
  fillRect(buf, 0, 0, width, height, BACKGROUND);

  const flat = [];
  const standing = [];
  for (const b of boxes) {
    if (b.kind === 'door') continue; // seen from above, a doorway is a gap in the wall
    const r = boxRect(b, cam, width, height);
    if (b.kind === 'slab') {
      const tile = pack && b.tile ? pack.tiles[b.tile] : null;
      if (!tile) { fillRect(buf, r.x0, r.y0, r.x1, r.y1, rgb(b.colour)); continue; }
      paintTiled(buf, tile, r.x0, r.y0, r.x1, r.y1);
    } else if (b.kind === 'face') {
      // The front wall's face stands behind everything on that wall.
      if (pack?.sprites.wall_face) standing.push({ row: r.y1, z: -1, draw: () => paintFace(buf, b, r, pack) });
    } else if (b.z1 - b.z0 < FLAT_HEIGHT) {
      const rug = pack?.rugs?.[NAME_TO_RUG[b.name]];
      const tile = pack?.tiles[NAME_TO_TILE[b.name]];
      const sprite = pack?.sprites[NAME_TO_SPRITE[b.name]];
      if (rug) flat.push(() => paintRug(buf, rug, r.x0, r.y0, r.x1, r.y1));
      else if (tile) flat.push(() => paintTiled(buf, tile, r.x0, r.y0, r.x1, r.y1));
      else if (sprite) flat.push(() => blitSprite(buf, sprite, (r.x0 + r.x1) / 2, r.y1));
      else flat.push(() => fillRect(buf, r.x0, r.y0, r.x1, r.y1, rgb(b.colour), OUTLINE));
    } else if (pack && (b.kind === 'wall' || b.kind === 'window' || b.kind === 'fence')) {
      standing.push({ row: r.y1, z: b.z0, draw: () => paintStructure(buf, b, r) });
    } else {
      const sprite = pack && b.name ? pack.sprites[NAME_TO_SPRITE[b.name]] : null;
      const lift = Math.round((b.lift ?? 0) * UNIT_PX); // things on top of others sit higher up
      const draw = sprite
        // A sprite stands on the bottom edge of its floor squares, centred side to side.
        ? () => blitSprite(buf, sprite, (r.x0 + r.x1) / 2, r.y1 - lift)
        : () => fillRect(buf, r.x0, r.y0, r.x1, r.y1, rgb(b.colour), OUTLINE);
      standing.push({ row: r.y1, z: b.z0, draw });
    }
  }
  for (const person of people) {
    const at = project(cam, width, height, person.x, person.y);
    const row = Math.round(project(cam, width, height, person.x, person.row).sy);
    const sprite = pack?.sprites[person.sprite] ?? pack?.sprites[person.fallback];
    const draw = sprite
      ? () => {
        blitSprite(buf, sprite, at.sx, at.sy);
      }
      : () => fillRect(buf, Math.round(at.sx) - 4, Math.round(at.sy) - 16, Math.round(at.sx) + 4, Math.round(at.sy), [66, 156, 150], OUTLINE);
    standing.push({ row: row + 0.5, z: 0, draw }); // after furniture on the same row
  }
  for (const draw of flat) draw();
  standing.sort((a, b) => a.row - b.row || a.z - b.z);
  for (const s of standing) s.draw();
  for (const person of people) {
    if (person.steam === null || person.steam === undefined) continue;
    const at = project(cam, width, height, person.x, person.y);
    paintSteam(buf, Math.round(at.sx), Math.round(at.sy), person.steam);
  }
  for (const person of people) {
    if (person.hide === null || person.hide === undefined || !person.cover) continue;
    // Cover the whole furniture footprint and everything the figure could show, from the
    // sprite's own size, so nothing of the person is left visible.
    const sprite = pack?.sprites[person.sprite] ?? pack?.sprites[person.fallback];
    const sw = sprite ? sprite.width : 16;
    const sh = sprite ? sprite.height : 32;
    const at = project(cam, width, height, person.x, person.y);
    const a = project(cam, width, height, person.cover.x, person.cover.y);
    const b = project(cam, width, height, person.cover.x + person.cover.w, person.cover.y + person.cover.d);
    const x0 = Math.min(a.sx, b.sx, at.sx - sw / 2) - 1;
    const x1 = Math.max(a.sx, b.sx, at.sx + sw / 2) + 1;
    const y0 = Math.min(a.sy, b.sy, at.sy - sh) - 1;
    const y1 = Math.max(a.sy, b.sy, at.sy) + 1;
    paintFrost(buf, x0, y0, x1, y1, person.hide);
  }
  ctx.putImageData(buf, 0, 0);
}
