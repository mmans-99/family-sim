// Seeded random number generator (mulberry32).
// Same seed = same sequence of numbers, so the simulation can be replayed exactly.
// Never use Math.random() in the simulation.
//
// `state` restores a generator saved with getState(), so a saved game carries on exactly
// where it stopped.
export function createRng(seed, state = null) {
  let s = (state ?? seed) >>> 0;
  const next = function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // 0 <= n < 1
  };
  next.getState = () => s;
  return next;
}

// A separate random stream for one purpose (e.g. a person's personality), so adding a new
// use of random numbers never changes the numbers the day already uses.
export function subRng(seed, name) {
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return createRng((seed ^ h) >>> 0);
}
