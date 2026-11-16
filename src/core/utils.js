// Small shared helpers. The seeded random keeps the city identical on every load.
import * as THREE from 'three';

let seed = 12345;
export const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
export const pick = (a) => a[Math.floor(rand() * a.length)];
export const rnd = (a, b) => a + Math.random() * (b - a);       // unseeded, for gameplay
export const choose = (a) => a[Math.floor(Math.random() * a.length)];

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt)); // frame-rate independent smoothing
export const TAU = Math.PI * 2;
export const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const angleDiff = (to, from) => wrapAngle(to - from);
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
// A private random stream for new areas, so adding them never shifts the original city's dice.
export const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
// Smooth 2D noise in 0..1 (same answer every time for the same spot).
const hash2 = (x, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
export function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a + (a - b + d - c) * u) * v;
}
// Read or set the shared city dice (new areas put it back so later systems roll what they always did).
export const randSeed = (s) => (s === undefined ? seed : (seed = s));
