const { TRAIL_PRESETS } = require('./trails');
const SIZES = [25, 50, 75, 100];
const DEFAULTS = { color: 'green', movement: 'stay', facing: 'right', size: 100, paused: false, position: null };

function sizeFor(percent) {
  return { width: 288 * percent / 100, height: 96 * percent / 100 };
}

function normalize(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    color: Object.hasOwn(TRAIL_PRESETS, input.color) ? input.color : DEFAULTS.color,
    movement: ['roam', 'stay'].includes(input.movement) ? input.movement : DEFAULTS.movement,
    facing: ['left', 'right', 'auto'].includes(input.facing) ? input.facing : DEFAULTS.facing,
    size: SIZES.includes(input.size) ? input.size : DEFAULTS.size,
    paused: typeof input.paused === 'boolean' ? input.paused : false,
    position: input.position && Number.isFinite(input.position.x) && Number.isFinite(input.position.y)
      ? { x: Math.round(input.position.x), y: Math.round(input.position.y) } : null,
  };
}
module.exports = { SIZES, DEFAULTS, normalize, sizeFor };
