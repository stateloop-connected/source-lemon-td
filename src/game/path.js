import * as THREE from 'three';
import { clamp } from '../core/utils.js';

export const WAYPOINTS = [
  [-58, -18], [-36, -18], [-36, 16], [-10, 16], [-10, -22],
  [16, -22], [16, 14], [40, 14], [40, -10], [58, -10],
];

export class PathSystem {
  constructor() {
    const pts = WAYPOINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    this.length = this.curve.getLength();
    this.width = 6.4;
    this.half = this.width / 2;
    this.samples = this.curve.getSpacedPoints(520);
    this.start = this.curve.getPointAt(0);
    this.end = this.curve.getPointAt(1);
    this._v = new THREE.Vector3();
  }

  pointAt(t, out = new THREE.Vector3()) {
    return this.curve.getPointAt(clamp(t, 0, 1), out);
  }

  tangentAt(t, out = new THREE.Vector3()) {
    return this.curve.getTangentAt(clamp(t, 0, 1), out);
  }

  distanceTo(x, z) {
    let best = Infinity;
    const s = this.samples;
    for (let i = 0; i < s.length; i++) {
      const dx = s[i].x - x;
      const dz = s[i].z - z;
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  isOnIsland(x, z, margin = 0) {
    const a = 62 - margin;
    const b = 43 - margin;
    return (x * x) / (a * a) + (z * z) / (b * b) <= 1;
  }
}

export class PlacementGrid {
  constructor(path, blockers = []) {
    this.path = path;
    this.blockers = blockers;
    this.cell = 6.4;
    this.x0 = -58;
    this.z0 = -38;
    this.cols = 18;
    this.rows = 11;
    this.occupied = new Map();
    this.valid = new Set();

    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        if (this.computeValid(i, j)) this.valid.add(this.key(i, j));
      }
    }
  }

  key(i, j) { return i + ',' + j; }

  center(i, j) {
    return {
      x: this.x0 + (i + 0.5) * this.cell,
      z: this.z0 + (j + 0.5) * this.cell,
    };
  }

  cellFromWorld(x, z) {
    const i = Math.floor((x - this.x0) / this.cell);
    const j = Math.floor((z - this.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) return null;
    return { i, j, ...this.center(i, j) };
  }

  computeValid(i, j) {
    const { x, z } = this.center(i, j);
    if (!this.path.isOnIsland(x, z, 6)) return false;
    if (this.path.distanceTo(x, z) < this.path.half + 2.6) return false;
    if (Math.hypot(x - this.path.start.x, z - this.path.start.z) < 9) return false;
    if (Math.hypot(x - this.path.end.x, z - this.path.end.z) < 9) return false;
    for (const b of this.blockers) {
      if (Math.hypot(x - b.x, z - b.z) < (b.r ?? 1.5) + 1.6) return false;
    }
    return true;
  }

  isBuildable(i, j) {
    return this.valid.has(this.key(i, j)) && !this.occupied.has(this.key(i, j));
  }

  towerAt(i, j) {
    return this.occupied.get(this.key(i, j)) ?? null;
  }

  occupy(i, j, tower) {
    this.occupied.set(this.key(i, j), tower);
  }

  free(i, j) {
    this.occupied.delete(this.key(i, j));
  }

  cellList() {
    return [...this.valid].map((k) => {
      const [i, j] = k.split(',').map(Number);
      return { i, j, ...this.center(i, j) };
    });
  }
}
