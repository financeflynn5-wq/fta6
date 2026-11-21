// The Sunset Coast city: roads, blocks, buildings, palms, lamps and traffic lights.
// Visuals are ported unchanged from the approved concept. On top of the meshes this
// file reports what is solid (for physics) and answers "how high is the ground here".
import * as THREE from 'three';
import { rand, pick, V, randSeed } from '../core/utils.js';
import { WORLD } from '../config.js';
import { mats, std, facade, awnings, G, mesh, rbox, ctex } from './materials.js';
import { bakeStatic } from './batching.js';
import { CITY_EDGE, inDowntown } from './map.js';
import { nearRibbon } from './terrain.js';
import { planHighway, buildHighway } from './highway.js';
import { towerAt, buildSkyline } from './skyline.js';
import { buildInteriors } from './interiors.js';
import { buildGround } from './ground.js';
import { buildDistricts, shapeLand } from './districts.js';

const { BLOCK, PITCH, blocksIdx, roadsAt } = WORLD;

// Height of the ground anywhere on the map (hills, beach, kerbs, ramps): see terrain.js.
export { groundY } from './terrain.js';

// Traffic light cycle shared by the lamps and by AI drivers.
const CYCLE = 18;
export function lightState(axis, t) {
  const p = t % CYCLE;
  const ew = p < 6.5 ? 'g' : p < 8 ? 'y' : 'r';
  const ns = p < 9 ? 'r' : p < 15.5 ? 'g' : p < 17 ? 'y' : 'r';
  return axis === 'x' ? ew : ns;
}

export function buildCity(realScene) {
  // Everything static is built into this holding group, then welded into a few meshes at the end.
  const scene = new THREE.Group();
  const solids = { boxes: [], posts: [], walls: [] };   // boxes: buildings {x,z,hw,hd,h}; posts: thin round things {x,z,r}; walls: straight rails at any angle
  const lampPts = [], signs = [], lots = [];        // lots: every building put up by building(), for interiors.js
  // The hills and the elevated roads are laid out first (as plain numbers), so everything built after knows where they are.
  shapeLand();
  const highway = planHighway();

  // downtown's flat street level; the land around it is drawn by ground.js
  const size = CITY_EDGE * 2, ground = mesh(new THREE.PlaneGeometry(size, size), mats.asphalt, null, null, realScene, false);
  ground.rotation.x = -Math.PI / 2;
  const guv = ground.geometry.attributes.uv; for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * size / 420, guv.getY(i) * size / 420);   // same texture scale as before

  // instanced collectors
  function Inst(geo, mat, cast = true) {
    return {
      geo, mat, list: [], cast, add(m, c) { this.list.push([m.clone(), c]); },
      build() {
        const im = new THREE.InstancedMesh(this.geo, this.mat, this.list.length);
        this.list.forEach(([m, c], i) => { im.setMatrixAt(i, m); if (c) im.setColorAt(i, new THREE.Color(c)); });
        im.castShadow = this.cast; im.receiveShadow = true; realScene.add(im); return im;
      }
    };
  }
  const IB = {
    win: Inst(G.box, mats.glass, false), lit: Inst(G.box, mats.litWin, false), frame: Inst(G.box, mats.trim, false),
    mark: Inst(G.box, mats.paint, false), pole: Inst(G.cyl, mats.darkMetal), arm: Inst(G.box, mats.darkMetal),
    lamp: Inst(rbox(1, 1, 1, .3), mats.lampHead, false)
  };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  const mat4 = (p, s, ry = 0, rx = 0, rz = 0) => _m.compose(p, _q.setFromEuler(_e.set(rx, ry, rz)), s);

  // road markings
  for (const r of roadsAt) for (const axis of [0, 1]) {
    for (let t = -200; t < 200; t += 6) {
      if (roadsAt.some(q => Math.abs(t - q) < 10) || Math.abs(t) > 150) continue;
      const along = V(axis ? r : t + 1.5, .02, axis ? t + 1.5 : r);
      for (const o of [-.18, .18]) { const p = along.clone(); if (axis) p.x += o; else p.z += o; IB.mark.add(mat4(p, axis ? V(.14, .02, 6) : V(6, .02, .14)), 0xf2c230); }
      if ((t / 6) % 2 === 0) for (const o of [-4.6, 4.6]) { const p = along.clone(); if (axis) p.x += o; else p.z += o; IB.mark.add(mat4(p, axis ? V(.14, .02, 3) : V(3, .02, .14)), 0xf4f4f0); }
    }
  }
  for (const ix of roadsAt) for (const iz of roadsAt) {
    if (Math.abs(ix) > 60 || Math.abs(iz) > 60) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let k = -6; k <= 6; k += 1.2) { const p = V(ix + dx * 9.2 + (dz ? k : 0), .02, iz + dz * 9.2 + (dx ? k : 0)); IB.mark.add(mat4(p, dx ? V(2.4, .02, .6) : V(.6, .02, 2.4)), 0xf4f4f0); }
      const s = V(ix + dx * 7.6 + (dz ? (dz > 0 ? -3.5 : 3.5) : 0), .02, iz + dz * 7.6 + (dx ? (dx > 0 ? 3.5 : -3.5) : 0));
      IB.mark.add(mat4(s, dx ? V(.4, .02, 7) : V(7, .02, .4)), 0xf4f4f0);
    }
  }

  // shop signs
  const signNames = ["PAWSUM'S PAWN", "NOODLE HUT", "BAIT & TACKLE", "24/7 MART", "DONUT HOLE", "TACO CRAB", "ARCADE", "MOTEL", "CHECKS CASHED", "PIZZA PIER", "LAUNDRO-MAT", "CRAB SHACK"];
  const signCols = ['#ff4d6d', '#3de0ff', '#ffd34d', '#7dff8a', '#ff8a3d', '#c77dff'];
  const signMats = signNames.map((n, i) => {
    const col = signCols[i % signCols.length];
    const t = ctex(512, (x, s) => {
      x.clearRect(0, 0, s, s); x.fillStyle = 'rgba(15,16,22,.92)';
      x.beginPath(); x.roundRect(8, s * .3, s - 16, s * .4, 30); x.fill();
      x.font = `900 ${n.length > 10 ? 52 : 72}px "Archivo Black",Impact,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = col; x.shadowBlur = 24; x.fillStyle = col; x.fillText(n, s / 2, s / 2);
      x.shadowBlur = 0; x.fillStyle = '#fff'; x.globalAlpha = .55; x.fillText(n, s / 2, s / 2);
    });
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, color: new THREE.Color(1, 1, 1) });
  });

  // ---------- buildings ----------
  function building(cx, cz, w, d, h, downtown, y = .3, clutter = true) {
    const fm = pick(facade), g = new THREE.Group(); g.position.set(cx, y, cz); scene.add(g);
    const box = { x: cx, z: cz, hw: w / 2, hd: d / 2, h: y + h }; solids.boxes.push(box);
    const shopH = 4.6;
    // what interiors.js needs to open a building up later: its ground floor block, and each side's shop window and sign
    // (storeys.js opens the floors above as well: for that it needs the wall above the shop, the belt and bands round it, and each window)
    const lot = { x: cx, z: cz, w, d, h, y, g, box, fronts: {}, signs: {}, fm, wins: [], bands: [] }; lots.push(lot);
    lot.base = mesh(G.box, mats.trim, V(0, shopH / 2, 0), V(w, shopH, d), g);
    lot.upper = mesh(G.box, fm, V(0, shopH + (h - shopH) / 2, 0), V(w - .3, h - shopH, d - .3), g);
    lot.belt = mesh(G.box, mats.trim, V(0, shopH + .15, 0), V(w + .3, .35, d + .3), g);
    mesh(G.box, mats.trim, V(0, h + .35, 0), V(w + .5, .7, d + .5), g);
    const floors = lot.floors = Math.floor((h - shopH - 1.5) / 3.4);
    for (let f = 1; f <= floors; f += 2) lot.bands.push(mesh(G.box, mats.trim, V(0, shopH + f * 3.4 + 1.5, 0), V(w - .1, .18, d - .1), g, false));
    const faces = [[0, 1, w], [0, -1, w], [1, 0, d], [-1, 0, d]];
    for (const [fx, fz, len] of faces) {
      const ry = Math.atan2(fx, fz), cols = Math.max(2, Math.floor(len / 3.2)), step = len / cols;
      for (let c = 0; c < cols; c++) for (let f = 0; f < floors; f++) {
        const u = -len / 2 + step * (c + .5), y = shopH + 1.9 + f * 3.4;
        const base = V(fx ? fx * ((w - .3) / 2) : u, y, fz ? fz * ((d - .3) / 2) : u); if (fx) base.z = u; base.add(g.position);
        const nrm = V(fx, 0, fz);
        IB.frame.add(mat4(base.clone().addScaledVector(nrm, .04), fx ? V(.12, 2.2, 1.6) : V(1.6, 2.2, .12)));
        const lit = rand() < .33; (lit ? IB.lit : IB.win).add(mat4(base.clone().addScaledVector(nrm, .1), fx ? V(.08, 1.95, 1.35) : V(1.35, 1.95, .08)));
        lot.wins.push({ fx, fz, f, u, frame: IB.frame.list.length - 1, pane: (lit ? IB.lit : IB.win).list.length - 1, lit });
        IB.frame.add(mat4(base.clone().addScaledVector(nrm, .22).add(V(0, -1.07, 0)), fx ? V(.35, .12, 1.8) : V(1.8, .12, .35)));
      }
      // storefront
      const sp = V(fx * (w / 2 + .02), 2.1, fz * (d / 2 + .02));
      lot.fronts[fx + ',' + fz] = mesh(G.box, mats.shop, sp, fx ? V(.12, 2.6, len * .82) : V(len * .82, 2.6, .12), g, false);
      const aw = mesh(G.box, pick(awnings), V(fx * (w / 2 + .9), 3.95, fz * (d / 2 + .9)), fx ? V(1.9, .12, len * .86) : V(len * .86, .12, 1.9), g);
      aw.rotation.set(fx ? 0 : -fz * .32, 0, fx ? fx * .32 : 0);
      if (downtown && rand() < .55) {
        const sm = pick(signMats); const pl = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), sm);
        pl.position.set(fx * (w / 2 + .06), 5.6 + rand() * .8, fz * (d / 2 + .06) + (fx ? (rand() - .5) * len * .4 : 0)); if (fz) pl.position.x = (rand() - .5) * len * .4;
        pl.rotation.y = ry; g.add(pl); signs.push(pl); lot.signs[fx + ',' + fz] = pl;
      }
    }
    // roof clutter
    for (let i = 0, n = clutter ? 2 + Math.floor(rand() * 3) : 1; i < n; i++) mesh(rbox(1.6, 1, 1.2, .1), mats.ac, V((rand() - .5) * (w - 3), h + 1.2, (rand() - .5) * (d - 3)), null, g);
    if (clutter && rand() < .45) {
      const t = new THREE.Group(); t.position.set((rand() - .5) * (w - 5), h + .7, (rand() - .5) * (d - 5)); g.add(t);
      for (const [x, z] of [[-.9, -.9], [.9, -.9], [-.9, .9], [.9, .9]]) mesh(G.cyl, mats.darkMetal, V(x, 1, z), V(.08, 2, .08), t);
      mesh(G.cyl, mats.water, V(0, 3.1, 0), V(1.5, 2.4, 1.5), t); mesh(new THREE.ConeGeometry(1.6, 1, 20), mats.water, V(0, 4.8, 0), null, t);
    }
  }

  const leafGeo = (() => {
    const L = 4.2, N = 10, pos = [], idx = [];
    for (let i = 0; i <= N; i++) { const t = i / N, w = .75 * Math.sin(Math.PI * Math.pow(t, .7)) * (1 - t * .35), y = -1.9 * t * t + .3 * t; pos.push(t * L, y, -w, t * L, y + .12, 0, t * L, y, w); }
    for (let i = 0; i < N; i++) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  })();
  function palm(x, z, s = 1, y = .3) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rand() * 6.28; g.scale.setScalar(s); scene.add(g);
    solids.posts.push({ x, z, r: .3 });
    const lean = .6 + rand() * .9, curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(lean * .2, 3, 0), V(lean * .6, 6, 0), V(lean, 8.6, 0)]);
    mesh(new THREE.TubeGeometry(curve, 14, .24, 8), mats.trunk, null, null, g);
    for (let k = 0; k < 9; k++) { const lf = mesh(leafGeo, mats.leaf, V(lean, 8.6, 0), null, g); lf.rotation.y = k / 9 * 6.283 + rand() * .3; lf.rotation.z = (rand() - .5) * .25; }
    mesh(G.sph, mats.trunk, V(lean, 8.5, 0), V(.45, .45, .45), g);
  }

  // Build something, then take it away again. The city's dice roll exactly as if it had been built, so removing
  // one building (to make room for a highway, or to put a tower in its place) leaves every other one as it was.
  function ghost(fn) {
    const marks = [scene.children.length, solids.boxes.length, solids.posts.length, signs.length, lampPts.length, lots.length], counts = {};
    for (const k in IB) counts[k] = IB[k].list.length;
    fn();
    scene.children.splice(marks[0]).forEach(o => { o.parent = null; });
    solids.boxes.length = marks[1]; solids.posts.length = marks[2]; signs.length = marks[3]; lampPts.length = marks[4]; lots.length = marks[5];
    for (const k in IB) IB[k].list.length = counts[k];
  }
  // Would a w x d footprint here stand under (or right beside) an elevated road?
  const underHighway = (x, z, w, d) => [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]].some(([a, b]) => nearRibbon(x + a * w / 2, z + b * d / 2, 2.5));

  // blocks
  const towers = [];
  for (const bi of blocksIdx) for (const bj of blocksIdx) {
    const cx = 27 + PITCH * bi, cz = 27 + PITCH * bj; const near = Math.abs(cx) < 60 && Math.abs(cz) < 60;
    mesh(G.box, mats.walk, V(cx, .15, cz), V(BLOCK, .3, BLOCK), scene, false);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (rand() < .12 && !near) {
        mesh(G.box, mats.grass, V(cx + sx * 9, .32, cz + sz * 9), V(15, .05, 15), scene, false);
        const plant = () => palm(cx + sx * 9, cz + sz * 9, 1.1);
        if (underHighway(cx + sx * 9, cz + sz * 9, 4, 4)) ghost(plant); else plant();
        continue;
      }
      const w = 12 + rand() * 3.5, d = 12 + rand() * 3.5, dist = Math.hypot(cx, cz);
      const h = (near ? 12 : 9) + rand() * (dist < 90 ? 18 : 11) + (dist < 45 ? 5 : 0);
      const bx = cx + sx * (16 - w / 2), bz = cz + sz * (16 - d / 2), signed = near || rand() < .3, make = () => building(bx, bz, w, d, h, signed);
      const tower = towerAt(bi, bj, sx, sz);
      if (underHighway(bx, bz, w + 2, d + 2)) ghost(make);
      else if (tower) {             // a high-rise takes this lot (skyline.js): same corner of the block, a little broader
        ghost(make);
        const tw = tower.style === 'sunset' ? 16 : Math.max(w, 13.5), td = tower.style === 'sunset' ? 16 : Math.max(d, 13.5);
        towers.push({ x: cx + sx * (16 - tw / 2), z: cz + sz * (16 - td / 2), w: tw, d: td, ...tower });
      } else make();
    }
    for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const u of [-12, 0, 12]) {
      const px = cx + fx * 18.6 + (fz ? u : 0), pz = cz + fz * 18.6 + (fx ? u : 0);
      IB.pole.add(mat4(V(px, 3.3, pz), V(.11, 6, .11)));
      IB.arm.add(mat4(V(px + fx * .9, 6.25, pz + fz * .9), fx ? V(1.9, .12, .12) : V(.12, .12, 1.9)));
      IB.lamp.add(mat4(V(px + fx * 1.8, 6.1, pz + fz * 1.8), V(.7, .22, .42), fx ? 0 : Math.PI / 2));
      lampPts.push(V(px + fx * 1.8, 5.8, pz + fz * 1.8));
      solids.posts.push({ x: px, z: pz, r: .16 });
    }
  }
  // palms along the two main avenues
  for (let t = -140; t <= 140; t += 9) {
    if (roadsAt.some(q => Math.abs(t - q) < 12)) continue;
    for (const s of [-1, 1]) { palm(t + 2, s * 8.6, .95 + rand() * .25); if (Math.abs(t) < 150) palm(s * 8.6, t - 2, .9 + rand() * .2); }
  }

  // traffic lights at the central intersections
  const sigMat = () => ({ r: std({ color: 0x330000, emissive: 0xff2a2a }), y: std({ color: 0x332600, emissive: 0xffc21a }), g: std({ color: 0x00220b, emissive: 0x2bff6a }) });
  const sig = { ew: sigMat(), ns: sigMat() };
  for (const ix of [-54, 0, 54]) for (const iz of [-54, 0, 54]) for (const [dx, dz] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const g = new THREE.Group(); g.position.set(ix + dx * 8.2, .3, iz + dz * 8.2); scene.add(g);
    solids.posts.push({ x: g.position.x, z: g.position.z, r: .2 });
    const ew = (dx === dz);
    mesh(G.cyl, mats.darkMetal, V(0, 3.2, 0), V(.16, 6.4, .16), g);
    const armLen = 5.5, dirx = ew ? 0 : -dx, dirz = ew ? -dz : 0;
    mesh(G.box, mats.darkMetal, V(dirx * armLen / 2, 6.2, dirz * armLen / 2), V(dirx ? armLen : .16, .16, dirz ? armLen : .16), g);
    const hb = new THREE.Group(); hb.position.set(dirx * armLen, 5.4, dirz * armLen); g.add(hb);
    mesh(rbox(.5, 1.5, .45, .08), mats.yellowPaint, V(0, 0, 0), null, hb);
    const set = ew ? sig.ew : sig.ns, face = ew ? V(dx * .26, 0, 0) : V(0, 0, dz * .26);
    [['r', .45], ['y', 0], ['g', -.45]].forEach(([k, y]) => mesh(G.sph, set[k], face.clone().add(V(0, y, 0)), V(.15, .15, .15), hb, false));
  }

  // The towers roll their own dice, so the rest of the map comes out exactly as it did before there were any.
  const dice = randSeed(), skyline = buildSkyline(towers, { scene, solids, building });
  // ...and so do the shops and lobbies you can walk into, which open up buildings that are already standing
  const interiors = buildInteriors({ scene, realScene, solids, lots, signMats, signNames, skyline, building, IB }); randSeed(dice);

  // Everything beyond downtown: the land itself, the elevated roads, then what stands on the land.
  buildGround(realScene);
  buildHighway(highway, { scene, realScene, solids, lampPts, signMats, IB, mat4 });
  const districts = buildDistricts({ scene, realScene, solids, lampPts, signMats, building, palm, IB, mat4, shopSpots: interiors.spots });

  // downtown welds in 108 m squares (2 x 2 blocks); the districts around it are sparser, so they weld in 162 m squares.
  // Bigger squares = fewer draws for the same picture, which pays for the larger map.
  const welded = bakeStatic(scene, realScene, (x, z) => inDowntown(x, z) ? Math.floor((x + 162) / 108) + ',' + Math.floor((z + 162) / 108) : 'o' + Math.floor((x + 405) / 162) + ',' + Math.floor((z + 405) / 162));
  welded.push(...highway.meshes);

  const IBm = {}; for (const k in IB) IBm[k] = IB[k].build();
  interiors.windows = { frame: IBm.frame, win: IBm.win, lit: IBm.lit };      // the painted-on windows of floors you can go up to are swapped for real ones while you are near
  IBm.mark.material = std({ color: 0xffffff, roughness: .6 });

  let glowOn = -1;
  function updateLights(t) {
    for (const [k, ax] of [['ew', 'x'], ['ns', 'z']]) { const st = lightState(ax, t); for (const c of ['r', 'y', 'g']) sig[k][c].emissiveIntensity = st === c ? 3.2 : .04; }
    // tower windows and rooftop neon come on with the street lamps
    const on = mats.lampHead.emissiveIntensity / 5;
    if (on !== glowOn) { glowOn = on; for (const s of skyline.glow) s.m.emissiveIntensity = s.k * on; }
  }

  return { solids, lampPts, signMats, litWindows: IBm.lit, updateLights, districts, welded, highway, skyline, interiors, lots };
}
