// Everybody who picks a fight with you on foot, in one place for main.js: the fighters themselves (combat/brawlers.js),
// the camp in the woods, the bar downtown and the gangs on their corners. Also what a drink at the bar does to your eyes.
import { BAR } from '../config.js';
import { createBrawlers } from '../combat/brawlers.js';
import { createCamp } from './camp.js';
import { createBarFight } from './barfight.js';
import { createGangs } from './gangs.js';

export function createTrouble(game) {
  game.brawlers = createBrawlers(game);
  const camp = createCamp(game), bar = createBarFight(game), gangs = createGangs(game);
  const trouble = {
    camp, bar, gangs, tipsy: 0,
    drink() { trouble.tipsy = Math.min(BAR.tipsy * 2.5, trouble.tipsy + BAR.tipsy); },
    // once a frame, after the camera has been placed
    update(dt, t) {
      game.brawlers.update(dt, t); camp.update(dt, t); bar.update(dt, t); gangs.update(dt, t);
      if (trouble.tipsy > 0) {                               // the room sways for a while after a drink (more after two)
        trouble.tipsy = game.over ? 0 : trouble.tipsy - dt;
        const k = Math.min(1, trouble.tipsy / 6) * Math.min(2.2, .6 + trouble.tipsy / BAR.tipsy), c = game.camera;
        if (game.state !== 'title' && !game.combat.aiming) { c.rotateZ(Math.sin(t * 1.5) * .035 * k); c.rotateY(Math.sin(t * .9 + 1) * .012 * k); }
      }
    },
  };
  return trouble;
}
