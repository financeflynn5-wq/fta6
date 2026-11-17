// Your cash, guns and armor are written to the browser's storage every few seconds, so they are still there
// the next time you play (story or free roam: it is one wallet). "Start over" on the title screen wipes it.
import { STORY, WEAPONS } from '../config.js';

const KEY = 'fta6.wallet.v1';

export function createWallet(game) {
  const c = game.combat, p = game.player;
  let last = '', wait = 0, saved = false;
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d) {
      saved = true; game.money = Math.max(0, d.money | 0); p.armor = d.armor || 0;
      for (const id in d.guns || {}) if (WEAPONS[id] && !WEAPONS[id].melee) { c.give(id, 1); c.clip[id] = d.guns[id][0] | 0; c.ammo[id] = d.guns[id][1] | 0; }
      if (d.weapon && c.owned.has(d.weapon)) c.select(d.weapon);
    }
  } catch (e) { /* nothing saved, or storage is blocked: start with empty pockets */ }
  const snap = () => JSON.stringify({
    money: Math.round(game.money), armor: Math.round(p.armor), weapon: c.weapon,
    guns: Object.fromEntries([...c.owned].filter(id => id !== 'fists').map(id => [id, [c.clip[id] || 0, c.ammo[id] || 0]])),
  });
  return {
    get saved() { return saved; },
    update(dt) {
      if ((wait -= dt) > 0 || game.over) return;
      wait = STORY.saveEvery;
      const s = snap(); if (s === last) return;
      last = s; saved = true; try { localStorage.setItem(KEY, s); } catch (e) { /* private window: this session only */ }
    },
    wipe() { try { localStorage.removeItem(KEY); } catch (e) { /* nothing to wipe */ } },
  };
}
