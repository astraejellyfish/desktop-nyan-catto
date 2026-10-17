# Desktop Nyan Catto

A lightweight Windows desktop pet built with Electron. This nyan catto floats with a separately recolored animated trail. No accounts or internet connection are needed to use it.

## Getting started

Install Node.js (LTS), open a terminal in this folder, then run:

```powershell
npm.cmd install
npm.cmd start
```

Using `npm.cmd` also works when PowerShell blocks the `npm.ps1` script. To stop the app completely, choose **Quit** in its system tray menu. Windows may put its icon under the tray's hidden-icons arrow.

## Controls

- **Movement → Free Roam:** moves and bounces inside the current monitor's usable desktop.
- **Movement → Stay (default):** stays where you place it; the animation continues.
- **Facing → Left / Right:** fixes the direction independently of movement. Right is the default.
- **Facing → Follow Movement:** faces its horizontal travel direction and flips on a bounce. In Stay mode it keeps the last travel direction.
- **Trail Color:** applies immediately to the trail only.
- **Size → 25% / 50% / 75% / 100%:** resizes the cat and trail together immediately. 100% is the original 288×96 artwork area; 25% is 72×24. Windows requires a little extra transparent space beneath the smallest size. The window stays inside the usable desktop area.
- **Pause / Resume:** freezes/resumes both movement and animation. You can still drag while paused.
- **Quit:** closes the window and background process.

Drag the visible pixels to move the pet. Movement stops during dragging and resumes on release in Free Roam. Drag onto another monitor to roam there. Right-click visible pixels for the same menu. Double-click the tray icon to show a hidden pet. Transparent pixels pass mouse interactions through where Windows supports forwarded mouse movement.

## Trail colors

The tray's **Trail Color** menu contains **Classic Colors** and **Pride Collection**. Choose any preset to apply it immediately; only that preset is checked across both categories. Existing classic selections still restore, and Neon Green remains the first-time default.

###Color 
- Neon Green (default) - Pink - Blue - Purple - Orange - Yellow - Rainbow

### Pride Collection

- Non-binary - Asexual - Transgender - Bisexul - Pansexual  - WLW - MLM - Genderfluid - Aromantic - Progress Pride are also available

All presets live in `src/lib/trails.json`, grouped by tray category. To add a flag, add an object with a unique, stable `id`, a `label`, and a `colors` array in top-to-bottom order to Pride Collection. The renderer handles the stripe count automatically. Leave `style` unset for Pride stripes; `style: "classic"` preserves the original six-path recoloring behavior. The selected ID is stored in the existing `color` preference, so older settings need no migration.

To test manually:

1. Run `npm.cmd start`, then open **Trail Color → Pride Collection** from the tray or the cat's right-click menu.
2. Select each flag and check its stripe order; switch back through **Classic Colors** to check the original trails.
3. Try Stay and Free Roam, drag the cat, switch Facing, and try all Size options. Animation should continue unless paused.
4. Select a Pride preset, choose Quit, then restart. The selected flag and other saved settings should restore.

`npm.cmd test` checks preset validation, preference round-trips, and variable stripe counts. `npm.cmd run test:smoke` checks actual Electron pixels for every Pride preset, unchanged cat pixels, exclusive tray checkmarks, animation in both modes, all sizes, and saved settings using an isolated test profile. After that, `npm.cmd run test:smoke -- --check-restored` verifies restoration in a fresh Electron process. Mouse dragging, native tray interaction, and multiple monitors still need manual desktop checks.

Facing, movement, size, color, pause state, and desktop position are saved in `preferences.json` under Electron's user-data directory (normally `%APPDATA%/desktop-nyan-catto`). New settings start in Stay mode at 100% size. An existing saved movement choice is restored; select Movement → Stay once if you previously saved Free Roam. Automatic movement checkpoints every ten seconds and position saves on drag release and normal exit. Invalid settings fall back to defaults; positions are clamped when displays change.

## Development and Windows builds

```powershell
npm.cmd test
npm.cmd run test:smoke
npm.cmd run build:dir
npm.cmd run build
```

The final command creates an NSIS installer and a portable `.exe` in `dist/`. Packaged builds run without VS Code or a separate Node installation. Builds are unsigned; Windows may show publisher/security prompts. Build downloads require internet access.

`main.js` owns the window, tray, storage and movement. The sandboxed renderer draws only the artwork; a narrow preload bridge exposes interaction commands. `src/lib/` contains settings validation and movement math.


To replace the animation, export `NYAN_FRAME_MS` and `NYAN_FRAMES` from that file. Each frame is an array of `{ fill, d }` SVG path records in a 96×32 coordinate area. The six trail paths must use `#04F601` with optional alpha suffixes, in top-to-bottom order; these are recolored independently. Other paths retain their original colors. A GIF with a baked-in trail needs its trail separated first. Update canvas/window dimensions if your new artwork uses different bounds. The tray icon is a rasterized frame in `assets/tray-icon.png`.

## License
No license is assigned to the new application code yet. Original Nyan Cat artwork is credited to Chris Torres (prguitarman). The imported frame data and upstream software notice are included in `third-party/nyancat-NOTICE.txt`; that notice does not assert a separate license to the artwork.


