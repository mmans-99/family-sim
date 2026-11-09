// The pixel-art palette. Every pixel of the house view is snapped to the nearest
// entry here, so there are no blurry in-between colours at edges.
// Pure logic (no DOM), so it can be tested without a browser.

// Each colour channel can only be one of these ten levels.
const LEVELS = [0, 28, 57, 85, 113, 142, 170, 198, 227, 255];

export const OUTLINE = [59, 36, 22];       // dark brown edge lines
export const BACKGROUND = [246, 222, 186]; // warm cream backdrop behind the house

const PALETTE = [];
for (const r of LEVELS) for (const g of LEVELS) for (const b of LEVELS) PALETTE.push([r, g, b]);
PALETTE.push(OUTLINE, BACKGROUND);

const cache = new Map();

// The palette entry closest to (r, g, b), as [r, g, b].
export function nearestColour(r, g, b) {
  const key = (r << 16) | (g << 8) | b;
  let hit = cache.get(key);
  if (hit) return hit;
  let best = PALETTE[0];
  let bestDist = Infinity;
  for (const p of PALETTE) {
    const dr = p[0] - r;
    const dg = p[1] - g;
    const db = p[2] - b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  cache.set(key, best);
  return best;
}
