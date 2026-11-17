// Golden Acres: the farmland in the north-west. Wide and mostly empty on purpose, with things to find:
// the farm itself (a red barn you can drive straight through, silos, a wind pump, a greenhouse made of glass,
// cows behind a fence), corn tall enough to hide a car, an orchard, a pumpkin patch, a farm stand on County
// Road, a lone oak on a hill, an old barn, hay bales everywhere, and a dirt airstrip for whatever flies later.
// Fences, bales, crates and the greenhouse all break (world/places.js); crops just brush past.
import * as THREE from 'three';
import { V } from '../core/utils.js';
import { mats, std, G, mesh, rbox, awnings } from './materials.js';
import { groundY } from './terrain.js';
import { roofGeo } from './props.js';

const PI = Math.PI;

export function buildFarm(K) {
  const { api, scene, realScene, solids, out, P, M, G2, R, rr, one, box, solid, post, scatter, keepOut, N } = K;
  const corn = std({ color: 0x5f9e45, roughness: 1 }), tassel = std({ color: 0xd8c25c, roughness: 1 }), wheat = std({ map: N.stripes('#e6c25c', 'rgba(150,105,30,.5)', 12, 5), color: 0xffffff, roughness: 1 });
  const sun = std({ color: 0xf5c326, roughness: .9 }), pumpkin = std({ color: 0xf08a24, roughness: .8 }), barnRed = std({ color: 0xb8402f, roughness: .85 }), old = std({ color: 0x8b6a4a, roughness: 1 }), tin = mats.ac, cowHide = M.white, pig = N.pink;
  const wall = (x, z, hl, ht, rot, h) => solids.walls.push({ x, z, hl, ht, rot, kind: 'solid', h });

  // Rows of a crop between two corners: slabs `w` wide and about `h` tall, `gap` apart, running along z (or x).
  function rows(x0, z0, x1, z1, gap, w, h, mat, top = null, topH = .25, along = 'z') {
    const a0 = along === 'z' ? x0 : z0, a1 = along === 'z' ? x1 : z1, b0 = along === 'z' ? z0 : x0, b1 = along === 'z' ? z1 : x1, n = Math.max(1, Math.round((b1 - b0) / 6)), len = (b1 - b0) / n;
    for (let a = a0 + gap / 2; a < a1; a += gap) for (let k = 0; k < n; k++) {
      const b = b0 + len * (k + .5), x = along === 'z' ? a : b, z = along === 'z' ? b : a, y = Math.min(groundY(x, z), groundY(along === 'z' ? x : x - len / 2, along === 'z' ? z - len / 2 : z), groundY(along === 'z' ? x : x + len / 2, along === 'z' ? z + len / 2 : z)) - .15, hh = h * rr(.86, 1.1) + .3;
      box(mat, x, y + hh / 2, z, along === 'z' ? w : len, hh, along === 'z' ? len : w, false);
      if (top) box(top, x, y + hh + topH / 2, z, along === 'z' ? w * 1.15 : len, topH, along === 'z' ? len : w * 1.15, false);
    }
  }
  const bale = (x, z) => K.breakable('bale', x, groundY(x, z), z, R() * PI, 1, 1);
  const crate = (x, z) => K.breakable('crate', x, groundY(x, z), z, R() * .8, 1, 1);
  function cow(x, z, ry, patch = mats.darkMetal) {
    const g = P.top(x, groundY(x, z), z, ry);
    mesh(rbox(1.9, 1, .85, .2), cowHide, V(0, 1.1, 0), null, g); mesh(rbox(.56, .52, .5, .12), cowHide, V(1.15, 1.35, 0), null, g); mesh(G.box, pig, V(1.45, 1.24, 0), V(.16, .26, .4), g, false);
    mesh(G.box, patch, V(.3, 1.25, 0), V(.6, .56, .88), g, false); mesh(G.box, patch, V(-.55, 1.05, 0), V(.5, .7, .88), g, false); mesh(G.box, patch, V(1.2, 1.5, 0), V(.3, .24, .53), g, false);
    for (const [a, b] of [[.65, .26], [.65, -.26], [-.65, .26], [-.65, -.26]]) mesh(G.box, cowHide, V(a, .32, b), V(.18, .64, .18), g, false);
    mesh(G.box, cowHide, V(-.98, 1.1, 0), V(.06, .7, .06), g, false); post(x, z, .95);
  }

  // =====================================================================================
  // THE FARM (west of the middle road)
  // =====================================================================================
  K.gate('GOLDEN ACRES', -243, 711.5, 'x', 12, '#7a4a2f', '#ffe9a8');
  const track = [[-243, 707], [-243, 806]]; K.path(N.dirt, track, 5, .06); K.keepLine(track, 4);
  K.path(N.dirt, [[-243, 750], [-256, 750]], 4.6, .05); K.path(N.dirt, [[-280, 750], [-289, 750]], 4.6, .05);

  // the barn: doors open at both ends, hay and crates inside
  {
    const x = -268, z = 750, hw = 11.5, hd = 7.5, y = Math.max(groundY(x - hw, z), groundY(x + hw, z), groundY(x, z - hd), groundY(x, z + hd)) + .05, H = 6.2;
    K.drape(N.dirt, x - hw - 1, z - hd + .3, x + hw + 1, z + hd - .3, .09, 4, 3);
    for (const s of [-1, 1]) {
      box(barnRed, x, y + H / 2 - .5, z + s * hd, hw * 2, H + 1, .4); wall(x, z + s * hd, hw, .2, 0, y + H);                                        // the long sides
      for (const e of [-1, 1]) { box(barnRed, x + e * hw, y + H / 2 - .5, z + s * (hd - 2.45), .4, H + 1, 4.9); wall(x + e * hw, z + s * (hd - 2.45), 2.45, .2, PI / 2, y + H); }      // either side of the doors
      box(barnRed, x + s * hw, y + 5.4, z, .4, 1.9, 5.3); box(M.white, x + s * hw, y + 4.42, z, .5, .2, 5.5, false);                                    // over the doors
      for (const e of [-1, 1]) { const d = box(barnRed, x + s * (hw + .25), y + 2.2, z + e * 4.85, .16, 4.4, 2.5, false); box(M.white, x + s * (hw + .34), y + 2.2, z + e * 4.85, .06, .16, 3.4, false).rotation.x = .9; box(M.white, x + s * (hw + .34), y + 2.2, z + e * 4.85, .06, .16, 3.4, false).rotation.x = -.9; }
      mesh(roofGeo(hd * 2 + .1, 4.4, .4), barnRed, V(x + s * hw, y + H, z), null, scene).rotation.y = PI / 2; box(M.white, x + s * (hw + .22), y + H + 1.5, z, .08, 1.3, 1.3, false);
      for (const e of [-1, 1]) box(M.white, x + s * hw, y + H / 2 - .5, z + e * hd, .56, H + 1, .56);
    }
    mesh(roofGeo(hd * 2 + 1.6, 4.9, hw * 2 + 1.6), tin, V(x, y + H, z), null, scene).rotation.y = PI / 2;
    for (const [a, b] of [[-8, -5.4], [-6.4, -5.6], [-7.2, -4], [7, 5.4], [8.4, 5.2], [4, -5.6]]) bale(x + a, z + b); for (const [a, b] of [[-3, 5.8], [-1.8, 5.9], [0, -6]]) crate(x + a, z + b);
    (out.zones.roofs ||= []).push({ x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, y: y + H + .4 });
    api.lampPts.push(V(x, y + 5, z)); keepOut(x, z, 15); out.spots.barn = { x, z };
  }
  // silos
  for (const [x, z, h] of [[-281, 771, 14], [-287.5, 775, 11]]) {
    const y = groundY(x, z) - .3; mesh(G.cyl, tin, V(x, y + h / 2, z), V(3, h, 3), scene); mesh(G.sph, tin, V(x, y + h, z), V(3, 1.7, 3), scene); for (let k = 2; k < h; k += 3) mesh(G.cyl, mats.metal, V(x, y + k, z), V(3.05, .14, 3.05), scene, false);
    post(x, z, 3.05); keepOut(x, z, 5);
  }
  // the farmhouse, a tree with a swing, a truck in the yard
  { const h = K.home(-221, 729, -1, 0, 1, 19.5); keepOut(-221, 729, 11); const [tx, tz] = h.W(-7.5, 8); P.tree(tx, tz, 1.8); const y = groundY(tx + 1.6, tz + 1.5); box(mats.darkMetal, tx + 1.6, y + 2.6, tz + 1.5, .03, 2.6, .03, false); const t = mesh(G2.torus, mats.tire, V(tx + 1.6, y + 1.05, tz + 1.5), null, scene); t.rotation.y = .6; }
  out.parked.push(['truck', -249.5, 728, PI / 2], ['van', -236.5, 772, PI / 2]);
  // a tractor
  {
    const x = -251.5, z = 763, g = P.top(x, groundY(x, z), z, .5);
    mesh(rbox(2.6, .9, 1.1, .12), M.red, V(.4, 1.25, 0), null, g); mesh(rbox(1.2, 1.3, 1.3, .1), M.red, V(-.9, 2.1, 0), null, g); mesh(G.box, mats.carGlass, V(-.9, 2.25, 0), V(1.24, .8, 1.34), g, false); mesh(G.box, mats.darkMetal, V(-.9, 2.8, 0), V(1.5, .1, 1.5), g, false);
    mesh(G.cyl, mats.darkMetal, V(1.1, 2.2, .3), V(.06, 1.1, .06), g, false);
    for (const s of [-1, 1]) { const r = mesh(G.cyl, mats.tire, V(-.9, .85, s * .85), V(.85, .5, .85), g); r.rotation.x = PI / 2; const f = mesh(G.cyl, mats.tire, V(1.3, .5, s * .7), V(.5, .32, .5), g); f.rotation.x = PI / 2; mesh(G.cyl, mats.yellowPaint, V(-.9, .85, s * 1.11), V(.4, .04, .4), g, false).rotation.x = PI / 2; }
    solid(x, z, 1.8, 1.3, true);
  }
  // the wind pump: turns all day
  {
    const x = -180, z = 742, y = groundY(x, z), TH = 10;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = box(mats.metal, x + a * .85, y + TH / 2, z + b * .85, .14, TH + .2, .14); l.rotation.z = -a * .12; l.rotation.x = b * .12; }
    for (const k of [2.5, 5, 7.5]) { const w = 2.3 - k * .2; box(mats.metal, x, y + k, z - w / 2, w, .08, .08, false); box(mats.metal, x, y + k, z + w / 2, w, .08, .08, false); box(mats.metal, x - w / 2, y + k, z, .08, .08, w, false); box(mats.metal, x + w / 2, y + k, z, .08, .08, w, false); }
    box(mats.metal, x, y + TH + .1, z, .6, .2, .6, false); const vane = box(M.red, x, y + TH + .5, z + 1.9, .06, .9, 1.5, false); box(mats.metal, x, y + TH + .5, z + .7, .06, .06, 1.6, false);
    const rotor = new THREE.Group(); rotor.position.set(x, y + TH + .5, z - .55); realScene.add(rotor);
    const blades = []; for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, g = new THREE.BoxGeometry(.5, 1.5, .03); g.rotateY(.35); g.translate(0, 1.25, 0); g.rotateZ(a); blades.push(g); }
    const hub = new THREE.CylinderGeometry(.22, .22, .2, 10); hub.rotateX(PI / 2); const ring = new THREE.TorusGeometry(2, .04, 4, 24);
    for (const [geo, mat] of [[blades, tin], [[hub, ring], mats.metal]]) { const m = new THREE.Mesh(geo.length ? mergeAll(geo) : geo, mat); m.castShadow = true; rotor.add(m); }
    out.animated.push((dt) => { rotor.rotation.z += dt * 1.5; });
    mesh(G.cyl, tin, V(x + 3, y + .55, z + 1), V(1.5, 1.1, 1.5), scene); mesh(G.cyl, N.pool, V(x + 3, y + 1.08, z + 1), V(1.38, .06, 1.38), scene, false); post(x + 3, z + 1, 1.5); post(x, z, 1.1); keepOut(x + 1, z, 5); out.spots.windpump = { x, z };
  }
  // the greenhouse: every pane breaks
  {
    const x = -200, z = 724, y = Math.max(groundY(x - 8, z), groundY(x + 8, z)) + .04, hw = 7.5, hd = 3.5, glass = std({ color: 0xbfe6f0, roughness: .05, metalness: .3, transparent: true, opacity: .26, depthWrite: false });
    K.drape(N.gravel, x - hw, z - hd, x + hw, z + hd, .07, 4, 2.5);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) K.breakable('glass', x - hw + 1.5 + i * 3, y, z + s * hd, 0, 2.94, 2.4, { through: true });
    for (const e of [-1, 1]) for (const s of [-1, 1]) K.breakable('glass', x + e * hw, y, z + s * 1.75, PI / 2, 3.44, 2.4, { through: true });
    for (let i = 0; i <= 5; i++) for (const s of [-1, 1]) box(M.white, x - hw + i * 3, y + 1.2, z + s * hd, .08, 2.4, .08, false);
    for (const s of [-1, 1]) { box(M.white, x, y + 2.42, z + s * hd, hw * 2, .1, .1, false); box(M.white, x + s * hw, y + 2.42, z, .1, .1, hd * 2, false); }
    mesh(roofGeo(hd * 2, 1.6, hw * 2), glass, V(x, y + 2.45, z), null, scene, false).rotation.y = PI / 2; box(M.white, x, y + 4.05, z, hw * 2, .1, .1, false);
    for (let i = 0; i < 4; i++) for (const s of [-1.6, 1.6]) K.breakable('planter', x - 5.2 + i * 3.5, y, z + s, 0, 1, 1);
    keepOut(x, z, 9);
  }
  // the paddock: cows, a trough, a fence a car goes straight through
  {
    const x0 = -236, x1 = -186, z0 = 774, z1 = 801;
    K.fence('rail', x0, z0, x1, z0, [[-228, z0, 2.6]]); K.fence('rail', x0, z1, x1, z1); K.fence('rail', x0, z0, x0, z1); K.fence('rail', x1, z0, x1, z1);
    for (const [x, z, ry] of [[-228, 782, .4], [-222, 794, 2.4], [-199, 779, 3.6], [-192, 792, 1.2], [-203, 796, -.6], [-231, 797, 1.9]]) cow(x, z, ry, R() < .3 ? old : mats.darkMetal);
    const y = groundY(-195, 785); box(tin, -195, y + .4, 785, 2.6, .7, .9); box(N.pool, -195, y + .72, 785, 2.4, .08, .7, false); solid(-195, 785, 1.3, .45, true);
    bale(-218, 777); bale(-216.3, 777.6); keepOut((x0 + x1) / 2, (z0 + z1) / 2, 26);
    // Hay Fever: the ramp that throws you over the lot
    out.ramps.farm = P.ramp(-211, 766, PI / 2, 10, 6, 2.6); keepOut(-211, 760, 8);
  }
  // a chicken coop and its chickens, a pig pen
  {
    const x = -262, z = 772, y = groundY(x, z); box(old, x, y + 1.1, z, 3.4, 1.6, 2.4); for (const s of [-1.4, 1.4]) box(old, x + s, y + .2, z, .14, .5, 2.2, false); mesh(roofGeo(2.9, .9, 3.9), barnRed, V(x, y + 1.9, z), null, scene).rotation.y = PI / 2; solid(x, z, 1.7, 1.2, true);
    for (let i = 0; i < 9; i++) { const cx = x + rr(-5, 5), cz = z + rr(2, 6), cy = groundY(cx, cz); mesh(G2.blob, M.white, V(cx, cy + .22, cz), V(.2, .2, .26), scene, false); mesh(G2.blob, M.red, V(cx, cy + .42, cz + .16), V(.07, .08, .07), scene, false); }
    K.fence('rail', -270, 783, -256, 783); K.fence('rail', -270, 791, -256, 791); K.fence('rail', -270, 783, -270, 791); K.fence('rail', -256, 783, -256, 791);
    K.drape(N.dirt, -269.6, 783.4, -256.4, 790.6, .06, 4, 2.5);
    for (const [a, b, ry] of [[-266, 786, .3], [-262, 788.5, 2], [-259, 785.5, 4]]) { const g = P.top(a, groundY(a, b), b, ry); mesh(rbox(1.1, .6, .6, .2), pig, V(0, .5, 0), null, g); mesh(rbox(.4, .4, .44, .12), pig, V(.7, .56, 0), null, g, false); for (const [u, w] of [[.35, .18], [.35, -.18], [-.35, .18], [-.35, -.18]]) mesh(G.box, pig, V(u, .12, w), V(.12, .26, .12), g, false); post(a, b, .55); }
    keepOut(-263, 782, 10);
  }
  // corn, taller than a car, from the barn's back door to the west road
  K.drape(N.soil, -316, 716, -291, 803, .05, 3, 4); rows(-316, 716, -291, 803, 1.7, .62, 2.1, corn, tassel, .3); keepOut(-303.5, 760, 0);
  K.fence('rail', -316, 713.5, -252, 713.5); K.fence('rail', -234, 713.5, -172, 713.5);

  // =====================================================================================
  // THE ORCHARD SIDE (between the middle road and the east road)
  // =====================================================================================
  // the farm stand on County Road
  {
    const x = -81, z = 714.5, y = groundY(x, z) + .05;
    K.drape(N.gravel, x - 9, z - 5.5, x + 9, z + 4, .06, 4, 3);
    box(M.wood, x, y + 1.3, z + 1.6, 7, 2.6, 2.6); box(M.wood, x, y + .55, z - .4, 7, 1.1, 1.2); solid(x, z + .8, 3.5, 2, true);
    const aw = box(one(awnings), x, y + 2.85, z - .5, 7.6, .12, 3.4); aw.rotation.x = -.22; for (const s of [-3.5, 3.5]) { box(M.wood, x + s, y + 1.3, z - 1.9, .14, 2.6, .14); post(x + s, z - 1.9, .14); }
    for (let i = 0; i < 6; i++) { box(one([pumpkin, M.red, sun, corn]), x - 2.9 + i * 1.15, y + 1.25, z - .45, .8, .3, .8, false); }
    P.sign('FARM STAND', x, y + 3.9, z - 1.2, PI, 6.4, 1.5, '#7a4a2f', '#ffe9a8'); K.spot(x, z - 2.4, 'mart', 2);
    for (const [a, b] of [[5.5, -2], [6.6, -1.6], [5.9, -.6], [-6, -1.8]]) crate(x + a, z + b); for (const [a, b] of [[-5, -3.2], [-5.9, -2.6], [4.4, -3.3]]) mesh(G2.blob, pumpkin, V(x + a, groundY(x + a, z + b) + .3, z + b), V(.42, .32, .42), scene);
    out.parked.push(['van', x + 12.5, z - 2, 0]); keepOut(x, z, 11); out.spots.stand = { x, z };
  }
  // the orchard: rows of apple trees
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
    const x = -152 + i * 7.6 + (j % 2) * 1.2, z = 728 + j * 8.4; if (R() < .08) continue;
    const y = groundY(x, z), g = P.top(x, y - .1, z, R() * 6.28), s = rr(.75, .95); g.scale.setScalar(s);
    mesh(G2.trunk, mats.trunk, V(0, 1.1, 0), V(1, 2.3, 1), g); mesh(G2.blob, M.canopy[i % 2], V(0, 3.1, 0), V(2, 1.5, 2), g);
    for (let k = 0; k < 5; k++) { const a = R() * 6.28, e = rr(-.5, .7); mesh(G2.blob, M.red, V(Math.cos(a) * 1.85 * Math.cos(e), 3.1 + Math.sin(e) * 1.4, Math.sin(a) * 1.85 * Math.cos(e)), V(.16, .16, .16), g, false); }
    solids.posts.push({ x, z, r: .28 });
  }
  keepOut(-120, 762, 40); K.fence('rail', -156, 721, -88, 721); for (const [x, z] of [[-140, 724], [-108, 724.5], [-92, 760]]) crate(x, z);
  // the pumpkin patch and its scarecrow
  K.drape(N.soil, -74, 724, -12, 754, .05, 3, 4);
  for (let x = -72; x <= -14; x += 3.2) for (let z = 726; z <= 752; z += 3) { if (R() < .3) continue; const px = x + rr(-.6, .6), pz = z + rr(-.6, .6), s = rr(.3, .55); mesh(G2.blob, pumpkin, V(px, groundY(px, pz) + s * .62, pz), V(s, s * .75, s), scene, false); if (R() < .5) mesh(G2.blob, M.canopy[0], V(px + .5, groundY(px, pz) + .12, pz + .3), V(.5, .1, .4), scene, false); }
  { const x = -43, z = 739, y = groundY(x, z); box(M.wood, x, y + 1.3, z, .12, 2.6, .12); box(M.wood, x, y + 1.9, z, 1.9, .1, .1, false); box(M.box[1], x, y + 1.75, z, 1.1, .8, .34, false); mesh(G2.blob, tassel, V(x, y + 2.5, z), V(.3, .3, .3), scene); mesh(G2.cone, old, V(x, y + 2.86, z), V(.5, .5, .5), scene, false); post(x, z, .2); }
  // sunflowers
  K.drape(N.soil, -74, 762, -12, 803, .05, 3, 4); rows(-74, 762, -12, 803, 2, .5, 1.5, corn, sun, .42, 'x');
  keepOut(-43, 763, 34);

  // =====================================================================================
  // THE BIG FIELDS north of the back road, out to the shore
  // =====================================================================================
  K.drape(N.soil, -316, 818, -268, 908, .05, 3, 4); rows(-316, 818, -268, 908, 2.9, 2.2, .55, wheat); keepOut(-292, 863, 0);
  // the lone oak on the hill: a bench with a view
  { const x = -243, z = 862; K.path(N.dirt, [[-243, 814], [-246, 840], [-243, 857]], 3, .06); const g = P.top(x, groundY(x, z) - .2, z, 1); g.scale.setScalar(2.5);
    mesh(G2.trunk, mats.trunk, V(0, 1.4, 0), V(1.5, 2.9, 1.5), g); for (const [a, b, c, s] of [[0, 3.9, 0, 2.2], [1.3, 3.2, .4, 1.4], [-1.1, 3.3, -.7, 1.5], [.2, 3.3, 1.3, 1.3], [-.3, 4.7, -.2, 1.4]]) mesh(G2.blob, M.canopy[0], V(a, b, c), V(s, s * .8, s), g);
    post(x, z, .9); K.bench(x + 4.5, z - 3, PI * .85); keepOut(x, z, 9); out.spots.oak = { x, z }; }
  // the hay field: round bales lying where the baler left them, an old barn on the rise, a truck that still runs
  for (let i = 0, tries = 0; i < 40 && tries < 400; tries++) { const x = rr(-205, -34), z = rr(818, 876); if (Math.hypot(x + 110, z - 846) < 13 || !K.clear(x, z)) continue; bale(x, z); i++; }
  {
    const x = -110, z = 846, y = groundY(x, z) - .1;
    box(old, x, y + 2.4, z, 9, 4.8, 7); mesh(roofGeo(8.2, 2.6, 10.2), old, V(x, y + 4.8, z), null, scene).rotation.y = PI / 2; box(mats.darkMetal, x, y + 1.7, z - 3.52, 3.2, 3.4, .1, false); solid(x, z, 4.5, 3.5);
    for (const [a, b] of [[6.5, 1], [7.6, -1], [-6.4, 2.5]]) bale(x + a, z + b); out.parked.push(['truck', x + 2, z - 8, .3]); keepOut(x, z, 9); out.spots.oldBarn = { x, z };
  }
  // the airstrip: packed dirt, a tin hangar, a wind sock. Nothing to fly yet.
  {
    const sx0 = -215, sx1 = -45, sz = 893; K.path(N.dirt, [[sx0, sz], [sx1, sz]], 13, .06); K.keepLine([[sx0, sz], [sx1, sz]], 8);
    for (let x = sx0 + 6; x < sx1; x += 14) K.paint(x, sz, 5, .3, groundY(x, sz) + .05, 0xf4f4f0);
    for (const x of [sx0 - 2, sx1 + 2]) for (const s of [-5, 0, 5]) K.breakable('cone', x, groundY(x, sz + s), sz + s, 0, 1, 1);
    const hx = -128, hz = 874, y = Math.max(groundY(hx - 8, hz), groundY(hx + 8, hz), groundY(hx, hz + 6)) + .05;
    K.drape(N.dirt, hx - 10, hz - 6.5, hx + 10, hz + 12, .07, 4, 3);
    box(tin, hx, y + 2.6, hz - 5.8, 16, 5.2, .4); for (const s of [-1, 1]) { box(tin, hx + s * 8, y + 2.6, hz, .4, 5.2, 12); wall(hx + s * 8, hz, 6, .2, PI / 2, y + 5.2); } wall(hx, hz - 5.8, 8, .2, 0, y + 5.2);
    mesh(roofGeo(16.6, 2.4, 12.6), tin, V(hx, y + 5.2, hz), null, scene); box(mats.trim, hx, y - 1.2, hz, 16.6, 2.6, 12.4);
    (out.zones.roofs ||= []).push({ x0: hx - 8, x1: hx + 8, z0: hz - 6, z1: hz + 6, y: y + 5.4 });
    P.sign('GOLDEN ACRES AIRSTRIP', hx, y + 6.3, hz + 6.4, 0, 13, 1.5, '#7a4a2f', '#ffe9a8');
    mesh(G.cyl, M.red, V(hx + 12, y + 1.1, hz - 2), V(1.1, 3, 1.1), scene).rotation.z = PI / 2; for (const s of [-1, 1]) box(mats.darkMetal, hx + 12 + s, y + .3, hz - 2, .2, .6, 1.6, false); solid(hx + 12, hz - 2, 1.6, 1.1, true);
    box(mats.darkMetal, hx - 13, y + 2.5, hz + 8, .1, 5, .1); const sock = mesh(G2.cone, M.crane, V(hx - 12.2, y + 4.7, hz + 8), V(.35, 1.6, .35), scene, false); sock.rotation.z = PI / 2; post(hx - 13, hz + 8, .15);
    for (const [a, b] of [[4, -3.5], [5.2, -3.8], [-5.5, -4]]) crate(hx + a, hz + b);
    keepOut(hx, hz + 2, 16);
    out.zones.airstrips = [{ x0: sx0, x1: sx1, z: sz, width: 13, hangar: { x: hx, z: hz }, name: 'GOLDEN ACRES' }];
  }
  // the east field, a water tower on its rise, the track to the base's back gate
  K.path(N.dirt, [[7, 810], [57, 810]], 5, .06); K.keepLine([[7, 810], [57, 810]], 4);
  K.drape(N.soil, -30, 820, 44, 878, .05, 3, 4); rows(-30, 820, 18, 878, 2.9, 2.2, .5, wheat); rows(34, 820, 44, 878, 2.9, 2.2, .5, wheat); keepOut(7, 849, 0);
  { const x = 27, z = 850, y = groundY(x, z); for (const [a, b] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) box(mats.darkMetal, x + a, y + 5, z + b, .22, 10, .22); mesh(G.cyl, tin, V(x, y + 11.6, z), V(3, 3.6, 3), scene); mesh(G2.cone, tin, V(x, y + 14.2, z), V(3.2, 1.6, 3.2), scene); post(x, z, 2.5); P.sign('GOLDEN ACRES', x, y + 11.6, z - 3.1, PI, 5.6, 1.3, null, '#b8402f', 150); }
  for (let z = 718; z <= 905; z += 9.5) if (Math.abs(z - 810) > 8) { const x = 52 + Math.sin(z) * 1.5; if (K.clear(x, z)) P.tree(x, z, rr(1.3, 1.7)); }      // the windbreak along the base fence

  // trees and rocks: sparse, in clumps
  for (const [cx, cz, n] of [[-170, 830, 5], [-60, 905, 7], [-300, 930, 9], [-180, 935, 8], [-40, 940, 7], [20, 905, 5], [-30, 716, 3], [-174, 806, 3], [-340, 760, 8], [-345, 860, 9]]) scatter(n, cx - 14, cz - 12, cx + 14, cz + 12, (x, z) => P.tree(x, z, rr(1, 1.6)));
  scatter(18, -317, 922, 52, 962, (x, z) => P.rock(x, z, rr(.7, 2)));
  scatter(26, -317, 912, 52, 958, (x, z) => P.bush(x, z, rr(.8, 1.4)));
  scatter(40, -372, 708, -330, 960, (x, z) => P.rock(x, z, rr(1, 2.6)));

  out.walkers.push({ cx: -243, cz: 752, hx: 9, hz: 34, n: 2, kinds: ['scrap', 'raccoon'] }, { cx: -81, cz: 709.6, hx: 14, hz: .8, n: 1 }, { cx: -120, cz: 762, hx: 31, hz: 37, n: 1 });
}

function mergeAll(list) {
  const pos = [], nor = [];
  for (const g of list) { const n = g.index ? g.toNonIndexed() : g; pos.push(...n.attributes.position.array); nor.push(...n.attributes.normal.array); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return out;
}
