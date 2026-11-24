// A job on the side, after the story proper (and playable on its own from the pause menu):
//   THE FROSTBITE RUN      take a loaded Mouse Bear truck from the depot, across town, through the gate at the top of
//                          the West Pass and up the ice road to the lodge on top of Frostbite Peak
// Dot, Mouse Bear's dispatcher, hands it out at the depot's gatehouse. The mountain and its road are in
// world/snowland.js (numbers) and world/snowpeak.js (what you see); how slippery ice is, is SNOW in config.js.
// The road is the mission: there are no rails, so going over the edge, or leaving the road for long, loses the load.
// Four checkpoints on the way up put you back in a fresh truck.
import { STORY2 as C, SNOW } from '../config.js';
import { cash } from '../activities/kit.js';
import { ROAD, SEAM, roadAt } from '../world/snowland.js';

const GREEN = 0x6dff8a;

export function buildMissions3(game, tools, spots) {
  const p = game.player, hud = game.hud, traffic = game.traffic, audio = game.audio, peak = game.city.snow;
  const depot = game.city.districts.spots.mousebear;
  if (!depot || !peak) return [];

  // Dot waits by the gatehouse, just inside the depot's main gate (always: she has nowhere else to be)
  const gx = depot.gate.x, gz = depot.gate.z;
  spots.dot = { x: gx + 4.9, z: gz + 3.4, bx: gx + 7.3, bz: gz + 3.1, face: -Math.PI / 2, always: true };

  const at = (s) => ROAD[Math.max(0, Math.min(ROAD.length - 1, Math.round(s / 2.5)))];
  // where the checkpoints are (metres along the ice road): the gate, the snow line, half way, and before the last and iciest stretch
  const STOPS = [22, 700, 1160, 1600];
  const spot = (s) => { const q = at(s); return [q.x, q.z, Math.atan2(q.tx, q.tz), q.y]; };
  // a second try: a fresh truck on the road at the checkpoint, with Rocco at the wheel
  const truckAt = (s) => (run) => {
    const q = at(s);
    for (const o of traffic.vehicles.slice()) if (!o.driver && Math.hypot(o.x - q.x, o.z - q.z) < 9) traffic.remove(o);
    if (p.mode === 'car') p.exit();
    const v = traffic.add('mbtruck', q.x, q.z, Math.atan2(q.tz, q.tx)); game.ride.setHeight(v, q.y);
    v.stolen = true; v.temp = false; run.cars.truck = run.refs.truck = v; p.enter(v);
    run.frost = null;
  };

  // ---------- on the ice road ----------
  // Looks after the truck while it is on the mountain. Returns false once the mission has failed.
  function watch(run, dt) {
    const v = run.cars.truck, F = run.frost ||= { off: 0, fall: 0, s: 0, y: v.y, said: 0 };
    run.count = `${Math.max(0, Math.round(v.y))} M`;
    if (p.vehicle !== v) { tools.point(v); tools.tip('Get back in the truck'); if (v.x > SEAM + 60 || p.x > SEAM + 60) return true; }
    if (v.x > SEAM + 44) { F.off = F.fall = 0; return true; }            // not on the mountain yet (or backed out through the gate)
    const r = roadAt(v.x, v.z), onTop = v.y > peak.drop.y - 2.5 && Math.hypot(v.x - peak.top.x, v.z - peak.top.z) < 48;          // the flat top, where the road has run out
    if (onTop) { F.off = F.fall = 0; F.y = peak.drop.y; return true; }
    const on = !!r && r.d < r.hw + 1.3 && Math.abs(v.y - r.y) < 2.5 && !v.air;
    if (on && r.s < F.s - 140) { tools.fail('THE TRUCK WENT OVER THE EDGE'); return false; }        // came to rest on the road, a whole turn further down
    if (on) { F.off = F.fall = 0; F.s = Math.max(F.s, r.s); F.y = r.y; return true; }
    F.off += dt; if (v.cliff || v.air > .5 || v.y < F.y - 5) F.fall += dt;
    if (F.fall > .9) { tools.fail('THE TRUCK WENT OVER THE EDGE'); return false; }
    if (F.off > SNOW.offRoad) { tools.fail('YOU LEFT THE ROAD'); return false; }
    if (F.off > 1.2) tools.tip(`Back on the road! ${Math.ceil(SNOW.offRoad - F.off)}`);
    return true;
  }
  // drive on to a point `s` metres up the road (a ring across it)
  const reach = (s, say) => (run, dt, t) => {
    if (!watch(run, dt)) return false;
    const q = at(s), G = run.gate?.s === s ? run.gate : run.gate = { s, ring: tools.ring(GREEN, q.hw + 1.2).place(q.x, q.z, q.y), blip: tools.blip({ x: q.x, z: q.z, color: '#6dff8a', glyph: '', pin: true, hot: true, size: 7 }) };
    G.ring.tick(t, p, 900);
    const v = run.cars.truck, r = roadAt(v.x, v.z);
    if (p.vehicle !== v || !(Math.hypot(v.x - q.x, v.z - q.z) < q.hw + 2.5 || (r && r.s > s && r.s < s + 60 && Math.abs(v.y - r.y) < 3))) return false;
    if (say) hud.toast(say, 'job');
    return true;
  };
  let clean = false;               // got it there without a scratch
  function deliver(run, dt, t) {
    if (!watch(run, dt)) return false;
    const d = peak.drop, D = run.dock ||= { t: 0, ring: tools.ring(GREEN, 5.5).place(d.x, d.z, d.y), blip: tools.blip({ x: d.x, z: d.z, color: '#6dff8a', glyph: '', pin: true, hot: true, size: 7 }) };
    D.ring.tick(t, p, 900);
    const v = run.cars.truck;
    if (p.vehicle !== v || !D.ring.inside(v)) { D.t = 0; return false; }
    if (v.speed > 1.5) { tools.tip('Stop here'); D.t = 0; return false; }
    if (D.t === 0) audio.pickup();
    D.t += dt; tools.tip(`Unloading${'.'.repeat(1 + Math.floor(D.t * 3) % 3)}`);
    if (D.t < 2.2) return false;
    clean = v.health >= v.stats.health * .97; run.count = '';
    return true;
  }

  return [
    // ------------------------------------------------------------------ 13
    {
      id: 'frost', title: 'THE FROSTBITE RUN', giver: 'dot', brief: 'Drive a Mouse Bear truck up the ice road to the top of Frostbite Peak',
      intro: [
        ['dot', 'You Rocco? Dot. I run dispatch for Mouse Bear. Tiff says you jumped off a hotel, so heights are not a problem.'],
        ['rocco', 'Depends what\'s at the bottom.'],
        ['dot', 'Nothing. That\'s the point. The Frostbite Lodge, top of Frostbite Peak, is out of cocoa. And generator parts. But mostly cocoa.'],
        ['dot', 'One road up. No rails. Dirt, then snow, then ice you can see your face in. My last three drivers quit at the gate.'],
        ['dot', 'Truck\'s loaded, first bay by the east fence. Over the West Pass, through the gate at the top of it, and keep climbing. Slow down BEFORE the blue stuff. Not on it.'],
      ],
      steps: [
        { car: 'mbtruck', as: 'truck', own: true, adopt: true, at: depot.bays[0], text: 'Take the loaded Mouse Bear truck from the first bay by the east fence' },
        { until: reach(STOPS[0], 'DOT: "THAT WAS THE EASY BIT, HON"'), text: 'Drive it to the Frostbite Peak gate: at the top of the West Pass, in the hills west of downtown' },
        { cp: spot(STOPS[0]), again: truckAt(STOPS[0]) },
        { until: reach(STOPS[1], 'DOT: "SNOW FROM HERE. THE BLUE PATCHES ARE ICE"'), text: 'Up the ice road. There are no rails: stay off the edge' },
        { cp: spot(STOPS[1]), again: truckAt(STOPS[1]) },
        { until: reach(STOPS[2], 'DOT: "HALF WAY. DON\'T LOOK DOWN"'), text: 'Keep climbing. Slow down before the blue ice, and steer gently on it' },
        { cp: spot(STOPS[2]), again: truckAt(STOPS[2]) },
        { until: reach(STOPS[3], 'DOT: "LAST STRETCH. IT IS MOSTLY ICE"'), text: 'Keep climbing. The ledge gets narrow up here' },
        { cp: spot(STOPS[3]), again: truckAt(STOPS[3]) },
        { until: deliver, text: 'To the top, and stop in the ring outside the Frostbite Lodge' },
        { run: (run) => { delete run.cars.truck; if (clean) hud.toast('NOT A SCRATCH ON IT', 'good'); } },
      ],
      outro: [
        ['dot', 'Lodge says the truck is there, and the cocoa, and you. I had ten bucks on the snowman getting a new friend.'],
        ['rocco', 'How do I get down?'],
        ['dot', 'Same road, other way. It\'s all downhill from there, hon. That\'s the problem.'],
        ['dot', 'Money\'s in your pocket. Bring my truck back in one piece and there might be another run in it for you.'],
      ],
      reward: (g) => { if (clean) { g.addMoney(C.frostClean); hud.toast(`CLEAN RUN BONUS +${cash(C.frostClean)}`, 'good'); } },
    },
  ];
}
