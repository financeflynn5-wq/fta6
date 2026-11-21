// Where the boats and helicopters are kept: berths at Marlin Bay, the beach pier, Port Sunset's quay, the helipads.
// Each has a home slot. One that is stolen, wrecked or lost is put back once you are far away. The slots are the
// same on every screen (and numbered, v.sid), so other players see the same craft in the same places.
// Also here: what stealing each of them costs you, their radar blips, and the two helipads painted on the quay.
import * as THREE from 'three';
import { POLICE, BASE } from '../config.js';
import { seeded } from '../core/utils.js';
import { mats } from '../world/materials.js';
import { carPalette } from './carModel.js';
import { groundY } from '../world/terrain.js';
import { WATER } from '../world/map.js';

const HALF = Math.PI / 2, RESPAWN = 50, FAR = 170;

export function createFleet(game) {
  const D = game.city.districts, M = D.spots.marina, pads = D.zones.helipads || [];
  const slots = [], dice = seeded(6161);
  const slot = (type, x, z, h, y) => { const s = { type, x, z, h, y, sid: 5000 + slots.length, v: null, wait: 0, col: carPalette(type)[Math.floor(dice() * carPalette(type).length)] }; slots.push(s); return s; };

  // ----- Marlin Bay: a boat in every empty berth, tied up alongside the finger -----
  M.berths.filter(b => b.free).slice(0, 8).forEach((b, i) => {
    const ski = i % 3 === 1;
    slot(ski ? 'jetski' : 'speedboat', b.x - 5 + (ski ? 1.45 : 1.95), b.z - b.dir * (ski ? 2.6 : 1.7), b.dir * HALF);
  });
  slot('policeboat', M.seaplane.x + 7.2, M.seaplane.z, HALF);                      // the harbour patrol, off the head of the last pier
  // ----- Sunset Beach: off the end of the pier -----
  slot('speedboat', 7.1, -306, -HALF); slot('jetski', -6.4, -307, -HALF); slot('jetski', -6.4, -301.5, -HALF);
  // ----- Port Sunset: along the quay wall -----
  slot('speedboat', 354.1, 128, HALF); slot('policeboat', 354.3, -128, -HALF); slot('jetski', 353.5, 98, HALF);
  // ----- helicopters: Marlin Bay's pad, the army's two, and two pads painted on the quay -----
  for (const p of pads) slot(p.name === 'MARLIN BAY' ? 'heli' : 'armyheli', p.x, p.z, p.name === 'MARLIN BAY' ? -HALF : HALF, p.y);
  const quayPads = [[341.5, -186, 'heli'], [341.5, 148, 'policeheli']];
  for (const [x, z, type] of quayPads) { const y = groundY(x, z); slot(type, x, z, Math.PI, y); paintPad(x, z, y); }

  function paintPad(x, z, y) {
    const g = new THREE.Group(); g.position.set(x, y + .055, z);        // clear of the quay's top (y + .025)
    const flat = (geo, m, px = 0, pz = 0, ry = 0) => { const o = new THREE.Mesh(geo, m); o.rotation.set(-HALF, 0, ry); o.position.set(px, 0, pz); o.receiveShadow = true; g.add(o); };
    flat(new THREE.RingGeometry(6.1, 6.5, 48), mats.yellowPaint);
    flat(new THREE.PlaneGeometry(.6, 4.6), mats.paint, -1.5); flat(new THREE.PlaneGeometry(.6, 4.6), mats.paint, 1.5); flat(new THREE.PlaneGeometry(3, .6), mats.paint);
    game.scene.add(g);
  }

  function fill(s) {
    const v = game.traffic.add(s.type, s.x, s.z, s.h, s.col); v.sid = s.sid; v.home = s;
    if (s.y !== undefined) v.craft.setHeight(v, s.y);
    v.syncVisual(0, 0); s.v = v; s.wait = 0; game.env?.touch();
    return v;
  }
  for (const s of slots) fill(s);

  // radar: helicopters and boats still waiting at home
  for (const s of slots) {
    const heli = s.type.endsWith('heli');
    game.markers.push(s.marker = { x: s.x, z: s.z, color: heli ? '#19b6a4' : '#35c7e0', glyph: heli ? 'H' : '⚓', ink: '#ffffff', size: 6, visible: () => !!s.v && !game.match?.on });
  }

  let tick = 0;
  return {
    slots,
    // main.js: the player took a boat or a helicopter that wasn't theirs
    taken(v) {
      const police = game.police, heli = v.stats.craft === 'heli';
      if (v.type === 'policeheli') police.crime(POLICE.crime.copCarTheft * 2, 3, 'STOLE A POLICE CHOPPER!');
      else if (v.type === 'policeboat') police.crime(POLICE.crime.copCarTheft, 2, 'STOLE A POLICE BOAT!');
      else if (v.type === 'armyheli') police.crime(BASE.heat, Math.max(3, BASE.stars), 'STOLE AN ARMY CHOPPER!');
      else if (Math.random() < .3 || police.witnessed(v.x, v.z)) { game.audio.alarm(); police.crime(POLICE.crime.alarm, 1, heli ? 'CHOPPER ALARM!' : 'BOAT ALARM!'); }
      else game.hud.toast('NICE AND QUIET', 'good');
      if (heli && !game.hints.flown) { game.hints.flown = true; game.hud.toast('SPACE UP · SHIFT DOWN · W A S D FLY', 'info'); }
    },
    update(dt) {
      if ((tick -= dt) > 0) return; tick = 1;
      const p = game.player;
      for (const s of slots) {
        const v = s.v;
        if (v && (v.gone || v.stolen || v.wrecked || v.driver || Math.hypot(v.x - s.x, v.z - s.z) > 6)) { s.v = null; v.temp = true; }       // no longer waiting at home: once it is left somewhere, traffic.js clears it away
        if (s.v) continue;
        s.wait += 1;
        if (s.wait < RESPAWN || Math.hypot(p.x - s.x, p.z - s.z) < FAR) continue;
        if (game.traffic.vehicles.some(o => o.sid === s.sid || (Math.abs(o.x - s.x) < 8 && Math.abs(o.z - s.z) < 8))) continue;      // someone still has it, or something is in the way
        fill(s);
      }
    },
    // dev and tests: the nearest craft of a kind still at home
    find(type) { const p = game.player; let best = null, bd = 1e9; for (const s of slots) if (s.v && s.type === type) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = s.v; } } return best; },
    WATER,
  };
}
