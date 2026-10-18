import * as THREE from 'three';
import { C } from './palette.js';
import { TAU } from '../core/utils.js';
import { toon, metal, glowMat, addOutline, makeGlow, worldTexture } from './materials.js';
import { rbox, mergeColored } from './geometry.js';

function part(parent, geo, mat, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (opts.rx) m.rotation.x = opts.rx;
  if (opts.ry) m.rotation.y = opts.ry;
  if (opts.rz) m.rotation.z = opts.rz;
  m.castShadow = opts.cast ?? true;
  m.receiveShadow = opts.receive ?? true;
  if (opts.outline) addOutline(m, opts.outline);
  parent.add(m);
  return m;
}

/* ------------------------------------------------------------------ */
function stoneBase(radius = 2.3, height = 0.85) {
  const g = new THREE.Group();
  const stoneTex = worldTexture('stone');
  const mat = toon(0xcfd6e2, { flat: true, map: stoneTex });
  const plinth = part(g, new THREE.CylinderGeometry(radius * 1.02, radius * 1.16, height, 8), mat, 0, height / 2, 0, { outline: 0.055 });
  plinth.rotation.y = Math.PI / 8;
  const rim = part(g, new THREE.CylinderGeometry(radius * 1.08, radius * 1.02, 0.16, 8), toon(0xe6ebf3, { flat: true }), 0, height, 0);
  rim.rotation.y = Math.PI / 8;

  const mossMat = toon(C.leafC, { flat: true });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.6;
    const moss = part(g, new THREE.SphereGeometry(0.34, 7, 4), mossMat, Math.cos(a) * radius * 0.92, 0.18, Math.sin(a) * radius * 0.92);
    moss.scale.set(1.3, 0.32, 1.1);
  }

  const runeMat = glowMat(C.cyan, 1.15, { transparent: true, opacity: 0.55, depthWrite: false });
  const ring = part(g, new THREE.TorusGeometry(radius * 0.72, 0.035, 4, 40), runeMat, 0, height + 0.1, 0, { rx: Math.PI / 2, cast: false, receive: false });
  ring.rotation.z = 0;
  return g;
}

function levelOrnaments(g) {
  const d2 = [];
  const d3 = [];
  const goldMat = metal(C.gold, { metalness: 0.55, roughness: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.08, 5, 40), goldMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.98;
  ring.castShadow = true;
  ring.visible = false;
  g.add(ring);
  d2.push(ring);

  const crown = new THREE.Group();
  const crownMat = metal(C.gold, { metalness: 0.6, roughness: 0.26, emissive: 0x3a2600, emissiveIntensity: 0.4 });
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.06, 5, 16), crownMat);
  band.rotation.x = Math.PI / 2;
  crown.add(band);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 4), crownMat);
    spike.position.set(Math.cos(a) * 0.32, 0.26, Math.sin(a) * 0.32);
    crown.add(spike);
  }
  crown.visible = false;
  g.add(crown);
  d3.push(crown);

  g.userData.levelDecor = { d2, d3, crown };
}

/* ------------------------------------------------------------------ *
 *  ARROW
 * ------------------------------------------------------------------ */
function buildArrow() {
  const g = new THREE.Group();
  g.add(stoneBase(2.25, 0.85));

  const wood = toon(0xb0793f, { map: worldTexture('wood') });
  const woodDark = toon(0x7a4f27, { flat: true });
  const woodLight = toon(0xd6a05e, { flat: true });

  const deck = part(g, new THREE.CylinderGeometry(1.78, 1.9, 0.26, 8), wood, 0, 1.0, 0, { outline: 0.04 });
  deck.rotation.y = Math.PI / 8;

  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    part(g, rbox(0.2, 2.6, 0.2, 0.05), woodDark, sx * 1.3, 2.35, sz * 1.3, { rz: sx * 0.02, outline: 0.02 });
  }

  // railings
  for (const [x, z, w, d] of [[0, 1.35, 2.6, 0.09], [0, -1.35, 2.6, 0.09], [1.35, 0, 0.09, 2.6], [-1.35, 0, 0.09, 2.6]]) {
    part(g, rbox(w, 0.08, d, 0.03), woodLight, x, 1.85, z);
    part(g, rbox(w, 0.08, d, 0.03), woodLight, x, 1.5, z);
  }

  // open top frame
  for (const [x, z, w, d] of [[0, 1.3, 2.85, 0.13], [0, -1.3, 2.85, 0.13], [1.3, 0, 0.13, 2.85], [-1.3, 0, 0.13, 2.85]]) {
    part(g, rbox(w, 0.15, d, 0.03), woodDark, x, 3.62, z, { outline: 0.02 });
  }

  // canvas awning over the rear half, so the crossbow stays readable
  const awning = new THREE.Group();
  awning.position.set(0, 3.78, -0.62);
  awning.rotation.x = -0.16;
  g.add(awning);
  const canvasMat = toon(0xe9d7ab, { side: THREE.DoubleSide, flat: true });
  part(awning, new THREE.PlaneGeometry(3.0, 2.25, 6, 3), canvasMat, 0, 0, 0, { rx: -Math.PI / 2, outline: 0.02 });
  part(awning, new THREE.PlaneGeometry(3.06, 0.16), toon(0xd94a5c, { side: THREE.DoubleSide }), 0, 0.012, 1.08, { rx: -Math.PI / 2, cast: false });
  for (const sx of [-1, 1]) {
    part(g, new THREE.CylinderGeometry(0.05, 0.05, 0.95, 5), woodDark, sx * 1.28, 3.5, -1.28);
  }

  // flag pole
  part(g, new THREE.CylinderGeometry(0.035, 0.035, 1.6, 5), woodDark, 1.24, 4.35, -1.24, { outline: 0.015 });
  const flag = part(g, new THREE.PlaneGeometry(0.95, 0.52), toon(0xd94a5c, { side: THREE.DoubleSide }), 1.72, 4.85, -1.24, { cast: false });
  part(g, new THREE.CircleGeometry(0.1, 5), toon(C.gold), 1.6, 4.85, -1.23, { cast: false });

  // ammo crate
  part(g, rbox(0.72, 0.5, 0.52, 0.05), woodDark, -0.95, 1.32, -1.0);

  // hanging banner
  const banner = new THREE.Group();
  const cloth = part(banner, new THREE.PlaneGeometry(0.7, 1.15, 3, 3), toon(0xd94a5c, { side: THREE.DoubleSide }), 0, 0, 0);
  const star = part(banner, new THREE.CircleGeometry(0.16, 5), toon(C.gold), 0, 0.12, 0.01, { cast: false });
  banner.position.set(1.6, 2.75, 0.72);
  banner.rotation.y = -0.2;
  g.add(banner);

  // lantern
  const lantern = new THREE.Group();
  part(lantern, rbox(0.26, 0.34, 0.26, 0.05), metal(C.metalDark), 0, 0, 0);
  const lamp = part(lantern, new THREE.SphereGeometry(0.11, 8, 6), glowMat(0xffc36b, 2.4), 0, 0, 0, { cast: false });
  const lampGlow = makeGlow(0xffb45c, 0.9, 0.6);
  lantern.add(lampGlow);
  lantern.position.set(-1.55, 2.05, 0.6);
  g.add(lantern);

  // turret
  const aim = new THREE.Group();
  aim.position.set(0, 1.55, 0);
  g.add(aim);

  part(aim, new THREE.CylinderGeometry(0.42, 0.52, 0.35, 8), woodDark, 0, 0.1, 0);

  const stock = part(aim, rbox(0.34, 0.22, 1.85, 0.05), woodDark, 0, 0.62, 0.1, { outline: 0.025 });
  part(aim, rbox(0.18, 0.5, 0.22, 0.04), woodDark, 0, 0.42, -0.72, { rx: -0.35 });

  // bow limbs
  const bowMat = toon(0x3b2a20, { flat: true });
  for (const sign of [-1, 1]) {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0.78, 0.85),
      new THREE.Vector3(sign * 0.72, 0.78, 1.2),
      new THREE.Vector3(sign * 1.02, 0.78, 0.72)
    );
    const limb = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.055, 5, false), bowMat);
    limb.castShadow = true;
    aim.add(limb);
  }
  const string = part(aim, new THREE.CylinderGeometry(0.018, 0.018, 2.04, 4), toon(0xe8e0cf), 0, 0.78, 0.72, { rz: Math.PI / 2, cast: false });

  const bolt = new THREE.Group();
  part(bolt, new THREE.CylinderGeometry(0.035, 0.035, 1.15, 5), toon(0x8a5a34), 0, 0, 0, { rx: Math.PI / 2, cast: false });
  const tip = part(bolt, new THREE.ConeGeometry(0.075, 0.22, 5), metal(C.metal), 0, 0, 0.66, { rx: Math.PI / 2, cast: false });
  for (let i = 0; i < 2; i++) {
    const fl = part(bolt, new THREE.PlaneGeometry(0.16, 0.18), toon(0xe8e0cf, { side: THREE.DoubleSide }), 0, 0, -0.5, { cast: false });
    fl.rotation.z = (i * Math.PI) / 2;
  }
  bolt.position.set(0, 0.82, 0.35);
  aim.add(bolt);

  // quiver
  const quiver = new THREE.Group();
  part(quiver, new THREE.CylinderGeometry(0.17, 0.14, 0.9, 7), toon(0x6b4426), 0, 0, 0, { outline: 0.02 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    part(quiver, new THREE.CylinderGeometry(0.018, 0.018, 0.55, 4), toon(0xcaa06a), Math.cos(a) * 0.09, 0.6, Math.sin(a) * 0.09, { cast: false });
  }
  quiver.position.set(-1.0, 1.35, -0.9);
  quiver.rotation.z = 0.25;
  g.add(quiver);

  levelOrnaments(g);
  g.userData.levelDecor.crown.position.set(0, 4.9, 0);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.82, 1.3);
  aim.add(muzzle);

  g.userData = {
    ...g.userData, type: 'arrow', aim, barrel: null, muzzle, height: 4.9,
    recoil: 0,
    update(t, dt) {
      banner.rotation.z = Math.sin(t * 1.6) * 0.05;
      cloth.rotation.y = Math.sin(t * 1.2) * 0.06;
      lampGlow.material.opacity = 0.45 + Math.sin(t * 8.3) * 0.08;
      // idle hovering of the loaded bolt
      bolt.position.y = 0.82 + Math.sin(t * 2.2) * 0.015;
    },
    fireAnim() {
      bolt.visible = false;
      setTimeout(() => { bolt.visible = true; }, 150);
    },
  };
  return g;
}

/* ------------------------------------------------------------------ *
 *  CANNON
 * ------------------------------------------------------------------ */
function buildCannon() {
  const g = new THREE.Group();
  g.add(stoneBase(2.35, 0.8));

  const wood = toon(0xa86f38, { map: worldTexture('wood') });
  const iron = metal(0x555f6d, { metalness: 0.7, roughness: 0.4 });
  const brass = metal(0xc08a45, { metalness: 0.75, roughness: 0.28 });

  const deck = part(g, rbox(3.5, 0.28, 3.3, 0.1), wood, 0, 0.95, 0, { outline: 0.04 });

  // wheels
  for (const sx of [-1, 1]) {
    const wheel = new THREE.Group();
    part(wheel, new THREE.CylinderGeometry(0.66, 0.66, 0.2, 14), wood, 0, 0, 0, { rz: Math.PI / 2, outline: 0.03 });
    part(wheel, new THREE.TorusGeometry(0.66, 0.055, 5, 16), iron, 0, 0, 0, { ry: Math.PI / 2 });
    part(wheel, new THREE.CylinderGeometry(0.15, 0.15, 0.24, 8), iron, 0, 0, 0, { rz: Math.PI / 2 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      part(wheel, rbox(0.09, 1.15, 0.09, 0.02), woodDarkMat(), 0, 0, 0, {
        rz: a, cast: false,
      });
    }
    wheel.position.set(sx * 1.42, 0.68, 0.25);
    g.add(wheel);
  }

  const carriage = part(g, rbox(1.95, 0.6, 1.5, 0.08), wood, 0, 1.2, -0.15);
  part(g, rbox(2.3, 0.18, 0.4, 0.06), iron, 0, 1.3, 0.55);

  // powder keg + balls
  const keg = new THREE.Group();
  part(keg, new THREE.CylinderGeometry(0.3, 0.3, 0.62, 10), toon(0x8a5a2f), 0, 0, 0, { outline: 0.02 });
  part(keg, new THREE.TorusGeometry(0.31, 0.035, 4, 14), iron, 0, 0.2, 0, { rx: Math.PI / 2 });
  part(keg, new THREE.TorusGeometry(0.31, 0.035, 4, 14), iron, 0, -0.2, 0, { rx: Math.PI / 2 });
  keg.position.set(-1.45, 0.35, -1.35);
  g.add(keg);
  for (let i = 0; i < 3; i++) {
    part(g, new THREE.SphereGeometry(0.16, 7, 5), iron, -1.9 + i * 0.3, 0.16 + (i === 2 ? 0.28 : 0), -1.5 + i * 0.08);
  }

  const aim = new THREE.Group();
  aim.position.set(0, 1.55, 0.1);
  g.add(aim);

  // turret cheeks
  for (const sx of [-1, 1]) {
    part(aim, rbox(0.28, 0.62, 1.2, 0.08), iron, sx * 0.55, 0.12, -0.15);
  }
  part(aim, rbox(1.3, 0.3, 0.9, 0.08), iron, 0, 0.44, -0.2);

  const barrelPivot = new THREE.Group();
  barrelPivot.position.set(0, 0.42, 0.1);
  aim.add(barrelPivot);

  const profile = [
    [0.3, -0.55], [0.46, -0.4], [0.5, 0.15], [0.46, 1.05],
    [0.44, 1.55], [0.5, 1.7], [0.66, 1.78], [0.64, 1.92], [0.5, 1.96],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const barrelGeo = new THREE.LatheGeometry(profile, 16);
  barrelGeo.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, brass);
  barrel.castShadow = barrel.receiveShadow = true;
  addOutline(barrel, 0.035);
  barrelPivot.add(barrel);

  for (const z of [-0.35, 0.35, 1.1, 1.68]) {
    const r = z > 1.5 ? 0.6 : 0.5;
    part(barrelPivot, new THREE.TorusGeometry(r, 0.055, 5, 16), iron, 0, 0, z);
  }
  part(barrelPivot, new THREE.SphereGeometry(0.34, 10, 8), iron, 0, 0, -0.55);
  const muzzleRing = part(barrelPivot, new THREE.TorusGeometry(0.5, 0.07, 5, 16), iron, 0, 0, 1.98);
  const muzzleGlow = makeGlow(0xff9b45, 0.8, 0.35);
  muzzleGlow.position.set(0, 0, 2.02);
  barrelPivot.add(muzzleGlow);

  // recoil state lives on barrelPivot.position.z
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, 2.12);
  barrelPivot.add(muzzle);

  levelOrnaments(g);
  g.userData.levelDecor.crown.position.set(0, 2.9, 0);

  const baseZ = barrelPivot.position.z;
  g.userData = {
    ...g.userData, type: 'cannon', aim, barrel: barrelPivot, muzzle, height: 3.0,
    update(t) {
      muzzleGlow.material.opacity = 0.22 + Math.sin(t * 3.4) * 0.06;
    },
    fireAnim() {
      barrelPivot.position.z = baseZ - 0.28;
    },
  };
  return g;
}

let _woodDark = null;
function woodDarkMat() {
  if (!_woodDark) _woodDark = toon(0x6b4426, { flat: true });
  return _woodDark;
}

/* ------------------------------------------------------------------ *
 *  FROST
 * ------------------------------------------------------------------ */
function buildFrost() {
  const g = new THREE.Group();
  const base = stoneBase(2.25, 0.75);
  g.add(base);
  // snow cap
  const snow = part(g, new THREE.CylinderGeometry(2.05, 2.2, 0.28, 9), toon(0xeafcff, { flat: true }), 0, 0.86, 0);
  snow.rotation.y = Math.PI / 9;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const puff = part(g, new THREE.SphereGeometry(0.4, 7, 5), toon(0xf4fdff, { flat: true }), Math.cos(a) * 1.9, 0.92, Math.sin(a) * 1.9);
    puff.scale.set(1.2, 0.4, 1.1);
  }

  const iceMat = toon(0x9fdcf5, { flat: true, emissive: 0x2fa6c8, emissiveIntensity: 0.45, transparent: true, opacity: 0.97 });
  const iceMatBright = toon(0xb9f0ff, { flat: true, emissive: 0x4fd6f2, emissiveIntensity: 0.9 });

  // central crystal cluster (merged)
  const parts = [];
  const specs = [
    [0, 0, 0, 2.5, 0.46, 0],
    [0.55, 0, 0.2, 1.55, 0.3, -0.25],
    [-0.5, 0, 0.35, 1.3, 0.26, 0.3],
    [0.15, 0, -0.55, 1.15, 0.24, 0.2],
  ];
  for (const [x, y, z, h, r, tilt] of specs) {
    const c = new THREE.ConeGeometry(r, h, 6);
    c.translate(0, h / 2, 0);
    c.rotateZ(tilt);
    c.rotateY(x * 2.3 + z);
    c.translate(x, y + 1.0, z);
    parts.push({ geo: c, color: 0xd8f6ff });
  }
  const clusterGeo = mergeColored(parts);
  const cluster = new THREE.Mesh(clusterGeo, iceMatBright);
  cluster.castShadow = cluster.receiveShadow = true;
  addOutline(cluster, 0.035, 0x3a7f96);
  g.add(cluster);

  const coreGlow = makeGlow(0x8ff2ff, 4.4, 0.5);
  coreGlow.position.y = 2.2;
  g.add(coreGlow);

  const ring = part(g, new THREE.TorusGeometry(1.7, 0.06, 5, 32), glowMat(0x7fe9ff, 1.6, { transparent: true, opacity: 0.65, depthWrite: false }), 0, 1.15, 0, { rx: Math.PI / 2, cast: false });
  const ring2 = part(g, new THREE.TorusGeometry(1.25, 0.045, 4, 26), glowMat(0xbdf5ff, 1.2, { transparent: true, opacity: 0.5, depthWrite: false }), 0, 2.1, 0, { rx: Math.PI / 2, cast: false });

  // orbiting shards
  const shards = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), iceMatBright);
    s.castShadow = true;
    addOutline(s, 0.02, 0x3a7f96);
    g.add(s);
    shards.push(s);
  }

  levelOrnaments(g);
  g.userData.levelDecor.crown.position.set(0, 4.2, 0);

  g.userData = {
    ...g.userData, type: 'frost', aim: null, barrel: null,
    muzzle: (() => { const o = new THREE.Object3D(); o.position.y = 2.2; g.add(o); return o; })(),
    height: 4.0,
    update(t, dt) {
      cluster.rotation.y = t * 0.12;
      coreGlow.material.opacity = 0.35 + Math.sin(t * 2.2) * 0.1;
      ring.rotation.z = t * 0.5;
      ring2.rotation.z = -t * 0.8;
      for (let i = 0; i < shards.length; i++) {
        const a = t * 0.9 + (i / shards.length) * TAU;
        const r = 1.65 + Math.sin(t * 1.4 + i) * 0.18;
        shards[i].position.set(Math.cos(a) * r, 2.15 + Math.sin(t * 1.8 + i * 2) * 0.35, Math.sin(a) * r);
        shards[i].rotation.set(t * 1.2 + i, t * 0.9, 0);
      }
    },
    fireAnim() {
      coreGlow.material.opacity = 1;
    },
  };
  return g;
}

/* ------------------------------------------------------------------ *
 *  ARCANE
 * ------------------------------------------------------------------ */
function buildArcane() {
  const g = new THREE.Group();
  g.add(stoneBase(2.2, 0.8));

  const purpleStone = toon(0x6c4f93, { flat: true, map: worldTexture('stone') });
  const purpleLight = toon(0x9a7ac4, { flat: true });
  const gold = metal(C.gold, { metalness: 0.55, roughness: 0.3 });

  part(g, new THREE.CylinderGeometry(1.55, 1.9, 0.35, 8), toon(0x4e376e, { flat: true }), 0, 1.02, 0, { outline: 0.04 });
  part(g, new THREE.CylinderGeometry(1.15, 1.4, 1.9, 8), purpleStone, 0, 2.05, 0, { outline: 0.05 });
  part(g, new THREE.CylinderGeometry(0.95, 1.12, 1.5, 8), purpleLight, 0, 3.65, 0, { outline: 0.04 });
  part(g, new THREE.CylinderGeometry(1.02, 0.95, 0.2, 8), gold, 0, 4.45, 0);

  // rune band
  const runeMat = glowMat(0xc79bff, 1.8, { transparent: true, opacity: 0.85, depthWrite: false });
  for (const y of [1.55, 2.55, 3.35, 4.1]) {
    const band = part(g, new THREE.TorusGeometry(1.28 - (y - 1.5) * 0.11, 0.045, 4, 30), runeMat, 0, y, 0, { rx: Math.PI / 2, cast: false, receive: false });
    band.rotation.z = y;
  }

  // floating rings
  const rings = [];
  for (let i = 0; i < 2; i++) {
    const r = 1.2 - i * 0.28;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.055, 5, 32), gold);
    ring.rotation.x = Math.PI / 2 + (i ? 0.5 : -0.35);
    ring.position.y = 5.0 + i * 0.5;
    ring.castShadow = true;
    g.add(ring);
    rings.push(ring);
  }

  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.48, 1),
    toon(0xd9b6ff, { flat: true, emissive: 0xa05bff, emissiveIntensity: 1.2 })
  );
  orb.position.y = 5.4;
  orb.castShadow = true;
  addOutline(orb, 0.025, 0x3a1c66);
  g.add(orb);

  const orbGlow = makeGlow(0xb47bff, 5.0, 0.55);
  orbGlow.position.y = 5.4;
  g.add(orbGlow);

  const shards = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.22, 0), glowMat(0xcaa6ff, 1.4, { transparent: true, opacity: 0.9 }));
    g.add(s);
    shards.push(s);
  }

  levelOrnaments(g);
  g.userData.levelDecor.crown.position.set(0, 6.2, 0);

  const muzzle = new THREE.Object3D();
  muzzle.position.y = 5.4;
  g.add(muzzle);

  g.userData = {
    ...g.userData, type: 'arcane', aim: null, barrel: null, muzzle, height: 5.4,
    update(t, dt) {
      orb.position.y = 5.4 + Math.sin(t * 1.6) * 0.14;
      orb.rotation.y = t * 0.6;
      orb.rotation.x = t * 0.3;
      orbGlow.position.y = orb.position.y;
      orbGlow.material.opacity = 0.42 + Math.sin(t * 2.8) * 0.12;
      rings[0].rotation.z = t * 0.7;
      rings[1].rotation.z = -t * 0.9;
      rings[0].position.y = 5.0 + Math.sin(t * 1.1) * 0.1;
      rings[1].position.y = 5.5 + Math.sin(t * 1.3 + 2) * 0.1;
      for (let i = 0; i < shards.length; i++) {
        const a = t * 0.8 + (i / shards.length) * TAU;
        shards[i].position.set(Math.cos(a) * 1.55, 4.6 + Math.sin(t * 2 + i * 2.1) * 0.4, Math.sin(a) * 1.55);
        shards[i].rotation.set(t * 1.4, t * 1.1, t * 0.6);
      }
    },
    fireAnim() {
      orbGlow.material.opacity = 1.2;
    },
  };
  return g;
}

/* ------------------------------------------------------------------ *
 *  TESLA
 * ------------------------------------------------------------------ */
function buildTesla() {
  const g = new THREE.Group();
  const baseMat = metal(0x6b7280, { metalness: 0.7, roughness: 0.4 });
  const copper = metal(C.copper, { metalness: 0.85, roughness: 0.28 });
  const copperLight = metal(C.copperLight, { metalness: 0.8, roughness: 0.24 });

  part(g, new THREE.CylinderGeometry(2.25, 2.45, 0.7, 12), baseMat, 0, 0.35, 0, { outline: 0.05 });
  part(g, new THREE.CylinderGeometry(2.3, 2.3, 0.16, 12), copperLight, 0, 0.78, 0);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    part(g, new THREE.CylinderGeometry(0.09, 0.09, 0.16, 6), copper, Math.cos(a) * 2.1, 0.9, Math.sin(a) * 2.1);
  }

  // insulators
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    for (let k = 0; k < 3; k++) {
      const ins = part(g, new THREE.SphereGeometry(0.24, 8, 6), toon(0xe8eef5, { flat: true }), Math.cos(a) * 1.5, 0.95 + k * 0.36, Math.sin(a) * 1.5);
      ins.scale.y = 0.7;
    }
  }

  // central column
  part(g, new THREE.CylinderGeometry(0.42, 0.52, 3.1, 10), baseMat, 0, 2.3, 0, { outline: 0.03 });

  // coils
  const coils = [];
  const coilSpecs = [
    [1.55, 1.35, 0.13], [1.42, 1.85, 0.12], [1.26, 2.35, 0.11], [1.06, 2.85, 0.1], [0.85, 3.3, 0.09],
  ];
  for (const [r, y, tube] of coilSpecs) {
    const c = part(g, new THREE.TorusGeometry(r, tube, 6, 26), copper, 0, y, 0, { rx: Math.PI / 2, outline: 0.015 });
    coils.push(c);
  }

  // top sphere
  const top = part(g, new THREE.SphereGeometry(0.62, 18, 12), metal(0xc7d2df, { metalness: 0.75, roughness: 0.25 }), 0, 3.85, 0, { outline: 0.03 });
  const core = part(g, new THREE.SphereGeometry(0.3, 10, 8), glowMat(0x8fe8ff, 2.6), 0, 3.85, 0, { cast: false });
  const glow = makeGlow(0x6fe8ff, 5.0, 0.55);
  glow.position.y = 3.85;
  g.add(glow);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 4), copperLight);
    spike.position.set(Math.cos(a) * 0.62, 3.95, Math.sin(a) * 0.62);
    spike.rotation.z = -Math.cos(a) * 0.8;
    spike.rotation.x = Math.sin(a) * 0.8;
    g.add(spike);
  }

  // small arcs geometry, regenerated when firing
  const arcMat = new THREE.LineBasicMaterial({ color: 0xaef4ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const idleArc = new THREE.Line(new THREE.BufferGeometry(), arcMat);
  g.add(idleArc);

  levelOrnaments(g);
  g.userData.levelDecor.crown.position.set(0, 4.75, 0);

  const muzzle = new THREE.Object3D();
  muzzle.position.y = 3.85;
  g.add(muzzle);

  g.userData = {
    ...g.userData, type: 'tesla', aim: null, barrel: null, muzzle, height: 4.4, idleArc,
    update(t, dt) {
      core.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
      glow.material.opacity = 0.4 + Math.sin(t * 3.1) * 0.12;
      coils.forEach((c, i) => {
        c.rotation.z = t * (i % 2 ? 0.2 : -0.2);
      });
      if (Math.sin(t * 2.7) > 0.96) {
        const pts = [];
        const start = new THREE.Vector3(0, 3.85, 0);
        for (let i = 0; i < 7; i++) {
          const p = start.clone();
          p.x += (Math.random() - 0.5) * 1.4;
          p.y += (Math.random() - 0.5) * 1.2;
          p.z += (Math.random() - 0.5) * 1.4;
          pts.push(p);
        }
        idleArc.geometry.dispose();
        idleArc.geometry = new THREE.BufferGeometry().setFromPoints(pts);
        arcMat.opacity = 0.9;
      } else {
        arcMat.opacity *= 0.85;
      }
    },
    fireAnim() {
      core.scale.setScalar(1.5);
    },
  };
  return g;
}

/* ------------------------------------------------------------------ */
const BUILDERS = { arrow: buildArrow, cannon: buildCannon, frost: buildFrost, arcane: buildArcane, tesla: buildTesla };

export function buildTower(type) {
  const g = BUILDERS[type]();
  const decor = g.userData.levelDecor;
  const BASE = 1.4;
  g.userData.baseScale = BASE;
  g.userData.setLevel = (level) => {
    decor.d2.forEach((o) => (o.visible = level >= 2));
    decor.d3.forEach((o) => (o.visible = level >= 3));
    g.scale.setScalar(BASE * (1 + (level - 1) * 0.045));
  };
  g.userData.setLevel(1);
  return g;
}
