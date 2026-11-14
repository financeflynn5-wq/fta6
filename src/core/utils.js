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
