// Buildings you can walk into. Each one is an ordinary downtown building whose ground floor has been
// opened up after the city was built: the solid block is swapped for four walls with a doorway and a
// glass front, and a room is fitted inside (floor, ceiling, lights, furniture, someone behind the counter).
// There is no loading screen and no separate "inside" world: it is all part of the street.
//   buildInteriors()   the rooms themselves (city.js calls it while the city is still being put together)
//   createInteriors()  what you can do in them: the E key, the people, hold-ups, the lift (main.js)
import * as THREE from 'three';
import { V, seeded, angleDiff } from '../core/utils.js';
import { RESPAWN, INDOORS, COMBAT, WEAPONS } from '../config.js';
import { mats, std, G, mesh, rbox, ctex } from './materials.js';
import { bakeStatic, plainGeometry } from './batching.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { frontage } from './landmarks.js';
import { addRibbon, groundY } from './terrain.js';
import { makeWeapon } from '../combat/weaponModels.js';
import { makeCharacter, animateCharacter } from '../characters/models.js';

// Where they are. block / corner pick the building (as in city.js), face is the side its door is on.
// landmark: the building landmarks.js hangs that sign on, whichever it turns out to be.
// at: a shop out in the districts, which gets a building of its own at [x, z] (size = [wide, deep, tall]).
// New shops go at the end of the list: the rooms roll their furniture from one set of dice, in this order.
const SHOPS = [
  { id: 'mart', name: '24/7 MART', kind: 'mart', block: [-1, -1], corner: [-1, 1], face: [-1, 0], who: 'possum' },
  { id: 'tower', name: 'SUNSET TOWER', kind: 'lobby', block: [0, 0], corner: [-1, -1], face: [0, -1], who: 'tess' },
  { id: 'noodle', name: 'NOODLE HUT', kind: 'diner', block: [0, -1], corner: [-1, 1], face: [0, 1], who: 'raccoon', tint: 0xd9412f },
  { id: 'pawn', name: "PAWSUM'S PAWN", kind: 'pawn', block: [-1, 0], corner: [1, -1], face: [0, -1], who: 'possum' },
  { id: 'arcade', name: 'ARCADE', kind: 'arcade', block: [-1, 0], corner: [-1, -1], face: [-1, 0], who: 'tiff' },
  { id: 'motel', name: 'MOTEL', kind: 'motel', block: [0, -1], corner: [1, -1], face: [1, 0], who: 'sal' },
  { id: 'laundry', name: 'LAUNDRO-MAT', kind: 'laundry', block: [-1, -1], corner: [1, 1], face: [1, 0], who: 'scrap' },
  { id: 'donut', name: 'DONUT HOLE', kind: 'diner', block: [-2, -1], corner: [1, 1], face: [1, 0], who: 'possum', tint: 0xff7fae },
  { id: 'taco', name: 'TACO CRAB', kind: 'diner', block: [1, 0], corner: [-1, -1], face: [-1, 0], who: 'bighead', tint: 0x2fa89a },
  { id: 'crab', name: 'CRAB SHACK', kind: 'diner', block: [0, 1], corner: [-1, -1], face: [0, -1], who: 'scrap', tint: 0x3e6fd6 },
  { id: 'hospital', name: 'SUNSET GENERAL', kind: 'clinic', landmark: 'hospital', who: 'tess' },
  { id: 'station', name: 'SUNSET PD', kind: 'police', landmark: 'station', who: 'dale' },
  { id: 'guns', name: 'BULLSEYE GUNS', kind: 'guns', block: [-2, -1], corner: [1, -1], face: [1, 0], who: 'scrap', sign: '#ff8a3d' },
  { id: 'gunsNorth', name: 'BULLSEYE GUNS', kind: 'guns', at: [58, 678], size: [15, 13, 7.6], face: [0, -1], who: 'dale', sign: '#ff8a3d' },
  { id: 'valleyDiner', name: 'VALLEY DINER', kind: 'diner', at: [100, 678], size: [14, 13, 7.6], face: [0, -1], who: 'possum', tint: 0x2f9c8f, sign: '#3de0ff' },
];
const T = .3, H = 4.6, DOOR = 2.6, CEIL = 4.0;      // wall thickness, ground-floor height, doorway width, ceiling height

// ---------- materials (made once, when the first room is built) ----------
let M = null;
function materials() {
  if (M) return M;
  // Rooms glow a little by themselves, so they read as lit from the street at night.
  // Every plain colour in a room is drawn by one of two shared materials, with the colour stored in the mesh:
  // `lit` things glow faintly, `glowing` things (screens, light panels) shine. That keeps a whole room to a few draws.
  const inColour = (o) => { const mat = std({ color: 0xffffff, vertexColors: true, ...o }); mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;'); }; return mat; };
  const litVC = inColour({ roughness: .8, emissive: 0xffffff, emissiveIntensity: .2 }), glowVC = inColour({ roughness: .4, emissive: 0xffffff, emissiveIntensity: 2 });
  const lit = (color) => ({ vc: litVC, color: new THREE.Color(color) });
  const tiles = (a, b, n = 8) => { const t = ctex(256, (x, s) => { const c = s / 2; x.fillStyle = a; x.fillRect(0, 0, s, s); x.fillStyle = b; x.fillRect(0, 0, c, c); x.fillRect(c, c, c, c); }); t.repeat.set(n, n); return t; };
  const planks = (a, b) => { const t = ctex(256, (x, s) => { x.fillStyle = a; x.fillRect(0, 0, s, s); x.strokeStyle = b; x.lineWidth = 3; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(0, i * s / 8); x.lineTo(s, i * s / 8); x.stroke(); } for (let i = 0; i < 8; i++) { const o = (i % 2) * s / 2 + s / 4; x.beginPath(); x.moveTo(o, i * s / 8); x.lineTo(o, (i + 1) * s / 8); x.stroke(); } }); t.repeat.set(5, 5); return t; };
  const floor = (map) => std({ map, color: 0xffffff, roughness: .55, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .16 });
  const glowing = (c, k = 2.2) => ({ vc: glowVC, color: new THREE.Color(c).multiplyScalar(k / 2) });
  M = {
    lit,
    glass: std({ color: 0xcfe6ee, roughness: .04, metalness: .2, transparent: true, opacity: .2, depthWrite: false }),
    ceiling: lit(0xf4efe6), panel: glowing(0xfff1d6, 2.6), white: lit(0xf7f4ee), cream: lit(0xefe4cf), dark: lit(0x2b2f38),
    steel: std({ color: 0xb9c0c8, roughness: .35, metalness: .7, emissive: 0xb9c0c8, emissiveIntensity: .08 }), wood: lit(0x9a6a44), darkWood: lit(0x5e3f2a),
    gold: std({ color: 0xe2b860, roughness: .3, metalness: .8, emissive: 0xe2b860, emissiveIntensity: .12 }), plant: lit(0x3f9a4a), pot: lit(0xc9703f),
    floors: {
      mart: floor(tiles('#eef0ee', '#cfd8d6')), diner: floor(tiles('#f3ede2', '#2b2f38')), lobby: floor(tiles('#f1e7d2', '#d9c49a', 4)), pawn: floor(planks('#8a5f3c', '#5e3f2a')),
      arcade: floor(tiles('#2a2147', '#3a2d63', 10)), motel: floor(planks('#b08a5c', '#7d5f3c')), laundry: floor(tiles('#dfeaf0', '#9fc3d6')), clinic: floor(tiles('#f2f6f5', '#d5e6e2')), police: floor(tiles('#dfe3ea', '#aab4c6')), guns: floor(planks('#6b6f66', '#3f433c')),
    },
    walls: { mart: lit(0xe8f1ee), diner: lit(0xf6ead6), lobby: lit(0xf3e9d8), pawn: lit(0xd9c7a6), arcade: lit(0x1d1a33), motel: lit(0xf0d9b8), laundry: lit(0xdcecf4), clinic: lit(0xeef6f3), police: lit(0xdde3ee), guns: lit(0xd8d2c0) },
    accent: { mart: lit(0x2f8f83), lobby: lit(0xc9a45a), pawn: lit(0x7a4a2a), arcade: lit(0xff4d8d), motel: lit(0xe8455b), laundry: lit(0x3e8fd6), clinic: lit(0xe8455b), police: lit(0x24408f), guns: lit(0xc7622a) },
    goods: [0xff4d6d, 0xffd34d, 0x3de0ff, 0x7dff8a, 0xff8a3d, 0xc77dff, 0xffffff, 0x4d7dff].map(c => lit(c)),
    screens: [0x3de0ff, 0xff4d8d, 0x7dff8a, 0xffd34d, 0xc77dff, 0xff8a3d].map(c => glowing(c, 1.8)),
    cool: glowing(0xcdefff, 1.1), red: glowing(0xff3b4f, 1.6), green: glowing(0x5dff8a, 1.6), tints: new Map(),
  };
  return M;
}
const tinted = (c) => { const m = materials(); if (!m.tints.has(c)) m.tints.set(c, m.lit(c)); return m.tints.get(c); };

function towerSign(name = 'SUNSET TOWER', col = '#ffd34d') {
  const t = ctex(512, (x, s) => {
    x.clearRect(0, 0, s, s); x.fillStyle = 'rgba(15,16,22,.92)'; x.beginPath(); x.roundRect(8, s * .3, s - 16, s * .4, 30); x.fill();
    x.font = '900 58px "Archivo Black",Impact,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const tw = x.measureText(name).width; if (tw > s - 60) x.font = `900 ${Math.floor(58 * (s - 60) / tw)}px "Archivo Black",Impact,sans-serif`;
    x.shadowColor = col; x.shadowBlur = 24; x.fillStyle = col; x.fillText(name, s / 2, s / 2);
    x.shadowBlur = 0; x.fillStyle = '#fff'; x.globalAlpha = .55; x.fillText(name, s / 2, s / 2);
  });
  return new THREE.MeshBasicMaterial({ map: t, transparent: true });
}

// ---------- building the rooms ----------
export function buildInteriors(api) {
  const { scene, realScene, solids, lots, signMats, signNames, skyline, building } = api, m = materials(), r = seeded(3301);
  const named = new Map();        // signs made for shops that are not in the city's own set, one per name
  const _mx = new THREE.Matrix4(), _q = new THREE.Quaternion();
  const rooms = [], spots = [];
  for (const shop of SHOPS) {
    // which building is it?
    let lot = null, face = shop.face;
    if (shop.landmark) {
      const def = RESPAWN[shop.landmark], f = frontage(solids.boxes, def.block, def.side); if (!f) continue;
      face = def.side;
      lot = lots.find(l => Math.abs(l.x + face[0] * (l.w / 2 + .1) - f.fx) < .05 && Math.abs(l.z + face[1] * (l.d / 2 + .1) - f.fz) < .05);
    } else if (shop.at) {
      const [x, z] = shop.at, [w, d, h] = shop.size, ys = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => groundY(x + a * w / 2, z + b * d / 2)), y = Math.max(...ys) + .12;
      building(x, z, w, d, h, false, y, false); lot = lots[lots.length - 1];
      if (y - Math.min(...ys) > .2) mesh(G.box, mats.trim, V(x, (y + Math.min(...ys)) / 2 - .5, z), V(w + .2, y - Math.min(...ys) + 1, d + .2), scene);
    } else {
      const cx = 27 + 54 * shop.block[0] + shop.corner[0] * 9, cz = 27 + 54 * shop.block[1] + shop.corner[1] * 9;
      lot = lots.find(l => Math.abs(l.x - cx) < 5 && Math.abs(l.z - cz) < 5);
    }
    if (!lot || lot.box.hollow) continue;                    // a little park stands there instead, or it is taken
    const [fx, fz] = face, key = fx + ',' + fz, L = fx ? lot.d : lot.w, D = fx ? lot.w : lot.d, rx = -fz, rz = fx;

    // open the building up
    lot.g.remove(lot.base); if (lot.fronts[key]) lot.g.remove(lot.fronts[key]); if (lot.signs[key]) lot.g.remove(lot.signs[key]);
    lot.box.hollow = true;
    const g = new THREE.Group(); g.position.set(lot.x, lot.y, lot.z); scene.add(g);
    // (a, b): a = metres along the front (0 = the door), b = metres back from the front wall
    const P = (a, y, b) => V(fx * (D / 2 - b) + rx * a, y, fz * (D / 2 - b) + rz * a);
    const S = (sa, sy, sb) => fx ? V(sb, sy, sa) : V(sa, sy, sb);
    // The walls and frames join the city's own welded meshes (seen from far off). What is inside is welded into a few
    // meshes of this room's own, which are only drawn while you are near (createInteriors hides them beyond that).
    const inner = new THREE.Group(); inner.position.copy(g.position); const coloured = new Map();
    const put = (mat, a, y, b, sa, sy, sb, cast = false, geo = G.box) => {
      if (mat === mats.trim || mat === mats.darkMetal) return mesh(geo, mat, P(a, y, b), S(sa, sy, sb), g, cast);
      if (!mat.vc) return mesh(geo, mat, P(a, y, b), S(sa, sy, sb), inner, false);
      const geom = plainGeometry(geo, _mx.compose(P(a, y, b).add(g.position), _q, S(sa, sy, sb))), n = geom.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = mat.color.r; col[i * 3 + 1] = mat.color.g; col[i * 3 + 2] = mat.color.b; }
      geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
      if (!coloured.has(mat.vc)) coloured.set(mat.vc, []); coloured.get(mat.vc).push(geom);
    };
    const world = (a, b) => { const p = P(a, 0, b); return { x: lot.x + p.x, z: lot.z + p.z }; };
    const wall = (a, b, sa, sb, h) => { const p = world(a, b), wx = fx ? sb : sa, wz = fx ? sa : sb; solids.walls.push({ x: p.x, z: p.z, hl: Math.max(wx, wz) / 2, ht: Math.min(wx, wz) / 2, rot: wx >= wz ? 0 : Math.PI / 2, kind: 'solid', h }); };
    // something you bump into but can see (and shoot) over
    const solid = (a, b, sa, sb, h = 1.1) => { const p = world(a, b); solids.boxes.push({ x: p.x, z: p.z, hw: (fx ? sb : sa) / 2, hd: (fx ? sa : sb) / 2, low: true, h: lot.y + h, wall: true }); };
    const block = (mat, a, y, b, sa, sy, sb, h = sy) => { put(mat, a, y + sy / 2, b, sa, sy, sb); solid(a, b, sa, sb, y + h); };

    // --- shell: back and side walls, a glass front with a doorway, floor and ceiling
    put(mats.trim, 0, H / 2, D - T / 2, L, H, T, true); wall(0, D - T / 2, L, T);
    for (const s of [-1, 1]) { put(mats.trim, s * (L / 2 - T / 2), H / 2, D / 2, T, H, D, true); wall(s * (L / 2 - T / 2), D / 2, T, D); }
    const seg = (L - DOOR) / 2;
    for (const s of [-1, 1]) {
      const ac = s * (DOOR / 2 + seg / 2);
      put(mats.trim, ac, .35, T / 2, seg, .7, T, true); put(m.glass, ac, 1.95, T / 2, seg - T, 2.5, .06); put(mats.trim, ac, 3.9, T / 2, seg, 1.4, T, true);
      put(mats.darkMetal, s * (DOOR / 2 + .07), 1.6, T / 2, .14, 3.2, T + .04); put(mats.darkMetal, ac, 3.16, T / 2, seg, .1, T + .04); put(mats.darkMetal, ac, .74, T / 2, seg, .08, T + .04);
      for (let k = 1; k * 2.4 < seg; k++) put(mats.darkMetal, s * (DOOR / 2 + k * 2.4), 1.95, T / 2, .08, 2.5, .1);
      wall(ac, T / 2, seg, T, 1.2);                               // low: you can be seen (and shot at) through the glass
      put(m.glass, s * (DOOR / 2 - .04), 1.4, T + .62, .05, 2.6, 1.2); put(mats.darkMetal, s * (DOOR / 2 - .04), 2.72, T + .62, .07, .06, 1.2);   // the doors stand open
    }
    put(mats.trim, 0, 3.675, T / 2, DOOR, 1.85, T, true); put(mats.darkMetal, 0, 2.76, T / 2, DOOR, .1, T + .04);
    put(m.floors[shop.kind], 0, .025, D / 2, L - T * 2, .05, D - T * 2); put(m.dark, 0, .06, .95, 2.2, .03, 1.3);
    put(m.ceiling, 0, CEIL + .08, D / 2, L - T * 2, .16, D - T * 2);
    for (const a of [-L / 4, L / 4]) for (const b of [D * .3, D * .7]) put(m.panel, a, CEIL - .02, b, 1.8, .05, .6);
    const wm = m.walls[shop.kind], ac = shop.tint ? tinted(shop.tint) : m.accent[shop.kind];
    put(wm, 0, CEIL / 2, D - T - .02, L - T * 2, CEIL, .04); put(ac, 0, 1.05, D - T - .05, L - T * 2, .16, .04);
    for (const s of [-1, 1]) { put(wm, s * (L / 2 - T - .02), CEIL / 2, D / 2, .04, CEIL, D - T * 2); put(ac, s * (L / 2 - T - .05), 1.05, D / 2, .04, .16, D - T * 2); }

    // its own sign over the door (the landmarks hang theirs themselves)
    if (!shop.landmark) {
      const i = signNames.indexOf(shop.name); let sm = i >= 0 ? signMats[i] : named.get(shop.name);
      if (!sm) { sm = shop.sign ? towerSign(shop.name, shop.sign) : towerSign(); named.set(shop.name, sm); signMats.push(sm); }
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), sm);
      sign.position.copy(P(0, 5.9, -.08)); sign.rotation.y = Math.atan2(fx, fz); g.add(sign);
    }

    // --- what is in it
    const extra = [], hw = L / 2 - T, room = { ...shop, x: lot.x, z: lot.z, y: lot.y, hw: lot.w / 2, hd: lot.d / 2, face: [fx, fz], door: world(0, -.9), clerk: null, light: { ...world(0, D / 2), y: lot.y + 3.4 }, till: 0 };
    const clerkAt = (a, b, da, db) => { const p = world(a, b), dx = rx * da - fx * db, dz = rz * da - fz * db; room.clerk = { ...p, face: Math.atan2(dx, dz), kind: shop.who }; };
    const spot = (a, b, what, rad = 1.5) => spots.push({ ...world(a, b), y: lot.y, r: rad, room, what });
    const counter = (a, b, sa, sb, top = m.steel, body = ac) => { block(body, a, 0, b, sa, 1.02, sb, 1.1); put(top, a, 1.06, b, sa + .12, .08, sb + .12); };
    const plant = (a, b) => { put(m.pot, a, .3, b, .55, .6, .55); put(m.plant, a, 1.15, b, .9, 1.2, .9, false, G.sph); solid(a, b, .5, .5, 1); };
    const stool = (a, b, c = m.red) => { put(m.steel, a, .35, b, .08, .7, .08, false, G.cyl); put(c, a, .74, b, .24, .1, .24, false, G.cyl); };

    if (shop.kind === 'mart') {
      counter(-hw + 1.9, 3.3, .85, 3.6); clerkAt(-hw + .75, 3.3, 1, 0); spot(-hw + 3.1, 3.3, 'mart');
      put(m.dark, -hw + 1.9, 1.3, 2.3, .5, .42, .45); put(m.screens[2], -hw + 2.16, 1.36, 2.3, .03, .26, .32);      // the till
      // three runs of shelves down the room, stocked in stripes
      const len = D - 7.2;
      for (const a of [-hw + 5, -hw + 7.6, -hw + 10.2].filter(a => a < hw - 1.4)) {
        block(m.white, a, 0, 4 + len / 2, .95, 1.7, len);
        for (let k = 0; k < 3; k++) for (let j = 0; j < Math.floor(len / 1.1); j++) put(m.goods[Math.floor(r() * m.goods.length)], a, .42 + k * .5, 4.55 + j * 1.1, 1.04, .3, .9);
      }
      // coolers along the back
      put(m.dark, 0, 1.15, D - T - .45, L - T * 2 - .6, 2.3, .8); solid(0, D - T - .45, L - T * 2 - .6, .8, 2.3);
      for (let a = -hw + 1.1; a < hw - .6; a += 1.5) { put(m.cool, a, 1.2, D - T - .88, 1.3, 1.9, .05); for (let k = 0; k < 4; k++) put(m.goods[Math.floor(r() * m.goods.length)], a, .5 + k * .46, D - T - .93, 1.1, .2, .05); }
      block(m.dark, hw - .75, 0, 1.6, .9, 1.9, 1.1, 1.8); put(m.screens[0], hw - 1.22, 1.3, 1.6, .04, .6, .7);           // cash machine
    } else if (shop.kind === 'diner') {
      // counter across the back with stools, a kitchen pass behind it, booths down both sides
      counter(0, D - 3.3, L - T * 2 - 3, .8, m.steel, ac); clerkAt(0, D - 2.2, 0, -1); spot(0, D - 4.4, 'diner', 1.7);
      for (let a = -hw + 2.6; a <= hw - 2.6; a += 1.3) stool(a, D - 4.05, ac);
      put(m.steel, 0, 2.9, D - 1.1, L - T * 2 - 2, .5, 1.4); put(m.dark, 0, 1.0, D - .9, L - T * 2 - 1, 2, .9);
      for (let i = 0, a = -hw + 1.4; a < hw - .8; a += 2.1, i++) { put(m.dark, a, 3.25, D - T - .1, 1.8, .9, .06); put(m.screens[(i + 3) % 6], a, 3.25, D - T - .14, 1.6, .7, .03); }
      for (const s of [-1, 1]) for (let b = 2.2; b < D - 6.2; b += 3.1) {
        block(m.white, s * (hw - 1.25), 0, b + 1.05, 1.5, .78, .9, .8);
        for (const e of [0, 2.1]) { put(ac, s * (hw - 1.25), .3, b + e, 1.7, .6, .55); put(ac, s * (hw - 1.25), .85, b + e + (e ? .22 : -.22), 1.7, .7, .12); solid(s * (hw - 1.25), b + e, 1.7, .55, .9); }
      }
      plant(-hw + .6, .9); plant(hw - .6, .9);
    } else if (shop.kind === 'pawn') {
      // an L of glass cases, a caged counter at the back, walls hung with things
      counter(0, D - 3, L - T * 2 - 2.4, .9, m.cool, m.darkWood); clerkAt(0, D - 1.9, 0, -1); spot(0, D - 4.2, 'pawn', 1.7);
      for (let a = -hw + 1.6; a < hw - 1.2; a += .45) put(mats.darkMetal, a, 2.2, D - 3, .05, 2.2, .05);
      put(mats.darkMetal, 0, 3.3, D - 3, L - T * 2 - 2.4, .08, .08);
      for (const s of [-1, 1]) { counter(s * (hw - 1.3), 4.6, .9, 5.4, m.cool, m.darkWood); for (let b = 2.4; b < 7; b += .9) put(m.goods[Math.floor(r() * m.goods.length)], s * (hw - 1.3), 1.16, b, .4, .12, .4); }
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { put(m.darkWood, s * (hw - .22), 1.7 + k * .7, D / 2, .4, .06, D - 5); for (let b = 3; b < D - 3; b += 1) put(m.goods[Math.floor(r() * m.goods.length)], s * (hw - .26), 1.92 + k * .7, b, .3, .36, .5); }
      put(m.gold, 0, 3.3, D - T - .1, 2.6, .8, .06);
    } else if (shop.kind === 'arcade') {
      // rows of cabinets glowing in the dark, a prize desk by the door
      const cab = (a, b, da, i) => {
        block(m.dark, a, 0, b, da ? .95 : .85, 1.85, da ? .85 : .95);
        put(m.screens[i % 6], a + da * .44, 1.25, b + (da ? 0 : -.49), da ? .04 : .62, .5, da ? .62 : .04);
        put(m.screens[(i + 2) % 6], a + da * .44, 1.72, b + (da ? 0 : -.49), da ? .04 : .8, .18, da ? .8 : .04);
        put(m.goods[i % 8], a + da * .5, .9, b + (da ? 0 : -.55), da ? .3 : .7, .08, da ? .7 : .3);
      };
      let i = 0;
      for (let b = 3.2; b < D - 1.6; b += 1.25) { cab(-hw + .55, b, 1, i++); cab(hw - .55, b, -1, i++); }
      for (let a = -hw + 2.6; a < hw - 2.2; a += 1.15) cab(a, D - .85, 0, i++);
      for (let b = 4.4; b < D - 4; b += 1.25) { cab(-.5, b, -1, i++); cab(.5, b, 1, i++); }
      counter(hw - 2.2, 1.5, 2.8, .8, m.steel, ac); clerkAt(hw - 2.2, .75, 0, 1); spot(hw - 2.2, 2.6, 'arcade');
      for (const a of [-L / 4, L / 4]) { put(m.screens[1], a, CEIL - .06, D / 2, .12, .06, D - 2); put(m.screens[0], a + 1, CEIL - .06, D / 2, .12, .06, D - 2); }
    } else if (shop.kind === 'motel') {
      counter(0, D - 2.6, 4.2, .9, m.wood, m.darkWood); clerkAt(0, D - 1.5, 0, -1); spot(0, D - 3.8, 'motel', 1.7);
      put(m.darkWood, 0, 2.3, D - T - .08, 3, 1.3, .06); for (let k = 0; k < 12; k++) put(m.gold, -1.2 + (k % 6) * .48, 2.0 + Math.floor(k / 6) * .5, D - T - .13, .1, .22, .04);
      for (const s of [-1, 1]) {           // a sofa and a table each side of the door, room doors down the walls
        block(ac, s * (hw - .8), 0, 3, 1, .5, 3, .9); put(ac, s * (hw - .35), .75, 3, .25, .7, 3);
        block(m.wood, s * (hw - 2.6), 0, 3, .9, .42, 1.4, .5); plant(s * (hw - .6), .9);
        for (let b = 6; b < D - 2.4; b += 2.6) { put(m.darkWood, s * (hw - .04), 1.1, b, .06, 2.2, 1.05); put(m.gold, s * (hw - .08), 1.75, b, .04, .16, .22); }
      }
      block(m.dark, -hw + .7, 0, D - 1.3, 1, 1.9, .9, 1.8); put(m.screens[5], -hw + .7, 1.2, D - 1.78, .8, 1.2, .04);     // vending machine
      put(tinted(0xb5462f), 0, .055, D / 2 - .5, 3.4, .03, 5.2);
    } else if (shop.kind === 'laundry') {
      // washers down both walls, dryers across the back, a folding table in the middle
      for (const s of [-1, 1]) for (let b = 1.6; b < D - 3; b += .95) {
        put(m.white, s * (hw - .42), .5, b, .8, 1, .85); put(m.dark, s * (hw - .84), .52, b, .04, .46, .46, false, rbox(1, 1, 1, .3)); put(m.cool, s * (hw - .86), .52, b, .03, .3, .3, false, rbox(1, 1, 1, .3));
        put(m.steel, s * (hw - .42), 1.02, b, .82, .05, .87);
      }
      for (const s of [-1, 1]) solid(s * (hw - .42), D / 2 - .7, .85, D - 4.6, 1.05);
      for (let a = -hw + 1.8; a < hw - 1.4; a += 1) for (const y of [.75, 1.85]) { put(m.steel, a, y, D - T - .45, .92, 1.05, .8); put(m.dark, a, y, D - T - .87, .5, .5, .04, false, rbox(1, 1, 1, .3)); }
      solid(0, D - T - .45, L - T * 2 - 3, .8, 2.4);
      block(m.white, 0, 0, D / 2 + .5, 1.3, .9, 3.4); for (const k of [-1, 0, 1]) put(m.goods[(k + 3) % 8], 0, .98, D / 2 + .5 + k, .7, .16, .6);
      for (const s of [-1, 1]) block(ac, s * 2.1, 0, D / 2 + .5, .45, .45, 2.6, .5);
      counter(-hw + 2.6, 1.35, 1.8, .7, m.steel, ac); clerkAt(-hw + 2.6, .7, 0, 1); spot(-hw + 2.6, 2.4, 'laundry');
    } else if (shop.kind === 'lobby') {
      // marble and gold: the desk to one side, the lifts in the back wall, somewhere to sit
      counter(-hw + 3, D - 4.2, 3.6, .9, m.gold, m.darkWood); clerkAt(-hw + 3, D - 3.1, 0, -1);
      for (const a of [1.2, 3.4]) { put(m.gold, a, 1.3, D - T - .06, 1.7, 2.6, .08); put(m.steel, a - .37, 1.2, D - T - .12, .72, 2.4, .05); put(m.steel, a + .37, 1.2, D - T - .12, .72, 2.4, .05); put(m.green, a, 2.75, D - T - .13, .5, .14, .04); }
      put(m.screens[3], 2.3, 1.25, D - T - .1, .14, .22, .06); spot(2.3, D - 1.5, 'liftUp', 1.9);
      put(tinted(0x8f2f3f), 1.2, .055, D / 2, 4.2, .03, D - 4);
      for (const s of [-1, 1]) { block(tinted(0x2f5f6f), 1.2 + s * 1.8, 0, 3.4, 1, .5, 2.6, .9); put(tinted(0x2f5f6f), 1.2 + s * 2.2, .8, 3.4, .22, .7, 2.6); }
      block(m.darkWood, 1.2, 0, 3.4, 1.1, .4, 1.5, .5); put(m.gold, 1.2, .42, 3.4, 1.2, .04, 1.6);
      plant(-hw + .7, .9); plant(hw - .7, .9); plant(-hw + .7, D - 1); plant(hw - .7, D - 1);
      for (const [k, w] of [[.08, 2.6], [.22, 1.8], [.36, 1]]) { put(m.gold, 1.2, CEIL - k, D / 2, w, .06, w, false, G.cyl); put(m.panel, 1.2, CEIL - k - .05, D / 2, w * .9, .04, w * .9, false, G.cyl); }      // chandelier
    } else if (shop.kind === 'clinic') {
      counter(0, D - 3.4, 4.6, .9, m.white, ac); clerkAt(0, D - 2.3, 0, -1); spot(0, D - 4.6, 'clinic', 1.7);
      put(m.white, 0, 3, D - T - .08, 1.5, 1.5, .06); put(m.red, 0, 3, D - T - .12, 1.1, .34, .04); put(m.red, 0, 3, D - T - .12, .34, 1.1, .04);
      for (let b = 2; b < D - 5.5; b += .75) { put(tinted(0x3e8fd6), -hw + .5, .45, b, .6, .1, .6); put(tinted(0x3e8fd6), -hw + .2, .8, b, .08, .7, .6); put(m.steel, -hw + .5, .2, b, .08, .4, .08); }
      solid(-hw + .45, (D - 3.5) / 2 + .2, .7, D - 7.6, .9);
      for (let b = 2.6; b < D - 5.5; b += 3) {          // beds behind curtains
        block(m.white, hw - 1.2, 0, b, 2.1, .6, 1, .7); put(tinted(0xbfe3ef), hw - 1.95, .72, b, .5, .14, .7); put(m.steel, hw - 1.2, .28, b, 2.15, .06, 1.05);
        put(tinted(0x9fd3c7), hw - 2.5, 1.5, b + .9, .05, 2.1, 1.4);
      }
      plant(-hw + .7, D - 1); plant(hw - .7, .9);
    } else if (shop.kind === 'guns') {
      // the guns hang on the back wall, one stretch of counter each; armor by the door; crates of rounds, a target to prove it
      const ids = ['pistol', 'smg', 'shotgun', 'burst', 'sniper'], span = L - T * 2 - 2.2, step = span / ids.length;
      counter(0, D - 2.9, span, .9, m.steel, m.darkWood); clerkAt(0, D - 1.8, 0, -1);
      put(m.dark, 0, 2.35, D - T - .1, span, 1.9, .08);
      ids.forEach((id, k) => {
        const a = -span / 2 + step * (k + .5), w = makeWeapon(id), at = P(a, 2.35, D - T - .32).add(g.position);
        w.position.copy(at); w.rotation.y = Math.atan2(rx, rz); w.scale.setScalar(Math.min(2.2, step * .8 / WEAPONS[id].length)); realScene.add(w); extra.push(w);
        put(ac, a, 1.32, D - T - .16, step - .3, .06, .1); put(m.gold, a, 1.2, D - 2.9, .5, .06, .3);
        spot(a, D - 4, 'gun:' + id, Math.min(1.05, step / 2 - .05));
      });
      for (const s of [-1, 1]) {            // cases down the sides: boxes of rounds, a vest on a stand
        counter(s * (hw - 1.1), 4.3, .9, 4.4, m.cool, m.darkWood);
        for (let b = 2.5; b < 6.4; b += .7) put(m.goods[Math.floor(r() * 3) + 3], s * (hw - 1.1), 1.16, b, .42, .14, .3);
        for (let k = 0; k < 3; k++) { put(m.darkWood, s * (hw - .2), 1.9 + k * .62, 4.3, .36, .05, 4.4); for (let b = 2.5; b < 6.4; b += .62) put(k === 1 ? m.dark : tinted(0x4d5a36), s * (hw - .24), 2.08 + k * .62, b, .3, .3, .44); }
      }
      put(tinted(0x2f5fb8), -hw + 1.1, 1.75, 7.6, .5, .62, .26); put(m.steel, -hw + 1.1, .7, 7.6, .08, 1.4, .08, false, G.cyl); solid(-hw + 1.1, 7.6, .6, .5, 1.4); spot(-hw + 2.1, 7.6, 'vest', 1.1);
      for (const [k, c] of [[.62, m.white], [.46, m.red], [.3, m.white], [.14, m.red]]) put(c, hw - .08, 2.5, 7.8, .03, k, k, false, G.sph);
      plant(hw - .6, .9);
    } else if (shop.kind === 'police') {
      // the front desk behind glass, a bench for the public, a holding cell in the back corner
      counter(0, D - 4.2, L - T * 2 - 5, .9, m.steel, ac); clerkAt(-1, D - 3.1, 0, -1); spot(-1, D - 5.4, 'police', 1.7);
      put(m.glass, 0, 1.9, D - 4.2, L - T * 2 - 5, 1.5, .05);
      for (let a = -hw + 3; a < hw - 2.6; a += 1.6) put(mats.darkMetal, a, 1.9, D - 4.2, .06, 1.6, .08);
      for (let a = hw - 3.2; a <= hw - .2; a += .28) put(mats.darkMetal, a, CEIL / 2, D - 3.4, .06, CEIL, .06, false, G.cyl);
      for (let b = D - 3.4; b <= D - .4; b += .28) put(mats.darkMetal, hw - 3.2, CEIL / 2, b, .06, CEIL, .06, false, G.cyl);
      solid(hw - 1.7, D - 3.4, 3.2, .15, 4); solid(hw - 3.2, D - 1.9, .15, 3.2, 4); put(m.steel, hw - 1.2, .4, D - .9, 1.9, .12, .7);
      block(m.wood, -hw + .55, 0, 4, .6, .45, 4.2, .5); put(m.wood, -hw + .2, .8, 4, .08, .6, 4.2);
      put(m.darkWood, hw - .08, 2, 4, .06, 1.4, 3); for (let k = 0; k < 6; k++) put(m.cream, hw - .13, 1.7 + (k % 2) * .6, 3 + Math.floor(k / 2) * .95, .03, .45, .6);
      put(ac, 0, 3.3, D - T - .08, 3.2, .7, .06); put(m.gold, 0, 3.3, D - T - .12, .5, .5, .04, false, rbox(1, 1, 1, .2));
    }
    room.meshes = bakeStatic(inner, realScene, () => 'room'); room.meshes.push(...extra);
    for (const [mat, list] of coloured) { const mm = new THREE.Mesh(mergeGeometries(list), mat); mm.receiveShadow = true; mm.matrixAutoUpdate = false; realScene.add(mm); room.meshes.push(mm); list.forEach(o => o.dispose()); }
    rooms.push(room);
  }

  // ---------- the roof of the Sunset Tower ----------
  const top = skyline?.sunset?.roof, tower = rooms.find(q => q.id === 'tower');
  let roof = null;
  if (top && tower) {
    const { x, z, y, hw, hd, core } = top, g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
    addRibbon([{ x: x - hw, z, y }, { x: x + hw, z, y }], hd, { thick: 1 });            // somewhere to stand, 150 m up
    const rail = (cx, cz, sx, sz) => solids.walls.push({ x: x + cx, z: z + cz, hl: Math.max(sx, sz) / 2, ht: .12, rot: sx >= sz ? 0 : Math.PI / 2, kind: 'rail', h: 1e9 });
    for (const s of [-1, 1]) {
      mesh(G.box, mats.trim, V(0, .55, s * (hd - .15)), V(hw * 2, 1.1, .3), g); mesh(G.box, mats.trim, V(s * (hw - .15), .55, 0), V(.3, 1.1, hd * 2), g);
      mesh(G.box, mats.darkMetal, V(0, 1.14, s * (hd - .15)), V(hw * 2, .07, .12), g, false); mesh(G.box, mats.darkMetal, V(s * (hw - .15), 1.14, 0), V(.12, .07, hd * 2), g, false);
      rail(0, s * (hd - .35), hw * 2, .24); rail(s * (hw - .35), 0, .24, hd * 2);
      rail(0, s * (core + .05), core * 2 + .3, .24); rail(s * (core + .05), 0, .24, core * 2 + .3);
    }
    // the lift door in the lantern, and two coin telescopes for the view
    mesh(G.box, m.gold, V(0, 1.25, -core - .02), V(1.7, 2.5, .1), g, false); mesh(G.box, m.steel, V(-.38, 1.2, -core - .08), V(.72, 2.3, .05), g, false); mesh(G.box, m.steel, V(.38, 1.2, -core - .08), V(.72, 2.3, .05), g, false);
    for (const s of [-1, 1]) { mesh(G.cyl, m.steel, V(s * (hw - 1), .6, hd - 1), V(.07, 1.2, .07), g, false); mesh(rbox(.3, .34, .6, .1), m.steel, V(s * (hw - 1), 1.3, hd - 1), null, g, false); }
    roof = { x, z: z - core - 1.1, y };
    spots.push({ x, z: z - core - 1.1, y, r: 1.6, room: tower, what: 'liftDown' });
  }
  return { rooms, spots, roof };
}

// ---------- what you can do inside ----------
export function createInteriors(game) {
  const { rooms, spots, roof } = game.city.interiors, p = game.player, C = INDOORS, hud = game.hud, audio = game.audio;
  const cash = (n) => '$' + n.toLocaleString('en-US');
  const hint = document.createElement('div'); hint.className = 'prompt'; hint.style.bottom = '23%'; hint.hidden = true; document.getElementById('hud').appendChild(hint);
  const fade = document.createElement('div'); fade.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;transition:opacity .22s;pointer-events:none;z-index:5'; document.body.appendChild(fade);
  const light = new THREE.PointLight(0xffe6c4, 0, 22, 1.3); game.scene.add(light);
  for (const q of rooms) if (q.clerk) { const c = q.clerk; c.model = makeCharacter(c.kind); c.model.position.set(c.x, q.y, c.z); c.model.rotation.y = c.face; c.model.visible = false; game.scene.add(c.model); }
  for (const q of rooms) game.markers.push({ x: q.door.x, z: q.door.z, color: q.kind === 'guns' ? '#ff8a3d' : '#ffffff', glyph: q.kind === 'clinic' ? '+' : q.kind === 'lobby' ? '▲' : q.kind === 'guns' ? 'G' : '', size: q.kind === 'lobby' || q.kind === 'clinic' || q.kind === 'guns' ? 6 : 3.2 });

  const pay = (n) => { if (game.money < n) { hud.toast('NOT ENOUGH CASH', 'bad'); return false; } game.money -= n; audio.cash(); return true; };
  const heal = (n) => { p.health = Math.min(100, p.health + n); };
  const wanted = () => game.police.stars > 0;
  function ride(x, z, y, yaw, toast) {
    if (indoors.busy) return; indoors.busy = true; fade.style.opacity = 1; audio.door();
    setTimeout(() => {
      p.body.setTranslation({ x, y: z }, true); p.body.setLinvel({ x: 0, y: 0 }, true);
      p.x = p.px = p.ix = x; p.z = p.pz = p.iz = z; p.y = y; p.face = Math.PI; game.cam.ty = y + 1.55; game.cam.yaw = yaw; game.cam.pitch = .3;
      fade.style.opacity = 0; indoors.busy = false; if (toast) hud.toast(toast, 'place');
    }, 260);
  }
  // what each counter offers: [words for the hint, what happens]. Returning no words hides the hint.
  const offers = {
    mart: () => [`Snack  ${cash(C.snack)}`, () => { if (p.health >= 100) hud.toast('NOT HUNGRY', 'info'); else if (pay(C.snack)) { heal(35); hud.toast('SNACK  +35 HEALTH', 'good'); } }],
    diner: () => [`Eat  ${cash(C.meal)}`, () => { if (p.health >= 100) hud.toast('STUFFED ALREADY', 'info'); else if (pay(C.meal)) { heal(100); hud.toast('FULL HEALTH', 'good'); } }],
    pawn: () => p.armor < COMBAT.armor ? [`Body armor  ${cash(C.armor)}`, () => { if (pay(C.armor)) { p.armor = COMBAT.armor; hud.toast('BODY ARMOR', 'good'); } }]
      : game.combat.weapon !== 'fists' ? [`Ammo  ${cash(C.ammo)}`, () => { if (pay(C.ammo)) { game.combat.give(game.combat.weapon); hud.toast('AMMO', 'good'); } }] : ['Nothing you need', () => { }],
    arcade: () => [`Play  ${cash(C.play)}`, () => { if (!pay(C.play)) return; const roll = Math.random(); if (roll < .04) { game.addMoney(C.jackpot); hud.toast(`JACKPOT!  +${cash(C.jackpot)}`, 'good'); } else if (roll < .4) { const w = 15 + Math.floor(Math.random() * 8) * 5; game.addMoney(w); hud.toast(`HIGH SCORE  +${cash(w)}`, 'good'); } else hud.toast('GAME OVER', 'bad'); }],
    motel: () => wanted() ? ['No rooms for wanted guests', () => { }] : [`Sleep  ${cash(C.room)}`, () => { if (pay(C.room)) { fade.style.opacity = 1; setTimeout(() => { game.env.skip(); heal(100); fade.style.opacity = 0; hud.toast('RESTED', 'good'); }, 400); } }],
    laundry: () => !wanted() ? ['Nothing to wash off', () => { }] : [`Fresh clothes  ${cash(C.clothes)}`, () => { if (game.police.seen) hud.toast('NOT WHILE THEY CAN SEE YOU', 'bad'); else if (pay(C.clothes)) { game.police.clear(false); hud.toast('NEW LOOK: COPS LOST', 'good'); } }],
    clinic: () => [`Patch up  ${cash(C.patchUp)}`, () => { if (p.health >= 100) hud.toast('FIT AS A FIDDLE', 'info'); else if (pay(C.patchUp)) { heal(100); hud.toast('FULL HEALTH', 'good'); } }],
    police: () => wanted() ? [`Pay them off  ${cash(C.bribe * game.police.stars)}`, () => { if (pay(C.bribe * game.police.stars)) { game.police.clear(false); hud.toast('CHARGES DROPPED', 'good'); } }] : ['Nothing to report', () => { }],
    liftUp: () => !roof ? null : wanted() ? ['Lift locked: lose the cops first', () => { }] : ['Lift to the roof', () => ride(roof.x, roof.z, roof.y, 0, 'SUNSET TOWER ROOF')],
    liftDown: () => ['Lift to the lobby', () => { const s = spots.find(o => o.what === 'liftUp'); ride(s.x, s.z, s.room.y, Math.atan2(-s.room.face[1], -s.room.face[0]), null); }],
  };
  offers.vest = () => p.armor < COMBAT.armor ? [`Body armor  ${cash(C.armor)}`, () => { if (pay(C.armor)) { p.armor = COMBAT.armor; hud.toast('BODY ARMOR', 'good'); } }] : ['Armor is good', () => { }];
  // Bullseye Guns: a gun you don't have is sold whole; one you have is topped up
  const gun = (id) => { const w = WEAPONS[id], c = game.combat;
    return c.owned.has(id) ? [`${w.name} ammo  ${cash(C.gunAmmo[id])}`, () => { if (pay(C.gunAmmo[id])) { c.give(id); hud.toast(`+${w.give} ${w.name} AMMO`, 'good'); } }]
      : [`Buy ${w.name}  ${cash(C.guns[id])}`, () => { if (pay(C.guns[id])) { c.give(id); hud.toast(`${w.name} BOUGHT`, 'good'); } }]; };
  const offer = (what) => what.startsWith('gun:') ? gun(what.slice(4)) : offers[what]();
  let here = null, at = null, shown = '', robT = 0;
  const inside = (q, x, z, m = 0) => Math.abs(x - q.x) < q.hw + m && Math.abs(z - q.z) < q.hd + m;

  const indoors = {
    rooms, busy: false, get room() { return here; },
    use() { if (at && !indoors.busy && game.state === 'playing' && !game.over && p.mode === 'foot') { const o = offer(at.what); if (o) o[1](); } },
    update(dt, t) {
      // the nearest room: its light is on and whoever works there is at their post
      let near = null, nd = 46;
      for (const q of rooms) {
        const d = Math.hypot(q.x - p.x, q.z - p.z), show = d < C.drawDist;
        if (q.shown !== show) { q.shown = show; for (const o of q.meshes) o.visible = show; }
        if (q.clerk) q.clerk.model.visible = d < 46; if (d < nd) { nd = d; near = q; }
      }
      if (near) light.position.set(near.light.x, near.light.y, near.light.z);
      light.intensity += ((near ? 26 : 0) - light.intensity) * Math.min(1, dt * 4);
      const was = here; here = p.mode === 'foot' ? rooms.find(q => Math.abs(p.y - q.y) < 3 && inside(q, p.x, p.z)) || null : null;
      if (here && here !== was && game.state === 'playing') hud.toast(here.name, 'place');
      if (near?.clerk) {
        const c = near.clerk, scared = near.scared > 0; near.scared = Math.max(0, (near.scared || 0) - dt);
        animateCharacter(c.model, t, dt, 0, scared ? 'flail' : 'stand', scared);
        if (here === near && !scared) c.model.rotation.y += angleDiff(Math.atan2(p.x - c.x, p.z - c.z), c.model.rotation.y) * Math.min(1, dt * 4);      // they watch you
      }
      // a spot to press E at?
      at = null;
      if (p.mode === 'foot' && !game.over) for (const s of spots) if (Math.abs(s.y - p.y) < 1.5 && Math.hypot(s.x - p.x, s.z - p.z) < s.r) { at = s; break; }
      const o = at && !indoors.busy ? offer(at.what) : null, text = o ? `<kbd>E</kbd> ${o[0]}` : '';
      if (text !== shown) { hint.innerHTML = text; hint.hidden = !text; shown = text; }
      // a hold-up: keep a gun on whoever is behind the counter
      const c = here?.clerk, armed = game.combat.aiming && game.combat.weapon !== 'fists';
      if (c && armed && here.kind !== 'police' && here.kind !== 'clinic' && here.kind !== 'lobby' && here.kind !== 'guns') {
        const dx = c.x - p.x, dz = c.z - p.z, d = Math.hypot(dx, dz) || 1, dir = game.cam.dir;
        if (d < 12 && (dx * dir.x + dz * dir.z) / d > .93) {
          here.scared = .6;
          if (game.time < here.till) { if (!here.told) hud.toast('THE TILL IS EMPTY', 'info'); here.told = true; }
          else if ((robT += dt) > C.robTime) {
            const take = C.robCash[0] + Math.floor(Math.random() * (C.robCash[1] - C.robCash[0]) / 10) * 10;
            robT = 0; here.till = game.time + C.tillRefill; here.scared = 6; here.told = true; game.addMoney(take); hud.toast(`HOLD-UP  +${cash(take)}`, 'good'); game.match?.robbed(here);
            game.police.crime(C.robHeat, C.robStars, 'ARMED ROBBERY!'); game.peds.scare(here.door.x, here.door.z, 18);
          } else if (robT > .3 && Math.floor(robT * 2) !== Math.floor((robT - dt) * 2)) audio.cash();
        } else { robT = 0; here.told = false; }
      } else { robT = 0; if (here) here.told = false; }
      // keep the camera under the ceiling
      const cam = game.camera;
      if (here && !game.combat.aiming) {
        const top = here.y + CEIL - .85;
        if (cam.position.y > top && inside(here, cam.position.x, cam.position.z, .5)) { cam.position.y = top; cam.lookAt(game.cam.lookAt); }
      }
    },
  };
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyE' && !e.repeat) indoors.use(); });
  return indoors;
}
