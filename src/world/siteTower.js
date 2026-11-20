// The Possum Grand: the hotel the Possum Posse is putting up in Port Sunset. Six bare concrete decks and a roof,
// no walls yet, a ramp from each deck to the next along the south side, a lift core, a tower crane over it all.
// It is built after the city (main.js), straight into the scene and the physics:
//   - every deck and ramp is a ribbon (terrain.js), so you walk up it the way you walk onto a bridge
//   - the decks all share one flat set of colliders (the physics is 2D): the safety rails only hold people who are
//     up on a deck, the columns, the lift core and the stacks of materials stand in the same place on every floor
// Story mission 12 (story/missions2.js) is fought up through it; in free roam it is somewhere to climb and jump off.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addRibbon, groundY } from './terrain.js';
import { mats, std, G, ctex } from './materials.js';
import { plainGeometry } from './batching.js';

// centre, half sizes, metres between decks, how many decks (the last one is the roof), width of the ramp bay
export const SITE = { x: 200, z: 52, hw: 16, hd: 12, rise: 6, decks: 6, bay: 4 };

export function createSiteTower(game) {
  const { x: cx, z: cz, hw, hd, rise, decks, bay } = SITE, ph = game.physics;
  const base = Math.max(groundY(cx - hw, cz - hd), groundY(cx + hw, cz - hd), groundY(cx - hw, cz + hd), groundY(cx + hw, cz + hd)) + .06;
  const yOf = (k) => base + k * rise, top = yOf(decks);
  const run = hw - bay;                       // the ramps run from u = -run to u = +run, in the bay along the south edge
  const wBay = -hd + bay / 2;                 // the middle of the bay
  const T = .42;                              // slab thickness

  // ---------- where you can stand ----------
  for (let k = 1; k <= decks; k++) {
    const y = yOf(k), info = { thick: T + .1 };
    addRibbon([{ x: cx - hw, z: cz + bay / 2, y }, { x: cx + hw, z: cz + bay / 2, y }], hd - bay / 2, info);          // the deck
    addRibbon([{ x: cx - hw, z: cz + wBay, y }, { x: cx - run, z: cz + wBay, y }], bay / 2, info);                    // west landing: the next ramp starts here
    addRibbon([{ x: cx + run, z: cz + wBay, y }, { x: cx + hw, z: cz + wBay, y }], bay / 2, info);                    // east landing: the ramp from below arrives here
  }
  for (let k = 0; k < decks; k++) addRibbon([{ x: cx - run, z: cz + wBay, y: yOf(k) }, { x: cx + run, z: cz + wBay, y: yOf(k + 1) }], bay / 2, { thick: .5 });

  // ---------- what you bump into ----------
  const rail = (x, z, hl, rot = 0) => ph.addWall(x, z, hl, .12, rot, 'rail', 1e9);
  rail(cx, cz - hd, hw); rail(cx, cz + hd, hw); rail(cx - hw, cz, hd, Math.PI / 2); rail(cx + hw, cz, hd, Math.PI / 2);
  rail(cx, cz - hd + bay, run);                                                    // between the decks and the ramp bay
  // things that stand on every floor: solid to people on the ground, people on the decks, bullets and sight lines alike
  const stand = (u, w, su, sw) => { ph.addStaticBox(cx + u, cz + w, su / 2, sw / 2, false, top + 3); ph.addWall(cx + u, cz + w, su / 2, sw / 2, 0, 'rail', 1e9); };
  const cols = [[-hw + .6, -hd + .6], [hw - .6, -hd + .6], [-5.2, -hd + bay + .1], [5.2, -hd + bay + .1]];
  for (const u of [-hw + .6, -5.2, 5.2, hw - .6]) cols.push([u, 2.2], [u, hd - .6]);
  for (const [u, w] of cols) stand(u, w, .8, .8);
  const core = { u: 0, w: hd - 3.6, su: 6.4, sw: 4.4 }; stand(core.u, core.w, core.su, core.sw);
  const cover = [[-9.5, 6.4, 2.6, 1.5], [9.6, -1.6, 1.5, 2.6], [-.4, -2.8, 2.8, 1.4], [10.4, 7.2, 2.2, 1.6], [-11.2, -2.6, 1.5, 2.4]];
  for (const [u, w, su, sw] of cover) stand(u, w, su, sw);

  // ---------- what you see ----------
  const M = {
    slab: std({ color: 0xbdb7ab, roughness: .92 }), dark: std({ color: 0x8f8a80, roughness: .95 }), col: std({ color: 0xcfc9bc, roughness: .9 }),
    orange: std({ color: 0xff7a2f, roughness: .7 }), yellow: std({ color: 0xf2c230, roughness: .55, metalness: .2 }), steel: mats.darkMetal,
    wood: std({ color: 0xb98a54, roughness: .9 }), tarp: std({ color: 0x2f8f9a, roughness: .8 }), bag: std({ color: 0xe6dfcf, roughness: .95 }), red: std({ color: 0xd9412f, roughness: .7 }),
    lamp: mats.lampHead, safe: std({ color: 0x2c3340, roughness: .35, metalness: .8 }), gold: std({ color: 0xe2b860, roughness: .3, metalness: .85, emissive: 0xe2b860, emissiveIntensity: .15 }),
    net: std({ map: ctex(64, (x, s) => { x.clearRect(0, 0, s, s); x.strokeStyle = '#ff7a2f'; x.lineWidth = 5; for (let i = -s; i < s * 2; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + s, s); x.stroke(); x.beginPath(); x.moveTo(i + s, 0); x.lineTo(i, s); x.stroke(); } }), transparent: true, alphaTest: .35, side: THREE.DoubleSide, roughness: .8 }),
  };
  const lists = new Map(), mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
  // a box (or any geometry) of material `mat` centred at local (u, y, w); y is metres above the site's base
  const put = (mat, u, y, w, su, sy, sw, rz = 0, geo = G.box, ry = 0) => {
    const g = plainGeometry(geo, mx.compose(P.set(cx + u, base + y, cz + w), q.setFromEuler(e.set(0, ry, rz)), S.set(su, sy, sw)));
    if (mat === M.net) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(su, sw) / 1.2, uv.getY(i)); }
    if (!lists.has(mat)) lists.set(mat, []); lists.get(mat).push(g);
  };
  // the pad it stands on, and the ramps
  put(M.dark, 0, -.02, 0, hw * 2 + 6, .12, hd * 2 + 6);
  const slope = Math.atan2(rise, run * 2), rampLen = Math.hypot(run * 2, rise);
  for (let k = 0; k < decks; k++) {
    put(M.slab, 0, k * rise + rise / 2 - .2, wBay, rampLen, .36, bay - .1, slope);
    put(M.yellow, 0, k * rise + rise / 2 - .01, wBay - bay / 2 + .25, rampLen, .04, .14, slope);          // a painted edge line
  }
  for (let k = 1; k <= decks; k++) {
    const y = k * rise;
    put(M.slab, 0, y - T / 2, bay / 2, hw * 2, T, hd * 2 - bay); put(M.slab, -hw + bay / 2, y - T / 2, wBay, bay, T, bay); put(M.slab, hw - bay / 2, y - T / 2, wBay, bay, T, bay);
    put(M.dark, 0, y - T - .12, hd - .2, hw * 2, .24, .4);                         // edge beams
    put(M.dark, -hw + .2, y - T - .12, 0, .4, .24, hd * 2); put(M.dark, hw - .2, y - T - .12, 0, .4, .24, hd * 2);
    // safety rail: posts, two bars and orange netting, all the way round; and along the ramp bay
    const fence = (u0, w0, u1, w1) => {
      const len = Math.hypot(u1 - u0, w1 - w0), along = Math.abs(u1 - u0) > Math.abs(w1 - w0), um = (u0 + u1) / 2, wm = (w0 + w1) / 2;
      put(M.steel, um, y + 1.08, wm, along ? len : .07, .07, along ? .07 : len); put(M.steel, um, y + .56, wm, along ? len : .05, .05, along ? .05 : len);
      put(M.net, um, y + .56, wm, along ? len : .02, 1.02, along ? .02 : len);
      for (let d = 0; d <= len + .01; d += len / Math.max(1, Math.round(len / 3.2))) put(M.steel, u0 + (u1 - u0) * d / len, y + .56, w0 + (w1 - w0) * d / len, .08, 1.12, .08);
    };
    fence(-hw + .12, -hd + .12, hw - .12, -hd + .12); fence(-hw + .12, hd - .12, hw - .12, hd - .12); fence(-hw + .12, -hd + .12, -hw + .12, hd - .12); fence(hw - .12, -hd + .12, hw - .12, hd - .12);
    fence(-run, -hd + bay, run, -hd + bay);
    // work lights under the deck above, the lift core's doors, stacks of materials
    if (k < decks) for (const u of [-10, 0, 10]) for (const w of [-3, 7]) { put(M.steel, u, y + rise - T - .2, w, .05, .4, .05); put(M.lamp, u, y + rise - T - .46, w, 1.3, .1, .22); }
    put(M.yellow, core.u, y + 1.2, core.w - core.sw / 2 - .03, 1.9, 2.4, .06); put(M.steel, core.u - .46, y + 1.15, core.w - core.sw / 2 - .07, .86, 2.2, .04); put(M.steel, core.u + .46, y + 1.15, core.w - core.sw / 2 - .07, .86, 2.2, .04);
    cover.forEach(([u, w, su, sw], i) => {
      const kind = (i + k) % 3;
      put(M.wood, u, y + .09, w, su, .18, sw);
      if (kind === 0) { for (let j = 0; j < 4; j++) put(M.bag, u, y + .36 + j * .36, w, su - .2 - (j % 2) * .12, .34, sw - .2 - ((j + 1) % 2) * .12); put(M.tarp, u, y + 1.82, w, su + .08, .08, sw + .08); }
      else if (kind === 1) { put(M.wood, u, y + .95, w, su - .12, 1.6, sw - .12); put(M.red, u, y + 1.5, w, su - .08, .16, sw - .08); put(M.red, u, y + .6, w, su - .08, .16, sw - .08); }
      else { put(M.col, u, y + .95, w, su - .3, 1.55, sw - .3); put(M.orange, u, y + 1.78, w, su - .1, .1, sw - .1); }
    });
  }
  for (const [u, w] of cols) { put(M.col, u, top / 2 - base / 2 + .55, w, .8, top - base + 1.1, .8); for (const [a, b] of [[-.2, -.2], [.2, .2], [-.2, .2], [.2, -.2]]) put(M.steel, u + a, top - base + 1.9, w + b, .05, 1.7, .05); }
  put(M.col, core.u, (top - base + 3.4) / 2, core.w, core.su, top - base + 3.4, core.sw); put(M.dark, core.u, top - base + 3.5, core.w, core.su + .4, .24, core.sw + .4);
  // ground level: the ramp's kerb, barriers and cones round the pad
  for (const [u, w] of [[-hw - 2, -hd - 2], [hw + 2, hd + 2], [-hw - 2, hd + 2], [hw + 2, -hd - 2], [0, hd + 2.4], [0, -hd - 2.4]]) { put(M.orange, u, .35, w, .5, .7, .5, 0, G.cyl); put(M.bag, u, .5, w, .52, .12, .52, 0, G.cyl); }
  for (const u of [-10, -4, 4, 10]) { put(M.red, u, .5, hd + 2.2, 2.2, .9, .35); put(M.bag, u, .5, hd + 2.38, 2.2, .3, .02); }

  // the roof: the Posse's safe against the lift core, a plank out over the east edge, a sign
  const roofY = top - base;
  const safe = { x: cx + core.u, z: cz + core.w - core.sw / 2 - .85, y: top };
  put(M.safe, core.u, roofY + .95, core.w - core.sw / 2 - .8, 1.7, 1.9, 1.4); put(M.gold, core.u, roofY + 1.05, core.w - core.sw / 2 - 1.53, .5, .5, .08, 0, G.cyl, 0);
  put(M.gold, core.u + .55, roofY + 1.05, core.w - core.sw / 2 - 1.52, .08, .6, .08); put(M.steel, core.u, roofY + .04, core.w - core.sw / 2 - .8, 2, .08, 1.7);
  const jump = { x: cx + hw - 1.4, z: cz + 5, y: top, dx: 1, dz: 0 };
  put(M.wood, hw + 1.2, roofY + .08, 5, 5.2, .1, .9); put(M.steel, hw - 1, roofY + .05, 5, 1.2, .1, 1.3); put(M.yellow, hw + 3.6, roofY + .14, 5, .3, .04, .9);
  for (const s of [-1, 1]) put(M.steel, hw - .12, roofY + 1.6, 5 + s * .75, .09, 2.2, .09);                // two tall posts and a flag mark the plank
  put(M.orange, hw - .12, roofY + 2.6, 5, .1, .5, 1.6);

  // the tower crane, against the north face
  const crane = { u: -8, w: hd + 4.5 }, mastH = roofY + 16;
  ph.addStaticBox(cx + crane.u, cz + crane.w, 1.1, 1.1, false, base + mastH + 4);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(M.yellow, crane.u + a * .9, mastH / 2, crane.w + b * .9, .22, mastH, .22);
  for (let y = 1.5; y < mastH; y += 3) { for (const s of [-1, 1]) { put(M.yellow, crane.u, y, crane.w + s * .9, 1.9, .12, .12); put(M.yellow, crane.u + s * .9, y, crane.w, .12, .12, 1.9); put(M.yellow, crane.u, y + 1.5, crane.w + s * .9, 2.5, .1, .1, s * .9); } }
  put(M.yellow, crane.u, mastH + .9, crane.w, 2.6, 1.8, 2.6); put(M.steel, crane.u + 1.1, mastH + 1, crane.w - 1.35, 1.6, 1.1, .1);          // the cab
  const jibLen = 34, back = 10, jibY = mastH + 2.4, ja = -.95;                    // the jib swings out over the roof, towards the south-east
  const jib = (d, y, sx, sy, sz) => put(M.yellow, crane.u + Math.cos(ja) * d, y, crane.w + Math.sin(ja) * d, sx, sy, sz, 0, G.box, -ja);
  jib((jibLen - back) / 2, jibY, jibLen + back, .3, 1.3); jib((jibLen - back) / 2, jibY + 1.5, jibLen + back - 4, .16, .16); jib(-back + 1.5, jibY - .9, 3, 1.5, 2);
  for (let d = -back + 2; d < jibLen - 2; d += 3) jib(d, jibY + .75, .12, 1.5, .12);
  put(M.yellow, crane.u, jibY + 3.2, crane.w, .3, 5, .3); put(M.red, crane.u, jibY + 5.8, crane.w, .4, .4, .4, 0, G.sph);
  jib(22, jibY - 5, .06, 10, .06); jib(22, jibY - 10.2, .5, .5, .5);              // cable and hook

  const group = new THREE.Group(); group.name = 'siteTower';
  for (const [mat, list] of lists) {
    const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = mat !== M.net && mat !== M.lamp; m.receiveShadow = true; m.matrixAutoUpdate = false;
    m.geometry.computeBoundingSphere(); group.add(m); list.forEach(g => g.dispose());
  }
  // the sign on the roof: lit letters on a frame, facing downtown
  const signTex = ctex(1024, (x, s) => {
    x.clearRect(0, 0, s, s); x.font = '900 150px "Archivo Black",Impact,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = '#ff4d8d'; x.shadowBlur = 40; x.fillStyle = '#ff4d8d'; x.fillText('POSSUM', s / 2, s * .36); x.fillStyle = '#ffd34d'; x.shadowColor = '#ffd34d'; x.fillText('GRAND', s / 2, s * .64);
    x.shadowBlur = 0; x.globalAlpha = .55; x.fillStyle = '#fff'; x.fillText('POSSUM', s / 2, s * .36); x.fillText('GRAND', s / 2, s * .64);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  sign.position.set(cx - hw + .2, top + 7.2, cz + 1); sign.rotation.y = -Math.PI / 2; group.add(sign);
  for (const w of [-4.5, 6.5]) { const leg = new THREE.Mesh(G.box, M.steel); leg.position.set(cx - hw + .5, top + 3.4, cz + w); leg.scale.set(.14, 6.8, .14); group.add(leg); }
  game.scene.add(group);
  game.markers.push({ x: cx, z: cz, color: '#ff7a2f', glyph: '▲', size: 6 });

  const site = {
    x: cx, z: cz, hw, hd, rise, decks, base, top, yOf, safe, jump, group,
    // the foot and the head of the ramp that leaves deck k (0 = the ground)
    rampFoot: (k) => ({ x: cx - run - 1.6, z: cz + wBay, y: yOf(k) }), rampHead: (k) => ({ x: cx + run + 1.8, z: cz + wBay, y: yOf(k + 1) }),
    // a spot on deck k: (u, w) are metres east and north of the middle
    at: (k, u, w) => [cx + u, cz + w, yOf(k)],
    // the part of a deck guards keep to (clear of the rails and the ramp bay)
    box: [cx - hw + 1, cx + hw - 1, cz - hd + bay + .9, cz + hd - 1],
    inside: (x, z, m = 0) => Math.abs(x - cx) < hw + m && Math.abs(z - cz) < hd + m,
    // which deck is someone at this height on (0 = the ground)
    deckOf: (y) => Math.max(0, Math.min(decks, Math.round((y - base) / rise))),
  };
  return site;
}
