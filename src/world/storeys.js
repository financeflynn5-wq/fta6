// The floors above the shop. interiors.js opens a building's ground floor; this file opens the storeys over it:
//   - the painted wall above the shop front is swapped for real walls with real window openings
//   - every storey gets a floor (a ribbon, terrain.js, so you stand on it the way you stand on a bridge), a ceiling and lights
//   - a stair bay runs up one side wall: one straight flight per storey, all stacked in the same bay
//   - walls, banisters and furniture upstairs are 'storey' colliders (core/physics.js): each floor has its own set
//   - the roof, where the building has one you can reach: a parapet, a door back down, and a plank to jump off
// What stands in each room is rooms.js's business; this file only gives it somewhere to stand.
import * as THREE from 'three';
import { V } from '../core/utils.js';
import { mats, std, G, mesh, ctex } from './materials.js';
import { addRibbon } from './terrain.js';
import { storeyBit } from '../core/physics.js';

// shop: height of the ground floor; rise: metres per storey above it; slab: floor thickness; bayW / run: the stair bay;
// b0: how far back from the front wall the stairs start; inset: lot edge to the inside face of an upstairs wall
export const STOREY = { shop: 4.6, rise: 3.4, slab: .3, bayW: 1.5, run: 6, b0: 2.4, wall: .25, inset: .4, clear: 3.1, tile: 2.4 };
const S = STOREY;

// Where the stair bay is, in the room's own coordinates (a along the front, b back from it). side: +1 = on the right as you walk in.
export function bayOf(shop, L, D) {
  const hwU = L / 2 - S.inset;
  return { side: shop.bay === -1 ? -1 : 1, hwU, a0: hwU - S.bayW, a1: hwU, ac: hwU - S.bayW / 2, b0: S.b0, b1: S.b0 + S.run, n: shop.up.length };
}
// Height of upper floor k above the pavement (k = 1 is the first floor up).
export const floorY = (k) => S.shop + (k - 1) * S.rise;

const GEM = new THREE.OctahedronGeometry(1, 0);
let MM = null;
function materials() {
  if (MM) return MM;
  const floor = (map, rough = .6) => std({ map, color: 0xffffff, roughness: rough, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .14 });
  const planks = (a, b, c) => ctex(256, (x, s) => {
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 3 === 1 ? c : a; x.fillRect(0, i * s / 8, s, s / 8); }
    x.strokeStyle = b; x.lineWidth = 2; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(0, i * s / 8); x.lineTo(s, i * s / 8); x.stroke(); }
    for (let i = 0; i < 8; i++) { const o = ((i * 5) % 8) * s / 8 + 9; x.beginPath(); x.moveTo(o, i * s / 8); x.lineTo(o, (i + 1) * s / 8); x.stroke(); }
  });
  const tiles = (a, b, n = 2, line = null) => ctex(256, (x, s) => {
    const c = s / n; x.fillStyle = a; x.fillRect(0, 0, s, s); x.fillStyle = b;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2) x.fillRect(i * c, j * c, c, c);
    if (line) { x.strokeStyle = line; x.lineWidth = 2; for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * c, 0); x.lineTo(i * c, s); x.stroke(); x.beginPath(); x.moveTo(0, i * c); x.lineTo(s, i * c); x.stroke(); } }
  });
  const carpet = (a, b) => ctex(128, (x, s) => { x.fillStyle = a; x.fillRect(0, 0, s, s); x.fillStyle = b; for (let i = 0; i < 220; i++) x.fillRect((i * 53) % s, (i * 97) % s, 2, 2); });
  MM = {
    floors: {
      wood: floor(planks('#b98a5a', '#7d5a38', '#ad7f52')), oak: floor(planks('#d2ad7c', '#9a7a52', '#c9a371')), dark: floor(planks('#6a4a36', '#3f2a1e', '#5f4230')),
      tile: floor(tiles('#eef0ee', '#cfd8d6', 4), .45), check: floor(tiles('#f3ede2', '#2b2f38', 4), .4), marble: floor(tiles('#f3ece0', '#e6dcc8', 2, '#cdbf9f'), .25),
      blue: floor(carpet('#3f5873', '#4a6583'), .95), red: floor(carpet('#8a2f3f', '#99394a'), .95), grey: floor(carpet('#6b7078', '#787d86'), .95), green: floor(carpet('#3f6f58', '#4a7d64'), .95),
      rubber: floor(tiles('#33373f', '#2b2f36', 4, '#444a54'), .9), club: floor(tiles('#1b1730', '#241d40', 4), .3), lino: floor(tiles('#dfe7ea', '#cfdde2', 4, '#b9cbd2'), .5),
      concrete: floor(carpet('#b7b2a8', '#aaa59b'), .9),
    },
    window: std({ color: 0xa9cfdc, roughness: .05, metalness: .45, transparent: true, opacity: .26, depthWrite: false }),
  };
  return MM;
}
// A unit box whose top face carries a texture laid out in metres (so two pieces of one floor line up).
function tiledBox(cx, cz, sx, sz) {
  const g = G.box.clone(), uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + pos.getX(i) * sx) / S.tile, (cz + pos.getZ(i) * sz) / S.tile);
  return g;
}

// c: what interiors.js knows about the building (see the call there). floorOf(k, F): rooms.js furnishes floor k.
export function buildStoreys(c, furnish) {
  const { shop, lot, room, L, D, fx, fz, raw, P, Sc, world, solids, spots, m, bay, IB } = c, M = materials();
  const n = bay.n, side = bay.side, { hwU, a0, a1, ac, b0, b1 } = bay, top = floorY(n + 1), roofY = lot.h + .7;
  const bit = (k) => storeyBit(k - 1), allBits = Array.from({ length: n }, (_, i) => bit(i + 1)).reduce((x, y) => x | y, 0), roofBit = storeyBit(n);
  const W = (a, b) => world(side * a, b);
  // a box in the room's own coordinates (a mirrored when the bay is on the left)
  const put = (mat, a, y, b, sa, sy, sb, geo = G.box, cast = false) => raw(mat, P(side * a, y, b), Sc(sa, sy, sb), cast, geo);
  const flat = (mat, a0, a1, b0, b1, y, th) => {         // a floor or ceiling piece, textured in metres when it has a picture
    const p = P(side * (a0 + a1) / 2, y, (b0 + b1) / 2), s = Sc(a1 - a0, th, b1 - b0);
    raw(mat, p, s, false, mat.map ? tiledBox(lot.x + p.x, lot.z + p.z, s.x, s.z) : G.box);
  };
  // a collider for people upstairs: on floors k0..k1, between heights y0 and y1 above the pavement (y1 = y0: never in the way of a look or a shot)
  const swall = (a, b, sa, sb, bits, y0 = 1e9, y1 = 1e9) => {
    const p = W(a, b), wx = fx ? sb : sa, wz = fx ? sa : sb;
    solids.walls.push({ x: p.x, z: p.z, hl: Math.max(wx, wz) / 2, ht: Math.min(wx, wz) / 2, rot: wx >= wz ? 0 : Math.PI / 2, kind: 'storey', bits, y0: y0 > 1e8 ? 1e9 : lot.y + y0, h: y1 > 1e8 ? 1e9 : lot.y + y1 });
  };
  const deck = (ra0, ra1, rb0, rb1, y, info) => {
    const am = (ra0 + ra1) / 2, bm = (rb0 + rb1) / 2, long = rb1 - rb0 >= ra1 - ra0;
    const pts = (long ? [W(am, rb0), W(am, rb1)] : [W(ra0, bm), W(ra1, bm)]).map(p => ({ x: p.x, z: p.z, y: lot.y + y }));
    return addRibbon(pts, Math.min(rb1 - rb0, ra1 - ra0) / 2, info);
  };
  // the three rectangles of a floor that has the stair bay cut out of it
  const round = (ra0, ra1, rb0, rb1, fn) => { fn(ra0, a0, rb0, rb1); fn(a0, ra1, rb0, b0); fn(a0, ra1, b1, rb1); };

  // ---------- the outside wall above the shop: real walls, real windows ----------
  const g = lot.g, w = lot.w, d = lot.d, fm = lot.fm, th = S.wall, wallCol = (f) => c.tinted(c.wallColour(f + 1));
  g.remove(lot.upper); g.remove(lot.belt);
  mesh(G.box, fm, V(0, (top + lot.h) / 2, 0), V(w - .3, lot.h - top, d - .3), g);                       // what is left of the old wall, over the top floor you can reach
  for (const s of [-1, 1]) {                                                                              // the belt over the shop, as a ring
    mesh(G.box, mats.trim, V(0, S.shop + .15, s * (d / 2 - .15)), V(w + .3, .35, .6), g); mesh(G.box, mats.trim, V(s * (w / 2 - .15), S.shop + .15, 0), V(.6, .35, d - .9), g);
  }
  lot.bands.forEach((band) => { if (band.position.y <= top) g.remove(band); });                      // a band would run straight across the new windows
  const swaps = [];                    // painted windows to hide while the real ones are showing: [which batch, which one]
  for (const [ffx, ffz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const len = ffx ? d : w, cols = Math.max(2, Math.floor(len / 3.2)), step = len / cols, off = (ffx ? w : d) / 2 - .15 - th / 2, e = ffx ? (d - .3) / 2 : (w - .3) / 2 - th;
    const at = (u, y, o) => ffx ? V(ffx * o, y, u) : V(u, y, ffz * o), sz = (ul, sy, t) => ffx ? V(t, sy, ul) : V(ul, sy, t);
    const piece = (u0, u1, y0, y1) => mesh(G.box, fm, at((u0 + u1) / 2, (y0 + y1) / 2, off + .02), sz(u1 - u0, y1 - y0, th - .04), g);
    const lining = (f, u0, u1, y0, y1) => raw(wallCol(f), at((u0 + u1) / 2, (y0 + y1) / 2, off - th / 2 + .02), sz(u1 - u0, y1 - y0, .04));
    piece(-e, e, S.shop, S.shop + .85);
    for (let f = 0; f < n; f++) {
      const y = S.shop + f * S.rise;
      piece(-e, e, y + 2.95, f === n - 1 ? top : y + S.rise + .85);
      lining(f, -e, e, y, y + .85); lining(f, -e, e, y + 2.95, y + S.clear);
      for (let k = 0; k <= cols; k++) {
        const u0 = k === 0 ? -e : -len / 2 + step * (k - .5) + .75, u1 = k === cols ? e : -len / 2 + step * (k + .5) - .75;
        piece(u0, u1, y + .85, y + 2.95); lining(f, u0, u1, y + .85, y + 2.95);
      }
      for (let k = 0; k < cols; k++) {
        const u = -len / 2 + step * (k + .5), yc = y + 1.9;
        raw(M.window, at(u, yc, off), sz(1.5, 2.1, .03));
        for (const s of [-1, 1]) { mesh(G.box, mats.trim, at(u + s * .71, yc, off + .03), sz(.08, 2.1, .2), g, false); mesh(G.box, mats.trim, at(u, yc + s * 1.01, off + .03), sz(1.34, .08, .2), g, false); }
        mesh(G.box, mats.trim, at(u, yc + .42, off + .03), sz(1.34, .05, .1), g, false); mesh(G.box, mats.trim, at(u, yc - .3, off + .03), sz(.05, 1.42, .1), g, false);
      }
    }
    for (const win of lot.wins) if (win.fx === ffx && win.fz === ffz && win.f < n) swaps.push(['frame', win.frame], [win.lit ? 'lit' : 'win', win.pane]);
  }

  // ---------- floors, ceilings, where you can stand ----------
  const iw = L / 2 - c.T;                                                         // half the ground floor's inside width
  const lid = (k) => { const col = c.ceilColour(k); return col === undefined ? m.ceiling : c.tinted(col); };          // the ceiling over floor k
  round(-iw, iw, c.T, D - c.T, (ra0, ra1, rb0, rb1) => flat(lid(0), ra0, ra1, rb0, rb1, (c.CEIL + S.shop - .05) / 2, S.shop - .05 - c.CEIL));
  const floors = [];
  for (let k = 1; k <= n; k++) {
    const y = floorY(k), kind = shop.up[k - 1], fm2 = M.floors[c.floorOf(kind)] || M.floors.wood, info = { thick: S.slab, storey: bit(k) };
    round(-hwU, hwU, S.inset, D - S.inset, (ra0, ra1, rb0, rb1) => {
      flat(fm2, ra0, ra1, rb0, rb1, y - .025, .05);
      if (k > 1) flat(lid(k - 1), ra0, ra1, rb0, rb1, y - .175, .25);
      deck(ra0 - .2, ra1 + (ra1 === hwU ? .2 : .02), rb0 - (rb0 === S.inset ? .2 : 0), rb1 + (rb1 === D - S.inset ? .2 : 0), y, info);
    });
    floors.push({ k, kind, y: lot.y + y, name: c.nameOf(kind, k) });
  }
  flat(lid(n), -hwU, hwU, S.inset, D - S.inset, top - .15, .3);                                 // over the top floor, stair bay and all
  addRibbon([{ ...W(0, S.inset), y: lot.y + top }, { ...W(0, D - S.inset), y: lot.y + top }], hwU, { thick: S.slab });      // nobody stands on it; it keeps the camera under the ceiling
  // the outside walls, for people on any floor up here; and the long side of the stair bay
  swall(0, S.inset - th / 2, L, th, allBits, S.shop - .6, top); swall(0, D - S.inset + th / 2, L, th, allBits, S.shop - .6, top);
  for (const s of [-1, 1]) swall(s * (hwU + th / 2), D / 2, th, D, allBits, S.shop - .6, top);
  swall(a0 - .04, (b0 + b1) / 2, .08, S.run, allBits);
  c.solid(side * (a0 - .04), (b0 + b1) / 2, .08, S.run, 1);                                          // ...and for people on the ground

  // ---------- the stairs ----------
  const stairA = tintOf(c, 0xcfc6b6), stairB = tintOf(c, 0xc2b8a6), railM = m.dark, slope = (rise) => Math.atan2(rise, S.run);
  // the room's axes as three.js sees them, for tilted pieces: X along the front, Z back from it (and up the slope)
  const ax = new THREE.Vector3(-fz, 0, fx), bx = new THREE.Vector3(-fx, 0, -fz), up = new THREE.Vector3(0, 1, 0), basis = new THREE.Matrix4();
  const tilted = (mat, a, y, b, sa, sy, sb, ang) => {
    const zz = bx.clone().multiplyScalar(Math.cos(ang)).addScaledVector(up, Math.sin(ang)), yy = up.clone().multiplyScalar(Math.cos(ang)).addScaledVector(bx, -Math.sin(ang));
    raw(mat, P(side * a, y, b), V(sa, sy, sb), false, G.box, new THREE.Quaternion().setFromRotationMatrix(basis.makeBasis(ax, yy, zz)));
  };
  for (let j = 0; j < n; j++) {
    const y0 = j === 0 ? 0 : floorY(j), y1 = floorY(j + 1), rise = y1 - y0, steps = Math.round(rise / .2), h = rise / steps, tread = S.run / steps, ang = slope(rise), wide = S.bayW - .12;
    addRibbon([{ ...W(ac, b0), y: lot.y + y0 }, { ...W(ac, b1), y: lot.y + y1 }], S.bayW / 2, { thick: .3, storey: bit(j + 1) });
    for (let i = 0; i < steps; i++) {
      const t = y0 + (i + 1) * h, bc = b0 + (i + .5) * tread, mat = i % 2 ? stairA : stairB;
      if (j === 0) put(mat, ac + .03, t / 2, bc, wide, t, tread + .002); else put(mat, ac + .03, t - (h + .1) / 2, bc, wide, h + .1, tread + .002);
    }
    if (j > 0) tilted(stairB, ac + .03, y0 + rise / 2 - .1 - .07 / Math.cos(ang) + .03, (b0 + b1) / 2, wide, .14, Math.hypot(S.run, rise), ang);
    // a handrail down the open side, on posts
    tilted(railM, a0 + .07, y0 + h / 2 + rise / 2 + .95, (b0 + b1) / 2, .06, .07, Math.hypot(S.run, rise) + .1, ang);
    for (let i = 1; i < steps; i += 4) put(railM, a0 + .07, y0 + (i + 1) * h + .47, b0 + (i + .5) * tread, .04, .95, .04);
  }
  // under the first flight: a cupboard (rooms.js may put something in it), and nobody walks through the stairs from the side
  c.solid(side * ac, b0 + S.run * .76, S.bayW, S.run * .48, 2.2);
  put(m.darkWood, a0 - .01, 1.0, b0 + S.run * .76, .04, 1.9, S.run * .4); put(m.gold, a0 - .04, 1.05, b0 + S.run * .76, .03, .12, .05);
  put(tintOf(c, 0x4a3324), a0 - .035, 1.0, b0 + S.run * .76, .03, 1.8, .03);
  // a banister with glass in it along the bay on every floor up; across the open end on the top floor
  for (let k = 1; k <= n; k++) {
    const y = floorY(k);
    put(m.glass, a0 - .05, y + .5, (b0 + b1) / 2, .03, .84, S.run - .1); put(railM, a0 - .05, y + .97, (b0 + b1) / 2, .07, .06, S.run);
    for (let q = 0; q <= 3; q++) put(railM, a0 - .05, y + .48, b0 + q * S.run / 3, .05, .96, .05);
    put(stairB, a0 - .05, y + .03, (b0 + b1) / 2, .1, .06, S.run);
  }
  { const y = floorY(n); put(m.glass, ac, y + .5, b0 + .05, S.bayW - .1, .84, .03); put(railM, ac, y + .97, b0 + .05, S.bayW, .06, .07); put(stairB, ac, y + .03, b0 + .05, S.bayW, .06, .1); swall(ac, b0 - .4, S.bayW, .08, bit(n)); }       // (the stop stands back from the glass: whoever is starting up the last flight is already counted as on this floor)

  // ---------- each floor's rooms ----------
  for (let k = 0; k <= n; k++) {
    const y = k ? floorY(k) : 0, kind = k ? shop.up[k - 1] : shop.kind, yAbs = lot.y + y, hi = k ? S.clear : c.CEIL;
    const F = {
      k, kind, y, shop, room, m, r: c.r, tinted: (col) => tintOf(c, col), accent: c.accent, bay, D, n, hi,
      // the room you can furnish: a from x0 (the far wall) to x1 (the stair bay), b from d0 (front wall) to d1 (back wall)
      x0: k ? -hwU : -iw, x1: a0 - .1, xw: k ? hwU : iw, d0: k ? S.inset : c.T, d1: k ? D - S.inset : D - c.T,
      put: (mat, a, yy, b, sa, sy, sb, geo) => put(mat, a, y + yy, b, sa, sy, sb, geo),
      // something you bump into: h metres tall
      solid: k ? (a, b, sa, sb, h = 1.1) => swall(a, b, sa, sb, bit(k), y, y + h) : (a, b, sa, sb, h = 1.1) => c.solid(side * a, b, sa, sb, h),
      spot: (a, b, what, rad = 1.3, data) => { const s = { ...W(a, b), y: yAbs, r: rad, room, what, ...data }; spots.push(s); return s; },
      // somebody standing about: kind of character, which way they face (0 = toward the front of the building)
      folk: (a, b, who, da = 0, db = -1, pose = 'stand') => { const p = W(a, b); room.folk.push({ x: p.x, z: p.z, y: yAbs, face: Math.atan2(-fz * side * da - fx * db, fx * side * da - fz * db), kind: who, pose, k }); },
      at: (a, b) => ({ ...W(a, b), y: yAbs }),
    };
    F.block = (mat, a, yy, b, sa, sy, sb, h = sy) => { F.put(mat, a, yy + sy / 2, b, sa, sy, sb); F.solid(a, b, sa, sb, yy + h); };
    // an inside wall from (a, b0) to (a, b1) or (a0, b) to (a1, b), with doorways: gaps = [[from, to], ...] along it
    F.partition = (pa0, pb0, pa1, pb1, gaps = [], col) => {
      const along = Math.abs(pa1 - pa0) > Math.abs(pb1 - pb0), lo = along ? Math.min(pa0, pa1) : Math.min(pb0, pb1), hiE = along ? Math.max(pa0, pa1) : Math.max(pb0, pb1), fixed = along ? pb0 : pa0;
      const mat = F.tinted(col ?? c.wallColour(k)), seg = (u0, u1, yy0, yy1, hard) => {
        if (u1 - u0 < .02) return; const um = (u0 + u1) / 2, len = u1 - u0;
        if (along) F.put(mat, um, (yy0 + yy1) / 2, fixed, len, yy1 - yy0, .12); else F.put(mat, fixed, (yy0 + yy1) / 2, um, .12, yy1 - yy0, len);
        if (hard) { if (k) swall(along ? um : fixed, along ? fixed : um, along ? len : .12, along ? .12 : len, bit(k), y, y + hi); else c.wall(side * (along ? um : fixed), along ? fixed : um, along ? len : .12, along ? .12 : len); }
      };
      let u = lo; for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { seg(u, g0, 0, hi, true); seg(g0, g1, 2.15, hi, false); u = g1; }
      seg(u, hiE, 0, hi, true);
    };
    // a light fitting in the ceiling
    F.lamp = (a, b, sa = 1.4, sb = .5) => F.put(m.panel, a, hi - .03, b, sa, .05, sb);
    // whoever works here (ground floor only: the one you can hold up), facing (da, db)
    F.clerk = (a, b, da, db) => c.clerkAt(side * a, b, side * da, db);
    // something precious you can walk off with: it is there again after a while (interiors.js)
    F.gem = (a, yy, b, data, { col = 0x9fe8ff, size = .2, rad = 1.5 } = {}) => {
      const p = W(a, b), o = new THREE.Mesh(GEM, std({ color: col, roughness: .08, metalness: .2, emissive: col, emissiveIntensity: .7 }));
      o.position.set(p.x, yAbs + yy, p.z); o.scale.set(size, size * 1.25, size); o.visible = false; c.realScene.add(o);
      const s = F.spot(a, b, 'gem', rad, data); room.gems.push({ mesh: o, spot: s }); return s;
    };
    furnish(kind, F);
    if (k) floors[k - 1].F = F;
  }

  // ---------- the roof ----------
  let roof = null;
  if (shop.roof) {
    const hwR = L / 2, yR = roofY, bitsR = roofBit, info = { thick: .7, storey: bitsR, drop: true };
    addRibbon([{ ...world(0, 0), y: lot.y + yR }, { ...world(0, D), y: lot.y + yR }], hwR, info);
    // a parapet all the way round, but for a gap at the front where a plank sticks out over the street
    const pa = -side * Math.min(2.6, hwR - 2.4), gap = .9, rw = (a, b, sa, sb) => { raw(mats.trim, P(a, yR + .3, b), Sc(sa, .6, sb), true); const p = world(a, b), wx = fx ? sb : sa, wz = fx ? sa : sb; solids.walls.push({ x: p.x, z: p.z, hl: Math.max(wx, wz) / 2, ht: Math.min(wx, wz) / 2, rot: wx >= wz ? 0 : Math.PI / 2, kind: 'storey', bits: bitsR, y0: lot.y + yR, h: lot.y + yR + .6 }); };
    rw(0, D - .1, L + .5, .22); for (const s of [-1, 1]) rw(s * (hwR + .12), D / 2, .22, D + .1);
    rw((-hwR - .25 + pa - gap / 2) / 2, .1, pa - gap / 2 + hwR + .25, .22); rw((hwR + .25 + pa + gap / 2) / 2, .1, hwR + .25 - pa - gap / 2, .22);
    addRibbon([{ ...world(pa, .4), y: lot.y + yR }, { ...world(pa, -2.7), y: lot.y + yR }], gap / 2 - .02, info);
    raw(m.wood, P(pa, yR + .04, -1.1), Sc(gap - .1, .09, 3.4)); raw(m.red, P(pa, yR + .1, -2.6), Sc(gap - .1, .03, .25));
    for (const s of [-1, 1]) { raw(mats.darkMetal, P(pa + s * (gap / 2 + .06), yR + 1.1, .1), Sc(.08, 2.2, .08)); raw(m.red, P(pa + s * (gap / 2 + .06), yR + 2.05, .1), Sc(.3, .22, .04)); }
    // the stair head: a little house with a door in it, over the back of the stair bay
    const ha = side * (ac - .1), hb = b1 + .2, hd = 2.6, hwid = 2.3;
    raw(mats.trim, P(ha, yR + 1.25, hb), Sc(hwid, 2.5, hd), true); raw(mats.darkMetal, P(ha, yR + 2.56, hb), Sc(hwid + .3, .12, hd + .3), true);
    raw(m.dark, P(ha - side * (hwid / 2 + .02), yR + 1.05, hb), Sc(.05, 2.1, 1.0)); raw(m.green, P(ha - side * (hwid / 2 + .04), yR + 2.28, hb), Sc(.04, .16, .5));
    { const p = world(ha, hb), wx = fx ? hd : hwid, wz = fx ? hwid : hd; solids.walls.push({ x: p.x, z: p.z, hl: Math.max(wx, wz) / 2, ht: Math.min(wx, wz) / 2, rot: wx >= wz ? 0 : Math.PI / 2, kind: 'storey', bits: bitsR, y0: lot.y + yR, h: lot.y + yR + 2.6 }); }
    const out = world(ha - side * (hwid / 2 + .9), hb);
    spots.push({ ...out, y: lot.y + yR, r: 1.2, room, what: 'roofDown' });
    // what the city already put up here is solid too: air-conditioning boxes and the water tank
    for (const o of g.children) {
      const tank = o.isGroup && o.children.length === 6, box = o.isMesh && o.material === mats.ac; if (!tank && !box) continue;
      const hs = tank ? 1.2 : .85; solids.walls.push({ x: lot.x + o.position.x, z: lot.z + o.position.z, hl: hs, ht: tank ? 1.2 : .65, rot: 0, kind: 'storey', bits: bitsR, y0: lot.y + yR, h: lot.y + yR + (tank ? 5 : 1.6) });
    }
    // the door to the roof, at the top of the stairs on the top floor
    const yT = floorY(n);
    put(m.dark, ac, yT + 1.05, D - S.inset - .03, 1.0, 2.1, .05); put(m.green, ac, yT + 2.3, D - S.inset - .04, .6, .18, .04); put(m.gold, ac - .35, yT + 1.05, D - S.inset - .07, .06, .14, .05);
    spots.push({ ...W(ac, D - S.inset - .9), y: lot.y + yT, r: 1.1, room, what: 'roofUp' });
    roof = { y: lot.y + yR, out, up: { ...W(ac, D - S.inset - 1) , y: lot.y + yT }, plank: world(pa, -2), pack: world(pa + side * 2.2, 1.6), bit: bitsR };
    const R = {
      y: yR, hw: hwR, D, side, m, r: c.r, tinted: (col) => tintOf(c, col), kind: shop.roof, shopId: shop.id,
      put: (mat, a, yy, b, sa, sy, sb, geo) => raw(mat, P(a, yR + yy, b), Sc(sa, sy, sb), false, geo),
      solid: (a, b, sa, sb, h = 1.1) => { const p = world(a, b), wx = fx ? sb : sa, wz = fx ? sa : sb; solids.walls.push({ x: p.x, z: p.z, hl: Math.max(wx, wz) / 2, ht: Math.min(wx, wz) / 2, rot: wx >= wz ? 0 : Math.PI / 2, kind: 'storey', bits: bitsR, y0: lot.y + yR, h: lot.y + yR + h }); },
      spot: (a, b, what, rad = 1.3, data) => { const s = { ...world(a, b), y: lot.y + yR, r: rad, room, what, ...data }; spots.push(s); return s; },
      // is this patch of roof free of the stair head, the plank and the city's own clutter?
      free: (a, b, rad = 1) => Math.hypot(a - ha, b - hb) > rad + 2 && Math.hypot(a - pa, b) > rad + 1.5 && !g.children.some(o => (o.isMesh && o.material === mats.ac || o.isGroup && o.children.length === 6) && Math.hypot(lot.x + o.position.x - world(a, b).x, lot.z + o.position.z - world(a, b).z) < rad + 1.4),
    };
    R.block = (mat, a, yy, b, sa, sy, sb, h = sy) => { R.put(mat, a, yy + sy / 2, b, sa, sy, sb); R.solid(a, b, sa, sb, yy + h); };
    furnish('roof:' + shop.roof, R);
  }
  return { floors, swaps, roof, top: lot.y + top, roofY: lot.y + roofY };
}
const tintOf = (c, col) => c.tinted(col);
