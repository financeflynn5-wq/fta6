// The camp in the middle of Whisper Woods. Nobody tells you it is there: you see smoke over the trees, or a painted
// board by the road. Walk in on the people who live there and they come at you, fists and a couple of blades.
// Fight them all off and what they had stashed is yours; stay away a while and somebody is living there again.
// The scenery is world/forest.js; how they fight is combat/brawlers.js.
import * as THREE from 'three';
import { CAMP } from '../config.js';
import { choose, rnd } from '../core/utils.js';

const DRAB = [0x6b6a55, 0x5a4a3a, 0x4d5a4a, 0x55505a, 0x6a5a44, 0x3f4a55];
const WHO = ['bighead', 'raccoon', 'scrap', 'possum', 'bighead', 'raccoon', 'bighead', 'possum', 'scrap'];
// how each family looks after a few winters in the woods
const look = (kind) => kind === 'bighead' ? { look: { hat: choose(['beanie', 'beanie', 'bucket', null]), hatC: choose(DRAB), beard: Math.random() < .6 ? 'full' : null, tash: null, brows: 'angry', mouth: 'flat', eyes: 'googly', top: 'hoodie', topC: choose(DRAB), legs: 'pants', legC: 0x3a3530, shoes: 0x3a2f28, chain: false, prop: null, earring: false, blush: false }, props: false }
  : kind === 'scrap' ? { metal: choose([[0x8a5a3a, 0x9a6a48], [0x6f6a5a, 0x857f6c]]), eye: 0xffb347, beanie: choose(DRAB) }
    : { outfit: choose(DRAB), pants: 0x3a3530, shoes: 0x3a2f28, hood: false, beanie: choose(DRAB) };

export function createCamp(game) {
  const spot = game.city.districts.spots.camp, B = game.brawlers, p = game.player, fx = game.fx;
  if (!spot) return { update() { } };
  const light = new THREE.PointLight(0xff9a3d, 0, 26, 1.4); light.position.set(spot.fire.x, spot.fire.y + 1.1, spot.fire.z); game.scene.add(light);
  const mark = { x: spot.x, z: spot.z, color: '#3f8f58', glyph: 'X', ink: '#ffffff', size: 6, visible: () => camp.found };
  game.markers.push(mark);
  let state = 'empty', back = 0, fireT = 0, smokeT = 0, loot = [];

  const group = B.group('camp', {
    onProvoke() { game.hud.toast(camp.found ? 'THE CAMP: THEY REMEMBER YOU' : 'YOU FOUND THE CAMP.  THEY WANT YOU GONE', 'bad'); camp.found = true; game.audio.grunt(1); },
    onDown(g) {
      if (g.alive > 0 || state !== 'home') return;
      state = 'cleared'; back = CAMP.back; game.addMoney(CAMP.reward); game.hud.toast(`CAMP CLEARED  +$${CAMP.reward}`, 'good');
      // what they kept under the tarp
      const s = spot.stash; loot = [game.pickups.place('armor', null, s.x, s.z, true), game.pickups.place('health', null, s.x + 1.6, s.z - .4, true)];
      for (const it of loot) it.life = 240;
    },
  });
  function populate() {
    state = 'home';
    for (let i = 0; i < CAMP.crew && i < spot.spots.length; i++) {
      const s = spot.spots[i], kind = WHO[i % WHO.length];
      B.add(kind, s.x, s.z, { group, face: s.face, idle: s.idle || 'stand', weapon: i >= CAMP.crew - CAMP.knives ? 'knife' : 'fists', outlaw: true, stats: CAMP.fighter, look: look(kind) });
    }
  }

  const camp = {
    found: false, group, get state() { return state; },
    reset() { B.clear(group); state = 'empty'; },      // for tests
    update(dt, t) {
      const d = Math.hypot(p.x - spot.x, p.z - spot.z);
      // the fire in the ring of stones and the one in the drum; smoke you can see over the trees
      const lit = state !== 'cleared' || back > CAMP.back - 60, night = Math.max(0, game.env?.night ?? 0);
      if (d < 190 && lit) {
        if ((fireT -= dt) <= 0) { fireT = d < 60 ? .05 : .12; fx.fire(spot.fire.x + rnd(-.3, .3), spot.fire.y + .1, spot.fire.z + rnd(-.3, .3), .75); if (Math.random() < .5) fx.fire(spot.drum.x + rnd(-.15, .15), spot.drum.y, spot.drum.z + rnd(-.15, .15), .5); }
        if ((smokeT -= dt) <= 0) { smokeT = .3; fx.smoke(spot.fire.x, spot.fire.y + 1.2, spot.fire.z, .62, 1.1, 9, 0, 0, { rise: 2.3, grow: .55, alpha: .42, turb: .5 }); }
      }
      light.intensity += ((d < 90 && lit ? 16 + night * 26 + Math.sin(t * 13) * 3 + Math.sin(t * 7.3) * 2 : 0) - light.intensity) * Math.min(1, dt * 6);
      if (game.match?.on) return;
      if (state === 'empty') { if (d < 170) populate(); }
      else if (state === 'home') {
        if (!group.angry) {
          if (d > 240) { B.clear(group); state = 'empty'; }
          else if (d < CAMP.wake && !game.over && !p.sky && group.standing.some(f => f.ped.state === 'goon' && game.physics.canSee(f.ped.x, f.ped.z, p.x, p.z))) B.provoke(group);
        }
      } else if (state === 'cleared') {                // somebody moves back in once you have been gone a while
        if (d > 120) back -= dt;
        if (back <= 0 && d > 170) { B.clear(group); state = 'empty'; }
      }
    },
  };
  return camp;
}
