const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalize, SIZES, sizeFor } = require('../src/lib/preferences');
const { advance, clampPosition } = require('../src/lib/movement');
const { TRAIL_GROUPS, TRAIL_PRESETS } = require('../src/lib/trails');
const size = { width: 288, height: 96 };
const area = { x: -1920, y: -200, width: 1920, height: 1080 };

test('restores facing, color, pause, mode and negative monitor position', () => {
  const saved = { facing: 'left', color: 'rainbow', movement: 'stay', size: 50, paused: true, position: { x: -900, y: -100 } };
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(saved))), saved);
  assert.equal(normalize({ facing: 'auto' }).facing, 'auto');
  assert.equal(normalize({ facing: 'right' }).facing, 'right');
});
test('invalid or corrupt settings fall back safely', () => {
  assert.deepEqual(normalize(null), normalize({ facing: 'up', color: '__proto__', paused: 'false', position: { x: Infinity, y: 1 } }));
  assert.equal(normalize().facing, 'right');
  assert.equal(normalize().color, 'green');
  assert.equal(normalize().movement, 'stay');
  assert.equal(normalize().size, 100);
  assert.equal(normalize({ size: 33 }).size, 100);
});
test('all size selections persist and keep the pet inside monitor bounds', () => {
  for (const size of SIZES) {
    assert.equal(normalize(JSON.parse(JSON.stringify({ size }))).size, size);
    const dimensions = sizeFor(size);
    assert.equal(dimensions.width / dimensions.height, 3);
    const edge = clampPosition({ x: 0, y: 1000 }, area, dimensions);
    assert.equal(edge.x + dimensions.width, area.x + area.width);
    assert.equal(edge.y + dimensions.height, area.y + area.height);
  }
  assert.equal(normalize({ movement: 'roam' }).movement, 'roam');
});
test('bounces at display edges including negative coordinates', () => {
  const result = advance({ x: -289, y: -199 }, { x: 84, y: -42 }, 0.05, area, size);
  assert.deepEqual(result.position, { x: -288, y: -200 });
  assert.deepEqual(result.velocity, { x: -84, y: 42 });
});
test('removed monitors and oversized pets are clamped into work area', () => {
  assert.deepEqual(clampPosition({ x: 4000, y: -2000 }, area, size), { x: -288, y: -200 });
  assert.deepEqual(clampPosition({ x: 500, y: 500 }, { x: 0, y: 0, width: 200, height: 50 }, size), { x: 0, y: 0 });
});
test('movement preserves fractional distance between window updates', () => {
  let position = { x: -1000, y: 0 };
  const velocity = { x: 84, y: 42 };
  for (let i = 0; i < 60; i++) position = advance(position, velocity, 1 / 60, area, size).position;
  assert.ok(Math.abs(position.x - (-916)) < 0.001);
  assert.ok(Math.abs(position.y - 42) < 0.001);
});
test('all original animation frames retain six separately recolorable stripes', async () => {
  const { NYAN_FRAMES, NYAN_FRAME_MS } = await import('../src/nyanFrames.mjs');
  assert.equal(NYAN_FRAMES.length, 12);
  assert.equal(NYAN_FRAME_MS, 90);
  for (const frame of NYAN_FRAMES) {
    assert.equal(frame.filter(path => path.fill.startsWith('#04F601')).length, 6);
    assert.ok(frame.some(path => path.fill === '#111111'));
  }
});

test('all 17 preset identifiers round-trip through existing preferences', () => {
  assert.deepEqual(TRAIL_GROUPS.map(group => group.label), ['Classic Colors', 'Pride Collection']);
  assert.equal(Object.keys(TRAIL_PRESETS).length, 17);
  for (const preset of Object.values(TRAIL_PRESETS)) {
    assert.equal(normalize(JSON.parse(JSON.stringify({ color: preset.id }))).color, preset.id);
    assert.ok(preset.colors.every(color => /^#[0-9A-F]{6}$/.test(color)));
  }
  assert.equal(normalize({ color: 'unknown' }).color, 'green');
  assert.deepEqual(TRAIL_PRESETS.bisexual.colors, ['#D60270', '#D60270', '#9B4F96', '#0038A8', '#0038A8']);
});

test('variable stripe counts cover the full trail with sharp adjacent bands', async () => {
  const { stripeBands } = await import('../src/trailRenderer.mjs');
  for (const count of [1, 3, 4, 5, 6, 7, 11, 18]) {
    const colors = Array.from({ length: count }, (_, i) => `color-${i}`);
    const bands = stripeBands(18, 69, colors);
    assert.equal(bands[0].y, 18);
    assert.equal(bands.at(-1).y + bands.at(-1).height, 69);
    assert.deepEqual(bands.map(band => band.color), colors);
    bands.forEach((band, i) => {
      assert.ok(Number.isInteger(band.y) && Number.isInteger(band.height) && band.height > 0);
      if (i) assert.equal(band.y, bands[i - 1].y + bands[i - 1].height);
    });
  }
});
