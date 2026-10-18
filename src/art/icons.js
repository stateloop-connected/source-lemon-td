import * as THREE from 'three';
import { buildTower } from './towers.js';

/**
 * Render a small transparent PNG of each tower for the shop cards.
 * Uses a throw-away renderer so the main scene is untouched.
 */
export function renderTowerIcons(types) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (e) {
    return {};
  }
  const size = 192;
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xe4f6ff, 0x7d9552, 2.4));
  const key = new THREE.DirectionalLight(0xfff4d8, 3.2);
  key.position.set(6, 10, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fd4ff, 1.8);
  rim.position.set(-7, 5, -6);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 120);
  camera.position.set(8.4, 8.8, 11.4);
  camera.lookAt(0, 2.55, 0);

  const out = {};
  for (const type of types) {
    const tower = buildTower(type);
    tower.position.y = -0.3;
    tower.rotation.y = -0.42;
    tower.traverse((o) => {
      if (o.isMesh && !o.userData.isOutline) {
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    scene.add(tower);
    renderer.render(scene, camera);
    try {
      out[type] = renderer.domElement.toDataURL('image/png');
    } catch (e) {
      out[type] = '';
    }
    scene.remove(tower);
  }

  renderer.dispose();
  renderer.forceContextLoss?.();
  return out;
}
