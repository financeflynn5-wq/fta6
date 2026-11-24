// How high is the ground? Pure maths on top of map.js, no graphics.
//   baseY     smooth land between the grid corners (level across every grid line, so roads never tilt sideways)
//   features  hand-placed mounds, gullies and washboards out in the open land
//   decks     built things you can stand or drive on: the pier, ramps, the barge, container tops
//   groundY   all of the above plus downtown's kerbs; this is what everything else asks
import { WORLD } from '../config.js';
import { STEP, NX, NZ, X0, FLAT, ROAD_HALF, WATER, SEABED, HEIGHT, cellType, hasRoad, nodeHasRoad } from './map.js';

const { BLOCK, PITCH, CURB } = WORLD;
const smooth = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const RAMP = STEP - 2 * FLAT;
// which square of the grid a spot is in: across (x) and up (z). The map is taller than it is wide.
const cell = (v) => { const c = Math.floor((v - X0) / STEP); return c < 0 ? 0 : c > NX - 2 ? NX - 2 : c; };
const cellZ = (v) => { const c = Math.floor((v - X0) / STEP); return c < 0 ? 0 : c > NZ - 2 ? NZ - 2 : c; };

export function baseY(x, z) {
  const ci = cell(x), cj = cellZ(z);
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
  for (let ci = cell(x - r); ci <= cell(x + r); ci++) for (let cj = cellZ(z - r); cj <= cellZ(z + r); cj++) {
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
// ---------- extra land: a place that brings its own shape (world/snowland.js: the mountain off the west edge) ----------
// { x0, x1, z0, z1, height(x, z, y), surface(x, z) }: inside that box, height() is handed the land as the map has it and
// answers with what is really there; surface() names what it is made of (or null for "what the map says").
let extra = null;
export function setExtraLand(e) { extra = e; }
export function landY(x, z) {
  if (extra && x < extra.x1 && x > extra.x0 && z > extra.z0 && z < extra.z1) return extra.height(x, z, mapY(x, z));
  return mapY(x, z);
}
function mapY(x, z) {
  let y = baseY(x, z);
  const ci = cell(x), cj = cellZ(z), list = featGrid.get(gkey(ci, cj));
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

// ---------- bridges: surfaces you can be on top of or underneath ----------
// A ribbon is a strip `hw` metres either side of a line of points { x, z, y }: an elevated road, a ramp, a roof.
// Unlike a deck it does not lift what is below it. groundY only counts a ribbon for a caller that says how
// high it already is (`ref`) and is on the ribbon or above it; everyone else gets the ground underneath.
const SPAN = 12, spanGrid = new Map(), ribbons = [];
const skey = (cx, cz) => cx * 4096 + cz, scell = (v) => Math.floor((v + 600) / SPAN);
export const CLIMB = .9;                  // a ribbon this far above you (or less) is still "what you are standing on"
export const UPPER = 1.8;                 // on a ribbon at least this far above the ground = on the upper level (see physics.js)
export const layer = { up: false, rib: null };   // filled in by the last groundY(x, z, ref): was the answer a ribbon?
// info: { road: true } for something cars drive on, closed: true when the last point joins the first.
export function addRibbon(pts, hw, info = {}) {
  const rib = { pts, hw, ...info, segs: [], id: ribbons.length };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz;
    if (len2 < 1e-6) continue;
    const s = { a, b, dx, dz, len2, hw, rib, first: i === 0 && !rib.closed, last: i === pts.length - 2 && !rib.closed };
    rib.segs.push(s);
    for (let cx = scell(Math.min(a.x, b.x) - hw); cx <= scell(Math.max(a.x, b.x) + hw); cx++) for (let cz = scell(Math.min(a.z, b.z) - hw); cz <= scell(Math.max(a.z, b.z) + hw); cz++) {
      const k = skey(cx, cz); let l = spanGrid.get(k); if (!l) spanGrid.set(k, l = []); l.push(s);
    }
  }
  ribbons.push(rib); return rib;
}
const NONE = -1e9;
let capped = false;                       // was the last spanY answer from the rounded end of a stretch (the outside of a bend)?
// Height of one stretch of ribbon at a spot (NONE when the spot is off it). `inset` shrinks the ribbon's width.
function spanY(s, x, z, inset = 0) {
  const t = ((x - s.a.x) * s.dx + (z - s.a.z) * s.dz) / s.len2;
  if ((t < 0 && s.first) || (t > 1 && s.last)) return NONE;          // open ends are cut square
  capped = t < 0 || t > 1;
  const tc = t < 0 ? 0 : t > 1 ? 1 : t, px = s.a.x + s.dx * tc - x, pz = s.a.z + s.dz * tc - z, w = s.hw - inset;
  if (px * px + pz * pz > w * w) return NONE;
  return s.a.y + (s.b.y - s.a.y) * tc;
}
// The ribbon surface at a spot that is nearest to height y (within `tol`), or null. skip: a ribbon to leave out.
export function ribbonAt(x, z, y, tol = .8, inset = 0, skip = null) {
  const list = spanGrid.get(skey(scell(x), scell(z))); if (!list) return null;
  for (const s of list) { if (s.rib === skip) continue; const sy = spanY(s, x, z, inset); if (sy !== NONE && Math.abs(sy - y) <= tol) return s.rib; }
  return null;
}
// Is any road ribbon within `margin` metres of this spot (whatever its height)? Keeps trees and houses out from under highways.
export function nearRibbon(x, z, margin = 0) {
  for (let cx = scell(x - margin); cx <= scell(x + margin); cx++) for (let cz = scell(z - margin); cz <= scell(z + margin); cz++) {
    const list = spanGrid.get(skey(cx, cz)); if (!list) continue;
    for (const s of list) if (s.rib.road && spanY(s, x, z, -margin) !== NONE) return true;
  }
  return false;
}
// The underside of the lowest ribbon that hangs over a spot above height `ref`, or 1e9 (open sky).
export function ceilingY(x, z, ref) {
  const list = spanGrid.get(skey(scell(x), scell(z))); let low = 1e9; if (!list) return low;
  for (const s of list) { const sy = spanY(s, x, z); if (sy !== NONE && sy > ref + CLIMB && sy - (s.rib.thick ?? 1.3) < low) low = sy - (s.rib.thick ?? 1.3); }
  return low;
}

// Downtown's pavements sit one kerb above the street.
function kerb(x, z) {
  const bi = Math.round((x - 27) / PITCH), bj = Math.round((z - 27) / PITCH);
  if (bi < -3 || bi > 2 || bj < -3 || bj > 2) return 0;
  return (Math.abs(x - (27 + PITCH * bi)) <= BLOCK / 2 && Math.abs(z - (27 + PITCH * bj)) <= BLOCK / 2) ? CURB : 0;
}

// The height everything stands on. Pass `ref` (how high you are now) to be able to stand on bridges and roofs:
// the answer is then the highest surface that is not above your head. Without it you get the ground level.
export function groundY(x, z, ref) {
  let y = landY(x, z) + kerb(x, z);
  const list = deckGrid.get(gkey(cell(x), cellZ(z)));
  if (list) for (const d of list) { const dy = deckY(d, x, z); if (dy > y) y = dy; }
  if (y < SEABED) y = SEABED;
  if (ref === undefined) return y;
  layer.up = false; layer.rib = null;
  const spans = spanGrid.get(skey(scell(x), scell(z))); if (!spans) return y;
  // A spot inside a stretch takes that stretch's own slope; the rounded ends only fill the wedge on the outside of a bend.
  const top = ref + CLIMB; let on = NONE, onRib = null, end = NONE, endRib = null;
  for (const s of spans) {
    const sy = spanY(s, x, z); if (sy === NONE || sy > top) continue;
    if (capped) { if (sy > end) { end = sy; endRib = s.rib; } } else if (sy > on) { on = sy; onRib = s.rib; }
  }
  if (on === NONE) { on = end; onRib = endRib; }
  if (on <= y) return y;
  layer.rib = onRib; layer.up = on - y > UPPER;
  return on;
}
// How deep the water is here (0 on dry land).
export const waterDepth = (x, z) => Math.max(0, WATER - groundY(x, z));

// What the ground is made of: 'road', 'city', 'sand', 'dirt', 'scrub', 'grass', 'park', 'hill', 'port', 'quay', 'rock', 'sea'
// (and on Frostbite Peak: 'ice', 'snow', 'powder').
export function surfaceAt(x, z) {
  if (extra && x < extra.x1 && x > extra.x0 && z > extra.z0 && z < extra.z1) { const s = extra.surface(x, z); if (s) return s; }
  const ci = cell(x), cj = cellZ(z), fx = x - X0 - ci * STEP, fz = z - X0 - cj * STEP;
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
