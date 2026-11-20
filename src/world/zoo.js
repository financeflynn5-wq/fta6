// Sunset Zoo: on the grass between the coast road and the lighthouse. A cream wall all the way round, a gate
// on the coast road wide enough to drive through, a back gate to the lighthouse, two paths that cross at a
// golden lion, and eight enclosures: zebras, penguins, bears and lions down the west side, giraffes, hippos,
// elephants and gorillas down the east. Every enclosure has a fence you can break and a yellow keeper's gate
// you can open. This file builds the place; who lives in it and what they do is wildlife/zooLife.js, which
// reads the plan left in districts.zones.zoo. Fence kinds are drawn by world/places.js.
import * as THREE from 'three';
import { V, seeded, randSeed } from '../core/utils.js';
import { mats, std, G, mesh, facade, awnings } from './materials.js';
import { groundY } from './terrain.js';
import { makeBeast, animateBeast } from '../wildlife/beasts.js';

const PI = Math.PI;
const X0 = 282, X1 = 339, Z0 = 228, Z1 = 336, CX = 310, CZ = 272, FW = 304.5, FE = 315.5;      // the wall; where the paths cross; the fronts of the west and east enclosures
const PENS = [
  { id: 'zebra', name: 'ZEBRAS', x0: X0 + .5, x1: FW, z0: Z0 + .5, z1: 247.5, fence: 'rail', who: ['zebra', 'zebra', 'zebra'] },
  { id: 'penguin', name: 'PENGUINS', x0: X0 + .5, x1: FW, z0: 251, z1: 265, fence: 'glass', who: ['penguin', 'penguin', 'penguin', 'penguin', 'penguin', 'penguin', 'penguin'], pool: [294, 258, 5.2] },
  { id: 'bear', name: 'BEARS', x0: X0 + .5, x1: FW, z0: 279, z1: 302, fence: 'bars', who: ['bear', 'bear'], pool: [297, 285, 3.6] },
  { id: 'lion', name: 'LIONS', x0: X0 + .5, x1: FW, z0: 305.5, z1: Z1 - .5, fence: 'bars', who: ['lion', 'lioness', 'lioness'], perch: [291, 323] },
  { id: 'giraffe', name: 'GIRAFFES', x0: FE, x1: X1 - .5, z0: Z0 + .5, z1: 247.5, fence: 'rail', who: ['giraffe', 'giraffe'] },
  { id: 'hippo', name: 'HIPPOS', x0: FE, x1: X1 - .5, z0: 251, z1: 265, fence: 'stout', who: ['hippo', 'hippo'], pool: [327, 258, 6.5] },
  { id: 'elephant', name: 'ELEPHANTS', x0: FE, x1: X1 - .5, z0: 279, z1: 302, fence: 'stout', who: ['elephant', 'elephant'], pool: [331, 284.5, 4.4] },
  { id: 'gorilla', name: 'GORILLAS', x0: FE, x1: X1 - .5, z0: 305.5, z1: Z1 - .5, fence: 'bars', who: ['gorilla', 'gorilla'] },
];

// Pools and the lions' rock. Runs before the ground is drawn (north.js shapeNorth).
export function shapeZoo(F) {
  F({ x: 327, z: 258, r: 6.5, h: -1.5, flat: .55 });      // the hippos' pool
  F({ x: 294, z: 258, r: 5.2, h: -1, flat: .6 });         // the penguins' pool
  F({ x: 331, z: 284.5, r: 4.4, h: -.8, flat: .6 });      // the elephants' water hole
  F({ x: 297, z: 285, r: 3.6, h: -.8, flat: .6 });        // the bears' pond
  F({ x: 291, z: 323, r: 7, h: 2.3, flat: .5 });          // the lions' rock
}

export function buildZoo(K) {
  const { api, scene, solids, out, P, M, G2, box, post, keepOut, N } = K;
  const dice = randSeed(), Z = seeded(77031), zr = (a, b) => a + Z() * (b - a);       // our own dice: the palms roll the city's, which we put back at the end
  const inside = (x, z, m = 1.5) => x > X0 - 5.5 && x < X1 + m && z > Z0 - m && z < Z1 + m;          // ...and the verge between the wall and the road

  // The bluff's trees and rocks were scattered before the zoo was thought of: clear the site.
  for (let i = scene.children.length - 1; i >= 0; i--) { const o = scene.children[i]; if (inside(o.position.x, o.position.z)) scene.remove(o); }
  for (let i = solids.posts.length - 1; i >= 0; i--) if (inside(solids.posts[i].x, solids.posts[i].z)) solids.posts.splice(i, 1);
  keepOut(CX, (Z0 + Z1) / 2, 60);

  // ---------- materials ----------
  const stucco = facade[3], coping = N.roofs[0];
  const sand = std({ color: 0xdcc58f, roughness: 1 }), straw = std({ color: 0xcdb56a, roughness: 1 }), mud = std({ color: 0x94805c, roughness: 1 }), ice = std({ color: 0xf1f6f8, roughness: .55 });
  const murk = std({ color: 0x5d7f5e, roughness: .15, metalness: .2, transparent: true, opacity: .93 }), pond = std({ color: 0x3f98a8, roughness: .1, metalness: .2, transparent: true, opacity: .9 });
  const teal = std({ color: 0x2f9c8f, roughness: .6 }), coral = std({ color: 0xf2937a, roughness: .7 });

  // ---------- plants of our own (the district's ones roll its dice) ----------
  const tree = (x, z, s = 1, flat = false) => {
    const g = P.top(x, groundY(x, z) - .1, z, Z() * 6.28), c = M.canopy[Z() < .5 ? 0 : 1]; g.scale.setScalar(s * zr(.9, 1.15));
    mesh(G2.trunk, mats.trunk, V(0, 1.4, 0), V(1, 2.9, 1), g);
    if (flat) { mesh(G2.blob, c, V(0, 3.3, 0), V(2.7, .62, 2.7), g); mesh(G2.blob, c, V(1.3, 3.0, .5), V(1.6, .45, 1.6), g); mesh(G2.blob, c, V(-1.2, 3.05, -.7), V(1.7, .5, 1.7), g); }
    else { mesh(G2.blob, c, V(0, 3.7, 0), V(1.9, 1.6, 1.9), g); mesh(G2.blob, c, V(1, 3, .3), V(1.2, 1.05, 1.2), g); mesh(G2.blob, c, V(-.8, 3.1, -.5), V(1.3, 1.1, 1.3), g); }
    post(x, z, .3); return { x, z, r: .5 };
  };
  const bush = (x, z, s = 1, mat = M.canopy[Z() < .5 ? 0 : 1]) => mesh(G2.blob, mat, V(x, groundY(x, z) + .35 * s, z), V(s * zr(.9, 1.4), s * .7, s * zr(.9, 1.4)), scene);
  const rock = (x, z, s = 1, mat = M.rock, sy = zr(.6, 1)) => {
    const m = mesh(G2.rock, mat, V(x, groundY(x, z) + s * .15, z), V(s * zr(.9, 1.4), s * sy, s * zr(.9, 1.4)), scene); m.rotation.y = Z() * 6.28;
    if (s > .9) post(x, z, s * .85); return { x, z, r: s > .9 ? s * 1.1 : 0 };
  };
  const palm = (x, z, s = 1) => api.palm(x, z, s, groundY(x, z));
  const flowers = (x, z, w, d) => { for (let i = 0, n = Math.round(w * d * 6); i < n; i++) { const fx = x + zr(-w / 2, w / 2), fz = z + zr(-d / 2, d / 2); mesh(G2.blob, N.flowers[Math.floor(Z() * 4)], V(fx, groundY(fx, fz) + .16, fz), V(.09, .09, .09), scene, false); } };
  const hedge = (x0, z0, x1, z1, h = 1.1, w = 1.2) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 3)), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    for (let i = 0; i < n; i++) { const t = (i + .5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = groundY(x, z); box(N.hedge, x, y + h / 2 - .2, z, alongX ? len / n + .05 : w, h + .4, alongX ? w : len / n + .05); }
    solids.boxes.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hw: alongX ? len / 2 : w / 2, hd: alongX ? w / 2 : len / 2, low: true, h: groundY((x0 + x1) / 2, (z0 + z1) / 2) + h });
  };
  // a pool of water lying in a hollow (shapeZoo dug it): level with the lowest point of its rim
  const water = (x, z, r, mat) => {
    let y = 1e9; for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; y = Math.min(y, groundY(x + Math.cos(a) * r * .95, z + Math.sin(a) * r * .95)); }
    y -= .14; mesh(new THREE.CircleGeometry(r * .9, 28).rotateX(-PI / 2), mat, V(x, y, z), null, scene, false); return y;
  };

  // ---------- the wall ----------
  function wall(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 5.4)), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), l = len / n;
    for (let i = 0; i < n; i++) {
      const ax = x0 + (x1 - x0) * i / n, az = z0 + (z1 - z0) * i / n, bx = x0 + (x1 - x0) * (i + 1) / n, bz = z0 + (z1 - z0) * (i + 1) / n, x = (ax + bx) / 2, z = (az + bz) / 2;
      const ya = groundY(ax, az), yb = groundY(bx, bz), lo = Math.min(ya, yb) - .5, top = Math.max(ya, yb) + 2.5;
      box(stucco, x, (lo + top) / 2, z, alongX ? l : .5, top - lo, alongX ? .5 : l); box(coping, x, top + .08, z, alongX ? l + .04 : .72, .16, alongX ? .72 : l + .04);
      solids.walls.push({ x, z, hl: l / 2, ht: .25, rot: alongX ? 0 : PI / 2, kind: 'solid', h: top });
    }
  }
  const GW = 6.5, EW = 2.6;                              // half the width of the main gate, and of the lighthouse gate
  wall(X0, Z0, X0, CZ - GW); wall(X0, CZ + GW, X0, Z1); wall(X1, Z0, X1, CZ - EW); wall(X1, CZ + EW, X1, Z1); wall(X0, Z0, X1, Z0); wall(X0, Z1, X1, Z1);
  for (const [x, z] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]]) { const y = groundY(x, z); box(stucco, x, y + 1.3, z, .9, 3.6, .9); box(coping, x, y + 3.2, z, 1.1, .2, 1.1, false); }

  // ---------- the main gate, on the coast road ----------
  K.gate('SUNSET ZOO', X0, CZ, 'z', GW * 2, '#0f5c4f', '#ffd34d');
  K.path(mats.concrete, [[277.2, CZ], [X0 + 1, CZ]], GW * 2 - 1, .05, 6);
  // a golden lion either side of it, and one rearing where the paths cross
  const statue = (kind, x, y, z, ry, pose = 'idle', s = 1) => {
    const m = makeBeast(kind, { statue: true, scale: s }); for (let i = 0; i < 50; i++) animateBeast(m, 2.2 + i / 30, 1 / 30, 0, pose);
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  };
  for (const s of [-1, 1]) {
    const x = X0 - 1.5, z = CZ + s * (GW + 2.3), y = groundY(x, z);
    box(stucco, x, y + .6, z, 1.7, 1.6, 3.2); box(coping, x, y + 1.45, z, 1.9, .14, 3.4, false); solids.boxes.push({ x, z, hw: .85, hd: 1.6, low: true, h: y + 1.5 });
    statue('lion', x, y + 1.52, z, s > 0 ? PI : 0, 'idle', .8);
  }
  {
    const y = groundY(CX, CZ);
    K.disc(N.gravel, CX, CZ, 8.2, .075, 4, 3, 26);
    mesh(G.cyl, mats.trim, V(CX, y + .25, CZ), V(2.3, .5, 2.3), scene); mesh(G.cyl, stucco, V(CX, y + .9, CZ), V(1.5, .9, 1.5), scene); mesh(G.cyl, coping, V(CX, y + 1.4, CZ), V(1.65, .14, 1.65), scene, false);
    statue('lion', CX, y + 1.47, CZ, -PI / 2, 'rear', 1.05); post(CX, CZ, 2.3);
    api.lampPts.push(V(CX, y + 4.2, CZ));
  }
  // the back gate: out to the lighthouse
  for (const s of [-1, 1]) {
    const z = CZ + s * EW, y = groundY(X1, z);
    box(stucco, X1, y + 1.5, z, .8, 3.3, .8); mesh(G2.blob, mats.lampHead, V(X1, y + 3.5, z), V(.4, .4, .4), scene, false); post(X1, z, .5); api.lampPts.push(V(X1, y + 3.4, z));
  }

  // ---------- paths ----------
  K.path(N.gravel, [[CX, Z0 + 1.2], [CX, Z1 - 1.2]], 7, .06); K.path(N.gravel, [[X0 + .5, CZ], [X1 + 4.5, CZ]], 7, .065);

  // ---------- the enclosures ----------
  const label = K.atlas(PENS.map(p => p.name)), breakables = out.breakables;
  for (const pen of PENS) {
    const west = pen.x1 === FW, front = west ? pen.x1 : pen.x0, mz = (pen.z0 + pen.z1) / 2, mx = (pen.x0 + pen.x1) / 2;
    pen.panels = []; pen.obst = []; pen.west = west; pen.front = front; pen.cx = mx; pen.cz = mz;
    // one run of fence; out = which way is out of the enclosure; gateAt = how far along the keeper's gate is
    const run = (ax, az, bx, bz, nx, nz, gateAt = -1) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 2.6)), w = len / n, rot = Math.atan2(bz - az, bx - ax), gi = gateAt < 0 ? -1 : Math.min(n - 1, Math.floor(gateAt * n));
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n, x = ax + (bx - ax) * (t0 + t1) / 2, z = az + (bz - az) * (t0 + t1) / 2;
        const y = Math.min(groundY(ax + (bx - ax) * t0, az + (bz - az) * t0), groundY(ax + (bx - ax) * t1, az + (bz - az) * t1)) - .04, gate = i === gi;
        const b = pen.fence === 'glass' && !gate ? { kind: 'glass', x, y, z, rot, w, h: 1.3, through: true } : { kind: gate ? (pen.fence === 'bars' ? 'gateTall' : 'gateLow') : pen.fence, x, y, z, rot, w, h: 1.3 };
        b.pen = pen.id; b.nx = nx; b.nz = nz; b.gate = gate; breakables.push(b); pen.panels.push(b); if (gate) pen.gate = b;
        if (pen.fence === 'glass') for (const t of i ? [t1] : [t0, t1]) { const px = ax + (bx - ax) * t, pz = az + (bz - az) * t; box(mats.metal, px, groundY(px, pz) + .65, pz, .09, 1.5, .09, false); }
      }
    };
    run(front, pen.z0, front, pen.z1, west ? 1 : -1, 0, pen.z0 < CZ ? .82 : .18);          // the front, with the gate at the end nearer the middle of the zoo
    if (pen.z0 > Z0 + 1) run(pen.x0, pen.z0, pen.x1, pen.z0, 0, -1);
    if (pen.z1 < Z1 - 1) run(pen.x0, pen.z1, pen.x1, pen.z1, 0, 1);
    // its name, facing the path
    {
      const x = front + (west ? .55 : -.55), y = groundY(x, mz), ry = west ? PI / 2 : -PI / 2;
      label(pen.name, x + (west ? .06 : -.06), y + 1.5, mz, ry, 1.9); box(mats.darkMetal, x, y + 1.5, mz, .08, 1, 2, false);
      for (const s of [-.85, .85]) box(mats.darkMetal, x, y + .5, mz + s, .08, 1, .08, false);
    }
  }
  const pen = Object.fromEntries(PENS.map(p => [p.id, p]));
  const scatterIn = (p, n, fn, m = 2.5, ok = null) => { for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) { const x = zr(p.x0 + m, p.x1 - m), z = zr(p.z0 + m, p.z1 - m); if (p.pool && Math.hypot(x - p.pool[0], z - p.pool[1]) < p.pool[2] + 1 || p.obst.some(o => Math.hypot(x - o.x, z - o.z) < o.r + 1.6) || ok && !ok(x, z)) continue; const o = fn(x, z); if (o && o.r) p.obst.push(o); i++; } };

  // zebras: a sandy paddock, flat-topped trees, a trough and hay
  {
    const p = pen.zebra; K.drape(sand, p.x0 + .3, p.z0 + .3, p.x1 - .3, p.z1 - .3, .05, 5, 2.5);
    p.obst.push(tree(288, 234, 1.25, true), tree(299, 243, 1.1, true));
    const y = groundY(296, 231.6); box(M.wood, 296, y + .3, 231.6, 3, .6, 1); box(N.pool, 296, y + .56, 231.6, 2.7, .1, .7, false); solids.boxes.push({ x: 296, z: 231.6, hw: 1.5, hd: .5, low: true, h: y + .7 }); p.obst.push({ x: 296, z: 231.6, r: 1.6 });
    for (const [x, z] of [[285.5, 244.5], [286.4, 242.8]]) { K.breakable('bale', x, groundY(x, z), z, Z() * 3, 1, 1); p.obst.push({ x, z, r: 1 }); }
    scatterIn(p, 4, (x, z) => rock(x, z, zr(.4, .8))); scatterIn(p, 5, (x, z) => bush(x, z, zr(.5, .8), straw));
  }
  // giraffes: the same, with a feeding basket up a pole
  {
    const p = pen.giraffe; K.drape(sand, p.x0 + .3, p.z0 + .3, p.x1 - .3, p.z1 - .3, .05, 5, 2.5);
    p.obst.push(tree(333, 233, 1.5, true), tree(321, 243.5, 1.35, true), tree(335, 244, 1.2, true));
    const x = 326, z = 232.5, y = groundY(x, z); mesh(G.cyl, mats.trunk, V(x, y + 2.2, z), V(.12, 4.4, .12), scene); box(M.wood, x, y + 4.2, z, 1.2, .5, 1.2); mesh(G2.blob, straw, V(x, y + 4.6, z), V(.6, .35, .6), scene, false); post(x, z, .2); p.obst.push({ x, z, r: .8 });
    scatterIn(p, 3, (x2, z2) => rock(x2, z2, zr(.4, .8))); scatterIn(p, 5, (x2, z2) => bush(x2, z2, zr(.5, .8), straw));
  }
  // penguins: ice, a blue pool and a berg to stand on
  {
    const p = pen.penguin, [px, pz, pr] = p.pool; K.drape(ice, p.x0 + .3, p.z0 + .3, p.x1 - .3, p.z1 - .3, .05, 5, 1.5);
    p.water = water(px, pz, pr, N.pool);
    for (const [x, z, s, h] of [[286.6, 262.2, 2.2, 1.5], [288.6, 263.3, 1.5, 1], [285.4, 259.4, 1.5, .8], [301, 253, 1.3, .7]]) { mesh(G2.rock, ice, V(x, groundY(x, z) + h * .3, z), V(s, h, s), scene).rotation.y = Z() * 6; post(x, z, s * .8); p.obst.push({ x, z, r: s }); }
    for (const [x, z] of [[292, 256.5], [296.4, 259.6]]) mesh(G2.rock, ice, V(x, p.water + .05, z), V(.8, .2, .7), scene, false).rotation.y = Z() * 6;
  }
  // hippos: mud all round a deep green pool
  {
    const p = pen.hippo, [px, pz, pr] = p.pool; K.drape(mud, p.x0 + .3, p.z0 + .3, p.x1 - .3, p.z1 - .3, .05, 5, 1.5);
    p.water = water(px, pz, pr, murk);
    p.obst.push(rock(318.5, 262.5, 1.2), rock(336, 253.5, 1.4)); for (const [x, z] of [[317.5, 253], [336.4, 262.6], [319.5, 263.6]]) bush(x, z, zr(.7, 1));
  }
  // elephants: bare earth, a water hole, boulders and a log
  {
    const p = pen.elephant, [px, pz, pr] = p.pool; K.drape(N.dirt, p.x0 + .3, p.z0 + .3, p.x1 - .3, p.z1 - .3, .05, 5, 1.5);
    p.water = water(px, pz, pr, pond);
    p.obst.push(rock(319, 298.5, 1.6), rock(335.5, 299.5, 1.3), tree(319.5, 283, 1.5, true));
    const lx = 327, lz = 297.5, log = mesh(G.cyl, mats.trunk, V(lx, groundY(lx, lz) + .32, lz), V(.34, 4.4, .34), scene); log.rotation.set(0, .5, PI / 2); solids.boxes.push({ x: lx, z: lz, hw: 2, hd: .5, low: true, h: groundY(lx, lz) + .7 }); p.obst.push({ x: lx, z: lz, r: 2.2 });
    scatterIn(p, 3, (x, z) => rock(x, z, zr(.4, .8)));
  }
  // bears: a den of boulders against the wall, a pond, logs
  {
    const p = pen.bear, [px, pz, pr] = p.pool; p.water = water(px, pz, pr, pond);
    for (const [x, z, s, h] of [[285, 295, 2.3, 1.5], [285.3, 299.4, 2, 1.3], [285.6, 290.8, 1.8, 1.1], [286.4, 297.2, 1.6, 2]]) { mesh(G2.rock, M.rock, V(x, groundY(x, z) + h * .4, z), V(s, h, s), scene).rotation.y = Z() * 6; post(x, z, s * .85); p.obst.push({ x, z, r: s * 1.05 }); }
    box(mats.tire, 287.6, groundY(287.6, 297.2) + .8, 297.2, .3, 1.6, 2, false);                       // the dark of the cave mouth
    p.obst.push(tree(301, 299, 1.2), tree(290, 281.5, 1.1));
    const lx = 296, lz = 294, log = mesh(G.cyl, mats.trunk, V(lx, groundY(lx, lz) + .3, lz), V(.32, 3.6, .32), scene); log.rotation.set(0, -.6, PI / 2); solids.boxes.push({ x: lx, z: lz, hw: 1.6, hd: .5, low: true, h: groundY(lx, lz) + .7 }); p.obst.push({ x: lx, z: lz, r: 1.9 });
    scatterIn(p, 4, (x, z) => bush(x, z, zr(.6, 1))); scatterIn(p, 3, (x, z) => rock(x, z, zr(.4, .8)));
  }
  // lions: dry grass and the rock they lie on
  {
    const p = pen.lion; K.drape(straw, p.x0 + .3, p.z0 + .3, p.x1 - .3, 315.5, .05, 5, 2.5); K.drape(straw, 298.5, 315.5, p.x1 - .3, p.z1 - .3, .05, 5, 2.5);
    for (const [x, z, s] of [[286, 317.5, 1.3], [297.5, 327, 1.1], [285.2, 329.5, 1.2]]) p.obst.push(rock(x, z, s));
    p.obst.push(tree(300.5, 331.5, 1.3, true), tree(300, 309.5, 1.1, true));
    scatterIn(p, 6, (x, z) => bush(x, z, zr(.5, .8), straw), 2.5, (x, z) => Math.hypot(x - 291, z - 323) > 7.5);
  }
  // gorillas: thick green, a climbing frame, a tyre on a rope
  {
    const p = pen.gorilla, x = 328, z = 322, y = groundY(x, z);
    for (const [a, b] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) { mesh(G.cyl, mats.trunk, V(x + a, y + 1.9, z + b), V(.16, 3.9, .16), scene); post(x + a, z + b, .2); }
    box(M.wood, x, y + 2.3, z, 4.2, .16, 4.2); box(M.wood, x + 2.9, y + 1.2, z, 1.8, .14, 2.4); for (const b of [-1.1, 1.1]) mesh(G.cyl, mats.trunk, V(x + 3.7, y + .6, z + b), V(.12, 1.2, .12), scene);
    const beam = mesh(G.cyl, mats.trunk, V(x - 3.1, y + 3.6, z), V(.1, 2.9, .1), scene); beam.rotation.z = PI / 2; mesh(G.cyl, mats.trunk, V(x - 4.5, y + 1.85, z), V(.14, 3.8, .14), scene); post(x - 4.5, z, .2);
    box(mats.darkMetal, x - 3.3, y + 2.5, z, .04, 2.2, .04, false); const tyre = mesh(G2.torus, mats.tire, V(x - 3.3, y + 1.15, z), null, scene); tyre.rotation.y = PI / 2;
    p.obst.push({ x, z, r: 3.4 }, { x: x - 4.2, z, r: 1.2 }, tree(319, 331, 1.3), tree(335, 309.5, 1.2), tree(334.5, 331.5, 1.1), rock(320.5, 311, 1.3), rock(336, 320, 1.1));
    scatterIn(p, 9, (bx, bz) => bush(bx, bz, zr(.8, 1.3)));
  }

  // ---------- between and beside the enclosures ----------
  for (const [z0, z1] of [[247.5, 251], [302, 305.5]]) for (const [x0, x1] of [[X0 + 1, FW], [FE, X1 - 1]]) {
    const z = (z0 + z1) / 2; hedge(x0 + .6, z, x1 - .6, z, 1.2, 1.5);
    for (let x = x0 + 4; x < x1 - 2; x += 7) palm(x, z, zr(.8, 1));
  }
  for (const [x, z, ry] of [[FW + 1.1, 240, PI / 2], [FE - 1.1, 258, -PI / 2], [FW + 1.1, 290.5, PI / 2], [FE - 1.1, 296, -PI / 2], [FW + 1.1, 326, PI / 2], [FE - 1.1, 314, -PI / 2]]) K.bench(x, z, ry);
  for (const [x, z, dx] of [[FW + 1, 233.5, 1], [FE - 1, 249, -1], [FW + 1, 303.6, 1], [FE - 1, 331, -1], [FW + 1, 320, 1], [FE - 1, 287, -1]]) P.lamp(x, z, dx, 0);
  for (const z of [236.5, 244, 254.5, 262, 283, 298.5, 309, 331.5]) for (const x of [FW + .9, FE - .9]) if (!(z > 250 && z < 266) || x > CX) flowers(x, z + (x < CX ? 0 : 3), .9, 2.4);

  // the way in: ticket booths, flags, flower beds
  for (const s of [-1, 1]) {
    const x = 288.5, z = CZ + s * 5.4, y = Math.max(groundY(x - 1.6, z), groundY(x + 1.6, z)) + .05;
    box(s > 0 ? coral : teal, x, y + 1.15, z, 3.2, 2.5, 2.4); box(mats.carGlass, x, y + 1.5, z - s * 1.22, 2.2, .9, .06, false); box(mats.trim, x, y + 1, z - s * 1.38, 2.6, .1, .4, false);
    const roof = box(awnings[s > 0 ? 0 : 1], x, y + 2.5, z - s * .3, 3.7, .14, 3.4); roof.rotation.x = s * .16; solids.boxes.push({ x, z, hw: 1.6, hd: 1.2, h: y + 2.7 });
    P.sign('TICKETS', x, y + 3.25, z - s * 1.3, s > 0 ? PI : 0, 2.6, .7, '#14244f', '#ffd34d');
    for (const fx of [284.4, 293.6, 298.6]) { const fz = CZ + s * 4.4, fy = groundY(fx, fz); box(mats.trim, fx, fy + 2.6, fz, .07, 5.2, .07, false); box(N.flowers[(fx * 7 | 0) % 4], fx + .5, fy + 4.85, fz, .95, .55, .04, false); }
    box(mats.trim, 298, groundY(298, CZ + s * 6) + .12, CZ + s * 6, 9, .3, 1.5, false); flowers(298, CZ + s * 6, 8.4, 1.1); solids.boxes.push({ x: 298, z: CZ + s * 6, hw: 4.5, hd: .75, low: true, h: groundY(298, CZ + s * 6) + .4 });
    palm(301.8, CZ + s * 6, .85); palm(294.4, CZ + s * 6, .8);
  }
  // the other side of the lion: a snack bar and somewhere to sit
  {
    const x = 322, z = CZ - 5.2, y = groundY(x, z) + .05;
    box(coral, x, y + 1.2, z, 4, 2.4, 2.6); box(mats.trim, x, y + 1.02, z + 1.5, 4.2, .1, .5, false); box(mats.carGlass, x, y + 1.55, z + 1.32, 3, .8, .06, false);
    const roof = box(awnings[2], x, y + 2.55, z + .4, 4.6, .14, 3.8); roof.rotation.x = .16; solids.boxes.push({ x, z, hw: 2, hd: 1.3, h: y + 2.8 });
    P.sign('SNACKS', x, y + 3.3, z + 1.35, 0, 2.6, .7, '#b3261e', '#fff4e6'); K.spot(x, z + 2.3, 'mart', 1.8);
    for (const [tx, tz] of [[329, CZ + 5.4], [333.5, CZ + 5.6], [331, CZ - 5.2]]) K.breakable('table', tx, groundY(tx, tz), tz, Z() * 3, 1, 1);
    for (const [bx, bz] of [[318.5, CZ + 6.1], [336.6, CZ - 5.6], [336.8, CZ + 4.2]]) { palm(bx, bz, zr(.75, .9)); }
    flowers(325, CZ + 6.2, 4, 1); K.bench(323.5, CZ + 5, PI);
  }
  // palms along the wall on the road side
  for (let z = Z0 + 6; z < Z1; z += 12.5) if (Math.abs(z - CZ) > GW + 5) palm(X0 - 2.2, z, zr(.8, 1));
  // cars at the kerb outside
  out.parked.push(['car', 275.6, CZ - 22, -PI / 2], ['van', 275.6, CZ + 20, -PI / 2], ['car', 275.6, CZ + 27, -PI / 2]);
  // people strolling: up and down the long path, and in and out of the gate
  out.walkers.push({ cx: CX, cz: 282, hx: 3, hz: 49, n: 7 }, { cx: 294.5, cz: CZ, hx: 10, hz: 2.4, n: 3 }, { cx: 327, cz: CZ, hx: 9, hz: 2.4, n: 2 });

  out.spots.zoo = { x: X0 - 4, z: CZ };
  out.zones.zoo = { x0: X0, x1: X1, z0: Z0, z1: Z1, cx: CX, cz: CZ, gate: { x: X0, z: CZ, hw: GW }, back: { x: X1, z: CZ, hw: EW }, pens: PENS };
  randSeed(dice);
}
