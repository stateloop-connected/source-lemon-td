import * as THREE from 'three';
import { C } from './palette.js';
import { rr, TAU, mulberry32, irr } from '../core/utils.js';
import { toon, metal, addOutline, glowMat, makeGlow, glowTexture, worldTexture } from './materials.js';
import { rbox, mergeColored, jitterGeometry, ribbonGeometry, starGeometry } from './geometry.js';
import {
  makeTree, makePine, makeRock, makeBush, makeCloud, makeMushroom, makeCrystal, makeTorch, makeFlag,
} from './props.js';

/* ------------------------------------------------------------------ *
 *  Sky
 * ------------------------------------------------------------------ */
function buildSky(scene) {
  const sunDir = new THREE.Vector3(0.42, 0.66, 0.32).normalize();
  const geo = new THREE.SphereGeometry(420, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x2b8ad6) },
      uHorizon: { value: new THREE.Color(0x9fd8f5) },
      uLow: { value: new THREE.Color(0xdff1ff) },
      uSunColor: { value: new THREE.Color(0xfff1c0) },
      uSunDir: { value: sunDir },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uLow, uSunColor, uSunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uTop, smoothstep(0.02, 0.62, h));
        col = mix(uLow, col, smoothstep(-0.32, 0.06, h));
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunColor * (pow(sd, 320.0) * 2.2 + pow(sd, 10.0) * 0.22);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  scene.add(sky);

  const sun = makeGlow(0xfff0b8, 90, 0.9);
  sun.position.copy(sunDir).multiplyScalar(330);
  scene.add(sun);

  return { sunDir, sky };
}

/* ------------------------------------------------------------------ *
 *  Island
 * ------------------------------------------------------------------ */
function islandShape(rng, rx, rz) {
  const shape = new THREE.Shape();
  const N = 110;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const wob = 1 + 0.045 * Math.sin(a * 3 + 1.1) + 0.03 * Math.sin(a * 5 + 2.4) + 0.018 * Math.sin(a * 9 + 0.6);
    const x = Math.cos(a) * rx * wob;
    const y = Math.sin(a) * rz * wob;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function buildIsland(scene, rng) {
  const group = new THREE.Group();
  const shape = islandShape(rng, 64, 47);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 9,
    bevelEnabled: true,
    bevelThickness: 2.4,
    bevelSize: 2.1,
    bevelSegments: 3,
    curveSegments: 1,
    steps: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.max.y, 0);

  const grassTex = worldTexture('grass');
  const grassMat = toon(0xffffff, { map: grassTex });
  const stoneTex = worldTexture('stone');
  const cliffMat = toon(0xc6d0dd, { map: worldTexture('cliff') });

  const island = new THREE.Mesh(geo, [grassMat, cliffMat]);
  island.receiveShadow = true;
  island.castShadow = true;
  group.add(island);

  // rocky underside
  const under = [];
  for (let i = 0; i < 16; i++) {
    const a = rr(rng, 0, TAU);
    const rad = rr(rng, 0, 46);
    const h = rr(rng, 6, 22);
    const cone = new THREE.ConeGeometry(rr(rng, 3, 8), h, 5, 1);
    cone.rotateX(Math.PI);
    cone.translate(Math.cos(a) * rad, -10 - h * 0.4, Math.sin(a) * rad * 0.72);
    under.push({ geo: jitterGeometry(cone, 0.18), color: i % 3 ? 0x7d8798 : 0x6b7586 });
  }
  const underMesh = new THREE.Mesh(mergeColored(under), toon(0xffffff, { vertexColors: true, flat: true }));
  underMesh.castShadow = true;
  group.add(underMesh);

  // cliff face rubble
  for (let i = 0; i < 18; i++) {
    const a = rr(rng, 0, TAU);
    const rx = 63;
    const rz = 46;
    const rock = makeRock(rng, { scale: rr(rng, 1.2, 3.2), color: 0x8b95a5 });
    rock.position.set(Math.cos(a) * rx * rr(rng, 0.94, 1.02), rr(rng, -5, -1.5), Math.sin(a) * rz * rr(rng, 0.94, 1.02));
    rock.rotation.set(rr(rng, -0.4, 0.4), rng() * TAU, rr(rng, -0.4, 0.4));
    group.add(rock);
  }

  // jagged rim spikes hanging past the cliff, sells the floating-island silhouette
  const rimParts = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + rr(rng, -0.06, 0.06);
    const h = rr(rng, 7, 17);
    const rad = rr(rng, 55, 64);
    const spike = new THREE.ConeGeometry(rr(rng, 2.6, 5.4), h, 5, 1);
    spike.rotateX(Math.PI);
    spike.translate(Math.cos(a) * rad, -11 - h * 0.35, Math.sin(a) * rad * 0.72);
    rimParts.push({ geo: jitterGeometry(spike, 0.2), color: i % 3 ? 0x6c7688 : 0x596475 });
  }
  const rimMesh = new THREE.Mesh(mergeColored(rimParts), toon(0xffffff, { vertexColors: true, flat: true }));
  rimMesh.castShadow = true;
  rimMesh.receiveShadow = true;
  group.add(rimMesh);

  // hanging roots
  const rootParts = [];
  for (let i = 0; i < 10; i++) {
    const a = rr(rng, 0, TAU);
    const h = rr(rng, 8, 16);
    const root = new THREE.ConeGeometry(rr(rng, 0.5, 1.1), h, 4);
    root.rotateX(Math.PI);
    root.translate(Math.cos(a) * rr(rng, 30, 58), -12 - h * 0.45, Math.sin(a) * rr(rng, 30, 42));
    rootParts.push({ geo: jitterGeometry(root, 0.15), color: 0x5f4530 });
  }
  const rootMesh = new THREE.Mesh(mergeColored(rootParts), toon(0xffffff, { vertexColors: true, flat: true }));
  rootMesh.castShadow = true;
  group.add(rootMesh);

  scene.add(group);
  return group;
}

/* ------------------------------------------------------------------ *
 *  Road
 * ------------------------------------------------------------------ */
function buildRoad(scene, path, rng) {
  const group = new THREE.Group();

  const border = new THREE.Mesh(
    ribbonGeometry(path.curve, path.width + 1.5, 460, 0.035, 500),
    toon(0x9c7244, { map: worldTexture('dirt') })
  );
  border.receiveShadow = true;
  group.add(border);

  const road = new THREE.Mesh(
    ribbonGeometry(path.curve, path.width, 460, 0.07, 7),
    toon(0xd9ab72, { map: worldTexture('dirt') })
  );
  road.receiveShadow = true;
  group.add(road);

  // stones along both edges
  const stoneGeo = new THREE.DodecahedronGeometry(0.42, 0);
  const stoneMat = toon(C.stoneLight, { flat: true });
  const count = 150;
  const inst = new THREE.InstancedMesh(stoneGeo, stoneMat, count);
  inst.castShadow = true;
  inst.receiveShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    const t = (i / count) * 0.99 + 0.005;
    path.pointAt(t, p);
    path.tangentAt(t, tan);
    side.crossVectors(up, tan).normalize();
    const dir = i % 2 ? 1 : -1;
    p.addScaledVector(side, dir * (path.half + rr(rng, 0.15, 0.75)));
    p.y = rr(rng, 0.1, 0.25);
    q.setFromEuler(new THREE.Euler(rng() * TAU, rng() * TAU, rng() * TAU));
    const sc = rr(rng, 0.55, 1.35);
    s.set(sc, sc * rr(rng, 0.6, 1.0), sc);
    m.compose(p, q, s);
    inst.setMatrixAt(i, m);
    p.set(0, 0, 0);
  }
  inst.instanceMatrix.needsUpdate = true;
  group.add(inst);

  // a few flat paving stones on the road
  const pave = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.55, 0.07, 6), toon(0xc7b393, { flat: true }), 60);
  pave.receiveShadow = true;
  for (let i = 0; i < 60; i++) {
    const t = rng();
    path.pointAt(t, p);
    path.tangentAt(t, tan);
    side.crossVectors(up, tan).normalize();
    p.addScaledVector(side, rr(rng, -path.half * 0.7, path.half * 0.7));
    p.y = 0.1;
    q.setFromEuler(new THREE.Euler(0, rng() * TAU, 0));
    const sc = rr(rng, 0.5, 1.0);
    s.set(sc, 1, sc);
    m.compose(p, q, s);
    pave.setMatrixAt(i, m);
    p.set(0, 0, 0);
  }
  pave.instanceMatrix.needsUpdate = true;
  group.add(pave);

  scene.add(group);
  return group;
}

/* ------------------------------------------------------------------ *
 *  Pond
 * ------------------------------------------------------------------ */
function buildPond(scene, rng, pos) {
  const group = new THREE.Group();
  group.position.set(pos.x, 0, pos.z);

  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float d = length(p) * 2.0;
        float w = sin(d * 26.0 - uTime * 1.7) * 0.5 + 0.5;
        float w2 = sin(p.x * 30.0 + uTime * 1.1) * cos(p.y * 24.0 - uTime * 0.9) * 0.5 + 0.5;
        vec3 col = mix(vec3(0.10, 0.52, 0.70), vec3(0.38, 0.86, 0.94), w * 0.55 + w2 * 0.25);
        col = mix(col, vec3(0.78, 0.97, 1.0), smoothstep(0.78, 1.0, d) * 0.75);
        gl_FragColor = vec4(col, 0.9);
      }`,
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(7.2, 48), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.09;
  group.add(water);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(7.3, 0.55, 6, 44), toon(C.stone, { flat: true }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.16;
  rim.receiveShadow = true;
  group.add(rim);

  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + rng() * 0.12;
    const r = 7.2 + rr(rng, -0.2, 0.7);
    const rock = makeRock(rng, { scale: rr(rng, 0.3, 0.8) });
    rock.position.set(Math.cos(a) * r, 0.12, Math.sin(a) * r);
    group.add(rock);
  }
  for (let i = 0; i < 5; i++) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(rr(rng, 0.5, 0.9), rr(rng, 0.5, 0.9), 0.06, 8), toon(0x5fae55, { flat: true }));
    pad.position.set(rr(rng, -4, 4), 0.14, rr(rng, -4, 4));
    pad.rotation.y = rng() * TAU;
    group.add(pad);
  }
  // reeds
  for (let i = 0; i < 14; i++) {
    const a = rng() * TAU;
    const r = rr(rng, 6.6, 7.6);
    const reed = new THREE.Mesh(new THREE.ConeGeometry(0.06, rr(rng, 0.9, 1.5), 4), toon(0x6fbf52));
    reed.position.set(Math.cos(a) * r, 0.7, Math.sin(a) * r);
    reed.rotation.z = rr(rng, -0.18, 0.18);
    group.add(reed);
  }

  group.userData.waterMat = waterMat;
  scene.add(group);
  return group;
}

/* ------------------------------------------------------------------ *
 *  Portal & gate
 * ------------------------------------------------------------------ */
function buildPortal(scene, path, rng) {
  const g = new THREE.Group();
  const p = path.start.clone();
  const t = path.tangentAt(0);
  g.position.copy(p).addScaledVector(t, -2.5);
  g.lookAt(p.clone().addScaledVector(t, 4).setY(0));

  const stoneMat = toon(0x59607a, { flat: true });
  for (const sx of [-1, 1]) {
    const pillar = new THREE.Mesh(rbox(1.15, 4.4, 1.15, 0.14), stoneMat);
    pillar.position.set(sx * 2.1, 2.2, 0);
    pillar.castShadow = pillar.receiveShadow = true;
    addOutline(pillar, 0.05);
    g.add(pillar);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.2, 4), toon(0x7a4f9e, { flat: true }));
    cap.position.set(sx * 2.1, 5.1, 0);
    cap.rotation.y = Math.PI / 4;
    cap.castShadow = true;
    g.add(cap);
  }
  const lintel = new THREE.Mesh(rbox(6.6, 1.0, 1.2, 0.16), stoneMat);
  lintel.position.y = 4.55;
  lintel.castShadow = true;
  addOutline(lintel, 0.05);
  g.add(lintel);

  const keystone = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), toon(0xb07bff, { flat: true, emissive: 0x8a4dff, emissiveIntensity: 0.8 }));
  keystone.position.set(0, 5.55, 0);
  g.add(keystone);
  const keyGlow = makeGlow(0xb47bff, 4.2, 0.55);
  keyGlow.position.copy(keystone.position);
  g.add(keyGlow);

  const portalMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float a = atan(p.y, p.x);
        float sw = sin(a * 3.0 + r * 9.0 - uTime * 3.2) * 0.5 + 0.5;
        float sw2 = sin(a * 5.0 - r * 14.0 + uTime * 2.0) * 0.5 + 0.5;
        vec3 col = mix(vec3(0.22, 0.08, 0.45), vec3(0.65, 0.35, 1.0), sw * 0.7 + sw2 * 0.3);
        col += vec3(0.5, 0.25, 1.0) * smoothstep(0.82, 1.0, r) * 0.8;
        float alpha = smoothstep(1.0, 0.82, r) * 0.92;
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 4.1), portalMat);
  disc.position.y = 2.35;
  disc.renderOrder = 3;
  g.add(disc);

  for (const sx of [-1, 1]) {
    const torch = makeTorch();
    torch.position.set(sx * 3.4, 0, 1.2);
    g.add(torch);
    g.userData['torch' + sx] = torch;
  }

  // floating runes
  const runes = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), glowMat(0xc79bff, 1.5, { transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    const a = (i / 7) * TAU;
    rune.position.set(Math.cos(a) * 2.4, 2.4 + Math.sin(a * 2) * 0.6, 0.15);
    rune.rotation.z = a;
    runes.add(rune);
  }
  g.add(runes);
  g.userData.runes = runes;
  g.userData.portalMat = portalMat;
  g.userData.key = keystone;

  scene.add(g);
  return g;
}

function buildGate(scene, path, rng) {
  const g = new THREE.Group();
  const p = path.end.clone();
  const t = path.tangentAt(1);
  g.position.copy(p);
  g.lookAt(p.clone().addScaledVector(t, -6).setY(0));

  const stone = toon(0xb7c0cf, { flat: true, map: worldTexture('stone') });

  const wall = new THREE.Mesh(rbox(13, 4.6, 2.0, 0.18), stone);
  wall.position.y = 2.3;
  wall.castShadow = wall.receiveShadow = true;
  addOutline(wall, 0.06);
  g.add(wall);

  const gateArch = new THREE.Group();
  const top = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.42, 6, 18, Math.PI), stone);
  top.position.y = 2.4;
  const left = new THREE.Mesh(rbox(0.7, 2.4, 0.8, 0.1), stone);
  left.position.set(-1.8, 1.2, 0);
  const right = left.clone();
  right.position.x = 1.8;
  gateArch.add(top, left, right);
  g.add(gateArch);

  const door = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 3.0), toon(0x3c2b4e, { emissive: 0x2a1640, emissiveIntensity: 0.4 }));
  door.position.set(0, 1.5, -0.35);
  g.add(door);

  for (const sx of [-1, 1]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.75, 6.2, 10), stone);
    tower.position.set(sx * 6.1, 3.1, 0);
    tower.castShadow = tower.receiveShadow = true;
    addOutline(tower, 0.06);
    g.add(tower);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.4, 10), toon(0x8f5bd6, { flat: true }));
    roof.position.set(sx * 6.1, 7.4, 0);
    roof.castShadow = true;
    addOutline(roof, 0.05);
    g.add(roof);

    const trim = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.13, 6, 16), metal(C.gold, { metalness: 0.5, roughness: 0.3 }));
    trim.rotation.x = Math.PI / 2;
    trim.position.set(sx * 6.1, 6.2, 0);
    g.add(trim);

    const flag = makeFlag(sx > 0 ? 0xff5c6e : 0x6fe8ff);
    flag.position.set(sx * 6.1, 8.5, 0);
    g.add(flag);
    g.userData['flag' + sx] = flag;

    const torch = makeTorch();
    torch.position.set(sx * 3.1, 0, 1.4);
    g.add(torch);
    g.userData['gateTorch' + sx] = torch;
  }

  const star = new THREE.Mesh(starGeometry(0.7, 0.3, 5, 0.16), toon(C.gold, { emissive: C.gold, emissiveIntensity: 0.35 }));
  star.position.set(0, 5.1, 1.05);
  g.add(star);

  scene.add(g);
  return g;
}

/* ------------------------------------------------------------------ *
 *  Scatter
 * ------------------------------------------------------------------ */
function scatter(rng, count, makeFn, testFn, minDist = 4) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard < count * 40) {
    guard++;
    const a = rng() * TAU;
    const rf = 0.72 + rng() * 0.26;
    const x = Math.cos(a) * 61 * rf;
    const z = Math.sin(a) * 44 * rf;
    if (!testFn(x, z)) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < minDist)) continue;
    out.push({ x, z, obj: makeFn(rng) });
  }
  return out;
}

function buildFlora(scene, path, rng, blockers, pondPos) {
  const group = new THREE.Group();
  const clear = (x, z) => {
    if (!path.isOnIsland(x, z, 4)) return false;
    if (path.distanceTo(x, z) < path.half + 2.4) return false;
    if (Math.hypot(x - pondPos.x, z - pondPos.z) < 9.5) return false;
    if (Math.hypot(x - path.start.x, z - path.start.z) < 10) return false;
    if (Math.hypot(x - path.end.x, z - path.end.z) < 11) return false;
    return true;
  };

  const trees = scatter(rng, 22, (r) => makeTree(r, { scale: rr(r, 1.0, 1.6) }), clear, 7);
  const pines = scatter(rng, 12, (r) => makePine(r, { scale: rr(r, 1.0, 1.7) }), clear, 7);
  const bushes = scatter(rng, 20, (r) => makeBush(r), clear, 4);
  const rocks = scatter(rng, 16, (r) => makeRock(r, { scale: rr(r, 0.7, 1.8) }), clear, 5);

  for (const t of [...trees, ...pines]) {
    t.obj.position.set(t.x, 0, t.z);
    group.add(t.obj);
    blockers.push({ x: t.x, z: t.z, r: t.obj.userData.radius * 0.95 });
  }
  for (const b of bushes) {
    b.obj.position.set(b.x, 0, b.z);
    group.add(b.obj);
    blockers.push({ x: b.x, z: b.z, r: 1.1 });
  }
  for (const r of rocks) {
    r.obj.position.set(r.x, 0, r.z);
    group.add(r.obj);
    blockers.push({ x: r.x, z: r.z, r: r.obj.userData.radius * 0.9 });
  }

  // mushrooms & crystals
  for (let i = 0; i < 16; i++) {
    const a = rng() * TAU;
    const rf = 0.4 + rng() * 0.5;
    const x = Math.cos(a) * 58 * rf;
    const z = Math.sin(a) * 42 * rf;
    if (!clear(x, z) || path.distanceTo(x, z) < path.half + 2.5) continue;
    const m = makeMushroom(rng);
    m.position.set(x, 0, z);
    group.add(m);
  }
  for (let i = 0; i < 5; i++) {
    const a = rng() * TAU;
    const x = Math.cos(a) * 56 * rr(rng, 0.85, 0.98);
    const z = Math.sin(a) * 42 * rr(rng, 0.85, 0.98);
    if (!clear(x, z)) continue;
    const cr = makeCrystal(rng, i % 2 ? C.cyan : C.purple);
    cr.position.set(x, 0.2, z);
    group.add(cr);
  }

  // instanced grass tufts
  const tuftGeo = makeTuftGeometry();
  const tuftMat = toon(0xffffff, { vertexColors: true, flat: true });
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, 1300);
  tufts.castShadow = false;
  tufts.receiveShadow = false;
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const v = new THREE.Vector3();
  const col = new THREE.Color();
  let placed = 0;
  for (let i = 0; i < 4200 && placed < 1300; i++) {
    const a = rng() * TAU;
    const rf = Math.sqrt(rng()) * 0.98;
    const x = Math.cos(a) * 61 * rf;
    const z = Math.sin(a) * 43 * rf;
    if (!path.isOnIsland(x, z, 1.5)) continue;
    if (path.distanceTo(x, z) < path.half + 0.2) continue;
    if (Math.hypot(x - pondPos.x, z - pondPos.z) < 8) continue;
    v.set(x, 0, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * TAU);
    const sc = rr(rng, 0.7, 1.6);
    s.set(sc, sc * rr(rng, 0.8, 1.3), sc);
    mtx.compose(v, q, s);
    tufts.setMatrixAt(placed, mtx);
    col.setHSL(0.26 + rr(rng, -0.02, 0.03), rr(rng, 0.35, 0.55), rr(rng, 0.42, 0.56));
    tufts.setColorAt(placed, col);
    placed++;
  }
  tufts.count = placed;
  tufts.instanceMatrix.needsUpdate = true;
  if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
  group.add(tufts);

  // flowers
  const headGeo = makeFlowerHeadGeometry();
  const headMat = toon(0xffffff, { vertexColors: true, flat: true });
  const heads = new THREE.InstancedMesh(headGeo, headMat, 380);
  const stemGeo = makeFlowerStemGeometry();
  const stems = new THREE.InstancedMesh(stemGeo, toon(0xffffff, { vertexColors: true, flat: true }), 380);
  const fcols = [0xff8fa8, 0xffe27a, 0xc79bff, 0xffffff, 0xff9f5c, 0x9fe8ff];
  let f = 0;
  for (let i = 0; i < 2200 && f < 380; i++) {
    const a = rng() * TAU;
    const rf = 0.15 + Math.sqrt(rng()) * 0.82;
    const x = Math.cos(a) * 60 * rf;
    const z = Math.sin(a) * 43 * rf;
    if (!path.isOnIsland(x, z, 3)) continue;
    if (path.distanceTo(x, z) < path.half + 0.6) continue;
    if (Math.hypot(x - pondPos.x, z - pondPos.z) < 8.4) continue;
    const sc = rr(rng, 1.0, 2.1);
    v.set(x, 0.02, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * TAU);
    s.set(sc, sc, sc);
    mtx.compose(v, q, s);
    heads.setMatrixAt(f, mtx);
    stems.setMatrixAt(f, mtx);
    col.set(fcols[irr(rng, 0, fcols.length - 1)]);
    heads.setColorAt(f, col);
    f++;
  }
  heads.count = f;
  stems.count = f;
  heads.instanceMatrix.needsUpdate = true;
  stems.instanceMatrix.needsUpdate = true;
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
  group.add(heads, stems);

  scene.add(group);
  return group;
}

/* ---------- shared little geometries ---------- */
function makeTuftGeometry() {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.4;
    const h = 0.34 + i * 0.08;
    const blade = new THREE.ConeGeometry(0.05, h, 4, 1);
    blade.translate(0, h / 2, 0);
    blade.rotateZ(Math.cos(a) * 0.3);
    blade.rotateX(Math.sin(a) * 0.3);
    blade.translate(Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06);
    parts.push({ geo: blade, color: 0xffffff });
  }
  return mergeColored(parts);
}

function makeFlowerHeadGeometry() {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const petal = new THREE.SphereGeometry(0.06, 5, 4);
    petal.scale(1.4, 0.5, 0.8);
    petal.translate(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08);
    parts.push({ geo: petal, color: 0xffffff });
  }
  const core = new THREE.SphereGeometry(0.055, 6, 5);
  parts.push({ geo: core, color: 0xffe27a });
  return mergeColored(parts);
}

function makeFlowerStemGeometry() {
  const stem = new THREE.CylinderGeometry(0.012, 0.018, 0.36, 4);
  stem.translate(0, 0.18, 0);
  return mergeColored([{ geo: stem, color: 0x5ba746 }]);
}

/* ------------------------------------------------------------------ *
 *  Ambient life
 * ------------------------------------------------------------------ */
function buildClouds(scene, rng) {
  const clouds = [];
  for (let i = 0; i < 18; i++) {
    const c = makeCloud(rng);
    const a = rng() * TAU;
    const r = rr(rng, 70, 190);
    c.position.set(Math.cos(a) * r, rr(rng, -40, -8), Math.sin(a) * r);
    c.scale.setScalar(rr(rng, 1.6, 3.6));
    c.userData.speed = rr(rng, 0.25, 0.8);
    c.userData.bob = rng() * TAU;
    clouds.push(c);
    scene.add(c);
  }
  return clouds;
}

function buildDistantIslands(scene, rng) {
  const list = [];
  const spots = [
    [-210, 26, -150, 1.0],
    [230, 6, -170, 0.8],
    [-160, -21, 200, 0.7],
    [180, 38, 160, 0.55],
  ];
  for (const [x, y, z, sc] of spots) {
    const g = new THREE.Group();
    const rock = new THREE.Mesh(
      jitterGeometry(new THREE.ConeGeometry(26, 48, 7), 0.2),
      toon(0x8892a8, { flat: true })
    );
    rock.rotation.x = Math.PI;
    rock.position.y = -20;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(26, 24, 4, 9), toon(C.grassDark, { flat: true }));
    top.position.y = 3;
    g.add(rock, top);
    for (let i = 0; i < 4; i++) {
      const tree = makePine(rng, { scale: rr(rng, 1.6, 2.6) });
      tree.position.set(rr(rng, -16, 16), 4, rr(rng, -14, 14));
      g.add(tree);
    }
    g.position.set(x, y, z);
    g.scale.setScalar(sc);
    list.push(g);
    scene.add(g);
  }
  return list;
}

function buildBirds(scene, rng) {
  const birds = [];
  const mat = toon(0x2b3548, { side: THREE.DoubleSide, flat: true });
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 4), mat);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const wings = [];
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.32), mat);
      wing.position.set(s * 0.5, 0, -0.05);
      wing.rotation.z = s * 0.2;
      g.add(wing);
      wings.push({ mesh: wing, side: s });
    }
    g.userData = {
      wings,
      radius: rr(rng, 40, 90),
      height: rr(rng, 26, 46),
      speed: rr(rng, 0.06, 0.14) * (rng() > 0.5 ? 1 : -1),
      phase: rng() * TAU,
      flap: rr(rng, 4, 7),
    };
    birds.push(g);
    scene.add(g);
  }
  return birds;
}

function buildFireflies(scene, rng) {
  const N = 90;
  const pos = new Float32Array(N * 3);
  const seeds = [];
  for (let i = 0; i < N; i++) {
    const a = rng() * TAU;
    const r = Math.sqrt(rng()) * 55;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.75;
    const y = rr(rng, 1.5, 9);
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    seeds.push({ x, y, z, p: rng() * TAU, s: rr(rng, 0.2, 0.7) });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.55,
    map: glowTexture(),
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: 0xfff3b0,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.userData.seeds = seeds;
  scene.add(points);
  return points;
}

/* ------------------------------------------------------------------ *
 *  Set dressing: camp, ruins, fences, path torches
 * ------------------------------------------------------------------ */
function buildDressing(scene, path, rng) {
  const group = new THREE.Group();
  const torches = [];
  const wood = toon(0x7a4f27, { flat: true });
  const cloth = toon(0xe0cfa5, { flat: true });
  const clothRed = toon(0xb8424f, { flat: true });

  // ---- camp ----
  const camp = new THREE.Group();
  camp.position.set(-49, 0, 6);
  const tentBodies = [cloth, clothRed];
  for (let i = 0; i < 2; i++) {
    const tent = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.7, 4), tentBodies[i]);
    body.position.y = 1.35;
    body.rotation.y = Math.PI / 4 + i * 0.28;
    body.castShadow = body.receiveShadow = true;
    addOutline(body, 0.045);
    tent.add(body);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.3, 5), wood);
    pole.position.y = 1.65;
    tent.add(pole);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3), toon(0x3c2b4e));
    door.position.set(0, 0.68, 1.02);
    door.rotation.x = -0.1;
    tent.add(door);
    tent.position.set(i * 4.4 - 2.2, 0, i * 1.2);
    camp.add(tent);
  }

  const fire = new THREE.Group();
  fire.position.set(1.2, 0, 3.4);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 0), toon(0x7d8798, { flat: true }));
    s.position.set(Math.cos(a) * 1.05, 0.16, Math.sin(a) * 1.05);
    s.castShadow = true;
    fire.add(s);
  }
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.3, 5), toon(0x6b4426));
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * TAU;
    log.position.y = 0.22;
    fire.add(log);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 1.2, 6),
    toon(0xffb03a, { emissive: 0xff7a1a, emissiveIntensity: 1.9, flat: true })
  );
  flame.position.y = 0.85;
  const fireGlow = makeGlow(0xffa04a, 3.6, 0.5);
  fireGlow.position.y = 0.85;
  fire.add(flame, fireGlow);
  fire.userData.flame = flame;
  fire.userData.glow = fireGlow;
  torches.push(fire);
  camp.add(fire);

  for (let i = 0; i < 3; i++) {
    const crate = new THREE.Mesh(rbox(0.7, 0.6, 0.7, 0.06), toon(0x9c6a3c, { flat: true }));
    crate.position.set(-3.2 + i * 0.8, 0.3, 4.2 + (i % 2) * 0.5);
    crate.rotation.y = rng() * TAU;
    crate.castShadow = crate.receiveShadow = true;
    addOutline(crate, 0.03);
    camp.add(crate);
  }
  const banner = makeFlag(0xff5c6e);
  banner.position.set(-3.6, 0, 1.2);
  camp.add(banner);

  group.add(camp);

  // ---- ruins ----
  const ruins = new THREE.Group();
  ruins.position.set(2, 0, 31);
  const stoneMat = toon(0xb7c0cf, { flat: true, map: worldTexture('stone') });
  for (let i = 0; i < 3; i++) {
    const h = [3.6, 2.2, 3.0][i];
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, h, 8), stoneMat);
    col.position.set(-3.4 + i * 3.2, h / 2, (i % 2) * 1.4);
    col.rotation.z = i === 1 ? 0.06 : 0;
    col.castShadow = col.receiveShadow = true;
    addOutline(col, 0.045);
    ruins.add(col);
    const cap = new THREE.Mesh(rbox(1.6, 0.34, 1.6, 0.08), stoneMat);
    cap.position.set(col.position.x, h + 0.1, col.position.z);
    cap.rotation.y = rng() * 0.4;
    cap.castShadow = true;
    ruins.add(cap);
    if (i === 2) {
      const fallen = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 2.4, 8), stoneMat);
      fallen.rotation.z = Math.PI / 2;
      fallen.rotation.y = 0.5;
      fallen.position.set(-1.0, 0.6, 2.2);
      fallen.castShadow = fallen.receiveShadow = true;
      ruins.add(fallen);
    }
  }
  for (let i = 0; i < 6; i++) {
    const moss = new THREE.Mesh(new THREE.SphereGeometry(0.5, 7, 4), toon(C.leafC, { flat: true }));
    moss.scale.set(1.2, 0.25, 1.0);
    moss.position.set(rr(rng, -4.5, 5), 0.12, rr(rng, -1.5, 3));
    ruins.add(moss);
  }
  group.add(ruins);

  // ---- fences ----
  const fenceParts = [];
  const addFence = (t0, t1, sideSign) => {
    let prev = null;
    const N = 13;
    for (let i = 0; i <= N; i++) {
      const t = t0 + ((t1 - t0) * i) / N;
      const p = path.pointAt(t);
      const tan = path.tangentAt(t);
      const x = p.x + tan.z * sideSign * (path.half + 1.5);
      const z = p.z - tan.x * sideSign * (path.half + 1.5);
      const post = new THREE.BoxGeometry(0.17, 1.05, 0.17);
      post.translate(x, 0.53, z);
      fenceParts.push({ geo: post, color: 0x7a4f27 });
      if (prev) {
        const dx = x - prev.x;
        const dz = z - prev.z;
        const len = Math.hypot(dx, dz);
        const ang = Math.atan2(dx, dz);
        for (const h of [0.82, 0.46]) {
          const rail = new THREE.BoxGeometry(0.09, 0.11, len);
          rail.rotateY(ang);
          rail.translate((x + prev.x) / 2, h, (z + prev.z) / 2);
          fenceParts.push({ geo: rail, color: 0x99653a });
        }
      }
      prev = { x, z };
    }
  };
  addFence(0.035, 0.19, -1);
  addFence(0.53, 0.66, 1);
  addFence(0.78, 0.9, -1);
  if (fenceParts.length) {
    const fenceMesh = new THREE.Mesh(mergeColored(fenceParts), toon(0xffffff, { vertexColors: true, flat: true }));
    fenceMesh.castShadow = true;
    fenceMesh.receiveShadow = true;
    group.add(fenceMesh);
  }

  // ---- torches along the road ----
  const torchTs = [0.075, 0.17, 0.28, 0.4, 0.52, 0.63, 0.75, 0.86];
  torchTs.forEach((t, i) => {
    const p = path.pointAt(t);
    const tan = path.tangentAt(t);
    const side = i % 2 ? 1 : -1;
    const x = p.x + tan.z * side * (path.half + 1.9);
    const z = p.z - tan.x * side * (path.half + 1.9);
    const torch = makeTorch();
    torch.position.set(x, 0, z);
    torch.rotation.y = rng() * TAU;
    group.add(torch);
    torches.push(torch);
  });

  scene.add(group);
  return { group, torches };
}

/* ------------------------------------------------------------------ *
 *  Public
 * ------------------------------------------------------------------ */
export function buildWorld(scene, path, seed = 20261018) {
  const rng = mulberry32(seed);
  const blockers = [];
  const pondPos = new THREE.Vector3(-26, 0, 31);

  const sky = buildSky(scene);
  buildIsland(scene, rng);
  buildRoad(scene, path, rng);
  const pond = buildPond(scene, rng, pondPos);
  blockers.push({ x: pondPos.x, z: pondPos.z, r: 8.6 });

  const portal = buildPortal(scene, path, rng);
  const gate = buildGate(scene, path, rng);

  buildFlora(scene, path, rng, blockers, pondPos);
  const dressing = buildDressing(scene, path, rng);
  blockers.push({ x: -49, z: 6, r: 6.5 });
  blockers.push({ x: 2, z: 31, r: 5.6 });
  const clouds = buildClouds(scene, rng);
  buildDistantIslands(scene, rng);
  const birds = buildBirds(scene, rng);
  const fireflies = buildFireflies(scene, rng);

  const torches = [...dressing.torches];
  for (const g of [portal, gate]) {
    g.traverse((o) => { if (o.userData && o.userData.flame) torches.push(o); });
  }

  const state = {
    blockers,
    pondPos,
    portal,
    gate,
    update(dt, t) {
      for (const c of clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 230) c.position.x = -230;
        c.position.y += Math.sin(t * 0.3 + c.userData.bob) * dt * 0.12;
      }
      for (const b of birds) {
        const u = b.userData;
        u.phase += u.speed * dt;
        b.position.set(
          Math.cos(u.phase) * u.radius,
          u.height + Math.sin(u.phase * 2.2) * 2.2,
          Math.sin(u.phase) * u.radius * 0.72
        );
        b.rotation.y = -u.phase + (u.speed > 0 ? Math.PI : 0);
        const flap = Math.sin(t * u.flap + u.phase) * 0.55;
        for (const w of u.wings) {
          w.mesh.rotation.z = w.side * (0.15 + flap * 0.55);
          w.mesh.rotation.x = flap * 0.2;
        }
      }
      portal.userData.portalMat.uniforms.uTime.value = t;
      portal.userData.runes.rotation.z = t * 0.5;
      portal.userData.key.rotation.y = t * 1.2;
      pond.userData.waterMat.uniforms.uTime.value = t;

      for (const tr of torches) {
        const f = 0.85 + Math.sin(t * 11 + tr.position.x) * 0.12 + Math.sin(t * 23.7) * 0.05;
        tr.userData.flame.scale.set(f, 0.9 + f * 0.25, f);
        tr.userData.glow.material.opacity = 0.35 + f * 0.25;
      }

      const fp = fireflies.geometry.attributes.position;
      const seeds = fireflies.userData.seeds;
      for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i];
        fp.setXYZ(
          i,
          s.x + Math.sin(t * 0.35 + s.p) * 1.6,
          s.y + Math.sin(t * 0.6 + s.p * 2.1) * 0.9,
          s.z + Math.cos(t * 0.3 + s.p) * 1.4
        );
      }
      fp.needsUpdate = true;
    },
  };

  return state;
}
