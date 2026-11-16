// Stunt jumps: hit a marked ramp or crest fast enough to fly the distance. Any long jump pays a little.
import { cash } from './kit.js';

export function createStunts(A) {
  const { game, kit, cfg, districts: D } = A, C = cfg.stunts, R = D.ramps;
  const lip = (r) => [r.lipX, r.lipZ];
  // where you leave the ground, how close to that spot counts, and how far you must fly (m)
  const JUMPS = [
    { id: 'pier', name: 'PIER PRESSURE', at: lip(R.pier), r: 8, min: 14 },
    { id: 'beach', name: 'BEACH BOUND', at: lip(R.beach), r: 7, min: 12 },
    { id: 'boxes', name: 'CONTAINER HOP', at: lip(R.containers), r: 7, min: 7 },
    { id: 'highway', name: 'HIGHWAY HOP', at: lip(R.highway), r: 7, min: 15 },
    { id: 'canyon', name: 'CANYON LEAP', at: lip(R.canyon), r: 7, min: 24 },
    { id: 'rock', name: "ROCCO'S ROCK", at: lip(R.rock), r: 7, min: 18 },
    { id: 'bluff', name: 'BLUFF DIVE', at: lip(R.bluff), r: 7, min: 16 },
    { id: 'table', name: 'TABLE TOP', at: [-297, -120], r: 10, min: 9 },
    { id: 'bullitt', name: 'THE BULLITT', at: [0, 257], r: 8, min: 15 },
    { id: 'vista', name: 'VISTA DROP', at: [54, 257], r: 8, min: 15 },
    { id: 'last', name: 'LAST DROP', at: [54, 203], r: 8, min: 12 },
  ];
  const done = new Set(kit.save.get('stunts', []));
  for (const j of JUMPS) kit.blip({ x: j.at[0], z: j.at[1], color: '#ff8a3d', glyph: 'J', size: 6.5, visible: () => !A.busy && !done.has(j.id) });

  game.ride.on('land', (v, info) => {
    if (v.driver !== 'player' || !info.from || game.over) return;
    const j = JUMPS.find(j => Math.hypot(info.from.x - j.at[0], info.from.z - j.at[1]) < j.r);
    const metres = Math.round(info.dist);
    if (j && info.dist >= j.min) {
      const first = !done.has(j.id); let pay = first ? C.first : C.again, extra = '';
      if (first) { done.add(j.id); kit.save.set('stunts', [...done]); }
      if (j.id === 'pier' && Math.abs(v.x) < 7 && v.z < -326 && v.z > -356) { pay += C.barge; extra = '  BARGE LANDING!'; }
      game.addMoney(pay); game.audio.evade();
      kit.ui.banner('STUNT JUMP', `${j.name} · ${metres} m  +${cash(pay)}${extra}${first ? `  (${done.size}/${JUMPS.length})` : ''}`, 'stunt', 3.6);
    } else if (j && info.dist > 4) game.hud.toast(`${j.name}: ${metres} m OF ${j.min} m`, 'info');
    else if (info.dist >= C.bigAir && info.time > .7) { const pay = Math.round(info.dist * C.airPay / 10) * 10; game.addMoney(pay); game.hud.toast(`BIG AIR ${metres} m  +${cash(pay)}`, 'good'); }
  });

  return { update() { }, progress: () => ['Stunt jumps', `${done.size}/${JUMPS.length}`] };
}
