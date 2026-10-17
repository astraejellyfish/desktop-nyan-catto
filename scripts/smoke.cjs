// Runs the real app with isolated preferences and exercises its tray callbacks.
const { app, BrowserWindow, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { TRAIL_GROUPS } = require('../src/lib/trails');
const profile = path.join(__dirname, '..', '.smoke-data');
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
let template;
const buildMenu = Menu.buildFromTemplate.bind(Menu);
Menu.buildFromTemplate = items => {
  if (items.some(item => item.label === 'Movement')) template = items;
  return buildMenu(items);
};
require('../main.js');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (win.webContents.isLoading()) await new Promise(resolve => win.webContents.once('did-finish-load', resolve));
    const errors = [];
    win.webContents.on('console-message', (_event, details) => {
      if (details.level === 'error') errors.push(details.message);
    });
    const choose = (menu, label) => {
      const items = template.find(item => item.label === menu).submenu;
      const options = menu === 'Trail Color' ? items.flatMap(group => group.submenu) : items;
      options.find(item => item.label === label).click();
    };
    const evaluate = expression => win.webContents.executeJavaScript(expression);
    const getState = () => evaluate('window.pet.getState()');
    if (process.argv.includes('--check-restored')) {
      const restored = await getState();
      assert.equal(restored.color, 'progress-pride');
      assert.equal(restored.size, 50);
      assert.equal(restored.movement, 'stay');
      assert.equal(restored.trail.id, 'progress-pride');
      console.log('PASS: Pride preset and existing preferences restored after restarting Electron.');
      return;
    }
    const pixels = () => evaluate("Array.from(document.getElementById('cat').getContext('2d').getImageData(0,0,288,96).data)");
    choose('Movement', 'Stay');
    choose('Size', '100%');
    if (!(await getState()).paused) template.find(item => item.label === 'Pause').click();
    choose('Trail Color', 'Neon Green');
    choose('Facing', 'Right');
    await delay(100);
    const right = await pixels();
    assert.ok(right.some((value, index) => index % 4 === 3 && value > 0), 'cat must have visible pixels');
    assert.ok(right.some((value, index) => index % 4 === 3 && value === 0), 'background must be transparent');
    choose('Facing', 'Left');
    await delay(100);
    const left = await pixels();
    for (let y = 0; y < 96; y++) for (let x = 0; x < 288; x++) for (let c = 0; c < 4; c++) {
      assert.equal(left[(y * 288 + x) * 4 + c], right[(y * 288 + 287 - x) * 4 + c], 'left must mirror the full scene');
    }
    for (const label of ['Neon Green', 'Pink', 'Blue', 'Purple', 'Orange', 'Yellow', 'Rainbow']) {
      choose('Trail Color', label);
      await delay(30);
      const colored = await pixels();
      const stripeColors = new Set();
      for (let i = 0; i < colored.length; i += 4) {
        if (left[i + 3] === 0) continue;
        if (left[i] === left[i + 1] && left[i + 1] === left[i + 2]) {
          assert.deepEqual(colored.slice(i, i + 4), left.slice(i, i + 4), 'cat pixels must keep their original colors');
        } else stripeColors.add(colored.slice(i, i + 3).join(','));
      }
      if (label === 'Rainbow') assert.equal(stripeColors.size, 6, 'rainbow must contain six distinct stripes');
    }
    choose('Facing', 'Follow Movement');
    assert.equal((await getState()).facing, 'auto');
    choose('Facing', 'Right');
    const trailPixels = [];
    for (let i = 0; i < right.length; i += 4) {
      if (right[i + 1] > right[i] && right[i + 1] > right[i + 2]) trailPixels.push(i);
    }
    const top = Math.min(...trailPixels.map(i => Math.floor(i / 4 / 288)));
    const bottom = Math.max(...trailPixels.map(i => Math.floor(i / 4 / 288))) + 1;
    const { stripeBands } = await import('../src/trailRenderer.mjs');
    for (const preset of TRAIL_GROUPS[1].presets) {
      choose('Trail Color', preset.label);
      await delay(30);
      const colored = await pixels();
      const bands = stripeBands(top, bottom, preset.colors);
      for (const i of trailPixels) {
        const y = Math.floor(i / 4 / 288);
        const band = bands.find(band => y >= band.y && y < band.y + band.height);
        const rgb = band.color.slice(1).match(/../g).map(hex => parseInt(hex, 16));
        assert.deepEqual(colored.slice(i, i + 4), [...rgb, 255], `${preset.id}: stripe color/order at row ${y}`);
      }
      for (let i = 0; i < right.length; i += 4) {
        if (right[i] === right[i + 1] && right[i + 1] === right[i + 2]) {
          assert.deepEqual(colored.slice(i, i + 4), right.slice(i, i + 4), `${preset.id}: cat and transparency must stay unchanged`);
        }
      }
      const groups = template.find(item => item.label === 'Trail Color').submenu;
      assert.deepEqual(groups.flatMap(group => group.submenu).filter(item => item.checked).map(item => item.label), [preset.label]);
      assert.equal((await getState()).color, preset.id);
    }
    // Verify animation continues in both modes, with Pride still selected.
    template.find(item => item.label === 'Resume').click();
    for (const mode of ['Free Roam', 'Stay']) {
      choose('Movement', mode);
      const snapshots = new Set();
      for (let i = 0; i < 5; i++) {
        snapshots.add(await evaluate("document.getElementById('cat').toDataURL()"));
        await delay(100);
      }
      assert.ok(snapshots.size > 1, `Pride animation continues in ${mode}`);
    }
    template.find(item => item.label === 'Pause').click();
    choose('Facing', 'Left');
    for (const size of [25, 50, 75, 100]) {
      choose('Size', `${size}%`);
      await delay(100);
      assert.equal((await getState()).size, size);
      assert.deepEqual(win.getContentSize(), [288 * size / 100, process.platform === 'win32' ? Math.max(40, 96 * size / 100) : 96 * size / 100]);
      const rect = await evaluate("({ width: document.getElementById('cat').getBoundingClientRect().width, height: document.getElementById('cat').getBoundingClientRect().height })");
      assert.deepEqual(rect, { width: 288 * size / 100, height: 96 * size / 100 });
      assert.equal(template.find(item => item.label === 'Size').submenu.find(item => item.checked).label, `${size}%`);
    }
    choose('Size', '50%');
    const saved = JSON.parse(fs.readFileSync(path.join(profile, 'preferences.json'), 'utf8'));
    assert.equal(saved.facing, 'left');
    assert.equal(saved.color, 'progress-pride');
    assert.equal(saved.movement, 'stay');
    assert.equal(saved.paused, true);
    assert.equal(saved.size, 50);
    assert.equal(win.isAlwaysOnTop(), true);
    assert.equal(win.isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('PASS: classic trails, all Pride stripe colors/order, unchanged sprite, exclusive tray selection, animation in both movement modes, sizes and saved preferences.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    app.quit();
    if (process.exitCode) app.exit(process.exitCode);
  }
});
