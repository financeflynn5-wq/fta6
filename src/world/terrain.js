// How high is the ground? Pure maths on top of map.js, no graphics.
//   baseY     smooth land between the grid corners (level across every grid line, so roads never tilt sideways)
//   features  hand-placed mounds, gullies and washboards out in the open land
//   decks     built things you can stand or drive on: the pier, ramps, the barge, container tops
//   groundY   all of the above plus downtown's kerbs; this is what everything else asks
import { WORLD } from '../config.js';
import { STEP, N, X0, FLAT, ROAD_HALF, WATER, SEABED, HEIGHT, cellType, hasRoad, nodeHasRoad } from './map.js';

const { BLOCK, PITCH, CURB } = WORLD;
const smooth = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const RAMP = STEP - 2 * FLAT;
const cell = (v) => { const c = Math.floor((v - X0) / STEP); return c < 0 ? 0 : c > N - 2 ? N - 2 : c; };

export function baseY(x, z) {
  const ci = cell(x), cj = cell(z);
  const wx = smooth((x - X0 - ci * STEP - FLAT) / RAMP), wz = smooth((z - X0 - cj * STEP - FLAT) / RAMP);
  const r0 = HEIGHT[cj], r1 = HEIGHT[cj + 1];
  const a = r0[ci] + (r0[ci + 1] - r0[ci]) * wx, b = r1[ci] + (r1[ci + 1] - r1[ci]) * wx;
  return a + (b - a) * wz;
}

// ---------- features: shapes added to open land ----------
// They fade out before any road so the tarmac stays as designed.
const features = [], featGrid = new Map();
const gkey = (ci, cj) => ci * 32 + cj;
function bucket(grid, item, x, z, r) {
  for (let ci = cell(x - r); ci <= cell(x + r); ci++) for (let cj = cell(z - r); cj <= cell(z + r); cj++) {
    const k = gkey(ci, cj); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(item);
  }
}
// mound: { x, z, r, h }  round hill (h < 0 digs a pit)
// gully: { x1, z1, x2, z2, r, h }  a ridge or trench along a line
// waves: { x, z, r, h, len, dir }  washboard bumps inside a round patch, crests across `dir`
export function addFeature(f) {
  if (f.x1 !== undefined) { f.x = (f.x1 + f.x2) / 2; f.z = (f.z1 + f.z2) / 2; f.reach = Math.hypot(f.x2 - f.x1, f.z2 - f.z1) / 2 + f.r; }
  else f.reach = f.r;
  features.push(f); bucket(featGrid, f, f.x, f.z, f.reach);
}
function featureY(f, x, z) {
  if (f.x1 !== undefined) {
    const dx = f.x2 - f.x1, dz = f.z2 - f.z1, t = Math.max(0, Math.min(1, ((x - f.x1) * dx + (z - f.z1) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - f.x1 - dx * t, z - f.z1 - dz * t); if (d >= f.r) return 0;
    return f.h * smooth(Math.min(1, (1 - d / f.r) / (f.flat ?? .55)));
  }
  const d = Math.hypot(x - f.x, z - f.z); if (d >= f.r) return 0;
  const fall = smooth(Math.min(1, (1 - d / f.r) / (f.flat ?? 1)));
  if (f.len) { const u = (x - f.x) * Math.cos(f.dir) + (z - f.z) * Math.sin(f.dir); return f.h * fall * (.5 - .5 * Math.cos(u / f.len * Math.PI * 2)); }
  return f.h * fall;
}
// 0 on and beside roads, 1 a little way out into the land.
function roadFade(x, z, ci, cj) {
  const fx = x - X0 - ci * STEP, fz = z - X0 - cj * STEP;
  let m = 1;
  const near = (d) => smooth((d - ROAD_HALF - 3) / 7);
  if (hasRoad(ci, cj, ci + 1, cj)) m *= near(fz);
  if (hasRoad(ci, cj + 1, ci + 1, cj + 1)) m *= near(STEP - fz);
  if (hasRoad(ci, cj, ci, cj + 1)) m *= near(fx);
  if (hasRoad(ci + 1, cj, ci + 1, cj + 1)) m *= near(STEP - fx);
  if (m > 0) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    if (nodeHasRoad(ci + a, cj + b)) m *= near(Math.max(Math.abs(fx - a * STEP), Math.abs(fz - b * STEP)));
  }
  return m;
}
export function landY(x, z) {
  let y = baseY(x, z);
  const ci = cell(x), cj = cell(z), list = featGrid.get(gkey(ci, cj));
  if (list) {
    let add = 0;
    for (const f of list) if (Math.abs(x - f.x) < f.reach && Math.abs(z - f.z) < f.reach) add += featureY(f, x, z);
    if (add) y += add * roadFade(x, z, ci, cj);
  }
  return y;
}

// ---------- decks: flat or sloping platforms laid over the land ----------
// { x, z, hl, hw, rot, y0, y1 }: a rectangle hl long (along rot) and hw wide (half sizes);
// its top runs from y0 at the back end to y1 at the front end.
const decks = [], deckGrid = new Map();
export function addDeck(d) {
  d.cos = Math.cos(d.rot || 0); d.sin = Math.sin(d.rot || 0); d.y1 = d.y1 ?? d.y0;
  decks.push(d); bucket(deckGrid, d, d.x, d.z, Math.hypot(d.hl, d.hw)); return d;
}
function deckY(d, x, z) {
  const dx = x - d.x, dz = z - d.z, u = dx * d.cos + dz * d.sin, w = -dx * d.sin + dz * d.cos;
  if (u < -d.hl || u > d.hl || w < -d.hw || w > d.hw) return -1e9;
  return d.y0 + (d.y1 - d.y0) * (u + d.hl) / (2 * d.hl);
}

// Downtown's pavements sit one kerb above the street.
function kerb(x, z) {
  const bi = Math.round((x - 27) / PITCH), bj = Math.round((z - 27) / PITCH);
  if (bi < -3 || bi > 2 || bj < -3 || bj > 2) return 0;
  return (Math.abs(x - (27 + PITCH * bi)) <= BLOCK / 2 && Math.abs(z - (27 + PITCH * bj)) <= BLOCK / 2) ? CURB : 0;
}

// The height everything stands on.
export function groundY(x, z) {
  let y = landY(x, z) + kerb(x, z);
  const list = deckGrid.get(gkey(cell(x), cell(z)));
  if (list) for (const d of list) { const dy = deckY(d, x, z); if (dy > y) y = dy; }
  return y < SEABED ? SEABED : y;
}
// How deep the water is here (0 on dry land).
export const waterDepth = (x, z) => Math.max(0, WATER - groundY(x, z));

// What the ground is made of: 'road', 'city', 'sand', 'dirt', 'scrub', 'grass', 'park', 'hill', 'port', 'quay', 'rock', 'sea'.
export function surfaceAt(x, z) {
  const ci = cell(x), cj = cell(z), fx = x - X0 - ci * STEP, fz = z - X0 - cj * STEP;
  const R = ROAD_HALF;
  if ((fz < R && hasRoad(ci, cj, ci + 1, cj)) || (fz > STEP - R && hasRoad(ci, cj + 1, ci + 1, cj + 1)) ||
    (fx < R && hasRoad(ci, cj, ci, cj + 1)) || (fx > STEP - R && hasRoad(ci + 1, cj, ci + 1, cj + 1))) return 'road';
  return cellType(ci, cj);
}

// First point where a ray meets the ground, as a distance along it, or -1.
export function rayGround(ox, oy, oz, dx, dy, dz, max) {
  let t0 = 0, above = oy - groundY(ox, oz);
  if (above < 0) return -1;
  const step = 1.2;
  for (let t = step; t < max + step; t += step) {
    const tt = Math.min(t, max), h = oy + dy * tt - groundY(ox + dx * tt, oz + dz * tt);
    if (h < 0) {
      let a = t0, b = tt;
      for (let k = 0; k < 6; k++) { const m = (a + b) / 2; if (oy + dy * m - groundY(ox + dx * m, oz + dz * m) < 0) b = m; else a = m; }
      return a;
    }
    // far above everything that could be below: take bigger steps
    if (h > 60 && dy >= 0) return -1;
    t0 = tt; if (tt === max) break;
  }
  return -1;
}
