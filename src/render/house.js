// Draws the 3D house scene onto a 2D canvas, in a pixel-art style:
// flat shading bands, a limited colour palette and dark outlines.
import { project, facesViewer, shade } from './camera.js';

const BACKGROUND = '#f7f4ee';
const OUTLINE = '#2b2620';
const PALETTE_STEP = 16; // colours snap to multiples of this per channel

// The five faces of a box that can ever face the viewer (the underside is never seen).
function boxFaces(b) {
  const { x0, y0, z0, x1, y1, z1 } = b;
  return [
    { n: [0, 0, 1], corners: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
    { n: [0, -1, 0], corners: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
    { n: [0, 1, 0], corners: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]] },
    { n: [-1, 0, 0], corners: [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]] },
    { n: [1, 0, 0], corners: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] },
  ];
}

const snap = (v) => Math.min(255, Math.round(v / PALETTE_STEP) * PALETTE_STEP);

// Multiply a #rrggbb colour by a brightness factor, in flat bands, snapped to the palette.
function pixelColour(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const band = Math.round(factor * 4) / 4;
  const ch = (shift) => snap(((n >> shift) & 255) * band);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

// Draw the whole scene. width and height are in the units of ctx (pixels of its canvas).
export function drawScene(ctx, boxes, cam, width, height) {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);

  const faces = [];
  for (const b of boxes) {
    for (const face of boxFaces(b)) {
      if (!facesViewer(cam, face.n)) continue;
      const pts = face.corners.map(([x, y, z]) => project(cam, width, height, x, y, z));
      const depth = pts.reduce((sum, p) => sum + p.depth, 0) / pts.length;
      faces.push({ pts, depth, fill: pixelColour(b.colour, shade(cam, face.n)) });
    }
  }

  // Far faces first, so near faces paint over them.
  faces.sort((a, b) => b.depth - a.depth);

  ctx.lineWidth = 1;
  ctx.strokeStyle = OUTLINE;
  ctx.lineJoin = 'miter';
  for (const f of faces) {
    ctx.beginPath();
    f.pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)));
    ctx.closePath();
    ctx.fillStyle = f.fill;
    ctx.fill();
    ctx.stroke();
  }
}
