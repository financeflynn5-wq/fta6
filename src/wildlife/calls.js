// The noises animals make, built from plain tones and hiss like the rest of the game's sound effects.
// Each call takes how loud it should be (0..1); near(x, z, range) turns a distance from you into that.
export function createCalls(game) {
  const A = game.audio; let buf = null;
  const noiseBuf = (ctx) => { if (buf) return buf; buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return buf; };
  function tone(type, f0, f1, dur, vol, delay = 0, wobble = 0) {
    const ctx = A.ctx; if (!ctx || vol < .004) return; const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(.05, dur * .2)); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    if (wobble) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = wobble; lg.gain.value = f0 * .09; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + .02); }      // a rattle in the throat
    o.connect(g); g.connect(A.out); o.start(t); o.stop(t + dur + .02);
  }
  function hiss(dur, vol, f0, f1 = f0, type = 'lowpass', q = 1, delay = 0) {
    const ctx = A.ctx; if (!ctx || vol < .004) return; const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf(ctx); s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(A.out); s.start(t, Math.random() * .5); s.stop(t + dur + .02);
  }
  const p = game.player;
  return {
    near: (x, z, range = 70) => Math.max(0, 1 - Math.hypot(x - p.x, z - p.z) / range) ** 1.5,
    // two low notes, getting closer together: something has noticed you
    sting(v = 1) { [0, .42, .78, 1.08, 1.32, 1.5].forEach((d, i) => tone('sawtooth', i % 2 ? 87 : 73, i % 2 ? 85 : 72, .26, .16 * v, d)); },
    chomp(v = 1) { hiss(.16, .6 * v, 2600, 500, 'bandpass', 1.2); tone('sine', 150, 48, .2, .6 * v); hiss(.3, .3 * v, 900, 200, 'lowpass', 1, .05); },
    splash(v = 1) { hiss(.5, .4 * v, 2400, 500, 'lowpass'); hiss(.25, .25 * v, 5200, 2500, 'highpass'); },
    thump(v = 1) { tone('sine', 110, 40, .28, .7 * v); hiss(.12, .35 * v, 500, 200); },
    roar(v = 1) { tone('sawtooth', 132, 62, 1.15, .28 * v, 0, 31); tone('sawtooth', 198, 88, 1, .12 * v, .03, 27); hiss(1.1, .3 * v, 900, 260, 'bandpass', .8); },
    growl(v = 1) { tone('sawtooth', 96, 64, .7, .22 * v, 0, 24); hiss(.7, .2 * v, 600, 220, 'bandpass', .8); },
    trumpet(v = 1) { tone('sawtooth', 420, 760, .32, .2 * v, 0, 44); tone('sawtooth', 760, 520, .62, .22 * v, .3, 38); tone('square', 840, 1050, .5, .05 * v, .12, 50); hiss(.9, .12 * v, 2200, 1200, 'bandpass', 2); },
    grunt(v = 1) { [0, .2, .38].forEach(d => tone('sawtooth', 78, 52, .16, .26 * v, d, 18)); },
    chest(v = 1) { for (let i = 0; i < 9; i++) { tone('sine', 150 - (i % 2) * 28, 70, .07, .4 * v, i * .085); hiss(.04, .12 * v, 700, 300, 'lowpass', 1, i * .085); } },
    hoot(v = 1) { [0, .16, .32].forEach((d, i) => tone('triangle', 300 + i * 60, 380 + i * 80, .12, .2 * v, d)); },
    bray(v = 1) { [0, .2, .4, .58].forEach((d, i) => tone('sawtooth', i % 2 ? 420 : 640, i % 2 ? 300 : 520, .17, .12 * v, d, 30)); },
    squawk(v = 1) { tone('square', 620, 480, .12, .07 * v, 0, 60); tone('square', 700, 520, .14, .07 * v, .15, 60); },
    hooves(v = 1) { for (let i = 0; i < 4; i++) hiss(.05, .25 * v, 420, 200, 'lowpass', 1, i * .09 + (i > 1 ? .04 : 0)); },
    gate(v = 1) { tone('square', 240, 180, .05, .18 * v); hiss(.5, .2 * v, 1800, 700, 'bandpass', 4, .05); tone('sine', 90, 60, .18, .4 * v, .5); },
  };
}
