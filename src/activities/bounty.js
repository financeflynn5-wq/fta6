// Bounty hunts for Sunset PD: stop a car in the ring outside the station and Officer Dale radios in a runaway.
// Ram it (or shoot it) until the driver gives up, and the next one is called in. Every catch pays more than
// the last and puts time back on the clock. The shift ends when the clock runs out or one of them gets away.
import { cash, fmtTime } from './kit.js';
import { choose } from '../core/utils.js';

// who is on the run: the first few come in this order, after that it is anybody's guess
const RIDES = [['car', 'SEDAN'], ['van', 'VAN'], ['taxi', 'STOLEN TAXI'], ['limo', 'LIMO'], ['sport', 'SPORTS CAR'], ['truck', 'TRUCK']];
const CROOKS = ['possum', 'raccoon'];
const BLUE = 0x7fb0ff;

export function createBounty(A) {
  const { game, kit, cfg } = A, C = cfg.bounty, p = game.player, outlaws = game.outlaws, pd = game.landmarks.station;
  const arrow = kit.arrow(BLUE);
  let run = null;
  const blip = kit.blip({ x: 0, z: 0, color: '#7fb0ff', glyph: 'W', pin: true, hot: true, size: 7.5, visible: () => !!run?.r });

  // Dispatch finds the next one. No free stretch of road just now? It tries again next frame.
  function call() {
    const [type, name] = run.n < 4 ? RIDES[run.n] : choose(RIDES);
    const r = outlaws.runaway(type, C.minDist, C.maxDist, { speed: Math.min(C.speed[2], C.speed[0] + C.speed[1] * run.n), giveUp: C.giveUp, lost: C.lost, crook: choose(CROOKS) });
    if (!r) return;
    run.r = r; run.name = name; run.pay = C.pay + C.step * run.n;
    game.hud.toast(`WANTED: ${name}  ·  ${cash(run.pay)}`, 'info'); game.audio.pager();
  }
  function stop(big, cls = 'plain') {
    if (run.r) outlaws.release(run.r);
    const best = kit.save.get('bounty.best', 0), isBest = run.n > best; if (isBest) kit.save.set('bounty.best', run.n);
    if (big) kit.ui.banner(big, run.n ? `${run.n} caught  +${cash(run.total)}${isBest ? '  NEW BEST' : ''}` : 'Nobody caught this time', run.n ? cls : 'bad', 4.5);
    if (run.n) game.audio.evade();
    arrow.over(null); run = null; A.end();
  }

  const part = {
    abort(msg = 'SHIFT OVER') { if (run) stop(msg); },
    progress() { const b = kit.save.get('bounty.best', 0); return ['Bounty hunts', b ? `best ${b} in one shift` : 'not tried']; },
    update(dt, t) {
      if (!run) return;
      if (A.quitHeld(dt)) return stop('SHIFT OVER');
      run.left -= dt;
      let sub = 'Dispatch is finding the next one…';
      if (!run.r) call();
      else {
        const v = run.r.car, state = outlaws.update(run.r, dt);
        if (state === 'stopped') {
          run.total += run.pay; run.n++; run.left += C.extra; run.r = null;
          game.addMoney(run.pay); kit.ui.banner('GOT ’EM!', `${run.name}  +${cash(run.pay)}  ·  ${C.extra} more seconds`, 'gold', 2.4);
        } else if (state === 'gone') { run.r = null; return stop('THEY GOT AWAY'); }
        else {
          blip.x = v.x; blip.z = v.z; arrow.over(v, t);
          const full = v.stats.health, share = Math.max(0, (v.health - C.giveUp * full) / (full * (1 - C.giveUp)));
          sub = `${run.name} · ${Math.round(Math.hypot(v.x - p.x, v.z - p.z))} m · ${Math.ceil(share * 100)}% to go · ram it until the driver gives up`;
        }
      }
      if (!run.r) arrow.over(null);
      if (run.left <= 0) return stop("TIME'S UP", 'silver');
      kit.ui.panel('BOUNTY HUNT', fmtTime(run.left), `${run.n} caught · ${sub}`);
    },
  };

  // the ring sits in the kerb lane outside the station, a little along from the door (Dale stands there in story mode)
  const dx = Math.cos(pd.face), dz = -Math.sin(pd.face);                // along the street
  const fx = Math.sin(pd.face), fz = Math.cos(pd.face);                 // out from the door
  A.starter({
    x: pd.x + dx * 12 + fx * 5, z: pd.z + dz * 12 + fz * 5, r: 4, color: BLUE, glyph: 'W', mode: 'car', name: 'BOUNTY HUNT',
    info: () => { const b = kit.save.get('bounty.best', 0); return `Run down wanted drivers for Sunset PD before the clock runs out${b ? ` · best ${b}` : ''} · hold X to quit`; },
    onStart: () => { A.begin(part); run = { n: 0, total: 0, left: C.time, r: null }; kit.ui.banner('BOUNTY HUNT', 'Ram the wanted car until the driver gives up', 'go', 2.6); game.audio.star(); },
  });
  return part;
}
