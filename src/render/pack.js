// Pixel-art sprites from the Sierrassets "Furniture pack" (top-down art, 16 pixels per grid square).
// The sheets are in assets/furniture-pack/. The pack has no stairs, shed, tree, fence, lawn,
// path, whole rugs or people, so those are on our own sheet, assets/extras/extras.png, drawn in the
// pack's colours by tools/make_extras.py. If the sheets cannot be loaded, the house is drawn
// with plain coloured blocks instead, so the game still works.

export const PACK_FOLDER = 'assets/furniture-pack/';
export const EXTRAS_FILE = 'assets/extras/extras.png';

// Where each piece sits on extras.png: [x, y, width, height]. Printed by tools/make_extras.py.
export const EXTRA_RECTS = {
  stairs_up: [0, 0, 16, 64],
  stairs_down: [18, 0, 16, 64],
  shed: [36, 0, 32, 40],
  tree: [70, 0, 32, 44],
  grass: [104, 0, 16, 16],
  paving: [122, 0, 16, 16],
  rug_red: [140, 0, 24, 24],
  rug_blue: [166, 0, 24, 24],
  rug_gold: [192, 0, 24, 24],
  wall_face: [218, 0, 16, 16],
  window_face: [236, 0, 16, 16],
  sarah_stand: [254, 0, 12, 21],
  sarah_walk: [268, 0, 12, 21],
  sarah_sit: [282, 0, 12, 17],
  sarah_lie: [296, 0, 10, 9],
  road: [308, 0, 16, 16],
  road_line: [326, 0, 16, 16],
  kerb: [344, 0, 16, 4],
  pavement: [362, 0, 16, 16],
  roof: [380, 0, 16, 16],
  roof_ridge: [398, 0, 16, 16],
  front_wall: [416, 0, 16, 6],
  hedge: [434, 0, 16, 16],
};

// Extras that are sprites, standing on their squares like furniture.
const EXTRA_SPRITES = [
  'stairs_up', 'stairs_down', 'shed', 'tree', 'wall_face', 'window_face',
  'sarah_stand', 'sarah_walk', 'sarah_sit', 'sarah_lie',
];
// Extras that repeat over an area, one copy per grid square.
const EXTRA_TILES = [
  'grass', 'paving', 'road', 'road_line', 'kerb', 'pavement', 'roof', 'roof_ridge', 'front_wall', 'hedge',
];
// Rug templates: 24 x 24, cut into nine 8 x 8 pieces and stretched by repeating edges.
export const RUG_PIECE_PX = 8;
const EXTRA_RUGS = ['rug_red', 'rug_blue', 'rug_gold'];

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
  'nursing chair': 'armchair_red',
  'chest of drawers': 'drawers_small',
  'stairs': 'stairs_up',
  'stairwell': 'stairs_down',
  'shed': 'shed',
  'tree': 'tree',
};

// Flat items (lying on the floor) drawn as a repeating tile or as a rug.
export const NAME_TO_TILE = { 'path': 'paving' };
export const NAME_TO_RUG = { 'rug': 'rug_red', 'blue rug': 'rug_blue', 'gold rug': 'rug_gold' };

// Floor tiles on floors-walls.png. Each is 8 x 8 pixels, so four cover one grid square.
export const FLOOR_TILE_PX = 8;
export const FLOOR_TILES = {
  plank: [27, 1],
  plank_dark: [27, 10],
  parquet: [27, 19],
  tile_blue: [27, 28],
  tile_white: [27, 37],
};

// Which floor tile each room uses (8 x 8 pack tiles, or the 16 x 16 grass from extras).
// Rooms not listed keep plain blocks.
export const ROOM_TILE = {
  lounge: 'plank', hall: 'plank_dark', kitchen: 'tile_white', loo: 'tile_blue', utility: 'tile_white',
  master: 'plank', landing: 'plank_dark', bathroom: 'tile_blue', oliver: 'plank', ruby: 'plank',
  garden: 'grass',
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
export function makePack(furniture, floors, extras = null) {
  const sprites = {};
  for (const [name, rect] of Object.entries(SPRITE_RECTS)) sprites[name] = crop(furniture, rect);
  const tiles = {};
  for (const [name, [x, y]] of Object.entries(FLOOR_TILES)) {
    tiles[name] = crop(floors, [x, y, FLOOR_TILE_PX, FLOOR_TILE_PX]);
  }
  const rugs = {};
  if (extras) {
    for (const name of EXTRA_SPRITES) sprites[name] = crop(extras, EXTRA_RECTS[name]);
    for (const name of EXTRA_TILES) tiles[name] = crop(extras, EXTRA_RECTS[name]);
    for (const name of EXTRA_RUGS) rugs[name] = crop(extras, EXTRA_RECTS[name]);
  }
  return { sprites, tiles, rugs };
}

// Animated people sheets: assets/people/<id>.png with <id>.json listing each frame.
export const PEOPLE_FOLDER = 'assets/people/';

export function addPersonFrames(pack, id, sheet, meta) {
  for (const [name, rect] of Object.entries(meta.rects)) pack.sprites[`${id}:${name}`] = crop(sheet, rect);
}

// Load the pack in a browser. Resolves to null if the images are not there.
// people: ids of animated people sheets to load as well (e.g. ['sarah']).
export async function loadPack(folder = PACK_FOLDER, people = []) {
  const load = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = file;
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
    const [furniture, floors] = await Promise.all([load(folder + 'furniture.png'), load(folder + 'floors-walls.png')]);
    const extras = await load(EXTRAS_FILE).catch(() => null);
    const pack = makePack(toPixels(furniture), toPixels(floors), extras && toPixels(extras));
    for (const id of people) {
      // Animated people (tools/make_mum.py): every frame becomes a sprite named "id:frame".
      try {
        const meta = await (await fetch(`${PEOPLE_FOLDER}${id}.json`)).json();
        const sheet = toPixels(await load(`${PEOPLE_FOLDER}${id}.png`));
        addPersonFrames(pack, id, sheet, meta);
      } catch { /* no sheet: the simple extras sprites are used instead */ }
    }
    return pack;
  } catch {
    return null;
  }
}
