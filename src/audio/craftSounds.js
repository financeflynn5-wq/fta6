// What a helicopter sounds like: the blades beating the air (a deep thump you feel, and the slap on top of
// it), the turbine's whine and its hiss. Two voices: the one you are flying, and the loudest other one around
// (a police helicopter overhead), placed left or right of you and fading with distance.
// Boats use the cars' engine loops (SOUND.engine in config.js) and the water rushing past (carSounds.js).
import { SOUND } from '../config.js';
import { clamp } from '../core/utils.js';

export function createCraftSounds(ctx, bus) {
  const now = () => ctx.currentTime;
  const gain = (v, to) => { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
  const filt = (type, hz, q, to) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.Q.value = q; if (to) f.connect(to); return f; };
  const noise = (to, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = bus.noise; s.loop = true; s.playbackRate.value = rate; s.connect(to); s.start(0, Math.random() * 1.5); return s; };
  const set = (param, v, tc = .06) => param.setTargetAtTime(v, now(), tc);

  function voice(to) {
    const out = gain(0, to);
    // the beat: low noise and a sub tone, both switched on and off by the blades going past
    const chopG = gain(0, out), thump = filt('lowpass', 150, .8, chopG), slapG = gain(0, out), slap = filt('bandpass', 760, .8, slapG);
    noise(thump, .5); noise(slap, .9);
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 58; const subG = gain(0, out); sub.connect(subG); sub.start();
    const beat = ctx.createOscillator(); beat.type = 'sawtooth'; beat.frequency.value = 12;
    const shape = ctx.createWaveShaper(), curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 255; curve[i] = Math.pow(x, 3.2); } shape.curve = curve;      // a sharp pulse once per blade
    beat.connect(shape); const d1 = gain(2.6, chopG.gain), d2 = gain(.9, slapG.gain), d3 = gain(.5, subG.gain); shape.connect(d1); shape.connect(d2); shape.connect(d3); beat.start();
    // the turbine
    const whine = ctx.createOscillator(); whine.type = 'sawtooth'; whine.frequency.value = 300; const whineG = gain(0, out), whineF = filt('bandpass', 900, 3, whineG); whine.connect(whineF); whine.start();
    const hissG = gain(0, out), hiss = filt('bandpass', 4200, .9, hissG); noise(hiss, 1.3);
    return {
      out,
      // r: rotor speed 0..1, vol: 0..1, blades: how many, load: working hard (climbing, flat out)
      set(r, vol, blades = 4, load = 0) {
        const t = now();
        out.gain.setTargetAtTime(vol * Math.min(1, r * 1.6), t, .08);
        beat.frequency.setTargetAtTime(Math.max(.5, r * (blades > 2 ? 15.5 : 10.5)), t, .1);
        sub.frequency.setTargetAtTime(46 + r * 20, t, .1); thump.frequency.setTargetAtTime(110 + r * 70 + load * 40, t, .1); slap.frequency.setTargetAtTime(560 + r * 300 + load * 160, t, .1);
        d2.gain.setTargetAtTime(.9 + load * .8, t, .15);
        whine.frequency.setTargetAtTime(180 + r * 560, t, .12); whineF.frequency.setTargetAtTime(500 + r * 1500, t, .12); whineG.gain.setTargetAtTime(.03 + r * .06, t, .1);
        hissG.gain.setTargetAtTime(r * r * .09, t, .1);
      },
    };
  }

  const mine = voice(bus.dry);
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : gain(1); pan.connect(bus.world);
  const other = voice(pan);

  return {
    update(game, car, lx, lz, ly, rx, rz, live) {
      const hel = live && car && car.stats.craft === 'heli' ? car : null;
      mine.set(hel ? hel.rotor : 0, hel ? .8 * SOUND.rotorVol : 0, hel?.mesh.userData.rotorR > 5.5 ? 2 : 4, hel ? clamp(Math.abs(hel.vf) / hel.stats.maxSpeed * .7 + Math.max(0, hel.vy || 0) / 14, 0, 1) : 0);
      let best = null, loud = 0, bd = 0;
      if (live) for (const v of game.traffic.vehicles) {
        if (v === car || v.stats.craft !== 'heli' || !(v.rotor > .05) || v.gone) continue;
        const d = Math.hypot(v.x - lx, v.z - lz, v.y - ly), l = v.rotor / (1 + (d / 55) * (d / 55));
        if (l > loud) { loud = l; best = v; bd = d; }
      }
      other.set(best ? best.rotor : 0, best ? clamp(loud, 0, 1) * .7 * SOUND.rotorVol * clamp((420 - bd) / 80, 0, 1) : 0, best?.mesh.userData.rotorR > 5.5 ? 2 : 4, .4);
      if (best && pan.pan) { const dx = best.x - lx, dz = best.z - lz, d = Math.max(1, Math.hypot(dx, dz)); set(pan.pan, clamp((dx * rx + dz * rz) / d, -1, 1) * .8, .1); }
    },
  };
}
