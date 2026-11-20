// Mouse Bear Trucking's trucks. The depot itself is scenery (world/mousebear.js); this keeps it alive:
//   - a truck in every bay of the yard, put back once it has been taken or wrecked and you are far away
//   - at least MOUSEBEAR.onRoad company trucks always out driving near you (the ordinary traffic mix adds more)
//   - the depot's blip on the radar and the big map: the company roundel
// The trucks are ordinary vehicles of type 'mbtruck' (config.js CAR.types; dressed in vehicles/vehicleModels.js),
// so stealing, denting and selling them to Scrap work as for any other.
import { MOUSEBEAR, TRAFFIC } from '../config.js';
import { AIDriver } from './aiDriver.js';

export function createMouseBearFleet(game) {
  const spot = game.city.districts.spots.mousebear;
  if (!spot) return { slots: [], update() { } };
  const slots = spot.bays.map(([x, z, h], i) => ({ x, z, h, sid: 5200 + i, v: null, wait: 0 }));      // sid: the same number on every player's screen
  function fill(s) {
    const v = game.traffic.add('mbtruck', s.x, s.z, s.h); v.sid = s.sid; v.home = s;
    v.syncVisual(0, 0); s.v = v; s.wait = 0; game.env?.touch();
    return v;
  }
  for (const s of slots) fill(s);

  const img = new Image(); img.src = 'assets/mousebear/logo.png';
  game.markers.push({ x: spot.x, z: spot.z, color: '#fff3dc', glyph: 'B', ink: '#0a6c6e', size: 9, img, visible: () => !game.match?.on });

  let tick = 1.5;
  return {
    slots,
    // how many company trucks are being driven around by someone other than you
    onRoad: () => game.traffic.vehicles.filter(v => v.type === 'mbtruck' && v.driver instanceof AIDriver && !v.wrecked).length,
    update(dt) {
      if ((tick -= dt) > 0) return; tick = 1;
      const p = game.player;
      for (const s of slots) {
        const v = s.v;
        if (v && (v.gone || v.stolen || v.wrecked || v.driver || Math.hypot(v.x - s.x, v.z - s.z) > 5)) { s.v = null; v.temp = true; }      // no longer waiting in its bay: once it is left somewhere, traffic.js clears it away
        if (s.v) continue;
        s.wait += 1;
        if (s.wait < MOUSEBEAR.respawn || Math.hypot(p.x - s.x, p.z - s.z) < MOUSEBEAR.far) continue;
        if (game.traffic.vehicles.some(o => o.sid === s.sid || Math.hypot(o.x - s.x, o.z - s.z) < 4.5)) continue;             // someone still has it, or something is in the way
        fill(s);
      }
      if (!game.match?.on && this.onRoad() < MOUSEBEAR.onRoad) game.traffic.spawnCruiser('mbtruck', 95, TRAFFIC.near);
    },
  };
}
