import * as THREE from 'three';
import { C } from './palette.js';
import { TAU, clamp } from '../core/utils.js';
import { toon, metal, glowMat, addOutline, makeGlow, worldTexture } from './materials.js';
import { rbox } from './geometry.js';

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

const skinGreen = () => toon(0x7ec45a, { flat: true });
const eyeWhite = () => toon(0xffffff, { flat: true });
const eyeBlack = () => toon(0x241a33, { flat: true });

/* ------------------------------------------------------------------ *
 *  SLIME
 * ------------------------------------------------------------------ */
function buildSlime() {
  const g = new THREE.Group();
  const bodyMat = toon(0x8fdc5c, { flat: false, emissive: 0x2f6a14, emissiveIntensity: 0.12 });
  const body = part(g, new THREE.SphereGeometry(0.66, 20, 16), bodyMat, 0, 0.58, 0, { outline: 0.055 });
  body.scale.set(1.06, 0.86, 1.0);

  const belly = part(g, new THREE.SphereGeometry(0.5, 16, 12), toon(0xb6f087, { flat: false, emissive: 0x4d8a22, emissiveIntensity: 0.1 }), 0, 0.5, 0.1, { cast: false });
  belly.scale.set(0.9, 0.65, 0.7);

  const shine = part(g, new THREE.SphereGeometry(0.16, 8, 6), toon(0xffffff, { transparent: true, opacity: 0.45 }), -0.22, 0.9, 0.28, { cast: false });
  shine.scale.set(1.3, 0.7, 0.5);

  const eyes = new THREE.Group();
  for (const sx of [-1, 1]) {
    part(eyes, new THREE.SphereGeometry(0.15, 10, 8), eyeWhite(), sx * 0.22, 0.68, 0.5, { outline: 0.015, cast: false });
    part(eyes, new THREE.SphereGeometry(0.075, 8, 6), eyeBlack(), sx * 0.23, 0.68, 0.62, { cast: false });
    part(eyes, new THREE.SphereGeometry(0.025, 6, 5), eyeWhite(), sx * 0.18, 0.72, 0.66, { cast: false });
  }
  g.add(eyes);

  const mouth = part(g, new THREE.TorusGeometry(0.12, 0.025, 4, 10, Math.PI), eyeBlack(), 0, 0.5, 0.58, { rx: Math.PI, cast: false });

  g.userData.animate = (t, dt, speed) => {
    const hop = Math.abs(Math.sin(t * 6.2 * speed));
    const squash = 1 - hop * 0.12;
    body.scale.set(1.06 * (1 + hop * 0.06), 0.86 * squash, 1.0 * (1 + hop * 0.06));
    body.position.y = 0.58 + hop * 0.28;
    eyes.position.y = hop * 0.28;
    mouth.position.y = 0.5 + hop * 0.28;
    belly.scale.set(0.9, 0.65 * squash, 0.7);
    belly.position.y = 0.5 + hop * 0.26;
  };
  g.userData.height = 1.5;
  return g;
}

/* ------------------------------------------------------------------ *
 *  GOBLIN
 * ------------------------------------------------------------------ */
function buildGoblin() {
  const g = new THREE.Group();
  const skin = skinGreen();
  const cloth = toon(0x8a5a2f, { flat: true });

  const body = new THREE.Group();
  body.position.y = 0.95;
  g.add(body);

  const torso = part(body, new THREE.CapsuleGeometry(0.33, 0.62, 4, 8), skin, 0, 0.1, 0, { outline: 0.03 });
  part(body, new THREE.ConeGeometry(0.5, 0.42, 8, 1, true), cloth, 0, -0.32, 0, { ry: 0.3 });

  const head = new THREE.Group();
  head.position.y = 0.72;
  body.add(head);
  part(head, new THREE.SphereGeometry(0.38, 16, 12), skin, 0, 0.05, 0, { outline: 0.035 });
  const earGeo = new THREE.ConeGeometry(0.14, 0.55, 5);
  for (const sx of [-1, 1]) {
    const ear = part(head, earGeo, skin, sx * 0.36, 0.08, -0.02);
    ear.rotation.z = sx * -(Math.PI / 2 - 0.25);
    ear.rotation.y = sx * 0.35;
  }
  part(head, new THREE.ConeGeometry(0.1, 0.3, 6), skin, 0, -0.02, 0.36, { rx: Math.PI / 2 });
  for (const sx of [-1, 1]) {
    part(head, new THREE.SphereGeometry(0.1, 8, 6), toon(0xffe066, { flat: true }), sx * 0.15, 0.08, 0.32, { cast: false });
    part(head, new THREE.SphereGeometry(0.045, 6, 5), eyeBlack(), sx * 0.15, 0.08, 0.41, { cast: false });
  }
  part(head, new THREE.BoxGeometry(0.22, 0.035, 0.04), eyeBlack(), 0, -0.15, 0.36, { cast: false });

  const arms = [];
  const legs = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.38, 0.38, 0);
    body.add(arm);
    part(arm, new THREE.CapsuleGeometry(0.1, 0.38, 3, 6), skin, 0, -0.26, 0, { outline: 0.015 });
    part(arm, new THREE.SphereGeometry(0.13, 8, 6), skin, 0, -0.5, 0);
    arms.push({ g: arm, sx });

    const leg = new THREE.Group();
    leg.position.set(sx * 0.18, 0.42, 0);
    g.add(leg);
    part(leg, new THREE.CapsuleGeometry(0.11, 0.34, 3, 6), skin, 0, -0.2, 0, { outline: 0.015 });
    part(leg, new THREE.BoxGeometry(0.22, 0.12, 0.32), cloth, 0, -0.42, 0.05);
    legs.push({ g: leg, sx });
  }

  // club in right hand
  const club = new THREE.Group();
  part(club, new THREE.CylinderGeometry(0.05, 0.07, 0.95, 5), toon(0x7a4f27), 0, -0.1, 0);
  part(club, new THREE.DodecahedronGeometry(0.2, 0), toon(0x8a5a34, { flat: true }), 0, 0.42, 0);
  club.position.set(0.38, 0.85, 0.05);
  club.rotation.z = 0.5;
  g.add(club);

  g.userData.animate = (t, dt, speed) => {
    const p = t * 8.5 * speed;
    legs[0].g.rotation.x = Math.sin(p) * 0.72;
    legs[1].g.rotation.x = -Math.sin(p) * 0.72;
    arms[0].g.rotation.x = -Math.sin(p) * 0.6;
    arms[1].g.rotation.x = Math.sin(p) * 0.4;
    body.position.y = 0.95 + Math.abs(Math.sin(p)) * 0.06;
    body.rotation.z = Math.sin(p) * 0.035;
    head.rotation.y = Math.sin(p * 0.5) * 0.12;
    club.rotation.z = 0.5 + Math.sin(p * 0.9) * 0.12;
  };
  g.userData.height = 1.9;
  return g;
}

/* ------------------------------------------------------------------ *
 *  BAT
 * ------------------------------------------------------------------ */
function buildBat() {
  const g = new THREE.Group();
  const fur = toon(0x5a4270, { flat: true });
  const wingMat = toon(0x473256, { side: THREE.DoubleSide, flat: true });

  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.55;
  g.add(bodyGroup);
  part(bodyGroup, new THREE.SphereGeometry(0.32, 14, 10), fur, 0, 0, 0, { outline: 0.035 }).scale.set(1, 0.9, 1.1);

  const head = new THREE.Group();
  head.position.set(0, 0.22, 0.16);
  bodyGroup.add(head);
  part(head, new THREE.SphereGeometry(0.24, 12, 10), fur, 0, 0, 0, { outline: 0.025 });
  for (const sx of [-1, 1]) {
    const ear = part(head, new THREE.ConeGeometry(0.1, 0.3, 4), fur, sx * 0.14, 0.22, -0.02);
    ear.rotation.z = sx * -0.25;
    part(head, new THREE.SphereGeometry(0.055, 6, 5), toon(0xff4d5e, { emissive: 0xff2233, emissiveIntensity: 1.4 }), sx * 0.1, 0.04, 0.2, { cast: false });
  }
  part(head, new THREE.ConeGeometry(0.035, 0.11, 4), toon(0xffffff), -0.06, -0.12, 0.2, { rx: Math.PI, cast: false });
  part(head, new THREE.ConeGeometry(0.035, 0.11, 4), toon(0xffffff), 0.06, -0.12, 0.2, { rx: Math.PI, cast: false });

  const wings = [];
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.35, 0.22, 0.95, 0.06);
  shape.quadraticCurveTo(0.7, -0.08, 0.8, -0.34);
  shape.quadraticCurveTo(0.5, -0.18, 0.32, -0.3);
  shape.quadraticCurveTo(0.2, -0.12, 0, 0);
  const wingGeo = new THREE.ShapeGeometry(shape);
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.2, 0.02, -0.02);
    pivot.scale.x = sx;
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.castShadow = true;
    pivot.add(wing);
    bodyGroup.add(pivot);
    wings.push({ pivot, sx });
  }

  g.userData.animate = (t, dt, speed) => {
    const flap = Math.sin(t * 14 * speed);
    for (const w of wings) {
      w.pivot.rotation.z = w.sx * (flap * 0.6);
      w.pivot.rotation.y = w.sx * flap * 0.22;
    }
    bodyGroup.position.y = 0.55 + Math.sin(t * 5 * speed) * 0.06;
    head.rotation.x = Math.sin(t * 3) * 0.08;
  };
  g.userData.height = 1.3;
  return g;
}

/* ------------------------------------------------------------------ *
 *  KNIGHT
 * ------------------------------------------------------------------ */
function buildKnight() {
  const g = new THREE.Group();
  const armor = metal(0xa9b4c4, { metalness: 0.65, roughness: 0.35, flat: true });
  const armorDark = metal(0x6f7a8a, { metalness: 0.6, roughness: 0.4, flat: true });
  const cloth = toon(0xb03a4a, { flat: true });

  const body = new THREE.Group();
  body.position.y = 1.1;
  g.add(body);

  part(body, new THREE.CapsuleGeometry(0.42, 0.72, 4, 10), armor, 0, 0.05, 0, { outline: 0.035 });
  part(body, rbox(0.72, 0.66, 0.24, 0.08), armorDark, 0, 0.16, 0.32);
  part(body, new THREE.TorusGeometry(0.45, 0.06, 5, 18), cloth, 0, -0.42, 0, { rx: Math.PI / 2 });

  const head = new THREE.Group();
  head.position.y = 0.72;
  body.add(head);
  part(head, new THREE.SphereGeometry(0.35, 14, 12), armor, 0, 0.05, 0, { outline: 0.03 });
  part(head, rbox(0.5, 0.13, 0.3, 0.05), armorDark, 0, 0.02, 0.25);
  part(head, new THREE.BoxGeometry(0.4, 0.035, 0.05), toon(0x1b1626, { emissive: 0x6fe8ff, emissiveIntensity: 0.7 }), 0, 0.04, 0.31, { cast: false });
  const plume = part(head, new THREE.ConeGeometry(0.15, 0.7, 6), cloth, 0, 0.45, -0.06);
  plume.rotation.x = -0.3;

  for (const sx of [-1, 1]) {
    part(body, new THREE.SphereGeometry(0.24, 10, 8), armorDark, sx * 0.46, 0.32, 0, { outline: 0.02 });
  }

  const arms = [];
  const legs = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.46, 0.28, 0);
    body.add(arm);
    part(arm, new THREE.CapsuleGeometry(0.12, 0.44, 3, 6), armor, 0, -0.3, 0, { outline: 0.015 });
    part(arm, new THREE.SphereGeometry(0.15, 8, 6), armorDark, 0, -0.58, 0);
    arms.push({ g: arm, sx });

    const leg = new THREE.Group();
    leg.position.set(sx * 0.2, 0.45, 0);
    g.add(leg);
    part(leg, new THREE.CapsuleGeometry(0.14, 0.4, 3, 6), armor, 0, -0.22, 0, { outline: 0.015 });
    part(leg, rbox(0.26, 0.2, 0.38, 0.05), armorDark, 0, -0.48, 0.06);
    legs.push({ g: leg, sx });
  }

  // shield (left)
  const shield = new THREE.Group();
  part(shield, rbox(0.72, 0.9, 0.12, 0.14), toon(0xd9c08a, { flat: true }), 0, 0, 0, { outline: 0.02 });
  part(shield, new THREE.CircleGeometry(0.17, 5), toon(C.gold, { emissive: C.gold, emissiveIntensity: 0.3 }), 0, 0.03, 0.07, { cast: false });
  shield.position.set(-0.55, 0.95, 0.28);
  shield.rotation.y = 0.25;
  g.add(shield);

  // sword (right)
  const sword = new THREE.Group();
  part(sword, new THREE.BoxGeometry(0.09, 1.05, 0.18), metal(0xdfe6ef, { metalness: 0.8, roughness: 0.2 }), 0, 0.55, 0);
  part(sword, new THREE.BoxGeometry(0.42, 0.09, 0.12), metal(C.gold, { metalness: 0.6 }), 0, 0.02, 0);
  part(sword, new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), toon(0x6b4426), 0, -0.15, 0);
  sword.position.set(0.62, 0.72, 0.24);
  sword.rotation.z = -0.08;
  g.add(sword);

  g.userData.animate = (t, dt, speed) => {
    const p = t * 5.4 * speed;
    legs[0].g.rotation.x = Math.sin(p) * 0.45;
    legs[1].g.rotation.x = -Math.sin(p) * 0.45;
    arms[0].g.rotation.x = -Math.sin(p) * 0.22;
    arms[1].g.rotation.x = Math.sin(p) * 0.22;
    body.position.y = 1.1 + Math.abs(Math.sin(p)) * 0.035;
    body.rotation.z = Math.sin(p) * 0.025;
    shield.position.y = 0.95 + Math.sin(p * 0.7) * 0.03;
    sword.rotation.z = -0.08 + Math.sin(p * 0.5) * 0.04;
  };
  g.userData.height = 2.1;
  return g;
}

/* ------------------------------------------------------------------ *
 *  SHAMAN
 * ------------------------------------------------------------------ */
function buildShaman() {
  const g = new THREE.Group();
  const robe = toon(0x7a4fb8, { flat: true });
  const robeDark = toon(0x4d2f7a, { flat: true });
  const trim = toon(0xffcf5c, { emissive: 0x8a5a00, emissiveIntensity: 0.4, flat: true });

  const body = new THREE.Group();
  body.position.y = 0.95;
  g.add(body);

  part(body, new THREE.ConeGeometry(0.62, 1.5, 8), robe, 0, -0.05, 0, { outline: 0.035 });
  part(body, new THREE.TorusGeometry(0.6, 0.05, 4, 18), trim, 0, -0.72, 0, { rx: Math.PI / 2 });
  part(body, new THREE.TorusGeometry(0.42, 0.04, 4, 16), trim, 0, 0.42, 0, { rx: Math.PI / 2 });

  const head = new THREE.Group();
  head.position.y = 0.72;
  body.add(head);
  part(head, new THREE.SphereGeometry(0.4, 14, 12), robeDark, 0, 0.02, 0, { outline: 0.03 });
  part(head, new THREE.SphereGeometry(0.29, 12, 10), toon(0x251a38), 0, -0.02, 0.12);
  const cone = part(head, new THREE.ConeGeometry(0.3, 0.62, 7), robe, 0, 0.4, 0);
  cone.rotation.x = -0.06;
  for (const sx of [-1, 1]) {
    part(head, new THREE.SphereGeometry(0.06, 6, 5), glowMat(0x6fe8ff, 2.2), sx * 0.1, 0.0, 0.34, { cast: false });
  }

  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.42, 0.3, 0);
    body.add(arm);
    part(arm, new THREE.CapsuleGeometry(0.11, 0.4, 3, 6), robe, 0, -0.24, 0, { outline: 0.015 });
    part(arm, new THREE.SphereGeometry(0.1, 8, 6), toon(0x6fae55), 0, -0.48, 0);
    arm.rotation.z = sx * -0.4;
    arms.push({ g: arm, sx });
  }

  const staff = new THREE.Group();
  part(staff, new THREE.CylinderGeometry(0.045, 0.06, 1.9, 6), toon(0x6b4426), 0, 0.1, 0);
  const orb = part(staff, new THREE.IcosahedronGeometry(0.16, 0), glowMat(0x8fffa8, 2.2), 0, 1.12, 0, { cast: false });
  const orbGlow = makeGlow(0x7dffa0, 1.6, 0.55);
  orbGlow.position.y = 1.12;
  staff.add(orbGlow);
  staff.position.set(0.55, 0.15, 0.12);
  staff.rotation.z = -0.12;
  body.add(staff);

  g.userData.animate = (t, dt, speed) => {
    body.position.y = 0.95 + Math.sin(t * 2.2) * 0.08;
    body.rotation.z = Math.sin(t * 1.6) * 0.03;
    head.rotation.y = Math.sin(t * 0.8) * 0.18;
    orbGlow.material.opacity = 0.4 + Math.sin(t * 3.2) * 0.16;
    orb.scale.setScalar(1 + Math.sin(t * 3.2) * 0.1);
    staff.rotation.z = -0.12 + Math.sin(t * 1.4) * 0.04;
    arms[0].g.rotation.x = Math.sin(t * 1.4) * 0.1;
  };
  g.userData.height = 2.2;
  return g;
}

/* ------------------------------------------------------------------ *
 *  OGRE
 * ------------------------------------------------------------------ */
function buildOgre() {
  const g = new THREE.Group();
  const skin = toon(0x8a9a54, { flat: true });
  const skinDark = toon(0x6d7c3f, { flat: true });
  const belly = toon(0xb7c07a, { flat: true });
  const leather = toon(0x6b4426, { flat: true });
  const iron = metal(0x6f7a88, { metalness: 0.6, roughness: 0.45, flat: true });

  const body = new THREE.Group();
  body.position.y = 2.0;
  g.add(body);

  const torso = part(body, new THREE.SphereGeometry(1.05, 16, 12), skin, 0, 0.1, 0, { outline: 0.05 });
  torso.scale.set(1.12, 1.0, 0.95);
  const gut = part(body, new THREE.SphereGeometry(0.72, 12, 10), belly, 0, -0.22, 0.48);
  gut.scale.set(1.0, 0.9, 0.65);
  part(body, new THREE.TorusGeometry(0.95, 0.1, 5, 18), leather, 0, -0.62, 0, { rx: Math.PI / 2 });

  const head = new THREE.Group();
  head.position.set(0, 0.92, 0.12);
  body.add(head);
  part(head, new THREE.SphereGeometry(0.6, 16, 12), skin, 0, 0, 0, { outline: 0.04 }).scale.set(1.05, 0.95, 0.95);
  part(head, new THREE.SphereGeometry(0.34, 10, 8), skinDark, 0, -0.26, 0.3).scale.set(1.2, 0.6, 0.8);
  for (const sx of [-1, 1]) {
    const tusk = part(head, new THREE.ConeGeometry(0.08, 0.34, 5), toon(0xfff2d0), sx * 0.24, -0.24, 0.52);
    tusk.rotation.x = -0.2;
    tusk.rotation.z = sx * -0.2;
    const horn = part(head, new THREE.ConeGeometry(0.1, 0.42, 5), toon(0xd9c08a), sx * 0.42, 0.38, 0.02);
    horn.rotation.z = sx * -0.5;
    part(head, new THREE.SphereGeometry(0.07, 6, 5), toon(0xff4444, { emissive: 0xff2222, emissiveIntensity: 1.1 }), sx * 0.2, 0.14, 0.5, { cast: false });
  }
  part(head, new THREE.SphereGeometry(0.11, 8, 6), skinDark, 0, 0.0, 0.58);

  // ears
  for (const sx of [-1, 1]) {
    const ear = part(head, new THREE.ConeGeometry(0.14, 0.34, 4), skin, sx * 0.58, 0.05, 0);
    ear.rotation.z = sx * -1.2;
  }

  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.95, 0.45, 0);
    body.add(arm);
    part(arm, new THREE.CapsuleGeometry(0.26, 0.95, 4, 8), skin, 0, -0.55, 0, { outline: 0.03 });
    part(arm, new THREE.SphereGeometry(0.3, 10, 8), skinDark, 0, -1.15, 0);
    arm.rotation.z = sx * -0.14;
    arms.push({ g: arm, sx });
  }

  // shoulder plate
  part(body, rbox(0.72, 0.42, 0.66, 0.12), iron, -0.92, 0.72, 0);
  // club
  const club = new THREE.Group();
  part(club, new THREE.CylinderGeometry(0.12, 0.16, 1.9, 6), leather, 0, 0, 0, { outline: 0.02 });
  part(club, new THREE.DodecahedronGeometry(0.42, 0), toon(0x7a5a3a, { flat: true }), 0, 1.05, 0, { outline: 0.03 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const spike = part(club, new THREE.ConeGeometry(0.06, 0.24, 4), iron, Math.cos(a) * 0.42, 1.05, Math.sin(a) * 0.42);
    spike.rotation.z = -Math.cos(a) * 1.1;
    spike.rotation.x = Math.sin(a) * 1.1;
  }
  club.position.set(1.15, 0.35, 0.1);
  club.rotation.z = -0.25;
  body.add(club);

  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.42, 1.2, 0);
    g.add(leg);
    part(leg, new THREE.CapsuleGeometry(0.27, 0.5, 4, 8), skin, 0, -0.35, 0, { outline: 0.025 });
    part(leg, rbox(0.44, 0.26, 0.62, 0.08), leather, 0, -0.72, 0.12);
    legs.push({ g: leg, sx });
  }

  g.userData.animate = (t, dt, speed) => {
    const p = t * 3.6 * speed;
    legs[0].g.rotation.x = Math.sin(p) * 0.32;
    legs[1].g.rotation.x = -Math.sin(p) * 0.32;
    body.position.y = 2.0 + Math.abs(Math.sin(p)) * 0.07;
    body.rotation.z = Math.sin(p) * 0.04;
    head.rotation.y = Math.sin(t * 0.6) * 0.14;
    club.rotation.z = -0.25 + Math.sin(p * 0.8) * 0.1;
    arms[0].g.rotation.x = Math.sin(p) * 0.16;
    arms[1].g.rotation.x = -Math.sin(p) * 0.16;
  };
  g.userData.height = 3.8;
  return g;
}

/* ------------------------------------------------------------------ */
const BUILDERS = {
  slime: buildSlime,
  goblin: buildGoblin,
  bat: buildBat,
  knight: buildKnight,
  shaman: buildShaman,
  ogre: buildOgre,
};

export function buildEnemyModel(type) {
  return BUILDERS[type]();
}
