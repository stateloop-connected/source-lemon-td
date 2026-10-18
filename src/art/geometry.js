import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { mergeGeometries };

export function rbox(w, h, d, r = 0.1, segments = 2) {
  return new RoundedBoxGeometry(w, h, d, segments, Math.min(r, Math.min(w, h, d) * 0.49));
}

export function merge(geos) {
  return mergeGeometries(geos, false);
}

/**
 * Merge geometries into one non-indexed geometry with per-vertex colour.
 * One draw call for a whole prop.
 */
export function mergeColored(parts) {
  const geos = parts.map(({ geo, color }) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const count = g.attributes.position.count;
    const c = new THREE.Color(color);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  });
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return merged;
}

/** Organic radial jitter that keeps shared vertices welded. */
export function jitterGeometry(geo, amount = 0.12, freq = 2.2) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n =
      Math.sin(v.x * freq + v.y * 1.7) * Math.cos(v.z * freq * 0.9 + v.x * 0.8) * 0.6 +
      Math.sin(v.y * freq * 1.9 + v.z * 1.1) * 0.4;
    const s = 1 + n * amount;
    pos.setXYZ(i, v.x * s, v.y * s, v.z * s);
  }
  g.computeVertexNormals();
  return g;
}

/** A handful of petals + stem, used as instanced flower heads. */
export function flowerHeadGeometry() {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const petal = new THREE.SphereGeometry(0.055, 5, 4);
    petal.scale(1.35, 0.55, 0.85);
    petal.translate(Math.cos(a) * 0.075, 0, Math.sin(a) * 0.075);
    parts.push({ geo: petal, color: 0xffffff });
  }
  const core = new THREE.SphereGeometry(0.055, 6, 5);
  parts.push({ geo: core, color: 0xffe27a });
  return mergeColored(parts);
}

export function flowerStemGeometry() {
  const stem = new THREE.CylinderGeometry(0.012, 0.018, 0.34, 4);
  stem.translate(0, 0.17, 0);
  const leaf = new THREE.SphereGeometry(0.05, 4, 3);
  leaf.scale(1.6, 0.35, 0.7);
  leaf.translate(0.05, 0.14, 0);
  return mergeColored([
    { geo: stem, color: 0x5ba746 },
    { geo: leaf, color: 0x6fbf52 },
  ]);
}

export function grassTuftGeometry() {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const h = 0.34 + i * 0.09;
    const blade = new THREE.ConeGeometry(0.045, h, 4, 1);
    blade.translate(0, h / 2, 0);
    blade.rotateZ(Math.cos(a) * 0.34);
    blade.rotateX(Math.sin(a) * 0.34);
    blade.translate(Math.cos(a) * 0.07, 0, Math.sin(a) * 0.07);
    parts.push({ geo: blade, color: 0x7cc45a });
  }
  return mergeColored(parts);
}

/** Flat ribbon from a curve — used for the road. */
export function ribbonGeometry(curve, width, segments, y, uvScale = 1) {
  const pos = [];
  const uv = [];
  const idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const side = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    side.crossVectors(up, t).normalize();
    const w = width * 0.5;
    pos.push(p.x + side.x * w, y, p.z + side.z * w);
    pos.push(p.x - side.x * w, y, p.z - side.z * w);
    const v = (u * curve.getLength()) / uvScale;
    uv.push(v, 0, v, 1);
    if (i < segments) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function starGeometry(outer = 1, inner = 0.45, points = 5, depth = 0.12) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.4,
    bevelSize: depth * 0.35,
    bevelSegments: 1,
    curveSegments: 2,
  });
}

/** Soft cartoon blob shadow for props that should not use real shadows. */
export function blobShadowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, 'rgba(20,12,30,0.55)');
  grd.addColorStop(0.55, 'rgba(20,12,30,0.28)');
  grd.addColorStop(1, 'rgba(20,12,30,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
