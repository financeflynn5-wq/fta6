// Things to do around the map: races, stunt jumps, golden tins, pizza runs, speed cameras and
// car bowling. This file owns what they share (start rings, "one thing at a time", the radar
// blips) and populates the new districts with parked cars and people.
import { ACTIVITIES } from '../config.js';
import { choose } from '../core/utils.js';
import { CIVILIANS } from '../characters/models.js';
import { createKit } from './kit.js';
import { createRaces } from './races.js';
import { createStunts } from './stunts.js';
import { createTins } from './tins.js';
import { createPizza } from './pizza.js';
import { createTraps } from './traps.js';
import { createBowling } from './bowling.js';
import { createBigMap } from './bigmap.js';

export function createActivities(game) {
  const kit = createKit(game), D = game.city.districts, p = game.player;
  const starters = [];
  const A = {
    game, kit, cfg: ACTIVITIES, districts: D, busy: null, parts: {},
    // A ring you stop in to begin something. mode: 'car', 'foot' or 'any'.
    starter({ x, z, r = 5, color, glyph, mode = 'any', name, info = () => '', onStart }) {
      const s = { x, z, r, mode, name, info, onStart, dwell: 0, mark: kit.marker(color, r).place(x, z), hidden: false };
      s.blip = kit.blip({ x, z, color: '#' + color.toString(16).padStart(6, '0'), glyph, size: 7.5, visible: () => !A.busy && !s.hidden });
      starters.push(s); return s;
    },
    // begin / end an activity: only one runs at a time, and its start rings hide while it does
    begin(part) { A.busy = part; for (const s of starters) s.mark.hide(); kit.ui.hint(''); },
    end() { A.busy = null; kit.ui.panel(''); for (const s of starters) if (!s.hidden) s.mark.place(s.x, s.z); },
    // hold X to walk away from whatever you're doing
    quitHeld(dt) { A.quitT = game.input.down('KeyX') ? (A.quitT || 0) + dt : 0; return A.quitT > .8; },
    progress() { return Object.values(A.parts).map(part => part.progress?.()).filter(Boolean); },
  };

  // cars parked around the new districts, and people strolling the boardwalk, pier, hills and docks
  for (const [type, x, z, h] of D.parked) game.traffic.add(type, x, z, h);
  for (const w of D.walkers) for (let i = 0; i < w.n; i++) game.peds.addWalker(choose(w.kinds || CIVILIANS), w.cx, w.cz, w.hx, w.hz);

  A.parts.races = createRaces(A); A.parts.stunts = createStunts(A); A.parts.tins = createTins(A);
  A.parts.pizza = createPizza(A); A.parts.traps = createTraps(A); A.parts.bowling = createBowling(A);
  const bigMap = createBigMap(A);

  A.update = (dt, t) => {
    kit.ui.update(dt);
    if (game.state !== 'playing') { bigMap.update(dt, false); return; }
    if (A.busy && game.over) { A.busy.abort?.('') ; }
    // start rings
    if (!A.busy) {
      let hint = '';
      for (const s of starters) {
        if (s.hidden) continue;
        s.mark.tick(t, p);
        if (Math.abs(s.x - p.x) > s.r + 2 || !s.mark.inside(p)) { s.dwell = 0; continue; }
        const ok = s.mode === 'any' || s.mode === p.mode, slow = p.speed < 2.5;
        hint = `<b>${s.name}</b>${!ok ? (s.mode === 'car' ? 'Bring a car' : 'On foot only') : slow ? 'Starting…' : 'Stop here to start'}<em>${s.info()}</em>`;
        s.dwell = ok && slow && !game.over ? s.dwell + dt : 0;
        if (s.dwell > .7) { s.dwell = 0; s.onStart(); hint = ''; break; }
      }
      if (!A.busy) kit.ui.hint(hint);
    }
    for (const k in A.parts) A.parts[k].update(dt, t);
    bigMap.update(dt, game.input.down('Tab'));
  };
  return A;
}
