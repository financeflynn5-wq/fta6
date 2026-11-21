// The Tipsy Possum. The room is world/interiors.js (kind 'bar'); this is the people drinking in it. They shuffle about
// with a bottle in one hand. Walk into one and he takes it personally, and half the room takes his side.
// They started it, so nobody calls the police when one goes down.
import * as THREE from 'three';
import { BAR } from '../config.js';
import { choose } from '../core/utils.js';
import { std } from '../world/materials.js';
import { CIVILIANS, reelCharacter } from '../characters/models.js';

const SHOUTS = ['HEY!  WATCH IT, PAL', 'YOU SPILLED MY DRINK', 'YOU WANNA GO?', "THAT'S IT.  OUTSIDE.  ACTUALLY, RIGHT HERE"];
const glass = [0x3f8a52, 0x8a5a2a, 0xd9c48a].map(c => std({ color: c, roughness: .15, metalness: .1, transparent: true, opacity: .85 }));
const bottleGeo = new THREE.CylinderGeometry(.045, .05, .2, 8), neckGeo = new THREE.CylinderGeometry(.018, .03, .11, 6);

export function createBarFight(game) {
  const room = game.city.interiors.rooms.find(q => q.kind === 'bar'), B = game.brawlers, p = game.player;
  if (!room?.bar) return { update() { } };
  let state = 'empty', back = 0, grace = 0;
  const inside = (m = 0) => Math.abs(p.x - room.x) < room.hw + m && Math.abs(p.z - room.z) < room.hd + m && p.mode === 'foot';

  const group = B.group('bar', {
    join: BAR.join,
    onProvoke(g) {
      game.hud.toast('BAR FIGHT!', 'bad'); room.scared = 8; game.audio.bottle();
      for (const f of g.list) f.ped.outlaw = true;         // a brawl among drunks: nobody's business but theirs
    },
    onDown(g) { if (g.standing.every(f => f.mood !== 'angry') && state === 'open') { state = 'done'; back = BAR.back; game.hud.toast('LAST ONE STANDING', 'good'); } },
  });
  function bottle(f) {               // something to hold (and to wave about)
    const g = new THREE.Group(), m = choose(glass); g.add(new THREE.Mesh(bottleGeo, m)); const n = new THREE.Mesh(neckGeo, m); n.position.y = .15; g.add(n);
    g.position.set(0, -.5, .06); g.rotation.x = Math.PI; f.ped.model.userData.hands[1].add(g);
  }
  function populate() {
    state = 'open'; grace = 1.5;
    const spots = room.bar.spots.slice(0, BAR.drinkers);
    for (const s of spots) {
      const prop = s.how === 'prop';
      const f = B.add(choose(CIVILIANS), s.x, s.z, { group, idle: prop ? 'stand' : 'drunk', face: prop ? Math.atan2(room.clerk.x - s.x, room.clerk.z - s.z) : Math.random() * 6.28,
        home: { x: s.x, z: s.z, rect: room.bar.rect, face: prop ? Math.atan2(room.clerk.x - s.x, room.clerk.z - s.z) : undefined }, stats: BAR.fighter, look: { props: false } });
      f.ped.y = room.y; bottle(f);
    }
  }

  return {
    group, get state() { return state; },
    update(dt, t) {
      if (game.match?.on) return;
      const d = Math.hypot(p.x - room.x, p.z - room.z);
      if (state === 'empty') { if (d < 70) populate(); return; }
      if (state === 'done') { if (d > 60) back -= dt; if (back <= 0 && d > 80) { B.clear(group); state = 'empty'; } return; }
      if (!group.angry && d > 110) { B.clear(group); state = 'empty'; return; }
      // a fight that fizzled (you left, they sat back down) can start again
      if (group.angry && group.standing.every(f => f.mood !== 'angry')) group.angry = false;
      grace -= dt;
      if (group.angry || game.over || !inside() || grace > 0) { if (!inside(2)) grace = .6; return; }
      // the bump: walk into a drinker and he turns on you
      if (p.speed < 1.3) return;
      for (const f of group.standing) {
        const ped = f.ped; if (f.mood !== 'calm' || ped.state !== 'goon') continue;
        const dx = ped.x - p.x, dz = ped.z - p.z, dd = Math.hypot(dx, dz);
        if (dd > BAR.bump || (dx * p.vx + dz * p.vz) <= 0) continue;                      // you have to be walking INTO them
        game.hud.toast(choose(SHOUTS), 'bad'); game.audio.bonk();
        game.peds.stagger(ped, dx / (dd || 1) * 2.2, dz / (dd || 1) * 2.2, .5); reelCharacter(ped.model, dx, dz, ped.face, .6); f.stun = .7;
        B.provoke(f); break;
      }
    },
  };
}
