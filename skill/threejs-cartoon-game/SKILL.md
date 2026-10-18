---
name: threejs-cartoon-game
description: "Build a complete, polished 3D cartoon game in the browser with Three.js and Vite — procedural low-poly models, toon shading with outlines, shadows, particles, DOM HUD, synthesized audio, wave-based or tower-defense loops, and a screenshot-driven QA loop. Use when the user asks for a Three.js 3D game, a stylized or cartoon web game, a browser tower defense, procedural 3D props or characters, or when an existing Three.js scene looks washed out, has no shadows, runs slow, or has wrong camera/model scale."
---

# Three.js Cartoon Game

Build a playable, finished-looking 3D game with zero external art assets. Everything is code: geometry, materials, animation, sound, UI. The hard parts are not the gameplay — they are the color pipeline, shadow setup, model scale, and a fast visual QA loop.

This playbook is distilled from a shipped wave-based tower defense (5 towers, 6 enemy types, 20 waves + endless, ~220 KB of source, 1600–1800 draw calls, 330k triangles at 1600×900). Copy the patterns and numbers; do not rediscover them.

## Delivery shape

Use Vite + vanilla ES modules + Three.js. No React needed.

```
index.html
src/
  main.js                 boot, RAF loop, QA hooks
  core/engine.js          renderer, camera, lights, resize, shake, raycast
  core/audio.js           WebAudio synth
  core/utils.js           rng, damp, clamp, angles
  art/materials.js        toon ramp, outline, glow, canvas textures
  art/geometry.js         rbox, mergeColored, ribbon, blob shadow
  art/environment.js      sky, island, road, props, set dressing
  art/towers.js           one builder per tower
  art/enemies.js          one builder per enemy
  art/icons.js            offscreen WebGL thumbnails
  game/path.js            curve + placement grid
  game/config.js          all tunables
  game/waves.js           wave table + spawn scheduler
  game/entities.js        Enemy, Tower
  game/projectiles.js     homing / ballistic / chain
  game/effects.js         particle pools, rings, lightning, text
  game/game.js            state machine, economy, input
  ui/hud.js + styles.css  DOM HUD
```

Target 2000–3500 lines. Split builders per file. Keep every tunable in `config.js`.

## 1. Rendering: skip the composer for this style

Use the renderer directly. Do **not** start with `EffectComposer` + `UnrealBloomPass` + `OutputPass` for a cartoon scene.

```js
renderer.toneMapping = THREE.NeutralToneMapping; // keeps hue better than ACES
renderer.toneMappingExposure = 0.86;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

Add a CSS vignette + grain overlay instead of a grade pass. Fake bloom with emissive materials and additive glow sprites. This removes a whole class of color bugs and saves 2–4 ms/frame.

If you must use the composer: custom `ShaderMaterial`s (sky, water, portal, particles) write raw values. When rendering to a float target, Three treats those values as linear; `OutputPass` then tone-maps and sRGB-encodes them. Colors authored in sRGB come out pale and lifted. Verify with `?post=0` (direct render) vs `?post=1`; if they differ, the shader colors are the cause. Author custom shader colors in linear (`color.convertSRGBToLinear()`) or accept the shift.

Measure color, do not trust your eyes on a downscaled screenshot. Sample pixels:

```powershell
python scripts/shot_stats.py shot.png --points 500,550 800,100
python scripts/shot_stats.py shot.png --crop 720,520,1140,780 --zoom 2
```

A mean saturation around 0.45–0.55 and a grass pixel near `(90,150,30)` means the scene is vivid. If grass reads `(170,200,150)`, the scene is over-lit, not "pastel by design".

## 2. Lighting and shadows

```js
new THREE.HemisphereLight(0xd6edff, 0x3e5a2c, 0.62);
const sun = new THREE.DirectionalLight(0xfff2ce, 2.3);
sun.position.set(62, 96, 58);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -88, right: 88, top: 82, bottom: -82, near: 20, far: 280 });
sun.shadow.camera.updateProjectionMatrix();   // REQUIRED after changing bounds
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
```

Missing `updateProjectionMatrix()` leaves the ortho box at ±5 and produces **no visible shadows**. This is the single most common "shadows are broken" bug.

Keep ambient low (0.1) so shadowed sides stay saturated. Add a cool fill at 0.3. Total diffuse around 3.0 with exposure 0.86 works.

Ground objects with a soft blob shadow: radial-gradient canvas texture on a plane at `y = 0.13` (above the road at 0.07). Real shadows alone look detached on stylized terrain.

## 3. Toon look

**Ramp.** 4-step `DataTexture`, `NearestFilter`, luminance values `[0.42, 0.68, 0.86, 1.0]`, assigned as `gradientMap` on `MeshToonMaterial`. Use `flatShading: true` on low-poly parts.

**Outline.** Inverted hull with a normal offset, one extra draw call per hero mesh:

```js
new THREE.ShaderMaterial({
  uniforms: { uThickness: { value: 0.045 }, uColor: { value: new THREE.Color(0x241a33) } },
  vertexShader: 'uniform float uThickness; void main(){ vec3 p=position+normal*uThickness; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }',
  fragmentShader: 'uniform vec3 uColor; void main(){ gl_FragColor=vec4(uColor,1.0); }',
  side: THREE.BackSide,
});
```

Add the outline as a child of the mesh so it inherits transforms. For multi-material geometry, clone the geometry and `clearGroups()`. Skip outlines on rivets and thin trim; outline only silhouettes (body, head, base) to control draw calls.

**Glow.** A 128×128 radial-gradient canvas sprite with additive blending is cheaper and more controllable than bloom. Use it for orbs, portals, torches, crystals.

**Rim.** If a hero object still reads flat, add a front-side Fresnel shell (`pow(1-dot(N,V), 3)`) with additive blending and `depthWrite:false`. Do not apply it scene-wide.

## 4. Scale discipline (this decides whether it reads as a game)

Use one world unit ≈ one meter and lock these ratios:

| Thing | Size |
| --- | --- |
| Road width / grid cell | 6.4 |
| Tower height | 7–9 |
| Tower base radius | 2.4–3.2 |
| Small enemy / boss | 2.2–3 / 5–7 |
| Camera distance / FOV | 100–125 / 40° |
| Camera pitch | 28–35° above horizon |

A top-down camera hides turrets under roofs. Build **open-top towers** with the weapon on top, or a small rear awning only. Test every model from the actual camera before adding detail.

Towers about 1.4× nominal and enemies about 1.9× nominal worked here. If units look like toys on a board, the camera is too high or the map is too large — shrink the map, not the characters.

## 5. Procedural models that look expensive

- Build from primitives with bevels: `RoundedBoxGeometry`, `LatheGeometry`, `TorusGeometry`, `CapsuleGeometry`, `ConeGeometry(…, 7|8)`.
- Merge every static prop into **one** vertex-colored mesh with `mergeColored([{geo, color}, …])`. A whole tree or rock becomes 1 draw call + 1 outline. This is the biggest performance lever.
- `InstancedMesh` for grass tufts (1000+), flowers (2 meshes: stems + heads), path stones.
- Cache shared geometries and materials at module level. Template + `clone(true)` for projectiles; never dispose shared geometry.
- Tint with vertex colors instead of per-part materials.
- Add one asymmetric detail per model (banner, lantern, rope, crate, chipped edge). Symmetry reads as "programmer art".
- Animate procedurally: squash on hop, leg swing by `sin`, wing flap, turret recoil, floating orb, cloth sway. No skeleton files.

## 6. Gameplay architecture that stays debuggable

**Path.** `CatmullRomCurve3(points, false, 'centripetal', 0.5)`. Use `getPointAt(t)` (arc-length) and `getTangentAt(t)`. Cache `curve.getLength()`. For placement checks, sample 500 points and compute min distance to the road.

**Grid.** Precompute valid cells once: inside island ellipse, `distanceToRoad > halfWidth + 2.6`, outside spawn/goal radius, outside prop blockers. Store a `Set` of `"i,j"`. Occupancy in a `Map`. Cell size = road width.

**Waves.** Build a flat spawn list `[{t, type, elite}]` from groups, sort by `t`, and drive it with a `waveTime` accumulator. A wave completes when the list is exhausted **and** no enemies remain. Countdown to the next wave; early call pays `floor(remainingSeconds * 2)`.

**Towers.** Target modes `first | strong | close`. Check air/ground flags. Rotate the turret with angle damping; fire only when aligned (≈0.45 rad). Cooldown = `1/rate`. Chain lightning resolves instantly with line effects.

**Projectiles.** Three behaviors cover most games: homing (arrow/orb), ballistic arc (cannon), instant chain (tesla). Use target leading for the arc (`target.center + forward * speed * T`).

**Damage.** `physical` reduced by armor; `magic` ignores armor; status effects (slow) applied on hit or in a splash radius. Float damage numbers as DOM elements projected once at spawn.

**State machine.** `menu | playing | paused | over | won`. Every state change updates the HUD and the overlay. Pause must freeze gameplay but keep rendering; use a scaled `dt`.

**Economy sanity.** Start with enough for 3–4 cheap towers. Wave clear bonus `34 + 6*wave`. HP scale `1 + 0.135*(wave-1)`. Boss HP 20–30× a grunt. Show a boss bar; give bosses a red ground aura.

## 7. DOM HUD

- One `HUD` class, cached element refs, `refresh()` on change (throttle to ~8 Hz).
- Tower cards carry an offscreen-rendered thumbnail: a throwaway `WebGLRenderer({alpha:true, preserveDrawingBuffer:true})`, the real tower model, three lights, `toDataURL()`. Players see the actual model.
- Build mode: ghost tower at 48% opacity, range ring, valid-cell dots, red cell marker when blocked.
- Click vs drag: record `pointerdown` position/time; treat as click only under ~7 px and ~750 ms, so OrbitControls still works.
- Hotkeys: `1–5`, `Esc`, `Space`, `F`, `M`, `H`. Show them in the UI.
- Result screen must distinguish win/lose and restore the correct overlay after closing help. Store `won` and pass it back.

## 8. Audio without files

One `AudioContext` created on the first gesture. Master → compressor → destination, plus a generated 1.5 s noise impulse into a convolver for space. Reuse a 1 s noise buffer. Sounds are oscillator/noise envelopes: arrow (highpass noise + pitch drop), cannon (sine 130→38 + lowpass noise), frost (sine 1600→420), tesla (bandpass noise + saw), coin (two sines), wave horn (detuned saw chord). Add a quiet 9 s pad loop with sine chords. Mute persists in `localStorage`.

## 9. QA loop (do not skip)

1. Expose a debug node, not just globals:
   ```js
   const dbg = document.createElement('div'); dbg.id = 'debug'; document.body.appendChild(dbg);
   setInterval(() => { if (!location.search.includes('debug')) return;
     dbg.textContent = `state=${game.state} wave=${game.wave} enemies=${game.enemies.length} towers=${game.towers.length}
   cam=${cam.position.toArray().map(n=>n.toFixed(1))} calls=${renderer.info.render.calls} tris=${renderer.info.render.triangles}
   err=${window.__errors.slice(0,2).join(' | ')}`; }, 300);
   ```
   Keep `window.__errors` fed by `error` and `unhandledrejection`.
2. Add URL switches: `?debug=1`, `?auto=1&towers=1&startwave=10&speed=3`, `?cam=x,y,z,tx,ty,tz`, `?win=1`, `?lives=1`. They turn a 10-minute manual test into 10 seconds.
3. Drive the game with camofox: `open` → `screenshot` → `read_image`. `evaluate` may run in an isolated world where page globals are invisible, but **the DOM is shared** — read state from `#debug`, and click the canvas with synthetic `PointerEvent`s. Click UI with CSS selectors.
4. After a visual change, screenshot at the same camera and sample pixels. Crop 2–4× to judge model detail and outlines.
5. Run `npm run build` and test the preview server. Dev-only behavior hides production import errors.
6. Check `renderer.info.render.calls` in the debug line. Above ~2000, merge props or drop small outlines.

## 10. Pitfalls that cost hours

- **Washed colors** → composer + custom shaders, or over-lit materials. Test direct render first; lower exposure before changing art.
- **No shadows** → forgot `shadow.camera.updateProjectionMatrix()`.
- **Sky too bright in composer** → sky uses a raw `ShaderMaterial`; its sRGB values are treated as linear.
- **Clicking a HUD button does nothing** → a property mismatch throws inside the listener; catch and surface errors. Use one access path (`hud.el.x`), not two.
- **Turret invisible** → full roof from a top-down camera. Open the roof.
- **Tower shadows too big** → blob shadow inherits the tower's 1.4× scale; size in local units.
- **Z-fighting on the road** → shadows/decal at 0.13, road at 0.07, border at 0.035, grass at 0.
- **Fog looks wrong** → fog is applied in view space; keep `near/far` beyond the play field and match the horizon color.
- **Memory churn** → per-shot geometry/material creation. Cache templates.
- **Balance tested with cheats** → 9 maxed towers clear wave 10; that proves nothing. Test with the real starting gold.

## 11. Scope honesty

Code-only procedural art has a ceiling. It can look like a cohesive, premium *stylized* game (think Kingdom Rush / Bad North), not like a AAA production. If the user demands AAA, say what changes: authored GLB characters, PBR texture sets, HDRI, SSAO/GTAO, bloom + color grading, animation clips, VFX textures. This skill gives the systems and the pipeline to plug those into.

## References

- `references/rendering.md` — full renderer, toon ramp, outline, sky, glow, shadow, color-space debugging.
- `references/gameplay.md` — path, grid, waves, targeting, projectiles, effects, economy numbers.
- `references/qa.md` — camofox recipe, debug hooks, URL params, pixel sampling, delivery checklist.
- `scripts/shot_stats.py` — saturation/value stats, pixel probes, and zoom crops for screenshots.
