// The elevated roads: the Sunset Loop around downtown, Highway 6 out to the desert road, and their ramps.
//   planHighway()   lays the routes down as ribbons (terrain.js), so the ground, physics and scenery know
//                   where they run, and works out the lanes that highway traffic and the police follow
//   buildHighway()  draws them (decks, barriers, piers, paint, lamps, signs) and lists their walls for physics
// A route is a line drawn by "driving" it: start somewhere, go straight, turn, shift sideways.
// Angles and sides are the same as for cars: heading h, and "right" is (-sin h, cos h).
import * as THREE from 'three';
import { V } from '../core/utils.js';
import { mats, std, G, mesh } from './materials.js';
import { groundY, landY, addRibbon, ribbonAt, surfaceAt } from './terrain.js';

const PI = Math.PI;
// deck: height of the road above the street. hw / rampHw: half widths. lanes: lane centres, metres from the middle.
export const HWY = { deck: 8.2, hw: 8, rampHw: 3.3, lanes: [1.9, 5.3], thick: 1.3, rampGrade: 52, wallBelow: 4.5 };
const ease = (u) => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);

// ---------- drawing a line by driving it ----------
function trace(x, z, h) {
  let s = 0; const pts = [{ x, z, h, s, y: 0 }];
  const T = {
    pts,
    line(len, step = 4) {
      const n = Math.max(1, Math.round(len / step)), d = len / n;
      for (let i = 0; i < n; i++) { x += Math.cos(h) * d; z += Math.sin(h) * d; s += d; pts.push({ x, z, h, s, y: 0 }); }
      return T;
    },
    // turn through `ang` radians on radius r; positive turns toward the right-hand side
    arc(r, ang) {
      const n = Math.max(2, Math.round(Math.abs(ang) * r / 3)), da = ang / n, sg = Math.sign(ang);
      const cx = x - sg * r * Math.sin(h), cz = z + sg * r * Math.cos(h);
      for (let i = 0; i < n; i++) { h += da; x = cx + sg * r * Math.sin(h); z = cz - sg * r * Math.cos(h); s += r * Math.abs(da); pts.push({ x, z, h, s, y: 0 }); }
      return T;
    },
    // slide `d` metres sideways (positive = right) through a gentle S
    shift(d, a = .4) { const r = Math.abs(d) / (2 * (1 - Math.cos(a))), sg = Math.sign(d); return T.arc(r, sg * a).arc(r, -sg * a); },
    height(fn) { for (const p of pts) p.y = fn(p.s, p); return T; },
    get length() { return s; },
  };
  return T;
}
const right = (p, o) => ({ x: p.x - Math.sin(p.h) * o, z: p.z + Math.cos(p.h) * o });

// ---------- lanes: lines for drivers to follow ----------
// { pts: [{x, z, y, v}], cum, len, speed, loop, next: { lane, s } | null, exits: [{ s, to, p }], grid, entry }
function makeLane(name, pts, speed, o = {}) {
  const L = { name, pts, speed, loop: false, next: null, exits: [], grid: false, entry: null, ...o, cum: [0], len: 0 };
  for (let i = 1; i < pts.length; i++) L.cum.push(L.len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  // how fast each point can be taken: tight bends are slower
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[L.loop ? (i - 1 + n - 1) % (n - 1) : Math.max(0, i - 1)], b = pts[i], c = pts[L.loop ? (i + 1) % (n - 1) : Math.min(n - 1, i + 1)];
    const ab = Math.hypot(b.x - a.x, b.z - a.z), bc = Math.hypot(c.x - b.x, c.z - b.z), ca = Math.hypot(a.x - c.x, a.z - c.z);
    const area = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2;
    const r = area < 1e-6 ? 1e6 : ab * bc * ca / (4 * area);
    b.v = Math.min(b.v ?? speed, speed, Math.sqrt(8 * r));
  }
  return L;
}
// A lane alongside a route: `off` metres to the right of its middle, between distances s0 and s1; dir -1 runs it backwards.
function laneOf(route, off, dir = 1, s0 = -1, s1 = 1e9) {
  const out = [];
  for (const p of route.pts) if (p.s >= s0 - .01 && p.s <= s1 + .01) { const q = right(p, off); out.push({ x: q.x, z: q.z, y: p.y }); }
  return dir < 0 ? out.reverse() : out;
}
const onGround = (list) => list.map(([x, z, v]) => ({ x, z, y: groundY(x, z), v, street: true }));
// Distance along a lane of the point on it nearest to (x, z).
export function laneS(L, x, z) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < L.pts.length - 1; i++) {
    const a = L.pts[i], b = L.pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)), d = Math.hypot(a.x + dx * t - x, a.z + dz * t - z);
    if (d < bd) { bd = d; best = L.cum[i] + Math.sqrt(l2) * t; }
  }
  return best;
}
// The point `s` metres along a lane (wraps on a loop, runs on into the next lane, stops at a dead end).
export function lanePoint(L, s, out = {}) {
  if (L.loop) s = ((s % L.len) + L.len) % L.len;
  else if (s > L.len) { if (L.next) return lanePoint(L.next.lane, L.next.s + s - L.len, out); s = L.len; }
  else if (s < 0) s = 0;
  let lo = 0, hi = L.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L.cum[m] <= s) lo = m; else hi = m; }
  const a = L.pts[lo], b = L.pts[hi], t = (s - L.cum[lo]) / (L.cum[hi] - L.cum[lo] || 1);
  out.x = a.x + (b.x - a.x) * t; out.z = a.z + (b.z - a.z) * t; out.y = a.y + (b.y - a.y) * t; out.v = Math.min(a.v, b.v);
  out.h = Math.atan2(b.z - a.z, b.x - a.x); out.lane = L; out.s = s;
  return out;
}

// ---------- the routes ----------
export function planHighway() {
  const D = HWY.deck, routes = [], lanes = [];
  const add = (name, T, hw, o = {}) => {
    const r = { name, pts: T.pts, hw, len: T.length, rank: 1, ...o };
    r.rib = addRibbon(r.pts, hw, { road: true, closed: !!o.closed, thick: o.ramp ? .6 : HWY.thick, route: r });
    routes.push(r); return r;
  };

  // The Sunset Loop: a rounded square over downtown's ring road. Drawn in the direction its outer lanes run.
  const lt = trace(122, -162, PI);
  for (let k = 0; k < 4; k++) lt.line(244).arc(40, -PI / 2);
  Object.assign(lt.pts[lt.pts.length - 1], { x: lt.pts[0].x, z: lt.pts[0].z });
  const loop = add('loop', lt.height(() => D), HWY.hw, { closed: true, rank: 3, label: 'SUNSET LOOP' });

  // Highway 6: west from the Loop over the Dustlands, down to the desert road.
  const g6 = groundY(-300, 54) - .12;       // ends just under the ground, so the road rises out of it without a lip
  const h6 = add('h6', trace(-158, 54, PI).line(77).line(65).height((s) => D - (D - g6) * ease((s - 77) / 65)), HWY.hw, { rank: 2, label: 'HIGHWAY 6' });
  // the two corners where Highway 6 meets the Loop (the rail on each follows the turn)
  const fa = add('h6-in', trace(-185.3, 55, 0).arc(22.3, PI / 2).height(() => D), 7, { fillet: true });
  const fb = add('h6-out', trace(-163, 30.7, PI / 2).arc(22.3, PI / 2).height(() => D), 7, { fillet: true });

  // Ramps. Each leaves (or joins) the Loop's outer lane, slides out beside the deck and comes down to the street.
  const G = HWY.rampGrade;
  const offRamp = (name, x, z, h) => {
    const t = trace(x, z, h).shift(6.5), s0 = t.length; t.line(G).line(4);
    const f = t.pts[t.pts.length - 1], gy = groundY(f.x, f.z) - .12;
    return add(name, t.height((s) => D - (D - gy) * ease((s - s0) / G)), HWY.rampHw, { ramp: true, foot: f });
  };
  const onRamp = (name, x, z, h) => {
    const t = trace(x, z, h).line(4).line(G).shift(-6.5), gy = groundY(x, z) - .12;
    return add(name, t.height((s) => gy + (D - gy) * ease((s - 4) / G)), HWY.rampHw, { ramp: true, foot: t.pts[0] });
  };
  const sOff = offRamp('south-off', 118, -167.3, PI), sOn = onRamp('south-on', -26, -173.8, PI);
  const eOff = offRamp('east-off', 167.3, 118, -PI / 2), eOn = onRamp('east-on', 173.8, -26, -PI / 2);

  // ---------- lanes ----------
  const FAST = 25, lane = (name, pts, speed, o) => { const L = makeLane(name, pts, speed, o); lanes.push(L); return L; };
  const [a, b] = HWY.lanes;
  const out2 = lane('loop outer', laneOf(loop, b), FAST, { loop: true, main: true }), out1 = lane('loop outer 2', laneOf(loop, a), FAST, { loop: true, main: true });
  const in1 = lane('loop inner', laneOf(loop, -a, -1), FAST, { loop: true, main: true }), in2 = lane('loop inner 2', laneOf(loop, -b, -1), FAST, { loop: true, main: true });
  out2.side = out1; out1.side = out2; in1.side = in2; in2.side = in1;
  const centre = (r) => r.pts.map(p => ({ x: p.x, z: p.z, y: p.y }));
  const join = (L) => { const e = L.pts[L.pts.length - 1]; L.next = { lane: out2, s: laneS(out2, e.x, e.z) }; };
  const leave = (L, p) => out2.exits.push({ s: laneS(out2, L.pts[0].x, L.pts[0].z), to: L, p });
  // off the Loop: down the ramp, then onto the ring road underneath (where the driver rejoins ordinary traffic)
  leave(lane('south exit', [...centre(sOff), ...onGround([[22, -171.2, 9], [14, -166.6, 8], [8, -164.6, 8], [3, -164.6, 8]])], 14, { grid: true }), .3);
  leave(lane('east exit', [...centre(eOff), ...onGround([[171.2, 22, 9], [166.6, 14, 8], [164.6, 8, 8], [164.6, 3, 8]])], 14, { grid: true }), .3);
  // onto the Loop: ordinary traffic passing the foot of a ramp may take it
  const sIn = lane('south entrance', [...onGround([[-9, -164.6, 9], [-14, -165.6, 9], [-20, -170, 9]]), ...centre(sOn)], 16, { entry: { x: -9, z: -164.6, h: PI } }); join(sIn);
  const eIn = lane('east entrance', [...onGround([[164.6, -9, 9], [165.6, -14, 9], [170, -20, 9]]), ...centre(eOn)], 16, { entry: { x: 164.6, z: -9, h: -PI / 2 } }); join(eIn);
  // Highway 6 westbound: off the Loop round the corner, along the south side, right onto the desert road
  const hOut = lane('highway 6 west', [
    ...trace(-167.3, 30.7, PI / 2).arc(18, PI / 2).pts.map(p => ({ x: p.x, z: p.z, y: D })),
    ...laneOf(h6, b, 1, 28),
    ...onGround([[-308, 48.7, 10], [-315.4, 48.7, 7], [-319.6, 46.9, 6], [-321.4, 42.7, 6], [-321.4, 34, 8]]),
  ], 22, { grid: true });
  leave(hOut, .35);
  // ...and eastbound: off the desert road, along the north side, round the corner onto the Loop
  const hIn = lane('highway 6 east', [
    ...onGround([[-321.4, 74, 7], [-321.4, 66, 6], [-319.6, 61.1, 6], [-315.4, 59.3, 7], [-308, 59.3, 10]]),
    ...laneOf(h6, -b, -1, 28),
    ...trace(-185.3, 59.3, 0).arc(18, PI / 2).pts.map(p => ({ x: p.x, z: p.z, y: D })),
  ], 22, { entry: { x: -321.4, z: 74, h: -PI / 2 } });
  join(hIn);

  // patches of tarmac at ground level that tie the ramps into the streets: [x0, z0, x1, z1]
  const aprons = [[6, -178, 36, -169], [-34, -178, -6, -169], [169, 6, 178, 36], [169, -34, 178, -6], [-317, 45, -298, 63]];
  return { routes, lanes, aprons, loop, h6, entries: [sIn, eIn, hIn], main: [out2, out1, in1, in2] };
}

// ---------- drawing ----------
// Triangles are collected per material per 108 m square, so the whole highway is a few dozen draw calls.
function makeBatch() {
  const chunks = new Map();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
  const target = (mat, x, z) => { const k = mat.uuid + '|' + Math.floor((x + 432) / 108) + ',' + Math.floor((z + 432) / 108); let t = chunks.get(k); if (!t) chunks.set(k, t = { mat, pos: [], nor: [], uv: [], col: [] }); return t; };
  return {
    // a four-cornered face; (hx, hy, hz) is roughly the way it should face
    quad(mat, p0, p1, p2, p3, hx, hy, hz, color = null) {
      e1.subVectors(p1, p0); e2.subVectors(p3, p0); n.crossVectors(e1, e2);
      if (n.lengthSq() < 1e-10) { e2.subVectors(p2, p0); n.crossVectors(e1, e2); }
      if (n.x * hx + n.y * hy + n.z * hz < 0) { const t = p1; p1 = p3; p3 = t; n.negate(); }
      n.normalize();
      const t = target(mat, (p0.x + p2.x) / 2, (p0.z + p2.z) / 2), flat = Math.abs(n.y) > .7;
      for (const p of [p0, p1, p2, p0, p2, p3]) {
        t.pos.push(p.x, p.y, p.z); t.nor.push(n.x, n.y, n.z);
        if (mat === mats.asphalt) t.uv.push(p.x / 420, p.z / 420); else if (flat) t.uv.push(p.x / 6, p.z / 6); else t.uv.push((p.x + p.z) / 6, p.y / 6);
        if (color) t.col.push(color.r, color.g, color.b);
      }
    },
    finish(scene, cast = true) {
      const made = [];
      for (const t of chunks.values()) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(t.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(t.nor, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(t.uv, 2)); if (t.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(t.col, 3));
        const m = new THREE.Mesh(g, t.mat); m.castShadow = cast && !t.col.length; m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m);
        g.computeBoundingSphere(); made.push(m);
      }
      return made;
    },
  };
}

// A highway sign: white on green, up to two lines.
function signBoard(api, lines, w, h, bg = '#17734c') {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const x = c.getContext('2d'), W = c.width, H = c.height;
  x.fillStyle = bg; x.beginPath(); x.roundRect(4, 4, W - 8, H - 8, 28); x.fill();
  x.lineWidth = 10; x.strokeStyle = '#ffffff'; x.beginPath(); x.roundRect(16, 16, W - 32, H - 32, 20); x.stroke();
  x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((text, i) => {
    let size = Math.round(H / (lines.length + .9) * (i ? .8 : 1)); x.font = `900 ${size}px "Archivo Black",Impact,sans-serif`;
    const tw = x.measureText(text).width; if (tw > W - 90) x.font = `900 ${Math.floor(size * (W - 90) / tw)}px "Archivo Black",Impact,sans-serif`;
    x.fillText(text, W / 2, H * (i + .5) / lines.length + (lines.length > 1 ? (i ? -H * .03 : H * .04) : 4));
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
  api.signMats.push(m.material); return m;
}

export function buildHighway(hw, api) {
  const { scene, realScene, solids, lampPts, IB, mat4 } = api, B = makeBatch(), P = makeBatch();
  const stripe = std({ color: 0x2f9c8f, roughness: .7 }), concrete = mats.concrete, wall = mats.trim;
  const white = new THREE.Color(0xf4f4f0), yellow = new THREE.Color(0xf2c230);
  solids.walls = solids.walls || [];
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

  for (const r of hw.routes) {
    const pts = r.pts, HWd = r.hw, thick = r.rib.thick, inner = HWd - .45;
    const at = (i, o, dy) => { const p = pts[i]; return v3(p.x - Math.sin(p.h) * o, p.y + dy, p.z + Math.cos(p.h) * o); };
    const strip = (mat, i, oa, ya, ob, yb, hint) => {
      const p = pts[i], sx = -Math.sin(p.h), sz = Math.cos(p.h);
      B.quad(mat, at(i, oa, ya), at(i, ob, yb), at(i + 1, ob, yb), at(i + 1, oa, ya), sx * hint[0], hint[1], sz * hint[0]);
    };
    const runs = { '-1rail': null, '1rail': null, '-1low': null, '1low': null };
    const wallRun = (key, kind, x0, z0, x1, z1, h) => {
      const head = Math.atan2(z1 - z0, x1 - x0), cur = runs[key];
      if (cur && Math.abs(cur.head - head) < 1e-4 && Math.hypot(cur.x1 - x0, cur.z1 - z0) < .05 && Math.hypot(x1 - cur.x0, z1 - cur.z0) < 30) { cur.x1 = x1; cur.z1 = z1; cur.h = Math.max(cur.h, h); return; }
      flush(key); runs[key] = { kind, x0, z0, x1, z1, head, h };
    };
    const flush = (key) => {
      const c = runs[key]; if (!c) return; runs[key] = null;
      solids.walls.push({ x: (c.x0 + c.x1) / 2, z: (c.z0 + c.z1) / 2, hl: Math.hypot(c.x1 - c.x0, c.z1 - c.z0) / 2 + .06, ht: .22, rot: c.head, kind: c.kind, h: c.h });
    };

    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], my = (p.y + q.y) / 2, mh = Math.atan2(q.z - p.z, q.x - p.x);
      const mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2, sx = -Math.sin(mh), sz = Math.cos(mh);
      strip(mats.asphalt, i, -HWd, 0, HWd, 0, [0, 1]);
      const high = my - thick - groundY(mx, mz);             // room underneath the middle
      for (const side of [-1, 1]) {
        const ex = mx + sx * side * (HWd - .22), ez = mz + sz * side * (HWd - .22);
        const open = ribbonAt(ex, ez, my, .8, .3, r.rib), above = my - groundY(ex, ez);
        if (!open) {
          // barrier: inner face, top, then the outer face with its stripe
          strip(wall, i, side * inner, 0, side * inner, .85, [-side, 0]);
          strip(wall, i, side * inner, .85, side * HWd, .85, [0, 1]);
          if (above > .25) {
            strip(wall, i, side * HWd, .85, side * HWd, .4, [side, 0]); strip(stripe, i, side * HWd, .4, side * HWd, .1, [side, 0]);
            strip(wall, i, side * HWd, .1, side * HWd, -Math.min(r.ramp ? thick : .45, above), [side, 0]);
          } else strip(wall, i, side * HWd, .85, side * HWd, 0, [side, 0]);
          // what stops you driving off the edge: a rail for the upper level, a wall for the street while the deck is low
          const a0 = at(i, side * (HWd - .22), 0), a1 = at(i + 1, side * (HWd - .22), 0);
          if (above > 1.2) wallRun(side + 'rail', 'rail', a0.x, a0.z, a1.x, a1.z, 1); else flush(side + 'rail');
          if (above < HWY.wallBelow) wallRun(side + 'low', 'low', a0.x, a0.z, a1.x, a1.z, above + .85); else flush(side + 'low');
        } else { flush(side + 'rail'); flush(side + 'low'); }
        if (high < .2) continue;                                  // at street level there is nothing underneath
        // the underside: a box girder for the wide decks, a slab for the ramps
        const foot = r.ramp ? HWd : HWd * .58;
        if (!r.ramp) strip(concrete, i, side * HWd, -.45, side * foot, -thick, [side, -.6]);
        if (side === 1) strip(concrete, i, -foot, -thick, foot, -thick, [0, -1]);
        // close in the space under a low deck so nobody drives into the wedge
        if (above - thick < HWY.wallBelow && above > .3 && !open) {
          const o = side * (r.ramp ? HWd : HWd - .1), t0 = at(i, o, r.ramp ? -thick : -.45), t1 = at(i + 1, o, r.ramp ? -thick : -.45);
          const b0 = v3(t0.x, Math.min(t0.y, groundY(t0.x, t0.z) - .3), t0.z), b1 = v3(t1.x, Math.min(t1.y, groundY(t1.x, t1.z) - .3), t1.z);
          B.quad(concrete, t0, t1, b1, b0, sx * side, 0, sz * side);
        }
      }
    }
    for (const k in runs) flush(k);

    // ---------- paint ----------
    const line = (o, w, color, edge, dash = 0) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], q = pts[i + 1];
        if (dash && Math.floor(p.s / dash) % 3) continue;
        const mx = (p.x + q.x) / 2 - Math.sin(p.h) * o, mz = (p.z + q.z) / 2 + Math.cos(p.h) * o, other = ribbonAt(mx, mz, (p.y + q.y) / 2, .8, 0, r.rib);
        if (other && (edge || other.route.rank > r.rank || (other.route.rank === r.rank && other.id < r.rib.id))) continue;
        P.quad(mats.roadPaint, at(i, o - w / 2, .035), at(i, o + w / 2, .035), at(i + 1, o + w / 2, .035), at(i + 1, o - w / 2, .035), 0, 1, 0, color);
      }
    };
    if (r.ramp) { line(-2.55, .14, white, true); line(2.55, .14, yellow, true); }
    else if (!r.fillet) {
      line(-.18, .14, yellow, false); line(.18, .14, yellow, false);
      line(-3.6, .14, white, false, 4); line(3.6, .14, white, false, 4);
      line(-7.15, .14, white, true); line(7.15, .14, white, true);
    }

    // ---------- piers, lamps ----------
    // nothing may stand where traffic swings between a ramp's foot and the street
    const inTheWay = (x, z, m) => hw.lanes.some(L => L.pts.some((b, i) => {
      const a = L.pts[i - 1]; if (!a || !(a.street || b.street)) return false;
      const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
      return Math.hypot(a.x + dx * t - x, a.z + dz * t - z) < m;
    }));
    const sample = (s, out = {}) => {
      let i = 0; while (i < pts.length - 2 && pts[i + 1].s < s) i++;
      const a = pts[i], b = pts[i + 1], t = Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s || 1)));
      out.x = a.x + (b.x - a.x) * t; out.z = a.z + (b.z - a.z) * t; out.y = a.y + (b.y - a.y) * t; out.h = a.h + (b.h - a.h) * t; return out;
    };
    r.sample = sample;
    if (r.fillet) continue;
    const free = (x, z, m = 1.1) => surfaceAt(x, z) !== 'road' && !inTheWay(x, z, m + 2.6) && !solids.posts.some(o => Math.abs(o.x - x) < m + o.r && Math.abs(o.z - z) < m + o.r)
      && !solids.boxes.some(o => Math.abs(o.x - x) < o.hw + m && Math.abs(o.z - z) < o.hd + m);
    const column = (x, z, top, w) => {
      const g = groundY(x, z) - .4; if (top - g < 1) return;
      mesh(G.box, concrete, V(x, (top + g) / 2, z), V(w, top - g, w), scene); solids.posts.push({ x, z, r: w * .62, h: top });
    };
    for (let s = r.ramp ? 6 : 5.4; s < r.len - 2; s += r.ramp ? 9.6 : 10.8) {
      for (const ds of [0, 2.4, -2.4, 4.4, -4.4]) {
        const c = sample(s + ds), under = c.y - thick, room = under - groundY(c.x, c.z);
        if (room < (r.ramp ? HWY.wallBelow - .4 : 1.6)) break;       // low enough to be walled in instead
        if (ribbonAt(c.x, c.z, 0, 1e3, 0, r.rib)?.route.rank > r.rank && r.ramp) continue;
        if (free(c.x, c.z)) {            // one pier under the middle, with a hammerhead for the wide decks
          const g = new THREE.Group(); g.position.set(c.x, 0, c.z); g.rotation.y = -c.h; scene.add(g);
          if (!r.ramp) mesh(G.box, concrete, V(0, under - .55, 0), V(1.7, 1.1, r.hw * 1.16), g);
          column(c.x, c.z, under - (r.ramp ? 0 : .5), r.ramp ? .8 : 1.5); break;
        }
        if (r.ramp) continue;
        const l = right(c, -(r.hw - .6)), rt = right(c, r.hw - .6);
        if (free(l.x, l.z, .7) && free(rt.x, rt.z, .7)) {      // a road runs underneath: a leg each side and a beam across
          const g = new THREE.Group(); g.position.set(c.x, 0, c.z); g.rotation.y = -c.h; scene.add(g);
          mesh(G.box, concrete, V(0, under - .5, 0), V(1.3, 1, r.hw * 2 - .2), g);
          column(l.x, l.z, under - .9, .95); column(rt.x, rt.z, under - .9, .95); break;
        }
      }
    }
    // lamps along the right-hand barrier, and every other one on the left for the wide decks
    for (let s = 12, k = 0; s < r.len - 6; s += r.ramp ? 26 : 18, k++) {
      const c = sample(s), side = r.ramp ? 1 : k % 2 ? -1 : 1, e = right(c, side * (r.hw - .2));
      if (c.y - groundY(e.x, e.z) < 2 || ribbonAt(e.x, e.z, c.y, .8, .3, r.rib)) continue;
      const ix = Math.sin(c.h) * side, iz = -Math.cos(c.h) * side;          // toward the road
      IB.pole.add(mat4(V(e.x, c.y + 3.6, e.z), V(.1, 7.2, .1)));
      IB.arm.add(mat4(V(e.x + ix * 1.1, c.y + 7.15, e.z + iz * 1.1), V(2.3, .12, .12), -Math.atan2(iz, ix)));
      IB.lamp.add(mat4(V(e.x + ix * 2.2, c.y + 7.02, e.z + iz * 2.2), V(.8, .2, .42), -Math.atan2(iz, ix)));
      lampPts.push(V(e.x + ix * 2.2, c.y + 6.8, e.z + iz * 2.2));
    }
  }

  // ---------- tarmac at the feet of the ramps ----------
  for (const [x0, z0, x1, z1] of hw.aprons) {
    const nx = Math.ceil((x1 - x0) / 4), nz = Math.ceil((z1 - z0) / 4), pt = (a, b) => { const x = x0 + (x1 - x0) * a / nx, z = z0 + (z1 - z0) * b / nz; return v3(x, landY(x, z) + .06, z); };
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) B.quad(mats.asphalt, pt(a, b), pt(a + 1, b), pt(a + 1, b + 1), pt(a, b + 1), 0, 1, 0);
  }

  // ---------- signs ----------
  // An overhead sign across a route `s` metres along it, read by drivers heading the way the route was drawn (dir 1) or against it (-1).
  const gantry = (r, s, dir, lines, w = 8.6, h = 2.5) => {
    const c = r.sample(s), g = new THREE.Group(); g.position.set(c.x, c.y, c.z); g.rotation.y = -c.h; scene.add(g);
    for (const o of [-(r.hw - .2), r.hw - .2]) mesh(G.box, mats.darkMetal, V(0, 3.4, o), V(.28, 6.8, .28), g);
    mesh(G.box, mats.darkMetal, V(0, 6.7, 0), V(.3, .5, r.hw * 2 - .2), g, false);
    const b = signBoard(api, lines, w, h); b.position.set(c.x - Math.cos(c.h) * .3 * dir, c.y + 5.6, c.z - Math.sin(c.h) * .3 * dir);
    const off = right(c, dir * r.hw * .47); b.position.x += off.x - c.x; b.position.z += off.z - c.z;
    b.rotation.y = Math.atan2(-Math.cos(c.h) * dir, -Math.sin(c.h) * dir); realScene.add(b);
  };
  // A sign on two posts beside a road at street level, facing (fx, fz).
  const roadside = (x, z, fx, fz, lines, w = 6.4, h = 2.2, bg) => {
    const y = groundY(x, z), b = signBoard(api, lines, w, h, bg); b.position.set(x, y + 4.1, z); b.rotation.y = Math.atan2(fx, fz); realScene.add(b);
    for (const o of [-w * .36, w * .36]) { const px = x + fz * o - fx * .12, pz = z - fx * o - fz * .12; mesh(G.box, mats.darkMetal, V(px, y + 2.1, pz), V(.16, 4.2, .16), scene); solids.posts.push({ x: px, z: pz, r: .14, h: 5 }); }
  };
  const L = hw.loop, side = 244 + 20 * PI;
  gantry(L, hw.loop.len - 26, 1, ['PALM PROMENADE · BEACH', 'EXIT ↘']);
  gantry(L, side * 3 - 22, 1, ['PORT SUNSET', 'EXIT ↘']);
  gantry(L, side + 152.7 - 34, 1, ['HIGHWAY 6 WEST', 'THE DUSTLANDS ↘']);
  gantry(L, side * 2 + 100, 1, ['SUNSET LOOP', 'PORT SUNSET · BEACH AHEAD'], 9.4);
  gantry(hw.h6, 46, -1, ['SUNSET LOOP', 'DOWNTOWN']);
  roadside(-20, -180.5, 1, 0, ['SUNSET LOOP ↖'], 5.2, 1.7); roadside(180.5, -20, 0, 1, ['SUNSET LOOP ↖'], 5.2, 1.7);
  roadside(-311, 66.5, -.6, .8, ['HIGHWAY 6 EAST', 'DOWNTOWN · SUNSET LOOP']);

  hw.meshes = [...B.finish(realScene), ...P.finish(realScene, false)];
  return hw;
}

// The radar's picture of the elevated roads, drawn over the street plan (one pixel per metre).
export function paintHighway(g, half, hw) {
  g.lineJoin = 'round'; g.lineCap = 'butt';
  for (const pass of [0, 1]) for (const r of hw.routes) {
    g.beginPath(); r.pts.forEach((p, i) => i ? g.lineTo(p.x + half, p.z + half) : g.moveTo(p.x + half, p.z + half));
    if (pass === 0) { g.strokeStyle = '#23262d'; g.lineWidth = r.hw * 2 + 2.5; }
    else { g.strokeStyle = r.ramp ? '#767c88' : '#8b919d'; g.lineWidth = r.hw * 2 - 1; }
    g.stroke();
  }
  g.strokeStyle = '#f2c230'; g.lineWidth = 1;
  for (const r of hw.routes) if (!r.ramp && !r.fillet) { g.beginPath(); r.pts.forEach((p, i) => i ? g.lineTo(p.x + half, p.z + half) : g.moveTo(p.x + half, p.z + half)); g.stroke(); }
}
