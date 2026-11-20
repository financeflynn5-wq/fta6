// Pizza Pier deliveries: stop in the ring outside the pizzeria, then get four pies to their doors
// before each one goes cold. The quicker the drop, the bigger the tip.
import { cash, fmtTime } from './kit.js';
import { districtAt } from '../world/map.js';
import { choose, clamp } from '../core/utils.js';

// kerbside spots all over the map (every one is on or right beside a road)
const DOORS = [
  [-135, -49], [81, 59], [130, -103], [-49, 135], [49, -130],                     // downtown
  [-113, 265], [5, 300], [103, 245], [-157, 310],                                 // Vista Heights
  [265, -60], [319, 100], [140, -211], [276, 262],                                // the port, the coast road, the zoo gate
  [-200, 5], [-319, -100], [-250, -211], [-319, 150],                             // the Dustlands
];

export function createPizza(A) {
  const { game, kit, cfg, districts: D } = A, C = cfg.pizza, p = game.player, shop = D.spots.pizza;
  const drop = kit.marker(0xff6b3d, 5.5, true);
  let run = null;
  const blip = kit.blip({ x: 0, z: 0, color: '#ff6b3d', glyph: 'P', pin: true, hot: true, size: 7.5, visible: () => !!run });

  function nextDoor() {
    const from = run.door || [shop.x, shop.z];
    const pool = DOORS.filter(d => !run.used.includes(d) && Math.abs(d[0] - from[0]) + Math.abs(d[1] - from[1]) > 150);
    const d = choose(pool.length ? pool : DOORS.filter(d => d !== run.door));
    run.used.push(d); run.door = d;
    // the streets are a grid, so allow for driving round the corners rather than a straight line
    run.limit = run.left = (Math.abs(d[0] - from[0]) + Math.abs(d[1] - from[1])) / C.pace + C.slack;
    run.where = districtAt(d[0], d[1]);
    drop.place(d[0], d[1]); drop.setColor(0xff6b3d); blip.x = d[0]; blip.z = d[1]; run.cold = false;
    game.hud.toast(`PIE ${run.n + 1}: ${run.where}`, 'info');
  }
  function stop() { drop.hide(); run = null; A.end(); }

  const part = {
    abort(msg = 'SHIFT OVER: THE PIES WENT IN THE BIN') { if (!run) return; if (msg) game.hud.toast(msg, 'bad'); stop(); },
    progress() { const b = kit.save.get('pizza.best', 0); return ['Pizza run', b ? `best ${cash(b)}` : 'not tried']; },
    update(dt, t) {
      if (!run) return;
      if (A.quitHeld(dt)) return part.abort();
      drop.tick(t, p, 500);
      run.left -= dt;
      if (run.left <= 0 && !run.cold) { run.cold = true; run.hot = false; drop.setColor(0x6fb7ff); game.hud.toast('THAT PIE IS COLD', 'bad'); }
      if (drop.inside(p) && p.speed < 7) {
        const share = clamp(run.left / run.limit * 1.7, 0, 1), tip = run.cold ? 0 : Math.round(C.tip * share / 10) * 10, pay = run.cold ? C.cold : C.base + tip;
        run.total += pay; run.n++; game.addMoney(pay); game.audio.cash();
        if (run.n < C.count) { game.hud.toast(run.cold ? `COLD PIE  +${cash(pay)}` : `DELIVERED  +${cash(pay)}${tip >= C.tip * .8 ? '  BIG TIP!' : ''}`, run.cold ? 'bad' : 'good'); nextDoor(); }
        else {
          if (run.hot) { run.total += C.perfect; game.addMoney(C.perfect); }
          const best = kit.save.get('pizza.best', 0), isBest = run.total > best; if (isBest) kit.save.set('pizza.best', run.total);
          kit.ui.banner(run.hot ? 'PIPING HOT!' : 'SHIFT DONE', `${C.count} pies  +${cash(run.total)}${run.hot ? `  (${cash(C.perfect)} bonus)` : ''}${isBest ? '  NEW BEST' : ''}`, run.hot ? 'gold' : 'plain', 4.5);
          game.audio.evade(); stop(); return;
        }
      }
      kit.ui.panel('PIZZA RUN', run.cold ? 'COLD' : fmtTime(Math.max(0, run.left)), `PIE ${run.n + 1}/${C.count} · ${run.where}`);
    },
  };

  A.starter({
    x: shop.x, z: shop.z, r: 4.5, color: 0xff6b3d, glyph: 'P', mode: 'any', name: 'PIZZA RUN',
    info: () => { const b = kit.save.get('pizza.best', 0); return `${C.count} deliveries against the clock${b ? ` · best ${cash(b)}` : ''} · hold X to quit`; },
    onStart: () => { A.begin(part); run = { n: 0, total: 0, hot: true, used: [], door: null }; kit.ui.banner('PIZZA RUN', 'Get each pie to its door while it\'s hot', 'go', 2.6); game.audio.pager(); nextDoor(); },
  });
  return part;
}
