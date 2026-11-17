// Fort Pelican: the military base in the north-east corner. A chain-link fence all the way round (a car that
// is in the air clears it), a main gate on County Road with a barrier you can ram, a back gate on the farm
// track, a runway, three hangars you can drive into, a control tower, two helipads, barracks, headquarters,
// a motor pool with trucks to take, a firing range, fuel tanks, a radar that turns and a watchtower at each
// corner. Being inside the fence gets you wanted (BASE in config.js; world/places.js does the watching).
// The hangars, helipads and runway are empty and listed in districts.zones for whatever flies later.
import * as THREE from 'three';
import { V } from '../core/utils.js';
import { mats, std, G, mesh, rbox, ctex } from './materials.js';
import { roofGeo } from './props.js';

const PI = Math.PI;

export function buildBase(K) {
  const { api, realScene, solids, out, P, M, G2, R, rr, one, post, deck, keepOut, N } = K, { IB, mat4 } = api;
  const Y = 6, D = 6.1, X0 = 60, X1 = 320, Z0 = 712, Z1 = 914;                 // ground, paved level, the fence line
  const S = K.site(190, 780), T = K.site(190, 870);                             // two welds: the camp, and the airfield
  const tin = mats.ac, olive = N.olive, tan = N.tan, dark = mats.darkMetal;
  const hut = std({ color: 0x8a9068, roughness: .85 }), drab = std({ color: 0x4f5a3a, roughness: .8 });
  keepOut(190, 813, 135);
  const wall = (x, z, hl, ht, rot, h, kind = 'solid') => solids.walls.push({ x, z, hl, ht, rot, kind, h });
  const low = (x, z, hw, hd, h = 1.2) => solids.boxes.push({ x, z, hw, hd, low: true, h: Y + h, wall: true });
  const paved = (x0, z0, x1, z1, plan = '#5d6068', mat = mats.asphalt, tile = 420, site = S) => { deck({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hl: (x1 - x0) / 2, hw: (z1 - z0) / 2, rot: 0, y0: D, plan }); site.own(K.slab(mat, x0, z0, x1, z1, D + .005, tile)); };

  // ---------- the fence ----------
  const linkTex = ctex(64, (x, s) => { x.clearRect(0, 0, s, s); x.strokeStyle = '#aeb4ba'; x.lineWidth = 3; for (let i = -s; i < s * 2; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + s, s); x.stroke(); x.beginPath(); x.moveTo(i + s, 0); x.lineTo(i, s); x.stroke(); } });
  const link = std({ map: linkTex, color: 0xffffff, roughness: .6, metalness: .4, alphaTest: .4, side: THREE.DoubleSide });
  function fence(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const g = new THREE.PlaneGeometry(len, 2.6), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 1.3, uv.getY(i) * 2);
    const m = mesh(g, link, V(cx - 190, Y + 1.3, cz - 780), null, S.g, false); if (!alongX) m.rotation.y = PI / 2;
    S.box(dark, cx, Y + 2.62, cz, alongX ? len : .07, .07, alongX ? .07 : len, false); for (const k of [2.78, 2.92]) S.box(dark, cx, Y + k, cz, alongX ? len : .03, .03, alongX ? .03 : len, false);
    for (let i = 0, n = Math.round(len / 4); i <= n; i++) IB.pole.add(mat4(V(x0 + (x1 - x0) * i / n, Y + 1.5, z0 + (z1 - z0) * i / n), V(.05, 3, .05)));
    wall(cx, cz, len / 2, .12, alongX ? 0 : PI / 2, Y + .9, 'low');
  }
  const GX = 162, GW = 7, BG = 810;                       // main gate (on the south side), half its width; back gate (on the west side)
  fence(X0, Z0, GX - GW, Z0); fence(GX + GW, Z0, X1, Z0); fence(X0, Z1, X1, Z1); fence(X1, Z0, X1, Z1 - 30); fence(X1, Z1 - 24, X1, Z1);      // ...and a gap someone cut near the north-east corner
  fence(X0, Z0, X0, BG - 5); fence(X0, BG + 5, X0, Z1);
  { const p = S.box(dark, X1, Y + 1.3, Z1 - 29.4, .07, 2.7, .07, false); p.rotation.x = .5; }

  // ---------- the main gate ----------
  paved(GX - 5, 706, GX + 5, 790); paved(75, 785, 300, 795); paved(220, 795, 230, 834); paved(105, 795, 115, 835);
  for (let z = 716; z < 784; z += 6) K.paint(GX, z, .16, 3, D, 0xf2c230); for (let x = 80; x < 298; x += 6) K.paint(x, 790, 3, .16, D, 0xf2c230);
  K.gate('FORT PELICAN', GX, Z0, 'x', GW * 2 + 2, '#3d4a2f', '#f1eedc');
  K.breakable('boom', GX, Y + .1, Z0 + 2.5, 0, GW * 2 - 2.4, 1.05); S.box(M.red, GX - GW + .9, Y + .65, Z0 + 2.5, .5, 1.3, .5); post(GX - GW + .9, Z0 + 2.5, .4);
  { const x = GX + GW + 3, z = Z0 + 5; S.box(hut, x, Y + 1.5, z, 3.4, 3, 3.4); S.box(mats.carGlass, x, Y + 1.9, z, 3.44, .9, 3.44, false); S.box(drab, x, Y + 3.1, z, 4.2, .22, 4.2); solids.boxes.push({ x, z, hw: 1.7, hd: 1.7, h: Y + 3.3 }); api.lampPts.push(V(x - 2.4, Y + 3, z)); }
  for (const [x, z] of [[GX - 4, Z0 + 14], [GX + 4, Z0 + 24]]) { S.put(rbox(4.4, .9, .7, .15), mats.concrete, x, Y + .55, z); low(x, z, 2.2, .35, .9); }
  for (const s of [-1, 1]) { P.sign('RESTRICTED AREA', GX + s * (GW + 11), Y + 1.6, Z0 - .15, PI, 5, 1.2, '#b3261e', '#ffffff'); P.sign('RESTRICTED AREA', X0 - .15, Y + 1.6, BG + s * 12, -PI / 2, 5, 1.2, '#b3261e', '#ffffff'); }
  for (const [x, z, n] of [[GX - GW - 2, Z0 + 4, 4], [GX + GW + 1.2, Z0 + 10.5, 3]]) for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) { S.put(rbox(1.3, .42, .62, .16), tan, x - i * 1.25 + k * .6, Y + .21 + k * .4, z); if (!k) low(x - i * 1.25, z, .65, .31, .8); }
  // the back gate, on the track from the farm
  K.breakable('boom', X0 + 1.5, Y, BG, PI / 2, 8.6, 1.05); S.box(M.red, X0 + 1.5, Y + .6, BG - 4.6, .5, 1.3, .5); post(X0 + 1.5, BG - 4.6, .4);
  S.own(K.path(N.dirt, [[X0 - 2, BG], [68, BG], [80, 796]], 5, .07));
  // Intruder: a ramp outside the fence that puts you down on the base's cross road
  out.ramps.base = P.ramp(43, 790, 0, 10, 6, 3.1); K.keepLine([[8, 790], [58, 790]], 4.5);

  // ---------- barracks ----------
  for (const [x, z] of [[95, 733], [130, 733], [95, 760], [130, 760]]) {
    S.box(hut, x, Y + 1.7, z, 24, 3.4, 8); S.put(roofGeo(9, 1.9, 25), drab, x, Y + 3.4, z).rotation.y = PI / 2; S.box(mats.trim, x, Y + .15, z, 24.3, .3, 8.3, false);
    solids.boxes.push({ x, z, hw: 12, hd: 4, h: Y + 5 });
    for (let i = -3; i <= 3; i++) for (const s of [-1, 1]) if (i || s < 0) K.pane(x + i * 3.3, Y + 1.9, z + s * 4.01, 1.3, 1, 'x'); S.box(N.door, x, Y + 1.1, z + 4.02, 1.2, 2.2, .1, false);
  }
  out.walkers.push({ cx: 112.5, cz: 746.5, hx: 33, hz: 6, n: 3, kinds: ['scrap'] });
  // ---------- headquarters, the square in front of it, the flag ----------
  {
    const x = 207, z = 750; paved(172, 732, 196, 768, '#b9b3a8', mats.concrete, 6);
    S.box(tan, x, Y + 4, z, 18, 8, 32); S.box(mats.trim, x, Y + 8.2, z, 18.6, .5, 32.6); S.box(mats.trim, x, Y + 4.1, z, 18.2, .25, 32.2, false); S.box(olive, x - 9.6, Y + 4.6, z, 1.6, .3, 9); solids.boxes.push({ x, z, hw: 9, hd: 16, h: Y + 9 });
    for (const s of [-3.8, 3.8]) { S.put(G.cyl, mats.trim, x - 10.2, Y + 2.25, z + s, .22, 4.5, .22); post(x - 10.2, z + s, .28); }
    S.box(N.door, x - 9.02, Y + 1.3, z, .1, 2.6, 2.4, false);
    for (const y of [2, 5.8]) for (let i = -4; i <= 4; i++) { if (i || y > 3) K.pane(x - 9.01, Y + y, z + i * 3.4, 1.9, 1.5, 'z'); K.pane(x + 9.01, Y + y, z + i * 3.4, 1.9, 1.5, 'z'); }
    P.sign('FORT PELICAN HQ', x - 9.1, Y + 7.1, z, -PI / 2, 12, 1.5, '#3d4a2f', '#f1eedc');
    S.put(G.cyl, mats.trim, 184, Y + 6, z, .1, 12, .1); S.box(M.red, 185.4, Y + 11.2, z, 2.6, 1.5, .05, false); S.box(M.white, 185.4, Y + 10.7, z, 2.6, .5, .06, false); S.put(G.cyl, mats.trim, 184, Y + .2, z, .9, .4, .9); post(184, z, .9);
    // two tanks parked on the square
    for (const [tx, tz, ry] of [[178, 738, .25], [178, 762, -.25]]) {
      const g = new THREE.Group(); g.position.set(tx - 190, Y + .1, tz - 780); g.rotation.y = ry; S.g.add(g);
      mesh(rbox(6.2, 1.1, 3, .2), drab, V(0, 1.1, 0), null, g); for (const s of [-1, 1]) { mesh(rbox(6.6, .9, .7, .3), dark, V(0, .5, s * 1.45), null, g); for (let i = -2; i <= 2; i++) mesh(G.cyl, mats.metal, V(i * 1.25, .45, s * 1.82), V(.4, .08, .4), g, false).rotation.x = PI / 2; }
      mesh(rbox(2.8, .9, 2.2, .25), drab, V(-.3, 2.1, 0), null, g); mesh(G.cyl, drab, V(2.9, 2.15, 0), V(.13, 4.2, .13), g).rotation.z = PI / 2; mesh(G.cyl, dark, V(5, 2.15, 0), V(.18, .5, .18), g, false).rotation.z = PI / 2; mesh(G.cyl, drab, V(-.6, 2.65, .4), V(.45, .2, .45), g, false);
      solids.boxes.push({ x: tx, z: tz, hw: 3.2, hd: 1.9, h: Y + 2.6 });
    }
    out.walkers.push({ cx: 184, cz: z, hx: 10, hz: 16, n: 2, kinds: ['scrap'] });
  }
  // ---------- the motor pool: trucks you can take ----------
  {
    paved(250, 728, 302, 776, '#5d6068');
    for (let i = 0; i < 4; i++) { const x = 257 + i * 12.6; S.box(hut, x, Y + 2.6, 731.2, 12.2, 5.2, .4); if (i < 3) S.box(hut, x + 6.3, Y + 2.6, 734.5, .4, 5.2, 7); }
    for (const x of [250.7, 301.1]) { S.box(hut, x, Y + 2.6, 734.5, .4, 5.2, 7); wall(x, 734.5, 3.5, .2, PI / 2, Y + 5.2); } wall(276, 731.2, 25.5, .2, 0, Y + 5.2); for (let i = 0; i < 3; i++) wall(263.3 + i * 12.6, 734.5, 3.5, .2, PI / 2, Y + 5.2);
    S.box(drab, 276, Y + 5.3, 734.8, 51.4, .3, 7.8); (out.zones.roofs ||= []).push({ x0: 250.5, x1: 301.5, z0: 731, z1: 738.6, y: Y + 5.2 });
    for (let i = 0; i < 9; i++) K.paint(254 + i * 5.6, 768, .14, 9, D);
    out.parked.push(['truck', 257, 735, PI / 2], ['truck', 282.2, 735, PI / 2], ['van', 269.6, 735.4, PI / 2], ['truck', 262.4, 768, -PI / 2], ['van', 279.2, 768, -PI / 2], ['car', 290.4, 768, -PI / 2]);
    for (const [x, z] of [[297, 742], [298.2, 742.6], [297.4, 743.8], [252, 752]]) K.breakable('crate', x, D, z, R(), 1, 1);
    for (const [x, z] of [[246.5, 744], [246.5, 752], [246.5, 760]]) K.breakable('cone', x, Y, z, 0, 1, 1);
  }
  // ---------- fuel, the firing range, the radar ----------
  for (const z of [806, 813, 820]) { S.put(G.cyl, tin, 160, Y + 1.9, z, 1.7, 9, 1.7).rotation.z = PI / 2; for (const s of [-3, 3]) S.box(dark, 160 + s, Y + .4, z, .4, .8, 2.6, false); low(160, z, 4.5, 1.7, 3.6); }
  S.box(mats.concrete, 160, Y + .25, 813, 12, .5, .3, false); P.sign('FUEL', 160, Y + 4.6, 802.6, PI, 3.4, 1.2, '#b3261e', '#ffffff');
  {
    S.own(K.slab(N.gravel, 72, 800, 100, 830, Y + .05, 4));
    for (let i = 0; i < 5; i++) { const z = 803 + i * 6; S.box(mats.trim, 96, Y + .5, z, .3, 1, 3.4); low(96, z, .15, 1.7, 1); for (const x of [74, 82]) { S.box(dark, x, Y + .7, z, .06, 1.4, .06, false); S.box(M.white, x, Y + 1.5, z, .05, .9, .7, false); S.box(M.red, x - .03, Y + 1.5, z, .05, .36, .3, false); } }
    S.box(tan, 68, Y + 1.2, 815, 2.4, 2.4, 30); low(68, 815, 1.2, 15, 2.4);
  }
  {
    const x = 310, z = 796; S.box(hut, x, Y + 2, z, 6, 4, 6); solids.boxes.push({ x, z, hw: 3, hd: 3, h: Y + 4.2 }); S.put(G.cyl, tin, x, Y + 5.5, z, .3, 3, .3);
    const dish = new THREE.Group(); dish.position.set(x, Y + 7.4, z); realScene.add(dish);
    const d = new THREE.Mesh(new THREE.SphereGeometry(3.4, 14, 6, 0, PI * 2, 0, .75), tin); d.rotation.x = PI / 2 + .25; d.position.set(0, .4, -1.9); d.castShadow = true; d.material.side = THREE.DoubleSide; dish.add(d);
    const arm = new THREE.Mesh(G.box, dark); arm.scale.set(.12, .12, 2.6); arm.position.set(0, .6, .2); dish.add(arm);
    out.animated.push((dt) => { dish.rotation.y += dt * .7; });
  }

  // ---------- the airfield ----------
  const RW = { x0: 75, x1: 310, z: 880, hw: 11 };
  paved(RW.x0, RW.z - RW.hw, RW.x1, RW.z + RW.hw, '#4a4d55', mats.asphalt, 420, T); paved(185, 834, 305, 869, '#6a6d74', mats.asphalt, 420, T); paved(80, 835, 140, 869, '#6a6d74', mats.asphalt, 420, T);
  for (let x = RW.x0 + 22; x < RW.x1 - 20; x += 12) K.paint(x, RW.z, 6, .5, D);
  for (const s of [-1, 1]) { K.paint((RW.x0 + RW.x1) / 2, RW.z + s * (RW.hw - .8), RW.x1 - RW.x0 - 4, .3, D); for (const e of [RW.x0 + 6, RW.x1 - 6]) for (let k = 1; k <= 4; k++) K.paint(e, RW.z + s * k * 2.2, 8, 1.1, D); }
  for (let x = RW.x0 + 4; x <= RW.x1; x += 21) for (const s of [-1, 1]) { T.put(G2.blob, mats.lampHead, x, D + .12, RW.z + s * (RW.hw + .8), .18, .18, .18, false); }
  for (const x of [100, 192.5, 285]) for (const s of [-1, 1]) api.lampPts.push(V(x, D + 1, RW.z + s * 12));
  for (const x of [200, 245, 290]) K.paint(x, 851.5, .3, 30, D, 0xf2c230); K.paint(245, 866, 116, .3, D, 0xf2c230);
  // hangars: open to the apron, nothing parked in them yet
  const hangars = [];
  for (const x of [205, 245, 285]) {
    const z = 820, hw = 14.5, hd = 14, H = 6;
    T.own(K.slab(mats.concrete, x - hw, z - hd, x + hw, z + hd, D + .005, 6)); deck({ x, z, hl: hw, hw: hd, rot: 0, y0: D });
    T.box(olive, x, Y + H / 2, z - hd, hw * 2, H, .5); wall(x, z - hd, hw, .25, 0, Y + 12); for (const s of [-1, 1]) { T.box(olive, x + s * hw, Y + H / 2, z, .5, H, hd * 2); wall(x + s * hw, z, hd, .25, PI / 2, Y + 12); }
    const arch = new THREE.CylinderGeometry(hw + .3, hw + .3, hd * 2 + .6, 18, 1, true, -PI / 2, PI); arch.rotateX(-PI / 2); arch.scale(1, .45, 1);
    const roof = mesh(arch, drab, V(x - 190, Y + H, z - 870), null, T.g); roof.material.side = THREE.DoubleSide;
    const back = new THREE.CircleGeometry(hw + .3, 18, 0, PI); back.scale(1, .45, 1); const b = mesh(back, olive, V(x - 190, Y + H, z - hd - 870), null, T.g); b.rotation.y = PI;
    const lip = new THREE.RingGeometry(hw - .7, hw + .3, 18, 1, 0, PI); lip.scale(1, .45, 1); mesh(lip, M.box[3], V(x - 190, Y + H, z + hd + .32 - 870), null, T.g, false);
    T.box(M.box[3], x, Y + H - .2, z + hd + .3, hw * 2 + .6, .4, .3, false);
    for (const s of [-1, 1]) for (const k of [-6, 6]) T.box(std({ color: 0xfff1d6, emissive: 0xfff1d6, emissiveIntensity: 1.2 }), x + s * 6, Y + H + 5.6, z + k, 2.6, .08, .6, false);
    api.lampPts.push(V(x, Y + 9, z)); (out.zones.roofs ||= []).push({ x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, y: Y + H + 4.6 });
    for (const [a, c] of [[-11, -11], [-9.8, -11.4], [-11.2, -9.6], [11, -10]]) K.breakable('crate', x + a, D, z + c, R(), 1, 1);
    K.paint(x, z, .3, hd * 2 - 4, D, 0xf2c230);
    hangars.push({ x, z, hw, hd, y: D, open: [0, 1] });
  }
  // the control tower
  {
    const x = 176, z = 848; T.box(tan, x, Y + 8, z, 5, 16, 5); solids.boxes.push({ x, z, hw: 2.5, hd: 2.5, h: Y + 22 });
    T.put(G2.cyl8, mats.trim, x, Y + 16.3, z, 4.6, .6, 4.6); T.put(G2.cyl8, mats.carGlass, x, Y + 17.9, z, 4.3, 2.6, 4.3); T.put(G2.cyl8, drab, x, Y + 19.5, z, 4.9, .6, 4.9); T.put(G.cyl, dark, x, Y + 22, z, .06, 4.4, .06, false);
    T.put(G2.blob, std({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 2 }), x, Y + 24.2, z, .25, .25, .25, false); T.box(N.door, x, Y + 1.1, z + 2.52, 1.1, 2.2, .1, false);
    for (const y of [5, 9, 13]) K.pane(x, Y + y, z + 2.51, 1.2, 1.4, 'x');
    api.lampPts.push(V(x, Y + 17.6, z + 4)); out.spots.tower = { x, z };
  }
  // helipads
  const pads = [];
  for (const x of [96, 124]) {
    const z = 852; for (let i = 0; i < 24; i++) { const a = i / 24 * PI * 2; K.paint(x + Math.cos(a) * 9.4, z + Math.sin(a) * 9.4, 2.6, .36, D, 0xf2c230, -a + PI / 2); }
    for (const [a, b, c, d] of [[-2.1, 0, .8, 7], [2.1, 0, .8, 7], [0, 0, 4.2, .8]]) K.paint(x + a, z + b, c, d, D);
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; T.put(G2.blob, mats.lampHead, x + Math.cos(a) * 11, D + .14, z + Math.sin(a) * 11, .2, .2, .2, false); }
    api.lampPts.push(V(x, D + 1, z)); pads.push({ x, z, y: D, name: 'FORT PELICAN' });
  }
  T.box(dark, 142.5, Y + 2.5, 838, .1, 5, .1); T.put(G2.cone, M.crane, 143.3, Y + 4.7, 838, .35, 1.6, .35, false).rotation.z = PI / 2; post(142.5, 838, .15);

  // ---------- watchtowers at the corners ----------
  for (const [x, z] of [[X0 + 5, Z0 + 5], [X1 - 5, Z0 + 5], [X0 + 5, Z1 - 5], [X1 - 5, Z1 - 5]]) {
    for (const [a, b] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) { S.box(dark, x + a, Y + 3.6, z + b, .2, 7.2, .2); }
    S.box(hut, x, Y + 7.3, z, 3.6, .25, 3.6); S.box(hut, x, Y + 7.9, z, 3.6, 1, 3.6); S.box(drab, x, Y + 10, z, 4.4, .25, 4.4); for (const [a, b] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) S.box(dark, x + a, Y + 9.2, z + b, .1, 1.6, .1, false);
    S.put(G2.blob, mats.lampHead, x, Y + 9.6, z, .35, .35, .35, false); api.lampPts.push(V(x, Y + 9.4, z)); post(x, z, 1.9);
  }
  // crates of supplies by the tower, cones on the apron
  for (const [x, z] of [[182, 842], [183.2, 842.4], [182.4, 843.6]]) K.breakable('crate', x, Y, z, R(), 1, 1);
  for (const x of [188, 218, 232, 258, 272, 302]) K.breakable('cone', x, D, 836, 0, 1, 1);

  out.zones.base = { x0: X0 + 1, x1: X1 - 1, z0: Z0 + 1, z1: Z1 - 1 };
  out.zones.runway = RW; out.zones.hangars = hangars; (out.zones.helipads ||= []).push(...pads);
  out.walkers.push({ cx: 245, cz: 851, hx: 52, hz: 12, n: 3, kinds: ['scrap'] }, { cx: GX, cz: 750, hx: 3.6, hz: 30, n: 2, kinds: ['scrap'] });
  out.spots.base = { x: GX, z: Z0 };
}
