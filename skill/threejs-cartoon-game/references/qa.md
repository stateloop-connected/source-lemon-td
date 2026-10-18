# QA reference

## Debug node (the single most useful hook)

Expose game state through the DOM. Browser automation may evaluate in an isolated world where `window.__game` is invisible, but the DOM is always shared.

```js
window.__errors = [];
addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason)));

const dbg = document.createElement('div');
dbg.id = 'debug';
dbg.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:9999;font:10px/1.5 Consolas;color:#eafff0;background:rgba(8,4,18,.72);padding:5px 8px;white-space:pre;display:none';
document.body.appendChild(dbg);

setInterval(() => {
  if (!location.search.includes('debug')) return;
  dbg.style.display = 'block';
  const c = engine.camera.position;
  dbg.textContent =
    `state=${game.state} wave=${game.wave} enemies=${game.enemies.length} towers=${game.towers.length} gold=${Math.floor(game.gold)} lives=${game.lives}\n` +
    `boss=${game.boss ? game.boss.progress.toFixed(2) + ' hp' + Math.round(game.boss.hp) : '-'} waveActive=${game.waveActive} cd=${game.waveCountdown.toFixed(1)}\n` +
    `cam=${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z.toFixed(1)} calls=${engine.renderer.info.render.calls} tris=${engine.renderer.info.render.triangles}\n` +
    `err=${window.__errors.slice(0, 2).join(' | ').slice(0, 300)}`;
}, 300);
```

Read it with `document.getElementById('debug').textContent`.

## URL switches

```js
const p = new URLSearchParams(location.search);
if (p.get('post') === '0') engine.usePost = false;
if (p.get('bloom') === '0') engine.bloom.strength = 0;
if (p.has('cam')) { /* x,y,z,tx,ty,tz */ }
if (p.has('auto')) setTimeout(() => {
  game.start();
  if (p.has('towers')) { game.gold = 99999; placeTestTowers(); }
  if (p.has('startwave')) { game.wave = Number(p.get('startwave')) - 1; game.beginWave(); }
  if (p.has('speed')) game.setSpeed(Number(p.get('speed')));
  if (p.has('lives')) game.lives = Number(p.get('lives'));
  if (p.has('win')) game.victory();
}, 350);
```

`?auto=1&towers=1&startwave=10&speed=3` is the main regression test: it builds, jumps to a boss wave, and runs at 3×.

## camofox recipe

1. `open` the URL. Keep the `tabId`.
2. `evaluate` `document.getElementById('debug').textContent` — confirms boot, state, errors, draw calls.
3. `screenshot` saves a PNG path; `read_image` it.
4. Click UI with CSS selectors: `#btn-start`, `.card[data-type="arrow"]`, `#towerpanel .upgrade`.
5. Click the 3D canvas with synthetic events (the tool has no coordinate click):

```js
const c = document.querySelector('canvas');
const ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, {
  clientX: x, clientY: y, button: 0, buttons: 1, bubbles: true, pointerId: 1, pointerType: 'mouse',
}));
ev('pointerdown', 700, 640);
ev('pointerup', 700, 640);
```

6. Hover for build previews with `pointermove`.
7. Scroll/rotate: dispatch `pointermove` between down and up, or use the page's own controls; do not expect `evaluate` to see `window.__game`.

## Pixel truth

A 1600×900 screenshot shown at 800 px looks washed out even when the pixels are saturated. Measure:

```powershell
python scripts/shot_stats.py shot.png
python scripts/shot_stats.py shot.png --points 500,550 800,100 400,450
python scripts/shot_stats.py shot.png --crop 720,520,1140,780 --zoom 2 --out crop.png
```

Interpretation:

- mean saturation 0.45–0.60 = vivid cartoon; below 0.35 = washed or over-lit.
- grass around `(88, 150, 30)`, road around `(130, 70, 10)` at 1600×900.
- a 2–4× crop is the only reliable way to judge outline thickness, model detail, and shadow contact.

## Production check

```powershell
npm run build
npm run preview   # different port, e.g. 5189
```

Open the preview with `?debug=1` and confirm `err=` is empty. Dev-only module resolution can hide failures.

## Regression checklist

- Start screen → click start → HUD appears, camera fly completes.
- Pick a tower card → ghost, range ring, valid-cell dots. Click a valid cell → gold drops, tower appears.
- Click the tower → panel; upgrade twice; sell; gold and grid update.
- Pause → overlay; resume. Help from pause → close → back to pause. Help from victory → close → victory.
- Wave 1 clears → countdown appears → next wave starts.
- Force `?lives=1` and let one enemy leak → defeat overlay.
- Force `?win=1` → victory overlay, endless button.
- Resize to 900×600 → HUD does not overlap the dock or the result card.
- `renderer.info.render.calls` < 2000; no console errors after 60 s at 3×.
