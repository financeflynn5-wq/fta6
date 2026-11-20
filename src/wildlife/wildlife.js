// Everything alive that isn't a citizen: the sharks in the sea and the animals of Sunset Zoo.
// main.js makes one of these; combat/hits.js asks it what a shot hit.
import { createCalls } from './calls.js';
import { createSharks } from './sharks.js';
import { createZooLife } from './zooLife.js';

export function createWildlife(game) {
  const calls = createCalls(game);
  const sharks = createSharks(game, calls), zoo = createZooLife(game, calls);
  return {
    sharks, zoo, calls,
    // every animal a shot could hit: consider(distance, 'beast', animal) for each one on the line
    cast(ox, oy, oz, dx, dy, dz, tmin, range, consider) { sharks.cast(ox, oy, oz, dx, dy, dz, tmin, range, consider); zoo.cast(ox, oy, oz, dx, dy, dz, tmin, range, consider); },
    // a bullet, a fist or a blade landed on one. Returns true when that finished it.
    hurt(h, damage, dx, dz, o) { return h.obj.owner.hurt(h.obj, h, damage, dx, dz, o); },
    update(dt, t) { sharks.update(dt, t); zoo.update(dt, t); },
  };
}
