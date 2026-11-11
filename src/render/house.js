// Draws the house from straight above, in a pixel-art style. Floors go down first, then rugs
// and paths, then walls and furniture from the top of the screen to the bottom, so things
// lower down overlap the things behind them. Everything is drawn pixel by pixel (no blur).
import { project, UNIT_PX } from './camera.js';
import { OUTLINE, BACKGROUND, nearestColour } from './palette.js';
import { blitSprite } from './raster.js';
import { NAME_TO_SPRITE, FLOOR_TILE_PX } from './pack.js';

const FLAT_HEIGHT = 0.05; // items thinner than this (rugs, paths) lie on the floor

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

// Snap every pixel of a w x h canvas to the palette. Only used when there are no sprites:
// the sprites have their own hand-picked colours, which must not be changed.
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
export function drawScene(ctx, boxes, cam, width, height, pack = null) {
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
      for (let ty = r.y0; ty < r.y1; ty += FLOOR_TILE_PX) {
        for (let tx = r.x0; tx < r.x1; tx += FLOOR_TILE_PX) {
          blitSprite(buf, tile, tx + FLOOR_TILE_PX / 2, ty + FLOOR_TILE_PX);
        }
      }
    } else if (b.z1 - b.z0 < FLAT_HEIGHT) {
      flat.push(() => fillRect(buf, r.x0, r.y0, r.x1, r.y1, rgb(b.colour), OUTLINE));
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
  for (const draw of flat) draw();
  standing.sort((a, b) => a.row - b.row || a.z - b.z);
  for (const s of standing) s.draw();
  ctx.putImageData(buf, 0, 0);
}
