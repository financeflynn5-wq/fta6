// All sound is synthesised with WebAudio, so the game ships with zero audio files.
import { clamp } from './utils.js';

export function createAudio() {
  let ctx = null, master, engine, skid, siren, noiseBuf, muted = false;

  function start() {
    if (ctx) { ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = .5;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // engine: two detuned saws + a sub, through a low-pass that opens with throttle
    const eg = ctx.createGain(); eg.gain.value = 0;
    const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 400; ef.Q.value = 1.5;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.detune.value = 14;
    const o3 = ctx.createOscillator(); o3.type = 'square'; const sub = ctx.createGain(); sub.gain.value = .5;
    o1.connect(ef); o2.connect(ef); o3.connect(sub); sub.connect(ef); ef.connect(eg); eg.connect(master);
    o1.start(); o2.start(); o3.start();
    engine = { gain: eg, filter: ef, osc: [o1, o2, o3] };

    // tyre squeal: band-passed noise
    const sn = ctx.createBufferSource(); sn.buffer = noiseBuf; sn.loop = true;
    const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1500; sf.Q.value = 3.5;
    const sg = ctx.createGain(); sg.gain.value = 0; sn.connect(sf); sf.connect(sg); sg.connect(master); sn.start();
    skid = { gain: sg, filter: sf };

    // siren: a wailing square
    const so = ctx.createOscillator(); so.type = 'square'; so.frequency.value = 700;
    const lfo = ctx.createOscillator(); lfo.frequency.value = .9; const lg = ctx.createGain(); lg.gain.value = 260;
    lfo.connect(lg); lg.connect(so.frequency);
    const sf2 = ctx.createBiquadFilter(); sf2.type = 'lowpass'; sf2.frequency.value = 1800;
    const sg2 = ctx.createGain(); sg2.gain.value = 0; so.connect(sf2); sf2.connect(sg2); sg2.connect(master); so.start(); lfo.start();
    siren = { gain: sg2 };
  }

  const now = () => ctx.currentTime;
  function tone(type, f0, f1, dur, vol, delay = 0) {
    if (!ctx) return; const t = now() + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
  }
  function burst(dur, vol, freq, type = 'lowpass', q = 1) {
    if (!ctx) return; const t = now(), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.playbackRate.value = .6 + Math.random() * .8; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + .02);
  }

  return {
    start,
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : .5; return muted; },
    suspend() { ctx?.suspend(); }, resume() { ctx?.resume(); },
    // rpm 0..1, load 0..1; on=false silences the engine (on foot)
    engine(on, rpm, load) {
      if (!ctx) return; const t = now(), f = 42 + rpm * 118;
      engine.osc[0].frequency.setTargetAtTime(f, t, .03); engine.osc[1].frequency.setTargetAtTime(f * 1.005, t, .03); engine.osc[2].frequency.setTargetAtTime(f * .5, t, .03);
      engine.filter.frequency.setTargetAtTime(260 + rpm * 900 + load * 900, t, .05);
      engine.gain.gain.setTargetAtTime(on ? .1 + load * .1 + rpm * .05 : 0, t, .06);
    },
    skid(amount) { if (!ctx) return; skid.gain.gain.setTargetAtTime(clamp(amount, 0, 1) * .22, now(), .05); skid.filter.frequency.setTargetAtTime(1300 + amount * 700, now(), .1); },
    siren(vol) { if (!ctx) return; siren.gain.gain.setTargetAtTime(clamp(vol, 0, 1) * .085, now(), .15); },
    crash(power) { const p = clamp(power, 0, 1); burst(.25 + p * .35, .25 + p * .6, 500 + p * 900); tone('sine', 110, 38, .22, .3 + p * .5); if (p > .5) burst(.5, .25, 3500, 'highpass'); },
    bonk() { tone('sine', 520, 130, .22, .4); tone('triangle', 260, 90, .25, .25, .03); },                    // critter gets bumped
    clank() { for (const f of [820, 1240, 1710, 2330]) tone('square', f * (.95 + Math.random() * .1), f * .8, .16 + Math.random() * .12, .07); burst(.12, .25, 4000, 'highpass'); },
    door() { burst(.09, .5, 700); tone('sine', 150, 70, .1, .35); },
    horn() { tone('square', 415, 410, .32, .12); tone('square', 523, 518, .32, .12); },
    alarm() { for (let i = 0; i < 6; i++) tone('square', i % 2 ? 880 : 1175, i % 2 ? 880 : 1175, .13, .08, i * .15); },
    star() { tone('sawtooth', 660, 990, .12, .14); tone('sawtooth', 990, 1480, .16, .14, .11); },
    cash() { tone('triangle', 1318, 1318, .09, .22); tone('triangle', 1760, 1760, .22, .22, .08); },
    evade() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, .16, .2, i * .09)); },
    busted() { [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * .97, .26, .16, i * .2)); },
    step() { burst(.04, .05, 900 + Math.random() * 500, 'bandpass', 2); },
  };
}
