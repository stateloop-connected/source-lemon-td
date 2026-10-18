import * as THREE from 'three';
import { PathSystem, PlacementGrid } from './path.js';
import { buildWorld } from '../art/environment.js';
import { buildTower } from '../art/towers.js';
import {
  TOWERS, TOWER_ORDER, START_GOLD, START_LIVES, MAX_WAVES, PREP_TIME,
  TARGET_MODES, MAX_LEVEL,
} from './config.js';
import { buildWave, WAVE_COUNT } from './waves.js';
import { Enemy, Tower } from './entities.js';
import { Projectile } from './projectiles.js';
import { Effects } from './effects.js';

const DEFAULT_CAM = new THREE.Vector3(0, 62, 104);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, -2);

export class Game {
  constructor(engine, audio, hud) {
    this.engine = engine;
    this.audio = audio;
    this.hud = hud;
    this.scene = engine.scene;
    this.camera = engine.camera;
    this.path = new PathSystem();
    this.world = buildWorld(this.scene, this.path);
    this.grid = new PlacementGrid(this.path, this.world.blockers);
    this.effects = new Effects(this.scene, this.camera);

    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.selected = null;
    this.buildType = null;
    this.boss = null;

    this.gold = START_GOLD;
    this.lives = START_LIVES;
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.state = 'menu';
    this.speed = 1;
    this.endless = false;
    this.waveActive = false;
    this.waveCountdown = PREP_TIME;
    this.waveTime = 0;
    this.spawns = [];
    this.spawnIndex = 0;
    this.time = 0;
    this.refreshTimer = 0;
    this.auraTimer = 0;
    this.won = false;

    this.ghosts = {};
    this.down = null;
    this.hoverCell = null;

    this.buildHelpers();
    this.bindInput();
  }

  /* ------------------------------------------------------------------ */
  buildHelpers() {
    const gridDotGeo = new THREE.PlaneGeometry(5.2, 5.2);
    const gridDotMat = new THREE.MeshBasicMaterial({
      color: 0x9dffb4, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide,
    });
    const cells = this.grid.cellList();
    this.gridDots = new THREE.InstancedMesh(gridDotGeo, gridDotMat, cells.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const s = new THREE.Vector3(1, 1, 1);
    cells.forEach((c, i) => {
      m.compose(new THREE.Vector3(c.x, 0.1, c.z), q, s);
      this.gridDots.setMatrixAt(i, m);
    });
    this.gridDots.instanceMatrix.needsUpdate = true;
    this.gridDots.frustumCulled = false;
    this.gridDots.visible = false;
    this.scene.add(this.gridDots);

    this.cellMarker = new THREE.Mesh(
      new THREE.PlaneGeometry(5.7, 5.7),
      new THREE.MeshBasicMaterial({ color: 0x7dff9a, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide })
    );
    this.cellMarker.rotation.x = -Math.PI / 2;
    this.cellMarker.position.y = 0.14;
    this.cellMarker.visible = false;
    this.scene.add(this.cellMarker);

    this.rangeGroup = new THREE.Group();
    this.rangeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.985, 1, 80),
      new THREE.MeshBasicMaterial({
        color: 0x9df3ff, transparent: true, opacity: 0.75, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      })
    );
    this.rangeRing.rotation.x = -Math.PI / 2;
    this.rangeDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 64),
      new THREE.MeshBasicMaterial({ color: 0x6fe8ff, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide })
    );
    this.rangeDisc.rotation.x = -Math.PI / 2;
    this.rangeGroup.add(this.rangeRing, this.rangeDisc);
    this.rangeGroup.position.y = 0.16;
    this.rangeGroup.visible = false;
    this.rangeGroup.renderOrder = 2;
    this.scene.add(this.rangeGroup);

    this.selRing = new THREE.Mesh(
      new THREE.RingGeometry(2.5, 2.68, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffd257, transparent: true, opacity: 0.85, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      })
    );
    this.selRing.rotation.x = -Math.PI / 2;
    this.selRing.position.y = 0.17;
    this.selRing.visible = false;
    this.scene.add(this.selRing);
  }

  bindInput() {
    const canvas = this.engine.canvas;
    canvas.addEventListener('pointerdown', (e) => {
      this.down = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button };
      if (e.button === 2) {
        this.cancelBuild();
        this.deselect();
      }
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!this.down) return;
      const dx = e.clientX - this.down.x;
      const dy = e.clientY - this.down.y;
      const quick = performance.now() - this.down.t < 750;
      const isClick = Math.hypot(dx, dy) < 7 && quick && this.down.button === 0 && e.button === 0;
      this.down = null;
      if (isClick) this.onClick(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e.clientX, e.clientY));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerleave', () => {
      this.cellMarker.visible = false;
      for (const k in this.ghosts) this.ghosts[k].visible = false;
    });

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k >= '1' && k <= '5') {
        const type = TOWER_ORDER[Number(k) - 1];
        if (type) this.chooseBuild(type);
      } else if (k === 'escape') {
        if (this.buildType) this.cancelBuild();
        else this.deselect();
      } else if (k === ' ') {
        e.preventDefault();
        this.togglePause();
      } else if (k === 'f') {
        this.cycleSpeed();
      } else if (k === 'm') {
        this.toggleSound();
      } else if (k === 'h') {
        this.hud.showHelp();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  start() {
    this.reset();
    this.state = 'playing';
    this.hud.hideOverlay();
    this.hud.show();
    this.hud.setBoss(null);
    this.engine.controls.autoRotate = false;
    this.engine.camera.position.set(14, 30, 44);
    this.engine.controls.target.set(0, 2, 2);
    this.engine.controls.update();
    this.engine.flyTo(DEFAULT_CAM.clone(), DEFAULT_TARGET.clone(), 2.4);
    this.waveCountdown = PREP_TIME;
    this.hud.banner('准备守卫', '第一波敌人即将到来');
    this.hud.refresh();
    this.audio.setMuted(this.audio.muted);
    this.audio.startMusic();
    this.audio.play('click');
  }

  restart() {
    this.reset();
    this.state = 'playing';
    this.hud.hideOverlay();
    this.hud.show();
    this.hud.setBoss(null);
    this.engine.controls.autoRotate = false;
    this.engine.flyTo(DEFAULT_CAM.clone(), DEFAULT_TARGET.clone(), 1.2);
    this.waveCountdown = PREP_TIME;
    this.hud.banner('再来一局', '这次别让它们过去');
    this.hud.refresh();
    this.audio.startMusic();
  }

  reset() {
    for (const e of this.enemies) this.scene.remove(e.group);
    for (const t of this.towers) this.scene.remove(t.group);
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.grid.occupied.clear();
    this.selected = null;
    this.buildType = null;
    this.boss = null;
    this.gold = START_GOLD;
    this.lives = START_LIVES;
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.speed = 1;
    this.endless = false;
    this.waveActive = false;
    this.waveCountdown = PREP_TIME;
    this.waveTime = 0;
    this.spawns = [];
    this.spawnIndex = 0;
    this.won = false;
    this.hud.setSpeed(1);
    this.cancelBuild();
    this.deselect();
    this.hideGrid();
    this.hud.setBoss(null);
  }

  /* ------------------------------------------------------------------ */
  chooseBuild(type) {
    if (this.state !== 'playing') return;
    if (this.buildType === type) return this.cancelBuild();
    this.buildType = type;
    this.deselect();
    this.showGrid();
    this.hud.refresh();
    this.audio.play('click');
    this.ensureGhost(type);
  }

  cancelBuild() {
    this.buildType = null;
    this.gridDots.visible = false;
    this.cellMarker.visible = false;
    this.rangeGroup.visible = false;
    for (const k in this.ghosts) this.ghosts[k].visible = false;
    this.hud.refresh();
  }

  showGrid() {
    this.gridDots.visible = true;
    this.gridDots.material.opacity = 0.1;
  }

  hideGrid() {
    this.gridDots.visible = false;
  }

  ensureGhost(type) {
    if (this.ghosts[type]) {
      this.ghosts[type].visible = true;
      return this.ghosts[type];
    }
    const g = buildTower(type);
    g.traverse((o) => {
      if (o.isSprite) {
        o.material = o.material.clone();
        o.material.opacity = 0.45;
      } else if (o.isMesh) {
        if (o.userData.isOutline) {
          o.visible = false;
          return;
        }
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mat of mats) {
          mat.transparent = true;
          mat.opacity = 0.48;
          mat.depthWrite = false;
        }
      }
    });
    g.visible = false;
    this.scene.add(g);
    this.ghosts[type] = g;
    return g;
  }

  onPointerMove(x, y) {
    if (this.state !== 'playing' || !this.buildType) return;
    const p = this.engine.pointerToGround(x, y);
    if (!p) return;
    const cell = this.grid.cellFromWorld(p.x, p.z);
    if (!cell) {
      this.cellMarker.visible = false;
      this.ghostHideAll();
      return;
    }
    const valid = this.grid.isBuildable(cell.i, cell.j);
    this.hoverCell = cell;
    this.cellMarker.visible = true;
    this.cellMarker.position.set(cell.x, 0.14, cell.z);
    this.cellMarker.material.color.set(valid ? 0x7dff9a : 0xff6072);
    const ghost = this.ensureGhost(this.buildType);
    ghost.visible = true;
    ghost.position.set(cell.x, 0, cell.z);
    for (const k in this.ghosts) if (k !== this.buildType) this.ghosts[k].visible = false;

    const def = TOWERS[this.buildType];
    this.rangeGroup.visible = true;
    this.rangeGroup.position.set(cell.x, 0.16, cell.z);
    this.rangeGroup.scale.setScalar(def.range);
    this.rangeRing.material.color.set(valid ? 0x9df3ff : 0xff8090);
  }

  ghostHideAll() {
    for (const k in this.ghosts) this.ghosts[k].visible = false;
  }

  onClick(x, y) {
    if (this.state !== 'playing') return;
    const p = this.engine.pointerToGround(x, y);
    if (!p) return;
    const cell = this.grid.cellFromWorld(p.x, p.z);
    if (!cell) return;

    if (this.buildType) {
      if (this.grid.isBuildable(cell.i, cell.j)) {
        this.placeTower(this.buildType, cell);
      } else {
        this.hud.toast('这里不能建造', 'bad');
        this.audio.play('error');
      }
      return;
    }

    const t = this.grid.towerAt(cell.i, cell.j);
    if (t) this.selectTower(t);
    else this.deselect();
  }

  placeTower(type, cell) {
    const def = TOWERS[type];
    if (this.gold < def.cost) {
      this.hud.toast('金币不够', 'bad');
      this.audio.play('error');
      return;
    }
    this.gold -= def.cost;
    const tower = new Tower(this, type, cell);
    this.towers.push(tower);
    this.grid.occupy(cell.i, cell.j, tower);
    this.effects.buildPuff(new THREE.Vector3(cell.x, 0.4, cell.z));
    this.effects.sparkBurst(new THREE.Vector3(cell.x, 1.0, cell.z), 0xffe0a0, 12, { speed: 6, size: 0.2 });
    this.audio.play('build');
    this.cancelBuild();
    this.selectTower(tower);
    this.hud.refresh();
  }

  selectTower(t) {
    this.selected = t;
    this.selRing.visible = true;
    this.selRing.position.set(t.cell.x, 0.17, t.cell.z);
    this.rangeGroup.visible = true;
    this.rangeGroup.position.set(t.cell.x, 0.16, t.cell.z);
    this.rangeGroup.scale.setScalar(t.range);
    this.rangeRing.material.color.set(0x9df3ff);
    this.hud.refresh();
    this.audio.play('click');
  }

  deselect() {
    this.selected = null;
    this.selRing.visible = false;
    if (!this.buildType) this.rangeGroup.visible = false;
    this.hud.refresh();
  }

  upgradeSelected() {
    if (!this.selected) return;
    if (!this.selected.canUpgrade()) return;
    if (this.gold < this.selected.upgradePrice) {
      this.hud.toast('金币不够', 'bad');
      this.audio.play('error');
      return;
    }
    if (this.selected.upgrade()) {
      this.hud.toast(`${this.selected.def.name} 升到 Lv.${this.selected.level}`, 'good');
      this.hud.refresh();
      if (this.selected) this.rangeGroup.scale.setScalar(this.selected.range);
    }
  }

  sellSelected() {
    if (!this.selected) return;
    const t = this.selected;
    const refund = t.sellPrice;
    t.sell();
    this.towers = this.towers.filter((x) => x !== t);
    this.deselect();
    this.hud.toast(`出售 +${refund} 金币`, 'good');
    this.hud.refresh();
  }

  cycleTarget() {
    if (!this.selected) return;
    const i = TARGET_MODES.indexOf(this.selected.mode);
    this.selected.mode = TARGET_MODES[(i + 1) % TARGET_MODES.length];
    this.hud.refresh();
    this.audio.play('click');
  }

  /* ------------------------------------------------------------------ */
  callWave() {
    if (this.state !== 'playing' || this.waveActive) {
      if (this.waveActive) this.hud.toast('这一波还没结束', 'bad');
      return;
    }
    if (this.waveCountdown > 1) {
      const bonus = Math.floor(this.waveCountdown * 2);
      this.gold += bonus;
      this.score += bonus;
      this.effects.text(new THREE.Vector3(this.path.start.x, 3, this.path.start.z), `+${bonus} 提前奖励`, 'gold');
    }
    this.beginWave();
  }

  beginWave() {
    this.wave++;
    const data = buildWave(this.wave);
    this.currentWave = data;
    this.spawns = data.spawns;
    this.spawnIndex = 0;
    this.waveTime = 0;
    this.waveActive = true;
    this.waveCountdown = 0;
    if (data.boss) {
      this.hud.banner('BOSS 来袭', data.name);
      this.audio.play('boss');
    } else {
      this.hud.banner(`第 ${this.wave} 波`, data.name);
      this.audio.play('wave');
    }
    this.hud.refresh();
  }

  completeWave() {
    this.waveActive = false;
    this.waveCountdown = PREP_TIME + 3;
    const bonus = 34 + this.wave * 6;
    this.gold += bonus;
    this.score += 60 + this.wave * 12;
    this.hud.toast(`第 ${this.wave} 波清除  +${bonus} ◈`, 'good');
    this.audio.play('coin');
    if (this.wave >= MAX_WAVES && !this.endless) this.victory();
    this.hud.refresh();
  }

  /* ------------------------------------------------------------------ */
  spawnEnemy(spawn) {
    const e = new Enemy(this, spawn.type, this.wave, {
      elite: spawn.elite,
      hpMul: this.currentWave?.hpMul ?? 1,
    });
    this.enemies.push(e);
    if (e.def.boss) {
      this.boss = e;
      this.hud.setBoss(e);
      this.engine.shake(0.5);
      this.effects.ring(new THREE.Vector3(this.path.start.x, 0.3, this.path.start.z), 0xff6072, 7, 0.8);
    }
    this.effects.puff(e.center.clone(), 0xc9b6ff, 3, { size: 0.7, life: 0.6 });
  }

  onKill(enemy) {
    this.scene.remove(enemy.group);
    enemy.removed = true;
    const elite = enemy.elite ? 2 : 1;
    const gold = Math.round(enemy.def.gold * elite);
    this.gold += gold;
    this.score += enemy.def.boss ? 500 : 20 * elite;
    this.kills++;
    this.effects.sparkBurst(enemy.center, enemy.def.boss ? 0xffb35c : 0x8fe36b, enemy.def.boss ? 50 : 14, {
      speed: enemy.def.boss ? 16 : 8, size: enemy.def.boss ? 0.4 : 0.22,
    });
    this.effects.text(enemy.center.clone().add(new THREE.Vector3(0, 0.6, 0)), `+${gold}`, 'gold');
    if (enemy.def.boss) {
      this.effects.explosion(enemy.center);
      this.engine.shake(1.0);
      this.boss = null;
      this.hud.setBoss(null);
      this.hud.banner('BOSS 倒下', `+${gold} 金币`);
    } else {
      this.effects.puff(enemy.center, 0xbfb0d8, 3, { size: 0.5, life: 0.5 });
    }
    this.audio.play('coin');
    this.hud.refresh();
  }

  onLeak(enemy) {
    this.scene.remove(enemy.group);
    enemy.removed = true;
    const loss = enemy.def.boss ? 5 : 1;
    this.lives = Math.max(0, this.lives - loss);
    this.effects.ring(new THREE.Vector3(this.path.end.x, 0.3, this.path.end.z), 0xff5068, 7, 0.7);
    this.effects.puff(new THREE.Vector3(this.path.end.x, 2, this.path.end.z), 0xff8090, 6, { size: 0.8 });
    this.audio.play('leak');
    this.engine.shake(0.6);
    this.hud.toast(`漏怪了！-${loss} 生命`, 'bad');
    if (enemy.def.boss) {
      this.boss = null;
      this.hud.setBoss(null);
    }
    this.hud.refresh();
    if (this.lives <= 0) this.gameOver();
  }

  /* ------------------------------------------------------------------ */
  update(dtRaw, tRaw) {
    const dt = Math.min(dtRaw, 0.06);
    this.world.update(dt, tRaw);
    this.effects.update(dt, this.camera);

    if (this.state === 'menu') {
      this.effects.setViewport(window.innerHeight, this.camera.fov);
      return;
    }

    if (this.state !== 'playing') {
      this.effects.setViewport(window.innerHeight, this.camera.fov);
      this.animateTowers(dt, this.time);
      return;
    }

    const step = dt * this.speed;
    this.time += step;

    // waves
    if (!this.waveActive) {
      if (this.waveCountdown > 0) {
        this.waveCountdown -= step;
        if (this.waveCountdown <= 0) this.beginWave();
      }
    } else {
      this.waveTime += step;
      while (this.spawnIndex < this.spawns.length && this.spawns[this.spawnIndex].t <= this.waveTime) {
        this.spawnEnemy(this.spawns[this.spawnIndex]);
        this.spawnIndex++;
      }
      if (this.spawnIndex >= this.spawns.length && this.enemies.length === 0) this.completeWave();
    }

    // enemies
    for (const e of this.enemies) e.update(step, this.time);

    // shaman aura
    this.auraTimer -= step;
    if (this.auraTimer <= 0) {
      this.auraTimer = 0.5;
      for (const shaman of this.enemies) {
        if (!shaman.alive || !shaman.def.heal) continue;
        for (const other of this.enemies) {
          if (!other.alive || other === shaman) continue;
          if (other.center.distanceTo(shaman.center) < shaman.def.healRadius) {
            other.heal(shaman.def.heal * 0.5);
          }
        }
      }
    }

    // towers
    this.animateTowers(step, this.time);

    // projectiles
    for (const p of this.projectiles) p.update(step);

    // cleanup
    this.enemies = this.enemies.filter((e) => {
      if (!e.alive) {
        if (!e.removed) this.scene.remove(e.group);
        return false;
      }
      return true;
    });
    this.projectiles = this.projectiles.filter((p) => p.alive);

    if (this.boss && this.boss.alive) this.hud.setBoss(this.boss);

    this.refreshTimer -= dt;
    if (this.refreshTimer <= 0) {
      this.refreshTimer = 0.12;
      this.hud.refresh();
    }

    this.effects.setViewport(window.innerHeight, this.camera.fov);
  }

  animateTowers(dt, t) {
    for (const tower of this.towers) tower.update(dt, t);
  }

  addProjectile(opts) {
    this.projectiles.push(new Projectile(this, opts));
  }

  /* ------------------------------------------------------------------ */
  setSpeed(n) {
    this.speed = n;
    this.hud.setSpeed(n);
  }

  cycleSpeed() {
    const arr = [1, 2, 3];
    const i = arr.indexOf(this.speed);
    this.setSpeed(arr[(i + 1) % arr.length]);
    this.audio.play('click');
  }

  toggleSound() {
    this.audio.toggle();
    this.hud.setMuted(this.audio.muted);
    this.audio.play('click');
  }

  setPaused(paused) {
    if (paused && this.state === 'playing') {
      this.state = 'paused';
      this.hud.el.pause.textContent = '▶';
      this.hud.showPause();
    } else if (!paused && this.state === 'paused') {
      this.state = 'playing';
      this.hud.el.pause.textContent = '❚❚';
      this.hud.hideOverlay();
    }
  }

  togglePause() {
    if (this.state === 'playing') this.setPaused(true);
    else if (this.state === 'paused') this.setPaused(false);
  }

  gameOver() {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.hud.saveBest(this.score, this.wave);
    this.audio.play('defeat');
    this.hud.showResult(false, this.stats());
    this.saveBest();
  }

  victory() {
    if (this.state !== 'playing') return;
    this.state = 'won';
    this.won = true;
    this.hud.saveBest(this.score, this.wave);
    this.audio.play('victory');
    this.hud.showResult(true, this.stats());
    this.saveBest();
  }

  stats() {
    return { score: this.score, wave: this.wave, kills: this.kills };
  }

  saveBest() {
    this.hud.saveBest(this.score, this.wave);
  }

  continueEndless() {
    this.endless = true;
    this.state = 'playing';
    this.hud.hideOverlay();
    this.waveCountdown = PREP_TIME;
    this.hud.banner('无尽模式', '敌潮不会停止');
    this.hud.refresh();
  }

  showResult(win) {
    this.hud.showResult(win, this.stats());
  }
}
