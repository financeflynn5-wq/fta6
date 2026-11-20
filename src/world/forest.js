// Whisper Woods: the pine forest that fills High Meadows, and the camp in the clearing in the middle of it.
// Everything here is scenery (districts.js calls buildForest while the map is being put together); who lives in the
// camp and what they do about visitors is missions/camp.js. The woods roll their own dice, so the rest of the map
// comes out exactly as it did before there was a forest.
import * as THREE from 'three';
import { CAMP } from '../config.js';
import { V, seeded } from '../core/utils.js';
import { mats, std, G, mesh, rbox, ctex } from './materials.js';
import { groundY, surfaceAt } from './terrain.js';
import { roofGeo } from './props.js';

export const WOODS = { x0: -317, z0: 223, x1: -169, z1: 331 };
const TRAIL = { x: -206, z: 221 };        // where the way in leaves the hill road
const PI = Math.PI;

// The trees that were here before keep out of the clearing: one that would have stood in it stands on its edge instead.
export function outOfClearing(x, z) {
  const dx = x - CAMP.x, dz = z - CAMP.z, d = Math.hypot(dx, dz), r = CAMP.clear + 2.5;
  return d >= r ? [x, z] : d < .01 ? [x + r, z] : [CAMP.x + dx / d * r, CAMP.z + dz / d * r];
}
// distance from a point to the trail (a straight line from the road to the clearing)
function offTrail(x, z) {
  const ax = TRAIL.x, az = TRAIL.z, bx = CAMP.x, bz = CAMP.z, vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - ax - vx * t, z - az - vz * t);
}

export function buildForest({ scene, realScene, solids, out, signMats }) {
  const R = seeded(90210), rr = (a, b) => a + R() * (b - a), one = (a) => a[Math.floor(R() * a.length)];
  const M = {
    pine: [std({ color: 0x3f8f58, roughness: .95 }), std({ color: 0x4f9d55, roughness: .95 }), std({ color: 0x357f5a, roughness: .95 })],
    bark: std({ color: 0x7a5a40, roughness: 1 }), log: std({ color: 0x9a7350, roughness: 1 }), cut: std({ color: 0xd9b98a, roughness: .9 }),
    stone: std({ color: 0x9a968f, roughness: 1 }), ash: std({ color: 0x3a3836, roughness: 1 }),
    tarp: [std({ color: 0x3e7fb0, roughness: .8, side: THREE.DoubleSide }), std({ color: 0x7a8a52, roughness: .9, side: THREE.DoubleSide }), std({ color: 0xd9843f, roughness: .85, side: THREE.DoubleSide })],
    card: std({ color: 0xc9a875, roughness: 1 }), rust: std({ color: 0x8a4a2e, roughness: .8, metalness: .4 }), wire: std({ color: 0xaab0b6, roughness: .4, metalness: .8 }),
    bed: std({ color: 0xd8d2c4, roughness: 1 }), rug: [0xb5462f, 0x3e6f9a, 0x8a7a3a, 0x6b4a7a].map(c => std({ color: c, roughness: 1 })), bottle: std({ color: 0x3f8a52, roughness: .2, metalness: .1 }),
    crate: std({ color: 0xb98a55, roughness: .95 }),
  };
  const geo = {
    cone: new THREE.ConeGeometry(1, 1, 9), trunk: new THREE.CylinderGeometry(.7, 1, 1, 7), cyl: new THREE.CylinderGeometry(1, 1, 1, 10), blob: new THREE.IcosahedronGeometry(1, 1),
    drum: new THREE.CylinderGeometry(1, 1, 1, 14, 1, true), tent: roofGeo(1, 1, 1),
  };
  const top = (x, y, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g); return g; };
  const post = (x, z, r, h) => solids.posts.push({ x, z, r, h });
  const low = (x, z, hw, hd) => solids.boxes.push({ x, z, hw, hd, low: true });
  const cx = CAMP.x, cz = CAMP.z;

  // ---------- the pines ----------
  const near = [];                             // everything already standing in the woods, so nothing grows through it
  for (const q of solids.posts) if (q.x > WOODS.x0 - 4 && q.x < WOODS.x1 + 4 && q.z > WOODS.z0 - 4 && q.z < WOODS.z1 + 4) near.push([q.x, q.z, 2.4]);
  near.push([-236, 262, 11], [-300, 296, 4], [-300, 290.5, 3.4]);                                      // the barn, the radio mast, a golden tin
  const free = (x, z, gap) => {
    if (Math.hypot(x - cx, z - cz) < CAMP.clear + 1 || offTrail(x, z) < 2.6) return false;
    for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) if (surfaceAt(x + dx, z + dz) === 'road') return false;
    for (const [tx, tz, r] of near) if (Math.abs(x - tx) < Math.max(r, gap) && Math.abs(z - tz) < Math.max(r, gap) && Math.hypot(x - tx, z - tz) < Math.max(r, gap)) return false;
    return true;
  };
  function pine(x, z, s) {
    const y = groundY(x, z) - .15, g = top(x, y, z, R() * 6.28), m = one(M.pine), h = s * rr(.9, 1.15);
    g.scale.set(s, h, s);
    mesh(geo.trunk, M.bark, V(0, 1.6, 0), V(.34, 3.4, .34), g);
    mesh(geo.cone, m, V(0, 4.3, 0), V(2.5, 3.6, 2.5), g); mesh(geo.cone, m, V(0, 6.3, 0), V(1.95, 3.2, 1.95), g); mesh(geo.cone, m, V(0, 8.2, 0), V(1.3, 3, 1.3), g);
    post(x, z, .36 * s, y + 8 * h); near.push([x, z, 0]);
  }
  for (let i = 0, tries = 0; i < 430 && tries < 9000; tries++) {
    const x = rr(WOODS.x0, WOODS.x1), z = rr(WOODS.z0, WOODS.z1); if (!free(x, z, 3.4)) continue;
    pine(x, z, rr(.85, 1.45)); i++;
  }
  // a ring of big ones round the clearing, so it reads as a room in the trees
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * PI * 2 + rr(-.08, .08), r = CAMP.clear + rr(2.2, 4.5), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (offTrail(x, z) < 3 || !free(x, z, 2.6)) continue; pine(x, z, rr(1.2, 1.6));
  }
  // the forest floor: ferns and bushes, stumps, fallen logs, boulders
  for (let i = 0, tries = 0; i < 120 && tries < 2000; tries++) {
    const x = rr(WOODS.x0, WOODS.x1), z = rr(WOODS.z0, WOODS.z1); if (Math.hypot(x - cx, z - cz) < CAMP.clear - 1 || offTrail(x, z) < 1.6 || surfaceAt(x, z) === 'road' || surfaceAt(x + 3, z) === 'road' || surfaceAt(x, z - 3) === 'road' || surfaceAt(x - 3, z) === 'road') continue;
    const s = rr(.5, 1.1); mesh(geo.blob, one(M.pine), V(x, groundY(x, z) + .28 * s, z), V(s * rr(.9, 1.5), s * .62, s * rr(.9, 1.5)), scene, false).rotation.y = R() * 6; i++;
  }
  for (let i = 0, tries = 0; i < 34 && tries < 900; tries++) {
    const x = rr(WOODS.x0 + 4, WOODS.x1 - 4), z = rr(WOODS.z0 + 6, WOODS.z1 - 4); if (!free(x, z, 2.6)) continue; i++;
    const y = groundY(x, z);
    if (i % 3 === 0) {             // a fallen trunk
      const len = rr(3, 5.5), ry = R() * PI, g = top(x, y + .32, z, ry), l = mesh(geo.cyl, M.log, null, V(.32, len, .32), g); l.rotation.z = PI / 2;
      for (const s of [-1, 1]) mesh(geo.cyl, M.cut, V(s * len / 2, 0, 0), V(.3, .02, .3), g, false).rotation.z = PI / 2;
      solids.walls.push({ x, z, hl: len / 2, ht: .32, rot: -ry, kind: 'low', h: y + .7 });
    } else if (i % 3 === 1) { mesh(geo.cyl, M.log, V(x, y + .25, z), V(.42, .6, .42), scene); mesh(geo.cyl, M.cut, V(x, y + .56, z), V(.4, .02, .4), scene, false); post(x, z, .45, y + .6); }
    else { const s = rr(.7, 1.5); mesh(geo.blob, M.stone, V(x, y + s * .2, z), V(s * rr(1, 1.4), s * rr(.6, .9), s * rr(1, 1.4)), scene).rotation.y = R() * 6; post(x, z, s * .85, y + s); }
    near.push([x, z, 2.5]);
  }

  // ---------- the camp ----------
  const gy = (x, z) => groundY(x, z);
  const fire = { x: cx, z: cz, y: gy(cx, cz) + .25 };
  // the fire: a ring of stones, crossed logs, a patch of ash
  mesh(geo.cyl, M.ash, V(cx, fire.y - .2, cz), V(1.25, .08, 1.25), scene, false);
  for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2; mesh(geo.blob, M.stone, V(cx + Math.cos(a) * 1.05, fire.y - .12, cz + Math.sin(a) * 1.05), V(.3, .22, .26), scene).rotation.y = a; }
  for (let i = 0; i < 4; i++) { const g = top(cx, fire.y - .02, cz, i * PI / 4 + .3), l = mesh(geo.cyl, M.bark, V(0, .08, 0), V(.09, 1.3, .09), g); l.rotation.z = PI / 2 - .25; }
  post(cx, cz, .9, fire.y + .3);
  // logs to sit on, three round the fire
  const seats = [];
  for (const a of [.5, 2.4, 4.3]) {
    const x = cx + Math.cos(a) * 2.9, z = cz + Math.sin(a) * 2.9, g = top(x, gy(x, z) + .3, z, -a + PI / 2), l = mesh(geo.cyl, M.log, null, V(.3, 2.2, .3), g); l.rotation.z = PI / 2;
    seats.push({ x: cx + Math.cos(a) * 2.25, z: cz + Math.sin(a) * 2.25, face: Math.atan2(-Math.cos(a), -Math.sin(a)), idle: 'sit' });
  }
  // tents: a ridge of tarp over two poles, a rug and a bedroll inside
  const tent = (x, z, ry, k, w = 3, len = 3.6, h = 1.9) => {
    const g = top(x, gy(x, z) - .05, z, ry);
    mesh(geo.tent, M.tarp[k], null, V(w, h, len), g);
    for (const s of [-1, 1]) mesh(G.box, M.bark, V(0, h / 2, s * (len / 2 - .05)), V(.07, h + .1, .07), g);
    mesh(G.box, one(M.rug), V(0, .06, .4), V(w * .7, .04, len * .8), g, false);
    solids.walls.push({ x, z, hl: len / 2, ht: w / 2 - .1, rot: -ry + PI / 2, kind: 'solid', h: gy(x, z) + h });
  };
  tent(cx - 8.6, cz + 5.2, .9, 0); tent(cx + 2.4, cz + 10.2, -.25, 1, 3.2, 4); tent(cx + 9.6, cz + 3.4, -1.15, 2);
  // a lean-to: a tarp tied between two posts and pegged to the ground
  {
    const x = cx - 6.5, z = cz - 8.2, y = gy(x, z), g = top(x, y, z, .5);
    for (const s of [-1, 1]) { mesh(G.box, M.bark, V(s * 2, 1.15, 0), V(.09, 2.3, .09), g); post(x + Math.cos(.5) * s * 2, z - Math.sin(.5) * s * 2, .12, y + 2.3); }
    const t = mesh(G.box, M.tarp[0], V(0, 1.2, -1.25), V(4.3, .04, 3.3), g); t.rotation.x = -.72;
    mesh(rbox(1.9, .22, .95, .1), M.bed, V(-.4, .14, -.9), null, g); mesh(rbox(1.7, .1, .8, .05), one(M.rug), V(-.4, .28, -.95), null, g, false);
    mesh(rbox(.7, .5, .5, .04), M.card, V(1.3, .25, -1), null, g).rotation.y = .3;
  }
  // an oil drum they burn things in, a wrecked sofa, a shopping cart, crates, tyres, a washing line
  const drum = { x: cx + 6.2, z: cz - 5.4 }; drum.y = gy(drum.x, drum.z) + 1.05;
  mesh(geo.drum, M.rust, V(drum.x, drum.y - .52, drum.z), V(.42, 1.05, .42), scene); mesh(geo.cyl, M.ash, V(drum.x, drum.y - .12, drum.z), V(.4, .04, .4), scene, false); post(drum.x, drum.z, .45, drum.y);
  {
    const x = cx - 3.2, z = cz - 5.6, g = top(x, gy(x, z), z, .25), c = one(M.rug);
    mesh(rbox(2.3, .42, .95, .12), c, V(0, .32, 0), null, g); mesh(rbox(2.3, .75, .28, .1), c, V(0, .72, -.36), null, g); for (const s of [-1, 1]) mesh(rbox(.28, .55, .95, .1), c, V(s * 1.12, .52, 0), null, g);
    solids.walls.push({ x, z, hl: 1.25, ht: .5, rot: -.25, kind: 'low', h: gy(x, z) + 1.1 });
  }
  {
    const x = cx + 4.4, z = cz + 5.6, g = top(x, gy(x, z), z, -.7);           // the cart: a wire basket on four castors, full of bags
    mesh(G.box, M.wire, V(0, .42, 0), V(.62, .04, 1), g); for (const s of [-1, 1]) { mesh(G.box, M.wire, V(s * .31, .7, 0), V(.03, .55, 1), g); mesh(G.box, M.wire, V(0, .7, s * .5), V(.62, .55, .03), g); }
    mesh(G.box, M.wire, V(0, 1.02, -.62), V(.66, .05, .05), g); for (const sx of [-1, 1]) { mesh(G.box, M.wire, V(sx * .3, .78, -.56), V(.04, .5, .04), g); for (const sz of [-1, 1]) mesh(geo.cyl, mats.tire, V(sx * .26, .09, sz * .4), V(.09, .05, .09), g).rotation.z = PI / 2; }
    mesh(geo.blob, M.bed, V(.02, .8, .1), V(.3, .3, .42), g); mesh(geo.blob, mats.tire, V(-.05, .92, -.2), V(.24, .2, .26), g);
    post(x, z, .55, gy(x, z) + 1.1);
  }
  for (const [dx, dz, s, ry, up] of [[7.6, -2.6, .8, .2, 0], [8.4, -3.5, .65, .9, 0], [7.7, -2.7, .6, 1.4, .8], [-9.6, -1.4, .75, .4, 0], [-10.3, -.5, .6, 1.1, 0]]) {
    const x = cx + dx, z = cz + dz, y = gy(x, z) + up;
    mesh(rbox(s, s, s, .03), M.crate, V(x, y + s / 2, z), null, scene).rotation.y = ry; if (!up) post(x, z, s * .6, y + s);
  }
  { const x = cx - 10.8, z = cz + 1.6, y = gy(x, z); for (let i = 0; i < 3; i++) mesh(new THREE.TorusGeometry(.4, .17, 6, 12), mats.tire, V(x, y + .18 + i * .34, z), null, scene).rotation.x = PI / 2; post(x, z, .6, y + 1); }
  {
    const x0 = cx - 1.5, z0 = cz - 11.4, x1 = cx + 4.2, z1 = cz - 10.6, y = (gy(x0, z0) + gy(x1, z1)) / 2, ry = -Math.atan2(z1 - z0, x1 - x0), len = Math.hypot(x1 - x0, z1 - z0);
    for (const [x, z] of [[x0, z0], [x1, z1]]) { mesh(G.box, M.bark, V(x, y + 1.05, z), V(.09, 2.1, .09), scene); post(x, z, .12, y + 2.1); }
    const g = top((x0 + x1) / 2, y + 2, (z0 + z1) / 2, ry); mesh(G.box, mats.darkMetal, null, V(len, .025, .025), g, false);
    [[-2, .7, 0], [-1.1, .5, 1], [-.2, .8, 2], [.9, .55, 3], [1.9, .7, 1]].forEach(([a, h, k]) => mesh(G.box, M.rug[k], V(a, -h / 2 - .02, 0), V(.6, h, .03), g));
  }
  // empties by the fire
  for (let i = 0; i < 9; i++) { const a = R() * 6.28, r = rr(1.6, 4.6), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, b = mesh(geo.cyl, M.bottle, V(x, gy(x, z) + .06, z), V(.05, .26, .05), scene, false); b.rotation.set(PI / 2, 0, R() * 6); }

  // ---------- a hand-painted warning where the trail leaves the road, and another at the clearing ----------
  const board = (text, x, z, ry, w = 2.6) => {
    const y = gy(x, z), t = ctex(512, (c, s) => {
      c.clearRect(0, 0, s, s); c.fillStyle = '#b98a55'; c.fillRect(10, s * .28, s - 20, s * .44); c.strokeStyle = 'rgba(70,45,20,.5)'; c.lineWidth = 3;
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(10, s * .28 + i * s * .11); c.lineTo(s - 10, s * .28 + i * s * .11 + (i % 2 ? 4 : -3)); c.stroke(); }
      c.font = '900 92px "Archivo Black",Impact,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; const tw = c.measureText(text).width; if (tw > s - 70) c.font = `900 ${Math.floor(92 * (s - 70) / tw)}px "Archivo Black",Impact,sans-serif`;
      c.save(); c.translate(s / 2, s / 2 + 4); c.rotate(-.035); c.fillStyle = '#b3261e'; c.fillText(text, 0, 0); c.restore();
    });
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: .1, side: THREE.DoubleSide }); signMats.push(mat);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), mat); m.position.set(x, y + 1.75, z); m.rotation.set(0, ry, .04); realScene.add(m);
    for (const s of [-1, 1]) { const px = x + Math.cos(ry) * s * w * .36, pz = z - Math.sin(ry) * s * w * .36; mesh(G.box, M.bark, V(px, y + 1, pz), V(.1, 2.1, .1), scene); post(px, pz, .1, y + 2); }
  };
  board('KEEP OUT', TRAIL.x + 3.4, TRAIL.z + 4.5, PI, 2.8);
  { const k = .72, x = TRAIL.x + (cx - TRAIL.x) * k + 3, z = TRAIL.z + (cz - TRAIL.z) * k; board('GO AWAY', x, z, PI + .2, 2.3); }

  // where people stand: three on the logs, two at the drum, one by the first tent, one keeping watch down the trail
  const spots = [...seats];
  spots.push({ x: drum.x - 1.1, z: drum.z + .5, face: Math.atan2(1.1, -.5) }, { x: drum.x + .6, z: drum.z + 1.1, face: Math.atan2(-.6, -1.1) });
  spots.push({ x: cx - 6.6, z: cz + 3.6, face: 2.2 }, { x: cx + 1, z: cz - 9, face: PI }, { x: cx + 8, z: cz + 6.5, face: -2 }, { x: cx - 4.8, z: cz - 3.8, face: .6 });
  out.spots.camp = { x: cx, z: cz, y: fire.y, fire, drum, spots, stash: { x: cx + 1.4, z: cz + 6.6 }, trail: TRAIL };
}
