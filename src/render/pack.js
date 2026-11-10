// Pixel-art furniture sprites from the Sierrassets "Furniture pack" (flat front/side view).
// The sheet is committed in assets/furniture-pack/. If it cannot be loaded, the house
// is drawn with plain blocks instead, so the game still works.

export const PACK_FOLDER = 'assets/furniture-pack/';

// Where each sprite sits on the furniture sheet: [x, y, width, height] in sheet pixels.
// Found by finding the separate shapes on furniture.png (see STATUS.md). One house grid
// unit is about 16 sprite pixels across.
export const SPRITE_RECTS = {
  sofa_red: [255, 51, 32, 16],
  armchair_red: [19, 38, 12, 10],
  bed_white: [204, 35, 32, 32],
  bed_blue: [170, 36, 32, 31],
  table_wood_long: [306, 70, 32, 14],
  table_low: [374, 85, 32, 16],
  cabinet_small: [34, 51, 16, 16],
  units_wood: [34, 18, 32, 15],
  cabinet_tall_small: [68, 34, 16, 16],
  tv_unit: [85, 68, 32, 16],
  tv_flat: [119, 68, 32, 16],
  wardrobe: [102, 35, 16, 32],
  bookcase: [136, 35, 32, 32],
  fridge_white: [340, 87, 16, 31],
  washer: [323, 0, 16, 16],
  plant: [123, 21, 8, 12],
  chair_wood: [2, 35, 11, 15],
};

// House item names -> sprite. Anything not listed stays a plain block.
export const NAME_TO_SPRITE = {
  'sofa': 'sofa_red',
  'armchair': 'armchair_red',
  'bed frame': 'bed_white',
  "Oliver's bed": 'bed_blue',
  'dining table': 'table_wood_long',
  'coffee table': 'table_low',
  'bedside table': 'cabinet_small',
  'base units': 'units_wood',
  'wall units': 'cabinet_tall_small',
  'TV unit': 'tv_unit',
  'TV': 'tv_flat',
  'wardrobe': 'wardrobe',
  'bookcase': 'bookcase',
  'fridge': 'fridge_white',
  'washing machine': 'washer',
  'plant': 'plant',
  'chair': 'chair_wood',
};

// Items hidden when the pack is used (they are parts of a sprite already drawn).
export const PACK_HIDDEN = new Set(['mattress', 'headboard', 'cot mattress', 'sofa back']);

// Which floor colour each room uses (for when floors get sprites again). Rooms not listed keep plain blocks.
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

// Build the pack from the loaded furniture sheet. Returns cached sprites by name.
export function makePack(furniture) {
  const sprites = {};
  for (const [name, rect] of Object.entries(SPRITE_RECTS)) sprites[name] = crop(furniture, rect);
  return { sprites };
}

// Load the pack in a browser. Resolves to null if the image is not there.
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
    const furniture = await load('furniture.png');
    return makePack(toPixels(furniture));
  } catch {
    return null;
  }
}
