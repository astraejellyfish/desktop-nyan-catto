const TRAIL_GROUPS = require('./trails.json');
const TRAIL_PRESETS = Object.fromEntries(TRAIL_GROUPS.flatMap(group => group.presets.map(preset => [preset.id, preset])));
module.exports = { TRAIL_GROUPS, TRAIL_PRESETS };
