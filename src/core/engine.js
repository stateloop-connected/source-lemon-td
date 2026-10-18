import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { C } from '../art/palette.js';
import { clamp, smoothstep } from './utils.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec2 p = vUv - 0.5;
      float vig = smoothstep(0.92, 0.28, length(p) * 1.45);
      c *= mix(1.0 - 0.26 * uVignette, 1.0, vig);
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 1.07);
      c *= vec3(1.02, 1.0, 0.975);
      float grain = fract(sin(dot(vUv * vec2(1341.7, 817.3) + uTime * 0.37, vec2(12.9898, 78.233))) * 43758.5453);
      c += (grain - 0.5) * 0.011;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.86;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(C.fog, 170, 360);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.5, 900);
    this.camera.position.set(2, 62, 104);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0, -2);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.enablePan = false;
    this.controls.minDistance = 28;
    this.controls.maxDistance = 180;
    this.controls.minPolarAngle = 0.18;
    this.controls.maxPolarAngle = 1.18;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.85;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.45;
    this.controls.update();

    this.lights();
    this.environment();
    this.composer();
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.usePost = false;
    this.shakeAmt = 0;
    this.fly = null;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this._camSave = new THREE.Vector3();
  }

  lights() {
    const hemi = new THREE.HemisphereLight(0xd6edff, 0x3e5a2c, 0.62);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2ce, 2.3);
    sun.position.set(62, 96, 58);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -88;
    sun.shadow.camera.right = 88;
    sun.shadow.camera.top = 82;
    sun.shadow.camera.bottom = -82;
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 280;
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 4;
    sun.target.position.set(0, 0, 0);
    this.scene.add(sun, sun.target);
    this.sun = sun;

    const fill = new THREE.DirectionalLight(0x9fc8ff, 0.32);
    fill.position.set(-70, 46, -80);
    this.scene.add(fill);

    const amb = new THREE.AmbientLight(0x9ab8d8, 0.1);
    this.scene.add(amb);
  }

  environment() {
    const cv = document.createElement('canvas');
    cv.width = 1024;
    cv.height = 512;
    const g = cv.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#3f9be0');
    grd.addColorStop(0.34, '#8fd5f7');
    grd.addColorStop(0.52, '#dff3ff');
    grd.addColorStop(0.6, '#cfe3b8');
    grd.addColorStop(1, '#6f8a4c');
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 512);
    const sun = g.createRadialGradient(700, 170, 0, 700, 170, 150);
    sun.addColorStop(0, 'rgba(255,248,214,1)');
    sun.addColorStop(0.3, 'rgba(255,236,170,0.55)');
    sun.addColorStop(1, 'rgba(255,236,170,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, 1024, 512);

    const tex = new THREE.CanvasTexture(cv);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromEquirectangular(tex).texture;
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.4;
    tex.dispose();
    pmrem.dispose();
  }

  composer() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.32, 0.45, 1.05
    );
    this.composer.addPass(this.bloom);

    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  shake(amount) {
    this.shakeAmt = Math.min(1.4, Math.max(this.shakeAmt, amount));
  }

  flyTo(position, target, duration = 1.6, onDone = null) {
    this.fly = {
      from: this.camera.position.clone(),
      to: position.clone(),
      targetFrom: this.controls.target.clone(),
      targetTo: target.clone(),
      t: 0,
      dur: duration,
      onDone,
    };
    this.controls.enabled = false;
  }

  pointerToGround(clientX, clientY, y = 0) {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, out) ? out : null;
  }

  update(dt) {
    this.elapsed += dt;
    if (this.fly) {
      const f = this.fly;
      f.t += dt;
      const k = smoothstep(0, 1, clamp(f.t / f.dur, 0, 1));
      this.camera.position.lerpVectors(f.from, f.to, k);
      this.controls.target.lerpVectors(f.targetFrom, f.targetTo, k);
      this.controls.update();
      if (f.t >= f.dur) {
        this.fly = null;
        this.controls.enabled = true;
        f.onDone?.();
      }
    } else {
      this.controls.update();
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.8);
    this.grade.uniforms.uTime.value += dt;
  }

  render() {
    this._camSave.copy(this.camera.position);
    if (this.shakeAmt > 0.001) {
      const a = this.shakeAmt * 0.55;
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a * 0.7;
      this.camera.position.z += (Math.random() - 0.5) * a;
    }
    if (this.usePost) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    this.camera.position.copy(this._camSave);
  }
}
