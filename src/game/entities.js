import * as THREE from 'three';
import { ENEMIES, TOWERS, towerStats, upgradeCost, sellValue } from './config.js';
import { buildEnemyModel } from '../art/enemies.js';
import { buildTower } from '../art/towers.js';
import { clamp, dampAngle } from '../core/utils.js';
import { toon, addOutline } from '../art/materials.js';
import { blobShadowTexture } from '../art/geometry.js';

const BAR_W = 1.16;
const barGeo = new THREE.PlaneGeometry(BAR_W, 0.15);
const barBgGeo = new THREE.PlaneGeometry(BAR_W + 0.08, 0.22);
const barBgMat = new THREE.MeshBasicMaterial({ color: 0x1b1630, transparent: true, opacity: 0.78, depthWrite: false });
const markerGeo = new THREE.PlaneGeometry(0.1, 0.1);

const blobGeo = new THREE.PlaneGeometry(1, 1);
const blobMat = new THREE.MeshBasicMaterial({
  map: blobShadowTexture(), transparent: true, opacity: 0.42, depthWrite: false,
});

function angleDiff(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

/* ------------------------------------------------------------------ *
 *  ENEMY
 * ------------------------------------------------------------------ */
export class Enemy {
  constructor(game, type, wave, opts = {}) {
    this.game = game;
    this.type = type;
    this.def = ENEMIES[type];
    this.wave = wave;
    this.elite = !!opts.elite;
    const hpMul = (opts.hpMul ?? 1) * (this.elite ? 1.9 : 1);
    this.maxHp = this.def.hp * (1 + (wave - 1) * 0.135) * hpMul;
    this.hp = this.maxHp;
    this.baseSpeed = this.def.speed * (this.elite ? 1.04 : 1);
    this.currentSpeed = this.baseSpeed;
    this.armor = this.def.armor;
    this.slowFactor = 1;
    this.slowTimer = 0;
    this.progress = opts.progress ?? 0;
    this.offset = (Math.random() - 0.5) * (this.def.boss ? 0.6 : 1.5);
    this.seed = Math.random() * 10;
    this.alive = true;
    this.removed = false;
    this.deathT = 0;
    this.punch = 0;

    this.model = buildEnemyModel(type);
    this.visualScale = 1.9 * (this.elite ? 1.12 : 1) * (type === 'ogre' ? 1.32 : 1);
    this.model.scale.setScalar(this.visualScale);
    if (this.elite) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.72, 20),
        new THREE.MeshBasicMaterial({ color: 0xffd257, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      this.model.add(ring);
    }

    this.group = new THREE.Group();
    this.group.add(this.model);
    if (!this.def.flying) {
      const sh = new THREE.Mesh(blobGeo, blobMat);
      sh.rotation.x = -Math.PI / 2;
      sh.position.y = 0.13;
      sh.scale.set(2.9, 2.3, 1);
      sh.renderOrder = 1;
      this.group.add(sh);
    }
    game.scene.add(this.group);

    if (this.def.boss) {
      this.aura = new THREE.Mesh(
        new THREE.RingGeometry(2.7, 3.35, 36),
        new THREE.MeshBasicMaterial({
          color: 0xff4d68, transparent: true, opacity: 0.45, side: THREE.DoubleSide,
          depthWrite: false, blending: THREE.AdditiveBlending,
        })
      );
      this.aura.rotation.x = -Math.PI / 2;
      this.aura.position.y = 0.17;
      this.group.add(this.aura);
    }

    this.center = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, 1);
    this._p = new THREE.Vector3();
    this._t = new THREE.Vector3();

    const h = this.def.height * this.visualScale;
    this.barY = h + 0.6;

    this.bar = new THREE.Group();
    const bg = new THREE.Mesh(barBgGeo, barBgMat);
    this.fillMat = new THREE.MeshBasicMaterial({ color: 0x7ee06a, depthWrite: false });
    this.fill = new THREE.Mesh(barGeo, this.fillMat);
    this.fill.position.z = 0.001;
    this.bar.add(bg, this.fill);
    this.bar.visible = false;
    this.bar.position.y = this.barY;
    this.bar.scale.setScalar(1.25);
    this.group.add(this.bar);

    this._q = new THREE.Quaternion();
    this.updateTransform(0);
  }

  updateTransform(t) {
    const p = this.game.path.pointAt(this.progress, this._p);
    const tan = this.game.path.tangentAt(this.progress, this._t);
    const sideX = tan.z;
    const sideZ = -tan.x;
    const fly = this.def.flying;
    const y = fly ? (this.def.flyY ?? 4.5) + Math.sin(t * 3 + this.seed) * 0.35 : 0;
    this.group.position.set(p.x + sideX * this.offset, y, p.z + sideZ * this.offset);
    this.group.rotation.y = Math.atan2(tan.x, tan.z);
    this.forward.set(tan.x, 0, tan.z).normalize();
    const h = this.def.height * this.visualScale;
    this.center.set(this.group.position.x, y + h * 0.45, this.group.position.z);
  }

  update(dt, t) {
    if (!this.alive) return;

    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowFactor = 1;
    } else if (this.slowFactor < 1) {
      this.slowFactor = Math.min(1, this.slowFactor + dt * 1.2);
    }

    this.currentSpeed = this.baseSpeed * this.slowFactor;
    this.progress += (this.currentSpeed * dt) / this.game.path.length;
    if (this.progress >= 1) {
      this.progress = 1;
      this.reachEnd();
      return;
    }

    this.updateTransform(t);

    const animSpeed = clamp(this.baseSpeed / 7, 0.65, 1.45) * (this.slowFactor < 1 ? 0.55 : 1);
    this.model.userData.animate(t, dt, animSpeed);

    this.punch = Math.max(0, this.punch - dt * 6);
    this.model.scale.setScalar(this.visualScale * (1 + this.punch * 0.05));

    if (this.aura) {
      const s = 1 + Math.sin(t * 2.6) * 0.07;
      this.aura.scale.setScalar(s);
      this.aura.material.opacity = 0.3 + Math.sin(t * 3.4) * 0.12;
    }

    const ratio = clamp(this.hp / this.maxHp, 0, 1);
    this.bar.visible = ratio < 0.999;
    this.fill.scale.x = Math.max(0.001, ratio);
    this.fill.position.x = -(1 - ratio) * (BAR_W / 2);
    this.fillMat.color.setHSL(0.33 * ratio, 0.75, 0.55);

    this.bar.quaternion.copy(this.game.camera.quaternion);
    this.bar.quaternion.premultiply(this._q.copy(this.group.quaternion).invert());
    this.bar.visible = this.bar.visible && !this.def.boss;
  }

  hurt(amount, kind = 'physical', meta = {}) {
    if (!this.alive) return;
    const armor = kind === 'magic' ? 0 : this.armor;
    const real = Math.max(1, amount * (1 - armor));
    this.hp -= real;
    this.punch = 1;
    const cls = kind === 'frost' ? 'frost' : kind === 'magic' ? 'magic' : meta.crit ? 'crit' : '';
    this.game.effects.text(this.center.clone().add(new THREE.Vector3(0, 0.35, 0)), String(Math.round(real)), cls);

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  applySlow(factor, time) {
    this.slowFactor = Math.min(this.slowFactor, 1 - factor);
    this.slowTimer = Math.max(this.slowTimer, time);
  }

  heal(amount) {
    if (!this.alive || this.hp >= this.maxHp) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.game.effects.heal(this.center);
  }

  die() {
    this.alive = false;
    this.game.onKill(this);
  }

  reachEnd() {
    this.alive = false;
    this.game.onLeak(this);
  }
}

/* ------------------------------------------------------------------ *
 *  TOWER
 * ------------------------------------------------------------------ */
export class Tower {
  constructor(game, type, cell, level = 1) {
    this.game = game;
    this.type = type;
    this.def = TOWERS[type];
    this.cell = cell;
    this.level = level;
    this.stats = towerStats(type, level);
    this.mode = 'first';
    this.invested = this.def.cost;
    this.cooldown = 0.35;
    this.target = null;
    this.kills = 0;

    this.group = buildTower(type);
    this.group.position.set(cell.x, 0, cell.z);
    game.scene.add(this.group);

    const shadow = new THREE.Mesh(blobGeo, blobMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.13;
    shadow.scale.set(6, 6, 1);
    shadow.renderOrder = 1;
    this.group.add(shadow);

    this.aim = this.group.userData.aim;
    this.barrel = this.group.userData.barrel;
    this.muzzle = this.group.userData.muzzle;
    this.muzzleWorld = new THREE.Vector3();
    this.aimAngle = 0;
  }

  get range() {
    return this.stats.range;
  }

  get dps() {
    const s = this.stats;
    const splashMul = s.splash ? 1.5 : s.chain ? 1.6 : 1;
    return s.damage * s.rate * splashMul;
  }

  get upgradePrice() {
    return upgradeCost(this.type, this.level);
  }

  get sellPrice() {
    return sellValue(this.invested);
  }

  canUpgrade() {
    return this.level < 3;
  }

  upgrade() {
    if (!this.canUpgrade()) return false;
    const cost = this.upgradePrice;
    if (this.game.gold < cost) return false;
    this.game.gold -= cost;
    this.invested += cost;
    this.level++;
    this.stats = towerStats(this.type, this.level);
    this.group.userData.setLevel(this.level);
    this.game.effects.ring(this.group.position, 0xffd257, 3.4, 0.55);
    this.game.effects.sparkBurst(new THREE.Vector3(this.cell.x, 1.2, this.cell.z), 0xffd257, 18, { speed: 7, size: 0.22 });
    this.game.audio.play('upgrade');
    return true;
  }

  sell() {
    this.game.gold += this.sellPrice;
    this.game.scene.remove(this.group);
    this.game.grid.free(this.cell.i, this.cell.j);
    this.game.effects.puff(new THREE.Vector3(this.cell.x, 0.6, this.cell.z), 0xd8c9a8, 12, { size: 0.8 });
    this.game.audio.play('sell');
  }

  acquire() {
    const def = this.def;
    let best = null;
    let bestScore = -Infinity;
    const cx = this.group.position.x;
    const cz = this.group.position.z;
    for (const e of this.game.enemies) {
      if (!e.alive) continue;
      if (e.def.flying && !def.air) continue;
      if (!e.def.flying && !def.ground) continue;
      const dx = e.center.x - cx;
      const dz = e.center.z - cz;
      const dist = Math.hypot(dx, dz);
      if (dist > this.range) continue;
      let score;
      if (this.mode === 'first') score = e.progress;
      else if (this.mode === 'strong') score = e.hp;
      else score = -dist;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  update(dt, t) {
    this.group.userData.update(t, dt);
    this.cooldown -= dt;
    if (this.barrel) {
      this.recoil = Math.max(0, this.recoil - dt * 8);
      const baseZ = this.barrelBaseZ ?? (this.barrelBaseZ = this.barrel.position.z);
      this.barrel.position.z = baseZ - this.recoil * 0.26;
    }

    const target = this.acquire();
    this.target = target;
    if (!target) return;

    const cx = this.group.position.x;
    const cz = this.group.position.z;
    const dx = target.center.x - cx;
    const dz = target.center.z - cz;
    const yaw = Math.atan2(dx, dz);

    let aligned = true;
    if (this.aim) {
      this.aim.rotation.y = dampAngle(this.aim.rotation.y, yaw, 16, dt);
      aligned = Math.abs(angleDiff(this.aim.rotation.y, yaw)) < 0.45;
    }
    if (this.barrel) {
      const my = this.group.position.y + 1.9;
      const elev = Math.atan2(target.center.y - my, Math.hypot(dx, dz));
      this.barrel.rotation.x = THREE.MathUtils.damp(this.barrel.rotation.x, -elev, 12, dt);
    }

    if (this.cooldown <= 0 && aligned) {
      this.fire(target);
      this.cooldown = 1 / this.stats.rate;
    }
  }

  fire(target) {
    const type = this.type;
    this.muzzle.getWorldPosition(this.muzzleWorld);
    const s = this.stats;
    const crit = Math.random() < 0.12;
    const dmg = s.damage * (crit ? 1.7 : 1);

    if (type === 'tesla') {
      this.castChain(target);
    } else {
      const opts = {
        from: this.muzzleWorld.clone(),
        target,
        damage: dmg,
        kind: s.kind,
        speed: s.speed,
        crit,
      };
      if (type === 'cannon') {
        opts.type = 'shell';
        opts.ballistic = true;
        opts.splash = s.splash;
        opts.hitsAir = false;
      } else if (type === 'frost') {
        opts.type = 'shard';
        opts.splash = s.splash;
        opts.slow = s.slow;
        opts.slowTime = s.slowTime;
      } else if (type === 'arcane') {
        opts.type = 'orb';
      } else {
        opts.type = 'arrow';
      }
      this.game.addProjectile(opts);
      this.game.effects.sparkBurst(this.muzzleWorld, type === 'cannon' ? 0xffb35c : 0xffe6a8, 5, { speed: 3.5, size: 0.16, life: 0.3 });
      this.game.audio.play(type === 'cannon' ? 'cannon' : type === 'frost' ? 'frost' : type === 'arcane' ? 'arcane' : 'arrow');
    }

    this.group.userData.fireAnim?.();
    if (type === 'cannon') this.recoil = 1;
  }

  castChain(target) {
    const hit = new Set();
    let current = target;
    let dmg = this.stats.damage;
    let from = this.muzzleWorld.clone();
    const color = 0xaef4ff;
    for (let i = 0; i < (this.stats.chain ?? 3) && current; i++) {
      hit.add(current);
      this.game.effects.lightning(from, current.center, color, 9, 0.22, 0.9);
      this.game.effects.sparkBurst(current.center, 0x9fe9ff, 8, { speed: 6, size: 0.18, life: 0.3 });
      current.hurt(dmg, 'magic', { crit: false });
      dmg *= 0.75;
      from = current.center.clone();
      let next = null;
      let bestD = 8.5;
      for (const e of this.game.enemies) {
        if (!e.alive || hit.has(e)) continue;
        const d = e.center.distanceTo(from);
        if (d < bestD) { bestD = d; next = e; }
      }
      current = next;
    }
    this.game.audio.play('tesla');
    this.game.engine.shake(0.12);
  }
}
