// Frostbite Peak as plain numbers: the snow mountain that stands off the west edge of the map, and the ice road up it.
// No graphics here (world/snowpeak.js draws it). This file answers:
//   how high is the mountain at a spot          (it plugs into terrain.js, so cars, people and cameras all stand on it)
//   where does the road go                      ROAD: a point every 2.5 m, bottom to top
//   how slippery is the ground                  slickAt(x, z): 0 tarmac ... 1 sheet ice
//   how far is a spot from the road             roadAt(x, z), nearRoad(x, z)
// The mountain is a fluted cone with a flat top. The road leaves the West Pass at its crest, goes through a notch in
// the ridge, and then winds round the mountain to the top, always on the level the mountain has there: the land is cut
// away on the uphill side and falls away on the other, which is what makes it a ledge.
import { SNOW } from '../config.js';
import { noise2 } from '../core/utils.js';
import { setExtraLand, landY } from './terrain.js';

const smooth = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// ---------- where it is ----------
export const SEAM = -385;                                       // the map's own ground is drawn east of this line, the mountain west of it
export const GATE = { x: -331, z: 378, y: 28 };                 // where the ice road leaves the West Pass road
const NOTCH = 47;                                               // how far east of the seam the notch through the ridge reaches
const PZ = 400, R0 = 240, APEX = 246, Q = 1.08;                 // the cone: centre line, radius of its foot, where its point would be, how hollow its sides are
const FOOT_E = 27, FOOT = -12;                                  // what it stands on: the col behind the ridge (east), the sea bed (everywhere else)
export const TOP = 212;                                         // the flat top
const SHELF = 28;                                               // the road ends this far out from the middle of it
const FLAT0 = 15, FLAT = 41, RIM = 60;                          // the top is a level shelf from FLAT0 to FLAT out from the middle (the crag stands inside it), and back on the cone by RIM
// The cone is fluted: three broad buttresses, and finer ribs between them that die away towards the top (u: 0 the middle, 1 the foot).
const lobe = (th, u) => 1 + .09 * Math.cos(3 * th + .6) + .055 * Math.cos(5 * th - 1.1) + (.03 * Math.cos(9 * th + 2.2) + .018 * Math.cos(14 * th + .4)) * smooth((u - .16) / .36);
const foot = (th) => FOOT + (FOOT_E - FOOT) * smooth(1.6 - Math.abs(Math.atan2(Math.sin(th), Math.cos(th))) / .82);          // the col reaches about 75 degrees either side of due east
function cone(d, th) {
  let u = d / R0; for (let k = 0; k < 3; k++) u = d / (R0 * lobe(th, u));
  const f = foot(th);
  return u >= 1 ? f : f + (APEX - f) * Math.pow(1 - u, Q);
}
// The road comes out of the notch, swings south and is on the mountain at JOIN. The mountain is slid east or west until
// its side is exactly as high there as the road is.
const JOIN = { x: -416, z: 354, y: 32.5 };
let PX = -667;
{ let a = -760, b = -600; for (let k = 0; k < 40; k++) { PX = (a + b) / 2; const dx = JOIN.x - PX, dz = JOIN.z - PZ; if (cone(Math.hypot(dx, dz), Math.atan2(dz, dx)) > JOIN.y) b = PX; else a = PX; } }
export const PEAK = { x: PX, z: PZ };
export const HORN = { x: PX, z: PZ, r: FLAT0 + 3, h: 31 };          // the crag in the middle of the top (the mast is on it)
export const AREA = { x0: Math.floor(PX - R0 * 1.2 - 14), x1: SEAM + NOTCH, z0: PZ - 300, z1: PZ + 300 };       // everything this file has a say over

// The mountain without its rough skin: the cone, levelled off into the shelf at the top.
function massif(d, th) { const y = cone(d, th); return d < RIM ? TOP + (y - TOP) * smooth((d - FLAT) / (RIM - FLAT)) : y; }
// how far from the middle of the mountain you are at height y, going out along th (the mountain turned inside out)
function reach(th, y) { let a = FLAT, b = R0 * 1.3; for (let k = 0; k < 26; k++) { const m = (a + b) / 2; if (massif(m, th) > y) a = m; else b = m; } return (a + b) / 2; }

// ---------- the road ----------
// Each point: where (x, z), how high (y), half its width (hw), how icy (ice 0..1), how far along (s), which way it runs (tx, tz),
// and which side the drop is on (out: +1 = to the right of the way up).
export const ROAD = [];
{
  const raw = [];
  // through the notch, due west, then a quarter turn to the south
  const cx = -392, r = 24;
  for (let x = GATE.x; x > cx; x -= 2) raw.push([x, GATE.z]);
  for (let a = 0; a < Math.PI / 2 - .01; a += 2 / r) raw.push([cx - Math.sin(a) * r, GATE.z - r + Math.cos(a) * r]);
  const n0 = raw.length;
  // round the mountain, climbing all the way: every step goes 2 m along the level the road has reached
  let th = Math.atan2(JOIN.z - PZ, JOIN.x - PX), y = JOIN.y, len = 0;
  const yEnd = TOP - 1.6;
  while (y < yEnd && raw.length < 4000) {
    const d = reach(th, y); raw.push([PX + Math.cos(th) * d, PZ + Math.sin(th) * d, y]);
    const g = SNOW.grade * (.72 + .28 * smooth(len / 160));               // an easier start
    y += g * 2; th -= 2 / d; len += 2;
  }
  // the last ramp: off the mountainside and in onto the flat top
  { const d0 = reach(th, y); for (let k = 1; k <= 24; k++) { const t = k / 24, d = d0 + (SHELF - d0) * smooth(t); th -= 2 / d; raw.push([PX + Math.cos(th) * d, PZ + Math.sin(th) * d, yEnd + (TOP - yEnd) * Math.min(1, t * 2)]); } }
  // heights for the way in: a gentle climb from the junction to where the mountain starts
  let run = 0; const at = [0]; for (let i = 1; i < raw.length; i++) at.push(run += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
  for (let i = 0; i < n0; i++) raw[i][2] = GATE.y + (JOIN.y - GATE.y) * Math.pow(at[i] / at[n0], 1.25);
  // the same line again as evenly spaced points, with the corners taken out of it
  const STEP = 2.5, pts = [];
  for (let s = 0, i = 0; s <= run; s += STEP) {
    while (i < raw.length - 2 && at[i + 1] < s) i++;
    const t = (s - at[i]) / (at[i + 1] - at[i] || 1); pts.push([raw[i][0] + (raw[i + 1][0] - raw[i][0]) * t, raw[i][1] + (raw[i + 1][1] - raw[i][1]) * t, raw[i][2] + (raw[i + 1][2] - raw[i][2]) * t]);
  }
  for (let pass = 0; pass < 6; pass++) for (let k = 0; k < 3; k++) {
    const prev = pts.map(p => p[k]);
    for (let i = 3; i < pts.length - 1; i++) pts[i][k] = prev[i] * .5 + (prev[i - 1] + prev[i + 1]) * .25;
  }
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    if (i) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    ROAD.push({ x: pts[i][0], z: pts[i][1], y: pts[i][2], s, tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l, hw: SNOW.halfWidth, ice: 0, out: 1, i });
  }
}
export const LENGTH = ROAD[ROAD.length - 1].s;
// Where the going changes. Below the snow line it is a dirt road; above it packed snow, with sheets of ice that get
// longer and closer together the higher you are, and two squeezes where the ledge narrows.
{
  let next = 0, until = -1, k = 0;
  const SQUEEZE = [.46, .8].map(f => f * LENGTH);
  for (const p of ROAD) {
    const high = smooth((p.y - SNOW.snowLine + 14) / 22);            // 0 on the dirt, 1 once the snow has set in
    p.snow = high;
    if (high > .9 && p.s > next && until < 0 && p.s < LENGTH - 150) { const f = (p.y - SNOW.snowLine) / (TOP - SNOW.snowLine); until = Math.min(LENGTH - 55, p.s + 34 + 44 * f + (k % 3) * 9); next = until + 96 - 52 * f + (k % 2) * 14; k++; }
    if (until > 0) { if (p.s > until) until = -1; }
    p.sheet = until > 0 ? until : 0;
    for (const q of SQUEEZE) p.hw = Math.min(p.hw, SNOW.pinch + (SNOW.halfWidth - SNOW.pinch) * smooth((Math.abs(p.s - q) - 26) / 22));
    if (p.s < 60) p.hw += (1 - smooth(p.s / 60)) * 1.2;              // a wider mouth at the junction
    if (p.s > LENGTH - 30) p.hw += smooth((p.s - LENGTH + 30) / 30) * 2.5;      // and where it opens onto the top
  }
  // ice: 1 in the middle of a sheet, feathered over a few metres at each end
  let start = -1;
  for (let i = 0; i < ROAD.length; i++) {
    const p = ROAD[i];
    if (p.sheet && start < 0) start = p.s;
    if (!p.sheet) { start = -1; continue; }
    p.ice = Math.min(smooth((p.s - start) / 6), smooth((p.sheet - p.s) / 6));
  }
}
// The middle of the flat top.
export const SUMMIT = { x: PX, z: PZ, y: TOP };

// ---------- finding the road from a spot ----------
const CELL = 10, REACH = 10.5, grid = new Map(), gk = (cx, cz) => cx * 2048 + cz, gc = (v) => Math.floor(v / CELL) + 1024;
for (let i = 0; i < ROAD.length - 1; i++) {
  const a = ROAD[i], b = ROAD[i + 1];
  for (let cx = gc(Math.min(a.x, b.x) - REACH); cx <= gc(Math.max(a.x, b.x) + REACH); cx++) for (let cz = gc(Math.min(a.z, b.z) - REACH); cz <= gc(Math.max(a.z, b.z) + REACH); cz++) {
    const k = gk(cx, cz); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i);
  }
}
const hit = { d: 0, y: 0, hw: 0, ice: 0, snow: 0, s: 0, i: 0, side: 0, px: 0, pz: 0 };
// The nearest stretch of road within about 10 m: how far off its middle (d), the nearest point of the middle (px, pz), which side (side: +1 right of the way up),
// and the road's own numbers there. Returns null further out. The answer is one shared object: read it, don't keep it.
export function roadAt(x, z) {
  const l = grid.get(gk(gc(x), gc(z))); if (!l) return null;
  let best = 1e9, bi = -1, bt = 0;
  for (const i of l) {
    const a = ROAD[i], b = ROAD[i + 1], dx = b.x - a.x, dz = b.z - a.z, t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    const ex = x - a.x - dx * t, ez = z - a.z - dz * t, d2 = ex * ex + ez * ez;
    if (d2 < best) { best = d2; bi = i; bt = t; }
  }
  if (bi < 0 || best > REACH * REACH) return null;
  const a = ROAD[bi], b = ROAD[bi + 1];
  if ((bi === 0 && bt === 0) || (bi === ROAD.length - 2 && bt === 1)) { const e = bi ? b : a, f = (x - e.x) * e.tx + (z - e.z) * e.tz; if (bi ? f > 0 : f < 0) return null; }      // past either end: the road is over
  hit.d = Math.sqrt(best); hit.i = bi; hit.px = a.x + (b.x - a.x) * bt; hit.pz = a.z + (b.z - a.z) * bt; hit.s = a.s + (b.s - a.s) * bt; hit.y = a.y + (b.y - a.y) * bt; hit.hw = a.hw + (b.hw - a.hw) * bt;
  hit.ice = a.ice + (b.ice - a.ice) * bt; hit.snow = a.snow + (b.snow - a.snow) * bt;
  hit.side = (x - a.x) * -a.tz + (z - a.z) * a.tx > 0 ? 1 : -1;
  return hit;
}
// How far a spot is from the middle of the road, anywhere on the mountain (to the nearest couple of metres, never more than FAR).
const FAR = 64, NS = 4, nw = Math.ceil((AREA.x1 - AREA.x0) / NS) + 2, nh = Math.ceil((AREA.z1 - AREA.z0) / NS) + 2, field = new Float32Array(nw * nh).fill(FAR);
for (const p of ROAD) {
  const ci = Math.round((p.x - AREA.x0) / NS), cj = Math.round((p.z - AREA.z0) / NS), n = Math.ceil(FAR / NS);
  for (let j = Math.max(0, cj - n); j <= Math.min(nh - 1, cj + n); j++) for (let i = Math.max(0, ci - n); i <= Math.min(nw - 1, ci + n); i++) {
    const d = Math.hypot(AREA.x0 + i * NS - p.x, AREA.z0 + j * NS - p.z), k = j * nw + i; if (d < field[k]) field[k] = d;
  }
}
export function nearRoad(x, z) {
  const fx = clamp((x - AREA.x0) / NS, 0, nw - 1.001), fz = clamp((z - AREA.z0) / NS, 0, nh - 1.001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * nw + i;
  return (field[k] * (1 - u) + field[k + 1] * u) * (1 - v) + (field[k + nw] * (1 - u) + field[k + nw + 1] * u) * v;
}

// ---------- the mountain itself ----------
// Rough ground: big swells, smaller knuckles and, high up, sharp crags. It calms down towards the road, so the ledge
// is cut into a clean slope, and there is none at all on the flat top or down in the col.
const rough = (x, z) => (noise2(x * .015, z * .015) - .5) * 26 + (noise2(x * .043 + 9, z * .043) - .5) * 11 + (noise2(x * .12 + 31, z * .12) - .5) * 3.2;
const crag = (x, z) => { const n = 1 - Math.abs(2 * noise2(x * .028 + 50, z * .028 + 7) - 1); return n * n * 10; };
export function wild(x, z) {
  const dx = x - PX, dz = z - PZ, d = Math.hypot(dx, dz), th = Math.atan2(dz, dx);
  let y = cone(d, th);
  const past = d - R0 * lobe(th, 1) - 50;                        // out beyond the foot of the cone the col behind the ridge falls away into the sea
  if (past > 0) y = FOOT + (y - FOOT) * (1 - smooth(past / 110));
  const amp = clamp((y - 34) / 60, 0, 1) * smooth((nearRoad(x, z) - 5) / 30);
  if (amp > 0) y += amp * (rough(x, z) + clamp((y - 110) / 60, 0, 1) * crag(x, z));
  if (d < RIM) y = TOP + (y - TOP) * smooth((d - FLAT) / (RIM - FLAT));
  if (d < HORN.r) y += HORN.h * Math.pow(smooth(1 - d / HORN.r), 1.3) * (.9 + .25 * noise2(x * .2, z * .2));
  return y;
}
// East of the seam the mountain fades into the ridge that was always there, except at the notch, where it cuts right through.
function mask(x, z) {
  const e = 1 - smooth((Math.abs(z - GATE.z) - 12) / 40);
  return smooth((SEAM + NOTCH * e - x) / (8 + 16 * (1 - e)));
}
const SHOULDER = .4;
export const ribbonHalf = (hw) => Math.min(hw + 6.4, 10.2);      // how far out from its middle the road's own mesh reaches (snowpeak.js draws it; the land under it is sunk out of sight)
// The land's meshes are grids too coarse to follow the ledge, so under the road's mesh they are not drawn at all. A
// corner of a grid that falls under it is moved straight out sideways to just inside the mesh's rim, where the land
// takes over again: tuck() says where to (in the shared `tucked`), or returns null for a corner that is not under the road.
export const tucked = { x: 0, z: 0, y: 0 };
export function tuck(x, z) {
  const r = roadAt(x, z); if (!r || r.s <= .5 || r.s >= LENGTH - 3.5) return null;
  const rim = ribbonHalf(r.hw) - .15; if (r.d >= rim + .3) return null;
  let dx = x - r.px, dz = z - r.pz; const p = ROAD[r.i];
  if (r.d < .05) { dx = -p.tz; dz = p.tx; } else { dx /= r.d; dz /= r.d; }
  tucked.x = r.px + dx * rim; tucked.z = r.pz + dz * rim; tucked.y = landY(tucked.x, tucked.z) - .1;
  return tucked;
}
// The land with the road cut into it: level across the road, then a bank up to (or down to) the mountainside.
function height(x, z, base) {
  const m = mask(x, z); if (m <= 0) return base;
  let y = base + (wild(x, z) - base) * m;
  const r = roadAt(x, z); if (!r) return y;
  const e = r.d - r.hw - SHOULDER; if (e <= 0) return r.y;
  const t = e / (y > r.y ? SNOW.cut : SNOW.fill); if (t >= 1) return y;
  return r.y + (y - r.y) * (1 - (1 - t) * (1 - t));
}
// What the ground is: 'ice', 'snow' (packed, on the road), 'dirt' (the road below the snow line), 'powder' (snow off the road) or 'rock'.
export function surface(x, z) {
  if (mask(x, z) < .5) return null;
  const r = roadAt(x, z);
  if (r && r.d <= r.hw + SHOULDER) return r.ice > .5 ? 'ice' : r.snow > .5 ? 'snow' : 'dirt';
  return wildSnow(x, z) > .5 ? 'powder' : 'rock';
}
// How much snow lies at a spot off the road (0 bare rock ... 1 deep): none low down, patchy at the snow line, less where it is steep.
export function wildSnow(x, z, y = wild(x, z), slope = 0) {
  const n = noise2(x * .03 + 3, z * .03 + 8) + (noise2(x * .11, z * .11 + 5) - .5) * .5;
  return smooth((y - SNOW.snowLine - (n - .5) * 44) / 26) * (1 - .9 * smooth((slope - 1.3) / .5));
}
// How slippery: 0 = tarmac, 1 = sheet ice. Packed snow and loose powder are in between (SNOW.packed, SNOW.powder).
export function slickAt(x, z) {
  if (x > AREA.x1 || x < AREA.x0 || z < AREA.z0 || z > AREA.z1) return 0;
  const r = roadAt(x, z);
  if (r && r.d <= r.hw + SHOULDER + .6) return Math.max(r.ice, r.snow * SNOW.packed);
  return mask(x, z) < .5 ? 0 : wildSnow(x, z) * SNOW.powder;
}
// The edge of the world out here: the mountain's own box, reached only through the notch (wallX = the old west edge).
export const EDGE = { x0: AREA.x0 + 8, z0: AREA.z0 + 8, z1: AREA.z1 - 8, gap: 13 };
export const onMountain = (x, z) => x < AREA.x1 && x > AREA.x0 && z > AREA.z0 && z < AREA.z1 && mask(x, z) > 0;

// Tell the land about it. Called once, before anything is built (districts.js shapeLand).
export function shapeSnow() { setExtraLand({ ...AREA, height, surface }); }
