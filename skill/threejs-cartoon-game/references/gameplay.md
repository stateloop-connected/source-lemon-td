# Gameplay reference

## World layout

Use a road width of 6.4 and a grid cell of the same size. A 116×76 play area gives about 18×11 cells, enough for 20–30 towers without crowding.

```js
const WAYPOINTS = [
  [-58, -18], [-36, -18], [-36, 16], [-10, 16], [-10, -22],
  [16, -22], [16, 14], [40, 14], [40, -10], [58, -10],
];
const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
```

Centripetal Catmull-Rom avoids overshoot at hairpins. Precompute `curve.getLength()` and a `getSpacedPoints(520)` array for distance queries.

## Placement grid

```js
computeValid(i, j) {
  const { x, z } = center(i, j);
  if (!isOnIsland(x, z, 6)) return false;
  if (path.distanceTo(x, z) < path.half + 2.6) return false;
  if (hypot(x - start.x, z - start.z) < 9) return false;
  if (hypot(x - end.x, z - end.z) < 9) return false;
  for (const b of blockers) if (hypot(x - b.x, z - b.z) < b.r + 1.6) return false;
  return true;
}
```

Build a `Set` of `"i,j"` once. Keep occupancy in a `Map` from the same key to the tower. `cellFromWorld` must reject out-of-bounds indices.

Blockers come from trees, rocks, the pond, the camp, ruins. Add them after placing the props.

## Waves

```js
const wave = {
  name: '酋长降临', boss: true,
  groups: [{ type: 'ogre', count: 1, gap: 0 }, { type: 'slime', count: 12, gap: 0.5, delay: 2 }],
};
```

Flatten groups into `[{t, type, elite}]`, sorted by `t`. Drive with:

```js
waveTime += step;
while (spawnIndex < spawns.length && spawns[spawnIndex].t <= waveTime) spawn(spawns[spawnIndex++]);
if (spawnIndex >= spawns.length && enemies.length === 0) completeWave();
```

Reward: `34 + 6*wave` gold, `60 + 12*wave` score. Countdown 12–15 s. Early call: `floor(remaining * 2)` gold. HP scale `1 + 0.135*(wave-1)`; endless `*1.28^(wave-20)`.

Boss bar: one enemy reference, full-width bar at the top; hide it on death or leak.

## Enemy

```js
center = position + (0, height * visualScale * 0.45, 0);
progress += speed * slowFactor * dt / path.length;
```

Lane offset: `side = (tan.z, -tan.x)`, offset ±0.75 to prevent perfect stacking. Flyers get `y = flyY + sin(t*3 + seed) * 0.35` and skip ground towers.

Armor: physical damage `* (1 - armor)`, magic ignores it. Slow: `slowFactor = min(slowFactor, 1 - f)`, timer refresh, recover at ~1.2/s.

Shaman aura: every 0.5 s heal allies within radius for `heal * 0.5`.

Health bar: two planes in a group above the head; billboard with `camera.quaternion` premultiplied by the inverse of the parent's quaternion. Fill by `scale.x` and recenter.

## Tower

```js
update(dt, t) {
  const target = acquire();
  if (!target) return;
  if (aim) aim.rotation.y = dampAngle(aim.rotation.y, atan2(dx, dz), 16, dt);
  if (barrel) barrel.rotation.x = damp(barrel.rotation.x, -atan2(dy, distXZ), 12, dt);
  if (cooldown <= 0 && aligned) { fire(target); cooldown = 1 / rate; }
}
```

Modes: `first` = max progress, `strong` = max hp, `close` = min distance. Check `air`/`ground` flags.

Muzzle: an `Object3D` inside the barrel; `getWorldPosition()` before spawning. Recoil: push the barrel back and restore with damping.

## Projectiles

- **Homing**: move toward `target.center` at `speed*dt`; hit within 0.9. If the target dies, keep flying to `lastTarget` and pop.
- **Ballistic**: `T = clamp(dist/speed, .35, 1.5)`, position = lerp(start, end, k) + `sin(pi*k)*arc`; explode at `k>=1`. Lead the target by `forward * speed * 0.55`.
- **Chain**: instant. Pick nearest unhit enemies within 8.5 units, damage `dmg *= 0.75` per jump, draw a jittered `Line` with additive blending.

Use templates and `clone(true)`; dispose only per-shot resources if you create them.

## Effects

- Pools for sparks and smoke.
- Expanding ring: `RingGeometry(0.72,1,40)` rotated flat, additive, scale 0.2→maxR, opacity `(1-k)^1.6`.
- Lightning: 9 segments, jitter 0.9, fade 0.22 s.
- Damage numbers: project world position once, append a DOM node, animate with CSS, remove after 1 s. Do not track every frame.
- Explosion: sparks + smoke + ring + flash sprite + camera shake.

## Economy and balance baseline

| Item | Value |
| --- | --- |
| Start gold | 340 |
| Lives | 20 |
| Cheap tower | 70 |
| Mid tower | 120–170 |
| Top tower | 220 |
| Upgrade cost | 95% / 155% of base |
| Level damage | ×1 / ×1.7 / ×2.9 |
| Sell refund | 70% |
| Kill gold | 8–22, boss 150 |
| Boss HP | 2300 × wave scale |

A wave should last 25–45 s. If a wave ends in under 15 s, raise HP or counts. If more than 8 enemies leak with reasonable towers, lower HP scale or raise income.

## State machine

`menu → playing → paused → over | won`. `update` returns early unless `playing`; `dt` is multiplied by `speed` only for gameplay, never for camera or UI.

Restart must clear enemies, towers, projectiles, grid occupancy, gold, lives, wave, boss bar, selection, build mode, and speed. Effects can fade out naturally.

## Input

Record pointer down position and time on the canvas. Treat as a click only if movement < 7 px and duration < 750 ms. This keeps OrbitControls drag working. Right click and `Esc` cancel build mode and selection. Keyboard: `1–5`, `Space`, `F`, `M`, `H`, `Esc`.
