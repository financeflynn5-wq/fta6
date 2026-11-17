// The valley north of the ridge: Palmview (houses), Flamingo Park, Coral Plaza (the mall), Marlin Bay
// (the marina), Golden Acres (farmland) and Fort Pelican (the military base), plus the four passes over
// the hills that lead there. districts.js calls buildNorth() with its own tool kit; this file owns the
// tools every northern district shares and the two quiet ones (the passes and Palmview). The bigger
// places each have a file of their own: park.js, mall.js, marina.js, farm.js, base.js.
import * as THREE from 'three';
import { V } from '../core/utils.js';
import { mats, std, G, mesh, facade, ctex } from './materials.js';
import { groundY } from './terrain.js';
import { nodeX } from './map.js';
import { roofGeo } from './props.js';
import { buildPark } from './park.js';
import { buildMall } from './mall.js';
import { buildMarina } from './marina.js';
import { buildFarm } from './farm.js';
import { buildBase } from './base.js';

const PI = Math.PI;

// Hills, hollows and bumps. Runs before the ground is drawn (districts.js shapeLand).
export function shapeNorth(F) {
  // the foothills behind the ridge
  for (const [x, z, r, h] of [[-270, 459, 24, 7], [-216, 456, 20, 5], [-108, 459, 24, 8], [-54, 462, 22, 6], [0, 459, 24, 9], [54, 462, 22, 7], [108, 459, 22, 6], [216, 459, 22, 6]]) F({ x, z, r, h });
  // Flamingo Park: the pond, the bandstand hill, a knoll or two
  F({ x: -54, z: 594, r: 36, h: -1.4, flat: .6 });
  F({ x: -126, z: 655, r: 20, h: 2.4 }); F({ x: -30, z: 527, r: 15, h: 1.5 }); F({ x: -128, z: 530, r: 16, h: 1.8 });
  // Golden Acres: rolling fields
  F({ x: -243, z: 868, r: 44, h: 3.5 }); F({ x: -90, z: 884, r: 30, h: 2.6 }); F({ x: 27, z: 850, r: 16, h: 1.6 });
}

// ---------- tools shared by the northern districts ----------
export function northKit(K) {
  const { api, scene, solids, out, P } = K, { IB, mat4 } = api;
  // A flat sheet at height y whose texture is laid out in world metres (tile = metres per copy of the texture).
  K.slab = (mat, x0, z0, x1, z1, y, tile = 6) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (cx + p.getX(i)) / tile, (cz + p.getZ(i)) / tile);
    return mesh(g, mat, V(cx, y, cz), null, scene, false);
  };
  // The same, laid over sloping ground like a cloth.
  K.drape = (mat, x0, z0, x1, z1, lift = .05, tile = 6, cell = 3) => {
    const nx = Math.max(1, Math.round((x1 - x0) / cell)), nz = Math.max(1, Math.round((z1 - z0) / cell)), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, y0 = groundY(cx, cz);
    const pos = [], uv = [], idx = [];
    for (let b = 0; b <= nz; b++) for (let a = 0; a <= nx; a++) { const x = x0 + (x1 - x0) * a / nx, z = z0 + (z1 - z0) * b / nz; pos.push(x - cx, groundY(x, z) + lift - y0, z - cz); uv.push(x / tile, z / tile); }
    for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) { const q = b * (nx + 1) + a; idx.push(q, q + nx + 1, q + 1, q + 1, q + nx + 1, q + nx + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return mesh(g, mat, V(cx, y0, cz), null, scene, false);
  };
  // A path or track `w` wide along a line of [x, z] points, following the ground.
  K.path = (mat, pts, w, lift = .06, tile = 4) => {
    const pos = [], uv = [], idx = [], ox = pts[0][0], oz = pts[0][1], oy = groundY(ox, oz); let run = 0, n = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len, segs = Math.max(1, Math.round(len / 2.5));
      for (let k = i ? 1 : 0; k <= segs; k++) {
        const s = len * k / segs, x = ax + dx * s, z = az + dz * s;
        for (const side of [-1, 1]) { const px = x - dz * side * w / 2, pz = z + dx * side * w / 2; pos.push(px - ox, groundY(px, pz) + lift - oy, pz - oz); uv.push(side > 0 ? w / tile : 0, (run + s) / tile); }
        if (n > 0) { const q = (n - 1) * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
        n++;
      }
      run += len;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return mesh(g, mat, V(ox, oy, oz), null, scene, false);
  };
  // Painted lines on flat ground (parking bays, runway numbers, courts): thin boxes in the city's shared batch.
  K.paint = (x, z, sx, sz, y, color = 0xf4f4f0, ry = 0) => IB.mark.add(mat4(V(x, y + .03, z), V(sx, .02, sz), ry), color);
  // A window on a wall. along = 'x' when the wall runs east-west. Some are lit at night.
  K.pane = (x, y, z, w, h, along, lit = K.R() < .4) => {
    IB.frame.add(mat4(V(x, y, z), along === 'x' ? V(w + .24, h + .24, .1) : V(.1, h + .24, w + .24)));
    (lit ? IB.lit : IB.win).add(mat4(V(x, y, z), along === 'x' ? V(w, h, .17) : V(.17, h, w)));
  };
  // Something a car can smash: a sheet of glass, a fence panel, a barrier. world/places.js brings them to life.
  //   glass: solid until broken; through = a car at speed bursts through it (otherwise it only shatters)
  K.breakable = (kind, x, y, z, rot, w, h, extra = {}) => out.breakables.push({ kind, x, y, z, rot, w, h, ...extra });
  // A row of fence panels between two points (kind: 'picket', 'rail' or 'link').
  K.fence = (kind, x0, z0, x1, z1, gapAt = null) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 2.6)), w = len / n, rot = Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      if (gapAt && gapAt.some(([gx, gz, gr]) => Math.hypot(x - gx, z - gz) < gr)) continue;
      K.breakable(kind, x, groundY(x, z), z, rot, w, kind === 'link' ? 2.6 : 1.1);
    }
  };
  // A round patch laid over the ground (a plaza, a clearing).
  K.disc = (mat, x, z, r, lift = .07, tile = 4, rings = 3, seg = 22) => {
    const y0 = groundY(x, z), pos = [0, lift, 0], uv = [x / tile, z / tile], idx = [];
    for (let k = 1; k <= rings; k++) for (let i = 0; i < seg; i++) { const a = i / seg * PI * 2, px = x + Math.cos(a) * r * k / rings, pz = z + Math.sin(a) * r * k / rings; pos.push(px - x, groundY(px, pz) + lift - y0, pz - z); uv.push(px / tile, pz / tile); }
    for (let i = 0; i < seg; i++) idx.push(0, 1 + (i + 1) % seg, 1 + i);
    for (let k = 1; k < rings; k++) for (let i = 0; i < seg; i++) { const a = 1 + (k - 1) * seg + i, b = 1 + (k - 1) * seg + (i + 1) % seg, c = a + seg, d = b + seg; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return mesh(g, mat, V(x, y0, z), null, scene, false);
  };
  // Nothing may be scattered along this line of [x, z] points.
  K.keepLine = (pts, r = 3.5) => { for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (r * 1.4))); for (let k = 0; k <= n; k++) K.keepOut(ax + (bx - ax) * k / n, az + (bz - az) * k / n, r); } };
  // A park bench facing direction ry (0 = toward +z).
  K.bench = (x, z, ry = 0, y = groundY(x, z)) => {
    const g = P.top(x, y, z, ry), side = Math.abs(Math.sin(ry)) > .7;
    mesh(G.box, P.M.wood, V(0, .46, 0), V(1.8, .08, .5), g); mesh(G.box, P.M.wood, V(0, .82, -.24), V(1.8, .42, .07), g);
    for (const sx of [-.75, .75]) mesh(G.box, mats.darkMetal, V(sx, .23, -.04), V(.08, .46, .5), g, false);
    solids.boxes.push({ x, z, hw: side ? .3 : .9, hd: side ? .9 : .3, low: true, h: y + 1 });
  };
  // A stone fountain: a round basin of water, a column, a bowl on top. Returns the height of the top of the bowl.
  K.fountain = (x, z, y, r = 4, tall = 2.6) => {
    mesh(G.cyl, mats.trim, V(x, y + .3, z), V(r, .6, r), scene); mesh(G.cyl, K.N.pool, V(x, y + .56, z), V(r - .35, .1, r - .35), scene, false);
    mesh(G.cyl, mats.trim, V(x, y + tall / 2, z), V(.42, tall, .42), scene); mesh(G.cyl, mats.trim, V(x, y + tall, z), V(r * .42, .3, r * .42), scene);
    mesh(G.cyl, K.N.pool, V(x, y + tall + .13, z), V(r * .42 - .2, .08, r * .42 - .2), scene, false);
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; mesh(P.G2.blob, K.N.spray, V(x + Math.cos(a) * r * .3, y + tall * .6, z + Math.sin(a) * r * .3), V(.16, tall * .55, .16), scene, false); }
    solids.posts.push({ x, z, r: r + .1 });
    return y + tall + .15;
  };
  // An entrance: two pillars and a name board across the top, readable from both sides. along = 'x' when you pass through it heading along z.
  K.gate = (name, x, z, along = 'x', span = 14, bg = '#1f6b4a', fg = '#ffd9e6') => {
    const y = groundY(x, z);
    for (const s of [-1, 1]) { const px = x + (along === 'x' ? s * span / 2 : 0), pz = z + (along === 'x' ? 0 : s * span / 2), py = groundY(px, pz); K.box(mats.trim, px, (py + y + 6.4) / 2, pz, .9, y + 6.4 - py, .9); K.box(K.N.gold, px, y + 6.6, pz, 1.2, .3, 1.2, false); K.post(px, pz, .6); }
    P.sign(name, x, y + 5.2, z, along === 'x' ? 0 : PI / 2, span - 1.2, 2.5, bg, fg, 150, true);
  };
  // Somewhere to press E outside the walk-in shops (a food cart, a food court counter): what = one of interiors.js's offers.
  K.spot = (x, z, what, r = 1.7, y = groundY(x, z)) => api.shopSpots?.push({ x, z, y, r, room: null, what });
  // One place, one weld: everything built through a site lands in the same chunk, so a whole mall or base
  // is a couple of dozen draws however many pieces it has. Positions are given in world metres as usual.
  K.site = (ox, oz) => {
    const g = P.top(ox, 0, oz);
    return {
      g, own: (m) => { g.add(m); m.position.x -= ox; m.position.z -= oz; return m; },
      box: (mat, x, y, z, sx, sy, sz, cast = true) => mesh(G.box, mat, V(x - ox, y, z - oz), V(sx, sy, sz), g, cast),
      put: (geo, mat, x, y, z, sx = 1, sy = sx, sz = sx, cast = true) => mesh(geo, mat, V(x - ox, y, z - oz), V(sx, sy, sz), g, cast),
    };
  };
  // Shop names: many boards drawn on one sheet, so twenty signs cost one texture. Returns label(name, x, y, z, ry, w, parent).
  K.atlas = (names) => {
    const rows = Math.ceil(names.length / 2), cols = ['#ff4d6d', '#3de0ff', '#ffd34d', '#7dff8a', '#ff8a3d', '#c77dff'];
    const t = ctex(1024, (x, s) => {
      const h = s / rows; x.clearRect(0, 0, s, s); x.textAlign = 'center'; x.textBaseline = 'middle';
      names.forEach((n, i) => {
        const cx = (i % 2) * s / 2, cy = Math.floor(i / 2) * h, col = cols[i % cols.length];
        x.fillStyle = 'rgba(15,16,22,.94)'; x.beginPath(); x.roundRect(cx + 5, cy + 5, s / 2 - 10, h - 10, 16); x.fill();
        let f = Math.floor(h * .56); x.font = `900 ${f}px "Archivo Black",Impact,sans-serif`; const tw = x.measureText(n).width; if (tw > s / 2 - 50) x.font = `900 ${Math.floor(f * (s / 2 - 50) / tw)}px "Archivo Black",Impact,sans-serif`;
        x.shadowColor = col; x.shadowBlur = 14; x.fillStyle = col; x.fillText(n, cx + s / 4, cy + h / 2 + 2); x.shadowBlur = 0; x.globalAlpha = .5; x.fillStyle = '#fff'; x.fillText(n, cx + s / 4, cy + h / 2 + 2); x.globalAlpha = 1;
      });
    });
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: .08 }); api.signMats.push(mat);
    return (name, x, y, z, ry, w, parent = scene) => {
      const i = Math.max(0, names.indexOf(name)), g = new THREE.PlaneGeometry(w, w * 2 / rows), uv = g.attributes.uv, u0 = (i % 2) / 2, v1 = 1 - Math.floor(i / 2) / rows;
      for (let k = 0; k < 4; k++) uv.setXY(k, u0 + uv.getX(k) / 2, v1 - (1 - uv.getY(k)) / rows);
      const off = parent === scene ? [0, 0] : [parent.position.x, parent.position.z], m = mesh(g, mat, V(x - off[0], y, z - off[1]), null, parent, false); m.rotation.y = ry; return m;
    };
  };
  // materials every northern district shares (few of them, so welded meshes stay few)
  const stripes = (bg, line, n, wide = 3) => ctex(128, (x, s) => { x.fillStyle = bg; x.fillRect(0, 0, s, s); x.fillStyle = line; for (let i = 0; i < n; i++) x.fillRect(i * s / n, 0, wide, s); });
  K.N = {
    roofs: [0xc9684a, 0x5d6772, 0xe6d8bf, 0x8f4a3a].map(c => std({ color: c, roughness: .8 })),
    door: std({ color: 0x7a4a2f, roughness: .7 }), pool: std({ color: 0x45c4dc, roughness: .08, metalness: .1, emissive: 0x0c4a58, emissiveIntensity: .5 }),
    gravel: std({ color: 0xe6d6b4, roughness: .95 }), dirt: std({ color: 0xb48a5e, roughness: 1 }), soil: std({ map: stripes('#8a6243', 'rgba(40,25,12,.45)', 16, 4), color: 0xffffff, roughness: 1 }),
    olive: std({ color: 0x6f7752, roughness: .8 }), tan: std({ color: 0xc8b88e, roughness: .85 }), navy: std({ color: 0x1f3a66, roughness: .5 }),
    pink: std({ color: 0xff7fa6, roughness: .6 }), gold: std({ color: 0xe2b860, roughness: .3, metalness: .8 }),
    spray: std({ color: 0xe6fbff, roughness: .2, transparent: true, opacity: .55, depthWrite: false }), hedge: std({ color: 0x3f7f43, roughness: 1 }),
    flowers: [0xff5d7a, 0xffd34d, 0xc77dff, 0xffffff].map(c => std({ color: c, roughness: .8 })),
    stripes,
  };
  return K;
}

export function buildNorth(K) {
  northKit(K);
  const { api, scene, out, P, M, G2, R, rr, one, box, solid, post, scatter, keepOut, N } = K;

  // =====================================================================================
  // THE PASSES: four roads over the ridge, foothills on the far side
  // =====================================================================================
  for (const [name, x] of [['COYOTE PASS', -162], ['PELICAN PASS', 162]]) {
    const y = groundY(x, 378);
    P.sign(name, x, y + 7.4, 378, 0, 17, 3.4, '#14244f', '#ffd34d', 150, true);
    for (const sx of [-8.6, 8.6]) { box(mats.trim, x + sx, y + 4.2, 378, .5, 8.6, .5); post(x + sx, 378, .4); }
  }
  scatter(90, -317, 438, 262, 480, (x, z) => P.tree(x, z, rr(1, 1.6)));
  scatter(26, -317, 438, 262, 480, (x, z) => P.rock(x, z, rr(.8, 2.2)));
  scatter(30, -317, 438, 262, 480, (x, z) => P.bush(x, z, rr(.8, 1.4)));
  scatter(40, -330, 384, 300, 430, (x, z) => P.rock(x, z, rr(1, 3)));
  scatter(24, -330, 384, 300, 430, (x, z) => P.tree(x, z, rr(1, 1.5)));

  // =====================================================================================
  // PALMVIEW: four streets of houses with driveways, lawns, pools and picket fences
  // =====================================================================================
  // A house facing (fx, fz). style 0 = bungalow, 1 = two storeys, 2 = long ranch.
  function home(x, z, fx, fz, style, toRoad = 10) {
    const ry = Math.atan2(fx, fz), c = Math.cos(ry), s = Math.sin(ry);
    const W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];           // local (right, front) -> world
    const wide = [9.4, 8.2, 12][style], deep = [7.6, 7.8, 6.4][style], tall = [3, 5.8, 2.9][style], bx = style === 2 ? 0 : -2.1;
    const reach = style === 2 ? 6.2 : 7;
    let y = -1e9, lo = 1e9; for (const [a, b] of [[-reach, -deep / 2], [reach, -deep / 2], [-reach, deep / 2 + 2], [reach, deep / 2 + 2]]) { const [wx, wz] = W(a, b), gy = groundY(wx, wz); y = Math.max(y, gy); lo = Math.min(lo, gy); }
    y += .12;
    const g = P.top(x, y, z, ry), fm = one(facade), roof = one(N.roofs);
    const put = (geo, mat, lx, ly, lz, sx, sy, sz, cast = true) => mesh(geo, mat, V(lx, ly, lz), sx === undefined ? null : V(sx, sy, sz), g, cast);
    const hard = (lx, lz, w, d) => { const [wx, wz] = W(lx, lz); solid(wx, wz, (fx ? d : w) / 2, (fx ? w : d) / 2); };
    const win = (lx, ly, lz, w, h, side) => { const [wx, wz] = W(lx, lz); K.pane(wx, y + ly, wz, w, h, (side === 0) === !fx ? 'x' : 'z'); };
    // the main block, its footing and its roof (ridge along the street)
    put(G.box, fm, bx, tall / 2, 0, wide, tall, deep); put(G.box, mats.trim, bx, -(y - lo) / 2 + .1, 0, wide + .3, y - lo + .7, deep + .3); hard(bx, 0, wide, deep);
    const rg = put(roofGeo(deep + 1.5, style === 1 ? 2.7 : 2.2, wide + 1.2), roof, bx, tall, 0); rg.rotation.y = PI / 2;
    if (style === 1) put(G.box, mats.trim, bx, 3, 0, wide + .16, .22, deep + .16, false);
    put(G.box, mats.trim, bx - wide / 2 + 1.6, tall + 1.9, -.6, .75, 1.7, .75);                    // chimney
    // door, porch and the path to the street
    const dx = style === 2 ? .4 : bx - .9, front = deep / 2;
    put(G.box, N.door, dx, 1.15, front + .04, 1.1, 2.1, .1, false); put(G.box, mats.trim, dx, 2.3, front + .05, 1.4, .16, .14, false);
    put(G.box, mats.trim, dx, .1, front + .9, 3.4, .2, 1.8, false);
    for (const o of [-1.5, 1.5]) put(G.box, M.white, dx + o, 1.3, front + 1.65, .16, 2.4, .16);
    const pr = put(G.box, roof, dx, 2.62, front + .95, 3.9, .14, 2.1); pr.rotation.x = .13;
    // garage: beside the house, or built into the ranch
    const gx = style === 2 ? 3.9 : bx + wide / 2 + 2, gz = style === 2 ? front : front - .5;
    if (style !== 2) {
      put(G.box, fm, gx, 1.4, gz - 3, 4, 2.8, 6); put(G.box, roof, gx, 2.92, gz - 3, 4.5, .24, 6.5); put(G.box, mats.trim, gx, -(y - lo) / 2 + .1, gz - 3, 4.2, y - lo + .7, 6.2); hard(gx, gz - 3, 4, 6);
    }
    put(G.box, M.box[4], gx, 1.12, gz + .04, 3.2, 2.2, .1, false);
    // windows: front, back, sides (an upper row on the two-storey house)
    for (const ly of style === 1 ? [1.7, 4.4] : [1.7]) {
      for (const o of style === 2 ? [-4.2, -1.9] : [1.9]) win(bx + o, ly, front, 1.8, 1.3, 0);
      if (ly > 2) win(dx, ly, front, 1.4, 1.3, 0);
      for (const o of [-2.4, 2.4]) { const [wx, wz] = W(bx + o, -front); K.pane(wx, y + ly, wz, 1.6, 1.2, fx ? 'z' : 'x'); }
      for (const sd of [-1, 1]) if (style === 2 || sd < 0 || ly > 3) { const [wx, wz] = W(bx + sd * wide / 2, 0); K.pane(wx, y + ly, wz, 1.6, 1.2, fx ? 'x' : 'z'); }
    }
    if (style === 2) {            // the ranch's front wing
      put(G.box, fm, -3.9, 1.45, front + 1.9, 4.4, 2.9, 3.8); put(roofGeo(5.4, 1.8, 4.6), roof, -3.9, 2.9, front + 1.9); hard(-3.9, front + 1.9, 4.4, 3.8);
      win(-3.9, 1.7, front + 3.8, 2, 1.3, 0);
    }
    // driveway and path, laid on the ground
    const edge = toRoad, [d0x, d0z] = W(gx, gz + .2), [d1x, d1z] = W(gx, edge), [p0x, p0z] = W(dx, front + 1.8), [p1x, p1z] = W(dx, edge);
    K.path(mats.concrete, [[d0x, d0z], [d1x, d1z]], 3.6, .05, 6); K.path(mats.concrete, [[p0x, p0z], [p1x, p1z]], 1.3, .05, 6);
    // mailbox
    { const [mx, mz] = W(gx - 2.6, edge - .7), my = groundY(mx, mz); box(mats.darkMetal, mx, my + .5, mz, .08, 1, .08, false); box(R() < .5 ? M.red : M.white, mx, my + 1.08, mz, .26, .22, .26, false); }
    return { W, y, gx, gz, dx, front, edge, wide, deep, bx, ry };
  }

  const styles = [0, 0, 1, 1, 2];
  for (let ci = 1; ci <= 3; ci++) for (let cj = 16; cj <= 19; cj++) {
    const bx = nodeX(ci) + 27, bz = nodeX(cj) + 27, alongX = (ci + cj) % 2 === 0;       // which street this block's houses face
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const lx = bx + sx * 10, lz = bz + sz * 10, roll = R();
      if (ci === 2 && cj === 17 && sx < 0 && sz > 0) continue;                           // the playground (below)
      if (ci === 2 && cj === 18 && sx > 0 && sz < 0) continue;                           // the basketball court
      if (roll > .86) {                     // an empty lot: trees and a bench
        for (let k = 0; k < 3; k++) P.tree(lx + rr(-6, 6), lz + rr(-6, 6), rr(.9, 1.3));
        P.bush(lx + rr(-5, 5), lz + rr(-5, 5), rr(.9, 1.3)); keepOut(lx, lz, 10); continue;
      }
      const fx = alongX ? 0 : sx, fz = alongX ? sz : 0;
      const h = home(lx, lz, fx, fz, styles[Math.floor(R() * styles.length)]);
      keepOut(lx, lz, 10.5);
      // what's in the garden
      if (R() < .45) { const [cx, cz] = h.W(h.gx, h.gz + 3.6); out.parked.push([one(['car', 'car', 'car', 'van', 'sport', 'bike', 'limo', 'taxi']), cx, cz, Math.atan2(fz, fx) + (R() < .5 ? PI : 0)]); }
      if (R() < .7) { const [tx, tz] = h.W(h.bx + rr(-6, -3.2), h.front + rr(4.6, 5.4)); P.tree(tx, tz, rr(.8, 1.1)); }
      for (const o of [-3.6, 3.4]) if (R() < .7) { const [qx, qz] = h.W(h.bx + o, h.front + .9); P.bush(qx, qz, rr(.6, .9)); }
      const back = -h.deep / 2 - 3.2;
      if (R() < .3) {                       // a pool out the back
        const [qx, qz] = h.W(h.bx + .5, back), py = groundY(qx, qz), w = fx ? 3.2 : 6.2, d = fx ? 6.2 : 3.2;
        box(mats.trim, qx, py + .08, qz, w + .9, .22, d + .9, false); box(N.pool, qx, py + .11, qz, w, .22, d, false);
        const [ux, uz] = h.W(h.bx + 5, back + .4); P.umbrella(ux, uz);
      } else if (R() < .5) { const [ux, uz] = h.W(h.bx + rr(-2, 3), back); P.umbrella(ux, uz); if (R() < .6) { const [tx, tz] = h.W(h.bx - 4, back - .6); P.tree(tx, tz, rr(.8, 1.1)); } }
      if (R() < .42) {                      // a picket fence along the front, open at the drive and the path
        const [ax, az] = h.W(-9.4, h.edge - .4), [ex, ez] = h.W(9.4, h.edge - .4), [g1x, g1z] = h.W(h.gx, h.edge - .4), [g2x, g2z] = h.W(h.dx, h.edge - .4);
        K.fence('picket', ax, az, ex, ez, [[g1x, g1z, 2.5], [g2x, g2z, 1.3]]);
      }
    }
    out.walkers.push({ cx: bx, cz: bz, hx: 21.5, hz: 21.5, n: R() < .7 ? 1 : 2 });
    // a car or two at the kerb
    if (R() < .6) out.parked.push([one(['car', 'car', 'van', 'taxi']), bx + rr(-7, 7), nodeX(cj) + 5.6, 0]);
    if (R() < .4) out.parked.push([one(['car', 'car', 'sport', 'bike']), nodeX(ci) + 5.6, bz + rr(-7, 7), -PI / 2]);
  }
  // the playground: a slide, swings, a sandpit and a roundabout
  {
    const x = nodeX(2) + 17, z = nodeX(17) + 37, y = groundY(x, z);
    K.drape(N.gravel, x - 9, z - 9, x + 9, z + 9, .06, 4);
    for (const sx of [-1, 1]) { const leg = box(M.red, x - 4 + sx * 1.6, y + 1.2, z - 4, .12, 2.6, .12); leg.rotation.z = sx * .22; const leg2 = box(M.red, x - 4 + sx * 1.6, y + 1.2, z - 1, .12, 2.6, .12); leg2.rotation.z = sx * .22; }
    box(M.red, x - 4, y + 2.4, z - 2.5, .14, .14, 3.4); for (const o of [-3.3, -1.7]) { box(mats.darkMetal, x - 4, y + 1.5, z + o, .03, 1.7, .03, false); box(M.box[1], x - 4, y + .62, z + o, .5, .06, .22, false); }
    box(M.box[3], x + 4, y + 1.7, z + 4.4, 1.3, .14, 1.3); for (const [a, b] of [[-.55, -.55], [.55, -.55], [-.55, .55], [.55, .55]]) box(mats.darkMetal, x + 4 + a, y + .85, z + 4.4 + b, .1, 1.7, .1, false);
    const chute = box(M.box[1], x + 4, y + .95, z + 2.2, .9, .08, 3.4); chute.rotation.x = -.5; post(x + 4, z + 4.4, .9);
    mesh(G.cyl, M.box[2], V(x + 3.5, y + .45, z - 4), V(1.5, .12, 1.5), scene); mesh(G.cyl, mats.darkMetal, V(x + 3.5, y + .3, z - 4), V(.12, .6, .12), scene); post(x + 3.5, z - 4, 1.4);
    box(mats.trim, x - 4.5, y + .1, z + 4.5, 4.4, .24, 4.4, false); box(mats.concrete, x - 4.5, y + .13, z + 4.5, 3.9, .24, 3.9, false);
    for (const [a, b] of [[-8, -8], [8, -8], [8, 8]]) P.tree(x + a, z + b, rr(.9, 1.2));
    keepOut(x, z, 11); out.spots.playground = { x, z };
  }
  // the basketball court
  {
    const x = nodeX(2) + 37, z = nodeX(18) + 17, y = groundY(x, z) + .08;
    box(mats.concrete, x, y - .06, z, 17, .3, 10.4, false); box(N.navy, x, y + .1, z, 16, .03, 9.4, false);
    for (const [px, pz, sx, sz] of [[0, 4.6, 16, .12], [0, -4.6, 16, .12], [7.94, 0, .12, 9.3], [-7.94, 0, .12, 9.3], [0, 0, .12, 9.3], [5.6, 0, .12, 3.6], [-5.6, 0, .12, 3.6]]) K.paint(x + px, z + pz, sx, sz, y + .1);
    for (const s of [-1, 1]) { box(mats.darkMetal, x + s * 8.4, y + 1.6, z, .16, 3.2, .16); box(M.white, x + s * 7.9, y + 3.2, z, .08, 1.1, 1.8); box(M.red, x + s * 7.6, y + 2.95, z, .5, .04, .5, false); post(x + s * 8.4, z, .2); }
    keepOut(x, z, 11); out.spots.court = { x, z };
  }

  // the bigger places
  buildPark(K); buildMall(K); buildMarina(K); buildFarm(K); buildBase(K);
}
