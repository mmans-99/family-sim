// Pixel-art sprites from the Sierrassets "Furniture pack" (top-down art, 16 pixels per grid square).
// The sheets are in assets/furniture-pack/. If they cannot be loaded, the house is drawn
// with plain coloured blocks instead, so the game still works.

export const PACK_FOLDER = 'assets/furniture-pack/';

// Where each sprite sits on furniture.png: [x, y, width, height] in sheet pixels.
export const SPRITE_RECTS = {
  sofa_blue: [68, 85, 32, 16],
  armchair_red: [17, 193, 16, 27],
  table_low: [374, 85, 32, 16],
  sideboard: [238, 0, 32, 16],
  sideboard_drawers: [272, 0, 32, 16],
  tv_flat: [85, 68, 32, 16],
  bookcase: [102, 307, 16, 32],
  plant_tall: [139, 19, 8, 14],
  plant_leafy: [123, 21, 8, 12],
  lamp_table: [393, 187, 12, 16],
  lamp_small: [444, 188, 11, 15],
  counter_white: [153, 204, 16, 16],
  cooker_white: [1, 119, 14, 16],
  sink_white: [85, 221, 15, 16],
  sink_wood: [0, 221, 16, 16],
  fridge_white: [221, 324, 15, 32],
  table_wood: [289, 53, 32, 14],
  chair_front: [547, 88, 10, 13],
  chair_back: [445, 88, 9, 13],
  shelf_low: [340, 187, 16, 16],
  toilet: [581, 333, 9, 22],
  washer: [2, 306, 12, 16],
  basket: [461, 307, 12, 12],
  bed_double: [170, 36, 32, 31],
  bed_single_blue: [221, 73, 16, 28],
  bed_single_cream: [238, 38, 16, 29],
  drawers_small: [68, 34, 16, 16],
  wardrobe: [102, 35, 16, 32],
  bath: [34, 0, 32, 16],
  shower: [17, 69, 16, 32],
  chest: [119, 310, 16, 12],
  stool: [326, 56, 10, 11],
};

// House item names (data/house.json) -> sprite. Anything not listed stays a plain block.
export const NAME_TO_SPRITE = {
  'sofa': 'sofa_blue',
  'armchair': 'armchair_red',
  'coffee table': 'table_low',
  'TV unit': 'sideboard',
  'TV': 'tv_flat',
  'bookcase': 'bookcase',
  'plant': 'plant_tall',
  'landing plant': 'plant_leafy',
  'lamp': 'lamp_table',
  'bedside lamp': 'lamp_small',
  'kitchen counter': 'counter_white',
  'cooker': 'cooker_white',
  'kitchen sink': 'sink_white',
  'basin': 'sink_wood',
  'fridge': 'fridge_white',
  'dining table': 'table_wood',
  'chair facing': 'chair_front',
  'chair': 'chair_back',
  'shoe rack': 'shelf_low',
  'toilet': 'toilet',
  'washing machine': 'washer',
  'bin': 'basket',
  'bed frame': 'bed_double',
  "Oliver's bed": 'bed_single_blue',
  'cot': 'bed_single_cream',
  'bedside table': 'drawers_small',
  'wardrobe': 'wardrobe',
  'dresser': 'sideboard_drawers',
  'bath': 'bath',
  'shower': 'shower',
  'toy box': 'chest',
  'garden table': 'table_wood',
  'garden chair': 'stool',
};

// Floor tiles on floors-walls.png. Each is 8 x 8 pixels, so four cover one grid square.
export const FLOOR_TILE_PX = 8;
export const FLOOR_TILES = {
  plank: [27, 1],
  plank_dark: [27, 10],
  parquet: [27, 19],
  tile_blue: [27, 28],
  tile_white: [27, 37],
};

// Which floor tile each room uses. Rooms not listed (the garden) keep plain blocks.
export const ROOM_TILE = {
  lounge: 'plank', hall: 'plank_dark', kitchen: 'tile_white', loo: 'tile_blue', utility: 'tile_white',
  master: 'plank', landing: 'plank_dark', bathroom: 'tile_blue', oliver: 'plank', ruby: 'plank',
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

// Build the pack from the two loaded sheets. Returns cut-out sprites and floor tiles by name.
export function makePack(furniture, floors) {
  const sprites = {};
  for (const [name, rect] of Object.entries(SPRITE_RECTS)) sprites[name] = crop(furniture, rect);
  const tiles = {};
  for (const [name, [x, y]] of Object.entries(FLOOR_TILES)) {
    tiles[name] = crop(floors, [x, y, FLOOR_TILE_PX, FLOOR_TILE_PX]);
  }
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
    const [furniture, floors] = await Promise.all([load('furniture.png'), load('floors-walls.png')]);
    return makePack(toPixels(furniture), toPixels(floors));
  } catch {
    return null;
  }
}
