// Downtown's towers. A handful of lots in the middle of the city get a high-rise instead of their
// ordinary building: a normal shop-fronted base (so the street looks the same) with a tall shaft on
// top. The shafts are a few big boxes with the windows painted on, so twenty towers cost almost
// nothing to draw. Their windows and rooftop neon come on at dusk (see `glow`).
import * as THREE from 'three';
import { V, seeded } from '../core/utils.js';
import { RESPAWN, JOBS } from '../config.js';
import { mats, std, facadeCols, G, mesh } from './materials.js';

const FLOOR = 3.4, BAY = 3.2, BASE = 11.4;      // metres per storey, per window, and the height of the shop-fronted base
const TILE_U = 4, TILE_V = 8;                   // windows across / storeys up one copy of the window texture

// ---------- which lots get a tower, and how tall ----------
// Answers { h, style, tint } for the lot at block (bi, bj), corner (sx, sz), or null.
export const SUNSET_TOWER = { bi: 0, bj: 0, sx: -1, sz: -1, h: 148 };
const plan = (() => {
  const r = seeded(4711), lots = new Map(), taken = [RESPAWN.hospital.block, RESPAWN.station.block, JOBS.chop.block];
  for (let bi = -2; bi <= 1; bi++) for (let bj = -2; bj <= 1; bj++) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const core = bi >= -1 && bi <= 0 && bj >= -1 && bj <= 0, roll = r(), tall = r(), style = r(), tint = r();
    if (taken.some(([a, b]) => a === bi && b === bj)) continue;
    if (roll > (core ? .56 : .2)) continue;
    lots.set([bi, bj, sx, sz].join(), { h: core ? 58 + tall * 54 : 42 + tall * 30, style: style < .4 ? 'deco' : style < .72 ? 'slab' : 'glass', tint: Math.floor(tint * 97) });
  }
  const S = SUNSET_TOWER; lots.set([S.bi, S.bj, S.sx, S.sz].join(), { h: S.h, style: 'sunset', tint: 3 });
  return lots;
})();
export const towerAt = (bi, bj, sx, sz) => plan.get([bi, bj, sx, sz].join()) || null;

// ---------- painted windows ----------
// One texture holds a 4 x 8 grid of windows in a wall of the tower's colour; two sister textures (shared by every
// tower of a kind) say which windows are lit at night and how shiny the glass is.
function windowPainter(kind, r) {
  const W = 64 * TILE_U, Hh = 64 * TILE_V, lit = [];
  for (let i = 0; i < TILE_U * TILE_V; i++) lit.push(r() < (kind === 'glass' ? .3 : .36));
  const paint = (wall, draw, srgb = true) => {
    const c = document.createElement('canvas'); c.width = W; c.height = Hh;
    const x = c.getContext('2d'); x.fillStyle = wall; x.fillRect(0, 0, W, Hh);
    for (let i = 0; i < TILE_U; i++) for (let f = 0; f < TILE_V; f++) draw(x, i * 64, f * 64, lit[f * TILE_U + i]);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const cell = kind === 'glass'
    ? (x, px, py, frame, glass) => { x.fillStyle = frame; x.fillRect(px, py, 64, 64); x.fillStyle = glass; x.fillRect(px + 3, py + 5, 58, 54); }
    : (x, px, py, frame, glass, sill) => {
      x.fillStyle = frame; x.fillRect(px + 15, py + 9, 34, 44); x.fillStyle = glass; x.fillRect(px + 18, py + 12, 28, 38);
      if (sill) { x.fillStyle = sill; x.fillRect(px + 12, py + 52, 40, 4); }
    };
  const glow = paint('#000000', (x, px, py, on) => { if (on) cell(x, px, py, '#000000', '#ffffff'); });
  // green = roughness, blue = metalness (three.js reads them from those channels)
  const gloss = paint(kind === 'glass' ? 'rgb(0,120,40)' : 'rgb(0,225,0)', (x, px, py) => cell(x, px, py, kind === 'glass' ? 'rgb(0,150,30)' : 'rgb(0,190,0)', kind === 'glass' ? 'rgb(0,26,120)' : 'rgb(0,24,150)', 'rgb(0,190,0)'), false);
  // the colour picture, for a wall (or, for glass towers, a pane) of colour `hex`
  const color = (hex) => {
    const c = new THREE.Color(hex), css = '#' + c.getHexString(), dark = '#' + c.clone().multiplyScalar(.5).getHexString();
    return kind === 'glass'
      ? paint('#e9e4da', (x, px, py) => { cell(x, px, py, '#efeae0', css); x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(px + 3, py + 5, 58, 14); x.fillStyle = dark; x.fillRect(px + 3, py + 50, 58, 9); })
      : paint(css, (x, px, py) => { cell(x, px, py, '#f1ebe0', '#31475c', '#f7f2e8'); x.fillStyle = 'rgba(255,255,255,.13)'; x.fillRect(px + 18, py + 12, 28, 11); });
  };
  return { color, glow, gloss };
}

// A box whose side faces carry whole windows: `len / BAY` across and `h / FLOOR` up. Top and bottom are plain wall.
function windowBox(w, h, d, r) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, floors = Math.max(1, Math.round(h / FLOOR));
  for (let f = 0; f < 6; f++) {
    const side = f < 2 || f > 3, cols = Math.max(1, Math.round((f < 2 ? d : w) / BAY));
    const ou = Math.floor(r() * TILE_U) / TILE_U, ov = Math.floor(r() * TILE_V) / TILE_V;
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (side) uv.setXY(i, ou + uv.getX(i) * cols / TILE_U, ov + uv.getY(i) * floors / TILE_V); else uv.setXY(i, 0, 0);
    }
  }
  return g;
}

// ---------- building them ----------
// lots: [{ x, z, w, d, h, style, tint }] (the footprint is the ordinary building's). api: city.js's helpers.
export function buildSkyline(lots, api) {
  const { scene, solids, building } = api, r = seeded(90210);
  const tex = { wall: windowPainter('wall', r), glass: windowPainter('glass', r) };
  const glow = [];                 // { m, k }: materials that light up at night, and how brightly
  const wallMats = new Map();
  const wallMat = (color, kind = 'wall') => {
    const key = kind + color; let m = wallMats.get(key);
    if (!m) {
      const t = tex[kind];
      m = std({ color: 0xffffff, map: t.color(color), roughnessMap: t.gloss, metalnessMap: t.gloss, roughness: 1, metalness: 1, emissive: 0xffcf8a, emissiveMap: t.glow, emissiveIntensity: 0 });
      wallMats.set(key, m); glow.push({ m, k: kind === 'glass' ? 1.5 : 1.25 });
    }
    return m;
  };
  const neonCols = [0xff4d8d, 0x3de0ff, 0xffb03d, 0xb07dff, 0x5dffb0];
  const neon = neonCols.map(c => { const m = std({ color: new THREE.Color(c).lerp(new THREE.Color(0xffffff), .35), emissive: c, emissiveIntensity: 0, roughness: .5 }); glow.push({ m, k: 4.5 }); return m; });
  const beacon = std({ color: 0x661a1a, emissive: 0xff2a2a, emissiveIntensity: 0 }); glow.push({ m: beacon, k: 6 });
  const glassTints = [0x3f8fa6, 0x4f78b8, 0xb86f86, 0x4a9f8a, 0xc98f58];
  const out = { glow, towers: [], sunset: null };

  for (const lot of lots) {
    const { x, z, w, d, h, style } = lot, g = new THREE.Group(); g.position.set(x, .3, z); scene.add(g);
    building(x, z, w, d, BASE, true, .3, false);                      // the shops at street level, exactly like its neighbours
    solids.boxes[solids.boxes.length - 1].h = h + .3;
    const col = facadeCols[lot.tint % facadeCols.length], nm = neon[lot.tint % neon.length];
    const tier = (inset, y0, y1, mat) => mesh(windowBox(w - inset * 2, y1 - y0, d - inset * 2, r), mat, V(0, (y0 + y1) / 2, 0), null, g);
    const cap = (inset, y, t = .6, mat = mats.trim) => mesh(G.box, mat, V(0, y + t / 2, 0), V(w - inset * 2, t, d - inset * 2), g);
    const spire = (y, len, rad = .22) => {
      mesh(G.cyl, mats.metal, V(0, y + len / 2, 0), V(rad, len, rad), g, false);
      mesh(G.sph, beacon, V(0, y + len + .25, 0), V(.42, .42, .42), g, false);
    };
    let top = h, roof = null;
    if (style === 'deco' || style === 'sunset') {
      // stepped back twice on the way up, with a pylon up the middle of each face
      const big = style === 'sunset', m = wallMat(big ? 0xf6e7d3 : col);
      const y1 = BASE + Math.round((h - BASE) * (big ? .5 : .6) / FLOOR) * FLOOR, y2 = y1 + Math.round((h - y1) * (big ? .55 : .62) / FLOOR) * FLOOR;
      const i2 = big ? 2.2 : 2.5, i3 = big ? 3.4 : 4.2;
      tier(.8, BASE, y1, m); cap(.55, y1); tier(i2, y1 + .6, y2, m); cap(i2 - .25, y2); tier(i3, y2 + .6, h, m); cap(i3 - .3, h, .8);
      for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        mesh(G.box, mats.trim, V(fx * (w / 2 - .7), (BASE + y1) / 2 + 1.6, fz * (d / 2 - .7)), V(fx ? .5 : 2.2, y1 - BASE + 3.2, fz ? .5 : 2.2), g);
        mesh(G.box, mats.trim, V(fx * (w / 2 - i2 + .1), (y1 + y2) / 2 + 1.4, fz * (d / 2 - i2 + .1)), V(fx ? .5 : 1.8, y2 - y1 + 2.8, fz ? .5 : 1.8), g);
      }
      mesh(G.box, nm, V(0, h + (big ? .25 : .95), 0), V(w - i3 * 2 + (big ? .75 : 1), .3, d - i3 * 2 + (big ? .75 : 1)), g, false);
      if (big) {
        // the crown: a lantern, neon rings and a long needle. The flat roof around the lantern is a place you can stand.
        mesh(G.box, nm, V(0, y1 + .75, 0), V(w - 1.0, .3, d - 1.0), g, false); mesh(G.box, nm, V(0, y2 + .75, 0), V(w - 3.8, .3, d - 3.8), g, false);
        mesh(G.cyl, mats.trim, V(0, h + 3.4, 0), V(1.7, 5.2, 1.7), g); mesh(G.cyl, nm, V(0, h + 6.1, 0), V(1.9, .25, 1.9), g, false);
        mesh(G.cyl, mats.trim, V(0, h + 7.6, 0), V(1.2, 3, 1.2), g); mesh(G.cyl, nm, V(0, h + 9.2, 0), V(1.35, .22, 1.35), g, false);
        spire(h + 9.2, 22, .2); top = h + 31;
        roof = { x, z, y: h + 1.1, hw: (w - i3 * 2) / 2 + .3, hd: (d - i3 * 2) / 2 + .3, core: 1.7 };
      } else { spire(h + .8, 6 + (h - 40) * .12); top = h + 8; }
    } else if (style === 'slab') {
      // one clean shaft with white corners, a band every few storeys, and plant on the roof
      const m = wallMat(col);
      tier(.8, BASE, h, m); cap(.5, h, .9);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(G.box, mats.trim, V(sx * (w / 2 - .85), (BASE + h) / 2, sz * (d / 2 - .85)), V(1.1, h - BASE, 1.1), g);
      for (let y = BASE + FLOOR * 6; y < h - 6; y += FLOOR * 6) mesh(G.box, mats.trim, V(0, y, 0), V(w - 1.45, .3, d - 1.45), g, false);
      mesh(G.box, nm, V(0, h - .5, 0), V(w - 1.35, .32, d - 1.35), g, false);
      mesh(G.box, mats.ac, V(0, h + 2.6, 0), V(w - 8, 3.4, d - 8), g); mesh(G.box, mats.trim, V(0, h + 4.45, 0), V(w - 7.6, .3, d - 7.6), g, false);
      spire(h + 4.6, 5, .14); top = h + 10;
    } else {
      // glass: a tinted curtain wall between white floor bands, with a tall fin on the roof
      const m = wallMat(glassTints[lot.tint % glassTints.length], 'glass');
      tier(.9, BASE, h, m); cap(.6, h, .7);
      for (let y = BASE + FLOOR * 4; y < h - 4; y += FLOOR * 4) mesh(G.box, mats.trim, V(0, y, 0), V(w - 1.6, .22, d - 1.6), g, false);
      const along = lot.tint % 2;
      mesh(G.box, mats.trim, V(along ? 0 : w * .22, h + 5, along ? d * .22 : 0), V(along ? w * .5 : .6, 9, along ? .6 : d * .5), g);
      mesh(G.box, nm, V(along ? 0 : w * .22, h + 9.65, along ? d * .22 : 0), V(along ? w * .5 + .1 : .7, .3, along ? .7 : d * .5 + .1), g, false);
      mesh(G.box, nm, V(0, h + .85, 0), V(w - 1.5, .3, d - 1.5), g, false);
      top = h + 10;
    }
    const t = { x, z, w, d, h, top, style, roof }; out.towers.push(t);
    if (style === 'sunset') out.sunset = t;
  }
  return out;
}
