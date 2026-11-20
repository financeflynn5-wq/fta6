// All sound is synthesised with WebAudio, so the game ships with zero audio files.
// This file owns the mixer and the one-shot sounds (crashes, doors, guns, jingles).
// Everything a vehicle sounds like while it runs lives in audio/carSounds.js.
import { clamp } from './utils.js';
import { SOUND } from '../config.js';
import { createCarSounds } from '../audio/carSounds.js';

export function createAudio() {
  let ctx = null, master, world, worldLP, cars, noiseBuf, muted = false;

  function start() {
    if (ctx) { ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = SOUND.master;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // the street: everything out in the world goes through here, picks up a little echo off the
    // buildings, and is muffled when you are inside a shop
    world = ctx.createGain(); worldLP = ctx.createBiquadFilter(); worldLP.type = 'lowpass'; worldLP.frequency.value = 18000; world.connect(worldLP); worldLP.connect(master);
    const len = Math.floor(ctx.sampleRate * 1.3), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const x = ir.getChannelData(c); let lp = 0;
      for (let i = Math.floor(ctx.sampleRate * .008); i < len; i++) { const t = i / ctx.sampleRate; lp += ((Math.random() * 2 - 1) - lp) * Math.max(.06, .7 - t * .9); x[i] = lp * Math.exp(-t / .26); }
    }
    const verb = ctx.createConvolver(); verb.buffer = ir; const send = ctx.createGain(); send.gain.value = SOUND.reverb;
    worldLP.connect(send); send.connect(verb); verb.connect(master);

    cars = createCarSounds(ctx, { dry: master, world, noise: noiseBuf });
  }

  const now = () => ctx.currentTime;
  // to: where it plays. Left out, it goes straight to the speakers (menus, pickups, your own gun); pass `world` for things out in the street.
  function tone(type, f0, f1, dur, vol, delay = 0, to = master) {
    if (!ctx) return; const t = now() + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(to); o.start(t); o.stop(t + dur + .02);
  }
  function burst(dur, vol, freq, type = 'lowpass', q = 1, to = master, delay = 0) {
    if (!ctx) return; const t = now() + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.playbackRate.value = .6 + Math.random() * .8; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(to); s.start(t, Math.random()); s.stop(t + dur + .02);
  }

  return {
    start,
    get ctx() { return ctx; }, get out() { return master; },      // for tests and tools
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : SOUND.master; return muted; },
    suspend() { ctx?.suspend(); }, resume() { ctx?.resume(); },
    // once a frame: engine, tyres, wind, the traffic around you and sirens
    drive(game, dt) {
      if (!ctx) return;
      worldLP.frequency.setTargetAtTime(game.indoors?.room ? 750 : 18000, now(), .12);      // inside a shop the street is muffled
      cars.update(game, dt);
    },
    ignition() { if (ctx) cars.ignition(); },
    engine() { }, skid() { }, siren() { },      // old names: drive() does all three now
    // metal on something solid: a thud, a crunch, panels ringing, and bits raining down after a big one
    crash(power) {
      if (!ctx) return; const p = clamp(power, 0, 1);
      tone('sine', 105, 36, .2 + p * .15, .3 + p * .5, 0, world);
      burst(.16 + p * .3, .3 + p * .5, 900 + p * 2200, 'lowpass', .8, world);
      if (p > .2) for (let i = 0, n = 2 + p * 3; i < n; i++) burst(.1 + Math.random() * .22, .5 * p, 260 + Math.random() * 1100, 'bandpass', 16, world, i * .025 + Math.random() * .05);
      if (p > .5) burst(.45, .22 * p, 3600, 'highpass', .7, world);
    },
    // a window or a lamp going: bright tinkle. vol 0..1 fades with distance
    glass(vol = 1) { if (vol < .03) return; burst(.22, .3 * vol, 5200, 'highpass', 1, world); for (let i = 0; i < 5; i++) tone('triangle', 2600 + Math.random() * 3800, 1800 + Math.random() * 1500, .05 + Math.random() * .09, .05 * vol, i * .035 + Math.random() * .03, world); },
    bonk() { tone('sine', 520, 130, .22, .4); tone('triangle', 260, 90, .25, .25, .03); },                    // critter gets bumped
    clank() { for (const f of [820, 1240, 1710, 2330]) tone('square', f * (.95 + Math.random() * .1), f * .8, .16 + Math.random() * .12, .07); burst(.12, .25, 4000, 'highpass'); },
    door() { burst(.012, .3, 2600, 'bandpass', 3); burst(.085, .5, 420, 'lowpass', 1, master, .014); tone('sine', 128, 60, .11, .4, .014); },      // latch, then the thunk
    // car: whose horn (each kind of vehicle has its own); mine: it is the one you are driving
    horn(car, mine = false) { if (ctx && car) cars.horn(car, mine); },
    alarm() { for (let i = 0; i < 6; i++) tone('square', i % 2 ? 880 : 1175, i % 2 ? 880 : 1175, .13, .08, i * .15, world); },
    star() { tone('sawtooth', 660, 990, .12, .14); tone('sawtooth', 990, 1480, .16, .14, .11); },
    cash() { tone('triangle', 1318, 1318, .09, .22); tone('triangle', 1760, 1760, .22, .22, .08); },
    evade() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, .16, .2, i * .09)); },
    busted() { [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * .97, .26, .16, i * .2)); },
    step() { burst(.04, .05, 900 + Math.random() * 500, 'bandpass', 2); },
    // ---------- weapons ----------
    // vol 0..1 fades shots with distance; loud is the weapon's punch (sniper > shotgun > pistol > SMG)
    shot(loud = 1, vol = 1) {
      const v = clamp(vol, 0, 1) * Math.min(1.3, loud); if (v < .02) return;
      burst(.07 + loud * .08, .55 * v, 3200 - loud * 900);               // crack
      burst(.18 + loud * .2, .35 * v, 700, 'lowpass');                     // body
      tone('square', 160 + 60 / loud, 40, .06 + loud * .05, .22 * v);      // thump
      if (loud > 1.4) tone('sine', 70, 30, .35, .35 * v);                  // big ones boom
    },
    punch() { tone('sine', 170, 55, .11, .5); burst(.06, .45, 1100); },
    thud(vol = 1) { if (vol < .05) return; tone('sine', 120, 42, .14, .5 * vol, 0, world); burst(.07, .3 * vol, 500, 'lowpass', 1, world); },      // a body landing
    slash() { burst(.09, .2, 3800, 'bandpass', 2.5); tone('triangle', 1900, 700, .07, .05); },                                                  // a blade through the air
    stab() { burst(.05, .4, 1800, 'bandpass', 1.4); tone('sine', 210, 70, .09, .35); },
    block() { tone('sine', 240, 120, .07, .3); burst(.04, .3, 700, 'lowpass'); },                                                               // a punch caught on the forearms
    bottle() { for (let i = 0; i < 3; i++) tone('triangle', 2200 + Math.random() * 2600, 1500, .05 + Math.random() * .06, .05, i * .03, world); burst(.1, .15, 4800, 'highpass', 1, world); },
    grunt(vol = 1) { if (vol < .05) return; tone('sawtooth', 150 + Math.random() * 60, 90, .16, .1 * vol, 0, world); },
    whoosh() { burst(.13, .12, 1600, 'bandpass', 1.2); },
    oof() { tone('triangle', 330 + Math.random() * 90, 140, .16, .22); },
    ting() { tone('triangle', 2400 + Math.random() * 800, 1700, .12, .06); burst(.04, .2, 5000, 'highpass'); },
    click() { tone('square', 2200, 1800, .025, .08); },
    reload() { tone('square', 900, 700, .03, .09); tone('square', 600, 500, .04, .1, .35); burst(.05, .2, 2500, 'bandpass', 3); },
    pickup() { tone('triangle', 880, 880, .07, .18); tone('triangle', 1320, 1320, .12, .18, .06); },
    equip() { burst(.05, .18, 3000, 'bandpass', 2); tone('square', 700, 600, .03, .07, .05); },
    hitmark() { tone('square', 2600, 2600, .03, .05); },
    pager() { tone('square', 1568, 1568, .07, .08); tone('square', 2093, 2093, .1, .08, .1); tone('square', 1568, 1568, .07, .08, .24); tone('square', 2093, 2093, .1, .08, .34); },
    wrench() { for (let i = 0; i < 5; i++) { tone('square', 900 + Math.random() * 1400, 500, .05, .06, i * .09); } burst(.3, .2, 2600, 'bandpass', 2); },
    wasted() { [330, 262, 196, 131].forEach((f, i) => tone('triangle', f, f * .96, .4, .2, i * .28)); },
  };
}
