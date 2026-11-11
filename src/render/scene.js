// Turns data/house.json into a flat list of solid boxes for the house view.
// Pure logic (no drawing), so it can be tested without a browser.
import { ROOM_TILE } from './pack.js';

export const COLOURS = {
  wall: '#f6e7c8',
  brick: '#b8653c',
  door: '#8a5530',
  glass: '#ffe59a',   // warm window light
  fence: '#9a7048',
  lawn: '#8fc06a',
  floor: '#e0b98a',   // wood
};

const DOOR_HEIGHT = 2.1;
const DOOR_THICKNESS = 0.06;
const FENCE_THICKNESS = 0.1;
const WINDOW_SILL = 0.9;     // height of the window bottom above the floor
const WINDOW_HEIGHT = 1.1;
const WINDOW_EXTRA_THICKNESS = 0.05; // windows stand a little proud of the wall

export function box(x0, y0, z0, x1, y1, z1, colour) {
  return { x0, y0, z0, x1, y1, z1, colour, kind: 'other', mid: null };
}

function tag(b, kind, mid = null) {
  b.kind = kind;
  b.mid = mid;
  return b;
}

// Midpoint of a straight wall segment, in grid units.
function segMid(axis, at, from, to) {
  return axis === 'h' ? { x: (from + to) / 2, y: at } : { x: at, y: (from + to) / 2 };
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

// One window per two grid tiles of outside wall, each exactly one tile wide.
function addWindows(boxes, e, piece, z0, thickness) {
  const mid = segMid(e.axis, e.at, piece.from, piece.to);
  for (let p = piece.from + 1; p + 1 <= piece.to - 0.5; p += 2) {
    boxes.push(tag(wallBox(
      e.axis, e.at, p, p + 1,
      z0 + WINDOW_SILL, WINDOW_HEIGHT, thickness + WINDOW_EXTRA_THICKNESS, COLOURS.glass,
    ), 'window', mid));
  }
}

// A slightly darker copy of a #rrggbb colour, for alternate floor tiles.
function darker(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => Math.round(((n >> s) & 255) * f);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

function addFloor(boxes, house, floor, lift) {
  const z0 = (floor.z ?? 0) + lift;
  const height = floor.height;
  const thickness = house.wallThickness ?? 0.15;
  const slab = house.floorThickness ?? 0.2;
  const doors = floor.doors ?? [];
  const inside = floor.rooms.filter((r) => !r.outside);

  // Floor tiles: one box per grid square, alternate squares a shade darker.
  for (const room of floor.rooms) {
    if (room.noSlab) continue;
    const base = room.outside ? COLOURS.lawn : (room.floor ?? COLOURS.floor);
    for (let cx = room.x; cx < room.x + room.w; cx++) {
      for (let cy = room.y; cy < room.y + room.h; cy++) {
        const colour = (cx + cy) % 2 ? darker(base, 0.95) : base;
        const tile = box(cx, cy, z0 - slab, cx + 1, cy + 1, z0, colour);
        tile.tile = ROOM_TILE[room.id] ?? null; // pack floor tile, if this room has one
        boxes.push(tag(tile, 'slab'));
      }
    }
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
          boxes.push(tag(wallBox(
            e.axis, e.at, piece.from, piece.to, z0, height, thickness,
            outer ? COLOURS.brick : COLOURS.wall,
          ), 'wall', segMid(e.axis, e.at, piece.from, piece.to)));
          if (outer) addWindows(boxes, e, piece, z0, thickness);
        }
      }
    }
  }

  for (const d of doors) {
    boxes.push(tag(
      wallBox(d.axis, d.at, d.from, d.to, z0, DOOR_HEIGHT, DOOR_THICKNESS, COLOURS.door),
      'door', segMid(d.axis, d.at, d.from, d.to),
    ));
  }
  for (const f of floor.fence ?? []) {
    boxes.push(tag(wallBox(f.axis, f.at, f.from, f.to, z0, height, FENCE_THICKNESS, COLOURS.fence), 'fence'));
  }
  for (const item of (house.furniture ?? []).filter((i) => i.floor === floor.id)) {
    const bz = z0 + (item.z ?? 0);
    const piece = box(item.x, item.y, bz, item.x + item.w, item.y + item.d, bz + item.h, item.colour);
    piece.name = item.name; // lets the pack swap the block for a sprite
    piece.lift = item.z ?? 0; // height above its own floor (a TV on its unit, a lamp on a table)
    boxes.push(tag(piece, 'furniture'));
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
