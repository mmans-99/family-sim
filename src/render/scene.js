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

// Edge scenery (house.json `scenery`, HOUSE_VIEW 10.5): flat, drawn only, never walked on.
// Plain colours are used when the sprite pack is not loaded, and by the minimap.
export const SCENERY_COLOURS = {
  road: '#4a4a4e',
  road_line: '#4a4a4e',
  kerb: '#cecbc4',
  pavement: '#c8c8c2',
  grass: '#68ac64',
  paving: '#c8c4ba',
  roof: '#3a4454',
  roof_ridge: '#60707f',
  front_wall: '#96503f',
  hedge: '#346e3e',
};
const SCENERY_Z0 = -0.3; // under everything: the floor slabs sit on 0
const SCENERY_Z1 = -0.29;

const DOOR_HEIGHT = 2.1;
const DOOR_THICKNESS = 0.06;
const FENCE_THICKNESS = 0.25;
export const FACE_HEIGHT = 1; // the front wall's outside face, shown above it, in squares
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

// Where windows go along a piece of outside wall: one per two grid squares, each one
// square wide. Returns the start of each window.
export function windowStarts(piece) {
  const starts = [];
  for (let p = piece.from + 1; p + 1 <= piece.to - 0.5; p += 2) starts.push(p);
  return starts;
}

function addWindows(boxes, e, piece, z0, thickness) {
  const mid = segMid(e.axis, e.at, piece.from, piece.to);
  for (const p of windowStarts(piece)) {
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
        // The front wall (top of the drawing) also shows its outside face above it, which
        // is what tall furniture on that wall is seen against.
        const front = outer && e.axis === 'h' && e.at === b.minY;
        const t = thickness / 2;
        for (const piece of cutOpenings(e, doors)) {
          const wall = tag(wallBox(
            e.axis, e.at, piece.from, piece.to, z0, height, thickness,
            outer ? COLOURS.brick : COLOURS.wall,
          ), 'wall', segMid(e.axis, e.at, piece.from, piece.to));
          wall.outer = outer;
          boxes.push(wall);
          if (outer && !front) addWindows(boxes, e, piece, z0, thickness); // the front's are on its face
          if (front) {
            const x0 = piece.from - (piece.from === b.minX ? t : 0);
            const x1 = piece.to + (piece.to === b.maxX ? t : 0);
            const face = tag(box(x0, e.at - t - FACE_HEIGHT, z0, x1, e.at - t, z0 + height, COLOURS.wall), 'face');
            face.windows = windowStarts(piece).map((p) => p - x0); // offsets, so moving the floor is safe
            face.ends = [x0 < piece.from || doors.some((o) => o.axis === 'h' && o.at === e.at && o.to === piece.from),
              x1 > piece.to || doors.some((o) => o.axis === 'h' && o.at === e.at && o.from === piece.to)];
            boxes.push(face);
          }
        }
        if (front) {
          for (const d of doors.filter((o) => o.axis === 'h' && o.at === e.at && o.from >= e.from && o.to <= e.to)) {
            const face = tag(box(d.from, e.at - t - FACE_HEIGHT, z0, d.to, e.at - t, z0 + DOOR_HEIGHT, COLOURS.door), 'face');
            face.door = true;
            boxes.push(face);
          }
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

// Build every box for the chosen floors.
// place moves a whole floor on the drawing, in grid squares, so several floors can be laid
// out side by side on one screen: { first: { x: 0, y: -8.5 } } puts the first floor above
// the ground floor. Each box remembers which floor it belongs to (b.floor).
export function buildScene(house, floorIds, place = {}) {
  const boxes = [];
  // Scenery goes first, so it is drawn under the house. It belongs to the floor it names
  // (always the ground floor) and moves with that floor's place.
  for (const e of house.scenery ?? []) {
    if (!floorIds.includes(e.floor)) continue;
    const { x = 0, y = 0 } = place[e.floor] ?? {};
    const colour = SCENERY_COLOURS[e.kind] ?? '#888888';
    const b = box(e.x + x, e.y + y, SCENERY_Z0, e.x + e.w + x, e.y + e.h + y, SCENERY_Z1, colour);
    b.kind = 'scenery';
    b.tile = e.kind;      // pack tile name (paintTiled), or null-safe fallback via colour
    b.floor = e.floor;
    boxes.push(b);
  }
  for (const floor of house.floors) {
    if (!floorIds.includes(floor.id)) continue;
    const start = boxes.length;
    addFloor(boxes, house, floor, 0);
    const { x = 0, y = 0 } = place[floor.id] ?? {};
    for (const b of boxes.slice(start)) {
      b.floor = floor.id;
      b.x0 += x; b.x1 += x; b.y0 += y; b.y1 += y;
      if (b.mid) b.mid = { x: b.mid.x + x, y: b.mid.y + y };
    }
  }
  return boxes;
}

// The grid rectangle that holds every box: used to fit a view on the screen.
export function sceneBounds(boxes) {
  return {
    x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)),
  };
}
