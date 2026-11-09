// Turns data/house.json into a flat list of solid boxes for the 3D view.
// Pure logic (no drawing), so it can be tested without a browser.

export const COLOURS = {
  wall: '#f1ead9',
  brick: '#a65d3f',
  door: '#7a4e2d',
  glass: '#bfe6f2',
  fence: '#8b6b43',
  lawn: '#9cc37a',
  floor: '#efe6d2',
};

const DOOR_HEIGHT = 2.1;
const DOOR_THICKNESS = 0.06;
const FENCE_THICKNESS = 0.1;
const WINDOW_SPACING = 1.5;  // one window per 1.5 grid squares of outside wall
const WINDOW_WIDTH = 0.8;
const WINDOW_SILL = 0.9;     // height of the window bottom above the floor
const WINDOW_HEIGHT = 1.1;
const WINDOW_EXTRA_THICKNESS = 0.05; // windows stand a little proud of the wall

export function box(x0, y0, z0, x1, y1, z1, colour) {
  return { x0, y0, z0, x1, y1, z1, colour };
}

// A straight wall centred on the line at `at`.
// axis 'h' runs along x (at = y), axis 'v' runs along y (at = x).
export function wallBox(axis, at, from, to, z0, height, thickness, colour) {
  const h = thickness / 2;
  return axis === 'h'
    ? box(from - h, at - h, z0, to + h, at + h, z0 + height, colour)
    : box(at - h, from - h, z0, at + h, to + h, z0 + height, colour);
}

// Cut door openings out of a wall segment. Returns the solid pieces left over.
export function cutOpenings(seg, openings) {
  let pieces = [{ from: seg.from, to: seg.to }];
  for (const o of openings) {
    if (o.axis !== seg.axis || o.at !== seg.at) continue;
    const next = [];
    for (const p of pieces) {
      const a = Math.max(p.from, o.from);
      const b = Math.min(p.to, o.to);
      if (b <= a) { next.push(p); continue; }
      if (a > p.from) next.push({ from: p.from, to: a });
      if (b < p.to) next.push({ from: b, to: p.to });
    }
    pieces = next;
  }
  return pieces;
}

// The four walls of a room, as segments.
export function roomEdges(room) {
  const { x, y, w, h } = room;
  return [
    { axis: 'h', at: y, from: x, to: x + w },
    { axis: 'h', at: y + h, from: x, to: x + w },
    { axis: 'v', at: x, from: y, to: y + h },
    { axis: 'v', at: x + w, from: y, to: y + h },
  ];
}

function footprint(rooms) {
  return {
    minX: Math.min(...rooms.map((r) => r.x)),
    maxX: Math.max(...rooms.map((r) => r.x + r.w)),
    minY: Math.min(...rooms.map((r) => r.y)),
    maxY: Math.max(...rooms.map((r) => r.y + r.h)),
  };
}

// A wall on the edge of the whole house is an outside wall.
function isOuter(e, b) {
  return e.axis === 'h'
    ? e.at === b.minY || e.at === b.maxY
    : e.at === b.minX || e.at === b.maxX;
}

function addWindows(boxes, e, piece, z0, thickness) {
  const length = piece.to - piece.from;
  const count = Math.floor(length / WINDOW_SPACING);
  for (let i = 0; i < count; i++) {
    const c = piece.from + ((i + 0.5) * length) / count;
    boxes.push(wallBox(
      e.axis, e.at, c - WINDOW_WIDTH / 2, c + WINDOW_WIDTH / 2,
      z0 + WINDOW_SILL, WINDOW_HEIGHT, thickness + WINDOW_EXTRA_THICKNESS, COLOURS.glass,
    ));
  }
}

function addFloor(boxes, house, floor, lift) {
  const z0 = (floor.z ?? 0) + lift;
  const height = floor.height;
  const thickness = house.wallThickness ?? 0.15;
  const slab = house.floorThickness ?? 0.2;
  const doors = floor.doors ?? [];
  const inside = floor.rooms.filter((r) => !r.outside);

  // Floor slabs. The garden's slab is the lawn.
  for (const room of floor.rooms) {
    if (room.noSlab) continue;
    boxes.push(box(
      room.x, room.y, z0 - slab, room.x + room.w, room.y + room.h, z0,
      room.outside ? COLOURS.lawn : (room.floor ?? COLOURS.floor),
    ));
  }

  // Walls: each shared edge once, with doorways cut out.
  if (inside.length) {
    const b = footprint(inside);
    const seen = new Set();
    for (const room of inside) {
      for (const e of roomEdges(room)) {
        const key = `${e.axis}:${e.at}:${e.from}:${e.to}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const outer = isOuter(e, b);
        for (const piece of cutOpenings(e, doors)) {
          boxes.push(wallBox(
            e.axis, e.at, piece.from, piece.to, z0, height, thickness,
            outer ? COLOURS.brick : COLOURS.wall,
          ));
          if (outer) addWindows(boxes, e, piece, z0, thickness);
        }
      }
    }
  }

  for (const d of doors) {
    boxes.push(wallBox(d.axis, d.at, d.from, d.to, z0, DOOR_HEIGHT, DOOR_THICKNESS, COLOURS.door));
  }
  for (const f of floor.fence ?? []) {
    boxes.push(wallBox(f.axis, f.at, f.from, f.to, z0, height, FENCE_THICKNESS, COLOURS.fence));
  }
  for (const item of (house.furniture ?? []).filter((i) => i.floor === floor.id)) {
    const bz = z0 + (item.z ?? 0);
    boxes.push(box(item.x, item.y, bz, item.x + item.w, item.y + item.d, bz + item.h, item.colour));
  }
}

// Build every solid box for the chosen floors.
// lift adds extra height to a floor, e.g. { first: 1.2 } for an exploded view.
export function buildScene(house, floorIds, lift = {}) {
  const boxes = [];
  for (const floor of house.floors) {
    if (floorIds.includes(floor.id)) addFloor(boxes, house, floor, lift[floor.id] ?? 0);
  }
  return boxes;
}
