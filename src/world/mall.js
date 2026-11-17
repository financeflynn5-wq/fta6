// Coral Plaza: the mall. A car park on Valley Avenue, an open-air plaza between two rows of shops, and the
// main building behind it: a glass-roofed hall with a fountain, a concourse of shops running east and west,
// a department store and a food court. Every sheet of glass in an entrance, round the department store and
// along the food court is a wall until a car hits it at speed, and then it is a way in (world/places.js);
// the tables, kiosks, clothes rails and planters go the same way.
import * as THREE from 'three';
import { V } from '../core/utils.js';
import { mats, std, G, mesh, facade, awnings, ctex } from './materials.js';
import { roofGeo } from './props.js';

const PI = Math.PI;
const NAMES = ['TIN & THREAD', 'CRITTER KICKS', 'BOLT BARGAINS', 'SUNNY SCOOPS', 'PIXEL PALACE', 'SHELL PHONES', 'GLAM CLAM', 'SURF SHACK', 'RUST & SHINE', 'PAWS & CLAWS',
  'THE TOY TIN', 'BOOK NOOK', 'JUICE LOOSE', 'SNACK ATTACK', 'SUNSET & CO', 'FOOD COURT', 'BURGER BOT', 'NOODLE BOWL', 'TACO TIN', 'SHADES'];

export function buildMall(K) {
  const { solids, out, P, M, G2, R, rr, one, post, deck, keepOut, N } = K;
  const Y = 6.1, WH = 7.6, HH = 11, GH = 4.6;                    // floor level; ceiling of the wings, eaves of the hall, height of the glass
  const S = K.site(81, 567), label = K.atlas(NAMES);
  keepOut(81, 567, 75);

  // ---------- materials ----------
  const tile = (a, b, k = .14) => { const t = ctex(128, (x, s) => { x.fillStyle = a; x.fillRect(0, 0, s, s); x.fillStyle = b; x.fillRect(0, 0, s / 2, s / 2); x.fillRect(s / 2, s / 2, s / 2, s / 2); x.strokeStyle = 'rgba(0,0,0,.08)'; x.lineWidth = 2; x.strokeRect(0, 0, s / 2, s / 2); x.strokeRect(s / 2, s / 2, s / 2, s / 2); }); return std({ map: t, color: 0xffffff, roughness: .4, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: k }); };
  const glow = (c, k = .3) => std({ color: c, roughness: .7, emissive: c, emissiveIntensity: k });
  const wallM = facade[3], coral = facade[0], floorM = tile('#f3ecdf', '#f0c4b4'), hallM = tile('#f6f1e6', '#9fd3c7', .06), liner = glow(0xf6efe2, .24), ceilM = glow(0xf4efe6, .2), lightM = glow(0xfff1d6, 1.5);
  const shows = [0xff7fa6, 0x3de0ff, 0xffd34d, 0x7dff8a, 0xc77dff, 0xff8a3d].map(c => glow(c, .5)), dark = glow(0x2b2f38, .1), teal = std({ color: 0x2f9c8f, roughness: .6 });
  const skyM = std({ color: 0xbfe6f0, roughness: .05, metalness: .3, transparent: true, opacity: .28, depthWrite: false });

  // ---------- helpers ----------
  const slab = (mat, x0, z0, x1, z1, t) => S.own(K.slab(mat, x0, z0, x1, z1, Y + .005, t));
  // walls along x (wx) and along z (wz). from = how far above the floor they start: only walls that reach the floor stop you.
  const wx = (x0, x1, z, h = WH, from = 0, mat = wallM) => { S.box(mat, (x0 + x1) / 2, Y + from + h / 2, z, x1 - x0, h, .5); if (!from) solids.walls.push({ x: (x0 + x1) / 2, z, hl: (x1 - x0) / 2, ht: .25, rot: 0, kind: 'solid', h: Y + h }); };
  const wz = (x, z0, z1, h = WH, from = 0, mat = wallM) => { S.box(mat, x, Y + from + h / 2, (z0 + z1) / 2, .5, h, z1 - z0); if (!from) solids.walls.push({ x, z: (z0 + z1) / 2, hl: (z1 - z0) / 2, ht: .25, rot: PI / 2, kind: 'solid', h: Y + h }); };
  // a run of glass you can burst through, with a beam over it. skip = panes left out (an open doorway)
  const glassX = (x0, x1, z, n, skip = []) => { const w = (x1 - x0) / n; for (let i = 0; i < n; i++) if (!skip.includes(i)) K.breakable('glass', x0 + w * (i + .5), Y, z, 0, w - .06, GH, { through: true }); S.box(mats.darkMetal, (x0 + x1) / 2, Y + GH + .06, z, x1 - x0, .12, .16, false); };
  const glassZ = (x, z0, z1, n, skip = []) => { const w = (z1 - z0) / n; for (let i = 0; i < n; i++) if (!skip.includes(i)) K.breakable('glass', x, Y, z0 + w * (i + .5), PI / 2, w - .06, GH, { through: true }); S.box(mats.darkMetal, x, Y + GH + .06, (z0 + z1) / 2, .16, .12, z1 - z0, false); };
  const prop = (kind, x, z, rot = 0) => K.breakable(kind, x, Y, z, rot, 1, 1);
  // A shop front `len` long on a wall whose outward side faces (nx, nz): a door, two windows with things on show, a sign.
  // The windows shatter; the wall behind them does not.
  let shopNo = 0;
  function shop(cx, cz, nx, nz, len, outdoor = false, name = NAMES[shopNo++ % 14]) {
    const tx = -nz, tz = nx, ry = Math.atan2(nx, nz), rot = nz ? 0 : PI / 2, show = shows[shopNo % shows.length];
    const at = (u, d) => [cx + tx * u + nx * d, cz + tz * u + nz * d], sz = (su, sd) => nz ? [su, sd] : [sd, su];
    const b = (mat, u, y, d, su, sy, sd) => { const [x, z] = at(u, d), [sx, s2] = sz(su, sd); return S.box(mat, x, Y + y, z, sx, sy, s2, false); };
    const pw = (len - 3.6) / 2;
    b(dark, 0, 1.35, .05, 1.7, 2.7, .1); b(lightM, 0, 2.82, .08, 1.7, .12, .1);                         // the door
    for (const s of [-1, 1]) {
      const u = s * (1.25 + pw / 2);
      b(show, u, 2.1, .06, pw, 3.3, .12); b(mats.darkMetal, u, .4, .2, pw + .2, .12, .4); b(mats.darkMetal, u, 3.82, .2, pw + .2, .14, .4);
      for (let k = 0; k < 3; k++) b(one(shows), u + (k - 1) * pw * .3, .46 + rr(.35, .7), .2, .5, rr(.5, 1.2), .3);     // what is on show
      const [gx, gz] = at(u, .36); K.breakable('glass', gx, Y + .46, gz, rot, pw, 3.3);
    }
    const [lx, lz] = at(0, outdoor ? .1 : .12); label(name, lx, Y + 4.95, lz, ry, Math.min(len - 2, 7.5), S.g);
    if (outdoor) { const [ax, az] = at(0, 1.05), [sx, s2] = sz(len - 1, 2.1), a = S.box(one(awnings), ax, Y + 4.05, az, sx, .12, s2); a.rotation.set(nz ? -nz * .3 : 0, 0, nx ? nx * .3 : 0); }
  }

  // ---------- the ground: car park, plaza, floors ----------
  deck({ x: 81, z: 567, hl: 73, hw: 73, rot: 0, y0: Y, plan: '#868a92' });
  deck({ x: 81, z: 560, hl: 41, hw: 20, rot: 0, y0: Y, plan: '#d9d2c6' }); deck({ x: 81, z: 606, hl: 67, hw: 26, rot: 0, y0: Y, plan: '#f8ddd2' });
  slab(mats.asphalt, 8, 494, 154, 540, 420);
  for (const [x0, z0, x1, z1] of [[8, 540, 154, 580], [8, 580, 14, 632], [148, 580, 154, 632], [8, 632, 154, 640]]) slab(mats.walk, x0, z0, x1, z1, 40);
  slab(floorM, 14, 580, 68, 632, 4); slab(floorM, 94, 580, 148, 632, 4); slab(hallM, 68, 580, 94, 632, 4);

  // the car park: two double rows of bays either side of the way in
  for (const rz of [506, 527]) {
    for (const [a, b] of [[20, 73], [89, 142]]) {
      K.paint((a + b) / 2, rz, b - a, .14, Y);
      for (let x = a; x <= b + .1; x += 2.65) K.paint(x, rz, .14, 10.6, Y);
      for (let x = a + 1.33; x < b; x += 2.65) for (const s of [-1, 1]) if (R() < .17) out.parked.push([one(['car', 'car', 'car', 'van', 'taxi', 'sport', 'limo', 'bike']), x, rz + s * 2.9, s * PI / 2]);
    }
    for (const x of [17.5, 75.5, 86.5, 144.5]) P.lamp(x, rz, x < 81 ? (x < 40 ? 1 : -1) : (x > 120 ? -1 : 1), 0);
  }
  for (let x = 14; x <= 150; x += 13.6) if (Math.abs(x - 81) > 9) P.palm(x, 496.2, rr(.95, 1.15));
  for (const z of [541.2]) for (const [a, b] of [[14, 42], [66, 70], [92, 148]]) K.paint((a + b) / 2, z, b - a, .3, Y, 0xf2c230);
  // the sign by the road
  for (const s of [-1, 1]) { S.box(mats.trim, 12 + s * 5.4, Y + 4, 497, .6, 8, .6); post(12 + s * 5.4, 497, .45); }
  P.sign('CORAL PLAZA', 12, Y + 7.4, 497, PI, 11.4, 3.2, '#ff7f6e', '#fff4e6', 150, true);

  // ---------- the open-air shops either side of the plaza ----------
  for (const [x0, x1, face] of [[14, 40, 1], [122, 148, -1]]) {
    const cx = (x0 + x1) / 2;
    S.box(coral, cx, Y + 3.25, 563, 26, 6.5, 34); S.box(mats.trim, cx, Y + 6.7, 563, 26.6, .5, 34.6); S.box(mats.trim, cx, Y + .3, 563, 26.2, .6, 34.2);
    solids.boxes.push({ x: cx, z: 563, hw: 13, hd: 17, h: Y + 7 });
    for (let i = 0; i < 3; i++) shop(face > 0 ? x1 : x0, 546 + 5.67 + i * 11.33, face, 0, 11.3, true);
    for (const u of [-6.5, 6.5]) shop(cx + u, 546, 0, -1, 13, true);
    for (let i = 0; i < 3; i++) mesh(G.box, mats.ac, V(cx - 81 + rr(-8, 8), Y + 7.4, rr(-12, 12) - 4), V(1.8, 1, 1.4), S.g);
  }
  // the plaza: palms in planters, a fountain with cafe tables round it, two kiosks. Two lanes are left clear on purpose:
  // one runs straight at the hall doors, the other at the department store's windows.
  for (const x of [67.5, 94.5]) for (const z of [549, 558, 567]) { S.box(mats.trim, x, Y + .35, z, 1.9, .7, 1.9); solids.boxes.push({ x, z, hw: .95, hd: .95, low: true, h: Y + 1.2, wall: true }); P.palm(x, z, rr(.95, 1.1)); }
  K.fountain(108, 560, Y, 3.4, 2.5);
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2 + .2; prop('table', 108 + Math.cos(a) * 7, 560 + Math.sin(a) * 7, a); }
  prop('kiosk', 100, 546.5); prop('kiosk', 100, 573.6); for (const z of [551.5, 563, 574.3]) prop('planter', 42, z); for (const z of [551.5, 563, 574.3]) prop('planter', 120, z);
  for (const [x, z, dx] of [[44, 543, 1], [118, 543, -1], [44, 577, 1], [118, 577, -1]]) P.lamp(x, z, dx, 0);

  // ---------- the main building ----------
  // the two solid corners (rows of small shops): south-east and north-west
  for (const [cx, cz] of [[121, 590], [41, 622]]) { S.box(wallM, cx, Y + WH / 2, cz, 54, WH, 20); solids.boxes.push({ x: cx, z: cz, hw: 27, hd: 10, h: Y + WH + 1 }); }
  S.box(liner, 121, Y + WH / 2, 600.05, 54, WH, .1, false); S.box(liner, 41, Y + WH / 2, 611.95, 54, WH, .1, false);
  S.box(liner, 68.05, Y + HH / 2, 622, .1, HH, 20, false); S.box(liner, 93.95, Y + HH / 2, 590, .1, HH, 20, false);
  for (let i = 0; i < 5; i++) { shop(94 + 5.4 + i * 10.8, 600.1, 0, 1, 10.8); shop(14 + 5.4 + i * 10.8, 611.9, 0, -1, 10.8); }
  for (const z of [617, 627]) shop(68.1, z, 1, 0, 10); for (const z of [585, 595]) shop(93.9, z, -1, 0, 10);
  for (const x of [101, 115]) shop(x, 580, 0, -1, 13, true);
  // the department store (south-west): glass on three sides
  wx(14, 42, 580.25); wx(66, 68, 580.25); wz(14.25, 580, 600); wz(67.75, 580, 582); wz(67.75, 598, 600); wx(14, 20, 599.75); wx(62, 68, 599.75);
  glassX(42, 66, 580.25, 8); glassX(20, 62, 599.75, 14); glassZ(67.75, 582, 598, 5);
  wx(42, 66, 580.25, WH - GH - .1, GH + .1); wx(20, 62, 599.75, WH - GH - .1, GH + .1, liner); wz(67.75, 582, 598, WH - GH - .1, GH + .1, liner);
  S.box(liner, 14.55, Y + WH / 2, 590, .1, WH, 19, false); S.box(liner, 28, Y + WH / 2, 580.55, 27, WH, .1, false);
  label('SUNSET & CO', 54, Y + 6, 579.95, PI, 11, S.g); label('SUNSET & CO', 41, Y + 6, 600.05, 0, 11, S.g);
  for (let x = 21; x <= 62; x += 6.8) for (const z of [585.5, 594]) prop('rack', x + (z > 590 ? 3.4 : 0), z, (x + z) % 2 > 1 ? PI / 2 : 0);
  prop('kiosk', 17.5, 590, PI / 2);
  // the food court (north-east): open to the hall and the concourse, counters along the back, glass to the road behind
  wx(94, 127, 631.75); wx(145, 148, 631.75); wz(147.75, 612, 632); glassX(127, 145, 631.75, 6); wx(127, 145, 631.75, WH - GH - .1, GH + .1);
  S.box(mats.trim, 121, Y + WH - .6, 612.25, 54, 1.2, .5, false); S.box(mats.trim, 94.25, Y + WH - .6, 622, .5, 1.2, 20, false);
  for (const x of [94.4, 103.4, 112.4, 121.4, 130.4, 139.4]) { S.box(mats.trim, x, Y + WH / 2, 612.3, .6, WH, .6); post(x, 612.3, .4); }
  for (const z of [618.8, 625.4]) { S.box(mats.trim, 94.4, Y + WH / 2, z, .6, WH, .6); post(94.4, z, .4); }
  S.box(liner, 110.5, Y + WH / 2, 631.45, 33, WH, .1, false); S.box(liner, 147.45, Y + WH / 2, 622, .1, WH, 19.4, false);
  S.box(teal, 111, Y + .55, 629, 30, 1.1, 1.1, false); S.box(mats.trim, 111, Y + 1.13, 629, 30.3, .08, 1.3, false); solids.boxes.push({ x: 111, z: 629, hw: 15, hd: .6, low: true, h: Y + 1.2, wall: true });
  ['BURGER BOT', 'NOODLE BOWL', 'TACO TIN'].forEach((n, i) => {
    const x = 101 + i * 10; label(n, x, Y + 4.3, 631.38, PI, 7.5, S.g); S.box(shows[i * 2], x, Y + 2.5, 631.4, 8.6, 2.2, .1, false); S.box(dark, x, Y + 2.5, 631.36, 7, 1.2, .1, false);
    if (i) S.box(mats.trim, x - 5, Y + 1.9, 630.6, .3, 3.8, 1.8, false);
    K.spot(x, 627.3, 'diner', 1.8, Y);
  });
  label('FOOD COURT', 121, Y + WH - .6, 611.95, PI, 9, S.g);
  for (let x = 100; x <= 143; x += 7.1) for (const z of [616.6, 622.6]) prop('table', x + (z > 620 ? 3.5 : 0) - (x > 140 && z > 620 ? 7 : 0), z, R() * PI);
  // the four ways in: sheets of glass between columns, with a doorway left open in the side bays
  for (const z of [580.25, 631.75]) {
    for (let i = 0; i < 3; i++) glassX(68.35 + i * 8.667 + (i ? 0 : 0), 68.35 + (i + 1) * 8.667 - .7 + (i === 2 ? .35 : 0), z, 3, i === 1 ? [] : [1]);
    for (let i = 1; i < 3; i++) { const x = 68 + i * 8.667; S.box(mats.trim, x, Y + GH / 2, z, .7, GH, .7); post(x, z, .46); }
    wx(68, 94, z, HH - GH - .1, GH + .1, coral);
    S.put(roofGeo(26.5, 3.7, .5), coral, 81, Y + HH, z);
    S.box(mats.trim, 81, Y + GH + .5, z + (z < 600 ? -2 : 2), 27, .3, 4.4);
    P.sign('CORAL PLAZA', 81, Y + 8, z + (z < 600 ? -.32 : .32), z < 600 ? PI : 0, 20, 4, '#14244f', '#ffd34d', 170);
  }
  for (const x of [14.25, 147.75]) { glassZ(x, 600, 612, 5, [2]); wz(x, 600, 612, WH - GH - .1, GH + .1, coral); S.box(mats.trim, x + (x < 81 ? -1.6 : 1.6), Y + GH + .5, 606, 3.4, .3, 13); }
  // the hall: walls rising above the wings, a glass roof on steel ribs
  for (const x of [68, 94]) S.box(coral, x, Y + (WH + HH) / 2 + .25, 606, .5, HH - WH - .5, 51.5);
  S.put(roofGeo(26.4, 3.7, 51.4), skyM, 81, Y + HH, 606, 1, 1, 1, false);
  for (let z = 583; z <= 630; z += 6.6) for (const s of [-1, 1]) { const r = S.box(mats.darkMetal, 81 + s * 6.55, Y + HH + 1.83, z, 13.7, .2, .2, false); r.rotation.z = -s * Math.atan2(3.7, 13.1); }
  S.box(mats.darkMetal, 81, Y + HH + 3.68, 606, .26, .26, 51.4, false);
  // roofs and ceilings of the two wings
  for (const cx of [41, 121]) {
    S.box(mats.trim, cx, Y + WH + .3, 606, 54, .6, 52); S.box(mats.trim, cx, Y + WH + .95, 580.25, 54, .7, .5); S.box(mats.trim, cx, Y + WH + .95, 631.75, 54, .7, .5); S.box(mats.trim, cx < 81 ? 14.25 : 147.75, Y + WH + .95, 606, .5, .7, 52);
    for (let i = 0; i < 5; i++) mesh(G.box, mats.ac, V(cx - 81 + rr(-22, 22), Y + WH + 1.1, 606 - 567 + rr(-22, 22)), V(2.2, 1, 1.6), S.g);
  }
  for (const [x0, z0, x1, z1] of [[14, 580, 68, 612], [94, 600, 148, 632]]) S.box(ceilM, (x0 + x1) / 2, Y + WH - .04, (z0 + z1) / 2, x1 - x0 - .6, .08, z1 - z0 - .6, false);
  for (const x of [23, 32, 41, 50, 59, 103, 112, 121, 130, 139]) { S.box(lightM, x, Y + WH - .1, 606, 3.2, .06, .7, false); S.box(lightM, x, Y + WH - .1, x < 81 ? 590 : 622, 3.2, .06, .7, false); }
  for (const [x, y, z] of [[32, 6.6, 606], [56, 6.6, 606], [106, 6.6, 606], [130, 6.6, 606], [41, 6.6, 590], [121, 6.6, 622], [81, 9, 592], [81, 9, 620]]) K.api.lampPts.push(V(x, Y + y, z));

  // what stands in the hall and down the concourse
  K.fountain(81, 606, Y, 2.8, 2.7);
  for (const [x, z] of [[70.2, 590.5], [91.8, 590.5], [70.2, 621.5], [91.8, 621.5], [75, 606], [87, 606]]) prop('planter', x, z);
  ['planter', 'kiosk', 'planter', 'kiosk', 'planter'].forEach((k, i) => { prop(k, 23 + i * 9.5, 606); prop(k, 101 + i * 9.5, 606); });

  (out.zones.roofs ||= []).push({ x0: 14, x1: 68, z0: 580, z1: 632, y: Y + WH }, { x0: 94, x1: 148, z0: 580, z1: 632, y: Y + WH }, { x0: 68, x1: 94, z0: 580, z1: 632, y: Y + HH + .6 });
  out.walkers.push({ cx: 81, cz: 606, hx: 62, hz: 4.4, n: 9 }, { cx: 81, cz: 606, hx: 9.6, hz: 23, n: 5 }, { cx: 81, cz: 560, hx: 36, hz: 17.5, n: 6 });
  out.spots.mall = { x: 81, z: 560 };

  // ---------- the strip behind the mall: Bullseye Guns and the Valley Diner (the rooms are in interiors.js), parking out front ----------
  K.drape(mats.asphalt, 38, 654.5, 122, 668.5, .07, 420, 4); K.drape(mats.walk, 38, 668.5, 122, 671.4, .09, 40, 3);
  for (let x = 44; x <= 116; x += 2.8) K.paint(x, 665.6, .13, 5.4, 6.07);
  out.parked.push(['car', 50.6, 665.4, PI / 2], ['sport', 64.6, 665.4, PI / 2], ['van', 92.6, 665.4, PI / 2], ['bike', 106.6, 665.4, PI / 2]);
  P.lamp(40, 670, 1, 0); P.lamp(120, 670, -1, 0); keepOut(80, 672, 44);
  for (const x of [16, 26, 134, 146]) P.tree(x, rr(668, 690), rr(1, 1.4)); for (const x of [78, 79.6]) K.breakable('planter', x, 6, 670, 0, 1, 1);
  out.walkers.push({ cx: 80, cz: 669.6, hx: 36, hz: .7, n: 2 });
  out.spots.gunShop = { x: 58, z: 671 };
}
