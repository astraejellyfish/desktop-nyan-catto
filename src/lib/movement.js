function clampPosition(position, area, size) {
  return {
    x: Math.round(Math.max(area.x, Math.min(position.x, area.x + Math.max(0, area.width - size.width)))),
    y: Math.round(Math.max(area.y, Math.min(position.y, area.y + Math.max(0, area.height - size.height)))),
  };
}

function advance(position, velocity, seconds, area, size) {
  const next = { x: position.x + velocity.x * seconds, y: position.y + velocity.y * seconds };
  const maxX = area.x + Math.max(0, area.width - size.width);
  const maxY = area.y + Math.max(0, area.height - size.height);
  return {
    position: { x: Math.max(area.x, Math.min(next.x, maxX)), y: Math.max(area.y, Math.min(next.y, maxY)) },
    velocity: {
      x: next.x <= area.x ? Math.abs(velocity.x) : next.x >= maxX ? -Math.abs(velocity.x) : velocity.x,
      y: next.y <= area.y ? Math.abs(velocity.y) : next.y >= maxY ? -Math.abs(velocity.y) : velocity.y,
    },
  };
}
module.exports = { clampPosition, advance };
