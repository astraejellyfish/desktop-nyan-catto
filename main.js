const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { SIZES, normalize, sizeFor } = require('./src/lib/preferences');
const { TRAIL_GROUPS, TRAIL_PRESETS } = require('./src/lib/trails');
const { clampPosition, advance } = require('./src/lib/movement');

let win, tray, timer, saveTimer, settingsPath;
let state = normalize();
let velocity = { x: 84, y: 42 };
let drag = null;
let roamPosition = null;
let shuttingDown = false;
let lastTick = performance.now();

function windowSize() {
  const size = sizeFor(state.size);
  // Windows enforces a minimum native window height, even without a frame.
  return { width: size.width, height: process.platform === 'win32' ? Math.max(40, size.height) : size.height };
}

function publicState() {
  return { ...state, trail: TRAIL_PRESETS[state.color], direction: state.facing === 'auto' ? (velocity.x < 0 ? 'left' : 'right') : state.facing };
}
function broadcast() {
  if (win && !win.isDestroyed()) win.webContents.send('pet:state', publicState());
}
function save() {
  clearTimeout(saveTimer);
  if (!settingsPath) return;
  try {
    const temp = `${settingsPath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(state, null, 2));
    try { fs.renameSync(temp, settingsPath); }
    catch (error) {
      // Windows sync/antivirus tools can briefly lock an existing rename target.
      if (!['EPERM', 'EACCES', 'EEXIST'].includes(error.code)) throw error;
      fs.writeFileSync(settingsPath, JSON.stringify(state, null, 2));
    }
  } catch (error) { console.error('Could not save preferences:', error.message); }
}
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 500); }
function change(key, value) {
  state = normalize({ ...state, [key]: value });
  if (key === 'size') {
    const size = windowSize();
    const area = screen.getDisplayMatching(win.getBounds()).workArea;
    const position = clampPosition(state.position, area, size);
    win.setBounds({ ...position, ...size });
    state.position = position;
    roamPosition = null;
    drag = null;
  }
  save();
  broadcast();
  rebuildMenu();
}
function menuTemplate() {
  return [
    { label: 'Desktop Nyan Catto', enabled: false },
    { type: 'separator' },
    { label: 'Movement', submenu: [['roam', 'Free Roam'], ['stay', 'Stay']].map(([value, label]) => ({
      label, type: 'radio', checked: state.movement === value, click: () => change('movement', value),
    })) },
    { label: 'Facing', submenu: [['left', 'Left'], ['right', 'Right'], ['auto', 'Follow Movement']].map(([value, label]) => ({
      label, type: 'radio', checked: state.facing === value, click: () => change('facing', value),
    })) },
    { label: 'Trail Color', submenu: TRAIL_GROUPS.map(group => ({
      label: group.label, submenu: group.presets.map(preset => ({
        // Native radio groups cannot share selection across separate submenus.
        label: preset.label, type: 'checkbox', checked: state.color === preset.id,
        click: () => change('color', preset.id),
      })),
    })) },
    { label: 'Size', submenu: SIZES.map(value => ({
      label: `${value}%`, type: 'radio', checked: state.size === value, click: () => change('size', value),
    })) },
    { label: state.paused ? 'Resume' : 'Pause', click: () => change('paused', !state.paused) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ];
}
function rebuildMenu() { tray.setContextMenu(Menu.buildFromTemplate(menuTemplate())); }
function setPosition(position, area) {
  const next = clampPosition(position, area, windowSize());
  win.setPosition(next.x, next.y);
  state.position = next;
}
function keepOnScreen() {
  if (!win || win.isDestroyed()) return;
  setPosition(state.position, screen.getDisplayMatching(win.getBounds()).workArea);
  roamPosition = null;
  scheduleSave();
}
function tick() {
  const now = performance.now();
  const seconds = Math.min((now - lastTick) / 1000, 0.05);
  lastTick = now;
  if (!win || win.isDestroyed()) return;
  if (drag) {
    roamPosition = null;
    const cursor = screen.getCursorScreenPoint();
    setPosition({ x: cursor.x - drag.x, y: cursor.y - drag.y }, screen.getDisplayNearestPoint(cursor).workArea);
  } else if (!state.paused && state.movement === 'roam') {
    const previousDirection = Math.sign(velocity.x);
    const next = advance(roamPosition || state.position, velocity, seconds, screen.getDisplayMatching(win.getBounds()).workArea, windowSize());
    roamPosition = next.position;
    velocity = next.velocity;
    setPosition(next.position, screen.getDisplayMatching(win.getBounds()).workArea);
    if (state.facing === 'auto' && Math.sign(velocity.x) !== previousDirection) broadcast();
  }
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) win.showInactive(); });
  app.whenReady().then(() => {
    settingsPath = path.join(app.getPath('userData'), 'preferences.json');
    try { state = normalize(JSON.parse(fs.readFileSync(settingsPath, 'utf8'))); }
    catch (error) { if (error.code !== 'ENOENT') console.warn('Using default preferences:', error.message); }
    const area = screen.getPrimaryDisplay().workArea;
    const size = windowSize();
    const position = state.position || { x: area.x + area.width - size.width - 40, y: area.y + 100 };
    const target = screen.getDisplayNearestPoint(position).workArea;
    state.position = clampPosition(position, target, size);
    win = new BrowserWindow({
      ...size, ...state.position, transparent: true, frame: false, thickFrame: false, resizable: false,
      maximizable: false, minimizable: false, fullscreenable: false, hasShadow: false,
      alwaysOnTop: true, skipTaskbar: true, show: false, backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, 'src', 'preload.js'),
        contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false,
      },
    });
    win.setAlwaysOnTop(true, 'floating');
    win.setIgnoreMouseEvents(true, { forward: true });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.once('ready-to-show', () => win.showInactive());
    win.on('close', event => { if (!shuttingDown) { event.preventDefault(); win.hide(); } });

    const trusted = event => event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame;
    ipcMain.handle('pet:get-state', event => trusted(event) ? publicState() : null);
    ipcMain.on('pet:interactive', (event, value) => {
      if (trusted(event) && typeof value === 'boolean') win.setIgnoreMouseEvents(!value, { forward: true });
    });
    ipcMain.on('pet:drag-start', event => {
      if (!trusted(event)) return;
      const cursor = screen.getCursorScreenPoint();
      drag = { x: cursor.x - state.position.x, y: cursor.y - state.position.y };
    });
    ipcMain.on('pet:drag-end', event => { if (trusted(event)) { drag = null; save(); } });
    ipcMain.on('pet:menu', event => { if (trusted(event)) Menu.buildFromTemplate(menuTemplate()).popup({ window: win }); });

    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray-icon.png')));
    tray.setToolTip('Desktop Nyan Catto');
    tray.on('double-click', () => win.showInactive());
    rebuildMenu();
    screen.on('display-removed', keepOnScreen);
    screen.on('display-metrics-changed', keepOnScreen);
    win.loadFile(path.join(__dirname, 'src', 'index.html'));
    lastTick = performance.now();
    timer = setInterval(tick, 16);
    // Periodically persist automatic movement without writing on every frame.
    const checkpoint = setInterval(save, 10000);
    checkpoint.unref();
  }).catch(error => { console.error(error); app.quit(); });
}
app.on('before-quit', () => {
  shuttingDown = true;
  clearInterval(timer);
  save();
  if (tray) tray.destroy();
});
