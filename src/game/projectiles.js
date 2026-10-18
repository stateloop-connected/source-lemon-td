import * as THREE from 'three';
import { toon, metal, makeGlow, addOutline } from '../art/materials.js';
import { clamp } from '../core/utils.js';

function buildMesh(type) {
  const g = new THREE.Group();
  g.userData.type = type;
  if (type === 'arrow') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 5), toon(0x8a5a34));
    shaft.rotation.x = Math.PI / 2;
    g.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.26, 5), metal(0xd7dee8));
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.6;
    g.add(tip);
    for (let i = 0; i < 2; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.2), toon(0xf0e6cf, { side: THREE.DoubleSide }));
      f.position.z = -0.4;
      f.rotation.z = (i * Math.PI) / 2;
      g.add(f);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  } else if (type === 'shell') {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), metal(0x3a3f4a, { metalness: 0.6, roughness: 0.45 }));
    g.add(ball);
    const fuse = makeGlow(0xff9a3c, 0.9, 0.9);
    fuse.position.set(0, 0.12, 0);
    g.add(fuse);
    ball.castShadow = true;
  } else if (type === 'shard') {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), toon(0xbfefff, { flat: true, emissive: 0x39c8e8, emissiveIntensity: 1.2 }));
    addOutline(s, 0.02, 0x2a6a80);
    g.add(s);
    const glow = makeGlow(0x8ff2ff, 1.6, 0.8);
    g.add(glow);
  } else if (type === 'orb') {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), toon(0xd9b6ff, { flat: true, emissive: 0xa05bff, emissiveIntensity: 1.5 }));
    g.add(s);
    const glow = makeGlow(0xb47bff, 2.2, 0.85);
    g.add(glow);
  }
  return g;
}

const templates = {};
function getTemplate(type) {
  if (!templates[type]) templates[type] = buildMesh(type);
  return templates[type];
}

export class Projectile {
  constructor(game, o) {
    this.game = game;
    this.type = o.type;
    this.target = o.target;
    this.damage = o.damage;
    this.kind = o.kind ?? 'physical';
    this.splash = o.splash ?? 0;
    this.slow = o.slow ?? 0;
    this.slowTime = o.slowTime ?? 0;
    this.speed = o.speed ?? 30;
    this.hitsAir = o.hitsAir ?? true;
    this.crit = o.crit ?? false;
    this.alive = true;
    this.age = 0;
    this.trailTimer = 0;

    this.mesh = getTemplate(this.type).clone(true);
    this.mesh.position.copy(o.from);
    game.scene.add(this.mesh);

    this.pos = this.mesh.position;
    this.lastTarget = o.target ? o.target.center.clone() : o.from.clone();
    this.ballistic = !!o.ballistic;

    if (this.ballistic) {
      this.start = o.from.clone();
      const lead = o.target && o.target.alive
        ? o.target.center.clone().addScaledVector(o.target.forward, o.target.currentSpeed * 0.55)
        : this.lastTarget.clone();
      this.end = lead;
      const dist = this.start.distanceTo(this.end);
      this.T = clamp(dist / this.speed, 0.35, 1.5);
      this.arc = 2.0 + dist * 0.24;
      this.t = 0;
    }
  }

  update(dt) {
    if (!this.alive) return;
    this.age += dt;
    if (this.age > 5) return this.finish(false);

    if (this.ballistic) {
      this.t += dt;
      const k = clamp(this.t / this.T, 0, 1);
      this.pos.lerpVectors(this.start, this.end, k);
      this.pos.y += Math.sin(Math.PI * k) * this.arc;
      this.mesh.rotation.x += dt * 8;
      this.mesh.rotation.z += dt * 5;
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.04;
        this.game.effects.puff(this.pos, 0xd8cbb8, 1, { size: 0.32, life: 0.5, up: 0.5 });
      }
      if (k >= 1) {
        this.explode(this.pos.clone());
      }
      return;
    }

    // homing
    const targetAlive = this.target && this.target.alive;
    if (targetAlive) this.lastTarget.copy(this.target.center);
    const aim = targetAlive ? this.target.center : this.lastTarget;
    const dir = aim.clone().sub(this.pos);
    const dist = dir.length();
    if (dist < 0.001) return this.hitDirect(aim.clone());

    dir.multiplyScalar(1 / dist);
    const step = this.speed * dt;
    if (step >= dist) {
      this.pos.copy(aim);
      this.hitDirect(aim.clone());
      return;
    }
    this.pos.addScaledVector(dir, step);
    this.mesh.lookAt(this.pos.clone().add(dir));

    this.trailTimer -= dt;
    if (this.type === 'orb') {
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.025;
        this.game.effects.sparkBurst(this.pos, 0xb47bff, 1, { speed: 1.2, size: 0.16, life: 0.35, gravity: 0 });
      }
    } else if (this.type === 'shard') {
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.06;
        this.game.effects.sparkBurst(this.pos, 0x9fe9ff, 1, { speed: 0.8, size: 0.13, life: 0.3, gravity: -2 });
      }
    }
  }

  hitDirect(at) {
    if (this.splash > 0) return this.explode(at);
    this.game.effects.impact(at, this.kind === 'magic' ? 0xb47bff : 0xffd9a0, false);
    if (this.target && this.target.alive) {
      this.target.hurt(this.damage, this.kind, { crit: this.crit, from: this.type });
      if (this.slow) this.target.applySlow(this.slow, this.slowTime);
    } else {
      this.game.effects.puff(at, 0xcfc3b0, 2, { size: 0.4, life: 0.35 });
    }
    this.game.audio.play(this.type === 'orb' ? 'magicHit' : 'hit');
    this.finish(true);
  }

  explode(at) {
    const g = this.game;
    if (this.type === 'shell') {
      g.effects.explosion(at);
      g.audio.play('explosion');
      g.engine.shake(0.5);
    } else if (this.type === 'shard') {
      g.effects.freezeBurst(at);
      g.audio.play('freeze');
    } else {
      g.effects.impact(at, 0x9fe9ff, true);
    }

    if (this.splash > 0) {
      for (const e of g.enemies) {
        if (!e.alive) continue;
        if (!this.hitsAir && e.def.flying) continue;
        const d = e.center.distanceTo(at);
        if (d <= this.splash) {
          const falloff = 1 - (d / this.splash) * 0.45;
          e.hurt(this.damage * falloff, this.kind, { crit: false, from: this.type });
          if (this.slow) e.applySlow(this.slow, this.slowTime);
        }
      }
    } else if (this.target && this.target.alive) {
      this.target.hurt(this.damage, this.kind, { crit: this.crit, from: this.type });
    }
    this.finish(true);
  }

  finish(hit) {
    this.alive = false;
    this.game.scene.remove(this.mesh);
  }
}
