import { Engine } from './core/engine.js';
import { GameAudio } from './core/audio.js';
import { Game } from './game/game.js';
import { HUD } from './ui/hud.js';
import { renderTowerIcons } from './art/icons.js';
import { TOWER_ORDER } from './game/config.js';

window.__errors = [];
window.addEventListener('error', (e) => {
  window.__errors.push(String(e.message || e.error));
  console.error(e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  window.__errors.push(String(e.reason));
  console.error(e.reason);
});

function boot() {
  const canvas = document.getElementById('scene');
  const engine = new Engine(canvas);
  const audio = new GameAudio();
  const game = new Game(engine, audio, null);
  const hud = new HUD(game);
  game.hud = hud;

  hud.setMuted(audio.muted);
  hud.setSpeed(1);

  try {
    const icons = renderTowerIcons(TOWER_ORDER);
    hud.setIcons(icons);
  } catch (e) {
    console.error('icon render failed', e);
  }

  window.addEventListener('resize', () => engine.resize());

  /* ---------- dev/QA hooks (hidden unless ?debug) ---------- */
  const params = new URLSearchParams(location.search);
  const dbg = document.createElement('div');
  dbg.id = 'debug';
  dbg.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:9999;font:10px/1.5 Consolas,monospace;color:#eafff0;background:rgba(8,4,18,.72);padding:5px 8px;border-radius:6px;white-space:pre;display:none;pointer-events:none';
  document.body.appendChild(dbg);

  if (params.has('cam')) {
    const v = params.get('cam').split(',').map(Number);
    engine.camera.position.set(v[0], v[1], v[2]);
    engine.controls.target.set(v[3], v[4], v[5]);
    engine.controls.update();
    engine.controls.autoRotate = false;
    game.state = 'menu';
  }

  if (params.get('post') === '0') engine.usePost = false;
  if (params.get('bloom') === '0') engine.bloom.strength = 0;
  if (params.get('fog') === '0') engine.scene.fog = null;
  if (params.get('out') === '0') engine.composer.passes[engine.composer.passes.length - 1].enabled = false;
  if (params.get('grade') === '0') engine.grade.enabled = false;
  if (params.get('tone') === '0') engine.renderer.toneMapping = 0;
  if (params.has('exp')) engine.renderer.toneMappingExposure = Number(params.get('exp'));

  setInterval(() => {
    if (!params.has('debug')) return;
    dbg.style.display = 'block';
    const c = engine.camera.position;
    const tg = engine.controls.target;
    dbg.textContent =
      `state=${game.state} wave=${game.wave} enemies=${game.enemies.length} towers=${game.towers.length} gold=${Math.floor(game.gold)} lives=${game.lives}\n` +
      `boss=${game.boss ? game.boss.progress.toFixed(2) + ' hp' + Math.round(game.boss.hp) : '-'} waveActive=${game.waveActive} cd=${game.waveCountdown.toFixed(1)}\n` +
      `cam=${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z.toFixed(1)} tgt=${tg.x.toFixed(1)},${tg.y.toFixed(1)},${tg.z.toFixed(1)}\n` +
      `calls=${engine.renderer.info.render.calls} tris=${engine.renderer.info.render.triangles} proj=${game.projectiles.length}\n` +
      `err=${window.__errors.slice(0, 2).join(' | ').slice(0, 300)}`;
  }, 300);

  if (params.has('auto')) {
    setTimeout(() => {
      game.start();
      if (params.has('cam')) {
        const v = params.get('cam').split(',').map(Number);
        engine.fly = null;
        engine.camera.position.set(v[0], v[1], v[2]);
        engine.controls.target.set(v[3], v[4], v[5]);
        engine.controls.update();
      }
      if (params.has('towers')) {
        game.gold = 99999;
        const spots = [
          [-41, -8, 'arrow'], [-24, 5, 'cannon'], [-3, 5, 'frost'],
          [9, -9, 'arcane'], [25, 3, 'tesla'], [46, 5, 'arrow'],
          [-30, 27, 'cannon'], [3, 27, 'arrow'], [33, -24, 'frost'],
        ];
        const placeNear = (x, z, type) => {
          const base = game.grid.cellFromWorld(x, z);
          if (!base) return;
          for (let r = 0; r < 4; r++) {
            for (let di = -r; di <= r; di++) {
              for (let dj = -r; dj <= r; dj++) {
                const i = base.i + di;
                const j = base.j + dj;
                if (game.grid.isBuildable(i, j)) {
                  game.placeTower(type, { i, j, ...game.grid.center(i, j) });
                  return;
                }
              }
            }
          }
        };
        for (const [x, z, type] of spots) placeNear(x, z, type);
        game.towers.slice(0, 3).forEach((t) => { t.level = 2; t.stats = { ...t.stats, damage: t.stats.damage * 1.65, range: t.stats.range * 1.075 }; t.group.userData.setLevel(2); });
        game.hud.refresh();
      }
      if (params.has('wave')) game.beginWave();
      if (params.has('startwave')) {
        game.wave = Math.max(0, Number(params.get('startwave')) - 1);
        game.gold = 99999;
        game.beginWave();
      }
      if (params.has('speed')) game.setSpeed(Number(params.get('speed')));
      if (params.has('lives')) game.lives = Number(params.get('lives'));
      if (params.has('win')) game.victory();
    }, 350);
  }

  window.addEventListener('pointerdown', () => audio.ensure(), { once: true });
  window.addEventListener('keydown', () => audio.ensure(), { once: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') game.setPaused(true);
  });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.06, Math.max(0.0001, (now - last) / 1000));
    last = now;
    try {
      game.update(dt, engine.elapsed);
      engine.update(dt);
      engine.render();
    } catch (e) {
      window.__errors.push(String(e && e.stack ? e.stack : e));
      console.error(e);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // let the first frames settle, then reveal the title screen
  setTimeout(() => {
    hud.hideLoading();
    hud.showStart();
    game.state = 'menu';
  }, 260);

  window.__game = game;
  window.__engine = engine;
}

try {
  boot();
} catch (e) {
  console.error(e);
  const loading = document.getElementById('loading');
  if (loading) {
    loading.innerHTML = `<div style="max-width:80vw;text-align:center;font-size:13px;line-height:1.7;color:#6a4310">
      <b style="font-size:18px">启动失败</b><br/>${String(e && e.message ? e.message : e)}</div>`;
  }
  window.__errors.push(String(e && e.stack ? e.stack : e));
}
