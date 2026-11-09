// Draws one floor of the house as an isometric (diamond-grid) view, from data/house.json.
// The projection maths is exported on its own so it can be tested without a browser.
const COLOURS = {
  room: '#efe6d2',
  outside: '#a9d18e',
  wall: '#4a4036',
  label: '#2b2620',
  shadow: 'rgba(43, 38, 32, 0.25)',
  background: '#f7f4ee',
};
const PAD = 16;     // pixels of margin around the drawing
const DEPTH = 6;    // pixels the shadow sits below each room

// Grid cell (x, y) -> screen pixels relative to the grid origin.
// tile = width of one grid cell on screen.
export function isoPoint(x, y, tile) {
  return { x: (x - y) * (tile / 2), y: (x + y) * (tile / 4) };
}

function roomCorners(room) {
  return [
    [room.x, room.y],
    [room.x + room.w, room.y],
    [room.x + room.w, room.y + room.h],
    [room.x, room.y + room.h],
  ];
}

export function drawFloor(ctx, floor, tile) {
  const { width: W, height: H, rooms } = floor;

  // Size the canvas to fit the whole diamond, then shift so nothing is cut off.
  ctx.canvas.width = Math.ceil(((W + H) * tile) / 2 + PAD * 2);
  ctx.canvas.height = Math.ceil(((W + H) * tile) / 4 + PAD * 2);
  const originX = (H * tile) / 2 + PAD;
  const originY = PAD;
  const toScreen = (x, y) => {
    const p = isoPoint(x, y, tile);
    return { x: p.x + originX, y: p.y + originY };
  };
  const polygon = (room, dy = 0) => {
    ctx.beginPath();
    roomCorners(room).forEach(([x, y], i) => {
      const p = toScreen(x, y);
      if (i === 0) ctx.moveTo(p.x, p.y + dy);
      else ctx.lineTo(p.x, p.y + dy);
    });
    ctx.closePath();
  };

  ctx.fillStyle = COLOURS.background;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Shadows first, so every room's shadow sits underneath all the room tops.
  ctx.fillStyle = COLOURS.shadow;
  for (const room of rooms) {
    polygon(room, DEPTH);
    ctx.fill();
  }

  // Room tops.
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLOURS.wall;
  for (const room of rooms) {
    ctx.fillStyle = room.outside ? COLOURS.outside : COLOURS.room;
    polygon(room);
    ctx.fill();
    ctx.stroke();
  }

  // Room names at the centre of each room.
  ctx.fillStyle = COLOURS.label;
  ctx.font = `${Math.max(10, Math.round(tile * 0.3))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const room of rooms) {
    const c = toScreen(room.x + room.w / 2, room.y + room.h / 2);
    ctx.fillText(room.name, c.x, c.y, tile * Math.min(room.w, room.h) * 0.8);
  }
}
