// Draws the land outside downtown: rolling ground, roads over the hills, road paint and the sea.
// The world is cut into three kinds of piece that share edges exactly, so there are no gaps:
// 14 m corner squares, 14 x 40 m edge strips (a road, or just land) and 40 x 40 m blocks.
import * as THREE from 'three';
import { noise2 } from '../core/utils.js';
import { STEP, N, X0, ROAD_HALF, WATER, CITY, CITY_EDGE, cellType, hasRoad, nodeHasRoad, nodeX } from './map.js';
import { landY } from './terrain.js';
import { mats, std, ctex } from './materials.js';

const R = ROAD_HALF, IN = STEP - 2 * R;     // 7, 40
const inCity = (i) => i >= CITY.i0 && i <= CITY.i1;

// ---------- colours of the land ----------
const C = (h) => new THREE.Color(h);
const TINT = {
  grass: C(0x7fb85f), park: C(0x78bd62), hill: C(0x86b861), scrub: C(0xb9b26d), dirt: C(0xcda274), sand: C(0xf3dfb2),
  rock: C(0xb09a86), sea: C(0xd9c79c), port: C(0xb9b3a8), quay: C(0xb9b3a8), city: C(0xb9b3a8),
};
const ROCK = C(0xa8917e), WET = C(0xc6ad82), DRY = C(0xd9c27c);
const typeAt = (x, z) => cellType(Math.max(0, Math.min(N - 2, Math.floor((x - X0) / STEP))), Math.max(0, Math.min(N - 2, Math.floor((z - X0) / STEP))));
const _c = new THREE.Color(), _t = new THREE.Color();
// Colour of open land at a spot: neighbouring kinds of land melt into each other over ~10 m.
export function landColor(x, z, y, slope, out = _c) {
  out.setRGB(0, 0, 0);
  for (const [ox, oz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) { const t = TINT[typeAt(x + ox, z + oz)]; out.r += t.r * .25; out.g += t.g * .25; out.b += t.b * .25; }
  const n = noise2(x * .045, z * .045), n2 = noise2(x * .21 + 40, z * .21);
  const green = out.g - out.r;                                   // only grassy ground gets dry patches
  if (green > .05) out.lerp(DRY, Math.max(0, n - .62) * 1.6);
  if (slope > .42) out.lerp(ROCK, Math.min(1, (slope - .42) * 3.2));
  if (y < WATER + .45) out.lerp(WET, Math.min(1, (WATER + .45 - y) * 1.6));
  return out.multiplyScalar(.86 + n * .2 + n2 * .1);
}

export function buildGround(scene) {
  const landTex = ctex(256, (x, s) => {
    const d = x.createImageData(s, s);
    for (let i = 0; i < d.data.length; i += 4) { const v = 226 + (Math.random() - .5) * 44; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${Math.random() * .06})`; x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 6 + Math.random() * 26, 0, 7); x.fill(); }
  });
  const concreteTex = ctex(256, (x, s) => {
    const d = x.createImageData(s, s);
    for (let i = 0; i < d.data.length; i += 4) { const v = 228 + (Math.random() - .5) * 26; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); x.strokeStyle = 'rgba(60,55,50,.22)'; x.lineWidth = 3; x.strokeRect(0, 0, s, s);
  });
  mats.land = std({ map: landTex, vertexColors: true, roughness: .95 });
  mats.concrete = std({ map: concreteTex, color: 0xc4bdb1, roughness: .88 });
  mats.roadPaint = std({ vertexColors: true, roughness: .6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  mats.seaTop = std({ color: 0x2b8fa8, roughness: .12, metalness: .25, transparent: true, opacity: .86 });

  // one growing mesh per material per 108 m chunk
  const chunks = new Map();
  function target(kind, x, z) {
    const k = kind + '|' + Math.floor((x - X0) / (STEP * 2)) + ',' + Math.floor((z - X0) / (STEP * 2));
    let t = chunks.get(k); if (!t) chunks.set(k, t = { kind, pos: [], nor: [], uv: [], col: [], idx: [] });
    return t;
  }
  const E = .6;
  function patch(kind, x0, z0, w, d, nx, nz) {
    const t = target(kind, x0 + w / 2, z0 + d / 2), base = t.pos.length / 3;
    const tile = kind === 'asphalt' ? 420 : kind === 'concrete' ? 6 : 9;    // asphalt uses downtown's texture scale
    for (let b = 0; b <= nz; b++) for (let a = 0; a <= nx; a++) {
      const x = x0 + w * a / nx, z = z0 + d * b / nz, y = landY(x, z);
      const sx = (landY(x + E, z) - landY(x - E, z)) / (2 * E), sz = (landY(x, z + E) - landY(x, z - E)) / (2 * E), l = Math.hypot(sx, 1, sz);
      t.pos.push(x, y, z); t.nor.push(-sx / l, 1 / l, -sz / l); t.uv.push(x / tile, z / tile);
      if (kind === 'land') { const c = landColor(x, z, y, Math.hypot(sx, sz)); t.col.push(c.r, c.g, c.b); }
    }
    for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) {
      const p = base + b * (nx + 1) + a; t.idx.push(p, p + nx + 1, p + 1, p + 1, p + nx + 1, p + nx + 2);
    }
  }
  const allPort = (list) => list.every(([ci, cj]) => ci >= 0 && cj >= 0 && ci < N - 1 && cj < N - 1 && cellType(ci, cj) === 'port');

  for (let ci = 0; ci < N - 1; ci++) for (let cj = 0; cj < N - 1; cj++) {
    const type = cellType(ci, cj); if (type === 'city') continue;
    const flat = type === 'sea' && cj <= 0;
    patch(type === 'port' ? 'concrete' : 'land', nodeX(ci) + R, nodeX(cj) + R, IN, IN, flat ? 1 : 16, flat ? 1 : 16);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = nodeX(i), z = nodeX(j);
    if (!(inCity(i) && inCity(j)))        // corner square
      patch(nodeHasRoad(i, j) ? 'asphalt' : allPort([[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) ? 'concrete' : 'land', x - R, z - R, 2 * R, 2 * R, 4, 4);
    if (i < N - 1 && !(inCity(i) && inCity(i + 1) && inCity(j)))   // strip running east from this corner
      patch(hasRoad(i, j, i + 1, j) ? 'asphalt' : allPort([[i, j - 1], [i, j]]) ? 'concrete' : 'land', x + R, z - R, IN, 2 * R, 16, 4);
    if (j < N - 1 && !(inCity(j) && inCity(j + 1) && inCity(i)))   // strip running north
      patch(hasRoad(i, j, i, j + 1) ? 'asphalt' : allPort([[i - 1, j], [i, j]]) ? 'concrete' : 'land', x - R, z + R, 2 * R, IN, 4, 16);
  }
  const matOf = { land: mats.land, asphalt: mats.asphalt, concrete: mats.concrete };
  for (const t of chunks.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(t.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(t.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(t.uv, 2)); if (t.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(t.col, 3));
    g.setIndex(t.idx);
    const m = new THREE.Mesh(g, matOf[t.kind]); m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m);
  }

  // ---------- road paint outside downtown: double yellow down the middle, white lane dashes ----------
  const P = { pos: [], col: [], idx: [] }, yellow = C(0xf2c230), white = C(0xf4f4f0);
  // a painted line from a to b (distances along the road), `off` metres left/right of the centre, `w` wide
  function line(ax, az, dx, dz, a, b, off, w, c) {
    const segs = Math.max(1, Math.round((b - a) / 3)), base = P.pos.length / 3, px = -dz, pz = dx;
    for (let k = 0; k <= segs; k++) {
      const s = a + (b - a) * k / segs;
      for (const side of [-1, 1]) {
        const x = ax + dx * s + px * (off + side * w / 2), z = az + dz * s + pz * (off + side * w / 2);
        P.pos.push(x, landY(x, z) + .035, z); P.col.push(c.r, c.g, c.b);
      }
    }
    for (let k = 0; k < segs; k++) { const p = base + k * 2; P.idx.push(p, p + 1, p + 2, p + 2, p + 1, p + 3); }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (const [di, dj] of [[1, 0], [0, 1]]) {
    if (i + di >= N || j + dj >= N || !hasRoad(i, j, i + di, j + dj)) continue;
    if (inCity(i) && inCity(j) && inCity(i + di) && inCity(j + dj)) continue;
    const ax = nodeX(i), az = nodeX(j);
    for (const o of [-.18, .18]) line(ax, az, di, dj, 9.5, STEP - 9.5, o, .14, yellow);
    for (let s = 12; s < STEP - 12; s += 12) for (const o of [-4.6, 4.6]) line(ax, az, di, dj, s, s + 3, o, .14, white);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(P.pos, 3)); pg.setAttribute('color', new THREE.Float32BufferAttribute(P.col, 3)); pg.setIndex(P.idx); pg.computeVertexNormals();
  const paint = new THREE.Mesh(pg, mats.roadPaint); paint.receiveShadow = true; paint.matrixAutoUpdate = false; scene.add(paint);

  // ---------- the sea ----------
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), mats.seaTop);
  sea.rotation.x = -Math.PI / 2; sea.position.y = WATER; sea.receiveShadow = true; scene.add(sea);
}

// The radar's street plan, one pixel per metre. (px, pz) = (x + half, z + half).
export function paintPlan(g, half, decks = []) {
  const col = new THREE.Color(), step = 3;
  for (let x = -half; x < half; x += step) for (let z = -half; z < half; z += step) {
    const cx = x + step / 2, cz = z + step / 2, y = landY(cx, cz);
    if (y < WATER) g.fillStyle = y < WATER - 1 ? '#2b8fa8' : '#49a9bd';
    else { const t = typeAt(cx, cz); if (t === 'port' || t === 'quay') col.set(0x9d988f); else landColor(cx, cz, y, 0, col).multiplyScalar(.82); g.fillStyle = '#' + col.getHexString(); }
    g.fillRect(x + half, z + half, step, step);
  }
  g.fillStyle = '#4a4e57';
  g.fillRect(half - CITY_EDGE, half - CITY_EDGE, CITY_EDGE * 2, CITY_EDGE * 2);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = nodeX(i) + half, z = nodeX(j) + half;
    if (i < N - 1 && hasRoad(i, j, i + 1, j)) g.fillRect(x - R, z - R, STEP + 2 * R, 2 * R);
    if (j < N - 1 && hasRoad(i, j, i, j + 1)) g.fillRect(x - R, z - R, 2 * R, STEP + 2 * R);
  }
  for (const d of decks) {
    if (!d.plan) continue;
    g.save(); g.translate(d.x + half, d.z + half); g.rotate(d.rot || 0); g.fillStyle = d.plan; g.fillRect(-d.hl, -d.hw, d.hl * 2, d.hw * 2); g.restore();
  }
}
