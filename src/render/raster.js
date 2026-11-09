// Pixel-exact polygon drawing with no anti-aliasing: every pixel is either fully
// the fill colour or not drawn at all, so edges stay hard and crisp.
// Works on an ImageData-like buffer: { data: Uint8ClampedArray, width, height }.
// Pure logic (no DOM), so it can be tested without a browser.

function setPixel(buf, x, y, rgb) {
  if (x < 0 || y < 0 || x >= buf.width || y >= buf.height) return;
  const i = (y * buf.width + x) * 4;
  buf.data[i] = rgb[0];
  buf.data[i + 1] = rgb[1];
  buf.data[i + 2] = rgb[2];
  buf.data[i + 3] = 255;
}

// Fill a polygon. A pixel is inside if its centre is inside the polygon.
// pts: [{ sx, sy }, ...] in buffer pixel units.
export function fillPolygon(buf, pts, rgb) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p.sy);
    maxY = Math.max(maxY, p.sy);
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(buf.height - 1, Math.ceil(maxY));
  const n = pts.length;
  for (let py = y0; py <= y1; py++) {
    const yc = py + 0.5; // sample at the pixel centre
    const xs = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      if ((p.sy <= yc && q.sy > yc) || (q.sy <= yc && p.sy > yc)) {
        xs.push(p.sx + ((yc - p.sy) * (q.sx - p.sx)) / (q.sy - p.sy));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      // Pixels whose centre (px + 0.5) lies in [xs[k], xs[k + 1]).
      const start = Math.max(0, Math.ceil(xs[k] - 0.5));
      const end = Math.min(buf.width - 1, Math.ceil(xs[k + 1] - 0.5) - 1);
      for (let px = start; px <= end; px++) setPixel(buf, px, py, rgb);
    }
  }
}

// Draw a 1-pixel line between two points (Bresenham: no in-between pixels).
export function drawLine(buf, x0, y0, x1, y1, rgb) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const xEnd = Math.round(x1);
  const yEnd = Math.round(y1);
  const dx = Math.abs(xEnd - x);
  const dy = -Math.abs(yEnd - y);
  const sx = x < xEnd ? 1 : -1;
  const sy = y < yEnd ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    setPixel(buf, x, y, rgb);
    if (x === xEnd && y === yEnd) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

// Outline a closed polygon with 1-pixel lines.
export function outlinePolygon(buf, pts, rgb) {
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    drawLine(buf, p.sx, p.sy, q.sx, q.sy, rgb);
  }
}
