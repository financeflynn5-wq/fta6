// Marlin Bay: the marina and the streets behind it. A concrete quay along Marina Drive, four floating piers
// of moored boats, a fuel dock, a seaplane dock, a slipway into the water, a breakwater, the yacht club,
// a boat yard, and a helipad on the bluff at the north end. The boats are scenery for now; the berths, the
// seaplane dock, the slipway and the helipad are listed in districts.spots.marina for whoever adds things
// that float and fly.
import * as THREE from 'three';
import { V } from '../core/utils.js';
import { mats, std, G, mesh, rbox, facade, awnings } from './materials.js';
import { groundY } from './terrain.js';
import { WATER, nodeX } from './map.js';
import { roofGeo } from './props.js';

const PI = Math.PI;
const hulls = {};
// A boat hull `len` long with a pointed bow toward +x, flared out from a narrower bottom.
function hullGeo(len, beam, h) {
  const k = [len, beam, h].join(); if (hulls[k]) return hulls[k];
  const s = new THREE.Shape(), L = len / 2, B = beam / 2;
  s.moveTo(-L, -B * .84); s.lineTo(L * .15, -B); s.quadraticCurveTo(L * .72, -B * .82, L, 0); s.quadraticCurveTo(L * .72, B * .82, L * .15, B); s.lineTo(-L, B * .84); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 7 }); g.rotateX(-PI / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < .001) p.setXYZ(i, p.getX(i) * .9 - len * .03, 0, p.getZ(i) * .55);
  g.computeVertexNormals(); return hulls[k] = g;
}

export function buildMarina(K) {
  const { api, solids, out, P, M, G2, R, rr, one, box, solid, post, deck, house, scatter, keepOut, N } = K;
  const QY = 2.62, DY = WATER + .45, QX0 = 281, QX1 = 303, QZ0 = 497, QZ1 = 664;      // quay level, dock level, the quay's edges
  const S = K.site(318, 580), paints = [M.white, M.white, N.navy, M.red, std({ color: 0x2f9c8f, roughness: .5 }), std({ color: 0xf2c230, roughness: .5 })];
  const sub = (x, y, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x - 318, y, z - 580); g.rotation.y = ry; S.g.add(g); return g; };
  const berths = [];

  // ---------- boats ----------
  // kind: 'sail', 'yacht' or 'speed'. ry = which way the bow points (0 = +x). They sit in the water and don't move.
  function boat(kind, x, z, ry, col = one(paints)) {
    const g = sub(x, WATER - .32, z, -ry), [len, beam, h] = kind === 'yacht' ? [13, 4, 2] : kind === 'sail' ? [9, 2.8, 1.35] : [6.4, 2.3, 1];
    mesh(hullGeo(len, beam, h), col, null, null, g); mesh(hullGeo(len * .94, beam * .88, .1), kind === 'speed' ? M.white : M.wood, V(0, h - .04, 0), null, g, false);
    if (kind === 'yacht') {
      mesh(rbox(6.6, 1.35, 3.1, .25), M.white, V(-.8, h + .68, 0), null, g); mesh(G.box, mats.carGlass, V(-.8, h + .85, 0), V(6.2, .5, 3.14), g, false);
      mesh(rbox(3.6, 1.1, 2.5, .25), M.white, V(-1.6, h + 1.9, 0), null, g); mesh(G.box, mats.carGlass, V(-1.5, h + 2, 0), V(3.3, .45, 2.54), g, false);
      mesh(G.box, M.white, V(-2.4, h + 2.9, 0), V(.5, .9, 2.2), g); mesh(G.cyl, mats.trim, V(-2.4, h + 3.9, 0), V(.03, 1.3, .03), g, false); mesh(G.box, col, V(-.5, h * .72, 0), V(len * .8, .16, beam * .93), g, false);
    } else if (kind === 'sail') {
      mesh(rbox(3.4, .6, 1.7, .2), M.white, V(-.4, h + .3, 0), null, g); mesh(G.cyl, mats.trim, V(.9, h + 5.4, 0), V(.07, 10.8, .07), g);
      const boom = mesh(G.cyl, mats.trim, V(-1.3, h + 1.5, 0), V(.05, 4.4, .05), g, false); boom.rotation.z = PI / 2;
      const sail = mesh(G.cyl, M.white, V(-1.3, h + 1.72, 0), V(.17, 4, .17), g, false); sail.rotation.z = PI / 2;
      mesh(G.box, col, V(0, h * .7, 0), V(len * .78, .12, beam * .92), g, false);
    } else {
      const ws = mesh(G.box, mats.carGlass, V(.7, h + .3, 0), V(.08, .62, beam * .8), g, false); ws.rotation.z = .5;
      for (const s of [-.5, .5]) mesh(rbox(.6, .5, .6, .12), mats.trim, V(-.4, h + .2, s), null, g, false);
      mesh(rbox(.5, .9, .7, .12), mats.darkMetal, V(-len / 2 - .15, h * .75, 0), null, g, false);
    }
    const along = Math.abs(Math.cos(ry)) > .7; solids.boxes.push({ x, z, hw: (along ? len : beam) / 2, hd: (along ? beam : len) / 2, low: true, h: WATER + h + .6, wall: true });
  }

  // ---------- the quay ----------
  deck({ x: (QX0 + QX1) / 2, z: (QZ0 + QZ1) / 2, hl: (QZ1 - QZ0) / 2, hw: (QX1 - QX0) / 2, rot: PI / 2, y0: QY, plan: '#b9b3a8' });
  S.own(K.slab(mats.concrete, QX0, QZ0, QX1, QZ1, QY + .005, 6));
  S.box(mats.trim, QX1 + .3, QY - 3, (QZ0 + QZ1) / 2, .8, 6.04, QZ1 - QZ0 + 1); S.box(mats.trim, (QX0 + QX1) / 2, QY - 3, QZ0 - .3, 22.6, 6.04, .8); S.box(mats.trim, (QX0 + QX1) / 2, QY - 3, QZ1 + .3, 22.6, 6.04, .8);
  S.box(mats.yellowPaint, QX1 - .5, QY + .02, (QZ0 + QZ1) / 2, .3, .04, QZ1 - QZ0, false);
  K.gate('MARLIN BAY', 279.6, 585, 'z', 13, '#14244f', '#ffd34d');
  keepOut(292, 580, 0);

  // ---------- the piers ----------
  const PIERS = [528, 566, 604, 642];
  PIERS.forEach((pz, n) => {
    // the gangway down from the quay, then the floating walkway
    deck({ x: 307.5, z: pz, hl: 4.5, hw: 1.3, rot: 0, y0: QY, y1: DY }); const gw = S.box(M.wood, 307.5, (QY + DY) / 2 - .08, pz, Math.hypot(9, QY - DY), .16, 2.6); gw.rotation.z = -Math.atan2(QY - DY, 9);
    for (const s of [-1.25, 1.25]) { const r = S.box(mats.trim, 307.5, (QY + DY) / 2 + .9, pz + s, Math.hypot(9, QY - DY), .07, .07, false); r.rotation.z = gw.rotation.z; }
    deck({ x: 332, z: pz, hl: 20, hw: 1.7, rot: 0, y0: DY, plan: '#c9a36b' }); S.box(M.wood, 332, DY - .15, pz, 40, .3, 3.4);
    for (let x = 314; x <= 352; x += 9.5) for (const s of [-1.7, 1.7]) { S.put(G2.cyl8, mats.trunk, x, DY - .4, pz + s, .16, 2.6, .16); }
    // fingers either side, a boat in most of the berths between them
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const fx = 317 + i * 10, fz = pz + s * 5.2;
      deck({ x: fx, z: fz, hl: 3.6, hw: .6, rot: PI / 2, y0: DY }); S.box(M.wood, fx, DY - .12, fz, 1.2, .24, 7.2); S.put(G2.cyl8, mats.trunk, fx, DY - .3, fz + s * 3.4, .13, 2.4, .13);
      if (i === 3) continue;
      const bx = fx + 5, kind = R() < .42 ? 'sail' : R() < .5 ? 'yacht' : 'speed', len = kind === 'yacht' ? 13 : kind === 'sail' ? 9 : 6.4, taken = R() < .74;
      const bz = pz + s * (2.3 + len / 2); berths.push({ x: bx, z: pz + s * 7, dir: s, free: !taken });
      if (taken) boat(kind, bx, bz, s > 0 ? -PI / 2 : PI / 2);
    }
    // the head of the pier
    const wide = n === 3 ? 9 : 5.5, deep = n === 3 ? 5 : 2.4;
    deck({ x: 352 + deep, z: pz, hl: deep, hw: wide, rot: 0, y0: DY, plan: '#c9a36b' }); S.box(M.wood, 352 + deep, DY - .15, pz, deep * 2, .3, wide * 2);
    for (const s of [-1, 1]) S.put(G2.cyl8, mats.trunk, 352 + deep * 2 - .3, DY - .3, pz + s * (wide - .3), .18, 2.8, .18);
    P.lamp(350.5, pz + 1.2, 0, -1);
    out.walkers.push({ cx: 332, cz: pz, hx: 19, hz: .8, n: 1 });
  });
  // fuel at the end of the second pier
  { const x = 355, z = PIERS[1]; S.box(M.white, x + 1, DY + 1.25, z - 3.3, 2.6, 2.5, 2.4); S.put(roofGeo(3.2, .8, 3), M.red, x + 1, DY + 2.5, z - 3.3); solids.boxes.push({ x: x + 1, z: z - 3.3, hw: 1.3, hd: 1.2, low: true, h: DY + 3, wall: true });
    for (const s of [1.2, 3.2]) { S.put(rbox(.8, 1.4, .55, .1), M.red, x + .8, DY + .7, z + s); post(x + .8, z + s, .5); }
    P.sign('FUEL', x + 1, DY + 3.9, z - 4.6, PI, 3.4, 1.3, '#e8455b', '#ffffff'); }
  // the seaplane dock at the end of the last one
  { const x = 357, z = PIERS[3]; for (const s of [-1, 1]) K.paint(x, z + s * 6.5, 7, .3, DY, 0xf2c230); K.paint(x - 3.4, z, .3, 13, DY, 0xf2c230); K.paint(x + 3.4, z, .3, 13, DY, 0xf2c230); for (const [a, b, c, d] of [[-1.3, 0, .45, 4.4], [1.3, 0, .45, 4.4], [0, 0, 2.6, .45]]) K.paint(x + a, z + b, c, d, DY); }

  // ---------- along the quay ----------
  for (let z = QZ0 + 5; z <= QZ1 - 3; z += 8) { if (PIERS.some(p => Math.abs(z - p) < 3.2) || z < 512) continue; S.put(G2.cyl8, mats.darkMetal, QX1 - .9, QY + .35, z, .3, .7, .3); post(QX1 - .9, z, .34); }
  for (let z = 518, k = 0; z <= 656; z += 19, k++) { if (!PIERS.some(p => Math.abs(z - p) < 4)) K.bench(QX1 - 3.2, z, PI / 2, QY); P.lamp(QX0 + 1.2, z + 6, 1, 0); }
  for (let z = 503; z <= 660; z += 12.5) if (Math.abs(z - 585) > 9) P.palm(277.8, z, rr(.95, 1.15));
  // the harbour office, and a stack of crates and two stalls a car can scatter
  { const x = 286.5, z = 520; S.box(M.white, x, QY + 1.6, z, 7, 3.2, 6); S.put(roofGeo(6.8, 1.5, 7.8), N.navy, x, QY + 3.2, z).rotation.y = PI / 2; S.box(N.door, x + 3.52, QY + 1.1, z, .1, 2.1, 1.1, false); K.pane(x + 3.5, QY + 1.8, z - 1.9, 1.4, 1.1, 'z'); K.pane(x + 3.5, QY + 1.8, z + 1.9, 1.4, 1.1, 'z');
    solids.boxes.push({ x, z, hw: 3.5, hd: 3, h: QY + 4.5 }); P.sign('HARBOUR OFFICE', x + 3.56, QY + 3.75, z, PI / 2, 5.6, 1.1, '#14244f', '#ffffff'); }
  for (const [x, z] of [[285, 548], [286.1, 548.4], [285.4, 549.5], [285, 622], [286.2, 622.3], [296, 652], [297.1, 652.6]]) K.breakable('crate', x, QY, z, R() * .6, 1, 1);
  K.breakable('kiosk', 286, QY, 578, PI / 2, 1, 1); K.breakable('kiosk', 286, QY, 592, PI / 2, 1, 1); K.breakable('table', 289.5, QY, 573, .4, 1, 1); K.breakable('table', 289.5, QY, 597, 1.2, 1, 1);
  out.parked.push(['van', 285, 536, PI / 2], ['car', 285, 610, PI / 2], ['sport', 285, 636, -PI / 2], ['car', 288.4, 636, -PI / 2]);
  out.walkers.push({ cx: 293.5, cz: 582, hx: 6.5, hz: 78, n: 8 });

  // the slipway: drive a car into the sea if you like
  deck({ x: 313, z: 504, hl: 10, hw: 4.5, rot: 0, y0: QY, y1: WATER - 1 });
  { const s = S.box(mats.concrete, 313, (QY + WATER - 1) / 2 - .16, 504, Math.hypot(20, QY - WATER + 1), .3, 9); s.rotation.z = -Math.atan2(QY - WATER + 1, 20); }
  boat('sail', 343, 508, .5);

  // ---------- the breakwater, a green light at one end and a red one at the other ----------
  for (let z = 514; z <= 658; z += 4.6) { const x = 366 + Math.sin(z * .09) * 1.6, s = rr(2.6, 3.8), r = S.put(G2.rock, M.rock, x, WATER - .3, z, s * rr(1, 1.3), s * .62, s * rr(1, 1.3)); r.rotation.y = R() * 6.28; post(x, z, s * .9); }
  for (const [z, col] of [[511, 0x38d27a], [661, 0xe8455b]]) {
    S.put(G.cyl, mats.trim, 366, WATER + 1.8, z, .45, 5, .45); S.put(G.cyl, std({ color: col, roughness: .5 }), 366, WATER + 3.2, z, .47, 1.2, .47, false); S.put(G2.blob, mats.lampHead, 366, WATER + 4.6, z, .4, .4, .4, false);
    post(366, z, .6); api.lampPts.push(V(366, WATER + 4.6, z));
  }

  // ---------- the helipad on the bluff ----------
  {
    const x = 299, z = 688, y = Math.max(groundY(x - 9, z - 9), groundY(x + 9, z - 9), groundY(x, z + 9)) + .12;
    deck({ x, z, hl: 9.5, hw: 9.5, rot: 0, y0: y, plan: '#9d988f' }); box(mats.trim, x, y - 2.5, z, 19.4, 5, 19.4); S.own(K.slab(mats.asphalt, x - 9.5, z - 9.5, x + 9.5, z + 9.5, y + .01, 420));
    for (let i = 0; i < 24; i++) { const a = i / 24 * PI * 2; K.paint(x + Math.cos(a) * 7.4, z + Math.sin(a) * 7.4, 2.05, .34, y, 0xf2c230, -a + PI / 2); }
    for (const [a, b, c, d] of [[-1.7, 0, .7, 5.6], [1.7, 0, .7, 5.6], [0, 0, 3.4, .7]]) K.paint(x + a, z + b, c, d, y);
    for (const [a, b] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) { mesh(G2.blob, mats.lampHead, V(x + a, y + .2, z + b), V(.22, .22, .22), K.scene, false); api.lampPts.push(V(x + a, y + .6, z + b)); }
    box(mats.darkMetal, x - 11, y + 2.5, z - 8, .1, 5, .1); const sock = mesh(G2.cone, M.crane, V(x - 10.2, y + 4.7, z - 8), V(.35, 1.6, .35), K.scene, false); sock.rotation.z = PI / 2; post(x - 11, z - 8, .15);
    K.path(mats.concrete, [[277, 676], [286, 684], [290, 688]], 3.4, .06, 6); keepOut(x, z, 13); K.keepLine([[277, 676], [290, 688]], 3);
    out.zones.helipads = [{ x, z, y, name: 'MARLIN BAY' }];
  }

  // ---------- the yacht club ----------
  {
    const x = 243, z = 512, ys = [groundY(x - 10, z - 7), groundY(x + 10, z - 7), groundY(x + 10, z + 7), groundY(x - 10, z + 7), groundY(x + 14, z)], y = Math.max(...ys) + .15, lo = Math.min(...ys);
    box(M.white, x, y + 3.3, z, 20, 6.6, 14); box(mats.trim, x, (y + lo) / 2 - .4, z, 20.4, y - lo + 1.2, 14.4); box(N.navy, x, y + 3.3, z, 20.1, .3, 14.1, false);
    mesh(roofGeo(15.6, 3.2, 21.6), N.navy, V(x, y + 6.6, z), null, K.scene).rotation.y = PI / 2; solid(x, z, 10, 7);
    // the terrace facing the water: columns, a flat roof, tables
    deck({ x: x + 13, z, hl: 3, hw: 7, rot: 0, y0: y }); box(mats.trim, x + 13, (y + lo) / 2 - .45, z, 6, y - lo + .9, 14);
    box(mats.trim, x + 13, y + 3.9, z, 6.4, .3, 14.4); for (const s of [-6.6, -2.2, 2.2, 6.6]) { mesh(G.cyl, M.white, V(x + 15.6, y + 1.95, z + s), V(.2, 3.9, .2), K.scene); post(x + 15.6, z + s, .26); }
    box(N.door, x + 10.05, y + 1.2, z, .12, 2.4, 2.2, false); for (const s of [-4.4, 4.4]) K.pane(x + 10.02, y + 1.9, z + s, 2.6, 1.8, 'z', true); for (const s of [-5, 0, 5]) K.pane(x + 10.02, y + 5, z + s, 2, 1.3, 'z');
    for (const s of [-6, 0, 6]) { K.pane(x + s, y + 1.9, z - 7.01, 2.2, 1.6, 'x'); K.pane(x + s, y + 1.9, z + 7.01, 2.2, 1.6, 'x'); }
    for (const s of [-4.6, 4.6]) K.breakable('table', x + 13, y, z + s, PI / 2, 1, 1);
    P.sign('MARLIN BAY YACHT CLUB', x + 16.1, y + 4.75, z, PI / 2, 13, 1.7, '#14244f', '#ffd34d');
    box(mats.darkMetal, x + 13, y + 6, z - 9.5, .1, 9, .1); box(M.red, x + 13.7, y + 10, z - 9.5, 1.4, .8, .04, false); post(x + 13, z - 9.5, .15);
    // its car park
    const px = x - 3, pz = z + 18, py = groundY(px, pz);
    K.drape(mats.asphalt, px - 15, pz - 6.5, px + 15, pz + 6.5, .07, 420, 3);
    for (let i = 0; i <= 10; i++) K.paint(px - 13.5 + i * 2.7, pz, .13, 5.4, groundY(px - 13.5 + i * 2.7, pz) + .05);
    for (const i of [1, 4, 5, 8]) out.parked.push([one(['sport', 'limo', 'sport', 'car']), px - 12.15 + i * 2.7, pz, PI / 2]);
    keepOut(x + 2, z + 4, 21); for (const [a, b] of [[-13, -10], [-13, 10], [4, -10]]) P.palm(x + a, z + b, rr(1, 1.2));
  }

  // ---------- the boat yard ----------
  {
    const x0 = 222, x1 = 264, z0 = 548, z1 = 588;
    K.drape(N.gravel, x0, z0, x1, z1, .06, 4, 3); keepOut((x0 + x1) / 2, (z0 + z1) / 2, 24);
    // a shed with an open front
    { const x = 232, z = 556, y = Math.max(groundY(x - 8, z - 6), groundY(x + 8, z - 6), groundY(x + 8, z + 6), groundY(x - 8, z + 6)) + .1;
      box(facade[7], x, y + 3.2, z, 16, 6.4, 11); box(mats.trim, x, y - 1, z, 16.2, 2.4, 11.2); mesh(roofGeo(12, 2.2, 17), mats.ac, V(x, y + 6.4, z), null, K.scene).rotation.y = PI / 2;
      box(mats.darkMetal, x + 8.03, y + 2.5, z, .1, 5, 7, false); solid(x, z, 8, 5.5); P.sign('BAY BOAT WORKS', x + 8.1, y + 5.7, z, PI / 2, 9, 1.4, '#14244f', '#ffffff'); }
    // boats out of the water on stands, one of them under the hoist
    const stand = (kind, x, z, ry) => {
      const y = groundY(x, z), [len, beam, h] = kind === 'yacht' ? [13, 4, 2] : kind === 'sail' ? [9, 2.8, 1.35] : [6.4, 2.3, 1], g = P.top(x, y + 1, z, -ry);
      mesh(hullGeo(len, beam, h), one(paints), null, null, g); mesh(hullGeo(len * .94, beam * .88, .1), M.wood, V(0, h - .04, 0), null, g, false);
      if (kind !== 'speed') mesh(rbox(len * .4, .7, beam * .6, .2), M.white, V(-.4, h + .35, 0), null, g);
      for (const a of [-len * .3, len * .25]) for (const s of [-1, 1]) { const leg = mesh(G.box, mats.darkMetal, V(a, -.35, s * beam * .32), V(.12, 1.5, .12), g); leg.rotation.x = s * .35; }
      mesh(G.box, mats.darkMetal, V(0, -.6, 0), V(.5, .9, .3), g);
      const along = Math.abs(Math.cos(ry)) > .7; solids.boxes.push({ x, z, hw: (along ? len : beam) / 2 * .8, hd: (along ? beam : len) / 2 * .8, low: true, h: y + 3.4, wall: true });
    };
    stand('sail', 253, 556, PI / 2); stand('speed', 259, 571, .3); stand('yacht', 240, 578, 0); stand('speed', 226, 572, PI / 2);
    { const x = 240, z = 578, y = groundY(x, z);     // the hoist over the yacht
      for (const a of [-5, 5]) for (const s of [-3.4, 3.4]) { box(M.box[1], x + a, y + 3.4, z + s, .4, 6.8, .4); post(x + a, z + s, .32); }
      for (const s of [-3.4, 3.4]) box(M.box[1], x, y + 6.9, z + s, 10.6, .5, .5); for (const a of [-5, 5]) box(M.box[1], x + a, y + 6.9, z, .45, .45, 7.2);
      for (const a of [-3, 3]) box(mats.darkMetal, x + a, y + 4.9, z, .12, 3.6, .12, false); }
    for (const [x, z] of [[247, 566], [248.1, 566.3], [247.5, 567.4], [229, 584]]) K.breakable('crate', x, groundY(x, z), z, R(), 1, 1);
    out.parked.push(['truck', 250, 585, 0], ['van', 258, 552, PI / 2]);
  }

  // ---------- the streets behind: flats and houses ----------
  const flats = (cx, cz, n) => { for (let i = 0; i < n; i++) { const s = n === 1 ? 0 : i * 2 - 1; house(cx + s * 12, cz + (i % 2 ? 3 : -3), rr(15, 18), rr(13, 15), one([12.4, 15.8, 15.8, 19.2])); } };
  flats(189, 513, 2); flats(243, 623, 2);
  for (const [a, b] of [[-20, -20], [20, 20], [-20, 20], [20, -20], [0, 18], [0, -18]]) { P.palm(189 + a, 513 + b, rr(1, 1.2)); P.palm(243 + a, 621 + b, rr(1, 1.2)); }
  out.parked.push(['car', 189, 532.5, 0], ['taxi', 176, 494.5, 0], ['car', 243, 641.5, 0], ['van', 262, 606, PI / 2]);
  for (const cj of [17, 18]) {
    const bx = nodeX(10) + 27, bz = nodeX(cj) + 27;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const lx = bx + sx * 10, lz = bz + sz * 10;
      if (R() < .16) { for (let k = 0; k < 3; k++) P.tree(lx + rr(-6, 6), lz + rr(-6, 6), rr(.9, 1.3)); keepOut(lx, lz, 10); continue; }
      const h = K.home(lx, lz, sx, 0, one([0, 1, 1, 2])); keepOut(lx, lz, 10.5);
      if (R() < .5) { const [cx, cz] = h.W(h.gx, h.gz + 3.6); out.parked.push([one(['car', 'car', 'van', 'sport', 'bike']), cx, cz, sx > 0 ? 0 : PI]); }
      if (R() < .7) { const [tx, tz] = h.W(h.bx + rr(-6, -3.2), h.front + rr(4.6, 5.4)); P.palm(tx, tz, rr(.9, 1.1)); }
      if (R() < .5) { const [ax, az] = h.W(-9.4, h.edge - .4), [ex, ez] = h.W(9.4, h.edge - .4), [g1x, g1z] = h.W(h.gx, h.edge - .4), [g2x, g2z] = h.W(h.dx, h.edge - .4); K.fence('picket', ax, az, ex, ez, [[g1x, g1z, 2.5], [g2x, g2z, 1.3]]); }
    }
    out.walkers.push({ cx: bx, cz: bz, hx: 21.5, hz: 21.5, n: 1 });
  }
  for (const [cx, cz] of [[189, 513], [243, 513], [243, 567], [243, 621]]) out.walkers.push({ cx, cz, hx: 21.5, hz: 21.5, n: 1 });

  // ---------- a gas station on the road to the base ----------
  {
    const x = 189, z = 678, y = groundY(x, z - 14) + .05;
    house(x, z + 6, 14, 9, 6.6, true);
    K.drape(mats.concrete, x - 12, z - 19, x + 12, z, .06, 6, 3);
    box(mats.trim, x, y + 5.2, z - 10, 15, .5, 9); box(M.red, x, y + 5.2, z - 10, 15.1, .2, 9.1, false);
    for (const [a, b] of [[-6.4, -3.4], [6.4, -3.4], [-6.4, 3.4], [6.4, 3.4]]) { box(M.white, x + a, y + 2.5, z - 10 + b, .4, 5, .4); post(x + a, z - 10 + b, .3); }
    for (const a of [-2.6, 2.6]) { mesh(rbox(.9, 1.5, .6, .1), M.red, V(x + a, groundY(x + a, z - 10) + .75, z - 10), null, K.scene); post(x + a, z - 10, .5); }
    P.sign('GAS', x, y + 6.6, z - 14.6, PI, 6, 2.2, '#e8455b', '#ffffff'); keepOut(x, z - 8, 13); out.parked.push(['car', x + 3.4, z - 13.4, 0]);
    api.lampPts.push(V(x, y + 4.8, z - 10));
  }
  scatter(34, 164, 650, 268, 700, (x, z) => P.tree(x, z, rr(.9, 1.4)));
  scatter(10, 218, 650, 268, 700, (x, z) => P.palm(x, z, rr(.9, 1.15)));
  scatter(26, 272, 440, 318, 494, (x, z) => P.palm(x, z, rr(.9, 1.2)));

  out.spots.marina = { x: 292, z: 585, berths, seaplane: { x: 357, z: PIERS[3], y: DY }, slipway: { x: 313, z: 504 }, dockY: DY };
}
