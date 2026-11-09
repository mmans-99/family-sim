// Pixel-art sprites from a sprite pack (Cryovex, free version).
// The image files are NOT in the repo (licence: no redistribution). They live in
// assets/cryovex/ on the machine that runs the game. If they are missing, the house
// is drawn with plain blocks instead, so the game still works.

export const PACK_FOLDER = 'assets/cryovex/';

// Where each sprite sits on the furniture sheet: [x, y, width, height] in sheet pixels.
export const SPRITE_RECTS = {
  bed_double: [242, 664, 66, 56],
  bed_blue: [54, 670, 66, 50],
  grey_sofa: [2, 566, 66, 42],
  brown_chair: [2, 160, 34, 35],
  table_dark: [50, 391, 46, 41],
  table_brown: [2, 392, 46, 41],
  table_light: [38, 528, 34, 34],
  wardrobe: [310, 240, 58, 82],
};

// House item names -> sprite. Anything not listed stays a plain block.
export const NAME_TO_SPRITE = {
  'sofa': 'grey_sofa',
  'armchair': 'brown_chair',
  'bed frame': 'bed_double',
  "Oliver's bed": 'bed_blue',
  'cot': 'bed_blue',
  'dining table': 'table_dark',
  'base units': 'table_brown',
  'wall units': 'table_brown',
  'TV unit': 'table_brown',
  'coffee table': 'table_light',
  'bedside table': 'table_light',
  'bookcase': 'wardrobe',
  'wardrobe': 'wardrobe',
};

// Items hidden when the pack is used (they are parts of a sprite already drawn).
export const PACK_HIDDEN = new Set(['mattress', 'headboard', 'cot mattress']);

// Floor tile colours: cell number on the floor sheet (cells are 16 pixels wide).
export const FLOOR_CELLS = { wood: 0, black: 1, white: 2, dark: 3, grey: 4, beige: 5, blue: 7 };
export const FLOOR_ANCHOR = { x: 8, y: 10 }; // the middle of a tile's top surface

// Which floor tile each room uses. Rooms not listed keep plain blocks (e.g. the garden).
export const ROOM_TILE = {
  lounge: 'wood', hall: 'wood', kitchen: 'beige', loo: 'white', utility: 'grey',
  master: 'wood', landing: 'wood', bathroom: 'white', oliver: 'wood', ruby: 'wood',
};

// Copy a rectangle out of pixel data: { width, height, data } with RGBA bytes.
export function crop(src, [x, y, w, h]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    const from = ((y + row) * src.width + x) * 4;
    data.set(src.data.subarray(from, from + w * 4), row * w * 4);
  }
  return { width: w, height: h, data };
}

// Build a pack from two loaded images. Returns cached sprites by name.
export function makePack(furniture, floor) {
  const sprites = {};
  for (const [name, rect] of Object.entries(SPRITE_RECTS)) sprites[name] = crop(furniture, rect);
  const tiles = {};
  for (const [name, cell] of Object.entries(FLOOR_CELLS)) tiles[name] = crop(floor, [16 * cell, 0, 16, 16]);
  return { sprites, tiles };
}

// Load the pack in a browser. Resolves to null if the images are not there.
export async function loadPack(folder = PACK_FOLDER) {
  const load = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = folder + file;
  });
  const toPixels = (img) => {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height);
    return { width: d.width, height: d.height, data: d.data };
  };
  try {
    const [furniture, floor] = await Promise.all([load('furniture_free.png'), load('floor_free.png')]);
    return makePack(toPixels(furniture), toPixels(floor));
  } catch {
    return null;
  }
}
