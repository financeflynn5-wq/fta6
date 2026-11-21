// Tin Bots: Scrap (a rusty little bot with a screen for a face), Tess the taxi bot and Unit 5-0, the police bot.
// Boxy tin-toy bodies on the shared rig (rig.js, style 'bot'): ball joints, thin limbs, chunky forearms and boots.
import * as THREE from 'three';
import { V, choose } from '../core/utils.js';
import { std, G, rbox, ctex } from '../world/materials.js';
import { rig, mat, glow, gold, M, sm, tiny, tube, blend, cache } from './rig.js';

const BOT_METALS = [[0xb07a4a, 0xc28a55], [0x6f8f9a, 0x8fb0bb], [0x9a6fb0, 0xb48fca], [0x8a9a5a, 0xa9b96f], [0xb05a4a, 0xcf7a66], [0x7a8088, 0xa6adb5]];
const HALF = Math.PI / 2;
const keep = (k, make) => cache[k] || (cache[k] = make());
const lamp = (c, i = 2.2) => keep('lamp' + c + '/' + i, () => glow(c, i));
const steel = mat(0x8a8f96, .35, .9), darkSteel = mat(0x3a3d42, .5, .6), screen = mat(0x081410, .2);

// the front of a bot's chest: an inset plate with a dial, three lamps and cooling slots, and a rivet in each corner
function chestPanel(ch, bodyC, { dial = true, lamps = [0xff5a4d, 0xffd34d, 0x5dff8a] } = {}) {
  const plate = mat(blend(bodyC, 0x101216, .45), .5, .7);
  M(rbox(.36, .27, .03, .02), plate, V(0, 1.2, .208), null, ch);
  if (dial) { M(tube(.05, .05, .02, 16), mat(0xf4f1ea, .5), V(-.095, 1.245, .224), null, ch, [HALF, 0, 0]); M(rbox(.008, .045, .008, .003), mat(0xe8455b, .5), V(-.095, 1.258, .236), null, ch, [0, 0, .6]); }
  lamps.forEach((c, i) => M(tiny, lamp(c), V(.025 + i * .05, 1.265, .224), .016, ch));
  for (let i = 0; i < 3; i++) M(rbox(.15, .014, .012, .004), darkSteel, V(.075, 1.2 - i * .034, .224), null, ch);
  for (const x of [-1, 1]) for (const y of [0, 1]) M(tiny, steel, V(x * .235, y ? 1.385 : .935, .205), .017, ch);
}
// a screen let into the front of a boxy head, and a bolt on each side
function screenFace(h, headC, w, ht, z) {
  M(rbox(w + .07, ht + .07, .05, .04), mat(blend(headC, 0x101216, .35), .45, .8), V(0, 0, z - .012), null, h);
  M(rbox(w, ht, .05, .035), screen, V(0, 0, z), null, h);
  for (const k of [-1, 1]) { M(tube(.06, .06, .05, 10), steel, V(k * (w / 2 + .115), -.02, 0), null, h, [0, 0, HALF]); M(tiny, darkSteel, V(k * (w / 2 + .142), -.02, 0), .026, h); }
}
// the lit eyes sit on a joint of their own so they can blink (squash flat) without the rest of the face moving
function screenEyes(h, y, z) { const e = new THREE.Group(); e.position.set(0, y, z); h.add(e); return e; }

export function scrap(opt = {}) {   // rusty little bot with a screen face and one antenna
  const [bodyC, headC] = opt.metal || choose(BOT_METALS);
  const r = rig({ style: 'bot', shirt: mat(bodyC, .45, .8), pants: mat(0x6b5a48, .5, .7), shoes: darkSteel, skin: steel, joint: steel, headY: 1.82 });
  const u = r.userData, h = u.head, e = lamp(opt.eye ?? choose([0x5dff8a, 0x5ac8ff, 0xffd34d, 0xff8fb1]), 6);
  chestPanel(u.chest, bodyC);
  M(rbox(.62, .5, .5, .08), mat(headC, .4, .85), null, null, h); screenFace(h, headC, .46, .32, .243);
  const eyes = u.eyes = screenEyes(h, .03, .273);
  for (const k of [-1, 1]) M(sm, e, V(k * .1, 0, 0), V(.05, .07, .02), eyes);
  M(rbox(.18, .03, .02, .01), e, V(0, -.08, .273), null, h);
  for (const k of [-1, 1]) M(tiny, steel, V(k * .25, .2, .252), .018, h);
  const ant = u.antenna = new THREE.Group(); ant.position.set(.18, .25, 0); h.add(ant);
  M(tube(.03, .04, .04, 10), steel, V(0, .02, 0), null, ant); M(G.cyl, mat(0x8a8f96, .3, 1), V(0, .15, 0), V(.014, .28, .014), ant); M(sm, lamp(0xff4040, 2.5), V(0, .31, 0), .058, ant);
  u.bot = true; u.skinC = 0x8a8f96; u.sleeveC = bodyC; return r;
}

let fareTex = null, checkTex = null;
export function tess() {    // taxi bot, her face is a fare meter
  const yellow = mat(0xf6c21c, .35, .6), chrome = mat(0x9aa0a8, .3, 1);
  const r = rig({ style: 'bot', shirt: yellow, pants: mat(0x23272e, .5, .5), shoes: mat(0x15161a), skin: chrome, joint: chrome, headY: 1.84 });
  const u = r.userData, h = u.head, ch = u.chest;
  if (!checkTex) checkTex = ctex(64, (x, s) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#15161a' : '#f4f1ea'; x.fillRect(i * s / 8, j * s / 2, s / 8, s / 2); } });
  M(rbox(.595, .075, .435, .03), keep('taxiCheck', () => std({ map: checkTex, roughness: .5, metalness: .2 })), V(0, 1.0, 0), null, ch);      // the checker band every cab wears
  chestPanel(ch, 0xf6c21c, { lamps: [0x5dff8a, 0x5dff8a, 0xffd34d] });
  M(G.sph, mat(0xf6c21c, .3, .6), null, V(.38, .36, .36), h);
  if (!fareTex) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#08140c'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#7dff8a'; x.font = 'bold 54px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$4.20', 128, 64);
    fareTex = new THREE.CanvasTexture(c); fareTex.colorSpace = THREE.SRGBColorSpace;
  }
  M(rbox(.47, .27, .05, .04), mat(0x23272e, .45, .6), V(0, .04, .326), null, h);
  M(rbox(.42, .22, .05, .03), keep('fare', () => std({ map: fareTex, emissive: 0xffffff, emissiveMap: fareTex, emissiveIntensity: 1.6 })), V(0, .04, .34), null, h);
  for (const k of [-1, 1]) { M(sm, chrome, V(k * .38, 0, 0), V(.06, .12, .12), h); M(tiny, mat(0x23272e, .5, .5), V(k * .425, 0, 0), V(.025, .07, .07), h); }
  M(rbox(.3, .12, .16, .03), keep('taxiLamp', () => std({ color: 0x222222, emissive: 0xffd34d, emissiveIntensity: 1.2 })), V(0, .42, 0), null, h); M(rbox(.34, .03, .2, .012), mat(0x23272e, .5, .5), V(0, .355, 0), null, h);
  u.bot = true; u.skinC = 0x9aa0a8; u.sleeveC = 0xf6c21c; return r;
}

export function unit50() {  // police bot with a siren for a head
  const white = mat(0xcfd3d8, .25, 1), navy = mat(0x2a3f7a, .35, .7);
  const r = rig({ style: 'bot', shirt: navy, pants: mat(0x1c2a55, .4, .7), shoes: mat(0x15161a, .4, .6), skin: white, joint: white, headY: 1.82 });
  const u = r.userData, h = u.head, ch = u.chest;
  chestPanel(ch, 0x2a3f7a, { dial: false, lamps: [0xff2030, 0x5ac8ff, 0x5ac8ff] });
  M(sm, gold, V(-.095, 1.24, .225), V(.05, .06, .016), ch);                                                 // the badge sits where the dial would be
  M(rbox(.6, .06, .44, .025), mat(0x15161a, .5), V(0, .93, 0), null, ch); M(rbox(.07, .05, .02, .008), gold, V(0, .93, .222), null, ch);       // belt and buckle
  for (const k of [-1, 1]) M(rbox(.1, .024, .26, .01), mat(0xf4f1ea, .5, .3), V(k * .2, 1.443, 0), null, ch);     // white flashes on the shoulders
  M(rbox(.56, .46, .5, .1), mat(0xe8ebef, .25, .9), null, null, h); screenFace(h, 0xe8ebef, .44, .26, .243);
  const eyes = u.eyes = screenEyes(h, .02, .273), e = lamp(0x5ac8ff, 6);
  for (const k of [-1, 1]) M(rbox(.12, .05, .02, .02), e, V(k * .1, 0, 0), null, eyes);
  const red = std({ color: 0x220000, emissive: 0xff2030, emissiveIntensity: .1 }), blue = std({ color: 0x000022, emissive: 0x2050ff, emissiveIntensity: .1 });
  M(G.cyl, mat(0x222222, .4, .5), V(0, .26, 0), V(.2, .06, .2), h); M(sm, red, V(-.08, .36, 0), .1, h); M(sm, blue, V(.08, .36, 0), .1, h);
  u.siren = [red, blue]; u.bot = true; u.skinC = 0xcfd3d8; u.sleeveC = 0x2a3f7a; return r;
}
