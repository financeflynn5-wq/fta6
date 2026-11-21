// Furniture. Every piece is a handful of coloured boxes welded into its room (interiors.js), plus something to bump into.
// kit(F) gives the pieces for one floor F (see storeys.js). Each piece is placed by the middle of its back edge:
//   piece(a, b, q, options)   a, b = where (room coordinates), q = which way it faces:
//   0 = toward the front of the building (so it stands against the back wall), 1 = away from the stairs' side wall,
//   2 = toward the back, 3 = toward the stairs' side. Tables and rugs are placed by their middle instead.
import * as THREE from 'three';

const CYL = new THREE.CylinderGeometry(1, 1, 1, 10), BALL = new THREE.SphereGeometry(1, 10, 7), CONE = new THREE.ConeGeometry(1, 1, 10);
export const SHAPES = { CYL, BALL, CONE };

export function kit(F) {
  const { m, r } = F, T = F.tinted, pick = (list) => list[Math.floor(r() * list.length)];
  // a piece's own frame: x = to its right, z = out from its back, y0 = underside
  const frame = (a0, b0, q = 0) => {
    const map = (x, z) => q === 0 ? [a0 + x, b0 - z] : q === 1 ? [a0 - z, b0 - x] : q === 2 ? [a0 - x, b0 + z] : [a0 + z, b0 + x];
    const dims = (sx, sz) => q % 2 ? [sz, sx] : [sx, sz];
    const L = {
      box(mat, x, y0, z, sx, sy, sz, geo) { const [a, b] = map(x, z), [sa, sb] = dims(sx, sz); F.put(mat, a, y0 + sy / 2, b, sa, sy, sb, geo); },
      solid(x, z, sx, sz, h) { const [a, b] = map(x, z), [sa, sb] = dims(sx, sz); F.solid(a, b, sa, sb, h); },
      spot(x, z, what, rad, data) { const [a, b] = map(x, z); return F.spot(a, b, what, rad, data); },
      map, q,
    };
    return L;
  };
  const K = { frame, pick, T };
  const WOODS = [0x9a6a44, 0x7d5636, 0xb98a5a, 0x5e3f2a], SOFT = [0xc8553d, 0x2f7f8f, 0x4a6fa5, 0x7a4a8a, 0x3f8f5a, 0xd9a441, 0x8a8f99, 0xb5462f], PALE = [0xf2ede4, 0xe6eef2, 0xf4e6d0, 0xe9f2e6];
  K.WOODS = WOODS; K.SOFT = SOFT;
  // somewhere to search: `what` it is called in the hint, `loot` = which table it rolls on (interiors.js)
  const search = (L, x, z, label, loot, rad = 1.05) => L.spot(x, z, 'search', rad, { label, loot });

  K.bed = (a, b, q, { w = 1.5, col = pick(SOFT), wood = pick(WOODS) } = {}) => {
    const L = frame(a, b, q);
    L.box(T(wood), 0, .1, 1.03, w, .22, 2.05); L.box(m.white, 0, .32, 1.06, w - .06, .2, 1.95); L.box(T(col), 0, .5, 1.32, w + .02, .07, 1.44); L.box(m.white, 0, .5, .55, w - .02, .075, .12);
    if (w > 1.2) for (const s of [-1, 1]) L.box(m.cream, s * w / 4, .52, .3, w / 2 - .16, .11, .36); else L.box(m.cream, 0, .52, .3, w - .3, .11, .36);
    L.box(T(wood), 0, .1, .04, w + .08, .95, .08); L.solid(0, 1.03, w, 2.05, .7);
  };
  K.nightstand = (a, b, q, { wood = WOODS[0], lamp = true, loot = 'drawer' } = {}) => {
    const L = frame(a, b, q);
    L.box(T(wood), 0, 0, .22, .46, .52, .42); L.box(m.darkWood, 0, .24, .435, .38, .02, .012); L.box(m.gold, 0, .34, .44, .08, .03, .02);
    if (lamp) { L.box(m.steel, 0, .52, .2, .05, .22, .05, CYL); L.box(m.cream, 0, .72, .2, .15, .2, .15, CYL); }
    L.solid(0, .22, .46, .42, .6); if (loot) search(L, 0, .9, 'the nightstand', loot, .8);
  };
  K.wardrobe = (a, b, q, { w = 1.4, wood = WOODS[1], loot = 'wardrobe' } = {}) => {
    const L = frame(a, b, q);
    L.box(T(wood), 0, 0, .3, w, 2.1, .6); L.box(m.darkWood, 0, .06, .604, .025, 1.98, .012); L.box(m.darkWood, 0, 2.1, .3, w + .06, .05, .66);
    for (const s of [-1, 1]) L.box(m.gold, s * .09, 1.02, .615, .03, .18, .025);
    L.solid(0, .3, w, .6, 2.1); if (loot) search(L, 0, 1.2, 'the wardrobe', loot);
  };
  K.dresser = (a, b, q, { w = 1.1, wood = WOODS[0], mirror = true, loot = 'drawer' } = {}) => {
    const L = frame(a, b, q);
    L.box(T(wood), 0, 0, .25, w, .86, .5);
    for (let i = 0; i < 3; i++) { L.box(m.darkWood, 0, .2 + i * .25, .504, w - .1, .018, .012); for (const s of [-1, 1]) L.box(m.gold, s * w / 4, .1 + i * .25, .51, .1, .03, .02); }
    if (mirror) { L.box(m.darkWood, 0, 1.05, .025, w * .75, .95, .04); L.box(T(0xcfe3ea), 0, 1.1, .05, w * .75 - .1, .85, .012); }
    L.solid(0, .25, w, .5, .9); if (loot) search(L, 0, 1.05, 'the dresser', loot);
  };
  K.sofa = (a, b, q, { w = 2.1, col = pick(SOFT) } = {}) => {
    const L = frame(a, b, q), c = new THREE.Color(col), light = c.clone().lerp(new THREE.Color(0xffffff), .18).getHex();
    L.box(T(col), 0, .1, .46, w, .32, .92); L.box(T(col), 0, .42, .12, w, .5, .24);
    for (const s of [-1, 1]) L.box(T(col), s * (w / 2 - .11), .42, .52, .22, .2, .8);
    const n = w > 1.5 ? 2 : 1, cw = (w - .44) / n; for (let i = 0; i < n; i++) L.box(T(light), -w / 2 + .22 + cw * (i + .5), .42, .56, cw - .04, .1, .66);
    L.box(m.dark, 0, 0, .46, w - .2, .1, .7); L.solid(0, .46, w, .92, .9);
  };
  K.coffee = (a, b, { w = 1.1, d = .6, wood = WOODS[1] } = {}) => {
    F.put(T(wood), a, .38, b, w, .06, d); for (const s of [-1, 1]) for (const t of [-1, 1]) F.put(m.darkWood, a + s * (w / 2 - .07), .18, b + t * (d / 2 - .07), .06, .36, .06);
    F.put(pick(m.goods), a + w * .2, .43, b, .22, .04, .3); F.solid(a, b, w, d, .45);
  };
  // a chair in a piece's frame: (x, z) its middle, back = +1 when its back is toward +z
  const chair = (L, x, z, back, col) => {
    L.box(T(col), x, .42, z, .42, .06, .42); L.box(T(col), x, .48, z + back * .19, .42, .46, .05);
    for (const s of [-1, 1]) L.box(m.dark, x + s * .18, 0, z, .04, .42, .38);
  };
  const sideChair = (L, x, z, side, col) => {
    L.box(T(col), x, .42, z, .42, .06, .42); L.box(T(col), x + side * .19, .48, z, .05, .46, .42);
    for (const s of [-1, 1]) L.box(m.dark, x, 0, z + s * .18, .38, .42, .04);
  };
  K.table = (a, b, q, { w = 1.5, d = .9, chairs = 4, wood = WOODS[2], col = pick(SOFT) } = {}) => {
    const L = frame(a, b, q);       // placed by its middle
    L.box(T(wood), 0, .72, 0, w, .05, d); for (const s of [-1, 1]) for (const t of [-1, 1]) L.box(m.darkWood, s * (w / 2 - .08), 0, t * (d / 2 - .08), .07, .72, .07);
    const per = Math.max(1, Math.floor(chairs / 2)), gap = w / per;
    for (let i = 0; i < per; i++) { chair(L, -w / 2 + gap * (i + .5), d / 2 + .28, 1, col); chair(L, -w / 2 + gap * (i + .5), -d / 2 - .28, -1, col); }
    if (chairs > per * 2) { sideChair(L, w / 2 + .28, 0, 1, col); if (chairs > per * 2 + 1) sideChair(L, -w / 2 - .28, 0, -1, col); }
    L.solid(0, 0, w + (chairs > per * 2 ? .9 : 0), d + 1.1, .8);
    return L;
  };
  K.tv = (a, b, q, { w = 1.25, wood = WOODS[3], screen = Math.floor(r() * 6) } = {}) => {
    const L = frame(a, b, q);
    L.box(T(wood), 0, 0, .22, w + .35, .46, .42); L.box(m.dark, 0, .46, .2, .3, .1, .16); L.box(m.dark, 0, .56, .2, w, .74, .06); L.box(m.screens[screen], 0, .6, .233, w - .08, .66, .012);
    L.solid(0, .22, w + .35, .42, 1.2);
  };
  K.bookshelf = (a, b, q, { w = 1.2, h = 2, wood = WOODS[1] } = {}) => {
    const L = frame(a, b, q), n = Math.round(h / .42);
    L.box(T(wood), 0, 0, .02, w, h, .04); for (const s of [-1, 1]) L.box(T(wood), s * (w / 2 - .02), 0, .16, .04, h, .3);
    for (let i = 0; i <= n; i++) L.box(T(wood), 0, i * (h - .04) / n, .16, w - .06, .035, .3);
    for (let i = 0; i < n; i++) { let x = -w / 2 + .06; while (x < w / 2 - .28) { const bw = .16 + r() * .3, bh = .22 + r() * .12; if (r() < .85) L.box(pick(m.goods), x + bw / 2, i * (h - .04) / n + .035, .17, bw - .02, bh, .22); x += bw; } }
    L.solid(0, .16, w, .32, h);
  };
  K.kitchen = (a, b, q, { w = 3, col = pick(PALE), top = 0x3a3f48 } = {}) => {
    const L = frame(a, b, q);
    L.box(T(col), 0, .08, .3, w, .8, .6); L.box(m.dark, 0, 0, .28, w, .08, .5); L.box(T(top), 0, .88, .31, w + .02, .045, .64);
    for (let x = -w / 2 + .3; x < w / 2; x += .6) { L.box(m.dark, x - .3, .12, .604, .015, .72, .01); L.box(m.steel, x - .08, .7, .615, .14, .025, .02); }
    L.box(m.steel, -w / 4, .9, .3, .62, .03, .44); L.box(T(0x8fa3ad), -w / 4, .905, .3, .5, .03, .32); L.box(m.steel, -w / 4, .92, .08, .04, .26, .04, CYL);
    L.box(m.dark, w / 4, .9, .3, .62, .03, .52); for (const s of [-1, 1]) for (const t of [-1, 1]) L.box(m.red, w / 4 + s * .15, .928, .3 + t * .13, .09, .012, .09, CYL);
    L.box(T(col), 0, 1.5, .18, w, .62, .36); for (let x = -w / 2 + .6; x < w / 2 - .1; x += .6) L.box(m.dark, x, 1.52, .362, .015, .58, .01);
    L.box(T(0xdfe6ea), 0, .93, .012, w, .57, .024); L.solid(0, .3, w, .62, 2.1);
    return L;
  };
  K.fridge = (a, b, q, { col = 0xe4e9ec, loot = 'fridge' } = {}) => {
    const L = frame(a, b, q);
    L.box(T(col), 0, 0, .35, .76, 1.86, .7); L.box(m.dark, 0, 1.18, .703, .76, .018, .012); for (const y of [.62, 1.3]) L.box(m.steel, -.28, y, .72, .04, .36, .04);
    L.solid(0, .35, .76, .7, 1.9); if (loot) search(L, 0, 1.25, 'the fridge', loot, .9);
  };
  K.bath = (a, b, q) => { const L = frame(a, b, q); L.box(m.white, 0, 0, .4, 1.7, .56, .8); L.box(T(0xbfe3ef), 0, .5, .4, 1.5, .07, .6); L.box(m.steel, -.7, .56, .12, .05, .22, .05, CYL); L.solid(0, .4, 1.7, .8, .6); };
  K.toilet = (a, b, q) => { const L = frame(a, b, q); L.box(m.white, 0, .38, .1, .44, .42, .2); L.box(m.white, 0, 0, .42, .38, .4, .5); L.box(m.cream, 0, .4, .42, .4, .04, .52); L.box(m.steel, .14, .82, .1, .08, .03, .05); L.solid(0, .32, .46, .66, .8); };
  K.basin = (a, b, q, { cabinet = false } = {}) => {
    const L = frame(a, b, q);
    L.box(m.white, 0, 0, .2, .2, .78, .2); L.box(m.white, 0, .76, .24, .56, .14, .46); L.box(T(0xbfe3ef), 0, .885, .26, .42, .02, .3); L.box(m.steel, 0, .9, .07, .04, .16, .04, CYL);
    L.box(m.steel, 0, 1.18, .02, .56, .78, .03); L.box(T(0xcfe3ea), 0, 1.21, .04, .5, .72, .012); L.solid(0, .24, .56, .46, .9);
    if (cabinet) search(L, 0, .95, 'the bathroom cabinet', 'medicine', .85);
  };
  // an office chair in a piece's frame
  const swivel = (L, x, z, back, col) => { L.box(m.dark, x, 0, z, .26, .05, .26, CYL); L.box(m.steel, x, .05, z, .03, .4, .03, CYL); L.box(T(col), x, .45, z, .46, .08, .46); L.box(T(col), x, .58, z + back * .21, .44, .52, .07); };
  K.desk = (a, b, q, { w = 1.4, wood = WOODS[2], col = 0x2b2f38, pc = true, seat = true, loot = null, label = 'the desk' } = {}) => {
    const L = frame(a, b, q);       // its back edge is the far side from whoever sits at it
    L.box(T(wood), 0, .72, .36, w, .05, .72); for (const s of [-1, 1]) L.box(T(wood), s * (w / 2 - .03), 0, .36, .05, .72, .68); L.box(T(wood), 0, .28, .05, w - .1, .42, .03);
    if (pc) { L.box(m.dark, 0, .77, .2, .22, .02, .16); L.box(m.dark, 0, .79, .2, .05, .16, .04); L.box(m.dark, 0, .9, .2, .58, .36, .04); L.box(m.screens[Math.floor(r() * 6)], 0, .92, .222, .52, .31, .01); L.box(m.dark, 0, .775, .5, .42, .02, .14); L.box(m.white, .4, .775, .5, .06, .02, .1); }
    else { L.box(m.white, -.25, .775, .4, .3, .012, .22); L.box(pick(m.goods), .3, .775, .3, .045, .11, .045, CYL); }
    if (seat) swivel(L, 0, 1.05, 1, col);
    L.solid(0, .36, w, .72, .8); if (loot) search(L, 0, 1.2, label, loot, .95);
    return L;
  };
  K.filing = (a, b, q, { n = 1, col = 0x8a9099, loot = null } = {}) => {
    const L = frame(a, b, q), w = .5 * n;
    L.box(T(col), 0, 0, .3, w, 1.32, .6); for (let i = 0; i < n; i++) for (let j = 0; j < 4; j++) { L.box(m.dark, -w / 2 + .25 + i * .5, .06 + j * .32, .604, .44, .012, .01); L.box(m.steel, -w / 2 + .25 + i * .5, .2 + j * .32, .61, .14, .03, .02); }
    L.solid(0, .3, w, .6, 1.35); if (loot) search(L, 0, 1.15, 'the filing cabinet', loot, .9);
  };
  K.cooler = (a, b, q) => { const L = frame(a, b, q); L.box(m.white, 0, 0, .18, .34, 1.0, .34); L.box(T(0x9fd0e8), 0, 1.0, .18, .13, .42, .13, CYL); L.box(m.red, -.07, .72, .355, .04, .04, .02); L.box(m.cool, .07, .72, .355, .04, .04, .02); L.solid(0, .18, .36, .36, 1.4); L.spot(0, .9, 'water', .8); };
  K.copier = (a, b, q) => { const L = frame(a, b, q); L.box(T(0xdfe3e6), 0, 0, .35, .9, .98, .7); L.box(m.dark, 0, .98, .35, .86, .07, .66); L.box(m.screens[0], .28, 1.05, .62, .18, .012, .1); L.box(m.white, -.5, .6, .35, .12, .03, .4); L.solid(0, .35, .9, .7, 1.1); };
  K.vending = (a, b, q, i = Math.floor(r() * 6)) => {
    const L = frame(a, b, q);
    L.box(m.dark, 0, 0, .42, 1.0, 1.9, .84); L.box(m.screens[i], -.14, .5, .845, .64, 1.25, .012); L.box(m.screens[(i + 3) % 6], .36, 1.1, .845, .16, .3, .012); L.box(T(0x16181d), 0, .12, .845, .7, .22, .012);
    for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) L.box(m.goods[(i + j * 3 + k) % 8], -.38 + k * .16, .66 + j * .27, .86, .1, .17, .012);
    L.solid(0, .42, 1.0, .84, 1.9); L.spot(0, 1.35, 'vend', .9);
  };
  K.whiteboard = (a, b, q, { w = 2 } = {}) => { const L = frame(a, b, q); L.box(m.steel, 0, 1.0, .02, w, 1.15, .03); L.box(m.white, 0, 1.04, .04, w - .08, 1.07, .012); for (let i = 0; i < 5; i++) L.box(pick(m.goods), -w / 2 + .3 + r() * (w - .8), 1.25 + i * .15, .05, .3 + r() * .5, .025, .006); L.box(m.steel, 0, .97, .07, w * .6, .03, .08); };
  K.plant = (a, b, big = 1) => { F.put(m.pot, a, .28, b, .24 * big, .56, .24 * big, CYL); F.put(m.plant, a, .56 + .5 * big, b, .42 * big, .55 * big, .42 * big, BALL); F.put(T(0x2f7a3a), a + .12, .5 + .95 * big, b - .06, .26 * big, .34 * big, .26 * big, BALL); F.solid(a, b, .5, .5, 1); };
  K.rug = (a, b, sa, sb, col = pick(SOFT), border = 0xf1e7d2) => { F.put(T(border), a, .012, b, sa, .024, sb); F.put(T(col), a, .02, b, sa - .3, .024, sb - .3); };
  K.floorLamp = (a, b) => { F.put(m.dark, a, .02, b, .16, .04, .16, CYL); F.put(m.steel, a, .78, b, .025, 1.5, .025, CYL); F.put(m.cream, a, 1.62, b, .2, .3, .2, CYL); F.solid(a, b, .3, .3, 1.7); };
  // a picture on the wall behind (a, b): y = its middle
  K.picture = (a, b, q, { w = .9, h = .7, y = 1.6, col = pick(SOFT), ink = pick(m.goods) } = {}) => {
    const L = frame(a, b, q); L.box(m.darkWood, 0, y - h / 2, .022, w, h, .034); L.box(T(col), 0, y - h / 2 + .05, .04, w - .1, h - .1, .012);
    L.box(ink, w * (r() - .5) * .4, y - h * .18, .048, w * .32, h * .36, .006); if (r() < .6) L.box(m.cream, w * (r() - .5) * .5, y + h * .12, .048, w * .2, h * .16, .006, BALL);
  };
  K.crate = (a, b, s = .8, col = 0xb98a54) => { F.put(T(col), a, s / 2, b, s, s, s); for (const y of [.12, s - .12]) F.put(m.darkWood, a, y, b, s + .03, .07, s + .03); F.solid(a, b, s, s, s); };
  K.boxes = (a, b, n = 3) => { for (let i = 0; i < n; i++) { const s = .5 + r() * .25; F.put(T(pick([0xc9a877, 0xb98a54, 0xd4b68a])), a + (r() - .5) * .15, .26 + i * .5, b + (r() - .5) * .15, s, .5, s * .8); } F.solid(a, b, .75, .7, n * .5); };
  K.lockers = (a, b, q, { n = 4, col = 0x3e6fa5, loot = 'locker', label = 'the lockers' } = {}) => {
    const L = frame(a, b, q), w = n * .42;
    L.box(T(col), 0, 0, .25, w, 1.9, .5);
    for (let i = 0; i < n; i++) { const x = -w / 2 + .21 + i * .42; L.box(m.dark, x - .2, .03, .504, .012, 1.84, .01); L.box(m.steel, x + .12, 1.0, .51, .03, .12, .02); for (let j = 0; j < 3; j++) L.box(m.dark, x, 1.55 + j * .07, .504, .24, .02, .01); }
    L.solid(0, .25, w, .5, 1.9); if (loot) search(L, 0, 1.1, label, loot, Math.max(1, w / 2));
  };
  // a safe: tier says how much is in it and how loudly it objects (interiors.js)
  K.safe = (a, b, q, tier = 'house') => {
    const L = frame(a, b, q), big = tier !== 'house';
    const w = big ? 1.1 : .7, h = big ? 1.5 : .9;
    L.box(T(0x2c3340), 0, 0, .3, w, h, .6); L.box(T(0x3a4252), 0, .06, .604, w - .12, h - .12, .012); L.box(m.gold, -w * .15, h * .55 - .05, .62, .1, .1, .03, BALL); L.box(m.gold, w * .22, h * .5, .64, .05, .3, .05); L.box(m.steel, w * .22, h * .5 + .12, .64, .16, .05, .05);
    L.solid(0, .3, w, .6, h); return L.spot(0, 1.2, 'safe', 1, { tier });
  };
  K.bench = (a, b, q, { w = 1.8, col = 0x9a6a44 } = {}) => { const L = frame(a, b, q); L.box(T(col), 0, .4, .25, w, .07, .46); L.box(T(col), 0, .55, .04, w, .4, .06); for (const s of [-1, 1]) L.box(m.dark, s * (w / 2 - .12), 0, .25, .06, .4, .42); L.solid(0, .25, w, .5, .9); };
  K.counter = (a, b, sa, sb, top = m.steel, body = F.accent) => { F.put(body, a, .51, b, sa, 1.02, sb); F.put(top, a, 1.06, b, sa + .12, .08, sb + .12); F.solid(a, b, sa, sb, 1.1); };
  K.stool = (a, b, c = m.red) => { F.put(m.steel, a, .35, b, .04, .7, .04, CYL); F.put(c, a, .74, b, .17, .09, .17, CYL); };

  // ---------- hospital and police ----------
  K.hospitalBed = (a, b, q, { curtain = true, col = 0xbfe3ef } = {}) => {
    const L = frame(a, b, q);
    L.box(m.steel, 0, .28, 1.05, .98, .06, 2.1); for (const s of [-1, 1]) for (const z of [.12, 1.98]) L.box(m.steel, s * .44, 0, z, .05, .3, .05);
    L.box(m.white, 0, .34, 1.05, .92, .2, 2.0); L.box(T(col), 0, .54, 1.3, .94, .05, 1.4); L.box(m.white, 0, .54, .32, .6, .1, .36); L.box(m.steel, 0, .3, .04, .98, .75, .05);
    L.box(m.steel, .64, 0, .25, .02, 1.7, .02, CYL); L.box(T(0xd8f0f4), .64, 1.42, .25, .06, .26, .06, CYL);      // a drip on a stand
    if (curtain) L.box(T(0x9fd3c7), -.74, .3, 1.15, .04, 1.8, 2.3);
    L.solid(0, 1.05, 1, 2.1, .8);
  };
  K.trolley = (a, b) => { F.put(m.steel, a, .8, b, .7, .04, .45); F.put(m.steel, a, .35, b, .7, .04, .45); for (const s of [-1, 1]) for (const t of [-1, 1]) F.put(m.steel, a + s * .32, .4, b + t * .2, .015, .8, .015, CYL); for (let i = 0; i < 3; i++) F.put(pick(m.goods), a - .2 + i * .2, .86, b, .1, .08, .1); F.solid(a, b, .7, .45, .9); };
  // bars from (a0, b0) to (a1, b1), straight along a or along b; door = [from, to] metres along the run that stand open
  K.bars = (a0, b0, a1, b1, door = null) => {
    const along = Math.abs(a1 - a0) > Math.abs(b1 - b0), lo = along ? Math.min(a0, a1) : Math.min(b0, b1), len = Math.abs(along ? a1 - a0 : b1 - b0), n = Math.round(len / .2), h = F.hi;
    const at = (u) => along ? [lo + u, b0] : [a0, lo + u];
    for (let i = 0; i <= n; i++) { const u = i * len / n; if (door && u > door[0] + .01 && u < door[1] - .01) continue; const [x, z] = at(u); F.put(m.dark, x, h / 2, z, .022, h, .022, CYL); }
    const run = (u0, u1, y, hard) => { if (u1 - u0 < .05) return; const [x, z] = at((u0 + u1) / 2); F.put(m.dark, x, y, z, along ? u1 - u0 : .07, .07, along ? .07 : u1 - u0); if (hard) F.solid(x, z, along ? u1 - u0 : .1, along ? .1 : u1 - u0, h); };
    for (const y of [.08, h - .1]) run(0, len, y, false); run(0, len, 2.2, false);
    if (door) { run(0, door[0], 1.1, true); run(door[1], len, 1.1, true); } else run(0, len, 1.1, true);
  };
  K.shelves = (a, b, q, { w = 2, h = 2.1, loot = null, label = 'the shelves', col = 0x8a9099 } = {}) => {
    const L = frame(a, b, q), n = 4;
    for (const s of [-1, 1]) L.box(T(col), s * (w / 2 - .03), 0, .25, .05, h, .5);
    for (let i = 0; i < n; i++) { const y = .08 + i * (h - .1) / n; L.box(T(col), 0, y, .25, w - .06, .04, .5); let x = -w / 2 + .1; while (x < w / 2 - .5) { const bw = .36 + r() * .3; if (r() < .8) L.box(T(pick([0xc9a877, 0xb98a54, 0xd4b68a, 0x6f8fb0, 0xd9d2c0])), x + bw / 2, y + .04, .25, bw - .05, .22 + r() * .16, .4); x += bw; } }
    L.solid(0, .25, w, .5, h); if (loot) search(L, 0, 1.1, label, loot, Math.max(1, w / 2 - .2));
  };

  // ---------- the gym ----------
  K.treadmill = (a, b, q) => { const L = frame(a, b, q); L.box(m.dark, 0, .1, .9, .7, .14, 1.7); L.box(T(0x3a3f48), 0, .24, .95, .5, .02, 1.4); for (const s of [-1, 1]) L.box(m.steel, s * .32, .2, .2, .04, 1.1, .04); L.box(m.dark, 0, 1.2, .2, .7, .3, .08); L.box(m.screens[2], 0, 1.24, .245, .4, .2, .01); L.solid(0, .9, .7, 1.7, .5); };
  K.weights = (a, b, q, { w = 2 } = {}) => {
    const L = frame(a, b, q);
    for (const y of [.3, .75]) { L.box(m.steel, 0, y, .25, w, .05, .44); for (let x = -w / 2 + .2; x < w / 2 - .1; x += .34) { const c = pick([m.dark, m.dark, T(0xe8553b), T(0x3e6fd6)]); L.box(m.steel, x, y + .12, .25, .025, .26, .025, CYL); for (const s of [-1, 1]) L.box(c, x, y + .05, .25 + s * .13, .1, .16, .08); } }
    for (const s of [-1, 1]) L.box(m.dark, s * (w / 2 - .03), 0, .25, .06, 1.0, .46); L.solid(0, .25, w, .5, 1);
  };
  K.benchPress = (a, b, q) => {
    const L = frame(a, b, q);
    L.box(m.dark, 0, .4, 1.0, .34, .1, 1.4); for (const z of [.4, 1.6]) L.box(m.steel, 0, 0, z, .3, .4, .06);
    for (const s of [-1, 1]) { L.box(m.steel, s * .5, 0, .45, .05, 1.1, .05); for (const t of [0, 1]) L.box(m.dark, s * (.78 + t * .09), .86, .45, .07, .44, .44, CYL); }
    L.box(m.steel, 0, 1.06, .45, 2.0, .04, .04); L.solid(0, .9, 1.9, 1.7, 1.1);
  };
  K.punchBag = (a, b, col = 0xb5462f) => { F.put(m.dark, a, F.hi - .3, b, .012, .6, .012, CYL); F.put(T(col), a, F.hi - 1.25, b, .2, 1.3, .2, CYL); F.solid(a, b, .4, .4, 2); };
  K.ring = (a, b, s = 4.6) => {
    F.put(T(0x2f4f8f), a, .25, b, s + .5, .5, s + .5); F.put(T(0xe9e4d8), a, .52, b, s, .04, s); F.solid(a, b, s + .5, s + .5, .5);
    for (const u of [-1, 1]) for (const v of [-1, 1]) { F.put(u * v > 0 ? m.red : T(0x3e6fd6), a + u * s / 2, 1.2, b + v * s / 2, .09, 1.4, .09, CYL); }
    for (const y of [.95, 1.3, 1.65]) for (const u of [-1, 1]) { F.put(y === 1.3 ? m.red : m.white, a + u * s / 2, y, b, .035, .035, s); F.put(y === 1.3 ? m.red : m.white, a, y, b + u * s / 2, s, .035, .035); }
  };
  K.mirror = (a, b, q, w = 3) => { const L = frame(a, b, q); L.box(m.steel, 0, .5, .02, w, 2, .03); L.box(T(0xd8ecf2), 0, .55, .04, w - .1, 1.9, .012); };

  // ---------- the museum ----------
  K.plinth = (a, b, { h = 1, w = .7, glass = true, col = 0xf2ede4 } = {}) => { F.put(T(col), a, h / 2, b, w, h, w); F.put(m.gold, a, h + .015, b, w + .06, .03, w + .06); if (glass) { F.put(m.glass, a, h + .4, b, w - .06, .74, w - .06); F.put(m.steel, a, h + .78, b, w - .02, .03, w - .02); } F.solid(a, b, w, w, h + (glass ? .8 : .2)); };
  K.statue = (a, b, col = 0xe9e4d8) => { K.plinth(a, b, { h: .6, w: .8, glass: false }); F.put(T(col), a, 1.25, b, .22, 1.2, .16); F.put(T(col), a, 2.0, b, .15, .17, .15, BALL); for (const s of [-1, 1]) F.put(T(col), a + s * .3, 1.5, b, .08, .6, .1); F.solid(a, b, .8, .8, 2.2); };
  K.dino = (a, b, len = 5) => {        // bones on a low stand: spine, ribs, a long neck, a skull with a jaw
    const bone = T(0xe9dfc6), n = 9;
    F.put(m.darkWood, a, .12, b, len + .6, .24, 1.9); F.solid(a, b, len + .6, 1.9, 1.2);
    for (let i = 0; i < n; i++) { const x = a - len * .22 + i * len * .05, y = 1.75 + Math.sin(i / (n - 1) * Math.PI) * .22; F.put(bone, x, y, b, len * .055, .14, .14); if (i > 0 && i < n - 1) for (const s of [-1, 1]) { F.put(bone, x, y - .32, b + s * .3, .05, .6, .05); F.put(bone, x, y - .66, b + s * .2, .05, .05, .26); } }
    for (const [x, s] of [[-len * .2, 1], [-len * .2, -1], [len * .14, 1], [len * .14, -1]]) { F.put(bone, a + x, 1.2, b + s * .34, .09, 1.0, .09); F.put(bone, a + x + .1, .3, b + s * .34, .32, .1, .14); F.put(bone, a + x, .7, b + s * .34, .07, .5, .07); }
    for (let i = 0; i < 6; i++) F.put(bone, a - len * .25 - i * len * .045, 1.7 - i * .2, b, len * .05, .1 - i * .008, .1 - i * .008);          // the tail
    for (let i = 0; i < 5; i++) F.put(bone, a + len * .2 + i * len * .04, 1.85 + i * .22, b, len * .045, .13, .13);                               // the neck
    F.put(bone, a + len * .43, 2.95, b, .62, .3, .3); F.put(bone, a + len * .46, 2.72, b, .5, .07, .22); for (let i = 0; i < 4; i++) F.put(m.white, a + len * .4 + i * .12, 2.78, b + .1, .03, .08, .03);
    F.put(m.gold, a, .27, b - .96, 1.2, .16, .03);
  };
  K.bigPicture = (a, b, q, opt = {}) => { const L = frame(a, b, q), w = opt.w || 1.8, h = opt.h || 1.2, y = opt.y || 1.75; L.box(m.gold, 0, y - h / 2 - .06, .02, w + .12, h + .12, .05); K.picture(a, b, q, { w, h, y, ...opt }); L.box(m.gold, 0, y - h / 2 - .32, .03, .34, .1, .02); };
  K.rope = (a0, b0, a1, b1) => {        // brass posts and a red rope
    const len = Math.hypot(a1 - a0, b1 - b0), n = Math.max(1, Math.round(len / 1.5)), along = Math.abs(a1 - a0) > Math.abs(b1 - b0);
    for (let i = 0; i <= n; i++) { const x = a0 + (a1 - a0) * i / n, z = b0 + (b1 - b0) * i / n; F.put(m.gold, x, .48, z, .035, .96, .035, CYL); F.put(m.gold, x, .02, z, .13, .04, .13, CYL); }
    F.put(T(0x9a2335), (a0 + a1) / 2, .82, (b0 + b1) / 2, along ? len : .045, .045, along ? .045 : len); F.solid((a0 + a1) / 2, (b0 + b1) / 2, along ? len : .15, along ? .15 : len, .95);
  };

  // ---------- the club ----------
  K.danceFloor = (a, b, na, nb, s = 1) => { for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) F.put((i + j) % 2 ? m.screens[(i * 3 + j) % 6] : T(0x16121f), a + (i - (na - 1) / 2) * s, .03, b + (j - (nb - 1) / 2) * s, s - .06, .03, s - .06); };
  K.speaker = (a, b, h = 1.6) => { F.put(m.dark, a, h / 2, b, .7, h, .6); F.solid(a, b, .7, .6, h); };
  K.djBooth = (a, b, q) => {
    const L = frame(a, b, q);
    L.box(T(0x16121f), 0, 0, 1.0, 5, .4, 2); L.box(m.dark, 0, .4, 1.5, 2.4, 1.0, .7); L.box(m.screens[1], 0, .5, 1.86, 2.2, .7, .012); L.box(m.steel, 0, 1.4, 1.5, 2.3, .04, .66);
    for (const s of [-1, 1]) { L.box(m.dark, s * .65, 1.42, 1.5, .26, .03, .26, CYL); L.box(m.screens[0], s * .65, 1.45, 1.5, .08, .012, .08, CYL); }
    L.box(m.screens[3], 0, 1.43, 1.5, .4, .04, .3);
    for (const s of [-1, 1]) { L.box(m.dark, s * 2.05, .4, .7, .8, 1.9, .7); for (const y of [.75, 1.6]) L.box(T(0x3a3f48), s * 2.05, y, 1.055, .26, .26, .012, BALL); }
    L.solid(0, 1.0, 5, 2, .9);
  };
  K.barRun = (a, b, q, { len = 4, body = F.accent, stools = true } = {}) => {     // a bar with bottles on the wall behind it
    const L = frame(a, b, q);
    L.box(body, 0, 0, 1.5, len, 1.02, .7); L.box(m.darkWood, 0, 1.02, 1.5, len + .1, .07, .82); L.box(m.gold, 0, 1.1, 1.72, len - .3, .03, .04);
    for (let k = 0; k < 3; k++) { L.box(m.darkWood, 0, 1.5 + k * .5, .14, len, .04, .26); for (let x = -len / 2 + .2; x < len / 2 - .1; x += .3) L.box(m.screens[Math.floor(r() * 6)], x, 1.54 + k * .5, .14, .05, .28, .05, CYL); }
    L.box(m.screens[1], 0, 3.02, .04, len - .4, .08, .03);
    if (stools) for (let x = -len / 2 + .6; x < len / 2 - .3; x += 1.1) { L.box(m.steel, x, 0, 2.4, .03, .7, .03, CYL); L.box(m.red, x, .7, 2.4, .17, .09, .17, CYL); }
    L.solid(0, 1.5, len, .7, 1.1); return L;
  };
  K.poker = (a, b) => { F.put(m.darkWood, a, .36, b, .12, .72, .12, CYL); F.put(m.darkWood, a, .75, b, .85, .06, .85, CYL); F.put(T(0x2f8f5a), a, .79, b, .74, .02, .74, CYL); for (let i = 0; i < 5; i++) { const t = i * 1.26; F.put(pick(m.goods), a + Math.cos(t) * .45, .83, b + Math.sin(t) * .45, .05, .06, .05, CYL); F.put(T(0x7a2f3f), a + Math.cos(t) * 1.2, .45, b + Math.sin(t) * 1.2, .22, .08, .22, CYL); F.put(m.steel, a + Math.cos(t) * 1.2, .2, b + Math.sin(t) * 1.2, .03, .4, .03, CYL); } F.solid(a, b, 1.7, 1.7, .85); };

  // ---------- the bank ----------
  K.teller = (a, b, len, { body = m.darkWood } = {}) => {       // a counter across the room at b with glass over it and three windows
    F.put(body, a, .55, b, len, 1.1, .8); F.put(m.gold, a, 1.12, b, len + .1, .05, .9); F.solid(a, b, len, .8, 1.2);
    F.put(m.glass, a, 1.95, b, len, 1.6, .04); const n = Math.max(2, Math.round(len / 2.6));
    for (let i = 0; i <= n; i++) F.put(m.gold, a - len / 2 + i * len / n, 1.95, b, .06, 1.6, .08); F.put(m.gold, a, 2.77, b, len, .06, .08);
    for (let i = 0; i < n; i++) F.put(m.screens[3], a - len / 2 + (i + .5) * len / n, 2.55, b - .03, .5, .16, .02);
  };
  K.vaultDoor = (a, b, q) => {          // a round steel door standing open against the wall beside its doorway
    const L = frame(a, b, q);
    L.box(m.steel, 0, .1, .1, 1.05, 2.1, .2, CYL); L.box(T(0x8a9099), 0, .25, .22, .9, 1.8, .05, CYL);
    L.box(m.gold, 0, 1.0, .3, .3, .3, .06, CYL); for (let i = 0; i < 6; i++) { const t = i * Math.PI / 3; L.box(m.gold, Math.cos(t) * .3, 1.12 + Math.sin(t) * .3, .34, .06, .06, .04); }
    for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4; L.box(m.dark, Math.cos(t) * .82, 1.1 + Math.sin(t) * .82, .28, .07, .07, .08, BALL); }
    L.solid(0, .15, 2.1, .3, 2.2);
  };
  K.cashPallet = (a, b, n = 3) => { F.put(m.wood, a, .07, b, 1.1, .14, .9); for (let k = 0; k < n; k++) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { F.put(T(0x6fbf7a), a - .34 + i * .34, .21 + k * .15, b - .2 + j * .4, .3, .13, .36); F.put(m.white, a - .34 + i * .34, .21 + k * .15, b - .2 + j * .4, .31, .135, .08); } F.solid(a, b, 1.1, .9, .2 + n * .15); };
  K.server = (a, b, q, n = 2) => { const L = frame(a, b, q), w = n * .62; L.box(m.dark, 0, 0, .4, w, 2, .8); for (let i = 0; i < n; i++) for (let j = 0; j < 9; j++) { L.box(T(0x23262e), -w / 2 + .31 + i * .62, .12 + j * .2, .805, .54, .15, .01); L.box(j % 3 ? m.green : m.screens[0], -w / 2 + .12 + i * .62, .17 + j * .2, .812, .05, .03, .008); } L.solid(0, .4, w, .8, 2); };

  // ---------- odds and ends ----------
  K.cubicle = (a, b, q, opt = {}) => { const L = K.desk(a, b, q, { w: 1.5, ...opt }), c = opt.screen ?? 0x6f8fb0; L.box(T(c), 0, 0, -.03, 1.7, 1.25, .05); L.box(T(c), -.82, 0, .6, .05, 1.25, 1.3); L.solid(0, -.03, 1.7, .08, 1.25); L.solid(-.82, .6, .08, 1.3, 1.25); return L; };
  K.suitcase = (a, b, q, col = pick(SOFT)) => { const L = frame(a, b, q); L.box(T(col), 0, 0, .25, .7, .5, .44); L.box(m.dark, 0, .5, .25, .2, .06, .04); for (const s of [-1, 1]) L.box(m.gold, s * .2, .3, .475, .06, .08, .02); L.solid(0, .25, .7, .44, .5); search(L, 0, .95, 'the suitcase', 'luggage', .8); };
  K.hotTub = (a, b) => { F.put(m.white, a, .32, b, 1.25, .64, 1.25, CYL); F.put(T(0x7fd3e8), a, .6, b, 1.05, .1, 1.05, CYL); F.put(m.cool, a, .655, b, .9, .012, .9, CYL); for (let i = 0; i < 3; i++) F.put(m.darkWood, a - 1.5, .1 + i * .18, b, .5 - i * .1, .18, 1); F.solid(a, b, 2.4, 2.4, .7); };
  K.piano = (a, b, q) => { const L = frame(a, b, q); L.box(m.dark, 0, .7, .75, 1.5, .28, 1.5); L.box(m.dark, 0, .98, .9, 1.44, .04, 1.2); L.box(m.white, 0, .78, 1.56, 1.3, .05, .16); for (let i = 0; i < 9; i++) L.box(m.dark, -.56 + i * .14, .83, 1.52, .05, .012, .09); for (const [x, z] of [[-.6, .2], [.6, .2], [0, 1.3]]) L.box(m.dark, x, 0, z, .07, .7, .07); L.box(m.dark, 0, .44, 2.0, .7, .08, .34); for (const s of [-1, 1]) L.box(m.dark, s * .28, 0, 2.0, .05, .44, .3); L.solid(0, .85, 1.5, 1.7, 1); };
  K.easel = (a, b, q) => { const L = frame(a, b, q); for (const s of [-1, 1]) L.box(m.wood, s * .3, 0, .3, .04, 1.7, .04); L.box(m.wood, 0, 0, .05, .04, 1.6, .04); L.box(m.wood, 0, .7, .34, .8, .04, .08); L.box(m.white, 0, .74, .33, .9, .8, .03); L.box(pick(m.goods), -.1, .95, .35, .5, .36, .006); L.box(pick(m.goods), .15, 1.12, .352, .3, .3, .006, BALL); L.solid(0, .25, .8, .5, 1.6); };
  K.mattress = (a, b, q) => { const L = frame(a, b, q); L.box(m.white, 0, 0, 1, 1.3, .22, 1.95); L.box(T(pick(SOFT)), 0, .22, 1.25, 1.34, .05, 1.3); L.box(m.cream, 0, .22, .3, .7, .1, .36); L.solid(0, 1, 1.3, 1.95, .3); };
  K.monitorWall = (a, b, q, { nx = 4, ny = 2, y = 1.3 } = {}) => { const L = frame(a, b, q); L.box(m.dark, 0, y - .06, .03, nx * .72 + .1, ny * .5 + .12, .05); for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) L.box(m.screens[(i + j * 2) % 6], (i - (nx - 1) / 2) * .72, y + j * .5 + .02, .06, .64, .42, .012); };
  K.goldBars = (a, b) => { F.put(m.steel, a, .4, b, 1.0, .8, .7); for (let k = 0; k < 3; k++) for (let i = 0; i < 4 - k; i++) F.put(m.gold, a - .36 + k * .12 + i * .24, .85 + k * .1, b, .2, .09, .5); F.solid(a, b, 1, .7, 1.1); };
  // a lucky cat: one of a set hidden about town (interiors.js keeps count). y = what it sits on.
  K.cat = (a, b, y = 0, id) => {
    const p = (dx, dy, sx, sy, sz, mat = m.gold, geo) => F.put(mat, a + dx, y + dy, b, sx, sy, sz, geo);
    p(0, .11, .11, .12, .1, m.gold, BALL); p(0, .27, .085, .08, .08, m.gold, BALL); for (const s of [-1, 1]) p(s * .055, .36, .03, .05, .03, m.gold, CONE);
    p(.1, .25, .025, .08, .025, m.gold, CYL); p(0, .2, .1, .02, .09, m.red, CYL); p(-.03, .285, .015, .015, .09, m.dark); p(.03, .285, .015, .015, .09, m.dark);
    return F.spot(a, b, 'cat', 1.15, { id });
  };
  K.swivel = swivel; K.chair = chair; K.search = search;
  return K;
}
