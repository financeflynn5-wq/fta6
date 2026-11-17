// Flamingo Park: the big green in the middle of the valley. A gravel loop and a tree-lined promenade,
// a pond with flamingos and a dock, a bandstand on the hill, a fountain plaza, a picnic knoll and a
// ramp that throws cars into the pond. All of it is open ground: you can drive anywhere in it.
import * as THREE from 'three';
import { V } from '../core/utils.js';
import { mats, G, mesh, awnings } from './materials.js';
import { groundY } from './terrain.js';
import { roofGeo } from './props.js';

const PI = Math.PI;

export function buildPark(K) {
  const { scene, out, P, M, G2, R, rr, one, box, solid, post, deck, scatter, keepOut, N } = K;
  const X0 = -155, X1 = -7, Z0 = 493, Z1 = 695, CX = -81, CZ = 594, POND = { x: -54, z: 594, y: groundY(-54, 594) + .45 };
  const wet = (x, z) => groundY(x, z) < POND.y + .12 && Math.hypot(x - POND.x, z - POND.z) < 34;

  // A flamingo, standing on one leg. Pink ones wade in the pond; a golden one tops the fountain.
  function flamingo(x, y, z, ry, mat, s = 1) {
    const g = P.top(x, y, z, ry); g.scale.setScalar(s);
    mesh(G.cyl, mat, V(0, .55, 0), V(.022, 1.1, .022), g, false);
    const knee = mesh(G.cyl, mat, V(.07, .92, .05), V(.02, .42, .02), g, false); knee.rotation.z = -.9;
    mesh(G2.blob, mat, V(0, 1.25, 0), V(.36, .25, .2), g); mesh(G2.blob, mat, V(-.3, 1.3, 0), V(.2, .1, .12), g, false);
    const n1 = mesh(G.cyl, mat, V(.36, 1.52, 0), V(.045, .56, .045), g, false); n1.rotation.z = -.55;
    const n2 = mesh(G.cyl, mat, V(.5, 1.88, 0), V(.04, .36, .04), g, false); n2.rotation.z = .35;
    mesh(G2.blob, mat, V(.46, 2.08, 0), V(.09, .08, .075), g, false);
    const beak = mesh(G.box, mats.darkMetal, V(.57, 2.0, 0), V(.16, .05, .045), g, false); beak.rotation.z = -.7;
    return g;
  }

  // ---------- paths ----------
  const loop = [[-140, 508], [-22, 508], [-22, 680], [-140, 680], [-140, 508]];
  K.path(N.gravel, loop, 4.2, .06); for (const [x, z] of loop.slice(1)) K.disc(N.gravel, x, z, 2.6, .065, 4, 1, 10);
  K.path(N.gravel, [[CX, Z0 + 2], [CX, Z1 - 2]], 5.6, .08);                                   // the promenade, gate to gate
  K.path(N.gravel, [[X0 + 2, CZ], [-113, CZ]], 3.4, .07); K.path(N.gravel, [[-103, CZ], [CX, CZ]], 3.4, .07);      // west gate, over the hill, to the water
  K.path(N.gravel, [[-22, CZ], [X1 - 2, CZ]], 3.4, .07);                                      // east gate
  const ring = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * PI * 2; ring.push([POND.x + Math.cos(a) * 29, POND.z + Math.sin(a) * 29]); }
  K.path(N.gravel, ring, 2.8, .05);
  const sw = [[-140, 508], [-124, 552], [-111, 589]], nw = [[-106, 599], [-119, 640], [-140, 680]];
  K.path(N.gravel, sw, 2.6, .055); K.path(N.gravel, nw, 2.6, .055);
  for (const l of [loop, [[CX, Z0], [CX, Z1]], [[X0, CZ], [X1, CZ]], ring, sw, nw]) K.keepLine(l, 3.6);

  // ---------- gates ----------
  K.gate('FLAMINGO PARK', CX, Z0 + 3, 'x', 13); K.gate('FLAMINGO PARK', CX, Z1 - 3, 'x', 13);
  for (const [gx, dir] of [[X0 + 3, 1], [X1 - 3, -1]]) for (const s of [-1, 1]) {
    const z = CZ + s * 3.6, y = groundY(gx, z);
    box(mats.trim, gx, y + 1.5, z, .8, 3, .8); mesh(G2.blob, mats.lampHead, V(gx, y + 3.35, z), V(.4, .4, .4), scene, false); post(gx, z, .55);
    K.api.lampPts.push(V(gx, y + 3.3, z));
  }

  // ---------- the pond ----------
  mesh(new THREE.CircleGeometry(33, 40).rotateX(-PI / 2), mats.seaTop, V(POND.x, POND.y, POND.z), null, scene, false);
  keepOut(POND.x, POND.z, 26);
  // the dock on the west shore, and two rowing boats tied to it
  let shore = POND.x; while (groundY(shore, CZ) < POND.y + .35 && shore > -92) shore -= .5;
  const d0 = shore - 1, d1 = shore + 13, dy = POND.y + .4;
  deck({ x: (d0 + d1) / 2, z: CZ, hl: (d1 - d0) / 2, hw: 1.5, rot: 0, y0: dy });
  box(M.wood, (d0 + d1) / 2, dy - .1, CZ, d1 - d0, .2, 3);
  for (let x = d0 + 2; x <= d1; x += 3.6) for (const s of [-1.35, 1.35]) { mesh(G2.cyl8, mats.trunk, V(x, dy - .5, CZ + s), V(.14, 1.9, .14), scene); }
  for (const s of [-1, 1]) {
    const bx = d1 - 2.4, bz = CZ + s * 2.7, g = P.top(bx, POND.y, bz, s * .12);
    mesh(G.box, s > 0 ? M.red : M.white, V(0, .12, 0), V(3.2, .5, 1.25), g); mesh(G.box, M.wood, V(0, .3, 0), V(2.8, .16, .95), g, false);
    for (const o of [-.7, .5]) mesh(G.box, M.wood, V(o, .42, 0), V(.3, .06, 1.1), g, false);
    solid(bx, bz, 1.6, .65, true);
  }
  // flamingos wading in the shallows
  for (let i = 0, tries = 0; i < 11 && tries < 300; tries++) {
    const a = rr(-.9, 2.6), d = rr(15, 24), x = POND.x + Math.cos(a) * d, z = POND.z + Math.sin(a) * d, gy = groundY(x, z);
    if (gy > POND.y - .12 || gy < POND.y - .5) continue;
    flamingo(x, gy, z, R() * 6.28, N.pink, rr(.9, 1.15)); i++;
  }
  // a little island of reeds and a fountain jet in the middle
  mesh(G.cyl, mats.trim, V(POND.x, POND.y - .1, POND.z), V(1.6, .5, 1.6), scene); post(POND.x, POND.z, 1.6);
  mesh(G2.blob, N.spray, V(POND.x, POND.y + 2.6, POND.z), V(.35, 2.8, .35), scene, false);
  for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; const jet = mesh(G2.blob, N.spray, V(POND.x + Math.cos(a) * 1.1, POND.y + 1.1, POND.z + Math.sin(a) * 1.1), V(.14, 1.3, .14), scene, false); jet.rotation.set(Math.sin(a) * .5, 0, -Math.cos(a) * .5); }

  // the Flamingo Fling: a ramp west of the promenade that throws you over it and out into the water
  const FLING = CZ + 13;
  { const rx = CX - 11.5; out.ramps.pond = P.ramp(rx, FLING, 0, 10, 6, 2.5); keepOut(rx, FLING, 8); K.keepLine([[-150, FLING], [shore + 4, FLING]], 4.5); }

  // ---------- the bandstand on the hill ----------
  {
    const x = -108, z = CZ, y = groundY(x, z) + .32;
    mesh(G2.cyl8, mats.trim, V(x, y - .5, z), V(5.4, 1.6, 5.4), scene); mesh(G2.cyl8, M.wood, V(x, y + .31, z), V(5.1, .06, 5.1), scene, false);
    deck({ x, z, hl: 3.7, hw: 3.7, rot: 0, y0: y + .34 });
    for (let i = 0; i < 8; i++) {
      const a = (i + .5) / 8 * PI * 2, px = x + Math.cos(a) * 4.6, pz = z + Math.sin(a) * 4.6;
      mesh(G.cyl, M.white, V(px, y + 2.1, pz), V(.14, 3.6, .14), scene); post(px, pz, .2);
      if (i % 4 !== 1) { const rail = box(M.white, x + Math.cos(a + PI / 8) * 4.3, y + 1.25, z + Math.sin(a + PI / 8) * 4.3, 3.5, .09, .09, false); rail.rotation.y = -(a + PI / 8) + PI / 2; }
    }
    mesh(G2.cyl8, M.white, V(x, y + 3.95, z), V(5.3, .3, 5.3), scene);
    mesh(G2.cone, N.roofs[0], V(x, y + 5.3, z), V(5.9, 2.5, 5.9), scene); mesh(G2.blob, N.gold, V(x, y + 6.75, z), V(.3, .5, .3), scene, false);
    K.api.lampPts.push(V(x, y + 3.6, z)); keepOut(x, z, 8); out.spots.bandstand = { x, z };
  }

  // ---------- the fountain plaza inside the south gate ----------
  {
    const x = CX, z = 524, y = groundY(x, z);
    K.disc(mats.walk, x, z, 11, .1, 40, 3, 26);
    const top = K.fountain(x, z, y + .1, 3.6, 2.4);
    flamingo(x, top - .05, z, PI / 2, N.gold, 1.7);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * PI * 2 + PI / 8, bx = x + Math.cos(a) * 9.2, bz = z + Math.sin(a) * 9.2;
      if (Math.abs(Math.cos(a)) < .35) continue;                                       // the promenade runs through
      K.bench(bx, bz, Math.atan2(-Math.cos(a), -Math.sin(a)));
    }
    keepOut(x, z, 13);
    // a hot dog cart
    const hx = x + 7.4, hz = z - 7.6, hy = groundY(hx, hz);
    box(M.red, hx, hy + .75, hz, 2.2, 1, 1.1); box(mats.trim, hx, hy + 1.28, hz, 2.4, .08, 1.3, false);
    for (const s of [-.8, .8]) { const w = mesh(G.cyl, mats.tire, V(hx + s, hy + .3, hz + .6), V(.3, .1, .3), scene, false); w.rotation.x = PI / 2; }
    mesh(G.cyl, mats.trim, V(hx, hy + 2, hz), V(.04, 1.6, .04), scene, false); mesh(G2.cone, one(awnings), V(hx, hy + 2.9, hz), V(1.9, .6, 1.9), scene);
    solid(hx, hz, 1.1, .55, true); K.spot(hx, hz + 1.5, 'mart');
  }

  // ---------- benches, lamps and flower beds along the promenade ----------
  const bed = (x, z, r = 1.5) => {
    const y = groundY(x, z); mesh(G.cyl, N.dirt, V(x, y + .08, z), V(r, .22, r), scene, false);
    const c = one(N.flowers); for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2, d = i ? r * .58 : 0; mesh(G2.blob, i % 3 === 2 ? M.canopy[0] : c, V(x + Math.cos(a) * d, y + .34, z + Math.sin(a) * d), V(r * .36, .26, r * .36), scene, false); }
  };
  for (let z = 540, k = 0; z <= 676; z += 17, k++) {
    if (Math.abs(z - CZ) < 8 || Math.abs(z - FLING) < 8) continue;
    const s = k % 2 ? 1 : -1;
    K.bench(CX + s * 3.6, z, s > 0 ? -PI / 2 : PI / 2); bed(CX - s * 4.3, z + 4); P.lamp(CX - s * 3.5, z - 4.5, s, 0);
  }
  for (let i = 0; i < 16; i += 2) { const a = (i + .5) / 16 * PI * 2; if (Math.abs(Math.sin(a)) < .3 && Math.cos(a) < 0) continue; if (Math.cos(a) < 0 && Math.abs(POND.z + Math.sin(a) * 31.2 - FLING) < 7) continue;      // not across the Flamingo Fling
    K.bench(POND.x + Math.cos(a) * 31.2, POND.z + Math.sin(a) * 31.2, Math.atan2(-Math.cos(a), -Math.sin(a))); }
  for (const [x, z] of [[-140, 508], [-22, 508], [-22, 680], [-140, 680], [-22, 560], [-22, 630], [-140, 560], [-140, 640], [-52, 508], [-110, 508], [-52, 680], [-110, 680]]) P.lamp(x + (x < CX ? -2.6 : 2.6), z + (z < CZ ? -2.6 : 2.6), x < CX ? 1 : -1, 0);
  for (const [x, z] of [[-96, 508], [-66, 508], [-22, 540], [-22, 648], [-96, 680], [-66, 680], [-140, 540], [-140, 620]]) bed(x + (Math.abs(x - CX) > 50 ? (x < CX ? 3.6 : -3.6) : 0), z + (Math.abs(x - CX) > 50 ? 0 : (z < CZ ? 3.6 : -3.6)), 1.7);

  // ---------- the picnic knoll ----------
  {
    const kx = -126, kz = 655;
    for (const [a, b, ry] of [[-5, -3, .3], [4, -5, -.5], [5, 4, 1.2], [-4, 5, 2.2]]) {
      const x = kx + a, z = kz + b, g = P.top(x, groundY(x, z), z, ry);
      mesh(G.box, M.wood, V(0, .76, 0), V(1.9, .08, .8), g); for (const s of [-.62, .62]) mesh(G.box, M.wood, V(0, .44, s), V(1.9, .06, .28), g, false);
      for (const s of [-.7, .7]) mesh(G.box, mats.darkMetal, V(s, .38, 0), V(.08, .76, 1.4), g, false);
      post(x, z, .9);
    }
    const y = groundY(kx, kz); mesh(G.cyl, mats.darkMetal, V(kx, y + .45, kz), V(.05, .9, .05), scene, false); mesh(G2.blob, mats.darkMetal, V(kx, y + .95, kz), V(.42, .26, .42), scene); post(kx, kz, .4);
    keepOut(kx, kz, 8);
  }

  // ---------- the great lawn: towels and umbrellas, nothing else ----------
  const lawn = (x, z) => x > -72 && x < -30 && z > 522 && z < 556;
  for (let i = 0; i < 7; i++) P.umbrella(rr(-68, -34), rr(526, 552));

  // ---------- trees ----------
  const dry = (x, z) => !wet(x, z) && Math.hypot(x - POND.x, z - POND.z) > 26 && !lawn(x, z);
  scatter(120, X0 + 2, Z0 + 2, X1 - 2, Z1 - 2, (x, z) => P.tree(x, z, rr(1, 1.7)), dry);
  scatter(16, X0 + 2, Z0 + 2, X1 - 2, Z1 - 2, (x, z) => P.palm(x, z, rr(.9, 1.2)), dry);
  scatter(46, X0 + 2, Z0 + 2, X1 - 2, Z1 - 2, (x, z) => P.bush(x, z, rr(.8, 1.5)), dry);
  for (let z = 532; z <= 672; z += 10) for (const s of [-1, 1]) if (Math.abs(z - CZ) > 9 && Math.abs(z - 524) > 14) P.tree(CX + s * 6.6, z, rr(1.1, 1.35));      // the avenue of trees

  out.walkers.push({ cx: CX, cz: CZ, hx: 59, hz: 86, n: 9 }, { cx: CX, cz: CZ, hx: 1.6, hz: 88, n: 5 }, { cx: POND.x, cz: POND.z, hx: 28, hz: 28, n: 3 });
  out.spots.park = { x: CX, z: 524 };
}
