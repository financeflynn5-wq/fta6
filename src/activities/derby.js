// The Golden Acres derby: a ring in the west paddock, and a handful of farm boys in old cars who all want
// to put you through the fence. Wreck every one of them before they wreck you. Each win brings one more
// rival next time. Leave the ring (or your car) for more than a few seconds and you are out.
import { cash } from './kit.js';
import { choose } from '../core/utils.js';

const RIDES = ['car', 'car', 'taxi', 'van', 'truck'];
const PURPLE = 0xb980ff;

export function createDerby(A) {
  const { game, kit, cfg } = A, C = cfg.derby, p = game.player, outlaws = game.outlaws, traffic = game.traffic;
  const ring = kit.marker(PURPLE, C.radius);
  let run = null;
  const rivalsNow = () => Math.min(C.max, C.rivals + kit.save.get('derby.wins', 0));
  const inRing = (o) => Math.hypot(o.x - C.x, o.z - C.z) < C.radius;

  // A rival's race is run: the car stays where it stopped until nobody is looking, like any wreck.
  function park(v) {
    v.outlaw = false; v.temp = true; v.derby = true;
    if (!v.wrecked && traffic.vehicles.includes(v)) { v.driver = null; v.controls.throttle = 0; v.controls.steer = 0; v.controls.handbrake = true; }
  }
  function start() {
    for (const v of traffic.vehicles.slice()) if (v.derby && v !== p.vehicle) traffic.remove(v);      // tow away last time's wrecks
    const n = rivalsNow(), mine = Math.atan2(p.z - C.z, p.x - C.x), rivals = [];
    for (let i = 0; i < n; i++) {
      // spaced round the ring, facing the middle, none of them right on top of you
      const a = mine + Math.PI + (i - (n - 1) / 2) * (Math.PI * 1.5 / n), x = C.x + Math.cos(a) * C.radius * .8, z = C.z + Math.sin(a) * C.radius * .8;
      rivals.push(outlaws.hunter(choose(RIDES), x, z, a + Math.PI, C.speed));
    }
    A.begin(part); ring.place(C.x, C.z);
    run = { rivals, n, wrecked: 0, total: 0, outT: 0, footT: 0, car: p.vehicle };
    kit.ui.banner('DEMOLITION DERBY', `${n} rivals. Last car running wins.`, 'go', 2.8); game.audio.star();
  }
  function stop() { for (const v of run.rivals) park(v); ring.hide(); run = null; A.end(); }
  function lose(why) { kit.ui.banner('YOU’RE OUT', `${why}${run.total ? `  ·  +${cash(run.total)} for the wrecks` : ''}`, 'bad', 4); stop(); }

  const part = {
    abort(msg = 'YOU LEFT THE DERBY') { if (!run) return; if (msg) game.hud.toast(msg, 'bad'); stop(); },
    progress() { const w = kit.save.get('derby.wins', 0); return ['Derby', w ? `${w} win${w > 1 ? 's' : ''}` : 'not won']; },
    update(dt, t) {
      if (!run) return;
      if (A.quitHeld(dt)) return part.abort();
      ring.tick(t, p, 500);
      for (const v of run.rivals) {
        if (v.out) continue;
        if (v.wrecked || !traffic.vehicles.includes(v)) {
          v.out = true; run.wrecked++; run.total += C.wreck; game.addMoney(C.wreck);
          game.hud.toast(`WRECKED  +${cash(C.wreck)}`, 'good');
        } else outlaws.aim(v);
      }
      const mine = p.mode === 'car' ? p.vehicle : null;
      if (mine) { run.car = mine; run.footT = 0; }
      if (run.car?.wrecked) return lose('Your car is scrap');
      if (!mine && (run.footT += dt) > C.out) return lose('No car, no derby');
      const out = !inRing(p); run.outT = out ? run.outT + dt : 0;
      if (run.outT > C.out) return lose('You left the ring');
      if (run.wrecked === run.n) {
        const wins = kit.save.get('derby.wins', 0) + 1; kit.save.set('derby.wins', wins);
        game.addMoney(C.win); game.audio.evade();
        kit.ui.banner('DERBY CHAMP!', `${run.n} wrecks  +${cash(run.total + C.win)}${rivalsNow() > run.n ? '  ·  one more rival next time' : ''}`, 'gold', 4.5);
        return stop();
      }
      const hp = mine ? Math.ceil(mine.health / mine.stats.health * 100) : 0;
      kit.ui.panel('DERBY', `${run.n - run.wrecked} LEFT`, out ? `BACK IN THE RING!  ${Math.ceil(C.out - run.outT)}` : mine ? `Your car ${hp}% · wreck them all` : `Get back in a car!  ${Math.ceil(C.out - run.footT)}`);
    },
  };

  A.starter({
    x: C.x, z: C.z, r: 5, color: PURPLE, glyph: 'D', mode: 'car', name: 'DEMOLITION DERBY',
    info: () => `${rivalsNow()} rivals come at you · ${cash(C.wreck)} a wreck, ${cash(C.win)} for winning · bring something tough`,
    onStart: start,
  });
  return part;
}
