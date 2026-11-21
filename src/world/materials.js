// Textures, materials and mesh helpers shared by every builder.
// Ported as-is from the approved "Sunset Coast" look. Don't reorder the texture
// creation: the seeded random sequence decides what the city looks like.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rand } from '../core/utils.js';

// Every lit material is registered so day/night can dim reflections on all of them.
export const litMaterials = [];
const reg = (m) => { litMaterials.push(m); return m; };
export const std = (o) => reg(new THREE.MeshStandardMaterial(o));
export const phys = (o) => reg(new THREE.MeshPhysicalMaterial(o));

// ---------- textures ----------
export function ctex(size, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); draw(x, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
function noise(x, s, base, amp) {
  const d = x.createImageData(s, s);
  for (let i = 0; i < d.data.length; i += 4) { const v = base + (rand() - .5) * amp; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0);
}
const asphaltT = ctex(512, (x, s) => {
  noise(x, s, 200, 60);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(255,255,255,${rand() * .25})`; x.fillRect(rand() * s, rand() * s, 2, 2); }
  for (let i = 0; i < 14; i++) {
    x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 2; x.beginPath(); let px = rand() * s, py = rand() * s; x.moveTo(px, py);
    for (let k = 0; k < 6; k++) { px += (rand() - .5) * 60; py += (rand() - .5) * 60; x.lineTo(px, py); } x.stroke();
  }
});
asphaltT.repeat.set(70, 70);
const walkT = ctex(512, (x, s) => {
  noise(x, s, 232, 26); x.strokeStyle = 'rgba(60,50,40,.28)'; x.lineWidth = 3;
  for (let i = 0; i <= s; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, s); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(s, i); x.stroke(); }
});
walkT.repeat.set(10, 10);
const wallT = ctex(256, (x, s) => {
  noise(x, s, 238, 30);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(0,0,0,${rand() * .05})`; x.beginPath(); x.arc(rand() * s, rand() * s, rand() * 30, 0, 7); x.fill(); }
});
wallT.repeat.set(3, 3);
const stripes = (c1, c2) => ctex(128, (x, s) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? c2 : c1; x.fillRect(i * s / 8, 0, s / 8, s); } });

// ---------- materials ----------
// Window glass stands only a few centimetres proud of its frame. From far off that is less than the depth buffer can
// tell apart, and the two flicker; glass is drawn as if it were a touch nearer, which settles it without moving anything.
const PROUD = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3 };
export const mats = {
  asphalt: std({ map: asphaltT, color: 0x55585e, roughness: .92 }),
  walk: std({ map: walkT, color: 0xd6cfc4, roughness: .85 }),
  curb: std({ color: 0xd8d4cc, roughness: .8 }),
  grass: std({ color: 0x6fae5a, roughness: 1 }),
  trim: std({ color: 0xe9e1d3, roughness: .7 }),
  glass: std({ color: 0x24384c, roughness: .06, metalness: .85, ...PROUD }),
  shop: std({ color: 0x56778c, roughness: .1, metalness: .35, emissive: 0xffc985, emissiveIntensity: 0, ...PROUD }),
  litWin: std({ color: 0x3a3326, roughness: .2, emissive: 0xffcf8a, emissiveIntensity: 1.1, ...PROUD }),
  metal: std({ color: 0x5b6068, roughness: .45, metalness: .7 }),
  darkMetal: std({ color: 0x2b2f35, roughness: .5, metalness: .6 }),
  lampHead: std({ color: 0xfff6e0, emissive: 0xffe2a8, emissiveIntensity: 0 }),
  paint: std({ color: 0xffffff, roughness: .6 }),
  yellowPaint: std({ color: 0xf2c230, roughness: .6 }),
  trunk: std({ color: 0x8a6a4a, roughness: .95 }),
  leaf: std({ color: 0x3f8f3a, roughness: .75, side: THREE.DoubleSide }),
  tire: std({ color: 0x18191b, roughness: .9 }),
  rim: std({ color: 0xcfd3d8, roughness: .25, metalness: 1 }),
  carGlass: phys({ color: 0x10161d, roughness: .03, metalness: .2, clearcoat: 1 }),
  head: std({ color: 0xffffff, emissive: 0xfff3d6, emissiveIntensity: .4 }),
  water: std({ color: 0xb48a5e, roughness: .9 }),      // rooftop water tanks
  ac: std({ color: 0xc8ccd0, roughness: .6, metalness: .3 }),
  sea: std({ color: 0x2b8fa8, roughness: .12, metalness: .25 }),
};
export const facadeCols = [0xf2b8a2, 0xf4d9a6, 0x9fd3c7, 0xefe6d4, 0xd98c6a, 0xb7c9a8, 0xc9b8e0, 0x8fb5d6, 0xf6c6cf];
export const facade = facadeCols.map(c => std({ color: c, map: wallT, roughness: .88 }));
export const awnings = [['#e8455b', '#fff4e6'], ['#2f8f83', '#fff4e6'], ['#f2a93b', '#fff4e6'], ['#3e6fd6', '#ffffff']]
  .map(([a, b]) => std({ map: stripes(a, b), roughness: .8 }));
const carPaint = {};
export const paint = (c) => carPaint[c] || (carPaint[c] = phys({ color: c, roughness: .32, metalness: .35, clearcoat: 1, clearcoatRoughness: .08 }));

// ---------- geometry + mesh helpers ----------
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
  sph: new THREE.SphereGeometry(1, 24, 16),
};
export function mesh(geo, mat, p, s, parent, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  if (p) m.position.copy(p);
  if (s) { if (typeof s === 'number') m.scale.setScalar(s); else m.scale.copy(s); }
  m.castShadow = cast; m.receiveShadow = true; if (parent) parent.add(m); return m;
}
const rbCache = {};
export function rbox(w, h, d, r = .08) { const k = [w, h, d, r].join(); return rbCache[k] || (rbCache[k] = new RoundedBoxGeometry(w, h, d, 3, r)); }
const capsCache = {};
export const cap = (r, l) => capsCache[r + ',' + l] || (capsCache[r + ',' + l] = new THREE.CapsuleGeometry(r, l, 6, 14));
