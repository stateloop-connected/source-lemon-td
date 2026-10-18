import * as THREE from 'three';
import { C } from './palette.js';
import { rr, TAU } from '../core/utils.js';
import { mergeColored, jitterGeometry } from './geometry.js';
import { toon, addOutline, makeGlow, metal } from './materials.js';

/* ------------------------------------------------------------------ */
export function makeTree(rng, opts = {}) {
  const scale = opts.scale ?? rr(rng, 0.85, 1.4);
  const h = rr(rng, 1.6, 2.4);
  const parts = [];

  const trunk = new THREE.CylinderGeometry(0.14, 0.32, h, 6, 1);
  trunk.translate(0, h / 2, 0);
  parts.push({ geo: trunk, color: C.bark });

  for (let i = 0; i < 2; i++) {
    const a = rr(rng, 0, TAU);
    const br = new THREE.CylinderGeometry(0.055, 0.09, 0.9, 4);
    br.translate(0, 0.45, 0);
    br.rotateZ(0.7 + rng() * 0.25);
    br.rotateY(a);
    br.translate(0, h * 0.62, 0);
    parts.push({ geo: br, color: C.bark });
  }

  const palette = [C.leafA, C.leafB, C.leafC, 0x74c954];
  const blobs = 3 + Math.floor(rng() * 2);
  for (let i = 0; i < blobs; i++) {
    const r = i === 0 ? rr(rng, 1.0, 1.3) : rr(rng, 0.62, 0.95);
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(1.08, 0.88, 1.04);
    const a = (i / blobs) * TAU + rng() * 0.8;
    const dist = i === 0 ? 0 : rr(rng, 0.5, 0.95);
    g.translate(
      Math.cos(a) * dist,
      h + 0.35 + (i === 0 ? 0.55 : rr(rng, 0.05, 0.5)),
      Math.sin(a) * dist * 0.8
    );
    parts.push({ geo: g, color: palette[i % palette.length] });
  }

  const geo = mergeColored(parts);
  const mesh = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true, flat: true }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh, 0.045);

  const g = new THREE.Group();
  g.add(mesh);
  g.scale.setScalar(scale);
  g.rotation.y = rng() * TAU;
  g.userData.radius = 1.35 * scale;
  return g;
}

export function makePine(rng, opts = {}) {
  const scale = opts.scale ?? rr(rng, 0.8, 1.3);
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.12, 0.24, 1.4, 5);
  trunk.translate(0, 0.7, 0);
  parts.push({ geo: trunk, color: C.bark });

  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const r = 1.45 - i * 0.34;
    const hh = 1.25 - i * 0.16;
    const cone = new THREE.ConeGeometry(r, hh, 7, 1);
    cone.translate(0, 1.1 + i * 0.72 + hh / 2, 0);
    cone.rotateY(i * 0.4);
    parts.push({ geo: cone, color: i % 2 ? C.pineB : C.pineA });
  }

  const geo = mergeColored(parts);
  const mesh = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true, flat: true }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh, 0.045);
  const g = new THREE.Group();
  g.add(mesh);
  g.scale.setScalar(scale);
  g.rotation.y = rng() * TAU;
  g.userData.radius = 1.2 * scale;
  return g;
}

export function makeBush(rng, opts = {}) {
  const scale = opts.scale ?? rr(rng, 0.7, 1.2);
  const parts = [];
  const n = 3;
  for (let i = 0; i < n; i++) {
    const r = rr(rng, 0.4, 0.7);
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(1.2, 0.8, 1.1);
    const a = (i / n) * TAU;
    g.translate(Math.cos(a) * 0.4, r * 0.7, Math.sin(a) * 0.4);
    parts.push({ geo: g, color: [C.leafA, C.leafC, C.leafB][i % 3] });
  }
  const geo = mergeColored(parts);
  const mesh = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true, flat: true }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh, 0.04);
  const g = new THREE.Group();
  g.add(mesh);
  g.scale.setScalar(scale);
  g.rotation.y = rng() * TAU;
  g.userData.radius = 0.9 * scale;
  return g;
}

export function makeRock(rng, opts = {}) {
  const scale = opts.scale ?? rr(rng, 0.6, 1.6);
  const base = new THREE.DodecahedronGeometry(1, 0);
  const jittered = jitterGeometry(base, 0.22, 2.4);
  jittered.scale(1.1, 0.78, 0.95);
  const parts = [{ geo: jittered, color: opts.color ?? C.stone }];

  const moss = new THREE.IcosahedronGeometry(0.75, 1);
  moss.scale(1.15, 0.28, 1.05);
  moss.translate(0.1, 0.5, 0.05);
  parts.push({ geo: moss, color: C.leafC });

  const geo = mergeColored(parts);
  const mesh = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true, flat: true }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh, 0.05);
  const g = new THREE.Group();
  g.add(mesh);
  g.scale.setScalar(scale);
  g.rotation.y = rng() * TAU;
  g.userData.radius = 1.1 * scale;
  return g;
}

export function makeCloud(rng) {
  const parts = [];
  const puffs = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < puffs; i++) {
    const r = rr(rng, 1.1, 2.4);
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(1.25, 0.72, 1.15);
    g.translate(rr(rng, -2.6, 2.6), rr(rng, -0.3, 0.7), rr(rng, -1.2, 1.2));
    parts.push({ geo: g, color: i % 3 === 0 ? 0xf2fbff : 0xffffff });
  }
  const geo = mergeColored(parts);
  const mat = toon(0xffffff, { vertexColors: true, flat: true, emissive: 0x9ecbe8, emissiveIntensity: 0.18 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const g = new THREE.Group();
  g.add(mesh);
  g.userData.radius = 3;
  return g;
}

export function makeMushroom(rng) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.45, 6), toon(0xfff0d8));
  stem.position.y = 0.22;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 7, 0, TAU, 0, Math.PI * 0.55), toon(0xff5f6d, { flat: true }));
  cap.position.y = 0.43;
  cap.scale.y = 0.8;
  g.add(stem, cap);
  for (let i = 0; i < 4; i++) {
    const a = rng() * TAU;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), toon(0xfff6e0));
    dot.position.set(Math.cos(a) * 0.24, 0.55, Math.sin(a) * 0.24);
    g.add(dot);
  }
  const s = rr(rng, 0.7, 1.4);
  g.scale.setScalar(s);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function makeCrystal(rng, color = C.cyan) {
  const g = new THREE.Group();
  const geos = [];
  const n = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const h = rr(rng, 0.5, 1.6);
    const crystal = new THREE.ConeGeometry(rr(rng, 0.12, 0.24), h, 5);
    crystal.translate(0, h / 2, 0);
    crystal.rotateZ(rr(rng, -0.45, 0.45));
    crystal.rotateY(rng() * TAU);
    crystal.translate(rr(rng, -0.35, 0.35), 0, rr(rng, -0.35, 0.35));
    geos.push({ geo: crystal, color });
  }
  const geo = mergeColored(geos);
  const mesh = new THREE.Mesh(geo, toon(0xffffff, {
    vertexColors: true, flat: true, emissive: color, emissiveIntensity: 0.55,
  }));
  mesh.castShadow = true;
  addOutline(mesh, 0.03, 0x1d4a5c);
  g.add(mesh);
  const gl = makeGlow(color, 2.0, 0.28);
  gl.position.y = 0.7;
  g.add(gl);
  return g;
}

export function makeTorch() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.7, 6), toon(C.woodDark));
  pole.position.y = 0.85;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.13, 0.22, 7), metal(C.metalDark));
  bowl.position.y = 1.75;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), toon(0xffb03a, { emissive: 0xff8a2a, emissiveIntensity: 1.6 }));
  flame.position.y = 2.05;
  const glow = makeGlow(0xffb45c, 1.6, 0.55);
  glow.position.y = 2.05;
  g.add(pole, bowl, flame, glow);
  g.traverse((o) => { if (o.isMesh && !o.userData.isOutline) { o.castShadow = true; } });
  g.userData.flame = flame;
  g.userData.glow = glow;
  return g;
}

export function makeFlag(color = C.crimson) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 5), toon(C.woodDark));
  pole.position.y = 1.0;
  const clothGeo = new THREE.PlaneGeometry(1.1, 0.7, 6, 3);
  const cloth = new THREE.Mesh(clothGeo, toon(color, { side: THREE.DoubleSide }));
  cloth.position.set(0.58, 1.6, 0);
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.16, 5), toon(C.gold, { emissive: C.gold, emissiveIntensity: 0.25 }));
  emblem.position.set(0.5, 1.6, 0.01);
  g.add(pole, cloth, emblem);
  g.userData.cloth = cloth;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
