import * as THREE from 'three';
import { TAU, rr, clamp } from '../core/utils.js';
import { glowTexture } from '../art/materials.js';

/* ------------------------------------------------------------------ */
class ParticlePool {
  constructor(scene, max, additive) {
    this.max = max;
    this.list = [];
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.siz = new Float32Array(max);
    this.alp = new Float32Array(max);

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.siz, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alp, 1));
    this.geo.setDrawRange(0, 0);

    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 1200 } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uScale;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uScale / max(1.0, -mv.z), 1.0, 90.0);
          gl_Position = projectionMatrix * mv;
          vColor = aColor;
          vAlpha = aAlpha;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.08, d) * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor, a);
        }`,
    });

    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(p) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push(p);
  }

  update(dt) {
    const arr = this.list;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) {
        arr[i] = arr[arr.length - 1];
        arr.pop();
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy += p.grav * dt;
      const drag = 1 - Math.min(0.95, p.drag * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy *= drag;
    }

    const n = arr.length;
    for (let i = 0; i < n; i++) {
      const p = arr[i];
      this.pos[i * 3] = p.x;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z;
      this.col[i * 3] = p.r;
      this.col[i * 3 + 1] = p.g;
      this.col[i * 3 + 2] = p.b;
      this.siz[i] = p.size * (0.6 + 0.4 * (p.life / p.maxLife));
      this.alp[i] = Math.pow(clamp(p.life / p.maxLife, 0, 1), p.fade);
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ */
export class Effects {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.sparks = new ParticlePool(scene, 700, true);
    this.smoke = new ParticlePool(scene, 320, false);

    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.72, 1, 40);
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(this.ringGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.renderOrder = 5;
      scene.add(m);
      this.rings.push({ mesh: m, t: 0, dur: 1, maxR: 1 });
    }

    this.lines = [];
    this.flashes = [];
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(), color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      s.visible = false;
      s.renderOrder = 6;
      scene.add(s);
      this.flashes.push({ sprite: s, t: 0, dur: 0.3, size: 1 });
    }

    this.textRoot = document.body;
  }

  /* ------------ particles ------------ */
  sparkBurst(pos, color, count = 14, opts = {}) {
    const c = new THREE.Color(color);
    const speed = opts.speed ?? 9;
    const life = opts.life ?? 0.5;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const u = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - u * u);
      const sp = speed * (0.35 + Math.random() * 0.9);
      const l = life * (0.6 + Math.random() * 0.8);
      this.sparks.spawn({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * r * sp,
        vy: u * sp * 0.7 + (opts.up ?? 2),
        vz: Math.sin(a) * r * sp,
        life: l,
        maxLife: l,
        size: (opts.size ?? 0.22) * (0.6 + Math.random() * 0.9),
        r: c.r * (opts.bright ?? 1.4),
        g: c.g * (opts.bright ?? 1.4),
        b: c.b * (opts.bright ?? 1.4),
        grav: opts.gravity ?? -14,
        drag: opts.drag ?? 1.4,
        fade: 1.2,
      });
    }
  }

  puff(pos, color, count = 6, opts = {}) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = (opts.speed ?? 1.6) * (0.4 + Math.random());
      const l = (opts.life ?? 0.9) * (0.7 + Math.random() * 0.6);
      this.smoke.spawn({
        x: pos.x + (Math.random() - 0.5) * 0.6,
        y: pos.y + Math.random() * 0.5,
        z: pos.z + (Math.random() - 0.5) * 0.6,
        vx: Math.cos(a) * sp,
        vy: (opts.up ?? 1.1) * (0.4 + Math.random()),
        vz: Math.sin(a) * sp,
        life: l,
        maxLife: l,
        size: (opts.size ?? 0.7) * (0.7 + Math.random() * 0.9),
        r: c.r, g: c.g, b: c.b,
        grav: 0.6,
        drag: 0.9,
        fade: 1.6,
      });
    }
  }

  /* ------------ rings & flashes ------------ */
  ring(pos, color, maxR = 3, dur = 0.4, y = 0.25) {
    const slot = this.rings.find((r) => !r.mesh.visible) ?? this.rings[0];
    slot.mesh.visible = true;
    slot.mesh.position.set(pos.x, y, pos.z);
    slot.mesh.material.color.set(color);
    slot.mesh.material.opacity = 0.9;
    slot.mesh.scale.setScalar(0.2);
    slot.t = 0;
    slot.dur = dur;
    slot.maxR = maxR;
  }

  flash(pos, color, size = 3, dur = 0.25) {
    const slot = this.flashes.find((f) => !f.sprite.visible) ?? this.flashes[0];
    slot.sprite.visible = true;
    slot.sprite.position.copy(pos);
    slot.sprite.material.color.set(color);
    slot.sprite.material.opacity = 1;
    slot.sprite.scale.setScalar(size);
    slot.t = 0;
    slot.dur = dur;
    slot.size = size;
  }

  lightning(a, b, color = 0xaef4ff, segments = 9, life = 0.22, jitter = 0.5) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const p = a.clone().lerp(b, t);
      if (i !== 0 && i !== segments) {
        p.x += (Math.random() - 0.5) * jitter;
        p.y += (Math.random() - 0.5) * jitter;
        p.z += (Math.random() - 0.5) * jitter;
      }
      pts.push(p);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 7;
    this.scene.add(line);
    this.lines.push({ line, t: 0, dur: life });
  }

  /* ------------ floating text ------------ */
  text(pos, str, cls = '') {
    const v = pos.clone().project(this.camera);
    if (v.z > 1 || v.z < -1) return;
    const el = document.createElement('div');
    el.className = 'ftext ' + cls;
    el.textContent = str;
    el.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth).toFixed(1) + 'px';
    el.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight).toFixed(1) + 'px';
    this.textRoot.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  damage(pos, amount, kind = 'physical', crit = false) {
    const cls = kind === 'magic' ? 'magic' : kind === 'frost' ? 'frost' : crit ? 'crit' : '';
    const value = amount >= 10 ? Math.round(amount) : Math.round(amount * 10) / 10;
    this.text(pos, String(value), cls);
  }

  /* ------------ composites ------------ */
  impact(pos, color, big = false) {
    this.sparkBurst(pos, color, big ? 26 : 10, { speed: big ? 13 : 8, size: big ? 0.34 : 0.2 });
    if (big) {
      this.ring(pos, color, 4.6, 0.45);
      this.puff(pos, 0xffe6c0, 7, { size: 0.9, life: 0.7 });
    }
  }

  explosion(pos) {
    this.sparkBurst(pos, 0xffa347, 30, { speed: 15, size: 0.4, life: 0.6 });
    this.sparkBurst(pos, 0xfff0b0, 14, { speed: 9, size: 0.24, life: 0.4 });
    this.puff(pos, 0x5a4a66, 10, { size: 1.2, life: 1.1, up: 1.6 });
    this.ring(pos, 0xffb35c, 5.4, 0.5);
    this.flash(pos, 0xffb35c, 5, 0.22);
  }

  buildPuff(pos, color = 0xbfe8a8) {
    this.puff(pos, color, 9, { size: 0.8, life: 0.8, up: 1.4 });
    this.ring(pos, color, 3.2, 0.45);
  }

  freezeBurst(pos) {
    this.sparkBurst(pos, 0x9fe9ff, 22, { speed: 10, size: 0.26, gravity: -6 });
    this.puff(pos, 0xd9f8ff, 5, { size: 0.8, life: 0.7 });
    this.ring(pos, 0x6fe8ff, 3.8, 0.5);
  }

  heal(pos) {
    for (let i = 0; i < 5; i++) {
      this.sparks.spawn({
        x: pos.x + (Math.random() - 0.5) * 0.6,
        y: pos.y + Math.random() * 0.4,
        z: pos.z + (Math.random() - 0.5) * 0.6,
        vx: 0, vy: 1.8 + Math.random() * 1.2, vz: 0,
        life: 0.7, maxLife: 0.7, size: 0.22,
        r: 0.4, g: 2.0, b: 0.6, grav: 0, drag: 0.2, fade: 1.2,
      });
    }
  }

  /* ------------ tick ------------ */
  update(dt, camera) {
    this.sparks.update(dt);
    this.smoke.update(dt);

    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.t += dt;
      const k = clamp(r.t / r.dur, 0, 1);
      r.mesh.scale.setScalar(0.2 + (r.maxR - 0.2) * Math.pow(k, 0.6));
      r.mesh.material.opacity = 0.95 * Math.pow(1 - k, 1.6);
      if (k >= 1) r.mesh.visible = false;
    }

    for (const f of this.flashes) {
      if (!f.sprite.visible) continue;
      f.t += dt;
      const k = clamp(f.t / f.dur, 0, 1);
      f.sprite.material.opacity = (1 - k) * (1 - k);
      f.sprite.scale.setScalar(f.size * (1 + k * 0.8));
      if (k >= 1) f.sprite.visible = false;
    }

    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i];
      l.t += dt;
      const k = clamp(l.t / l.dur, 0, 1);
      l.line.material.opacity = 1 - k;
      if (k >= 1) {
        this.scene.remove(l.line);
        l.line.geometry.dispose();
        l.line.material.dispose();
        this.lines.splice(i, 1);
      }
    }
  }

  setViewport(height, fov) {
    const scale = (height * 0.5) / Math.tan((fov * Math.PI) / 360);
    this.sparks.mat.uniforms.uScale.value = scale;
    this.smoke.mat.uniforms.uScale.value = scale;
  }
}
