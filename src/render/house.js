// Draws one floor of the house from data/house.json.
// This is a simple top-down placeholder. Isometric pixel art comes in a later step.
const COLOURS = {
  room: '#efe6d2',
  outside: '#a9d18e',
  wall: '#4a4036',
  label: '#2b2620',
};

export function drawFloor(ctx, floor, cell) {
  const { width, height, rooms } = floor;
  ctx.canvas.width = width * cell;
  ctx.canvas.height = height * cell;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (const room of rooms) {
    const x = room.x * cell;
    const y = room.y * cell;
    const w = room.w * cell;
    const h = room.h * cell;
    ctx.fillStyle = room.outside ? COLOURS.outside : COLOURS.room;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COLOURS.wall;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
  }

  ctx.fillStyle = COLOURS.label;
  ctx.font = `${Math.max(10, Math.round(cell * 0.3))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const room of rooms) {
    ctx.fillText(
      room.name,
      (room.x + room.w / 2) * cell,
      (room.y + room.h / 2) * cell,
      room.w * cell - 6,
    );
  }
}
