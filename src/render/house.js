// Draws the 3D house scene onto a 2D canvas, in a pixel-art style:
// flat shading bands, a limited colour palette and dark outlines.
import { project, facesViewer, shade } from './camera.js';
import { OUTLINE, BACKGROUND, nearestColour } from './palette.js';

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

// Four flat brightness steps, from darkest side to brightest top.
const BRIGHTNESS = [0.55, 0.7, 0.85, 1];

// Multiply a #rrggbb colour by a light factor (0.6 to 1.0), in flat steps.
function pixelColour(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const t = Math.min(1, Math.max(0, (factor - 0.6) / 0.4));
  const band = BRIGHTNESS[Math.round(t * (BRIGHTNESS.length - 1))];
  const ch = (shift) => Math.round(((n >> shift) & 255) * band);
  return [ch(16), ch(8), ch(0)];
}

const rgb = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

// Snap every pixel of a w x h canvas to the palette, so no blurry in-between colours remain.
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

// Draw the whole scene. width and height are in the units of ctx (pixels of its canvas).
export function drawScene(ctx, boxes, cam, width, height) {
  ctx.fillStyle = rgb(BACKGROUND);
  ctx.fillRect(0, 0, width, height);

  const faces = [];
  for (const b of boxes) {
    for (const face of boxFaces(b)) {
      if (!facesViewer(cam, face.n)) continue;
      const pts = face.corners.map(([x, y, z]) => project(cam, width, height, x, y, z));
      const depth = pts.reduce((sum, p) => sum + p.depth, 0) / pts.length;
      faces.push({ pts, depth, fill: rgb(pixelColour(b.colour, shade(cam, face.n))) });
    }
  }

  // Far faces first, so near faces paint over them.
  faces.sort((a, b) => b.depth - a.depth);

  ctx.lineWidth = 1;
  ctx.strokeStyle = rgb(OUTLINE);
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
