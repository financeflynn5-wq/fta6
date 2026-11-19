// Everything a vehicle sounds like while the game runs: the engine of the car you drive (built from
// the loops in engineLoops.js), its tyres and the wind, the traffic around you (each car placed left or
// right of you, fading with distance, its pitch bending as it passes), sirens, horns and the starter.
import { ENGINES, makeLoop } from './engineLoops.js';
import { createCraftSounds } from './craftSounds.js';
import { SOUND } from '../config.js';
import { clamp } from '../core/utils.js';
import { surfaceAt } from '../world/terrain.js';

const HALF_PI = Math.PI / 2, DUSTY = { dirt: 1, scrub: 1, sand: 1 }, LOOP_RATE = 32000;

// bus: { dry, world, noise } — dry goes straight to the speakers, world is the street (echo, and muffled when you are indoors)
export function createCarSounds(ctx, bus) {
  const now = () => ctx.currentTime;
  const gain = (v, to) => { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
  const filt = (type, hz, q, to) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.Q.value = q; if (to) f.connect(to); return f; };
  const panner = (to) => { const p = ctx.createStereoPanner ? ctx.createStereoPanner() : gain(1); if (to) p.connect(to); return p; };
  const noise = (to, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = bus.noise; s.loop = true; s.playbackRate.value = rate; s.connect(to); s.start(0, Math.random() * 1.5); return s; };
  const set = (param, v, tc = .04) => param.setTargetAtTime(v, now(), tc);

  // ---------- engine loops: built a few at a time after the game starts, so nothing stutters ----------
  const bank = {}, queue = [];
  for (const kind of Object.keys(ENGINES)) ENGINES[kind].refs.forEach((rpm, i) => queue.push([kind, i, 0], [kind, i, 1]));
  function buildNext() {
    const job = queue.shift(); if (!job) return;
    const [kind, i, load] = job, E = ENGINES[kind], made = makeLoop(E, E.refs[i], load, LOOP_RATE);
    const b = ctx.createBuffer(1, made.data.length, LOOP_RATE); b.getChannelData(0).set(made.data);
    const k = bank[kind] ??= { off: [], on: [], rpm: [], n: 0, ready: false };
    (load ? k.on : k.off)[i] = b; k.rpm[i] = made.rpm; k.ready = ++k.n === E.refs.length * 2;
    setTimeout(buildNext, 15);
  }
  setTimeout(buildNext, 60);
  const want = (kind) => { if (!bank[kind]?.ready) queue.sort((a, b) => (b[0] === kind) - (a[0] === kind)); };     // the engine about to be heard jumps the queue
  const engineOf = (v) => SOUND.engine[v.type] ?? SOUND.engine.car;
  const craft = createCraftSounds(ctx, bus);      // helicopters: rotor and turbine
  const realRpm = (E, r) => E.idle + Math.pow(clamp(r, 0, 1.15), .85) * (E.redline - E.idle);

  // One engine: every loop plays all the time, in step with the others; only their volumes and speeds change.
  // loads: which throttle states to carry (the player's car has both, traffic only "on").
  function engineVoice(kind, to, loads, refs) {
    const E = ENGINES[kind], k = bank[kind], t0 = now() + .03, layers = [];
    for (const load of loads) for (const i of refs) {
      const s = ctx.createBufferSource(); s.buffer = (load ? k.on : k.off)[i]; s.loop = true;
      const g = gain(0, to); s.connect(g); s.start(t0);
      layers.push({ s, g, load, i, rpm: k.rpm[i] });
    }
    const lo = refs[0], hi = refs[refs.length - 1];
    return {
      kind, E,
      set(rpm, load, pitch = 1, tc = .035) {
        let i = lo; while (i < hi - 1 && rpm > E.refs[i + 1]) i++;
        const x = hi > lo ? clamp(Math.log(rpm / E.refs[i]) / Math.log(E.refs[i + 1] / E.refs[i]), 0, 1) : 0, t = now();
        for (const l of layers) {
          const wr = l.i === i ? Math.cos(x * HALF_PI) : l.i === i + 1 ? Math.sin(x * HALF_PI) : 0;
          const wl = loads.length < 2 ? 1 : l.load ? Math.sin(load * HALF_PI) : Math.cos(load * HALF_PI);
          l.g.gain.setTargetAtTime(wr * wl, t, tc); l.s.playbackRate.setTargetAtTime(clamp(rpm * pitch / l.rpm, .2, 4), t, tc);
        }
      },
      stop(after = .3) { const t = now(); for (const l of layers) { l.g.gain.setTargetAtTime(0, t, after / 4); l.s.stop(t + after); } setTimeout(() => layers.forEach(l => l.g.disconnect()), after * 1000 + 200); },
    };
  }

  // ---------- the car you drive ----------
  const miss = gain(1), engGain = gain(0, bus.dry); miss.connect(engGain);
  const rollF = filt('lowpass', 300, .6), rollG = gain(0, bus.dry); rollF.connect(rollG); noise(rollF, .7);
  const windF = filt('bandpass', 600, .5), windG = gain(0, bus.dry); windF.connect(windG); noise(windF, 1.1);
  // tyre squeal: two whistling tones that wander, over a rough scrub
  const skidG = gain(0, bus.dry), sq1 = filt('bandpass', 1150, 14, skidG), sq2 = filt('bandpass', 1720, 18, skidG), scrubG = gain(.16, skidG), scrub = filt('bandpass', 1400, .9, scrubG);
  { const src = gain(1); src.connect(sq1); src.connect(sq2); src.connect(scrub); noise(src, 1); }
  const me = { car: null, voice: null, startAt: 0, flare: 0, load: 0, gear: 0, shift: 0, popAt: 0, missAt: 0, surfT: 0, dusty: false };

  function pops(n, vol) {
    const t = now();
    for (let i = 0; i < n; i++) {
      const at = t + .05 + i * (.07 + Math.random() * .12), s = ctx.createBufferSource(), f = filt('lowpass', 700 + Math.random() * 900, 1.5), g = gain(0, bus.dry);
      s.buffer = bus.noise; s.connect(f); f.connect(g); g.gain.setValueAtTime(vol * (.6 + Math.random() * .6), at); g.gain.exponentialRampToValueAtTime(.001, at + .05); s.start(at, Math.random()); s.stop(at + .07);
      const o = ctx.createOscillator(), og = gain(0, bus.dry); o.frequency.setValueAtTime(120, at); o.frequency.exponentialRampToValueAtTime(48, at + .06);
      og.gain.setValueAtTime(vol * .8, at); og.gain.exponentialRampToValueAtTime(.001, at + .07); o.connect(og); o.start(at); o.stop(at + .09);
    }
  }

  function drive(car, dt, t) {
    if (car !== me.car) {                         // got in, got out, or swapped cars
      me.car = car; me.voice?.stop(.25); me.voice = null; me.load = 0; me.shift = 0; me.gear = car?.gear ?? 0;
      if (car) want(engineOf(car)[0]);
    }
    const kind = car?.stats.craft, running = car && !car.wrecked && kind !== 'heli';      // a helicopter has no piston engine (craftSounds.js)
    if (running && !me.voice && bank[engineOf(car)[0]]?.ready) me.voice = engineVoice(engineOf(car)[0], miss, [0, 1], [0, 1, 2, 3]);
    if (!running) set(engGain.gain, 0, .12);
    if (!car) { set(rollG.gain, 0, .1); set(windG.gain, 0, .2); set(skidG.gain, 0, .05); return; }

    const thr = Math.abs(car.controls.throttle), flying = car.air > 0, speed = car.speed;
    if (running && me.voice) {
      const E = me.voice.E, pitch = engineOf(car)[1];
      let r = clamp((car.rpm - .22) / .78, 0, 1.25), load = car.braking ? 0 : thr;
      if (load > .1) r = Math.max(r, load * .4);                 // pulling away: the clutch slips, so the revs lead the car
      if (flying) r = Math.max(r, thr * .95);                    // wheels in the air: it just screams
      if (me.flare > 0) { me.flare = Math.max(0, me.flare - dt * 1.6); r = Math.max(r, me.flare); }
      // a gear change is a quick lift off the throttle
      const gear = car.gear ?? 0; if (gear > me.gear && load > .3) me.shift = .17; me.gear = gear;
      if (me.shift > 0) { me.shift -= dt; load = 0; }
      const was = me.load; me.load += (load - me.load) * (load > me.load ? .55 : .4);
      // lifting off at high revs: the exhaust crackles (sporty engines only)
      if (E.pops && was > .6 && load < .05 && r > .5 && t > me.popAt) { me.popAt = t + .7; pops(2 + (Math.random() * 3 | 0), .16 * SOUND.engineVol); }
      // a dying engine misses beats
      const hurt = clamp(1 - car.health / (car.stats.health * .45), 0, 1);
      if (hurt > 0 && t > me.missAt) { me.missAt = t + .08 + Math.random() * (.9 - hurt * .7); miss.gain.cancelScheduledValues(t); miss.gain.setValueAtTime(.3, t); miss.gain.setTargetAtTime(1, t + .035, .03); }
      const wobble = hurt > 0 ? 1 + Math.sin(t * 31) * .012 * hurt + (Math.random() - .5) * .03 * hurt : 1;
      me.voice.set(realRpm(E, r) * wobble, me.load, pitch);
      set(engGain.gain, t < me.startAt ? 0 : SOUND.engineVol * (.36 + .3 * me.load + .2 * Math.min(1, r)), .05);
    }
    // tyres on the road, louder and grittier on dirt and sand
    if ((me.surfT -= dt) <= 0) { me.surfT = .2; me.dusty = !car.up && !!DUSTY[surfaceAt(car.x, car.z)]; }
    // ...or, for a boat, the water rushing past the hull
    const roll = kind === 'boat' ? Math.pow(Math.min(1, speed / 26), 1.2) * .3 * SOUND.washVol : flying || kind ? 0 : Math.pow(Math.min(1, speed / 40), 1.3) * (me.dusty ? .34 : .2) * SOUND.tyreVol;
    set(rollG.gain, roll, .08); set(rollF.frequency, kind === 'boat' ? 700 + speed * 55 : (260 + speed * 30) * (me.dusty ? 1.7 : 1), .1);
    const w = Math.min(1.2, speed / 45); set(windG.gain, w * w * (car.stats.rider ? .34 : .17) * SOUND.windVol, .15); set(windF.frequency, 450 + speed * 24, .15);
    const slide = car.sliding && !flying && !kind ? clamp(.35 + car.slip / 9, 0, 1) : 0;
    set(skidG.gain, slide * (me.dusty ? .05 : .2) * SOUND.tyreVol, .05);
    if (slide > 0) { set(sq1.frequency, 1050 + slide * 260 + Math.sin(t * 9.1) * 70, .06); set(sq2.frequency, 1600 + slide * 330 + Math.sin(t * 6.3 + 1) * 110, .06); }
  }

  // ---------- traffic: the few cars most worth hearing each get a voice ----------
  const voices = [];
  for (let i = 0; i < SOUND.traffic; i++) {
    const pan = panner(bus.world), g = gain(0, pan), lp = filt('lowpass', 3000, .5, g), wg = gain(0, pan), wf = filt('bandpass', 700, .5, wg); noise(wf, .8 + i * .07);
    voices.push({ car: null, eng: null, pan, g, lp, wg, wf, freeAt: 0 });
  }
  const picks = [];
  function traffic(game, lx, lz, ly, lvx, lvz, rx, rz, t, mine, live) {
    picks.length = 0;
    if (live) for (const v of game.traffic.vehicles) {
      if (v === mine || !v.driver || v.wrecked || v.gone || v.stats.craft === 'heli') continue;
      const d = Math.hypot(v.x - lx, v.z - lz, (v.y - ly) * 1.5); if (d > SOUND.hearing) continue;
      v._loud = (.3 + Math.min(1, v.speed / 14)) / (1 + (d / 11) * (d / 11)) * (v._voice ? 1.5 : 1);      // whoever already has a voice tends to keep it
      picks.push(v);
    }
    picks.sort((a, b) => b._loud - a._loud); picks.length = Math.min(picks.length, voices.length);
    for (const vo of voices) if (vo.car && !picks.includes(vo.car)) { vo.car._voice = false; vo.car = null; vo.eng?.stop(.25); vo.eng = null; vo.freeAt = t + .3; set(vo.g.gain, 0, .06); set(vo.wg.gain, 0, .06); }
    for (const v of picks) {
      if (v._voice) continue;
      const kind = engineOf(v)[0]; if (!bank[kind]?.ready) { want(kind); continue; }
      const vo = voices.find(o => !o.car && t >= o.freeAt); if (!vo) break;
      vo.car = v; v._voice = true; vo.eng = engineVoice(kind, vo.lp, [1], [1, 2]);
    }
    for (const vo of voices) {
      const v = vo.car; if (!v) continue;
      const dx = v.x - lx, dz = v.z - lz, d = Math.max(.5, Math.hypot(dx, dz, (v.y - ly) * 1.5)), E = vo.eng.E;
      const att = 1.5 / (1 + (d / 11) * (d / 11)) * clamp((SOUND.hearing - d) / 12, 0, 1) * SOUND.trafficVol;
      const away = ((v.vx - lvx) * dx + (v.vz - lvz) * dz) / d, bend = clamp(1 - away / 280, .8, 1.25);      // pitch climbs as it comes at you, drops as it leaves
      const r = clamp((v.rpm - .22) / .78, 0, 1), load = v.braking ? 0 : Math.abs(v.controls.throttle);
      vo.eng.set(realRpm(E, r), 1, engineOf(v)[1] * bend, .06);
      set(vo.g.gain, att * (.3 + .4 * load + .25 * r), .08); set(vo.lp.frequency, clamp((700 + 9000 / (1 + d / 6)) * (.45 + .55 * load), 350, 9000), .1);
      set(vo.pan.pan ?? vo.pan.gain, vo.pan.pan ? clamp((dx * rx + dz * rz) / d, -1, 1) * .85 : 1, .06);
      set(vo.wg.gain, att * Math.pow(Math.min(1, v.speed / 28), 1.6) * .55 * SOUND.tyreVol, .08); set(vo.wf.frequency, (480 + v.speed * 26) * bend, .08);
    }
  }

  // ---------- police siren: a wail that turns into a yelp when it is right on you ----------
  const sirenPan = panner(bus.world), sirenG = gain(0, sirenPan), sirenF = filt('bandpass', 1150, .7, sirenG);
  const so1 = ctx.createOscillator(), so2 = ctx.createOscillator(), lfo = ctx.createOscillator(), lfoG = gain(400), mix2 = gain(.45, sirenF);
  so1.type = 'square'; so2.type = 'sawtooth'; so1.frequency.value = so2.frequency.value = 980; so2.detune.value = 9; lfo.type = 'triangle'; lfo.frequency.value = .3;
  lfo.connect(lfoG); lfoG.connect(so1.frequency); lfoG.connect(so2.frequency); so1.connect(sirenF); so2.connect(mix2); so1.start(); so2.start(); lfo.start();
  function siren(game, lx, lz, rx, rz, live) {
    let best = null, level = 0;
    if (live) for (const u of game.police.units) { if (!u.car.siren) continue; const l = clamp(1 - Math.hypot(u.car.x - lx, u.car.z - lz) / 110, 0, 1); if (l > level) { level = l; best = u.car; } }
    if (live && game.airSea) for (const u of game.airSea.units) { if (!u.v.siren || u.kind !== 'boat') continue; const l = clamp(1 - Math.hypot(u.v.x - lx, u.v.z - lz) / 110, 0, 1); if (l > level) { level = l; best = u.v; } }
    set(sirenG.gain, level * level * .13 * SOUND.sirenVol, .15); set(lfo.frequency, level > .88 ? 3.6 : .3, .3);
    if (best && sirenPan.pan) { const dx = best.x - lx, dz = best.z - lz, d = Math.max(1, Math.hypot(dx, dz)); set(sirenPan.pan, clamp((dx * rx + dz * rz) / d, -1, 1) * .8, .1); }
  }

  const HORNS = { truck: [[155, 185, 233], .6, 1300, 1.2], bike: [[640, 806], .2, 3200, .7], van: [[370, 466], .34, 2200, 1], limo: [[330, 415], .4, 2000, 1], police: [[440, 554], .3, 2600, 1] };
  const ears = { x: 0, z: 0, rx: 1, rz: 0 };

  return {
    bank,
    // call every frame; cheap, and only actually does anything about 30 times a second
    acc: 0,
    update(game, dt) {
      if ((this.acc += dt) < .03) return; const step = this.acc; this.acc = 0;
      const t = now(), p = game.player, live = game.state === 'playing', car = live ? p.vehicle : null, e = game.camera.matrixWorld.elements;
      const rl = Math.hypot(e[0], e[2]) || 1, rx = e[0] / rl, rz = e[2] / rl;
      ears.x = p.x; ears.z = p.z; ears.rx = rx; ears.rz = rz;
      drive(car, step, t);
      traffic(game, p.x, p.z, p.y ?? 0, p.vx ?? 0, p.vz ?? 0, rx, rz, t, car, live);
      siren(game, p.x, p.z, rx, rz, live);
      craft.update(game, car, p.x, p.z, p.y ?? 0, rx, rz, live);
    },
    // turning the key on a parked car: the starter churns, then the engine catches with a little rev
    ignition() {
      const t = now(); me.startAt = t + .42; me.flare = .5;
      for (let i = 0; i < 6; i++) {
        const at = t + i * .07, s = ctx.createBufferSource(), f = filt('bandpass', 420 + i * 45, 2.5), g = gain(0, bus.dry);
        s.buffer = bus.noise; s.connect(f); f.connect(g); g.gain.setValueAtTime(.001, at); g.gain.linearRampToValueAtTime(.3, at + .015); g.gain.exponentialRampToValueAtTime(.001, at + .065); s.start(at, Math.random()); s.stop(at + .08);
        const o = ctx.createOscillator(), og = gain(0, bus.dry); o.type = 'sawtooth'; o.frequency.setValueAtTime(62 + i * 5, at); og.gain.setValueAtTime(.12, at); og.gain.exponentialRampToValueAtTime(.001, at + .06); o.connect(og); o.start(at); o.stop(at + .07);
      }
    },
    // each kind of vehicle has its own horn; other drivers' horns come from where they are
    horn(car, mine) {
      const dx = car.x - ears.x, dz = car.z - ears.z, d = Math.hypot(dx, dz); if (!mine && d > 60) return;
      const [notes, dur, cut, vol] = HORNS[car.type] ?? [[415, 523], .32, 2500, 1], t = now(), v = (mine ? .2 : .26 / (1 + (d / 14) * (d / 14))) * vol;
      const pan = panner(mine ? bus.dry : bus.world), g = gain(0, pan), f = filt('lowpass', cut, 1.2, g);
      if (pan.pan && !mine && d > 1) pan.pan.value = clamp((dx * ears.rx + dz * ears.rz) / d, -1, 1) * .8;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .012); g.gain.setValueAtTime(v, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + .05);
      for (const hz of notes) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz * (1 + (Math.random() - .5) * .006); o.connect(f); o.start(t); o.stop(t + dur + .08); }
      setTimeout(() => pan.disconnect(), (dur + .3) * 1000);
    },
  };
}
