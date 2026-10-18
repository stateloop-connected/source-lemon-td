import * as THREE from 'three';
import { C } from './palette.js';

/* ------------------------------------------------------------------ *
 *  Cel shading ramp
 * ------------------------------------------------------------------ */
const RAMP = [0.42, 0.68, 0.86, 1.0];
const rampData = new Uint8Array(RAMP.length * 4);
RAMP.forEach((v, i) => {
  const c = Math.round(v * 255);
  rampData[i * 4 + 0] = c;
  rampData[i * 4 + 1] = c;
  rampData[i * 4 + 2] = c;
  rampData[i * 4 + 3] = 255;
});
export const gradientMap = new THREE.DataTexture(rampData, RAMP.length, 1, THREE.RGBAFormat);
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;
gradientMap.needsUpdate = true;

/* ------------------------------------------------------------------ *
 *  Materials
 * ------------------------------------------------------------------ */
export function toon(color, opts = {}) {
  const m = new THREE.MeshToonMaterial({
    color,
    gradientMap,
    flatShading: opts.flat ?? false,
    map: opts.map ?? null,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    vertexColors: opts.vertexColors ?? false,
  });
  if (opts.emissive !== undefined) {
    m.emissive = new THREE.Color(opts.emissive);
    m.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  return m;
}

export function metal(color = C.metal, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: opts.metalness ?? 0.62,
    roughness: opts.roughness ?? 0.34,
    envMapIntensity: opts.envMapIntensity ?? 1.15,
    flatShading: opts.flat ?? false,
    map: opts.map ?? null,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
}

export function glowMat(color, intensity = 2.0, opts = {}) {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({
    color: c,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    blending: opts.blending ?? THREE.NormalBlending,
    depthWrite: opts.depthWrite ?? true,
    side: opts.side ?? THREE.FrontSide,
    fog: opts.fog ?? true,
  });
}

/* ------------------------------------------------------------------ *
 *  Inverted-hull outlines
 * ------------------------------------------------------------------ */
const outlineMats = new Map();
function outlineMaterial(thickness, color) {
  const key = `${thickness.toFixed(3)}_${color}`;
  let m = outlineMats.get(key);
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: {
        uThickness: { value: thickness },
        uColor: { value: new THREE.Color(color) },
      },
      vertexShader: /* glsl */ `
        uniform float uThickness;
        void main() {
          vec3 p = position + normal * uThickness;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        void main() { gl_FragColor = vec4(uColor, 1.0); }`,
      side: THREE.BackSide,
    });
    outlineMats.set(key, m);
  }
  return m;
}

export function addOutline(mesh, thickness = 0.05, color = C.outline) {
  if (!mesh || !mesh.geometry || !mesh.geometry.attributes.normal) return null;
  let geo = mesh.geometry;
  if (Array.isArray(mesh.material)) {
    geo = geo.clone();
    geo.clearGroups();
  }
  const o = new THREE.Mesh(geo, outlineMaterial(thickness, color));
  o.castShadow = false;
  o.receiveShadow = false;
  o.userData.isOutline = true;
  o.frustumCulled = false;
  mesh.add(o);
  return o;
}

/* ------------------------------------------------------------------ *
 *  Glow sprites & textures
 * ------------------------------------------------------------------ */
let _glowTex = null;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0.0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.28)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(cv);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

export function makeGlow(color, size = 2, opacity = 0.9) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  return s;
}

/* ------------------------------------------------------------------ *
 *  Procedural canvas textures
 * ------------------------------------------------------------------ */
function cssRgba(hex, alpha) {
  const h = new THREE.Color(hex).getHexString(THREE.SRGBColorSpace);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function noiseTexture({
  base = '#7cc45a',
  blobs = ['#6fb44e', '#8fd66a'],
  count = 110,
  size = 256,
  speckle = 0.055,
  repeat = 1,
  streaks = 0,
  dots = 0,
} = {}) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);

  for (let i = 0; i < count; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = size * (0.025 + Math.random() * 0.11);
    const col = blobs[i % blobs.length];
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, cssRgba(col, 0.34 + Math.random() * 0.26));
    grd.addColorStop(1, cssRgba(col, 0));
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  if (streaks) {
    g.lineWidth = 1;
    for (let i = 0; i < streaks; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const h = 20 + Math.random() * 70;
      const grd = g.createLinearGradient(x, y, x, y + h);
      grd.addColorStop(0, 'rgba(0,0,0,0.18)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.strokeStyle = grd;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (Math.random() - 0.5) * 6, y + h);
      g.stroke();
    }
  }

  if (dots) {
    for (let i = 0; i < dots; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 1 + Math.random() * 2.6;
      g.fillStyle = cssRgba(blobs[i % blobs.length], 0.5);
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  if (speckle > 0) {
    const img = g.getImageData(0, 0, size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * speckle * 255;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    g.putImageData(img, 0, 0);
  }

  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

const texCache = new Map();
export function worldTexture(name) {
  if (texCache.has(name)) return texCache.get(name);
  let t;
  if (name === 'grass') {
    t = noiseTexture({
      base: '#63b534',
      blobs: ['#54a02b', '#84c94e', '#448c24', '#9ade66'],
      count: 190, speckle: 0.06, dots: 900, repeat: 0.085,
    });
  } else if (name === 'dirt') {
    t = noiseTexture({
      base: '#c6945a',
      blobs: ['#b07f45', '#d9aa6c', '#a5783f'],
      count: 150, speckle: 0.075, dots: 600, repeat: 1,
    });
  } else if (name === 'stone') {
    t = noiseTexture({
      base: '#98a3b2',
      blobs: ['#8b96a6', '#aab4c2', '#7e8898'],
      count: 120, speckle: 0.07, repeat: 1, streaks: 40,
    });
  } else if (name === 'cliff') {
    t = noiseTexture({
      base: '#8f9aab',
      blobs: ['#77828f', '#a6b0bf', '#68727f', '#b8c2cf'],
      count: 260, speckle: 0.09, repeat: 0.14, streaks: 140,
    });
  } else if (name === 'wood') {
    t = noiseTexture({
      base: '#b0793f',
      blobs: ['#9c6734', '#c78d53', '#8a582b'],
      count: 60, speckle: 0.05, repeat: 1, streaks: 30,
    });
  } else {
    t = noiseTexture({ base: '#ffffff', blobs: ['#dddddd'], count: 20 });
  }
  texCache.set(name, t);
  return t;
}

export function applyShadows(root, cast = true, receive = true) {
  root.traverse((o) => {
    if (o.isMesh && !o.userData.isOutline) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
}
