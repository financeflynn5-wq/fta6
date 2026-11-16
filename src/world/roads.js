// Helpers for anything that drives: where the roads are and how to get back onto one.
import { WORLD } from '../config.js';
import { ROAD_EDGES, nodeX } from './map.js';
export { hasRoad, ROAD_EDGES } from './map.js';

// The stretch of road closest to a spot that roughly heads the way (fx, fz) points.
// Returns { from: {i, j}, to: {i, j} } for an AI driver to carry on along.
export function nearestRoadLeg(x, z, fx = 0, fz = 0) {
  let best = null, bd = 1e9;
  for (const e of ROAD_EDGES) {
    const ax = nodeX(e.i), az = nodeX(e.j), s = Math.max(0, Math.min(WORLD.PITCH, (x - ax) * e.di + (z - az) * e.dj));
    const d = Math.hypot(x - ax - e.di * s, z - az - e.dj * s) + (1 - (fx * e.di + fz * e.dj)) * 12 + (s > WORLD.PITCH - 8 ? 20 : 0);
    if (d < bd) { bd = d; best = e; }
  }
  return { from: { i: best.i, j: best.j }, to: { i: best.i + best.di, j: best.j + best.dj } };
}
