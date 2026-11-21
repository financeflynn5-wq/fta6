// Mouse Bear Trucking: the company's depot, on the lot north of Port Sunset where the port road meets the coast road.
// A fenced yard with two open gates (the arch on the port road, a side gate on the coast road), a warehouse with a
// row of loading docks, the company's billboard on its roof, two trailers backed up to the docks, a fuel island, a
// forklift, a gatehouse, the logo painted on the tarmac (for anyone flying over) and, on a pole at the corner, the
// Mouse Bear's head, turning slowly. The artwork comes from assets/mousebear/ (drawn by dev/mousebear-art.py).
// The trucks themselves are ordinary vehicles (type 'mbtruck'): the ones kept in the yard are put there by
// vehicles/mousebearFleet.js, at the bays listed in districts.spots.mousebear.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { V } from '../core/utils.js';
import { MOUSEBEAR } from '../config.js';
import { mats, std, G, mesh, rbox, ctex, facade, awnings } from './materials.js';
import { plainGeometry } from './batching.js';
import { groundY } from './terrain.js';

const PI = Math.PI;
export const MB_YARD = { x0: 279.5, x1: 334, z0: 171.5, z1: 211 };          // the fence line
const C = { teal: 0x0f9692, tealD: 0x0a6c6e, cream: 0xfff3dc, coral: 0xff5d62, coralD: 0xe2444e, gold: 0xffc145, fur: 0x9c6540, furD: 0x7b4a2d, pink: 0xf8a9b9, muzzle: 0xf6e4c6, ink: 0x2b1b17, white: 0xffffff, blush: 0xe98b84 };

// The mascot's head, about 2 units across, looking along +z. One mesh per colour.
export function mouseBearHead() {
  const g = new THREE.Group(), parts = {}, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const sph = new THREE.SphereGeometry(1, 28, 18), box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 24);
  const add = (col, geo, x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => (parts[col] ||= []).push(plainGeometry(geo, m4.compose(V(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), V(sx, sy, sz))));
  add('fur', sph, 0, 0, 0, 1, .93, .9);
  for (const s of [-1, 1]) {
    add('furD', sph, s * .86, .74, -.05, .52, .52, .16); add('pink', sph, s * .86, .73, .07, .34, .34, .08);      // ears
    add('ink', sph, s * .36, .04, .8, .1, .13, .07); add('white', sph, s * .33, .09, .855, .034);                  // eyes
    add('blush', sph, s * .62, -.3, .64, .14, .1, .06);                                                            // cheeks
    add('white', box, s * .055, -.6, .92, .095, .15, .05);                                                         // teeth
    for (const [k, tilt] of [[0, .2], [1, 0], [2, -.2]]) add('ink', cyl, s * .78, -.36 - k * .08 + (k - 1) * -.02, .66, .012, .68, .012, 0, s * -.5, PI / 2 + s * tilt);   // whiskers
  }
  add('muzzle', sph, 0, -.4, .62, .47, .36, .4); add('ink', sph, 0, -.2, .98, .16, .105, .1);                      // muzzle and nose
  add('ink', box, 0, -.42, 1.0, .03, .16, .03);
  // the trucker's cap: crown, a white front panel, the brim and the button on top
  add('coral', new THREE.SphereGeometry(1, 28, 12, 0, PI * 2, 0, PI / 2), 0, .34, -.02, .87, .72, .86);
  add('white', new THREE.SphereGeometry(1, 14, 10, PI / 2 - .62, 1.24, .3, PI / 2 - .3), 0, .34, -.02, .885, .735, .875);
  add('coralD', cyl, 0, .4, .74, .66, .07, .56, .16); add('coralD', sph, 0, 1.06, -.02, .08, .05, .08);
  for (const k in parts) {
    const mat = std({ color: C[k], roughness: k === 'ink' ? .3 : .7, emissive: k === 'ink' ? 0 : C[k] });
    Object.defineProperty(mat, 'emissiveIntensity', { get: () => mats.lampHead.emissiveIntensity * .11, set() { } });      // lit from inside once the street lamps come on
    const m = new THREE.Mesh(mergeGeometries(parts[k]), mat); m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
  return g;
}

export function buildMouseBear(K) {
  const { api, realScene, solids, out, P, M, post } = K, { IB, mat4 } = api;
  const { x0: X0, x1: X1, z0: Z0, z1: Z1 } = MB_YARD, CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2;
  const S = K.site(CX, CZ);                                 // one weld for the whole depot
  const SG = 305, SGW = 6.2, WG = 184.5, WGW = 5;           // the south gate (on the port road) and the west gate (on the coast road): centre, half width
  const tl = new THREE.TextureLoader(), tex = (file) => { const t = tl.load('assets/mousebear/' + file); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const bannerTex = tex('banner.png'), logoTex = tex('logo.png');
  const teal = std({ color: C.teal, roughness: .5 }), tealD = std({ color: C.tealD, roughness: .6 }), coral = std({ color: C.coral, roughness: .55 }), cream = std({ color: C.cream, roughness: .7 }), gold = std({ color: C.gold, roughness: .5 });
  const bannerLit = std({ map: bannerTex, roughness: .55 });                                             // on the trailers: paint, lit by the sun
  const onTop = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 };          // painted-on artwork: drawn a touch nearer than the wall it is on
  const bannerGlow = new THREE.MeshBasicMaterial({ map: bannerTex, ...onTop }), logoGlow = new THREE.MeshBasicMaterial({ map: logoTex, ...onTop });   // signs: they brighten at night with the city's others
  api.signMats.push(bannerGlow, logoGlow);
  const local = (geo, mat, x, y, z, ry = 0, cast = false) => { const m = mesh(geo, mat, V(x - CX, y, z - CZ), null, S.g, cast); m.rotation.y = ry; return m; };
  const low = (x, z, hw, hd, h) => solids.boxes.push({ x, z, hw, hd, low: true, h });
  K.keepOut(CX, CZ, 34);

  // ---------- the yard: tarmac laid over the lot, driveways out to both roads ----------
  S.own(K.drape(mats.asphalt, X0, Z0, X1, Z1, .05, 420, 2));
  S.own(K.drape(mats.asphalt, SG - SGW - .6, 168.8, SG + SGW + .6, Z0, .05, 420, 2));
  S.own(K.drape(mats.asphalt, 276.8, WG - WGW - .6, X0, WG + WGW + .6, .05, 420, 2));
  out.decks.push({ x: CX, z: CZ, hl: (X1 - X0) / 2, hw: (Z1 - Z0) / 2, rot: 0, plan: '#5d6068' });      // the radar's street plan only: nothing is raised here

  // ---------- the fence: chain link on posts, following the ground ----------
  const linkTex = ctex(64, (x, s) => { x.clearRect(0, 0, s, s); x.strokeStyle = '#aeb4ba'; x.lineWidth = 3; for (let i = -s; i < s * 2; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + s, s); x.stroke(); x.beginPath(); x.moveTo(i + s, 0); x.lineTo(i, s); x.stroke(); } });
  const link = std({ map: linkTex, color: 0xffffff, roughness: .6, metalness: .4, alphaTest: .4, side: THREE.DoubleSide });
  const railMat = std({ color: 0x2b2f35, roughness: .5, metalness: .6, side: THREE.DoubleSide });
  function fence(ax, az, bx, bz) {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 2.6)), pos = [], uv = [], idx = [], rail = [];
    for (let i = 0; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n, y = groundY(x, z);
      pos.push(x - CX, y, z - CZ, x - CX, y + 2.36, z - CZ); uv.push(i * len / n / 1.3, 0, i * len / n / 1.3, 1.97);      // the mesh stops where the top rail starts (they share a plane)
      rail.push(x - CX, y + 2.36, z - CZ, x - CX, y + 2.47, z - CZ);
      if (i < n) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      IB.pole.add(mat4(V(x, y + 1.25, z), V(.05, 2.5, .05)));
    }
    const strip = (p, t) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); if (t) g.setAttribute('uv', new THREE.Float32BufferAttribute(t, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
    mesh(strip(pos, uv), link, null, null, S.g, false); mesh(strip(rail), railMat, null, null, S.g, false);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    solids.walls.push({ x: mx, z: mz, hl: len / 2, ht: .12, rot: Math.abs(bx - ax) > Math.abs(bz - az) ? 0 : PI / 2, kind: 'low', h: groundY(mx, mz) + .9 });
  }
  fence(X0, Z0, SG - SGW, Z0); fence(SG + SGW, Z0, X1, Z0); fence(X1, Z0, X1, Z1); fence(X1, Z1, X0, Z1);
  fence(X0, Z0, X0, WG - WGW); fence(X0, WG + WGW, X0, Z1);
  // the arch over the main gate, and plain posts at the side gate
  K.gate('MOUSE BEAR TRUCKING', SG, Z0, 'x', SGW * 2 + 1, '#0a6c6e', '#fff3dc');
  for (const s of [-1, 1]) { const z = WG + s * (WGW + .2), y = groundY(X0, z); S.box(mats.trim, X0, y + 1.5, z, .5, 3, .5); S.box(teal, X0, y + 3.1, z, .7, .22, .7, false); post(X0, z, .4); }

  // ---------- the warehouse ----------
  const BX0 = 287, BX1 = 329.4, BZ0 = 198.6, BZ1 = 209.8, bw = BX1 - BX0, bd = BZ1 - BZ0, bx = (BX0 + BX1) / 2, bz = (BZ0 + BZ1) / 2, H = 8.4;
  const corner = [[BX0, BZ0 - 3.4], [BX1, BZ0 - 3.4], [BX0, BZ1], [BX1, BZ1]].map(([x, z]) => groundY(x, z)), yb = Math.max(...corner) + .12, lo = Math.min(...corner) - .7;
  S.box(facade[3], bx, yb + H / 2, bz, bw, H, bd); S.box(mats.trim, bx, (yb + .45 + lo) / 2, bz, bw + .3, yb + .45 - lo, bd + .3);
  S.box(teal, bx, yb + H - .5, bz, bw + .22, 1.2, bd + .22); S.box(coral, bx, yb + H - 1.24, bz, bw + .26, .18, bd + .26, false); S.box(mats.trim, bx, yb + H + .16, bz, bw + .5, .2, bd + .5);
  solids.boxes.push({ x: bx, z: bz, hw: bw / 2, hd: bd / 2, h: yb + H + .25 });
  for (const [x, z] of [[bx - 9, bz + 2], [bx + 12, bz + 1.5]]) S.put(rbox(1.6, 1, 1.2, .1), mats.ac, x, yb + H + .75, z);
  // the office end: a door under an awning, windows on two floors
  const OX = BX0 + 5.4;
  S.box(tealD, OX - 2.6, yb + 1.15, BZ0 - .05, 1.3, 2.3, .12, false); S.box(mats.trim, OX - 2.6, yb + 2.4, BZ0 - .06, 1.6, .16, .16, false);
  { const aw = S.box(awnings[1], OX - 2.6, yb + 2.95, BZ0 - .8, 2.6, .1, 1.7); aw.rotation.x = .3; }
  for (const x of [OX, OX + 3]) K.pane(x, yb + 1.75, BZ0 - .02, 1.9, 1.5, 'x', x === OX);
  for (const x of [OX - 3, OX, OX + 3]) K.pane(x, yb + 5.2, BZ0 - .02, 1.9, 1.5, 'x', x !== OX);
  S.box(mats.concrete, OX - 2.6, yb + .08, BZ0 - 1, 3, .16, 2, false);
  // the loading docks: a raised platform along the front, four roller doors, a canopy over them
  const DOCKS = [303.4, 309.9, 316.4, 322.9], PX0 = 298.9, PX1 = BX1, DY = yb + 1.25, PZ = BZ0 - 3.3, pm = (PX0 + PX1) / 2;
  S.box(mats.concrete, pm, (DY + lo) / 2, (PZ + BZ0) / 2, PX1 - PX0, DY - lo, BZ0 - PZ); low(pm, (PZ + BZ0) / 2, (PX1 - PX0) / 2, (BZ0 - PZ) / 2, DY);
  S.box(mats.yellowPaint, pm, DY + .01, PZ + .16, PX1 - PX0, .04, .3, false);
  for (const x of DOCKS) {
    S.box(M.box[4], x, DY + 2.05, BZ0 - .04, 4, 4.1, .12, false); S.box(teal, x, DY + 4.22, BZ0 - .07, 4.5, .26, .18, false);
    for (const s of [-1, 1]) { S.box(teal, x + s * 2.12, DY + 2.05, BZ0 - .07, .24, 4.1, .18, false); S.box(mats.darkMetal, x + s * 1.45, DY - .42, PZ - .08, .4, .6, .18, false); }
  }
  for (let i = 0; i < 4; i++) { const top = DY - .3 * (i + 1) + .02; S.box(mats.concrete, PX0 - .32 - i * .62, (top + lo) / 2, PZ + 1.2, .64, top - lo, 2.2); }
  low(PX0 - 1.25, PZ + 1.2, 1.25, 1.1, DY - .5);
  S.box(teal, pm, yb + 6.3, BZ0 - 1.9, PX1 - PX0, .22, 4); S.box(coral, pm, yb + 6.16, BZ0 - 3.92, PX1 - PX0, .1, .06, false);
  for (const x of [PX0 + .4, pm, PX1 - .4]) { const rod = S.box(mats.darkMetal, x, yb + 7.0, BZ0 - 1.9, .06, .06, 4.2, false); rod.rotation.x = -.36; }
  for (const x of DOCKS) api.lampPts.push(V(x, yb + 6, BZ0 - 2));
  // the billboard on the roof, and the roundel on the wall that faces the coast road
  {
    const w = 12.6, h = w * 402 / 1024, x = bx + 4.5, y = yb + H + 1 + h / 2, z = BZ0 + 1.3;
    S.box(mats.darkMetal, x, y, z + .14, w + .4, h + .4, .2); for (const s of [-4.6, 0, 4.6]) { S.box(mats.darkMetal, x + s, yb + H + .6, z + .5, .18, 1.2, .18); const st = S.box(mats.darkMetal, x + s, y - .6, z + 1.5, .1, h + 2.2, .1, false); st.rotation.x = -.42; }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, h), bannerGlow); sign.position.set(x, y, z); sign.rotation.y = PI; realScene.add(sign);
    for (const s of [-4, 0, 4]) { S.box(mats.darkMetal, x + s, y + h / 2 + .34, z - .5, .07, .07, 1.1, false); S.put(rbox(.5, .16, .3, .05), mats.lampHead, x + s, y + h / 2 + .3, z - 1.05, 1, 1, 1, false); }
    const disc = new THREE.Mesh(new THREE.CircleGeometry(3, 48), logoGlow); disc.position.set(BX0 - .09, yb + 4.15, bz); disc.rotation.y = -PI / 2; realScene.add(disc);
    S.put(G.cyl, tealD, BX0 - .02, yb + 4.15, bz, 3.16, .1, 3.16, false).rotation.z = PI / 2;
  }

  // ---------- trailers backed up to docks 1 and 3 (scenery: nothing pulls them) ----------
  function trailer(x) {
    const len = 6.9, zr = PZ - .12, zc = zr - len / 2, yt = DY + .05, gy = groundY(x, zc), tall = 2.7;
    S.put(rbox(2.6, tall, len, .08), teal, x, yt + tall / 2, zc); S.box(M.box[4], x, yt + tall / 2, zr + .01, 2.4, tall - .2, .06, false);
    S.box(mats.darkMetal, x, yt - .16, zc, 1.1, .3, len - .3); S.box(mats.darkMetal, x, yt - .55, zr - .2, 2.4, .12, .12, false);
    for (const s of [-1, 1]) {
      local(new THREE.PlaneGeometry(len - .12, tall - .14), bannerLit, x + s * 1.305, yt + tall / 2, zc, s * PI / 2);
      for (const dz of [1.15, 2.45]) S.put(G.cyl, mats.tire, x + s * 1.02, gy + .5, zr - dz, .5, .36, .5).rotation.z = PI / 2;
      for (const dz of [1.15, 2.45]) S.put(G.cyl, mats.rim, x + s * 1.21, gy + .5, zr - dz, .24, .03, .24, false).rotation.z = PI / 2;
      S.box(mats.darkMetal, x + s * .7, (yt + gy) / 2, zr - len + 1.5, .12, yt - gy, .12); S.box(mats.darkMetal, x + s * .7, gy + .04, zr - len + 1.5, .34, .08, .34, false);
    }
    local(new THREE.CircleGeometry(.95, 36), std({ map: logoTex, roughness: .6, ...onTop }), x, yt + tall / 2 + .1, zr - len - .012, PI);
    solids.boxes.push({ x, z: zc, hw: 1.32, hd: len / 2, h: yt + tall });
  }
  trailer(DOCKS[0]); trailer(DOCKS[2]);

  // ---------- painted on the tarmac: truck bays, dock lanes, and the roundel in the middle of the yard ----------
  const BAYS = [];
  for (let i = 0; i <= 3; i++) S.own(K.path(mats.paint, [[320.6, 173.3 + i * 5.4], [332, 173.3 + i * 5.4]], .16, .09));
  for (let i = 0; i < 3; i++) BAYS.push([327, 176 + i * 5.4, PI]);                       // three trucks nose-out along the east fence
  for (let i = 0; i <= 4; i++) S.own(K.path(mats.yellowPaint, [[300.15 + i * 6.5, PZ - 9.5], [300.15 + i * 6.5, PZ - .2]], .16, .09));
  BAYS.push([DOCKS[1], PZ - 3.95, -PI / 2]);                                              // ...and one backed up to dock 2
  {
    const x = 305, z = 180.3, r = 5.2, n = 40, rings = 4, pos = [0, groundY(x, z) + .1, 0], uv = [.5, .5], idx = [];
    for (let k = 1; k <= rings; k++) for (let i = 0; i < n; i++) { const a = i / n * PI * 2, dx = Math.cos(a) * r * k / rings, dz = Math.sin(a) * r * k / rings; pos.push(dx, groundY(x + dx, z + dz) + .1, dz); uv.push(.5 - dx / (2 * r), .5 + dz / (2 * r)); }
    for (let i = 0; i < n; i++) idx.push(0, 1 + (i + 1) % n, 1 + i);
    for (let k = 1; k < rings; k++) for (let i = 0; i < n; i++) { const a = 1 + (k - 1) * n + i, b = 1 + (k - 1) * n + (i + 1) % n, c = a + n, d = b + n; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, std({ map: logoTex, color: 0xd9d4cc, roughness: .9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); m.position.set(x, 0, z); m.receiveShadow = true; realScene.add(m);
  }

  // ---------- the fuel island ----------
  {
    const x = 289, z = 175.4, y = groundY(x, z);
    S.box(mats.concrete, x, y + .1, z, 10.6, .24, 2.2, false); low(x, z, 5.3, 1.1, y + .3);
    S.box(teal, x, y + 4.7, z, 12.4, .5, 5.6); S.box(coral, x, y + 4.5, z, 12.46, .12, 5.66, false); S.box(cream, x, y + 4.42, z, 11.8, .06, 5, false);
    for (const s of [-4.6, 4.6]) { S.box(mats.trim, x + s, y + 2.3, z, .36, 4.4, .36); post(x + s, z, .3); }
    for (const s of [-2.2, 2.2]) { S.put(rbox(.9, 1.6, .62, .1), cream, x + s, y + 1, z); S.box(teal, x + s, y + 1.86, z, .96, .14, .68, false); S.box(mats.carGlass, x + s, y + 1.3, z - .32, .56, .36, .03, false); S.box(mats.carGlass, x + s, y + 1.3, z + .32, .56, .36, .03, false); post(x + s, z, .55); }
    P.sign('DIESEL', x, y + 4.72, z - 2.86, PI, 5.2, 1, '#fff3dc', '#0a6c6e', 150, false);
    for (const s of [-3, 0, 3]) api.lampPts.push(V(x + s, y + 4.3, z));
  }

  // ---------- the gatehouse, with its barrier up ----------
  {
    const x = SG + SGW + 3.1, z = Z0 + 3, y = groundY(x, z);
    S.box(cream, x, y + 1.35, z, 2.8, 2.7, 2.8); S.box(mats.carGlass, x, y + 1.75, z, 2.84, .9, 2.84, false); S.box(teal, x, y + 2.82, z, 3.5, .24, 3.5); S.box(coral, x, y + 2.66, z, 3.54, .08, 3.54, false);
    solids.boxes.push({ x, z, hw: 1.4, hd: 1.4, h: y + 3 });
    const bx0 = SG + SGW + .7, bz0 = Z0 + 1.5, by = groundY(bx0, bz0); S.box(coral, bx0, by + .6, bz0, .45, 1.2, .45); post(bx0, bz0, .35);
    const lean = .5, along = (d) => [bx0 - Math.sin(lean) * d, by + 1.15 + Math.cos(lean) * d];             // the arm is hinged on the post and stands open over the gateway
    { const [ax, ay] = along(2.7), arm = S.box(M.white, ax, ay, bz0, .14, 5.6, .12); arm.rotation.z = lean; }
    for (const d of [1, 2.6, 4.2]) { const [ax, ay] = along(d), band = S.box(coral, ax, ay, bz0, .16, .7, .14, false); band.rotation.z = lean; }
  }

  // ---------- yard clutter: a forklift, crates, oil drums, cones ----------
  {
    const g = P.top(299.6, groundY(299.6, 191.2), 191.2, .5), dark = mats.darkMetal;
    mesh(rbox(1.7, .75, 1.05, .12), gold, V(0, .62, 0), null, g); mesh(rbox(.5, .7, 1.05, .1), dark, V(-.72, .98, 0), null, g); mesh(rbox(.5, .12, .5, .04), dark, V(-.1, 1.05, 0), null, g, false);
    for (const z of [-.42, .42]) { mesh(G.box, dark, V(.95, 1.25, z), V(.09, 2.3, .09), g); mesh(G.box, dark, V(1.55, .16, z * .7), V(1.15, .05, .12), g, false); mesh(G.box, dark, V(-.6, 1.55, z), V(.06, 1.2, .06), g, false); mesh(G.box, dark, V(.6, 1.55, z), V(.06, 1.2, .06), g, false); }
    mesh(G.box, dark, V(0, 2.16, 0), V(1.36, .06, .96), g); mesh(G.box, dark, V(.95, 1.7, 0), V(.07, .07, .9), g, false);
    for (const [x, z] of [[.55, .56], [.55, -.56], [-.6, .56], [-.6, -.56]]) mesh(G.cyl, mats.tire, V(x, .3, z), V(.3, .22, .3), g).rotation.x = PI / 2;
    for (const [dx, dy] of [[0, 0], [0, .62]]) mesh(rbox(.9, .6, .9, .04), M.wood, V(1.6 + dx, .5 + dy, 0), null, g);
    solids.boxes.push({ x: 299.6, z: 191.2, hw: 1.3, hd: 1.1, low: true, h: groundY(299.6, 191.2) + 2.2 });
  }
  for (const [x, z, r, up = 0] of [[283, 200, 0], [284.2, 200.4, .4], [283.5, 201.6, .9], [283.6, 200.5, .2, 1], [331.4, 196, .3], [331.6, 197.4, 0], [331.5, 196.6, .5, 1], [296.2, 196.6, .1]]) K.breakable('crate', x, groundY(x, z) + up, z, r, 1, 1);
  for (const [x, z, m] of [[282, 206.5, teal], [283, 206.9, coral], [282.4, 207.6, teal], [331.8, 201, coral], [331.2, 201.8, teal]]) { S.put(G.cyl, m, x, groundY(x, z) + .55, z, .3, 1.1, .3); S.put(G.cyl, mats.darkMetal, x, groundY(x, z) + 1.11, z, .27, .03, .27, false); post(x, z, .32); }
  for (const [x, z] of [[SG - SGW + .9, Z0 + 1], [SG + SGW - 1.6, Z0 - 1.4], [X0 + .8, WG - WGW + .8], [X0 + .8, WG + WGW - .8], [311.2, 184.4], [298.8, 184.4], [319.4, 191], [319.4, 187.6]]) K.breakable('cone', x, groundY(x, z), z, 0, 1, 1);
  P.lamp(318.5, Z0 + .9, 0, 1); P.lamp(X1 - .9, 192.5, -1, 0); P.lamp(X0 + .9, 196, 1, 0);
  out.walkers.push({ cx: 306, cz: 181, hx: 15, hz: 6, n: 3 });

  // ---------- the sign at the corner: the Mouse Bear's head on a pole, turning ----------
  {
    const x = X0 + 2.8, z = Z0 + 2.4, y = groundY(x, z), size = 1.85, top = y + 8.2;
    S.put(G.cyl, mats.concrete, x, y + .3, z, 1, .6, 1); S.put(G.cyl, mats.trim, x, y + 4.2, z, .26, 7.8, .26); post(x, z, 1);
    S.put(G.cyl, teal, x, top, z, 1.25, .3, 1.25); S.put(G.cyl, coral, x, top - .22, z, 1.05, .14, 1.05, false);
    const head = mouseBearHead(); head.scale.setScalar(size); head.position.set(x, top + .15 + size * .93, z); head.rotation.y = -2.2; realScene.add(head);
    out.animated.push((dt) => { head.rotation.y += dt * MOUSEBEAR.headSpin; });
    api.lampPts.push(V(x + 1.5, top, z + 1.5));
    out.spots.mousebear = { x: CX, z: CZ, gate: { x: SG, z: Z0 }, sign: { x, z, y: top + size }, bays: BAYS, yard: MB_YARD };
  }
}
