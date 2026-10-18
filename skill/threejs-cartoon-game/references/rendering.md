# Rendering reference

## Renderer

```js
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;   // ACES also works; Neutral keeps saturation
renderer.toneMappingExposure = 0.86;
renderer.outputColorSpace = THREE.SRGBColorSpace;
```

No `EffectComposer` by default. Add a CSS vignette:

```css
.vignette {
  position: fixed; inset: 0; pointer-events: none; z-index: 2;
  background:
    radial-gradient(ellipse 78% 72% at 50% 46%, rgba(16,8,34,0) 42%, rgba(16,8,34,.18) 78%, rgba(12,6,26,.42) 100%),
    linear-gradient(180deg, rgba(70,120,190,.14), rgba(70,120,190,0) 26%);
}
```

## Tone mapping and custom shaders (the wash bug)

Three applies tone mapping only when it renders to the screen. `RenderPass` renders to an HDR target, so built-in materials output **linear** values. `OutputPass` then tone-maps and encodes sRGB.

A custom `ShaderMaterial` has no `tonemapping_fragment` / `colorspace_fragment`. Its output is whatever the shader writes. A sky shader that outputs `vec3(0.66, 0.85, 0.96)` is treated as linear HDR and becomes near-white after `OutputPass`. Direct rendering displays the same value as sRGB, so the two paths look different.

Rules:

1. Do not mix direct render and composer in one project.
2. If you use the composer, convert authored sRGB colors to linear (`color.convertSRGBToLinear()`) and keep emissive values above 1 only where you want bloom.
3. Debug with a URL switch: `?post=0` renders directly, `?bloom=0`, `?out=0` disables `OutputPass`, `?grade=0`. Compare screenshots.
4. Pixel-probe the result. Do not judge color from a resized preview.

## Toon ramp

```js
const steps = [0.42, 0.68, 0.86, 1.0];
const data = new Uint8Array(steps.length * 4);
steps.forEach((v, i) => {
  const c = Math.round(v * 255);
  data.set([c, c, c, 255], i * 4);
});
const ramp = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.generateMipmaps = false;
ramp.needsUpdate = true;

const mat = new THREE.MeshToonMaterial({
  color, gradientMap: ramp, map, flatShading: true,
  transparent, opacity, vertexColors,
});
```

`MeshToonMaterial` supports `map`, `emissive`, `vertexColors`, `flatShading`. It ignores `envMap`; use `MeshStandardMaterial` for metal and rely on `scene.environment`.

## Environment map for metal

Build a 1024×512 canvas gradient (sky top → horizon → ground), turn it into a `CanvasTexture` with `EquirectangularReflectionMapping`, run it through `PMREMGenerator.fromEquirectangular`, then set `scene.environment` and `scene.environmentIntensity = 0.4`. Dispose the PMREM generator and the source texture.

## Outline

```js
const outlineMat = new THREE.ShaderMaterial({
  uniforms: { uThickness: { value: 0.045 }, uColor: { value: new THREE.Color(0x241a33) } },
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

function addOutline(mesh, thickness = 0.05) {
  let geo = mesh.geometry;
  if (Array.isArray(mesh.material)) { geo = geo.clone(); geo.clearGroups(); }
  const o = new THREE.Mesh(geo, outlineMat.clone()); // clone only if thickness varies
  o.castShadow = o.receiveShadow = false;
  o.frustumCulled = false;
  mesh.add(o);
}
```

Thickness is in world units. Use 0.04–0.06 for bodies, 0.015–0.025 for small parts, none for rivets. Cache materials per thickness.

## Sky dome

Sphere radius 400, `BackSide`, `depthWrite:false`, `fog:false`, `renderOrder:-100`. Fragment: mix three colors by `normalize(vDir).y`, add `pow(max(dot(dir, sunDir),0), 320) * 2.2` and a wide halo `pow(...,10)*0.22`. Pass colors as `THREE.Color` uniforms (already linear). Add a glow sprite at `sunDir * 330`.

## Shadows

```js
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -88; sun.shadow.camera.right = 88;
sun.shadow.camera.top = 82;   sun.shadow.camera.bottom = -82;
sun.shadow.camera.near = 20;  sun.shadow.camera.far = 280;
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
```

A 2048 map over a 176×164 area is ~0.086 units/texel. Keep the shadow camera tight around the playfield.

Ground planes receive shadows; props cast. Do not cast shadows from grass tufts or flowers.

## Contact shadow

```js
const tex = radialGradientTexture(); // 128², rgba(20,12,30,.55) → 0
const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.42, depthWrite: false });
const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
sh.rotation.x = -Math.PI / 2;
sh.position.y = 0.13;   // road is 0.07
```

Use one material and one geometry for all shadows. Size per entity in local units. For scaled parents (towers at 1.4×), divide the desired world size by the parent scale.

## Glow without bloom

```js
const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTexture(), color, transparent: true, opacity: 0.8,
  blending: THREE.AdditiveBlending, depthWrite: false,
}));
sprite.scale.setScalar(size);
```

`glowTexture()`: 128² canvas radial gradient white → transparent. Use for projectiles, orbs, portals, torches, crystals. For a stronger "bloom", set `MeshBasicMaterial.color` above 1 (e.g. `new THREE.Color(0x6fe8ff).multiplyScalar(2.2)`).

## Particles

Custom `Points` with attributes `aColor`, `aSize`, `aAlpha`, additive blending, `depthWrite:false`, `frustumCulled:false`. Vertex: `gl_PointSize = clamp(aSize * uScale / -mvPosition.z, 1.0, 90.0)` where `uScale = height * 0.5 / tan(fov/2)`. Fragment: `smoothstep(0.5, 0.08, length(gl_PointCoord-0.5))`.

Two pools: additive sparks and normal-blended smoke. Swap-remove dead particles, write a compact buffer, `setDrawRange(0, count)`. 700 + 320 particles is plenty.

## Wireframe/outline debugging

If an object is invisible, check: material side, normals (ribbon winding), geometry groups, y position relative to terrain, and `frustumCulled`. Ribbon triangles must wind counter-clockwise from above; `computeVertexNormals` will then point up.

## Performance budget

- 1500–2000 draw calls at 1600×900 on a mid-range desktop GPU.
- 300k–400k triangles.
- 2048 shadow map, 4× MSAA only if you render directly (`antialias:true`).
- Merge props; instance vegetation; cap outlines.
- `renderer.info.render.calls` is visible in the debug node after a direct render.
