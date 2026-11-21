// What is in the buildings that have an upstairs: which buildings they are, and what stands on every floor.
// storeys.js builds the shell and calls furnish(kind, F) once per floor; F is that floor (put, solid, spot, partition, lamp ...)
// and furniture.js supplies the pieces. Coordinates are the room's own: a across the front (the stair bay is at the high-a
// end), b back from the front wall. F.x0..F.x1 and F.d0..F.d1 are the walls you can furnish between.
import { kit, SHAPES } from './furniture.js';
import { STOREY } from './storeys.js';

const { CYL, BALL, CONE } = SHAPES, S = STOREY;

// block / corner / face pick a downtown building as in interiors.js; up = the floors above the street, in order; roof = what is
// up top; bay: -1 puts the stairs on the left as you walk in; labels: what a floor is called here, where that differs.
export const UPSTAIRS = [
  { id: 'arms', name: 'SUNSET ARMS', kind: 'flats', block: [-1, -1], corner: [-1, -1], face: [-1, 0], up: ['flat', 'flat', 'flat', 'flat'], roof: 'terrace', sign: '#ffd34d' },
  { id: 'palm', name: 'PALM COURT', kind: 'flats', block: [-1, 1], corner: [1, -1], face: [1, 0], up: ['flat', 'studio', 'flat', 'den'], roof: 'terrace', sign: '#7dff8a', bay: -1 },
  { id: 'coral', name: 'CORAL HEIGHTS', kind: 'flats', block: [-1, -2], corner: [1, -1], face: [1, 0], up: ['studio', 'flat', 'flat', 'flat'], roof: 'terrace', sign: '#ff8a6d' },
  { id: 'insure', name: 'FLAMINGO INSURANCE', kind: 'office', block: [-1, 0], corner: [1, 1], face: [1, 0], up: ['cubicles', 'meeting', 'boss'], roof: 'plain', who: 'tiff', sign: '#ff7fae' },
  { id: 'bank', name: 'FIRST SUNSET BANK', kind: 'bank', block: [0, 0], corner: [1, -1], face: [0, -1], up: ['vault', 'boss'], roof: 'plain', who: 'possum', sign: '#7dffb0', bay: -1 },
  { id: 'club', name: 'THE PINK PELICAN', kind: 'club', block: [-1, -2], corner: [1, 1], face: [1, 0], up: ['vip', 'den'], roof: 'terrace', who: 'raccoon', sign: '#ff4d8d', labels: { den: 'COUNTING ROOM' } },
  { id: 'gym', name: 'IRON POSSUM GYM', kind: 'gym', block: [0, -1], corner: [1, 1], face: [0, 1], up: ['ring', 'changing'], roof: 'plain', who: 'scrap', sign: '#ff8a3d' },
  { id: 'museum', name: 'SUNSET MUSEUM', kind: 'museum', block: [-2, 1], corner: [1, 1], face: [1, 0], up: ['gallery', 'gems'], roof: 'plain', who: 'tess', sign: '#ffe9a8', bay: -1 },
];

const WALLS = { flat: 0xefe6d6, studio: 0xf4f1ea, den: 0xd8cfc0, hotel: 0xf0e0c8, suite: 0xe9dcc6, squad: 0xdde3ee, evidence: 0xcfd5dd, ward: 0xeef6f3, theatre: 0xe6f1f0, cubicles: 0xe9edf2, meeting: 0xe6e9ee, boss: 0xe4d9c4,
  vault: 0x7a838f, vip: 0x2a1f3f, ring: 0xdfe3e6, changing: 0xdbe7ea, gallery: 0xf2ede4, gems: 0x2b2f3a };
const FLOORS = { flat: 'wood', studio: 'concrete', den: 'wood', hotel: 'red', suite: 'oak', squad: 'lino', evidence: 'concrete', ward: 'lino', theatre: 'tile', cubicles: 'grey', meeting: 'blue', boss: 'dark',
  vault: 'rubber', vip: 'red', ring: 'rubber', changing: 'tile', gallery: 'oak', gems: 'marble' };
const LABEL = { flat: 'FLAT', studio: 'FLAT', den: 'FLAT', hotel: 'ROOMS', suite: 'PENTHOUSE SUITE', squad: 'SQUAD ROOM', evidence: 'CELLS AND EVIDENCE', ward: 'WARD', theatre: 'OPERATING THEATRE', cubicles: 'OFFICES', meeting: 'BOARDROOM',
  boss: "MANAGER'S OFFICE", vault: 'THE VAULT', vip: 'VIP LOUNGE', ring: 'BOXING RING', changing: 'CHANGING ROOMS', gallery: 'GALLERY', gems: 'JEWEL ROOM' };
const CEILS = { club: 0x1b1730, vip: 0x1b1730, gems: 0x16181d, vault: 0x8a929c };
export const wallColour = (kind) => WALLS[kind];
export const ceilColour = (kind) => CEILS[kind];
export const floorOf = (kind) => FLOORS[kind] || 'wood';
const ORD = ['', '1ST', '2ND', '3RD'];
export const nameOf = (kind, k, shop) => { const l = shop?.labels?.[kind] || LABEL[kind]; return `${ORD[k + 1] || (k + 1) + 'TH'} FLOOR` + (l ? `  ${l}${l === 'FLAT' ? ' ' + k : ''}` : ''); };
let cats = 0;                       // the lucky cats are numbered in the order they are put down
const cat = (K, a, b, y = 0) => K.cat(a, b, y, cats++);

// The same floor with back and front swapped: a plan drawn once can be built either way round.
function flipped(F) {
  const c = F.d0 + F.d1, G2 = { ...F };
  G2.put = (mat, a, y, b, ...rest) => F.put(mat, a, y, c - b, ...rest); G2.solid = (a, b, ...rest) => F.solid(a, c - b, ...rest);
  G2.spot = (a, b, ...rest) => F.spot(a, c - b, ...rest); G2.lamp = (a, b, ...rest) => F.lamp(a, c - b, ...rest);
  G2.folk = (a, b, who, da = 0, db = -1, pose) => F.folk(a, c - b, who, da, -db, pose);
  G2.block = (mat, a, y, b, ...rest) => F.block(mat, a, y, c - b, ...rest);
  G2.partition = (a0, b0, a1, b1, gaps = [], col) => F.partition(a0, c - b0, a1, c - b1, Math.abs(a1 - a0) > Math.abs(b1 - b0) ? gaps : gaps.map(([p, q]) => [c - q, c - p]), col);
  return G2;
}
// The landing: a wall between the stairs and the rest of the floor, with doors in it. Returns where that wall is.
function landing(F, doors, col) {
  const a = F.x1 - 1.35; F.partition(a, F.d0, a, F.d1, doors.map(b => [b - .5, b + .5]), col);
  for (const b of doors) for (const s of [-1, 1]) F.put(F.m.darkWood, a, 1.08, b + s * .53, .16, 2.16, .06);
  for (const b of doors) F.put(F.m.darkWood, a, 2.18, b, .16, .06, 1.12);
  for (let b = F.d0 + 2; b < F.d1 - 1; b += 4) F.lamp(F.x1 - .6, b, .5, .9);
  // a skirting board both sides, and something to look at on the way past
  const K = kit(F), free = (b) => doors.every(d => Math.abs(d - b) > 1.5);
  for (const s of [-1, 1]) F.put(F.m.darkWood, a + s * .07, .06, (F.d0 + F.d1) / 2, .02, .12, F.d1 - F.d0 - .1);
  for (let b = F.d0 + 3.2; b < F.d1 - 1.5; b += 3.1) if (free(b)) K.picture(a + .06, b, 3, { w: .8, h: .6, y: 1.65 });
  return a - .06;
}

const ROOMS = {};
export function furnish(kind, F) {
  const fn = ROOMS[kind]; if (fn) fn(F, kit(F));
}

// ---------- a block of flats ----------
ROOMS.flats = (F, K) => {            // the lobby
  const { m, x0, x1, d0, d1 } = F, T = F.tinted;
  K.rug(0, 3.4, 2.2, 6, 0x8f2f3f);
  // letter boxes on the far wall, a bench under the notice board, a lift that has seen better days
  const L = K.frame(x0, d0 + 3.4, 3);
  L.box(m.darkWood, 0, 1.0, .03, 2.5, 1.1, .05);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { L.box(m.steel, -1.05 + i * .42, 1.08 + j * .34, .07, .36, .28, .04); L.box(m.dark, -1.05 + i * .42, 1.2 + j * .34, .095, .2, .03, .01); }
  K.bench(x0, d0 + 6.6, 3, { w: 1.8 });
  K.plant(x0 + .5, d0 + .6, 1.2); K.plant(x1 - .5, d0 + .6, 1.2);
  const B = K.frame(-1.2, d1, 0);
  B.box(m.gold, 0, 0, .04, 1.7, 2.6, .08); for (const s of [-1, 1]) B.box(m.steel, s * .38, .06, .1, .72, 2.4, .04); B.box(m.red, 0, 2.66, .06, .5, .14, .04);
  B.box(m.white, 0, 1.2, .13, .7, .34, .012); B.box(m.dark, 0, 1.33, .14, .5, .05, .006); B.box(m.dark, 0, 1.24, .14, .36, .04, .006);
  K.vending(x0 + .9, d1, 0);
  K.picture(x0 + 3.4, d1, 0, { w: 1.4, h: .9, y: 1.8 });
  K.search(K.frame(F.bay.a0 - .1, S.b0 + S.run * .76, 1), 0, .7, 'the cupboard under the stairs', 'crate', 1);
};
ROOMS.flat = (F0, K0) => {
  const r = F0.r, F = r() < .5 ? flipped(F0) : F0, K = F === F0 ? K0 : kit(F), { m, x0, d0, d1 } = F, T = F.tinted;
  const Dp = d1 - d0, door = d0 + 1.5, hall = landing(F, [door]), W = hall - x0, bm = d0 + Dp * .56, am = x0 + W * .58;
  const soft = K.pick(K.SOFT), wood = K.pick(K.WOODS), accent = K.pick([0xd9c7a6, 0xbfd8d2, 0xe8c9b0, 0xc9cfe6, 0xe6dcb8]);
  // rooms: the living room and kitchen at this end, a bedroom and a bathroom beyond the wall
  F.partition(x0, bm, hall, bm, [[am - 1.4, am - .45], [am + .35, am + 1.25]], accent);
  F.partition(am, bm, am, d1, []);
  F.put(m.darkWood, hall + .02, 2.3, door, .05, .2, .4); F.put(m.gold, hall + .05, 2.3, door, .03, .12, .22);            // the number on the door
  // living room
  K.sofa(x0 + 2.7, bm - .07, 0, { col: soft }); K.rug(x0 + 2.7, bm - 2.3, 3, 2.1, soft); K.coffee(x0 + 2.7, bm - 1.9, { wood });
  K.tv(x0 + 2.7, d0, 2, { wood }); K.sofa(x0, bm - 2.6, 3, { w: .95, col: soft }); K.floorLamp(x0 + .4, bm - .5);
  K.picture(x0 + 2.7, bm - .07, 0, { w: 1.4, h: .8, y: 2.0 });
  if (r() < .7) K.bookshelf(x0, d0 + 1.6, 3, { wood });
  // kitchen along the landing wall, and somewhere to eat
  const kb = bm - 2.0; K.kitchen(hall, kb, 1, { w: 2.8 }); K.fridge(hall, kb - 1.8, 1);
  K.table(hall - 2.7, d0 + 2.3, 0, { w: 1.3, d: .85, chairs: 4, wood, col: soft });
  K.plant(hall - .45, d0 + .5);
  F.lamp(x0 + 2.7, bm - 2.4); F.lamp(hall - 2.4, d0 + 2.4);
  // bedroom
  K.bed(x0 + 2.5, d1, 0, { col: soft, wood }); K.nightstand(x0 + 1.35, d1, 0, { wood }); K.nightstand(x0 + 3.65, d1, 0, { wood, loot: null });
  K.wardrobe(x0 + 1.1, bm + .07, 2, { wood }); K.rug(x0 + 2.5, d1 - 2.6, 2.6, 1.6, accent, soft);
  K.dresser(x0, bm + 2.2, 3, { wood, mirror: false });
  F.lamp(x0 + 2.5, (bm + d1) / 2);
  // bathroom: tiles underfoot
  F.put(T(0xdbe7ea), (am + hall) / 2, .012, (bm + d1) / 2, hall - am - .1, .024, d1 - bm - .1);
  K.bath(am + 1.05, d1, 0); K.toilet(hall, bm + 1.5, 1); K.basin(hall, bm + 2.9, 1, { cabinet: true });
  F.lamp((am + hall) / 2, (bm + d1) / 2, .6, .6);
  // somebody may be home, and one flat in three has a safe in the bedroom
  if (r() < .55) F.folk(hall - 2.2, bm - 1.3, 'resident', -1, -.4);
  if (r() < .34) K.safe(am - .5, d1, 0, 'house');
  if (F.shop.id === 'arms' && F.k === 3) cat(K, x0 + 2.4, bm - 1.9, .41);
};

// an artist lives here: one big room, canvases everywhere
ROOMS.studio = (F0, K0) => {
  const r = F0.r, F = r() < .5 ? flipped(F0) : F0, K = F === F0 ? K0 : kit(F), { m, x0, d0, d1 } = F, T = F.tinted;
  const hall = landing(F, [d0 + 1.5]), W = hall - x0, mid = (d0 + d1) / 2;
  for (let i = 0; i < 9; i++) F.put(K.pick(m.goods), x0 + 1.5 + r() * (W - 3), .008 + i * .001, d0 + 2 + r() * (d1 - d0 - 5), .5 + r() * 1.1, .012, .4 + r() * .9, BALL);      // paint on the floor
  K.easel(x0 + W * .35, mid - .6, 0); K.easel(x0 + W * .6, mid + .4, 0); K.easel(x0 + W * .5, d0 + 2.2, 2);
  K.stool(x0 + W * .35, mid - 1.7, m.wood); K.crate(x0 + W * .47, mid - 1.3, .5); for (let i = 0; i < 4; i++) F.put(m.goods[i * 2], x0 + W * .47 - .15 + i * .1, .56, mid - 1.3, .035, .12, .035, CYL);
  for (let i = 0; i < 4; i++) K.bigPicture(x0, d0 + 1.6 + i * 2.5, 3, { w: 1.5 + r() * .6, h: 1 + r() * .5, y: 1.7 });
  K.mattress(x0, d1 - 1.3, 3); K.dresser(x0 + 2.6, d1, 0, { mirror: false }); K.floorLamp(x0 + 1.9, d1 - .5);
  K.kitchen(hall, d1 - 2.2, 1, { w: 2.6 }); K.fridge(hall, d1 - 4.1, 1); K.table(hall - 2.6, d0 + 2.6, 0, { w: 1.2, d: .8, chairs: 2 });
  K.sofa(x0 + W * .5, d1 - .07, 0, { w: 1.9 }); K.plant(hall - .45, d0 + .5, 1.3); K.bookshelf(hall, d0 + 4.4, 1, { w: 1.1 });
  F.lamp(x0 + W * .4, mid - 2); F.lamp(x0 + W * .5, mid + 2.6);
  if (r() < .6) F.folk(x0 + W * .42, mid - 1.9, 'resident', 0, 1);
  if (F.shop.id === 'coral') cat(K, hall - .35, d1 - 2.2, .93);
};
// nobody lives here: somebody counts money here
ROOMS.den = (F, K) => {
  const { m, x0, d0, d1, r } = F, T = F.tinted, hall = landing(F, [d0 + 1.5]), W = hall - x0, ta = hall - 2.7, tb = d0 + 4.6;
  K.tv(x0 + 2.4, d0, 2); K.sofa(x0 + 2.4, d0 + 4.3, 0, { w: 2.3, col: 0x5a4a3a }); K.rug(x0 + 2.4, d0 + 2.4, 2.8, 1.8, 0x7a2f3f, 0x2b2f38);
  K.table(ta, tb, 0, { w: 2, d: 1, chairs: 2, wood: 0x5e3f2a, col: 0x3a3f48 });
  for (let i = 0; i < 7; i++) { F.put(T(0x6fbf7a), ta - .7 + (i % 4) * .34, .8 + Math.floor(i / 4) * .1, tb - .15 + Math.floor(i / 4) * .1, .3, .1, .16); F.put(m.white, ta - .7 + (i % 4) * .34, .8 + Math.floor(i / 4) * .1, tb - .15 + Math.floor(i / 4) * .1, .06, .104, .164); }
  F.put(m.dark, ta + .7, .84, tb + .15, .3, .18, .24); F.put(m.screens[2], ta + .7, .9, tb + .02, .2, .05, .01);
  K.crate(x0 + .8, d1 - .7, .9); K.crate(x0 + 1.75, d1 - .65, .7); K.crate(x0 + .8, d1 - .7 - .95, .7); F.put(T(0xb98a54), x0 + .85, 1.2, d1 - .7, .6, .6, .6);
  K.search(K.frame(x0 + 1.3, d1 - 1.2, 0), 0, .9, 'the crates', 'stash', 1.1);
  K.mattress(x0, d1 - 4.6, 3); K.lockers(hall, d1 - 2.4, 1, { n: 3, col: 0x3a4252, loot: 'stash', label: 'the gun locker' });
  K.safe(x0 + W * .55, d1, 0, 'house'); K.boxes(hall - .6, d0 + 6.8, 3); K.floorLamp(x0 + .4, d0 + 4);
  F.lamp(ta, tb, .5, .5); F.lamp(x0 + 2.4, d0 + 2.6, .5, .5);
  F.folk(ta, tb + 1.9, 'resident', 0, -1); if (r() < .6) F.folk(x0 + W * .5, d1 - 2.6, 'resident', 1, -1);
  if (F.shop.id === 'palm') cat(K, x0 + 1.75, d1 - .65, .7);
};

// ---------- the motel's rooms ----------
function hotelRoom(F, K, hall, mid, guest) {
  const { m, x0, d0, r } = F, bb = d0 + 3.3, col = K.pick(K.SOFT), wood = K.pick(K.WOODS);
  K.bed(x0, bb, 3, { w: 1.6, col, wood }); K.nightstand(x0, bb - 1.12, 3, { wood }); K.nightstand(x0, bb + 1.12, 3, { wood, loot: null }); K.picture(x0, bb, 3, { w: 1.2, h: .7, y: 2.0 });
  K.rug(x0 + 3.1, bb, 1.8, 3, col); K.tv(hall, d0 + 3.8, 1, { wood }); K.wardrobe(x0 + 3.3, mid - .07, 0, { wood }); K.suitcase(x0 + 5, mid - .07, 0);
  K.sofa(x0 + 4.4, d0, 2, { w: .95, col }); K.plant(x0 + .5, d0 + .5); K.basin(hall, mid - 1.1, 1, { cabinet: true });
  F.put(m.darkWood, hall + .02, 2.3, d0 + 1.6, .05, .2, .4); F.put(m.gold, hall + .05, 2.3, d0 + 1.6, .03, .12, .22);
  F.lamp(x0 + 3, bb); if (guest) F.folk(x0 + 4.3, d0 + 2, 'guest', -1, .4);
}
ROOMS.hotel = (F, K) => {
  const { d0, d1, r } = F, mid = (d0 + d1) / 2, hall = landing(F, [d0 + 1.6, d1 - 1.6]), G2 = flipped(F);
  F.partition(F.x0, mid, hall, mid, []); hotelRoom(F, K, hall, mid, r() < .4); hotelRoom(G2, kit(G2), hall, mid, r() < .4);
};
ROOMS.suite = (F, K) => {
  const { m, x0, d0, d1 } = F, T = F.tinted, mid = (d0 + d1) / 2, hall = landing(F, [mid]), W = hall - x0;
  K.bed(x0, d1 - 2.3, 3, { w: 2, col: 0x7a2f3f, wood: 0x5e3f2a }); K.nightstand(x0, d1 - .95, 3, { wood: 0x5e3f2a }); K.nightstand(x0, d1 - 3.65, 3, { wood: 0x5e3f2a }); K.bigPicture(x0, d1 - 2.3, 3, { w: 1.6, h: .8, y: 2.1 });
  K.rug(x0 + 3.2, d1 - 2.3, 1.8, 3.4, 0xd9a441); K.hotTub(hall - 1.6, d1 - 1.7); K.plant(hall - .45, d1 - 3.7, 1.3);
  K.tv(x0 + 2.6, d0, 2, { w: 1.9, wood: 0x5e3f2a }); K.sofa(x0 + 2.6, d0 + 4.4, 0, { w: 2.6, col: 0xe9e4d8 }); K.sofa(x0, d0 + 2.3, 3, { w: 1.9, col: 0xe9e4d8 }); K.rug(x0 + 2.6, d0 + 2.4, 3.2, 2, 0x7a2f3f); K.coffee(x0 + 2.6, d0 + 2.5, { w: 1.3, wood: 0x5e3f2a });
  K.barRun(hall, d0 + 2.6, 1, { len: 2.8, body: T(0x5e3f2a) }); cat(K, hall - 1.5, d0 + 1.6, 1.09);
  K.safe(x0 + W * .52, d1, 0, 'office'); K.wardrobe(x0 + W * .52 - 2, d1, 0, { w: 1.6, wood: 0x5e3f2a }); K.plant(x0 + .5, d0 + .5, 1.3);
  for (const [k, w] of [[.06, .9], [.2, .6]]) { F.put(m.gold, x0 + 2.6, F.hi - k, d0 + 2.5, w, .05, w, CYL); F.put(m.panel, x0 + 2.6, F.hi - k - .04, d0 + 2.5, w * .9, .03, w * .9, CYL); }
  F.lamp(x0 + 2.5, d1 - 2.3); F.lamp(hall - 1.6, d1 - 1.7, .6, .6);
};

// ---------- Sunset PD ----------
ROOMS.squad = (F, K) => {
  const { m, x0, x1, d0, d1 } = F, T = F.tinted, edge = x1 - 1.4, ob = d1 - 3.8, oa = x0 + 4.4;
  for (const [i, a] of [x0 + 2.2, x0 + 5.2, x0 + 8.2].filter(a => a < edge - .9).entries()) for (const [j, b] of [d0 + 2.6, d0 + 5.5, d0 + 8.4].filter(b => b < ob - .5).entries()) {
    K.desk(a, b, 0, { w: 1.5, wood: 0x8a9099, loot: (i + j) % 3 === 1 ? 'desk' : null, label: "the detective's desk" }); F.lamp(a, b - .6, .9, .4);
  }
  K.whiteboard(x0, d0 + 4.2, 3, { w: 2.6 }); for (let i = 0; i < 4; i++) F.put(m.goods[i], x0 + .05, 1.5 + (i % 2) * .4, d0 + 3.5 + i * .45, .012, .3, .24);
  // the captain's office, glass above the waist
  F.partition(x0, ob, oa, ob, [[oa - 1.5, oa - .5]], 0xb9c3d3); F.partition(oa, ob, oa, d1, [], 0xb9c3d3);
  K.desk(x0 + 2, d1 - 1.7, 2, { w: 1.8, wood: 0x5e3f2a, loot: 'desk', label: "the captain's desk" }); K.filing(x0, d1 - 2.6, 3, { n: 2 }); cat(K, x0 + .3, d1 - 2.6, 1.32); K.picture(x0 + 2, d1, 0, { w: 1, h: .7, y: 2 });
  K.lockers(oa + 2.2, d1, 0, { n: 5, col: 0x24408f }); K.filing(oa + 4.4, d1, 0, { n: 2 });
  K.cooler(edge - 1.4, d0, 2); K.copier(edge - 3, d0, 2); K.plant(x0 + .5, d0 + .5);
  F.folk(x0 + 3.7, d0 + 4, 'cop', 1, 0); F.folk(edge - 1.6, ob - .6, 'cop', -1, -1);
};
ROOMS.evidence = (F, K) => {
  const { m, x0, d0, d1 } = F, T = F.tinted, mid = (d0 + d1) / 2, hall = landing(F, [d0 + 1.6]), ca = x0 + 3;
  // two cells: one open, one with somebody in it
  K.bars(ca, mid - 3, ca, mid, [1, 2]); K.bars(ca, mid, ca, mid + 3); for (const b of [mid - 3, mid, mid + 3]) K.bars(x0, b, ca, b);
  for (const b of [mid - 2.4, mid + .6]) { F.put(m.steel, x0 + .45, .42, b + .9, .8, .08, 1.9); F.put(T(0x6f7f8f), x0 + .45, .5, b + .9, .76, .08, 1.84); F.solid(x0 + .45, b + .9, .8, 1.9, .5); }
  F.folk(x0 + 1.9, mid + 1.5, 'prisoner', 1, 0); cat(K, x0 + .45, mid - .5, 0);
  K.shelves(x0 + 6, d1, 0, { w: 2.6, loot: 'evidence', label: 'the evidence shelves' }); K.shelves(hall, d1 - 2.6, 1, { w: 2.4, loot: 'evidence', label: 'the evidence locker' });
  K.crate(x0 + 4.2, d1 - .6, .8); K.boxes(x0 + 1.2, d1 - .6, 3); K.boxes(x0 + 2.2, d0 + .6, 2);
  K.desk(x0 + 6, d0 + 2.4, 2, { w: 1.6, wood: 0x8a9099 }); K.filing(x0 + 4.2, d0, 2, { n: 2, loot: 'desk' }); K.monitorWall(hall, d0 + 4.2, 1, { nx: 2, ny: 2 });
  F.lamp(x0 + 1.5, mid - 1.5, .5, .5); F.lamp(x0 + 1.5, mid + 1.5, .5, .5); F.lamp(x0 + 6, mid); F.lamp(x0 + 6, d1 - 2);
  F.folk(x0 + 6, d0 + 3.6, 'cop', 0, 1);
};

// ---------- Sunset General ----------
ROOMS.ward = (F, K) => {
  const { m, x0, x1, d0, d1 } = F, T = F.tinted, edge = x1 - 1.4;
  let i = 0; for (let b = d0 + 1.5; b < d1 - 1.2; b += 2.55, i++) { K.hospitalBed(x0, b, 3); if (i % 2 === 0) F.folk(x0 + 1.1, b, 'resident', 1, 0, 'lie'); F.lamp(x0 + 1.2, b, .5, .5); }
  K.counter(edge - 1.9, (d0 + d1) / 2, .8, 3.2, m.white, T(0xe8455b)); F.put(m.dark, edge - 1.9, 1.28, (d0 + d1) / 2 + .6, .06, .34, .5); F.put(m.screens[0], edge - 1.94, 1.3, (d0 + d1) / 2 + .6, .01, .28, .44);
  F.folk(edge - 1.1, (d0 + d1) / 2, 'nurse', -1, 0);
  K.shelves(edge - 2, d1, 0, { w: 2, loot: 'medicine', label: 'the medicine cabinet', col: 0xe4e9ec }); K.trolley(x0 + 3.6, d0 + 3); K.trolley(x0 + 3.8, d1 - 3.4);
  K.basin(edge - 2, d0, 2); K.plant(edge - .4, d0 + .5); F.lamp(edge - 2.4, (d0 + d1) / 2 - 3); F.lamp(edge - 2.4, (d0 + d1) / 2 + 3);
};
ROOMS.theatre = (F, K) => {
  const { m, x0, d0, d1 } = F, T = F.tinted, mid = (d0 + d1) / 2, hall = landing(F, [d0 + 1.6, d1 - 1.6]), W = hall - x0, ca = x0 + W / 2, cb = d0 + 3.2;
  F.partition(x0, mid, hall, mid, []);
  // the operating theatre: a table under a big lamp, machines that go ping
  K.hospitalBed(ca - 1.05, cb, 3, { curtain: false, col: 0x7fbfb0 }); F.put(m.steel, ca, F.hi - .3, cb, .03, .6, .03, CYL); F.put(m.steel, ca, F.hi - .66, cb, .6, .1, .6, CYL); F.put(m.panel, ca, F.hi - .72, cb, .52, .03, .52, CYL);
  K.trolley(ca + 1.4, cb - .9); K.trolley(ca - .2, cb + 1.5); F.block(m.white, x0 + .5, 0, cb + .2, .6, 1.3, .7); F.put(m.screens[2], x0 + .81, 1.05, cb + .2, .01, .34, .5); F.put(m.screens[1], x0 + .81, .62, cb + .2, .01, .2, .5);
  K.basin(x0 + 2, d0, 2); K.shelves(hall, d0 + 4.2, 1, { w: 1.8, loot: 'medicine', label: 'the drugs cupboard', col: 0xe4e9ec });
  // staff room
  K.lockers(x0, mid + 2.4, 3, { n: 5, col: 0x2f8f83 }); K.sofa(x0 + 3.4, d1, 0, { w: 2.1, col: 0x2f7f8f }); K.coffee(x0 + 3.4, d1 - 1.8); cat(K, x0 + 3.1, d1 - 1.8, .41);
  K.fridge(x0 + 3, mid + .07, 2); K.kitchen(x0 + 5.3, mid + .07, 2, { w: 2.4 }); K.vending(x0 + 5.8, d1, 0, 2);
  F.lamp(ca, cb + 2.2); F.lamp(ca, mid + 3); F.folk(ca + .6, cb + 1.2, 'nurse', -1, -1);
};

// ---------- an office block ----------
ROOMS.office = (F, K) => {           // reception
  const { m, x0, x1, d0, d1 } = F, T = F.tinted, ca = (x0 + x1 - 1.4) / 2;
  K.counter(ca, d1 - 3.4, 4.2, .9, m.white, F.accent); F.clerk(ca, d1 - 2.3, 0, -1); F.put(m.dark, ca + 1.2, 1.28, d1 - 3.4, .5, .34, .06); F.put(m.screens[0], ca + 1.2, 1.3, d1 - 3.36, .44, .28, .01);
  F.put(m.gold, ca, 2.9, d1 - .06, 3.6, 1.0, .05); F.put(F.accent, ca, 2.9, d1 - .1, 3.2, .16, .04); F.put(F.accent, ca - 1.1, 2.9, d1 - .1, .5, .6, .04, BALL);
  K.sofa(x0, d0 + 4.6, 3, { w: 2.2, col: 0x3e6fa5 }); K.sofa(x0 + 2.6, d0 + 6.6, 0, { w: 1.9, col: 0x3e6fa5 }); K.coffee(x0 + 2.4, d0 + 4.6, { w: .7, d: 1.1 }); K.rug(x0 + 2.2, d0 + 4.6, 3.6, 3, 0x3e6fa5);
  K.plant(x0 + .5, d0 + .6, 1.3); K.plant(x0 + .5, d1 - .6, 1.3); K.cooler(x0, d0 + 2.4, 3);
  // who is on which floor
  const L = K.frame(x0 + 4.4, d1, 0); L.box(m.dark, 0, 1.2, .03, 1.3, 1.5, .04); for (let i = 0; i < 4; i++) { L.box(m.white, -.12, 2.4 - i * .32, .06, .8, .05, .01); L.box(m.gold, -.52, 2.36 - i * .32, .06, .12, .12, .01); }
};
ROOMS.cubicles = (F, K) => {
  const { m, x0, x1, d0, d1, r } = F, T = F.tinted, edge = x1 - 1.4, cols = [x0 + 1.9, x0 + 4.0, x0 + 6.6, x0 + 8.7].filter(a => a < edge - .8);
  let n = 0;
  for (let b = d0 + 2.8; b < d1 - .6; b += 2.75) for (const a of cols) { K.cubicle(a, b, 0, { loot: n % 4 === 1 ? 'desk' : null, pc: r() < .9, screen: [0x6f8fb0, 0x8f9fb0][n % 2] }); n++; }
  for (let b = d0 + 2; b < d1 - 1; b += 3.4) for (const a of [x0 + 3, x0 + 7.6].filter(a => a < edge)) F.lamp(a, b);
  K.copier(edge - 1.2, d0, 2); K.cooler(edge - 2.5, d0, 2); K.plant(edge - .4, d1 - .6, 1.2); K.server(edge - 1.6, d1, 0, 2);
  F.folk(x0 + 3, d0 + 4.2, 'worker', 1, 0); F.folk(Math.min(edge - 1, x0 + 7.6), d0 + 7, 'worker', -1, 0);
};
ROOMS.meeting = (F, K) => {
  const { m, x0, d0, d1 } = F, T = F.tinted, mid = (d0 + d1) / 2, hall = landing(F, [d0 + 1.6, d1 - 1.6]), W = hall - x0, ca = x0 + W / 2 + .3;
  F.partition(x0, mid, hall, mid, []);
  K.table(ca, d0 + 3.1, 0, { w: Math.min(4.6, W - 3.4), d: 1.3, chairs: 10, wood: 0x5e3f2a, col: 0x2b2f38 }); K.monitorWall(x0, d0 + 3.1, 3, { nx: 2, ny: 2, y: 1.1 });
  K.whiteboard(ca, mid - .07, 0, { w: 2.6 }); K.plant(x0 + .5, d0 + .5, 1.2); F.lamp(ca, d0 + 3.1, 3, .5); F.put(m.dark, ca, .8, d0 + 3.1, .3, .08, .3, CYL);
  // the break room
  K.kitchen(x0 + 2, mid + .07, 2, { w: 3 }); K.fridge(x0 + 4.2, mid + .07, 2); K.table(x0 + 2.6, d1 - 2.3, 0, { w: 1.4, d: .9, chairs: 4 });
  K.vending(hall - 1.5, d1, 0); K.sofa(x0, d1 - 2.3, 3, { w: 1.9 }); K.cooler(hall, mid + 2.5, 1); F.lamp(x0 + 3, d1 - 2.6);
  F.folk(hall - 2.4, mid + 2.6, 'worker', -1, 0);
};
ROOMS.boss = (F, K) => {
  const { m, x0, d0, d1 } = F, T = F.tinted, mid = (d0 + d1) / 2, hall = landing(F, [mid]), W = hall - x0;
  K.rug(x0 + 3, mid, 4.6, 4.2, 0x7a2f3f, 0xd9c49a);
  K.desk(x0 + 2.5, mid, 1, { w: 2.3, wood: 0x5e3f2a, col: 0x5a3a2a, loot: 'desk', label: "the boss's desk" }); cat(K, x0 + 2.25, mid - .85, .77);
  for (const s of [-1, 1]) { K.bookshelf(x0, mid + s * 2.6, 3, { w: 1.5, wood: 0x5e3f2a }); F.put(m.wood, x0 + 3.5, .21, mid + s * .7, .44, .42, .44); F.put(T(0x7a2f3f), x0 + 3.5, .45, mid + s * .7, .44, .06, .44); F.put(T(0x7a2f3f), x0 + 3.72, .7, mid + s * .7, .06, .46, .44); }
  K.bigPicture(x0, mid, 3, { w: 1.5, h: 1, y: 2.1 }); K.safe(x0, d1 - 1.1, 3, 'office'); K.plant(x0 + .5, d0 + .5, 1.3);
  K.sofa(x0 + W * .55, d0, 2, { w: 2.3, col: 0x5a3a2a }); K.coffee(x0 + W * .55, d0 + 1.8, { wood: 0x5e3f2a });
  // a globe, and something for the nerves
  F.put(m.darkWood, hall - .5, .4, d0 + .6, .04, .8, .04, CYL); F.put(T(0x3e8fd6), hall - .5, 1.05, d0 + .6, .28, .28, .28, BALL); F.put(T(0x3f9a4a), hall - .46, 1.1, d0 + .68, .2, .18, .2, BALL);
  F.put(m.darkWood, x0 + W * .6, .45, d1 - .35, 1.2, .9, .5); for (let i = 0; i < 5; i++) F.put(m.screens[(i * 2) % 6], x0 + W * .6 - .4 + i * .2, 1.04, d1 - .35, .05, .28, .05, CYL); F.solid(x0 + W * .6, d1 - .35, 1.2, .5, 1);
  F.lamp(x0 + 2.6, mid, .6, 1.6); F.lamp(x0 + W * .55, d0 + 1.8, .6, .6);
  F.folk(x0 + 1.3, mid + 1.3, 'boss', 1, -.4);
};

// ---------- the bank ----------
ROOMS.bank = (F, K) => {
  const { m, x0, x1, d0, d1 } = F, T = F.tinted, a1 = x1 - 1.6, ca = (x0 + a1) / 2, tb = d1 - 3.3;
  K.teller(ca, tb, a1 - x0 - .2); F.clerk(ca, tb + 1.2, 0, -1); F.partition(a1, tb - .4, a1, d1, [], 0xd8c9a6);
  F.put(m.gold, ca, 3.2, d1 - .06, 2.2, .9, .05); F.put(T(0x1f6f4f), ca, 3.2, d1 - .1, 1.8, .5, .04); F.put(m.gold, ca, 3.2, d1 - .13, .34, .34, .03, BALL);
  K.safe(x0 + 1, d1, 0, 'office');                                  // the day safe, behind the counter: round the end if you dare
  K.rope(-1.5, 3.6, -1.5, tb - 2); K.rope(1.5, 3.6, 1.5, tb - 2);
  for (const b of [d0 + 2.4, d0 + 5]) { K.desk(x0 + 1.6, b, 1, { w: 1.5, wood: 0x5e3f2a }); F.put(T(0x1f6f4f), x0 + 2.9, .45, b, .44, .08, .44); F.put(m.steel, x0 + 2.9, .2, b, .03, .4, .03, CYL); }
  // cash machines by the door
  for (const s of [-1, 1]) { const a = s * 3.2; if (a > x1 - 2.4) continue; F.block(m.dark, a, 0, d0 + .35, .8, 1.9, .6, 1.9); F.put(m.screens[2], a, 1.35, d0 + .66, .5, .4, .01); F.put(m.steel, a, 1.0, d0 + .68, .5, .12, .04); }
  K.plant(x0 + .5, d0 + .6, 1.3); for (const [k, w] of [[.08, 1.5], [.24, 1], [.4, .5]]) { F.put(m.gold, 0, F.hi - k, tb - 3.4, w, .06, w, CYL); F.put(m.panel, 0, F.hi - k - .05, tb - 3.4, w * .9, .04, w * .9, CYL); }
  F.folk(x1 - 1.9, d0 + 1.2, 'guard', -1, .5);
};
ROOMS.vault = (F, K) => {
  const { m, x0, d0, d1 } = F, T = F.tinted, mid = (d0 + d1) / 2, hall = landing(F, [mid], 0x8a929c), W = hall - x0;
  K.vaultDoor(hall, mid + 1.75, 1);
  K.lockers(x0, mid - 2.6, 3, { n: 8, col: 0x8a9099, loot: 'deposit', label: 'the deposit boxes' }); K.lockers(x0, mid + 2.6, 3, { n: 8, col: 0x8a9099, loot: 'deposit', label: 'the deposit boxes' });
  K.cashPallet(x0 + W * .45, mid - 2.2, 4); K.cashPallet(x0 + W * .45, mid - .6, 3); K.cashPallet(x0 + W * .45 + 1.5, mid - 1.6, 2); cat(K, x0 + W * .45 + 1.5, mid - 1.6, .5);
  K.goldBars(x0 + W * .3, d0 + .7); K.goldBars(x0 + W * .3 + 1.4, d0 + .7);
  K.safe(x0 + W * .5, d1, 0, 'vault'); K.shelves(x0 + W * .5 + 2.2, d1, 0, { w: 1.8 });
  for (const b of [mid - 3, mid, mid + 3]) F.lamp(x0 + W * .5, b, 2, .3);
  F.folk(hall - 1.4, mid - 1.6, 'guard', -1, .6);
};

// ---------- the club ----------
ROOMS.club = (F, K) => {
  const { m, x0, x1, d0, d1, r } = F, T = F.tinted, a1 = x1 - 1.5, ca = (x0 + 2.6 + a1) / 2, mid = (d0 + d1) / 2, nb = Math.min(6, Math.floor(d1 - d0 - 6.4));
  K.danceFloor(ca, mid - .4, Math.min(6, Math.floor(a1 - x0 - 3.4)), nb, 1); K.djBooth(ca, d1, 0);
  K.barRun(x0, mid - .6, 3, { len: Math.min(6, d1 - d0 - 5) }); F.clerk(x0 + .85, mid - .6, 1, 0); F.spot(x0 + 3, mid - .6, 'bar', 1.5);
  K.speaker(x0 + .6, d0 + .6, 2); K.speaker(a1 - .2, d0 + .6, 2);
  for (const [i, a] of [x0 + 3.4, ca, a1 - .6].entries()) F.put(m.screens[[1, 0, 4][i]], a, F.hi - .05, mid, .1, .06, d1 - d0 - 2);
  for (let i = 0; i < 5; i++) F.folk(ca - 2 + (i % 3) * 2 + (r() - .5) * .6, mid - 2 + Math.floor(i / 3) * 2.4 + (r() - .5) * .6, 'dancer', r() - .5, r() - .5, 'dance');
};
ROOMS.vip = (F, K) => {
  const { m, x0, x1, d0, d1 } = F, T = F.tinted, edge = x1 - 1.4, W = edge - x0, mid = (d0 + d1) / 2;
  K.barRun(x0, d1 - 2.6, 3, { len: 3.4, body: T(0x7a2f5a) }); cat(K, x0 + 1.5, d1 - 1.3, 1.09);
  for (const b of [d0 + 2.2]) { K.sofa(x0 + 2.6, d0, 2, { w: 2.8, col: 0x7a2f5a }); K.sofa(x0, b + .6, 3, { w: 2.2, col: 0x7a2f5a }); K.coffee(x0 + 2.6, b, { w: 1.4, d: .8, wood: 0x2b2f38 }); F.put(m.screens[3], x0 + 2.6, .47, b, .07, .12, .07, CYL); }
  K.poker(x0 + W * .62, mid + .6); K.piano(edge - 1.2, d1, 0); K.plant(x0 + .5, d0 + .5, 1.3); K.plant(edge - .4, d0 + .5, 1.3);
  K.rug(x0 + 2.6, d0 + 2.3, 4, 3, 0x241a3a, 0xff4d8d);
  for (const a of [x0 + .06]) F.put(m.screens[1], a, 2.9, mid - 1.5, .03, .08, 5); F.put(m.screens[4], x0 + W / 2, F.hi - .05, d0 + .2, W - 1, .06, .1);
  F.lamp(x0 + W * .62, mid + .6, .5, .5); F.lamp(x0 + 2.6, d0 + 2.2, .5, .5);
  F.folk(x0 + W * .62 + 1.5, mid + 1.4, 'guest', -1, -.5); F.folk(x0 + 3.2, d1 - 3.4, 'guest', -1, 1);
};

// ---------- the gym ----------
ROOMS.gym = (F, K) => {
  const { m, x0, x1, d0, d1 } = F, T = F.tinted, a1 = x1 - 1.5, mid = (d0 + d1) / 2;
  K.counter(x0 + 1.7, d0 + 2, .8, 2.4, m.steel, F.accent); F.clerk(x0 + .8, d0 + 2, 1, 0); F.spot(x0 + 2.9, d0 + 2, 'gym', 1.4);
  let n = 0; for (let a = x0 + 1; a < a1 - .4; a += 1.25, n++) K.treadmill(a, d1, 0); K.mirror(x0 + (a1 - x0) / 2, d1, 0, a1 - x0 - 1);
  K.weights(x0, mid + .6, 3, { w: 3 }); K.benchPress(-1.4, mid + 1.4, 0); K.benchPress(1.1, mid + 1.4, 0);
  K.punchBag(a1 - 1, d0 + 4.4); K.plant(x0 + .5, d0 + .6, 1.2); K.vending(x0, mid + 3.4, 3, 4);
  for (const s of [-1, 1]) F.put(F.accent, s * 1.2 - .15, .012, mid - 1.2, 1.9, .024, 1.1);          // mats
  F.folk(-.2, mid - 1.2, 'boxer', 0, -1);
};
ROOMS.ring = (F, K) => {
  const { m, x0, x1, d0, d1 } = F, T = F.tinted, edge = x1 - 1.4, ca = (x0 + edge) / 2 + .4, mid = (d0 + d1) / 2;
  K.ring(ca, mid, Math.min(4.8, edge - x0 - 3.6));
  for (const b of [d0 + 1.6, mid, d1 - 1.6]) K.punchBag(x0 + .9, b, [0xb5462f, 0x2b2f38, 0x3e6fd6][Math.round((b - d0) / 5) % 3]);
  K.bench(ca, d0, 2, { w: 2.4 }); K.bench(ca, d1, 0, { w: 2.4 }); K.weights(edge - 2, d1, 0, { w: 1.6 });
  for (const s of [-1, 1]) F.lamp(ca + s * 1.2, mid, .5, 2.2);
  F.put(m.gold, x0 + .05, 2.4, mid + 3, .03, .5, .9); F.put(m.red, x0 + .07, 2.4, mid + 3, .02, .2, .6);
  F.folk(ca - 3.2, mid - 1.4, 'boxer', 1, 0); F.folk(ca + .5, d0 + 1.5, 'boxer', 0, 1);
};
ROOMS.changing = (F, K) => {
  const { m, x0, d0, d1 } = F, T = F.tinted, mid = (d0 + d1) / 2, hall = landing(F, [d0 + 1.6]), W = hall - x0;
  for (const a of [x0 + 2.4, x0 + 5]) { K.lockers(a, mid - .9, 0, { n: 6 }); K.lockers(a, mid - .9, 2, { n: 6, col: 0xe8553b }); }
  K.bench(x0 + 3.7, d0 + 2.6, 0, { w: 3.6 }); K.lockers(x0, d0 + 2.2, 3, { n: 5 });
  // showers at the back: tiles, three heads, a wall you can't see round
  F.partition(x0, d1 - 3, x0 + W * .55, d1 - 3, [[x0 + .4, x0 + 1.4]], 0xbfdfe6); F.put(T(0xbfe3ef), x0 + W * .275, .012, d1 - 1.5, W * .55 - .1, .024, 2.9);
  for (let a = x0 + 1; a < x0 + W * .55 - .4; a += 1.3) { F.put(m.steel, a, 1.1, d1 - .08, .02, 2.2, .02, CYL); F.put(m.steel, a, 2.2, d1 - .25, .09, .04, .09, CYL); }
  // the sauna
  const sa = hall - 1.5, sb = d1 - 1.4; F.partition(hall - 3, d1 - 2.8, hall, d1 - 2.8, [[hall - 1.1, hall - .2]], 0x9a6a44); F.partition(hall - 3, d1 - 2.8, hall - 3, d1, [], 0x9a6a44);
  F.block(m.wood, sa - .3, 0, d1 - .4, 2.2, .45, .7); F.block(m.dark, hall - .5, 0, d1 - 1.9, .5, .6, .5); for (let i = 0; i < 5; i++) F.put(T(0x6b6f76), hall - .6 + (i % 3) * .1, .64, d1 - 2 + (i % 2) * .12, .07, .06, .07, BALL);
  cat(K, sa - 1, d1 - .4, .45); F.lamp(x0 + 3.7, d0 + 3, 2, .4); F.lamp(x0 + 2, d1 - 1.5, .5, .5); F.lamp(sa, sb, .4, .4);
};

// ---------- the museum ----------
const vase = (F, a, b, y, col) => { F.put(F.tinted(col), a, y + .16, b, .11, .3, .11, CYL); F.put(F.tinted(col), a, y + .34, b, .07, .08, .07, CYL); F.put(F.m.gold, a, y + .2, b, .115, .03, .115, CYL); };
ROOMS.museum = (F, K) => {
  const { m, x0, x1, d0, d1 } = F, T = F.tinted, a1 = x1 - 1.5, ca = (x0 + a1) / 2, mid = (d0 + d1) / 2;
  K.counter(x0 + 1.7, d0 + 2, .8, 2.4, m.gold, F.accent); F.clerk(x0 + .8, d0 + 2, 1, 0);
  K.dino(ca + .4, mid + 1.6, Math.min(5.4, a1 - x0 - 3.2)); for (const s of [-1, 1]) K.rope(ca + .4 - 2.6, mid + 1.6 + s * 1.5, ca + .4 + 2.6, mid + 1.6 + s * 1.5);
  for (const [i, a] of [x0 + 2, ca, a1 - 1.6].entries()) K.bigPicture(a, d1, 0, { w: 1.7, h: 1.2, y: 2.1, col: [0x2f7f8f, 0xc8553d, 0xd9a441][i] });
  for (const [i, b] of [mid - .6, mid + 2.6].entries()) { K.plinth(x0 + .7, b, { h: 1 }); vase(F, x0 + .7, b, 1.03, [0x3e6fd6, 0xb5462f][i]); }
  K.plant(x0 + .5, d1 - .6, 1.3); K.bench(ca + .4, mid - 1.6, 2, { w: 2 });
};
ROOMS.gallery = (F, K) => {
  const { m, x0, x1, d0, d1, r } = F, T = F.tinted, edge = x1 - 1.4, W = edge - x0, mid = (d0 + d1) / 2;
  for (let b = d0 + 1.8, i = 0; b < d1 - 1; b += 2.7, i++) K.bigPicture(x0, b, 3, { w: 1.6 + (i % 2) * .5, h: 1.2, y: 1.8 });
  for (const a of [x0 + W * .3, x0 + W * .7]) { K.bigPicture(a, d1, 0, { w: 2, h: 1.3, y: 1.8 }); K.bigPicture(a, d0, 2, { w: 1.4, h: 1, y: 1.8 }); }
  for (const [i, b] of [mid - 3.2, mid, mid + 3.2].entries()) K.statue(x0 + W * .72, b, [0xe9e4d8, 0x8a9099, 0xc9a45a][i]);
  K.bench(x0 + W * .36, mid - 1.6, 2, { w: 2.2 }); K.bench(x0 + W * .36, mid + 1.6, 0, { w: 2.2 });
  for (const b of [mid - 3, mid, mid + 3]) F.lamp(x0 + 1.4, b, .4, 1.2); F.lamp(x0 + W * .6, mid, .5, 3);
  F.folk(x0 + W * .5, d0 + 1.6, 'guard', 0, 1);
};
ROOMS.gems = (F, K) => {
  const { m, x0, d0, d1 } = F, T = F.tinted, mid = (d0 + d1) / 2, hall = landing(F, [mid], 0x3a3f4a), W = hall - x0, ca = x0 + W / 2;
  // the Sunset Diamond, under glass in the middle of the room
  K.plinth(ca, mid, { h: 1.05, w: .8, col: 0x16181d }); F.gem(ca, 1.48, mid, { label: 'the Sunset Diamond', cash: 7500, stars: 3, heat: 120, crime: 'DIAMOND HEIST!' });
  F.put(m.panel, ca, F.hi - .03, mid, .3, .04, .3, CYL); F.put(m.cool, ca, 1.085, mid, .3, .012, .3, CYL);
  for (const s of [-1, 1]) { K.rope(ca - 1.6, mid + s * 1.6, ca + 1.6, mid + s * 1.6); K.rope(ca - 1.6, mid - s * .1 - s * 1.5, ca - 1.6, mid - s * .1 - s * .7); K.rope(ca + s * 1.6, mid - 1.6 + (s > 0 ? 0 : 2.3), ca + s * 1.6, mid - .7 + (s > 0 ? 0 : 2.3)); }
  // lesser sparklers round the walls, and a golden cat nobody has insured
  const cases = [[x0 + .6, d0 + 1.6], [x0 + .6, d1 - 1.6], [x0 + W * .5, d0 + .6], [x0 + W * .5, d1 - .6], [hall - .7, d0 + 1.2]];
  cases.forEach(([a, b], i) => { K.plinth(a, b, { h: 1, col: 0x16181d }); for (let j = 0; j < 3; j++) F.put(m.screens[(i + j * 2) % 6], a - .16 + j * .16, 1.1, b, .05, .06, .05, BALL); F.put(m.gold, a, 1.05, b, .22, .03, .22, CYL); F.lamp(a, b, .3, .3); });
  K.plinth(hall - .7, d1 - 1.2, { h: .9, glass: false, col: 0x16181d }); cat(K, hall - .7, d1 - 1.2, .93);
  for (const y of [.5, 1.1]) F.put(m.red, x0 + W * .25, y, mid, .012, .012, d1 - d0 - .6);                  // somebody's idea of a laser alarm
  F.folk(hall - 1.2, mid - 1.6, 'guard', -1, .6);
};

// ---------- roofs ----------
ROOMS['roof:terrace'] = (R) => {
  const { m, hw, D } = R, T = R.tinted, r = R.r;
  const spots = [[-hw + 2.4, D - 2.6], [hw - 2.6, 2.6], [0, D / 2], [-hw + 2.4, 3], [hw - 2.6, D - 3]].filter(([a, b]) => R.free(a, b, 1.6));
  if (spots[0]) {          // a table under a sun umbrella, two loungers
    const [a, b] = spots[0];
    R.put(T(0x4f8f5a), a, .015, b, 3.6, .03, 3); R.put(m.white, a, .72, b, .5, .05, .5, CYL); R.put(m.steel, a, .36, b, .04, .72, .04, CYL); R.put(m.steel, a, 1.5, b, .03, 1.6, .03, CYL);
    R.put(T(r() < .5 ? 0xe8455b : 0x2f8f83), a, 2.25, b, 1.5, .5, 1.5, CONE); R.solid(a, b, .9, .9, 1);
    for (const s of [-1, 1]) { R.put(m.white, a + s * 1.25, .3, b + .2, .6, .08, 1.7); R.put(m.white, a + s * 1.25, .55, b + .95, .6, .5, .08); R.put(T(0xffd34d), a + s * 1.25, .36, b + .1, .5, .05, 1.3); R.solid(a + s * 1.25, b + .2, .6, 1.7, .5); }
  }
  if (spots[1]) {          // tomatoes in tubs
    const [a, b] = spots[1];
    for (let i = 0; i < 3; i++) { R.put(m.pot, a - 1 + i, .25, b, .3, .5, .3, CYL); R.put(m.plant, a - 1 + i, .85, b, .32, .4, .32, BALL); R.put(m.red, a - 1 + i + .12, .9, b + .2, .07, .07, .07, BALL); }
    R.solid(a, b, 2.8, .7, .8);
  }
  if (R.shopId === 'arms' && spots[0]) cat(kit(R), spots[0][0] + .25, spots[0][1], .745);
};
ROOMS['roof:plain'] = () => { };
ROOMS['roof:helipad'] = (R) => {
  const { m, hw, D } = R, T = R.tinted, a = 0, b = D / 2 + .5, y = .012;
  for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2; R.put(T(0xffd34d), a + Math.cos(t) * 3.4, y, b + Math.sin(t) * 3.4, Math.abs(Math.sin(t)) * 1.1 + .22, .024, Math.abs(Math.cos(t)) * 1.1 + .22); }
  for (const s of [-1, 1]) R.put(m.white, a + s * .9, y, b, .32, .024, 2.6); R.put(m.white, a, y, b, 1.8, .024, .32);
};
