// The minimap: a small plan of the whole house in a corner. Each room is its floor colour,
// each person a coloured dot, and a white box shows the part of the house the main view shows.
// Drawn on its own small canvas (docs/HOUSE_VIEW.md section 10.4). Reads the scene; never changes it.
import { mapFrame, toMap } from './follow.js';

const DOT_COLOUR = '#429c96';
const DOT_RADIUS = 2.5;

// boxes: the scene from buildScene (floor tiles are the 'slab' boxes); bounds: the world rectangle;
// people: from peopleToDraw; view: { x, y, w, h } the centre and size, in squares, of the main view.
// w, h are CSS pixels; the caller sets the canvas backing store to match the device pixel ratio.
export function drawMinimap(ctx, w, h, { boxes, bounds, people, view }) {
  const frame = mapFrame(bounds, w, h);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#2b2620';
  ctx.fillRect(0, 0, w, h);

  for (const b of boxes) {
    if (b.kind !== 'slab') continue; // one box per floor square
    const p0 = toMap(frame, b.x0, b.y0);
    const p1 = toMap(frame, b.x1, b.y1);
    ctx.fillStyle = b.colour;
    ctx.fillRect(p0.mx, p0.my, p1.mx - p0.mx, p1.my - p0.my);
  }

  for (const person of people) {
    const p = toMap(frame, person.x, person.y);
    ctx.fillStyle = DOT_COLOUR;
    ctx.beginPath();
    ctx.arc(p.mx, p.my, DOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  // The part of the house the main view shows.
  const a = toMap(frame, view.x - view.w / 2, view.y - view.h / 2);
  const c = toMap(frame, view.x + view.w / 2, view.y + view.h / 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(a.mx, a.my, c.mx - a.mx, c.my - a.my);
}
