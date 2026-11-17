// What stands on the land outside downtown, district by district:
//   Palm Promenade + Sunset Beach (south), Vista Heights (north), Port Sunset (east),
//   The Dustlands + High Meadows (west). Positions are hand-picked; scatter is seeded.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD } from '../config.js';
import { V, seeded, randSeed } from '../core/utils.js';
import { mats, G, mesh, rbox, facade } from './materials.js';
import { plainGeometry } from './batching.js';
import { groundY, landY, addFeature, addDeck, surfaceAt, nearRibbon } from './terrain.js';
import { STEP, NX, NZ, WATER, CITY, hasRoad, nodeX, cellType } from './map.js';
import { makeProps, roofGeo } from './props.js';
import { buildNorth, shapeNorth } from './north.js';

const PI = Math.PI;
export const RACEWAY = { x: -243, z: -108, rx: 55, rz: 80 };      // the dirt oval in the Dustlands

// Hills, gullies and bumps on open land. Must run before the ground is drawn.
export function shapeLand() {
  const F = addFeature;
  // Dustlands south: the raceway
  F({ x: RACEWAY.x, z: RACEWAY.z, r: 30, h: 5 });                                    // infield hill
  F({ x: -190, z: -95, r: 20, h: .8, len: 8, dir: PI / 2 });                         // washboard on the east straight
  F({ x1: -310, z1: -120, x2: -284, z2: -120, r: 9, h: 2.2, flat: .5 });             // table-top jump on the west straight
  // Dustlands north: the canyon, Rocco's Rock, dunes
  F({ x1: -305, z1: 70, x2: -185, z2: 150, r: 12, h: -6, flat: .5 });
  F({ x: -285, z: 175, r: 40, h: 10, flat: .6 });
  F({ x: -215, z: 96, r: 18, h: 2.5 }); F({ x: -265, z: 26, r: 13, h: 2 });           // (kept clear of Highway 6, which runs along z = 54)
  // High Meadows and the East Bluffs
  F({ x: -300, z: 296, r: 28, h: 6 }); F({ x: 232, z: 296, r: 26, h: 5 });
  // dunes behind the beach
  for (const [x, z, r, h] of [[-200, -246, 14, 1.3], [-120, -244, 12, 1], [95, -247, 13, 1.1], [152, -241, 10, .8]]) F({ x, z, r, h });
  shapeNorth(F);          // the valley beyond the ridge (north.js)
}

export function buildDistricts(api) {
  const keep = randSeed();                       // downtown's dice: put back at the end
  const R = seeded(424242), P = makeProps(api, R), { M, G2, rr, one, top } = P;
  const { scene, realScene, solids } = api, L = WORLD.LIMIT;
  const out = { decks: [], ramps: {}, parked: [], walkers: [], animated: [], spots: {}, breakables: [], zones: {} };
  const deck = (d) => { out.decks.push(addDeck(d)); return d; };
  const box = (mat, x, y, z, sx, sy, sz, cast = true) => mesh(G.box, mat, V(x, y, z), V(sx, sy, sz), scene, cast);
  const solid = (x, z, hw, hd, low = false) => solids.boxes.push({ x, z, hw, hd, low });
  const post = (x, z, r) => solids.posts.push({ x, z, r });

  // the edge of the world: invisible walls out at sea and up in the mountains
  const LN = WORLD.LIMIT_N, mid = (LN - L) / 2, tall = (LN + L) / 2 + 4;
  for (const [x, z, hw, hd] of [[0, -L - 2, L + 4, 2], [0, LN + 2, L + 4, 2], [-L - 2, mid, 2, tall], [L + 2, mid, 2, tall]]) solids.boxes.push({ x, z, hw, hd, wall: true });

  // ---------- scatter helpers ----------
  const taken = [], keepOut = (x, z, r) => taken.push([x, z, r]);
  const clear = (x, z, m = 2.5) => landY(x, z) > WATER + .3 && surfaceAt(x - m, z) !== 'road' && surfaceAt(x + m, z) !== 'road' && surfaceAt(x, z - m) !== 'road' && surfaceAt(x, z + m) !== 'road'
    && !taken.some(([tx, tz, r]) => Math.abs(x - tx) < r && Math.abs(z - tz) < r) && !nearRibbon(x, z, m + 1.5);      // nothing grows under a highway
  function scatter(n, x0, z0, x1, z1, fn, ok = null) {
    for (let i = 0, tries = 0; i < n && tries < n * 14; tries++) { const x = rr(x0, x1), z = rr(z0, z1); if (!clear(x, z) || (ok && !ok(x, z))) continue; fn(x, z); i++; }
  }
  // a building that sits level on sloping ground, with a foundation under the downhill side
  function house(cx, cz, w, d, h, signs = false) {
    const ys = [groundY(cx - w / 2, cz - d / 2), groundY(cx + w / 2, cz - d / 2), groundY(cx - w / 2, cz + d / 2), groundY(cx + w / 2, cz + d / 2)];
    const y = Math.max(...ys), lo = Math.min(...ys);
    if ([[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]].some(([a, b]) => nearRibbon(cx + a * w / 2, cz + b * d / 2, 2.5))) return;     // a highway runs here
    api.building(cx, cz, w, d, h, signs, y, signs);      // houses get one roof unit, not a downtown roof's worth
    if (y - lo > .05) box(mats.trim, cx, (y + lo) / 2 - .5, cz, w + .2, y - lo + 1, d + .2);
    keepOut(cx, cz, Math.max(w, d) / 2 + 2.5);
  }

  // =====================================================================================
  // PALM PROMENADE: the green strip between downtown and the coast road
  // =====================================================================================
  house(-27, -186, 16, 12, 8.6);                                                    // Pizza Pier
  P.sign('PIZZA PIER', -27, 6.6, -192.2, PI, 12, 3, '#e8455b', '#fff4e6');
  out.spots.pizza = { x: -27, z: -201 };
  house(-135, -187, 12, 11, 7.6, true); house(70, -186, 11, 11, 8.6, true); house(93, -186, 11, 11, 7.6, true);
  for (const [cx, n] of [[-81, 5], [135, 3]]) {                                     // car parks
    box(mats.concrete, cx, .03, -191, 34, .06, 26, false); keepOut(cx, -189, 19);
    for (let i = 0; i < n; i++) out.parked.push([R() < .2 ? 'taxi' : 'car', cx - (n - 1) * 3 + i * 6, -189, PI / 2]);
  }
  out.ramps.beach = P.ramp(27, -200, -PI / 2, 10, 6, 2.4); keepOut(27, -200, 9);
  // the arch over the pier entrance
  P.sign('SUNSET BEACH', 0, 7.2, -224.5, 0, 17, 3.4, '#14244f', '#ffd34d', 150, true);
  for (const sx of [-8, 8]) { box(mats.trim, sx, 4, -224.5, .5, 8, .5); post(sx, -224.5, .4); }
  keepOut(0, -196, 9);
  scatter(30, -155, -208, 155, -170, (x, z) => P.palm(x, z, rr(.9, 1.2)));
  scatter(16, -155, -208, 155, -170, (x, z) => P.bush(x, z, rr(.8, 1.3)));

  // =====================================================================================
  // SUNSET BEACH: boardwalk, pier, barge, big wheel
  // =====================================================================================
  deck({ x: 0, z: -229.5, hl: 150, hw: 3.5, rot: 0, y0: .14, plan: '#c9a36b' });
  for (let x = -125; x <= 125; x += 50) box(M.wood, x, .04, -229.5, 50, .2, 7, false);
  out.walkers.push({ cx: 0, cz: -229.5, hx: 140, hz: 2.2, n: 12 });

  // the pier: up a short slope, 80 m out over the water, a ramp off the end
  deck({ x: 0, z: -228, hl: 5, hw: 5, rot: -PI / 2, y0: 0, y1: 1, plan: '#c9a36b' });
  deck({ x: 0, z: -272.5, hl: 39.5, hw: 5, rot: -PI / 2, y0: 1, plan: '#c9a36b' });
  const slope = box(M.wood, 0, .42, -228, 10, .2, 10.1); slope.rotation.x = Math.atan2(1, 10);
  box(M.wood, 0, .8, -272.5, 10, .4, 79);
  for (let z = -240; z >= -310; z -= 10) for (const sx of [-4.6, 4.6]) mesh(G2.cyl8, mats.trunk, V(sx, -1.2, z), V(.28, 4.4, .28), scene);
  for (const sx of [-5, 5]) {
    box(mats.trim, sx, 2, -272.5, .14, .12, 79, false); solid(sx * 1.03, -272.5, .15, 39.5, true);
    for (let z = -234; z >= -312; z -= 6) box(mats.darkMetal, sx, 1.5, z, .1, 1, .1, false);
    solid(sx * .81, -312.1, 1.05, .15, true); box(mats.trim, sx * .81, 2, -312, 2, .12, .14, false);
  }
  out.ramps.pier = P.ramp(0, -306, -PI / 2, 12, 6, 2.6, 1);
  for (const z of [-245, -265, -285]) P.lamp(4.4, z, -1, 0);
  out.walkers.push({ cx: 0, cz: -266, hx: 3.4, hz: 30, n: 5 });
  keepOut(0, -270, 9); keepOut(27, -236, 8);                                         // pier, and the landing strip of the promenade ramp

  // the barge you land on
  deck({ x: 0, z: -347, hl: 21, hw: 7, rot: -PI / 2, y0: -.4, plan: '#7d7468' });
  box(M.hull, 0, -1.65, -347, 14, 2.4, 42); box(mats.darkMetal, 0, -.44, -347, 13.4, .1, 41.4, false);
  for (const sx of [-6.85, 6.85]) box(mats.yellowPaint, sx, -.3, -347, .3, .3, 42, false);
  P.container(-3.2, -365.5, 'x', 0, -.4); P.container(3.2, -365.5, 'x', 0, -.4); P.container(0, -365.5, 'x', 1, -.4);
  out.spots.barge = { x: 0, z: -347 };

  // the big wheel
  {
    const wx = 50, wz = -256, wy = groundY(wx, wz), Rw = 11, hub = wy + Rw + 2.2;
    for (const sz of [-1.6, 1.6]) for (const sx of [-1, 1]) { const leg = box(mats.trim, wx + sx * 3.2, wy + (Rw + 2.2) / 2, wz + sz, .45, Rw + 3.4, .45); leg.rotation.z = sx * Math.atan2(3.2, Rw + 2.2) * 1.9; }
    box(mats.concrete, wx, wy + .25, wz, 9, .5, 5.4); solid(wx, wz, 4.5, 2.7); keepOut(wx, wz, 13);
    const parts = [], lights = [], cars = [[], [], []], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const at = (geo, x, y, z, sx, sy, sz, rz = 0) => plainGeometry(geo, m4.compose(V(x, y, z), q.setFromEuler(e.set(0, 0, rz)), V(sx, sy, sz)));
    for (const z of [-1, 1]) parts.push(at(new THREE.TorusGeometry(Rw, .16, 6, 48), 0, 0, z, 1, 1, 1));
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * PI * 2, cx = Math.cos(a), cy = Math.sin(a);
      for (const z of [-1, 1]) parts.push(at(G.box, cx * Rw / 2, cy * Rw / 2, z, Rw, .1, .1, a));
      parts.push(at(G.box, cx * Rw, cy * Rw, 0, .12, .12, 2.1));
      cars[i % 3].push(at(rbox(1.5, 1.3, 1.5, .25), cx * Rw, cy * Rw - .2, 0, 1, 1, 1));
      lights.push(at(G2.blob, cx * Rw, cy * Rw, 1.15, .22, .22, .22), at(G2.blob, cx * Rw * .5, cy * Rw * .5, 1.15, .16, .16, .16));
    }
    parts.push(at(G2.cyl8, 0, 0, 0, .7, 2.6, .7).rotateX(PI / 2));
    const wheel = new THREE.Group(); wheel.position.set(wx, hub, wz); realScene.add(wheel);
    const add = (list, mat) => { const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = true; wheel.add(m); };
    add(parts, mats.trim); add(lights, mats.lampHead); add(cars[0], M.box[0]); add(cars[1], M.box[3]); add(cars[2], M.box[1]);
    out.animated.push((dt) => { wheel.rotation.z += dt * .12; });
    out.spots.wheel = { x: wx, z: wz };
  }
  // lifeguard towers, cabins, a volleyball net, umbrellas, palms, rocks
  for (const lx of [-112, 112]) {
    const y = groundY(lx, -262);
    for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(mats.trim, lx + ax, y + 1.2, -262 + az, .16, 2.4, .16);
    box(mats.trim, lx, y + 2.45, -262, 3.2, .14, 3.2); mesh(rbox(2.4, 1.8, 2.4, .12), M.white, V(lx, y + 3.4, -262), null, scene);
    mesh(roofGeo(3, .7, 3), M.red, V(lx, y + 4.3, -262), null, scene); post(lx, -262, 1.3); keepOut(lx, -262, 4);
  }
  for (let i = 0; i < 8; i++) {
    const x = 66 + i * 5.2, z = -238.5, y = groundY(x, z);
    mesh(rbox(3.4, 2.7, 3.4, .12), facade[i % facade.length], V(x, y + 1.35, z), null, scene); mesh(roofGeo(3.9, 1, 3.9), M.white, V(x, y + 2.7, z), null, scene); solid(x, z, 1.7, 1.7);
  }
  keepOut(84, -238.5, 23);
  { const y = groundY(-62, -252); for (const sx of [-5, 5]) { box(mats.trim, -62 + sx, y + 1.25, -252, .14, 2.5, .14); post(-62 + sx, -252, .2); } box(M.white, -62, y + 1.95, -252, 10, .9, .04, false); keepOut(-62, -252, 7); }
  scatter(44, -150, -276, 150, -239, (x, z) => { P.umbrella(x, z); keepOut(x, z, 3.2); });
  scatter(14, -160, -246, 160, -234, (x, z) => P.palm(x, z, rr(.85, 1.1)));
  scatter(16, -335, -285, -285, -230, (x, z) => P.rock(x, z, rr(.8, 2.4)));
  scatter(10, 190, -275, 235, -235, (x, z) => P.rock(x, z, rr(.7, 1.8)));

  // =====================================================================================
  // VISTA HEIGHTS: houses on the hill streets, and the sign on the mountain
  // =====================================================================================
  for (let ci = CITY.i0; ci < CITY.i1; ci++) for (let cj = 10; cj <= 12; cj++) {
    const bx = nodeX(ci) + STEP / 2, bz = nodeX(cj) + STEP / 2;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = bx + sx * 10.5, z = bz + sz * 10.5, r = R();
      if (r < .62) house(x, z, rr(10.5, 13), rr(10.5, 13), one([8.7, 9.2, 12.4, 12.9]), R() < .12);
      else if (r < .86) { for (let k = 0; k < 2 + Math.floor(R() * 2); k++) P.tree(x + rr(-5, 5), z + rr(-5, 5), rr(.9, 1.3)); }
      else P.palm(x, z, rr(1, 1.25));
    }
    out.walkers.push({ cx: bx, cz: bz, hx: 21.5, hz: 21.5, n: R() < .6 ? 1 : 0 });
  }
  P.sign('SUNSET COAST', 27, groundY(27, 357) + 6.5, 357, PI, 76, 11, null, '#fff8ea', 190);
  for (let x = -6; x <= 60; x += 11) box(mats.darkMetal, x, groundY(x, 357.6) + 2, 357.6, .3, 6, .3);
  out.spots.lookout = { x: 54, z: 324 };
  // trees up the mountain sides
  scatter(60, -160, 334, 320, 368, (x, z) => P.tree(x, z, rr(1, 1.7)));
  scatter(26, -160, 334, 320, 368, (x, z) => P.rock(x, z, rr(.9, 2.6)));

  // =====================================================================================
  // PORT SUNSET: warehouses, container yards, the quay, cranes and a ship
  // =====================================================================================
  function warehouse(cx, cz, w, d, h, label) {
    const along = d >= w, fm = one(facade);
    box(fm, cx, h / 2, cz, w, h, d); box(mats.trim, cx, h + .2, cz, w + .5, .4, d + .5); box(mats.trim, cx, .5, cz, w + .2, 1, d + .2);
    const roof = mesh(roofGeo(along ? w + 1 : d + 1, 2.8, along ? d + 1 : w + 1), mats.ac, V(cx, h + .4, cz), null, scene); if (!along) roof.rotation.y = PI / 2;
    const n = Math.floor((along ? d : w) / 12);
    for (let i = 0; i < n; i++) {                                // roller doors on the side facing the street to the west
      const u = (i - (n - 1) / 2) * 12;
      if (along) box(mats.darkMetal, cx - w / 2 - .05, 2.4, cz + u, .2, 4.8, 6, false); else box(mats.darkMetal, cx + u, 2.4, cz - d / 2 - .05, 6, 4.8, .2, false);
    }
    if (label) along ? P.sign(label, cx - w / 2 - .2, h - 2.2, cz, -PI / 2, Math.min(d - 4, 26), 3.4, '#14244f', '#ffffff') : P.sign(label, cx, h - 2.2, cz - d / 2 - .2, PI, Math.min(w - 4, 26), 3.4, '#14244f', '#ffffff');
    solid(cx, cz, w / 2, d / 2); keepOut(cx, cz, Math.max(w, d) / 2 + 3);
  }
  warehouse(198, -118, 40, 26, 10, 'PORT SUNSET'); warehouse(198, -44, 40, 26, 11, 'COLD STORAGE'); warehouse(238, 62, 34, 70, 11, 'SUNSET FREIGHT');
  warehouse(297, -120, 30, 50, 10, null); warehouse(297, 100, 30, 60, 10, null);
  // the Container Hop: up the ramp, land on the stack, drive off the far end
  out.ramps.containers = P.ramp(244, -141, PI / 2, 10, 5.2, 2.6); keepOut(244, -125, 24);
  deck({ x: 244, z: -118, hl: 9, hw: 2.6, rot: PI / 2, y0: 2.6 });
  for (const z of [-124, -118, -112]) for (const sx of [-1.3, 1.3]) mesh(G.box, one(M.box), V(244 + sx, 1.3, z), V(2.5, 2.6, 6), scene);
  // container yards
  function yard(x0, z0, cols, rows, along = 'z') {
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const x = x0 + c * (along === 'z' ? 3.4 : 6.6), z = z0 + r * (along === 'z' ? 6.6 : 3.4);
      if (R() < .22 || !clear(x, z, 3.5)) continue;
      const levels = 1 + Math.floor(R() * R() * 3.2); for (let l = 0; l < levels; l++) P.container(x, z, along, l, 0);
      if (levels > 1) solids.boxes[solids.boxes.length - 1].low = false;      // tall stacks stop flying cars too
    }
  }
  yard(226, -100, 9, 13); yard(176, 22, 2, 3); yard(180, 128, 12, 6, 'x'); yard(282, -80, 8, 20); yard(282, -205, 8, 5); yard(176, -205, 24, 5);
  for (const k of [-155, -100, -40, 30, 90, 150]) keepOut(341.5, k, 0);
  // car bowling: a lane on the north lot, a wall of boxes behind the pins
  out.spots.bowling = { x: 200, z: 26, dir: PI / 2, pinsX: 200, pinsZ: 112 };
  for (const sx of [-4.2, 4.2]) box(M.white, 200 + sx, .03, 70, .2, .05, 100, false);
  for (let z = 40; z <= 100; z += 20) { const a = box(mats.yellowPaint, 200, .03, z, 1, .05, 4, false); a.scale.x = 1; }
  for (let i = -1; i <= 1; i++) { P.container(200 + i * 6.2, 121, 'x', 0, 0); P.container(200 + i * 6.2, 121, 'x', 1, 0); solids.boxes[solids.boxes.length - 1].low = false; }
  taken.push([200, 70, 60]);
  // the quay: flat concrete out over the water, bollards along the edge, two cranes
  deck({ x: 341.5, z: -23.5, hl: 185.5, hw: 10.5, rot: PI / 2, y0: 0, plan: '#9d988f' });
  for (let z = -178; z <= 131; z += 61.8) box(mats.trim, 341.5, -2.5, z, 21, 5, 61.8, false);
  box(mats.yellowPaint, 351.4, .03, -23.5, .35, .05, 371, false);
  for (let z = -200; z <= 156; z += 12) { mesh(G2.cyl8, mats.darkMetal, V(351.6, .35, z), V(.3, .7, .3), scene); post(351.6, z, .35); }
  for (const cz of [-92, 72]) {
    for (const lx of [335.5, 347.5]) for (const lz of [-6, 6]) { box(M.crane, lx, 11, cz + lz, .9, 22, .9); post(lx, cz + lz, .65); }
    box(M.crane, 341.5, 22.6, cz, 14, 1.2, 14); box(M.crane, 352, 25, cz, 46, 1.1, 1.8); box(M.white, 345, 20.8, cz, 3.2, 2.4, 3.2);
    box(M.crane, 341.5, 27.5, cz, 1, 5, 1); const stay = box(mats.darkMetal, 356, 27.6, cz, 30, .12, .12, false); stay.rotation.z = -.16;
    box(mats.darkMetal, 364, 19, cz, .08, 11, .08, false); mesh(G.box, one(M.box), V(364, 12.3, cz), V(2.5, 2.6, 6), scene);
  }
  // a freighter tied up at the quay
  box(M.hull, 364, .5, 40, 13, 7, 78); box(mats.darkMetal, 364, -2.2, 40, 13.1, 1.6, 78.1, false); box(M.white, 364, 9, 73, 11, 10, 9);
  mesh(G2.cyl8, M.red, V(364, 16, 75), V(1.4, 5, 1.4), scene); solid(364, 40, 6.5, 39);
  for (let z = 6; z <= 62; z += 6.4) for (const sx of [-3, 0, 3]) for (let l = 0; l < 1 + Math.floor(R() * 2.5); l++) mesh(G.box, one(M.box), V(364 + sx, 5.3 + l * 2.6, z), V(2.5, 2.6, 6), scene);
  out.parked.push(['car', 181, -63, PI / 2], ['car', 181, -72, PI / 2], ['taxi', 262, 30, -PI / 2], ['car', 262, 140, -PI / 2], ['car', 311, -30, PI / 2]);
  out.walkers.push({ cx: 220, cz: -81, hx: 40, hz: 71, n: 4, kinds: ['scrap'] });
  // lighthouse up the coast
  {
    const lx = 346, lz = 292, y = groundY(lx, lz) - .3;
    for (let i = 0; i < 5; i++) mesh(G.cyl, i % 2 ? M.red : M.white, V(lx, y + 2.2 + i * 4.4, lz), V(3.1 - i * .34, 4.4, 3.1 - i * .34), scene);
    mesh(G.cyl, mats.darkMetal, V(lx, y + 22.2, lz), V(2.4, .4, 2.4), scene); mesh(G.cyl, mats.lampHead, V(lx, y + 23.6, lz), V(1.2, 2.4, 1.2), scene, false);
    mesh(G2.cone, M.red, V(lx, y + 25.6, lz), V(1.9, 1.6, 1.9), scene); post(lx, lz, 3.2); keepOut(lx, lz, 6);
    api.lampPts.push(V(lx, y + 23.6, lz)); out.spots.lighthouse = { x: lx, z: lz };
  }
  out.ramps.bluff = P.ramp(205, 286, 0, 10, 6, 2.6); keepOut(212, 286, 12);
  scatter(46, 170, 224, 365, 330, (x, z) => P.tree(x, z, rr(.9, 1.5)));
  scatter(14, 170, 224, 365, 330, (x, z) => P.rock(x, z, rr(.7, 1.7)));
  scatter(18, 170, 224, 365, 330, (x, z) => P.bush(x, z, rr(.8, 1.4)));

  // =====================================================================================
  // THE DUSTLANDS: the dirt raceway, the canyon, Rocco's Rock, a gas stop
  // =====================================================================================
  const onTrack = (x, z) => { const e = Math.hypot((x - RACEWAY.x) / RACEWAY.rx, (z - RACEWAY.z) / RACEWAY.rz); return e > .72 && e < 1.32; };
  for (let i = 0; i < 20; i++) { const a = i / 20 * PI * 2; P.tires(RACEWAY.x + Math.cos(a) * RACEWAY.rx * .76, RACEWAY.z + Math.sin(a) * RACEWAY.rz * .8); }
  P.sign('DUST DEVIL RACEWAY', -188, groundY(-188, -62) + 7, -62, PI, 18, 3, '#17181f', '#ff8a3d', 150, true);
  for (const sx of [-9, 9]) { box(mats.trim, -188 + sx, groundY(-188 + sx, -62) + 3.6, -62, .45, 7.4, .45); post(-188 + sx, -62, .35); }
  out.parked.push(['car', -176, -40, -PI / 2], ['car', -176, -48, -PI / 2]);
  out.spots.raceway = { x: -188, z: -58 };
  out.ramps.highway = P.ramp(-243, -20, PI / 2, 10, 6, 2.8); keepOut(-243, -20, 9); keepOut(-243, 18, 9);
  out.ramps.canyon = P.ramp(-232.8, 91.7, 2.159, 10, 6, 3); keepOut(-232.8, 91.7, 9);
  out.ramps.rock = P.ramp(-281, 172, -.6, 9, 6, 2.2); keepOut(-281, 172, 9);
  // gas stop on the desert road
  house(-200, 36, 13, 9, 6.6, true);
  box(mats.trim, -200, 5.1, 21, 13, .5, 8); for (const [ax, az] of [[-5.5, -3], [5.5, -3], [-5.5, 3], [5.5, 3]]) { box(M.white, -200 + ax, 2.5, 21 + az, .4, 5, .4); post(-200 + ax, 21 + az, .3); }
  for (const ax of [-2.5, 2.5]) { mesh(rbox(.9, 1.5, .6, .1), M.red, V(-200 + ax, groundY(-200 + ax, 21) + .75, 21), null, scene); post(-200 + ax, 21, .5); }
  P.sign('GAS', -200, 8.2, 16.9, PI, 6, 2.2, '#e8455b', '#ffffff'); keepOut(-200, 22, 10); out.parked.push(['car', -200, 17.6, 0]);
  // water tower
  { const x = -258, z = 22, y = groundY(x, z); for (const [ax, az] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) box(mats.darkMetal, x + ax, y + 4, z + az, .2, 8, .2); mesh(G.cyl, mats.water, V(x, y + 9.6, z), V(2.6, 3.4, 2.6), scene); mesh(G2.cone, mats.water, V(x, y + 12, z), V(2.8, 1.4, 2.8), scene); post(x, z, 2.2); keepOut(x, z, 5); }
  const wild = (x, z) => !onTrack(x, z);
  scatter(80, -317, -209, -169, 209, (x, z) => P.cactus(x, z, rr(.8, 1.5)), wild);
  scatter(60, -317, -209, -169, 209, (x, z) => P.rock(x, z, rr(.5, 2.2)), wild);
  scatter(26, -317, -209, -169, 209, (x, z) => P.bush(x, z, rr(.6, 1.1)), wild);
  scatter(30, -370, -200, -330, 330, (x, z) => P.rock(x, z, rr(1, 3)));
  // HIGH MEADOWS: a barn, a radio mast, woods
  {
    const x = -236, z = 262, y = groundY(x, z);
    box(M.red, x, y + 3, z, 14, 7, 10); box(M.white, x, y + 6.3, z, 14.3, .35, 10.3); mesh(roofGeo(11, 3.4, 15), mats.ac, V(x, y + 6.5, z), null, scene).rotation.y = PI / 2;
    box(M.white, x, y + 2.2, z - 5.05, 4, 4.4, .12, false); solid(x, z, 7, 5); keepOut(x, z, 11);
    box(mats.trim, x, y - 1.5, z, 14.4, 4, 10.4);
  }
  { const x = -300, z = 296, y = groundY(x, z); box(mats.darkMetal, x, y + 16, z, .5, 32, .5); for (let k = 8; k <= 32; k += 8) box(M.red, x, y + k, z, .7, 1.2, .7, false); mesh(G2.blob, mats.lampHead, V(x, y + 32.5, z), V(.5, .5, .5), scene, false); post(x, z, .5); api.lampPts.push(V(x, y + 31, z)); out.spots.mast = { x, z }; }
  scatter(90, -317, 223, -169, 330, (x, z) => P.tree(x, z, rr(.9, 1.6)));
  scatter(20, -317, 223, -169, 330, (x, z) => P.bush(x, z, rr(.8, 1.5)));
  scatter(14, -317, -205, -169, -172, (x, z) => P.palm(x, z, rr(.9, 1.15)));

  // =====================================================================================
  // THE VALLEY beyond the ridge: Palmview, Flamingo Park, Coral Plaza, Marlin Bay, Golden Acres, Fort Pelican
  // =====================================================================================
  buildNorth({ api, scene, realScene, solids, out, P, M, G2, R, rr, one, box, solid, post, deck, house, scatter, clear, keepOut });

  // ---------- street lamps along every road outside downtown ----------
  const inCity = (i) => i >= CITY.i0 && i <= CITY.i1;
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) for (const [di, dj] of [[1, 0], [0, 1]]) {
    if (i + di >= NX || j + dj >= NZ || !hasRoad(i, j, i + di, j + dj)) continue;
    if (inCity(i) && inCity(j) && inCity(i + di) && inCity(j + dj)) continue;
    const kind = cellType(Math.min(i, NX - 2), Math.min(j, NZ - 2));
    const far = kind !== 'hill' && kind !== 'lawn' && kind !== 'park' && (i + j) % 2;       // country roads get half as many
    for (const [s, side] of far ? [[27, 1]] : [[15, 1], [39, -1]]) {
      const x = nodeX(i) + di * s - dj * 8.4 * side, z = nodeX(j) + dj * s + di * 8.4 * side;
      if (!nearRibbon(x, z, 1.5)) P.lamp(x, z, dj * side, -di * side);
    }
  }

  randSeed(keep);
  return out;
}
