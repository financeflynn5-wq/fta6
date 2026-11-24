// Frostbite Peak, drawn: the snow mountain off the west edge of the map and the ice road up it (the shape of both is in
// snowland.js). Everything is built to be cheap to draw, because the mountain can be seen from half the map:
//   the land            sixteen pieces of one mesh (only the ones in view are drawn), rock low down, snow above
//   the road            one ribbon laid exactly on the ledge, with its banks, and one more for the sheets of ice
//   pines and rocks     four batches (one draw each), poles along the drop one more
//   the gate, the lodge and the mast on top: one welded mesh each, one for every painted sign, one for lit windows
//   falling snow        one cloud of points that travels with the camera
//   from far away       all of the above is swapped for one coarse mesh of the mountain (createSnow().look() decides)
// buildSnowPeak() runs while the map is put together; createSnow() adds what moves once the game is running.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SNOW } from '../config.js';
import { noise2, seeded, damp, clamp } from '../core/utils.js';
import { mats, std, ctex } from './materials.js';
import { landY } from './terrain.js';
import { WATER } from './map.js';
import { landColor } from './ground.js';
import { AREA, SEAM, GATE, PEAK, TOP, HORN, ROAD, LENGTH, roadAt, wildSnow, nearRoad, onMountain, ribbonHalf, tuck } from './snowland.js';

const PI = Math.PI, smooth = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const C = (h) => new THREE.Color(h);
const SNOWC = C(0xfbfdff), SHADE = C(0xbfd6f2), STONE = C(0x6f7384), STONE2 = C(0x9a94a0), BAND = C(0x4f5263), DIRT = C(0x9b8466), RUT = C(0x7c6850), GRAVEL = C(0xb3a48c), PACK = C(0xc6d4e5), TRACK = C(0x8094ae), FACE = C(0x8d7866);
const _c = new THREE.Color(), _d = new THREE.Color(), _e = new THREE.Color();
const SIDE = .4;                                  // the level strip beside the road (the same number as snowland.js SHOULDER)

// The colour of the mountainside at a spot. Low down it is the map's own rock, so nothing shows where the two meet.
// Bare rock high up: cold grey, in beds that show on the steep faces.
function rockColor(x, z, y, slope, out) {
  const bed = Math.sin(y * .62 + noise2(x * .012, z * .012) * 9) * .5 + .5, bed2 = noise2(y * .9 + 3, (x + z) * .004);
  return out.copy(STONE).lerp(STONE2, noise2(x * .02 + y * .09, z * .02 - y * .07)).lerp(BAND, smooth((bed - .62) / .25) * .55 * smooth((slope - .5) / .5)).multiplyScalar(.84 + bed2 * .2 + noise2(x * .21, z * .21) * .16);
}
// skin.soft and skin.snow are left set for the same spot: how far the map's blotchy ground texture is smoothed away, and how much snow lies there.
export const skin = { soft: 0, snow: 0 };
export function peakColor(x, z, y, slope, out = _c) {
  landColor(x, z, y, slope, out);
  const far = smooth((SEAM - 4 - x) / 44);
  // bare rock: warm and sandy like the ridge low down, cold grey higher up, in beds that show on the steep faces
  const alpine = smooth((y - 30) / 50) * far;
  if (alpine > 0) out.lerp(rockColor(x, z, y, slope, _d), alpine);
  const sn = wildSnow(x, z, y, slope) * far * smooth((Math.hypot(x - HORN.x, z - HORN.z) - HORN.r * .62) / (HORN.r * .4));      // (the crag on top is bare)
  if (sn > 0) { _d.copy(SNOWC).lerp(SHADE, clamp(slope * .42 + noise2(x * .05 + 20, z * .05) * .5 - .32, 0, .85)); out.lerp(_d, sn); }
  skin.soft = Math.max(alpine, sn); skin.snow = sn;
  return out;
}
const slopeAt = (x, z) => Math.hypot(landY(x + 1.2, z) - landY(x - 1.2, z), landY(x, z + 1.2) - landY(x, z - 1.2)) / 2.4;

// Far off, haze normally swallows everything. A mountain this size should still show through it, faintly, the way a real
// one does from a city: so its own haze never quite closes over it.
const fogCap = (keep, more = '') => `#ifdef USE_FOG\n float fogFactor = min( smoothstep( fogNear, fogFar, vFogDepth ), ${(1 - keep).toFixed(3)}${more} );\n gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n#endif`;
function hazy(mat, keep = .2) {
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', fogCap(keep)); };
  mat.customProgramCacheKey = () => 'hazy' + keep;
  return mat;
}
// The land's own material does two more things, both steered by a pair of numbers on every corner (`skin`: soft, snow):
// the ground texture the rest of the map uses is blotchy, which suits grass and sand but not snow, so it is smoothed
// away where `soft` says; and snow keeps some brightness of its own in the shade (LIFT, by day), or the side of the
// mountain that faces the city, away from the sun, would be grey.
const LIFT = { value: .24 };
function landSkin(mat, keep = .2) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLift = LIFT;
    sh.vertexShader = 'attribute vec2 skin;\nvarying vec2 vSkin;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSkin = skin;');
    sh.fragmentShader = 'varying vec2 vSkin;\nuniform float uLift;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', '#ifdef USE_MAP\n vec4 texel = texture2D( map, vMapUv );\n diffuseColor.rgb *= mix( texel.rgb, vec3( .95 ) + ( texel.rgb - vec3( .76 ) ) * .22, vSkin.x );\n#endif')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vec3( .8, .9, 1.06 ) * ( vSkin.y * uLift );')
      .replace('#include <fog_fragment>', fogCap(keep, ' - .26 * vSkin.y'));          // snow is bright: it shows through haze better than rock
  };
  mat.customProgramCacheKey = () => 'peak' + keep;
  return mat;
}
const geoOf = (pos, idx, col, uv, colSize = 3, sk = null) => {
  const g = new THREE.BufferGeometry(); if (sk) g.setAttribute('skin', new THREE.Float32BufferAttribute(sk, 2));
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, colSize));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); if (idx) g.setIndex(idx); return g;
};

// ---------- small helpers for welded, painted shapes ----------
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 14, 10);
const cyl = (rt, rb, n = 8) => new THREE.CylinderGeometry(rt, rb, 1, n), cone = (n = 8) => new THREE.ConeGeometry(1, 1, n);
// a copy of `geo`, moved into place and painted one colour (or by paint(x, y, z, normalY) -> colour)
function part(list, geo, color, x, y, z, sx = 1, sy = sx, sz = sx, ry = 0, rx = 0, rz = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  g.applyMatrix4(m4.compose(v3(x, y, z), q4.setFromEuler(e4.set(rx, ry, rz)), v3(sx, sy, sz)));
  const n = g.attributes.position.count, a = new Float32Array(n * 3), P = g.attributes.position, N = g.attributes.normal;
  for (let i = 0; i < n; i++) { const c = typeof color === 'function' ? color(P.getX(i), P.getY(i), P.getZ(i), N.getY(i)) : _c.set(color); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); list.push(g); return g;
}
function weld(list, mat, scene, cast = true) {
  const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = cast; m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m);
  list.forEach(g => g.dispose()); return m;
}
// a roof with a ridge along x: w wide, d deep, h high at the ridge
function gable(w, d, h) {
  const x = w / 2, z = d / 2, p = [-x, 0, z, x, 0, z, x, h, 0, -x, 0, z, x, h, 0, -x, h, 0, x, 0, -z, -x, 0, -z, -x, h, 0, x, 0, -z, -x, h, 0, x, h, 0, -x, 0, -z, -x, 0, z, -x, h, 0, x, 0, z, x, 0, -z, x, h, 0, -x, 0, -z, x, 0, -z, x, 0, z, -x, 0, -z, x, 0, z, -x, 0, z];
  const g = geoOf(p); g.computeVertexNormals(); return g;
}

export function buildSnowPeak({ realScene, solids }) {
  // everything put up here is remembered: from across the map the whole lot is swapped for one plain shape of the mountain (createSnow does the swapping)
  const near = [], scene = { add(...ms) { for (const m of ms) { realScene.add(m); near.push(m); } } };
  const R = seeded(71717), rr = (a, b) => a + R() * (b - a);
  const landMat = landSkin(std({ map: mats.land.map, vertexColors: true, roughness: .92 }));
  const roadMat = landSkin(std({ map: mats.land.map, vertexColors: true, roughness: .92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  const propMat = hazy(std({ vertexColors: true, roughness: .86 }), .12);
  const out = { near, low: null, lift: LIFT, glow: null, beacon: null, chimney: null, gate: { x: GATE.x - 14, z: GATE.z }, top: null, drop: null };

  // =====================================================================================
  // the land
  // =====================================================================================
  {
    const G = 3, nx = Math.ceil((SEAM - AREA.x0) / G), nz = Math.round((AREA.z1 - AREA.z0) / G), x0 = SEAM - nx * G, z0 = AREA.z0, W = nx + 1, H = nz + 1;
    const ys = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) ys[j * W + i] = landY(clamp(x0 + i * G, AREA.x0 + .5, 1e9), clamp(z0 + j * G, AREA.z0 + .5, AREA.z1 - .5));      // (its own edges are still its own land)
    const at = (i, j) => ys[clamp(j, 0, H - 1) * W + clamp(i, 0, W - 1)];
    const CH = 50;
    for (let cj = 0; cj < nz; cj += CH) for (let ci = 0; ci < nx; ci += CH) {
      const i1 = Math.min(nx, ci + CH), j1 = Math.min(nz, cj + CH), w = i1 - ci + 1, pos = [], nor = [], col = [], uv = [], idx = [], sk = [], under = new Set();
      for (let j = cj; j <= j1; j++) for (let i = ci; i <= i1; i++) {
        let x = x0 + i * G, z = z0 + j * G, y = at(i, j), sx = (at(i + 1, j) - at(i - 1, j)) / (2 * G), sz = (at(i, j + 1) - at(i, j - 1)) / (2 * G);
        const k = tuck(x, z);          // under the road's own mesh: the land stops at its rim
        if (k) { x = k.x; z = k.z; y = k.y; sx = (landY(x + 1, z) - landY(x - 1, z)) / 2; sz = (landY(x, z + 1) - landY(x, z - 1)) / 2; under.add(pos.length / 3); }
        const l = Math.hypot(sx, 1, sz);
        pos.push(x, y, z); nor.push(-sx / l, 1 / l, -sz / l); uv.push(x / 9, z / 9);
        const c = peakColor(x, z, y, Math.hypot(sx, sz)); col.push(c.r, c.g, c.b); sk.push(skin.soft, skin.snow);
      }
      for (let j = cj; j < j1; j++) for (let i = ci; i < i1; i++) {
        if (Math.max(at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1)) < WATER - 1.4) continue;      // sea bed nobody will ever see
        const p = (j - cj) * w + (i - ci);
        for (const [a, b, c] of [[p, p + w, p + 1], [p + 1, p + w, p + w + 1]]) if (!(under.has(a) && under.has(b) && under.has(c))) idx.push(a, b, c);
      }
      if (i1 === nx) {             // a lip along the seam, tucked under the edge of the map's own ground
        for (let j = cj; j <= j1; j++) { const p = (j - cj) * w + (i1 - ci), n = pos.length / 3; pos.push(SEAM + 3, at(nx, j) - 3, z0 + j * G); nor.push(nor[p * 3], nor[p * 3 + 1], nor[p * 3 + 2]); col.push(col[p * 3], col[p * 3 + 1], col[p * 3 + 2]); uv.push(uv[p * 2], uv[p * 2 + 1]); sk.push(sk[p * 2], sk[p * 2 + 1]); if (j > cj) idx.push(p - w, p, n - 1, n - 1, p, n); }
      }
      if (!idx.length) continue;
      const g = geoOf(pos, idx, col, uv, 3, sk); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      const m = new THREE.Mesh(g, landMat); m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m);
    }
  }

  // =====================================================================================
  // the road: a ribbon across the ledge and both its banks, and the ice on top of it
  // =====================================================================================
  {
    const pos = [], col = [], uv = [], idx = [], sk = [], ipos = [], icol = [], iidx = [], iuv = [];
    // across the road: the tracks, the edge, the level strip beside it, five steps up (or down) the bank, and a skirt tucked under the land
    const BANK = [.12, .3, .52, .8, 1, 1.004];
    const lat = (hw) => { const e = hw + SIDE, w = ribbonHalf(hw) - e, a = [0, .55, 1.05, 1.55, hw - .35, hw, e, ...BANK.map(f => e + f * w)], o = []; for (let k = a.length - 1; k > 0; k--) o.push(-a[k]); return o.concat(a); };
    const N = lat(3).length, END = ROAD.length - 1;
    for (let i = 0; i < ROAD.length; i++) {
      const p = ROAD[i], L = lat(p.hw), nxr = -p.tz, nzr = p.tx;
      for (let k = 0; k < N; k++) {
        const l = L[k], a = Math.abs(l), x = p.x + nxr * l, z = p.z + nzr * l, edge = k === 0 || k === N - 1;
        let y, c;
        if (a <= p.hw + SIDE + .01) {
          y = p.y + .03;
          const n = noise2(x * .5, z * .5), rut = Math.max(0, 1 - Math.abs(a - 1.05) / .5), rim = smooth((a - p.hw + .5) / .6), fade = smooth((LENGTH - p.s) / 14);
          _d.copy(DIRT).lerp(RUT, rut * .7).lerp(GRAVEL, rim * .8).multiplyScalar(.9 + n * .2);
          c = _c.copy(PACK).lerp(TRACK, rut * .85 * fade).lerp(SNOWC, Math.max(rim, 1 - fade)).multiplyScalar(.95 + n * .08);
          c.lerpColors(_d, c, p.snow);
          sk.push(Math.max(p.snow, smooth((p.y - 30) / 50) * smooth((SEAM - 4 - x) / 44)), p.snow * (.25 + .75 * Math.max(rim, 1 - fade)));
        } else {
          y = landY(x, z); c = peakColor(x, z, y, slopeAt(x, z));
          // where the ledge is cut into the mountain the bank is a face of bare rock, with the snow lying over its top
          const f = (a - p.hw - SIDE) / (ribbonHalf(p.hw) - p.hw - SIDE), face = smooth((y - p.y - .5) / 1.6) * (1 - smooth((f - .5) / .42)) * smooth((p.s - 40) / 60);
          if (face > 0) { const hi = smooth((y - 34) / 46); rockColor(x, z, y * 3.1, 1.6, _e).multiplyScalar(.74); _d.copy(FACE).multiplyScalar(.8 + noise2(x * .3, y * .9 + z * .3) * .3).lerp(_e, hi); c.lerp(_d, face); skin.soft = Math.max(skin.soft, face * hi); skin.snow *= 1 - face; }
          sk.push(skin.soft, skin.snow);
          y += edge ? -1.3 : .03 + .09 * (a - p.hw - SIDE) / (ribbonHalf(p.hw) - p.hw - SIDE);
        }
        pos.push(x, y, z); col.push(c.r, c.g, c.b); uv.push(x / 9, z / 9);
      }
      if (i) for (let k = 0; k < N - 1; k++) { const a = (i - 1) * N + k, b = i * N + k; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    }
    const g = geoOf(pos, idx, col, uv, 3, sk); g.computeVertexNormals();
    const road = new THREE.Mesh(g, roadMat); road.receiveShadow = true; road.matrixAutoUpdate = false; scene.add(road);
    // ice: a hard shine laid over the packed snow, see-through at its ends and edges
    let row = 0, on = false;
    for (let i = 0; i < ROAD.length; i++) {
      const p = ROAD[i]; if (p.ice <= 0) { on = false; continue; }
      const nxr = -p.tz, nzr = p.tx, w = p.hw - .15;
      for (const [l, a] of [[-w, 0], [-w + .9, 1], [-w * .3, .9], [w * .3, .9], [w - .9, 1], [w, 0]]) { const n = noise2((p.x + nxr * l) * .35, (p.z + nzr * l) * .35); ipos.push(p.x + nxr * l, p.y + .06, p.z + nzr * l); icol.push(.8 + n * .2, .9 + n * .1, 1, a * p.ice * (.86 + n * .14)); iuv.push(l / 7, p.s / 7); }
      if (on) for (let k = 0; k < 5; k++) { const a = (row - 1) * 6 + k, b = row * 6 + k; iidx.push(a, a + 1, b, b, a + 1, b + 1); }
      on = true; row++;
    }
    const ig = geoOf(ipos, iidx, icol, iuv, 4); ig.computeVertexNormals();
    // what sheet ice looks like from a cab: deep blue-green, white where it has been scuffed, with cracks running through it
    const iceTex = ctex(512, (x, s) => {
      x.fillStyle = '#3f97d6'; x.fillRect(0, 0, s, s);
      const rnd = seeded(9091), wrap = (draw) => { for (const ox of [-s, 0, s]) for (const oz of [-s, 0, s]) { x.save(); x.translate(ox, oz); draw(); x.restore(); } };      // everything is drawn nine times over, so the picture tiles without a seam
      for (let i = 0; i < 60; i++) { const c = rnd() < .5 ? '170,224,255' : '24,92,160', a = .06 + rnd() * .1, px = rnd() * s, py = rnd() * s, rx = 24 + rnd() * 70, ry = 10 + rnd() * 28, rot = rnd() * 3; wrap(() => { x.fillStyle = `rgba(${c},${a})`; x.beginPath(); x.ellipse(px, py, rx, ry, rot, 0, 7); x.fill(); }); }
      x.lineCap = 'round';
      for (let i = 0; i < 22; i++) {           // cracks: a white line that wanders
        let px = rnd() * s, py = rnd() * s, a = rnd() * 6.28; const pts = [[px, py]], al = .5 + rnd() * .4, lw = 1 + rnd() * 2.2;
        for (let k = 0; k < 9; k++) { a += (rnd() - .5) * 1.1; px += Math.cos(a) * (14 + rnd() * 26); py += Math.sin(a) * (14 + rnd() * 26); pts.push([px, py]); }
        wrap(() => { x.strokeStyle = `rgba(240,250,255,${al})`; x.lineWidth = lw; x.beginPath(); pts.forEach(([u, v], k) => k ? x.lineTo(u, v) : x.moveTo(u, v)); x.stroke(); });
      }
      for (let i = 0; i < 220; i++) { const al = .1 + rnd() * .22, px = rnd() * s, py = rnd() * s, l = 8 + rnd() * 40, a = 1.57 + (rnd() - .5) * .5; wrap(() => { x.strokeStyle = `rgba(255,255,255,${al})`; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }); }      // scuffs along the way the trucks go
    });
    const iceMat = hazy(std({ color: 0xffffff, map: iceTex, vertexColors: true, roughness: .05, metalness: .25, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const ice = new THREE.Mesh(ig, iceMat); ice.receiveShadow = true; ice.matrixAutoUpdate = false; ice.renderOrder = 1; scene.add(ice);

    // the rock face on the uphill side is a wall you scrape along, not a slope you ride up
    for (let i = 4; i < ROAD.length - 6; i += 2) {
      const p = ROAD[i], b = ROAD[i + 2], rot = Math.atan2(b.z - p.z, b.x - p.x), mx = (p.x + b.x) / 2, mz = (p.z + b.z) / 2, hw = (p.hw + b.hw) / 2;
      for (const s of [-1, 1]) {
        const o = hw + SIDE + SNOW.cut * .62, ox = -Math.sin(rot) * s, oz = Math.cos(rot) * s;
        if (landY(mx + ox * o, mz + oz * o) < (p.y + b.y) / 2 + 1.7) continue;
        const w = hw + SIDE + .75; solids.walls.push({ x: mx + ox * (w + .45), z: mz + oz * (w + .45), hl: Math.hypot(b.x - p.x, b.z - p.z) / 2 + .35, ht: .45, rot, kind: 'low', h: p.y + 6 });
      }
    }
  }

  // which side of the road the drop is on at a point (+1 right of the way up, -1 left, 0 neither)
  const dropSide = (p) => { const o = p.hw + 3.6, a = landY(p.x - p.tz * o, p.z + p.tx * o) - p.y, b = landY(p.x + p.tz * o, p.z - p.tx * o) - p.y; return Math.min(a, b) > -1.2 ? 0 : a < b ? 1 : -1; };

  // =====================================================================================
  // pines, boulders and the poles that mark the edge
  // =====================================================================================
  {
    const bark = C(0x6a4c36), dark = C(0x2c6b47), green = C(0x3f8f58), frost = C(0xeef3f8);
    function pine(snowy) {
      const l = [];
      part(l, cyl(.2, .34, 6), bark, 0, 1.7, 0, 1, 3.4, 1);
      for (const [r, h, y] of [[2.5, 3.6, 4.3], [1.95, 3.2, 6.3], [1.3, 3, 8.2]]) {
        const g = new THREE.ConeGeometry(1, 1, 9, 2);
        part(l, g, (px, py) => { const t = (py - (y - h / 2)) / h; return snowy ? _c.copy(dark).lerp(frost, smooth((t - .12) / .3)) : _c.copy(dark).lerp(green, t); }, 0, y, 0, r, h, r);
      }
      return mergeGeometries(l);
    }
    const rock = (snowy) => { const l = []; part(l, new THREE.IcosahedronGeometry(1, 1), (x, y, z, ny) => snowy && ny > .3 ? _c.copy(frost) : _c.copy(STONE).lerp(STONE2, noise2(x * 3 + 5, z * 3)), 0, 0, 0); return l[0]; };
    const trees = [[], []], rocks = [[], []], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), tint = [];
    const ok = (x, z, gap) => x < SEAM - 30 && nearRoad(x, z) > gap && Math.hypot(x - PEAK.x, z - PEAK.z) > 62;
    for (let i = 0, tries = 0; i < 430 && tries < 40000; tries++) {
      const x = rr(AREA.x0 + 20, SEAM - 30), z = rr(AREA.z0 + 20, AREA.z1 - 20); if (!ok(x, z, 9.5)) continue;
      const y = landY(x, z); if (y < 8 || R() < smooth((y - 120) / 62) || slopeAt(x, z) > 1.28 || noise2(x * .02 + 70, z * .02) < .36) continue;
      const s = rr(.8, 1.5), k = y > SNOW.snowLine - 16 + rr(-10, 10) ? 1 : 0;
      trees[k].push([m.compose(v3(x, y - .25, z), q.setFromEuler(e.set(0, R() * 6.28, 0)), v3(s, s * rr(.9, 1.2), s)).clone(), rr(.82, 1.06)]);
      if (nearRoad(x, z) < 24) solids.posts.push({ x, z, r: .3 * s, h: y + 8 * s });
      i++;
    }
    for (let i = 0, tries = 0; i < 210 && tries < 20000; tries++) {
      const x = rr(AREA.x0 + 20, SEAM - 26), z = rr(AREA.z0 + 20, AREA.z1 - 20); if (!ok(x, z, 7.5)) continue;
      const y = landY(x, z); if (y < 3) continue;
      const s = rr(.7, 2.6) * (R() < .12 ? 1.8 : 1), k = y > SNOW.snowLine + rr(-8, 14) ? 1 : 0;
      rocks[k].push([m.compose(v3(x, y + s * .12, z), q.setFromEuler(e.set(R() * .5, R() * 6.28, R() * .5)), v3(s * rr(.9, 1.4), s * rr(.55, .9), s * rr(.9, 1.4))).clone(), rr(.8, 1.08)]);
      if (nearRoad(x, z) < 16) solids.posts.push({ x, z, r: s * .8, h: y + s });
      i++;
    }
    const batch = (geo, list, cast) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, propMat, list.length);
      list.forEach(([mm, t], i) => { im.setMatrixAt(i, mm); im.setColorAt(i, _c.setScalar(t)); });
      im.castShadow = cast; im.receiveShadow = true; im.matrixAutoUpdate = false; scene.add(im);
    };
    batch(pine(false), trees[0], true); batch(pine(true), trees[1], true); batch(rock(false), rocks[0], true); batch(rock(true), rocks[1], true);
    // snow poles down the open side: orange, with a dark band and a white cap
    const pl = []; part(pl, cyl(.05, .05, 6), (x, y) => y > 1.42 ? _c.set(0xf4f4f0) : y > 1.14 ? _c.set(0x1d1f24) : _c.set(0xff6a1f), 0, .8, 0, 1, 1.6, 1);
    const poles = [];
    for (let i = 14; i < ROAD.length - 10; i += 4) {
      const p = ROAD[i], tight = p.hw < SNOW.halfWidth - .2; if (!tight && i % 8) continue;
      const side = dropSide(p); if (!side) continue;
      for (const s of tight ? [side, -side] : [side]) { const o = (p.hw + .22) * s; poles.push([m.compose(v3(p.x - p.tz * o, p.y - .05, p.z + p.tx * o), q.setFromEuler(e.set(rr(-.06, .06), 0, rr(-.06, .06))), v3(1, 1, 1)).clone(), 1]); }
    }
    batch(pl[0], poles, false);
  }

  // =====================================================================================
  // painted signs (one picture, one mesh)
  // =====================================================================================
  const font = (px) => `900 ${px}px "Archivo Black",Impact,sans-serif`;
  const signTex = ctex(1024, (x, s) => {
    x.clearRect(0, 0, s, s); x.textAlign = 'center'; x.textBaseline = 'middle';
    // text no wider than `max` pixels, whatever font the browser ended up with
    const put = (t, px, cx, cy, max) => { x.font = font(px); const w = x.measureText(t).width; if (w > max) x.font = font(Math.floor(px * max / w)); x.fillText(t, cx, cy); };
    const board = (px, py, w, h, bg, edge) => { x.fillStyle = edge; x.fillRect(px, py, w, h); x.fillStyle = bg; x.fillRect(px + 10, py + 10, w - 20, h - 20); for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(0,0,0,${.03 + Math.random() * .05})`; x.fillRect(px + 10, py + 10 + Math.random() * (h - 24), w - 20, 2 + Math.random() * 3); } };
    // the gate: the way up, and the way back down
    board(0, 0, 1024, 256, '#12506e', '#f2f6fb');
    x.fillStyle = '#f2f6fb'; put('FROSTBITE PEAK', 104, 512, 100, 930);
    x.fillStyle = '#ffd34d'; put('ICE ROAD TO THE TOP  ·  NO RAILS  ·  NO REFUNDS', 36, 512, 204, 930);
    board(0, 256, 1024, 256, '#12506e', '#f2f6fb');
    x.fillStyle = '#f2f6fb'; put('STILL IN ONE PIECE?', 84, 512, 356, 930);
    x.fillStyle = '#ffd34d'; put('SUNSET COAST THAWS YOU OUT', 42, 512, 456, 930);
    // the lodge
    board(0, 512, 1024, 256, '#6b3f26', '#e9d7b0');
    x.fillStyle = '#ffe9b8'; put('THE FROSTBITE LODGE', 76, 512, 624, 930); x.fillStyle = '#ffd34d'; put('HOT COCOA  ·  COLD EVERYTHING ELSE', 36, 512, 716, 930);
    // the top
    board(0, 768, 512, 256, '#f2f6fb', '#12506e');
    x.fillStyle = '#12506e'; put('FROSTBITE PEAK', 40, 256, 850, 440); x.fillStyle = '#e8455b'; put('212 M', 84, 256, 950, 440);
    // warnings: black on yellow
    for (const [px, a, b] of [[512, 'ICE', '❄'], [768, 'NARROW', '▶ ◀']]) {
      x.fillStyle = '#16171b'; x.fillRect(px, 768, 256, 256); x.fillStyle = '#ffd21f'; x.fillRect(px + 12, 780, 232, 232);
      x.fillStyle = '#16171b'; put(a, a.length > 4 ? 50 : 96, px + 128, a.length > 4 ? 858 : 852, 200); put(b, 72, px + 128, 950, 200);
    }
  });
  signTex.wrapS = signTex.wrapT = THREE.ClampToEdgeWrapping;
  const CELL = { up: [0, 0, 1024, 256], down: [0, 256, 1024, 256], lodge: [0, 512, 1024, 256], top: [0, 768, 512, 256], ice: [512, 768, 256, 256], narrow: [768, 768, 256, 256] };
  const sp = [], suv = [], sidx = [];
  // a board w x h metres centred at (x, y, z), facing along (fx, fz)
  function sign(cell, x, y, z, fx, fz, w, h) {
    const [px, py, cw, ch] = CELL[cell], rx = fz, rz = -fx, n = sp.length / 3, u0 = px / 1024, u1 = (px + cw) / 1024, v1 = 1 - py / 1024, v0 = 1 - (py + ch) / 1024;
    for (const [a, b, u, v] of [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]]) { sp.push(x + rx * a * w / 2 + fx * .07, y + b * h / 2, z + rz * a * w / 2 + fz * .07); suv.push(u, v); }
    sidx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  const wood = C(0x7a5235), woodD = C(0x5c3c26), stone = C(0x8b8883), white = C(0xf2f6fb);
  const side = [];                        // posts, the gate and everything else that stands along the road
  // a warning on a post beside the road, facing whoever is coming up
  function warn(cell, p) {
    const s = dropSide(p) || 1, o = (p.hw + 1.05) * s, x = p.x - p.tz * o, z = p.z + p.tx * o, y = landY(x, z);
    part(side, cyl(.06, .06, 6), 0x5a5f66, x, y + 1.3, z, 1, 2.6, 1); part(side, BOX, 0x16171b, x + p.tx * .02, y + 2.5, z + p.tz * .02, 1.36, 1.36, .05, Math.atan2(-p.tx, -p.tz));
    sign(cell, x, y + 2.5, z, -p.tx, -p.tz, 1.3, 1.3);
  }
  { let was = false; for (const p of ROAD) { const now = p.ice > 0; if (now && !was) warn('ice', ROAD[Math.max(0, p.i - 10)]); was = now; } }
  { let was = false; for (const p of ROAD) { const now = p.hw < SNOW.halfWidth - .05 && p.s > 100; if (now && !was) warn('narrow', ROAD[Math.max(0, p.i - 4)]); was = now; } }

  // ---------- the gate: a timber arch over the road just inside the junction ----------
  {
    const p = ROAD[6], gx = p.x, gz = p.z, gy = p.y, w = p.hw + 1.5;
    for (const s of [-1, 1]) {
      part(side, BOX, stone, gx, gy + .5, gz + s * w, 1.5, 1.2, 1.5); part(side, BOX, white, gx, gy + 1.16, gz + s * w, 1.62, .14, 1.62);
      part(side, cyl(.26, .32, 8), wood, gx, gy + 4.3, gz + s * w, 1, 6.6, 1); part(side, cyl(.2, .2, 8), woodD, gx, gy + 6.5, gz + s * (w - 1.3), 1, 3.2, 1, 0, s * .82, 0);
      solids.posts.push({ x: gx, z: gz + s * w, r: .8, h: gy + 8 });
    }
    part(side, cyl(.3, .3, 8), wood, gx, gy + 7.5, gz, 1, w * 2 + 2.2, 1, 0, PI / 2, 0);
    part(side, BOX, white, gx, gy + 7.86, gz, .5, .16, w * 2 + 2);                      // snow lying on the beam
    part(side, BOX, woodD, gx, gy + 5.95, gz, .52, 2.5, 9.2);                            // the board the two signs are painted on (thick enough to swallow the braces)
    for (const s of [-1, 1]) part(side, cyl(.03, .03, 5), 0x2b2f35, gx, gy + 7.3, gz + s * 3.8, 1, .5, 1);
    sign('up', gx + .21, gy + 5.95, gz, 1, 0, 9, 2.25); sign('down', gx - .21, gy + 5.95, gz, -1, 0, 9, 2.25);
    out.gate = { x: gx, z: gz, y: gy };
  }
  weld(side, propMat, scene);

  // =====================================================================================
  // the top: the lodge, the dock where trucks unload, and the mast on the crag
  // =====================================================================================
  {
    const end = ROAD[ROAD.length - 1], a0 = Math.atan2(end.z - PEAK.z, end.x - PEAK.x), a = a0 - 1.02, ca = Math.cos(a), sa = Math.sin(a);
    const cx = PEAK.x + ca * 35.5, cz = PEAK.z + sa * 35.5, L = [], lit = [];
    // local frame: +z points out from the peak, the door faces -z (inward, where the trucks pull up)
    const logs = (x, y, z, n) => _c.copy(wood).multiplyScalar(.88 + .22 * (Math.floor(y / .32) % 2));
    part(L, BOX, stone, 0, .3, 0, 12.8, .9, 7.8); part(L, BOX, logs, 0, 2.35, 0, 12, 3.3, 7);
    for (const s of [-1, 1]) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([s * 6, 4, -3.5, s * 6, 4, 3.5, s * 6, 6.9, 0], 3)); if (s < 0) g.setIndex([0, 1, 2]); else g.setIndex([0, 2, 1]); const t = g.toNonIndexed(); t.computeVertexNormals(); part(L, t, wood, 0, 0, 0); }
    part(L, gable(13.4, 8.6, 3.35), (x, y, z, ny) => ny < -.5 ? _c.copy(woodD) : _c.copy(white), 0, 3.92, 0);
    for (const s of [-1, 1]) part(L, BOX, woodD, 0, 3.94, s * 4.26, 13.4, .22, .16);
    part(L, BOX, stone, 3.6, 5.6, 1.1, 1.1, 3.6, 1.1); part(L, BOX, white, 3.6, 7.46, 1.1, 1.3, .16, 1.3);
    part(L, BOX, 0xc0392b, 0, 1.85, -3.53, 1.35, 2.3, .12); part(L, BOX, white, 0, 3.08, -3.53, 1.6, .14, .16); part(L, BOX, 0xe2b860, .45, 1.8, -3.61, .1, .1, .06);
    for (const wx of [-3.6, 3.6]) { part(L, BOX, white, wx, 2.5, -3.52, 1.9, 1.5, .1); part(lit, BOX, 0xffc56e, wx, 2.5, -3.56, 1.6, 1.2, .06); part(L, BOX, white, wx, 2.5, -3.6, .08, 1.2, .04); part(L, BOX, white, wx, 2.5, -3.6, 1.6, .08, .04); part(L, BOX, white, wx, 1.72, -3.66, 2, .12, .3); }
    for (const s of [-1, 1]) { part(L, BOX, white, s * 6.02, 2.5, 0, .1, 1.5, 1.9); part(lit, BOX, 0xffc56e, s * 6.06, 2.5, 0, .06, 1.2, 1.6); }
    part(L, BOX, wood, 0, .68, -4.5, 5.4, .2, 2); for (const s of [-1, 1]) part(L, cyl(.11, .11, 6), woodD, s * 2.5, 2.2, -5.3, 1, 3, 1);
    part(L, gable(6, 2.6, .8), (x, y, z, ny) => ny < -.5 ? _c.copy(woodD) : _c.copy(white), 0, 3.6, -4.6);
    part(L, BOX, woodD, 0, 4.72, -3.56, 4.9, 1.3, .1);
    for (const [sx, c] of [[1.25, 0xe8455b], [1.5, 0xe8455b], [1.95, 0x3e6fd6], [2.2, 0x3e6fd6]]) part(L, BOX, c, sx, 1.62, -3.72, .11, 1.9, .03, 0, -.12, 0);      // skis by the door
    // what has been delivered so far: Mouse Bear crates on a pallet, under a dusting of snow
    for (const [x, y, z, s, c] of [[-8.4, .5, -2.6, 1.1, 0x0f9692], [-7.2, .5, -2.9, 1.1, 0xfff3dc], [-8.3, .5, -1.4, 1.1, 0xff5d62], [-7.8, 1.55, -2.6, 1, 0x0f9692], [-7.1, .45, -1.6, .9, 0x0f9692]]) { part(L, BOX, c, x, y + .1, z, s, s, s, .2 * Math.sin(x * 9)); part(L, BOX, white, x, y + .1 + s / 2 + .04, z, s * .96, .08, s * .96, .2 * Math.sin(x * 9)); }
    part(L, BOX, woodD, -7.8, .08, -2.2, 3.2, .14, 3);
    // a snowman in a trucker's cap
    { const sx = 8.6, sz = -6.2; for (const [y, r] of [[.7, .75], [1.75, .55], [2.52, .38]]) part(L, BALL, white, sx, y, sz, r); part(L, cone(6), 0xff8a2a, sx, 2.52, sz - .5, .07, .42, .07, 0, -PI / 2, 0);
      for (const e of [-1, 1]) { part(L, BALL, 0x16171b, sx + e * .14, 2.64, sz - .33, .045); part(L, cyl(.025, .025, 4), woodD, sx + e * .78, 1.95, sz, 1, 1, 1, 0, 0, e * 1.05); }
      part(L, cyl(.36, .38, 10), 0xff5d62, sx, 2.9, sz, 1, .24, 1); part(L, BOX, 0xff5d62, sx, 2.81, sz - .42, .52, .05, .4); }
    // a flag in the company's colours
    part(L, cyl(.06, .08, 6), 0xc8ccd0, -9.4, 4, -6.6, 1, 8, 1); part(L, BOX, 0x0f9692, -8.35, 7.3, -6.6, 2, 1.25, .04); part(L, BOX, 0xfff3dc, -8.35, 7.3, -6.6, 2.02, .3, .05); part(L, BALL, 0xffc145, -9.4, 8.06, -6.6, .12);
    const rot = PI / 2 - a, place = (m) => { m.position.set(cx, TOP, cz); m.rotation.y = rot; m.updateMatrix(); return m; };
    place(weld(L, propMat, scene));
    const glow = new THREE.Mesh(mergeGeometries(lit), new THREE.MeshBasicMaterial({ vertexColors: true })); glow.matrixAutoUpdate = false; scene.add(glow); place(glow); out.glow = glow.material;
    // world positions of things in the lodge's frame
    const W = (lx, lz) => [cx + Math.cos(rot) * lx + Math.sin(rot) * lz, cz - Math.sin(rot) * lx + Math.cos(rot) * lz];
    solids.walls.push({ x: cx, z: cz, hl: 6.2, ht: 3.7, rot: -rot, kind: 'solid', h: TOP + 7 });
    { const [x, z] = W(-7.8, -2.2); solids.walls.push({ x, z, hl: 1.5, ht: 1.4, rot: -rot, kind: 'low', h: TOP + 2 }); }
    { const [x, z] = W(8.6, -6.2); solids.posts.push({ x, z, r: .7, h: TOP + 3 }); } { const [x, z] = W(-9.4, -6.6); solids.posts.push({ x, z, r: .2, h: TOP + 8 }); }
    { const [x, z] = W(0, -3.62); sign('lodge', x, TOP + 4.72, z, -ca, -sa, 4.7, 1.175); }
    { const [x, z] = W(3.6, 1.1); out.chimney = { x, y: TOP + 7.7, z }; }
    { const [x, z] = W(0, -10); out.drop = { x, z, y: TOP, face: a }; }
    out.lodge = { x: cx, z: cz, rot };
    // "you are here": a board on two posts where the road comes over the edge
    {
      const p = ROAD[ROAD.length - 9], s = dropSide(p) || 1, o = (p.hw + 2.6) * s, x = p.x - p.tz * o, z = p.z + p.tx * o, y = landY(x, z), T = [];
      for (const k of [-1, 1]) part(T, cyl(.1, .1, 6), wood, x - p.tz * k * 1.5, y + 1.4, z + p.tx * k * 1.5, 1, 2.8, 1);
      part(T, BOX, woodD, x + p.tx * .04, y + 2.1, z + p.tz * .04, 4.2, 2.2, .1, Math.atan2(-p.tx, -p.tz)); part(T, BOX, white, x, y + 3.24, z, 4.3, .12, .3, Math.atan2(-p.tx, -p.tz));
      sign('top', x, y + 2.1, z, -p.tx, -p.tz, 4, 2); weld(T, propMat, scene); solids.posts.push({ x, z, r: 1.4, h: y + 3 });
    }
    // the mast on the crag: red and white, a couple of dishes, a light on top
    {
      const T = [], y0 = landY(HORN.x, HORN.z) - .6;
      for (let k = 0; k < 8; k++) part(T, BOX, k % 2 ? 0xf2f2f2 : 0xd8322e, HORN.x, y0 + 1 + k * 2, HORN.z, .42 - k * .025, 2, .42 - k * .025);
      part(T, cyl(.9, .9, 14), 0xe9edf2, HORN.x + .5, y0 + 9, HORN.z, 1, .25, 1, 0, 0, PI / 2); part(T, cyl(.7, .7, 14), 0xe9edf2, HORN.x, y0 + 12, HORN.z - .45, 1, .22, 1, 0, PI / 2, 0);
      part(T, BOX, stone, HORN.x, y0 + .3, HORN.z, 2.2, .8, 2.2);
      weld(T, propMat, scene);
      const b = new THREE.Mesh(new THREE.SphereGeometry(.42, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a, fog: false })); b.position.set(HORN.x, y0 + 17.3, HORN.z); b.updateMatrix(); b.matrixAutoUpdate = false; realScene.add(b); out.beacon = b;      // (no haze on it: the light on the mast shows from anywhere, like any warning light)
      out.top = { x: HORN.x, z: HORN.z, y: y0 + 17 };
    }
    // a few big pines and boulders round the rim of the shelf
    {
      const T = [], dark = C(0x2c6b47), frost = C(0xeef3f8);
      for (let k = 0; k < 9; k++) {
        const th = a - 1.2 - k * .47 + rr(-.1, .1), d = rr(33, 39), x = PEAK.x + Math.cos(th) * d, z = PEAK.z + Math.sin(th) * d; if (nearRoad(x, z) < 11 || Math.hypot(x - cx, z - cz) < 13) continue;
        const s = rr(.9, 1.35), y = landY(x, z) - .2;
        part(T, cyl(.2, .34, 6), 0x6a4c36, x, y + 1.7 * s, z, s, 3.4 * s, s);
        for (const [r, h, yy] of [[2.5, 3.6, 4.3], [1.95, 3.2, 6.3], [1.3, 3, 8.2]]) part(T, new THREE.ConeGeometry(1, 1, 9, 2), (px, py) => _c.copy(dark).lerp(frost, smooth(((py - y) / s - (yy - h / 2)) / h / .3 - .4)), x, y + yy * s, z, r * s, h * s, r * s);
        solids.posts.push({ x, z, r: .35 * s, h: y + 9 });
      }
      if (T.length) weld(T, propMat, scene);
    }
  }
  {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(suv, 2)); g.setIndex(sidx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, std({ map: signTex, roughness: .8 })); m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m);
  }
  // =====================================================================================
  // the mountain from far away: one mesh, a corner every 12 m, no road, no trees
  // =====================================================================================
  {
    const G = 12, nx = Math.ceil((SEAM - AREA.x0) / G), nz = Math.round((AREA.z1 - AREA.z0) / G), x0 = SEAM - nx * G, W = nx + 1, pos = [], nor = [], col = [], uv = [], sk = [], idx = [], ys = [];
    const H = (x, z) => landY(clamp(x, AREA.x0 + .5, SEAM), clamp(z, AREA.z0 + .5, AREA.z1 - .5));
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + i * G, z = AREA.z0 + j * G, y = H(x, z), sx = (H(x + 6, z) - H(x - 6, z)) / 12, sz = (H(x, z + 6) - H(x, z - 6)) / 12, l = Math.hypot(sx, 1, sz);
      ys.push(y); pos.push(x, y, z); nor.push(-sx / l, 1 / l, -sz / l); uv.push(x / 9, z / 9);
      const c = peakColor(x, z, y, Math.hypot(sx, sz)); col.push(c.r, c.g, c.b); sk.push(1, skin.snow);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const p = j * W + i; if (Math.max(ys[p], ys[p + 1], ys[p + W], ys[p + W + 1]) < WATER - 1.4) continue; idx.push(p, p + W, p + 1, p + 1, p + W, p + W + 1); }
    const g = geoOf(pos, idx, col, uv, 3, sk); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const m = out.low = new THREE.Mesh(g, landMat); m.matrixAutoUpdate = false; m.visible = false; realScene.add(m);
  }
  return out;
}

// The radar's picture of the mountain (the plan is one pixel per metre; minimap.js has already moved the pen so x, z are world metres + half).
export function paintSnowPlan(g, half) {
  const col = new THREE.Color(), step = 3;
  for (let x = AREA.x0; x < SEAM; x += step) for (let z = AREA.z0; z < AREA.z1; z += step) {
    const cx = x + step / 2, cz = z + step / 2, y = landY(cx, cz);
    if (y < WATER) g.fillStyle = y < WATER - 1 ? '#2b8fa8' : '#49a9bd';
    else {          // lit from the south-west, like the mountain itself
      const sx = (landY(cx + 2, cz) - landY(cx - 2, cz)) / 4, sz = (landY(cx, cz + 2) - landY(cx, cz - 2)) / 4, lit = (.47 + .51 * sx + .72 * sz) / Math.hypot(1, sx, sz);
      peakColor(cx, cz, y, Math.hypot(sx, sz), col).multiplyScalar(clamp(.74 + .4 * lit, .5, 1.12)); g.fillStyle = '#' + col.getHexString();
    }
    g.fillRect(x + half, z + half, step, step);
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  const stroke = (pick, style, w) => { g.strokeStyle = style; g.lineWidth = w; g.beginPath(); let on = false; for (const p of ROAD) { if (!pick(p)) { on = false; continue; } if (on) g.lineTo(p.x + half, p.z + half); else g.moveTo(p.x + half, p.z + half); on = true; } g.stroke(); };
  stroke(() => true, '#4a4e57', 8.4); stroke((p) => p.snow > .5, '#e6edf5', 5.6); stroke((p) => p.ice > .3, '#7fd0f2', 5.6);
}

// What moves: snow in the air, the light on the mast, the lodge's windows and chimney.
export function createSnow(game) {
  const peak = game.city.snow, scene = game.scene, cam = game.camera;
  const N = SNOW.flakes, BOXW = 76, BOXH = 44, seedA = new Float32Array(N * 3);
  for (let i = 0; i < N * 3; i++) seedA[i] = Math.random();
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(seedA, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAmount: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) }, uPx: { value: 600 } },
    vertexShader: `uniform float uTime; uniform vec3 uCam; uniform float uPx; varying float vA;
      void main() {
        vec3 box = vec3(${BOXW.toFixed(1)}, ${BOXH.toFixed(1)}, ${BOXW.toFixed(1)});
        float f = fract(position.x * 7.31 + position.z * 3.17);
        vec3 p = position * box + vec3(uTime * (1.6 + f * 1.4) + sin(uTime * .7 + position.y * 40.) * .7, -uTime * (2.6 + f * 2.2), uTime * (.7 + f) + cos(uTime * .5 + position.x * 40.) * .7);
        p = mod(p - uCam, box) - box * .5;
        vec4 mv = viewMatrix * vec4(uCam + p, 1.0);
        float d = -mv.z;
        vA = smoothstep(1.2, 5.0, d) * (1.0 - smoothstep(box.x * .34, box.x * .5, length(p.xz))) * (.55 + f * .45);
        gl_PointSize = clamp(uPx * (.065 + f * .07) / max(d, .5), 1.5, 16.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uAmount; uniform vec3 uTint; varying float vA;
      void main() { float r = length(gl_PointCoord - .5) * 2.; float a = (1. - smoothstep(.35, 1., r)) * vA * uAmount; if (a < .01) discard; gl_FragColor = vec4(uTint, a); }`,
  });
  const flakes = new THREE.Points(g, mat); flakes.frustumCulled = false; flakes.visible = false; flakes.renderOrder = 5; flakes.userData.noCull = true; scene.add(flakes);
  let amount = 0, tick = 0, puff = 0, farOn = true;
  // From across the map the mountain is a shape in the haze, and all it needs is that shape: one plain mesh instead of
  // the land in pieces, the road, the ice, the trees and the lodge.
  function look() {
    const fog = scene.fog, c = cam.position, close = Math.hypot(c.x - PEAK.x, c.z - PEAK.z) < (fog ? fog.far : 420) + 330;
    if (close !== farOn) { farOn = close; for (const m of peak.near) m.visible = close; peak.low.visible = !close; }
  }
  game.markers.push({ x: PEAK.x, z: PEAK.z, color: '#eaf6ff', glyph: '▲', ink: '#1f6f9c', size: 8.5, visible: () => !game.match?.on });

  return {
    peak, look,
    // how hard it is snowing where the camera is (0..1)
    get amount() { return amount; },
    update(dt, t) {
      const c = cam.position, night = game.env.night, lamps = mats.lampHead.emissiveIntensity / 5;
      const want = c.x < SEAM + 30 && c.x > AREA.x0 - 60 && c.z > AREA.z0 - 60 && c.z < AREA.z1 + 60 ? smooth((c.y - SNOW.snowLine + 30) / 36) : 0;
      amount = damp(amount, want, 1.2, dt);
      flakes.visible = amount > .01;
      if (flakes.visible) { const u = mat.uniforms; u.uTime.value = t; u.uCam.value.copy(c); u.uAmount.value = amount; u.uTint.value.setScalar(1 - .62 * night); u.uPx.value = game.engine.renderer.domElement.height * .9; }
      peak.glow.color.setScalar(.3 + 2.3 * lamps); peak.lift.value = .24 - .2 * night;
      peak.beacon.visible = night > .25 ? (t * .8) % 1 < .6 : true; peak.beacon.material.color.setScalar(night > .25 ? 3 : 1).multiply(_c.set(0xff2a2a));
      if ((tick -= dt) <= 0) { tick = .5; look(); }
      const ch = peak.chimney, p = game.player;
      if ((puff -= dt) <= 0 && Math.abs(p.x - ch.x) < 150 && Math.abs(p.z - ch.z) < 150) { puff = .22; game.fx.smoke(ch.x, ch.y, ch.z, .93, .55, 3.2, .5, .2, { rise: 1.5, grow: .5, alpha: .5 }); }
    },
  };
}
export { onMountain, LENGTH };
