// The house as a walking map: which squares a person can stand on and which steps join them.
// Built from data/house.json. Pure logic (no drawing), so the simulation runs without a screen.
//
// A square's key is "floor:x:y". Floors at the same height (the ground floor and the garden)
// are one walking level: a doorway on their shared edge joins them (the back door).
// Stairs are one flight from house.stairs: entered at the bottom from (x, y0 - 1), climbed one
// step at a time, and left at the top onto (x, y1 + 1) on the floor above. The stairwell
// squares on the floor above are a hole, so nobody stands there.

const FLAT = 0.05; // furniture thinner than this (rugs, paths) can be walked over

export const keyOf = (floor, x, y) => `${floor}:${x}:${y}`;

export function parseKey(key) {
  const [floor, x, y] = key.split(':');
  return { floor, x: Number(x), y: Number(y) };
}

export function buildMap(house) {
  const squares = new Map(); // key -> { floor, x, y, room }
  const level = new Map();   // "z:x:y" -> key, to find squares across floors at one height
  const zOf = Object.fromEntries(house.floors.map((f) => [f.id, f.z ?? 0]));
  const stairs = house.stairs ?? [];

  const hole = new Set();
  const onStairs = new Map(); // key -> flight
  for (const s of stairs) {
    for (let y = s.y0; y <= s.y1; y++) {
      hole.add(keyOf(s.to, s.x, y));
      onStairs.set(keyOf(s.floor, s.x, y), s);
    }
  }

  const blocked = new Set();
  for (const i of house.furniture ?? []) {
    if (i.h < FLAT || i.z) continue;
    if (onStairs.has(keyOf(i.floor, i.x, i.y))) continue; // the stairs themselves are walked on
    for (let x = i.x; x < i.x + i.w; x++) {
      for (let y = i.y; y < i.y + i.d; y++) blocked.add(keyOf(i.floor, x, y));
    }
  }

  for (const floor of house.floors) {
    for (const r of floor.rooms) {
      for (let x = r.x; x < r.x + r.w; x++) {
        for (let y = r.y; y < r.y + r.h; y++) {
          const key = keyOf(floor.id, x, y);
          if (hole.has(key)) continue;
          squares.set(key, { floor: floor.id, x, y, room: r.id, roomName: r.name });
          level.set(`${zOf[floor.id]}:${x}:${y}`, key);
        }
      }
    }
  }

  const doorsAtZ = (z) => house.floors.filter((f) => (f.z ?? 0) === z).flatMap((f) => f.doors ?? []);
  // A doorway on the edge between two side-by-side squares?
  function doorBetween(z, x, y, nx, ny) {
    return doorsAtZ(z).some((d) => (nx !== x
      ? d.axis === 'v' && d.at === Math.max(x, nx) && d.from <= y && d.to >= y + 1
      : d.axis === 'h' && d.at === Math.max(y, ny) && d.from <= x && d.to >= x + 1));
  }

  const free = (key) => squares.has(key) && !blocked.has(key);

  function neighbours(key) {
    const sq = squares.get(key);
    if (!sq) return [];
    const flight = onStairs.get(key);
    if (flight) {
      // On the stairs: only up or down the flight, off at either end.
      const out = [];
      out.push(sq.y > flight.y0 ? keyOf(flight.floor, sq.x, sq.y - 1) : keyOf(flight.floor, sq.x, flight.y0 - 1));
      out.push(sq.y < flight.y1 ? keyOf(flight.floor, sq.x, sq.y + 1) : keyOf(flight.to, sq.x, flight.y1 + 1));
      return out.filter(free);
    }
    const z = zOf[sq.floor];
    const out = [];
    for (const [nx, ny] of [[sq.x + 1, sq.y], [sq.x - 1, sq.y], [sq.x, sq.y + 1], [sq.x, sq.y - 1]]) {
      const nkey = level.get(`${z}:${nx}:${ny}`);
      if (!nkey || !free(nkey)) continue;
      const nsq = squares.get(nkey);
      const step = onStairs.get(nkey);
      // Stairs can only be stepped onto from the bottom end; the sides have a banister.
      if (step && !(nsq.y === step.y0 && sq.y === step.y0 - 1 && sq.x === step.x)) continue;
      if (nsq.room !== sq.room && !doorBetween(z, sq.x, sq.y, nx, ny)) continue;
      out.push(nkey);
    }
    // From the landing at the top of a flight, step down onto its top step.
    for (const s of stairs) {
      if (sq.floor === s.to && sq.x === s.x && sq.y === s.y1 + 1) out.push(keyOf(s.floor, s.x, s.y1));
    }
    return out.filter(free);
  }

  // Shortest walking distance from one square to every square it can reach.
  function distances(from) {
    const dist = new Map([[from, 0]]);
    const prev = new Map();
    const queue = [from];
    for (let i = 0; i < queue.length; i++) {
      const k = queue[i];
      for (const n of neighbours(k)) {
        if (dist.has(n)) continue;
        dist.set(n, dist.get(k) + 1);
        prev.set(n, k);
        queue.push(n);
      }
    }
    return { dist, prev };
  }

  function pathTo(prev, from, to) {
    if (from === to) return [from];
    if (!prev.has(to)) return null;
    const path = [to];
    while (path[0] !== from) path.unshift(prev.get(path[0]));
    return path;
  }

  // Squares a person can stand on to use a piece of furniture: free squares beside it, in
  // the same room, and not on the stairs.
  function useSquares(item) {
    const out = [];
    for (let x = item.x - 1; x <= item.x + item.w; x++) {
      for (let y = item.y - 1; y <= item.y + item.d; y++) {
        const side = (x === item.x - 1 || x === item.x + item.w) !== (y === item.y - 1 || y === item.y + item.d);
        if (!side) continue;
        const k = keyOf(item.floor, x, y);
        const sq = squares.get(k);
        const itemRoom = squares.get(keyOf(item.floor, item.x, item.y))?.room;
        if (sq && free(k) && !onStairs.has(k) && sq.room === itemRoom) out.push(k);
      }
    }
    return out;
  }

  const walkable = [...squares.keys()].filter((k) => free(k) && !onStairs.has(k));

  return { squares, neighbours, distances, pathTo, useSquares, walkable, free, onStairs };
}
