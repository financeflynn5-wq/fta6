// What a Big Head can look like. A "look" is a plain object; bigheads.js turns one into a model.
// The three named looks are the ones from the cast concepts. Everyone else is rolled from the
// lists below, so the streets never fill up with clones.
import { choose } from '../core/utils.js';

export const SKINS = [0xf1c7a5, 0xf7d7bd, 0xe8b48f, 0xc68c5f, 0xa86f4a, 0x8d5a3b, 0x5c3a28];
const HAIR = [0x2a1a12, 0x16161a, 0x6b4423, 0x3d2a1c, 0xd9b36a, 0xb5462a, 0xcfd3d8, 0xf4f1ea];
const LOUD_HAIR = [0xff6fb1, 0x3de0ff, 0x8a5cff, 0x7dff8a, 0xffd34d, 0xff5a3c];
const TOPS = [0xe8455b, 0x3e6fd6, 0xf2a93b, 0x2f8f83, 0x9b5de5, 0xff7aa2, 0xf4f1ea, 0x2b2f35, 0x7fd3c7, 0xffd34d, 0x5ac8ff, 0xff8a3d];
const DARKS = [0x23272e, 0x2b3443, 0x1c2a55, 0x4a2a3a, 0x3a2f28, 0x5a5f66];
const BOTTOMS = [0x2b3443, 0x4a3b2e, 0x33415c, 0x5a5f66, 0xe9e1d0, 0x7fd3c7, 0x1d1f24, 0xc9b8e0, 0xb7c9a8];
const SHOES = [0xf4f4f4, 0xe8455b, 0x1d1f24, 0xffd34d, 0x3e6fd6, 0xff4d6d, 0x7a4a2a];
const SHAPES = [[.54, .52, .52], [.56, .52, .52], [.52, .52, .5], [.5, .56, .5], [.58, .5, .53], [.53, .54, .54]];
const LENS = [0x111216, 0x111216, 0xff4fa0, 0x2a6fd6, 0xc9a24a, 0xf4f1ea];

export const PRINTS = { hawaii: 5, stripes: 4, leopard: 1 };       // how many colourways each printed shirt comes in

export const LOOKS = {
  // Runs the motel. Hawaiian shirt, mustache, never takes off his sunglasses.
  sal: { skin: 0xf1c7a5, shape: [.56, .52, .52], hair: 'short', hairC: 0x2a1a12, eyes: 'shades', lensC: 0x111216, nose: 'bulb', tash: 'handlebar', top: 'hawaii', print: 0, legs: 'pants', legC: 0xe9e1d0, shoes: 0xf4f4f4 },
  // Aviators, cop hat, eats donuts while chasing you.
  dale: { skin: 0x8d5a3b, shape: [.54, .52, .52], hair: 'none', hairC: 0x1a1210, hat: 'cop', eyes: 'aviators', nose: 'bulb', tash: 'bar', top: 'uniform', legs: 'pants', legC: 0x1c2a55, shoes: 0x15161a, prop: 'donut' },
  // Giant pink hair and a phone she never looks up from. Witnesses nothing.
  // Mouse Bear Trucking's dispatcher. Company cap, company hoodie, and she has heard every excuse a driver can make.
  dot: { skin: 0xe9b98f, shape: [.54, .52, .51], hair: 'ponytail', hairC: 0x8a3b24, hat: 'cap', hatC: 0xff5d62, eyes: 'specs', rimC: 0xe8455b, brows: 'flat', nose: 'small', mouth: 'smirk', blush: true, earring: true, top: 'hoodie', topC: 0x0f9692, legs: 'pants', legC: 0x2d3340, shoes: 0xf4f4f4 },
  tiff: { skin: 0xc68c5f, shape: [.52, .52, .5], hair: 'bun', hairC: 0xff6fb1, eyes: 'googly', lids: true, brows: 'none', nose: 'small', mouth: 'lips', lipC: 0xc0405a, earring: true, top: 'tee', topC: 0xfff1f5, legs: 'pants', legC: 0x7fd3c7, shoes: 0xff4d6d, prop: 'phone' },
};

const chance = (p) => Math.random() < p;
// One citizen, rolled fresh. cop: the same faces in uniform.
export function randomLook(cop = false) {
  const femme = chance(.5), L = { skin: choose(SKINS), shape: choose(SHAPES) };
  L.hairC = chance(.14) ? choose(LOUD_HAIR) : choose(HAIR);
  L.hair = femme ? choose(['bun', 'bob', 'long', 'pigtails', 'ponytail', 'afro', 'bob', 'long', 'curls'])
    : choose(['short', 'pomp', 'afro', 'bald', 'balding', 'mohawk', 'spikes', 'flattop', 'short', 'curls', 'pomp']);
  if (cop) { L.hat = 'cop'; if (!['bob', 'long', 'ponytail', 'balding'].includes(L.hair)) L.hair = 'none'; }
  else if (chance(.3)) {
    L.hat = choose(['cap', 'cap', 'capBack', 'beanie', 'fedora', 'bucket', 'band', 'phones']); L.hatC = choose(TOPS);
    const under = L.hat === 'band' || L.hat === 'phones' ? ['short', 'bob', 'long', 'ponytail', 'bald', 'balding', 'pigtails'] : ['none', 'bob', 'long', 'ponytail', 'balding'];
    if (!under.includes(L.hair)) L.hair = femme ? choose(['bob', 'long', 'ponytail']) : choose(under);
  }
  L.eyes = cop ? choose(['aviators', 'aviators', 'shades', 'googly']) : choose(['googly', 'googly', 'googly', 'googly', 'shades', 'shades', 'specs', 'aviators']);
  L.lensC = choose(LENS); L.rimC = choose([0x16161a, 0xc9a24a, 0xe8455b, 0xf4f1ea]);
  L.lids = chance(.3); L.brows = choose(['flat', 'flat', 'angry', 'worried', 'thick']);
  L.nose = choose(['bulb', 'bulb', 'small', 'long', 'wide']); L.blush = chance(.3);
  if (!femme && chance(.45)) { L.tash = choose(['handlebar', 'bar', 'pencil']); L.mouth = chance(.4) ? 'flat' : 'none'; }
  else L.mouth = femme && chance(.5) ? 'lips' : choose(['smile', 'smile', 'grin', 'flat', 'oh', 'smirk']);
  if (!femme && chance(.22)) L.beard = choose(['full', 'goatee']);
  L.lipC = choose([0xc0405a, 0xe0304a, 0x9a2a50, 0xff6fa0]);
  L.earring = femme ? chance(.5) : chance(.1);
  if (cop) { L.top = 'uniform'; L.legs = 'pants'; L.legC = 0x1c2a55; L.shoes = 0x15161a; L.prop = chance(.35) ? 'donut' : null; return L; }
  L.top = choose(['tee', 'tee', 'hawaii', 'hawaii', 'stripes', 'suit', 'track', 'tank', 'hoodie', 'leopard']);
  L.print = Math.floor(Math.random() * (PRINTS[L.top] || 1));
  L.topC = L.top === 'suit' ? choose(DARKS) : choose(TOPS); L.tieC = choose(TOPS);
  L.legs = L.top === 'suit' || L.top === 'track' ? 'pants' : femme ? choose(['pants', 'shorts', 'skirt', 'skirt']) : choose(['pants', 'pants', 'shorts']);
  L.legC = L.top === 'suit' || L.top === 'track' ? L.topC : choose(BOTTOMS);
  L.shoes = choose(SHOES);
  L.chain = L.top !== 'suit' && chance(L.top === 'tank' || L.top === 'track' ? .5 : .12);
  L.prop = chance(.3) ? choose(['phone', 'coffee', 'bag', 'bag']) : null;
  return L;
}
