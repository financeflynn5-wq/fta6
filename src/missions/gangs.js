// Three gangs, each with corners of its own (GANGS in config.js). They stand about on their turf in their colours.
// Come close and they tell you, once, to keep walking. Hang around, walk into the middle of them or lay a hand on
// one, and the whole crew is on you: fists, knives, and a pistol or two. Run them all off and the corner pays out;
// it is theirs again once you have been gone a while.
import { GANGS } from '../config.js';
import { choose } from '../core/utils.js';

const DARK = 0x23272e;
function look(id, gang, i) {
  if (gang.who === 'bighead') return { look: { top: choose(['track', 'hoodie', 'tank']), topC: gang.color, legs: 'pants', legC: DARK, shoes: choose([0xf4f4f4, 0x1d1f24]), hat: choose(['capBack', 'beanie', 'cap', null]), hatC: gang.color, eyes: choose(['shades', 'shades', 'googly']), lensC: 0x111216, rimC: 0x16161a, brows: 'angry', mouth: choose(['smirk', 'flat']), chain: true, prop: null, lids: false, blush: false }, props: false };
  if (gang.who === 'scrap') return { metal: [0xc9601a, 0xf08a3a], eye: 0xffd34d, crown: i === 0, band: i === 0 ? undefined : 0x23272e };
  return { outfit: gang.color, pants: DARK, shoes: 0x1d1f24, hood: false, band: gang.color };
}

export function createGangs(game) {
  const B = game.brawlers, p = game.player, turfs = [];
  for (const id in GANGS.gangs) {
    const gang = GANGS.gangs[id];
    for (const [x, z, where] of gang.turf || []) {
      const turf = { id, gang, x, z, where, state: 'empty', back: 0, warnT: 0, warned: 0, group: null };
      turf.group = B.group(id, {
        onProvoke() { game.hud.toast(`${gang.name}: YOU WERE TOLD`, 'bad'); game.audio.grunt(1); },
        onDown(g) {
          if (g.alive > 0 || turf.state !== 'home') return;
          turf.state = 'cleared'; turf.back = GANGS.back; game.addMoney(GANGS.reward); game.hud.toast(`${gang.name} RUN OFF  +$${GANGS.reward}`, 'good');
        },
      });
      turf.mark = { x, z, color: gang.ink, glyph: gang.glyph, ink: '#15161a', size: 5.5, visible: () => turf.state !== 'cleared' && !game.match?.on };
      game.markers.push(turf.mark); turfs.push(turf);
    }
  }
  function populate(turf) {
    turf.state = 'home'; turf.warnT = 0;
    const g = turf.gang, n = GANGS.crew;
    for (let i = 0; i < n; i++) {
      // a loose ring, everybody half facing the middle; the last ones in the list carry the hardware
      const a = i / n * Math.PI * 2 + turf.x * .37, r = 1.7 + (i % 2) * .5, x = turf.x + Math.cos(a) * r, z = turf.z + Math.sin(a) * r;
      const weapon = i >= n - g.pistols ? 'pistol' : i >= n - g.pistols - g.knives ? 'knife' : 'fists';
      B.add(g.who, x, z, { group: turf.group, face: Math.atan2(-Math.cos(a), -Math.sin(a)) + (i % 2 ? .5 : -.4), weapon, outlaw: true, stats: GANGS.fighter, look: look(turf.id, g, i) });
    }
  }

  return {
    turfs,
    update(dt, t) {
      if (game.match?.on) return;
      for (const turf of turfs) {
        const d = Math.hypot(p.x - turf.x, p.z - turf.z), G = turf.group;
        if (turf.state === 'empty') { if (d < 170 && (d > 45 || turf.back <= 0)) populate(turf); continue; }
        if (turf.state === 'cleared') { if (d > 110) turf.back -= dt; if (turf.back <= 0 && d > 170) { B.clear(G); turf.state = 'empty'; } continue; }
        if (G.angry) { if (G.standing.every(f => f.mood !== 'angry')) { G.angry = false; turf.warnT = 0; } continue; }
        if (d > 240) { B.clear(G); turf.state = 'empty'; continue; }
        turf.warned = Math.max(0, turf.warned - dt);
        if (game.over || p.mode !== 'foot' || p.sky || d > GANGS.warn + 3) { turf.warnT = Math.max(0, turf.warnT - dt * .5); continue; }
        if (d > GANGS.warn || !G.standing.some(f => f.ped.state === 'goon' && game.physics.canSee(f.ped.x, f.ped.z, p.x, p.z))) continue;
        if (turf.warned <= 0) { game.hud.toast(`${turf.gang.name} TURF.  KEEP WALKING`, 'bad'); turf.warned = 25; }
        turf.warnT += dt;
        const closest = Math.min(...G.standing.map(f => Math.hypot(f.ped.x - p.x, f.ped.z - p.z)));
        if (turf.warnT > GANGS.warnTime || closest < GANGS.close) B.provoke(G);
      }
    },
  };
}
