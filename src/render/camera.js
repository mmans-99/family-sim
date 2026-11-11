// Camera for the house view: straight down, like a plan, to suit the top-down sprite pack.
// The back wall of the house (y = 0) is at the top of the screen and y grows down the screen,
// so furniture standing against a back wall faces the viewer, as the sprites are drawn.
// One grid square is always UNIT_PX art pixels, so sprites are never stretched. Zooming
// changes how big one art pixel is on screen (see main.js), not this maths.
// Pure maths, no DOM. Units: 1 unit = one grid square of the house. z is height above the ground.

export const UNIT_PX = 16; // art pixels per grid square: the size the sprite pack is drawn at
export const TARGET = { x: 6, y: 3 }; // the grid point shown in the middle of the screen

export function createCamera() {
  return { zoomMul: 1, panX: 0, panY: 0 };
}

// Grid position -> art pixels. Height (z) does not move a point; it only decides what is on top.
// depth: bigger means further from the viewer (lower down), so it is drawn first.
export function project(cam, width, height, x, y, z = 0) {
  return {
    sx: width / 2 + cam.panX + (x - TARGET.x) * UNIT_PX,
    sy: height / 2 + cam.panY + (y - TARGET.y) * UNIT_PX,
    depth: -z,
  };
}
