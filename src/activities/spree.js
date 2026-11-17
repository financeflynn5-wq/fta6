// Coral Plaza smash spree: one minute to break as much of the mall as you can. Windows, tables, planters,
// clothes racks and kiosks all count (glass pays more). Drive through the courtyard or do it on foot with
// a gun. The mall is put back together before you start, and after a dozen breakages the alarm goes off.
import { cash, fmtTime } from './kit.js';

const LIME = 0xb4f03c;

export function createSpree(A) {
  const { game, kit, cfg } = A, C = cfg.spree, [x0, x1, z0, z1] = C.box;
  let run = null;

  // places.js calls this for everything that breaks, whoever broke it
  game.onSmash = (b) => {
    if (!run || b.x < x0 || b.x > x1 || b.z < z0 || b.z > z1) return;
    const pay = b.kind === 'glass' ? C.glass : C.each; run.n++; run.total += pay; game.addMoney(pay);
    if (run.n === C.alarm) game.police.crime(35, 2, 'MALL ALARM!');
  };
  function stop() { run = null; A.end(); }

  const part = {
    abort(msg = 'SPREE OVER') { if (!run) return; if (msg) game.hud.toast(msg, 'bad'); stop(); },
    progress() { const b = kit.save.get('spree.best', 0), m = kit.medal(b, C.medals); return ['Mall smash spree', b ? `best ${b}${m ? ' · ' + m : ''}` : 'not tried']; },
    update(dt) {
      if (!run) return;
      if (A.quitHeld(dt)) return part.abort();
      run.left -= dt;
      if (run.left <= 0) {
        const m = kit.medal(run.n, C.medals), bonus = m ? C.pay[m] : 0, best = kit.save.get('spree.best', 0), isBest = run.n > best;
        if (isBest) kit.save.set('spree.best', run.n);
        if (bonus) game.addMoney(bonus);
        kit.ui.banner(m ? m.toUpperCase() + '!' : run.n ? 'TIME’S UP' : 'NOT A SCRATCH', `${run.n} smashed  +${cash(run.total + bonus)}${isBest && best ? '  NEW BEST' : ''}`, m || 'plain', 4.5);
        game.audio.evade(); return stop();
      }
      const next = run.n < C.medals.bronze ? `bronze at ${C.medals.bronze}` : run.n < C.medals.silver ? `silver at ${C.medals.silver}` : run.n < C.medals.gold ? `gold at ${C.medals.gold}` : 'GOLD!';
      kit.ui.panel('SMASH SPREE', fmtTime(run.left), `${run.n} smashed · ${cash(run.total)} · ${next}`);
    },
  };

  A.starter({
    x: C.x, z: C.z, r: 4.5, color: LIME, glyph: 'M', mode: 'any', name: 'SMASH SPREE',
    info: () => { const b = kit.save.get('spree.best', 0); return `${C.time} seconds to wreck Coral Plaza: windows, tables, the lot${b ? ` · best ${b}` : ''} · gold at ${C.medals.gold}`; },
    onStart: () => {
      game.places.mend(x0, x1, z0, z1);
      A.begin(part); run = { n: 0, total: 0, left: C.time };
      kit.ui.banner('SMASH SPREE', 'Break everything in the mall. Glass pays best.', 'go', 2.6); game.audio.star();
    },
  });
  return part;
}
