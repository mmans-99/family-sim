// Free camera: orbit (yaw and pitch), zoom and pan. Pure maths, no DOM.
// Units: 1 unit = one grid square of the house. z is height above the ground.

export const TARGET = { x: 6, y: 5, z: 1.2 }; // middle of the house
// Fixed isometric tilt: 30 degrees, which gives the 2:1 tile shape pixel-art sprites use.
// The house is turned in 90-degree steps, so sprites only need drawing in four directions.
export const ISO_PITCH = Math.asin(0.5);
export const QUARTER_TURN = Math.PI / 2;
export const UNITS_ACROSS_AT_ZOOM_1 = 16;

function normalise([x, y, z]) {
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
}
const LIGHT = normalise([-0.4, 0.45, 0.8]);

export function createCamera() {
  return { yaw: Math.PI / 4, pitch: ISO_PITCH, zoomMul: 1, panX: 0, panY: 0 };
}

// Turn a direction (or a point relative to TARGET) by the camera's yaw.
function rotateDir(cam, [x, y, z]) {
  const c = Math.cos(cam.yaw);
  const s = Math.sin(cam.yaw);
  return [x * c - y * s, x * s + y * c, z];
}

// How far a ground position is from the middle of the house, towards the viewer
// (negative = nearer the viewer than the middle).
export function viewY(cam, x, y) {
  return rotateDir(cam, [x - TARGET.x, y - TARGET.y, 0])[1];
}

// World point -> screen pixels. depth: bigger means further from the viewer.
export function project(cam, width, height, x, y, z) {
  const [xr, yr] = rotateDir(cam, [x - TARGET.x, y - TARGET.y, 0]);
  const zr = z - TARGET.z;
  const zoom = (width / UNITS_ACROSS_AT_ZOOM_1) * cam.zoomMul;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  return {
    sx: width / 2 + cam.panX + xr * zoom,
    sy: height / 2 + cam.panY - (zr * cp + yr * sp) * zoom,
    depth: yr * cp - zr * sp,
  };
}

// Does a face with this outward normal point towards the viewer?
// The viewer sits towards -y and above, looking down at the pitch angle.
export function facesViewer(cam, n) {
  const [, ny, nz] = rotateDir(cam, n);
  return -ny * Math.cos(cam.pitch) + nz * Math.sin(cam.pitch) > 0;
}

// Brightness of a face: 0.6 in shadow up to 1.0 facing the light.
export function shade(cam, n) {
  const [x, y, z] = rotateDir(cam, n);
  return 0.6 + 0.4 * Math.max(0, x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2]);
}
