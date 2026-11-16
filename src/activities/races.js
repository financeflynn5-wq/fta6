// Time trials: stop in a blue ring, wait for GO, hit every gold gate, beat the medal times.
import { cash, fmtTime } from './kit.js';
import { RACEWAY } from '../world/districts.js';

const PI = Math.PI;
// the dirt oval: two laps of eight gates, starting and finishing by the raceway sign
const oval = (() => { const a0 = .68, pts = []; for (let k = 1; k <= 16; k++) { const a = a0 + k * PI / 4; pts.push([RACEWAY.x + Math.cos(a) * RACEWAY.rx, RACEWAY.z + Math.sin(a) * RACEWAY.rz]); } return { start: [RACEWAY.x + Math.cos(a0) * RACEWAY.rx, RACEWAY.z + Math.sin(a0) * RACEWAY.rz], pts }; })();

// medal times in seconds: [gold, silver, bronze]
const RACES = [
  { id: 'dash', name: 'DOWNTOWN DASH', start: [0, -135], medals: [58, 70, 88],
    pts: [[0, -54], [0, 54], [0, 108], [54, 108], [108, 108], [108, 0], [108, -108], [0, -108], [-108, -108], [-108, 0], [-108, 54], [-54, 54], [-20, 54]] },
  { id: 'vista', name: 'VISTA LOOP', start: [-162, 185], medals: [50, 60, 76],
    pts: [[-162, 270], [-162, 324], [-54, 324], [54, 324], [54, 270], [54, 216], [54, 162], [54, 115]] },
  { id: 'coast', name: 'COAST RUN', start: [-300, -216], medals: [36, 43, 55],
    pts: [[-216, -216], [-108, -216], [0, -216], [108, -216], [216, -216], [270, -200], [270, -108], [270, 0]] },
  { id: 'dust', name: 'DUST DEVIL', start: oval.start, medals: [62, 74, 92], pts: oval.pts },
  { id: 'loop', name: 'GRAND TOUR', start: [-100, -216], medals: [100, 118, 145],
    pts: [[0, -216], [162, -216], [270, -216], [270, -108], [270, 0], [270, 108], [270, 216], [162, 216], [0, 216], [-162, 216], [-324, 216], [-324, 108], [-324, 0], [-324, -108], [-324, -216], [-216, -216], [-100, -216]] },
  { id: 'board', name: 'BOARDWALK DASH', foot: true, start: [-140, -229.5], medals: [38, 45, 56],
    pts: [[-70, -229.5], [0, -229.5], [0, -262], [0, -297]] },
];
const MEDALS = ['gold', 'silver', 'bronze'];

export function createRaces(A) {
  const { game, kit, cfg } = A, C = cfg.races, p = game.player;
  const gates = { car: [kit.marker(0xffd34d, C.gate, true), kit.marker(0xffb23d, C.gate * .8)], foot: [kit.marker(0xffd34d, C.gateFoot, true), kit.marker(0xffb23d, C.gateFoot * .8)] };
  let run = null;
  const cur = kit.blip({ x: 0, z: 0, color: '#ffd34d', pin: true, hot: true, size: 7, visible: () => !!run && run.i >= 0 });
  const nxt = kit.blip({ x: 0, z: 0, color: '#ffb23d', size: 4.5, visible: () => !!run && run.i >= 0 && run.i + 1 < run.def.pts.length });
  const best = (id) => kit.save.get('race.' + id, 0);
  const medalFor = (def, t) => { const k = def.medals.findIndex(m => t <= m); return k < 0 ? null : MEDALS[k]; };

  function aim(i) {
    const { def } = run, g = gates[def.foot ? 'foot' : 'car'], a = def.pts[i], b = def.pts[i + 1];
    g[0].place(a[0], a[1]); g[0].setColor(i === def.pts.length - 1 ? 0xffffff : 0xffd34d); cur.x = a[0]; cur.z = a[1]; cur.glyph = i === def.pts.length - 1 ? '⚑' : '';
    if (b) { g[1].place(b[0], b[1]); nxt.x = b[0]; nxt.z = b[1]; } else g[1].hide();
  }
  function stop() { for (const k in gates) for (const m of gates[k]) m.hide(); if (!game.over) p.frozen = false; run = null; A.end(); }

  const part = {
    abort(msg = 'RACE ABANDONED') { if (!run) return; if (msg) game.hud.toast(msg, 'bad'); stop(); },
    progress() { const n = RACES.filter(r => medalFor(r, best(r.id) || 1e9) === 'gold').length; return ['Races', `${n}/${RACES.length} gold`]; },
    update(dt, t) {
      if (!run) return;
      const { def } = run, g = gates[def.foot ? 'foot' : 'car'];
      for (const m of g) m.tick(t, p, 400);
      if (run.i < 0) {                     // 3, 2, 1...
        const before = Math.ceil(run.count); run.count -= dt;
        if (Math.ceil(run.count) !== before && run.count > 0) { kit.ui.banner(String(Math.ceil(run.count)), def.name, 'count', 1); game.audio.click(); }
        if (run.count <= 0) { p.frozen = false; run.i = 0; aim(0); kit.ui.banner('GO!', '', 'go', 1); game.audio.star(); }
        kit.ui.panel(def.name, '0:00.0', 'Get ready'); return;
      }
      run.t += dt;
      // reasons to stop
      if (A.quitHeld(dt)) return part.abort();
      if (!def.foot) {
        if (p.mode !== 'car') { run.out += dt; kit.ui.hint(`Get back in a car: ${Math.ceil(6 - run.out)}`); if (run.out > 6) return part.abort(); }
        else { if (run.out) kit.ui.hint(''); run.out = 0; if (p.vehicle.wrecked) return part.abort('WRECKED: RACE OVER'); }
      } else if (p.mode !== 'foot') return part.abort('ON FOOT ONLY');
      // gates
      const a = def.pts[run.i];
      if ((def.foot || p.mode === 'car') && Math.hypot(p.x - a[0], p.z - a[1]) < (def.foot ? C.gateFoot : C.gate) + .5) {
        run.i++;
        if (run.i < def.pts.length) { aim(run.i); game.audio.pickup(); }
        else {
          const time = run.t, medal = medalFor(def, time), old = best(def.id), firstGold = medal === 'gold' && medalFor(def, old || 1e9) !== 'gold';
          const pay = (medal ? C.pay[medal] : C.pay.finish) + (firstGold ? C.firstGold : 0);
          if (!old || time < old) kit.save.set('race.' + def.id, +time.toFixed(2));
          game.addMoney(pay); game.audio.evade();
          kit.ui.banner(medal ? medal.toUpperCase() + '!' : 'FINISHED', `${fmtTime(time)}  +${cash(pay)}${!old || time < old ? '  NEW BEST' : ''}`, medal || 'plain', 4.5);
          stop(); return;
        }
      }
      const target = def.medals.find(m => run.t <= m), name = target ? MEDALS[def.medals.indexOf(target)].toUpperCase() + ' ' + fmtTime(target) : 'JUST FINISH';
      kit.ui.panel(def.name, fmtTime(run.t), `GATE ${run.i + 1}/${def.pts.length} · ${name}`);
    },
  };

  for (const def of RACES) A.starter({
    x: def.start[0], z: def.start[1], r: def.foot ? 2.6 : 5, color: 0x3de0ff, glyph: 'R', mode: def.foot ? 'foot' : 'car', name: def.name,
    info: () => { const b = best(def.id); return b ? `Best ${fmtTime(b)}${medalFor(def, b) ? ' · ' + medalFor(def, b) : ''} · gold ${fmtTime(def.medals[0])}` : `Gold ${fmtTime(def.medals[0])} · hold X to quit`; },
    onStart: () => { A.begin(part); run = { def, i: -1, t: 0, count: 3, out: 0 }; p.frozen = true; kit.ui.banner('3', def.name, 'count', 1); game.audio.click(); },
  });
  return part;
}
