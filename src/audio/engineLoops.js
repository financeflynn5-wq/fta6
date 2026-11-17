// Engine recordings, made from nothing. A real engine note is a row of exhaust bangs, one per cylinder
// firing, ringing through the exhaust pipe and the body of the car, with a rasp of combustion noise on
// top. This file builds short loops of exactly that at a few fixed engine speeds, on and off the
// throttle; audio/carSounds.js plays them back, speeding them up and blending between them as the revs
// change. Pure maths: no WebAudio in here, so the loops can be made (and checked) anywhere.

// cyl: cylinders          idle / redline: rpm          refs: the engine speeds loops are made at
// amps: how hard each cylinder bangs in turn (uneven = lumpy)   offs: firing moved early / late, in cycles
// pipe: exhaust length as an echo time (ms)   body: resonances [Hz, sharpness, level off throttle, level on]
// rasp / intake / clatter: noise layers       bright: how much treble opens up on the throttle
export const ENGINES = {
  // everyday four-cylinder: smooth, a bit buzzy at the top
  i4: {
    cyl: 4, idle: 850, redline: 6200, refs: [900, 1900, 3400, 5600], amps: [1, .84, .95, .8], lump: .1, pipe: 5.4,
    body: [[92, 2.2, .8, .7], [215, 2.5, .8, .9], [460, 2.2, .6, .8], [980, 1.8, .3, .55]], rasp: .34, raspHz: 2100, intake: .3, bright: 1, pops: 0,
  },
  // big V8: uneven bangs from each bank give it the burble
  v8: {
    cyl: 8, idle: 700, redline: 6000, refs: [760, 1600, 3000, 5200], amps: [1, .52, .92, 1, .56, .96, .6, .64], offs: [0, .006, 0, -.004, .005, 0, -.006, .004], lump: .13, pipe: 7.2,
    body: [[68, 2.4, .9, .8], [142, 2.6, .9, .9], [300, 2.2, .7, .85], [640, 1.8, .4, .6], [1500, 1.5, .12, .3]], rasp: .5, raspHz: 1700, intake: .36, bright: 1.15, pops: 1,
  },
  // diesel six: slow, heavy, with the clatter
  diesel: {
    cyl: 6, idle: 620, redline: 3300, refs: [650, 1150, 1900, 2900], amps: [1, .88, .94, .82, .97, .86], lump: .08, pipe: 9,
    body: [[58, 2.6, .9, .9], [118, 2.4, .9, .9], [260, 2, .7, .75], [520, 1.6, .4, .5], [1100, 1.5, .15, .25]], rasp: .22, raspHz: 1300, intake: .45, clatter: .5, bright: .7, pops: 0,
  },
  // motorbike twin: the two bangs come close together, then a gap
  bike: {
    cyl: 2, idle: 1250, redline: 9600, refs: [1300, 2900, 5200, 8200], amps: [1, .82], offs: [0, -.125], lump: .12, pipe: 3.4,
    body: [[130, 2.2, .8, .7], [290, 2.4, .85, .9], [610, 2.2, .6, .85], [1350, 1.8, .3, .6]], rasp: .5, raspHz: 2400, intake: .22, bright: 1.3, pops: 1,
  },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function rng(a) { return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// A filter run twice round the loop (the first lap only settles it), so the end joins the start with no click.
// kind: 0 low-pass, 1 high-pass, 2 band-pass. Adds gain * filtered(x) into out (or returns a fresh array).
function filter(x, sr, kind, hz, q, gain = 1, out = null) {
  const n = x.length, w = 2 * Math.PI * Math.min(hz, sr * .45) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
  let b0, b1, b2;
  if (kind === 0) { b1 = 1 - cs; b0 = b2 = b1 / 2; } else if (kind === 1) { b1 = -(1 + cs); b0 = b2 = (1 + cs) / 2; } else { b0 = al; b1 = 0; b2 = -al; }
  b0 /= a0; b1 /= a0; b2 /= a0; const a1 = -2 * cs / a0, a2 = (1 - al) / a0;
  const y = out || new Float32Array(n); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let lap = 0; lap < 2; lap++) for (let i = 0; i < n; i++) {
    const xi = x[i], yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = yi; if (lap) y[i] += gain * yi;
  }
  return y;
}

// One loop. Returns { data, rpm }: rpm is the exact engine speed the loop holds once rounded to whole samples.
export function makeLoop(E, rpm, load, sr = 32000, seconds = .8) {
  const fc = rpm / 120;                                   // engine cycles (two turns of the crank) a second
  const cycles = Math.max(3, Math.round(fc * seconds)), n = Math.round(cycles * sr / fc), per = n / cycles, gap = per / E.cyl;
  const rnd = rng(977 + Math.round(rpm) * 13 + (load ? 50021 : 0)), low = rpm < E.refs[1];
  const exc = new Float32Array(n), env = new Float32Array(n), tick = new Float32Array(n);
  const lump = (E.lump ?? .1) * (load ? .55 : 1) * (low ? 1.7 : 1);
  const rise = clamp(gap * .02, sr * .00025, sr * .0011) * (load ? .7 : 1.1);         // how sharp each bang is
  const ring = gap * (load ? .5 : .3), E1 = Math.E;

  // ---------- the bangs ----------
  for (let c = 0; c < cycles; c++) for (let k = 0; k < E.cyl; k++) {
    const at = (c + k / E.cyl + (E.offs?.[k] ?? 0)) * per + (rnd() - .5) * gap * .04;
    const amp = E.amps[k % E.amps.length] * (1 + (rnd() - .5) * 2 * lump), i0 = Math.floor(at), fr = at - i0;
    // a quick push of pressure, then a slower, shallower pull that cancels it (so nothing drifts)
    for (let j = 0, L = Math.ceil(rise * 30); j < L; j++) {
      const t = (j - fr) / rise; if (t < 0) continue;
      exc[((i0 + j) % n + n) % n] += amp * (t * Math.exp(1 - t) - t / 9 * Math.exp(1 - t / 3));
    }
    for (let j = 0, L = Math.ceil(ring * 6); j < L; j++) env[((i0 + j) % n + n) % n] += amp * Math.exp(-j / ring);
    if (E.clatter) for (let j = 0, L = Math.ceil(sr * .006); j < L; j++) tick[((i0 + j) % n + n) % n] += amp * Math.exp(-j / (sr * .0011));
  }

  // ---------- the exhaust pipe: each bang echoes back down it, upside down ----------
  const pipe = new Float32Array(n), D = Math.max(2, Math.round(E.pipe / 1000 * sr)), g = load ? -.5 : -.6;
  { let lp = 0; for (let lap = 0; lap < 2; lap++) for (let i = 0; i < n; i++) { lp += (pipe[(i - D + n * 4) % n] - lp) * .5; pipe[i] = exc[i] + g * lp; } }

  // ---------- the body of the car ----------
  const mix = new Float32Array(n);
  for (const [hz, q, off, on] of E.body) filter(pipe, sr, 2, hz, q, (load ? on : off) * q * .9, mix);
  filter(pipe, sr, 0, 240, .7, .5, mix);
  filter(pipe, sr, 1, 420, .7, load ? 1.1 : .3, mix);          // the raw bark of the bangs themselves, mostly on the throttle

  // ---------- noise: combustion rasp, intake rush, diesel clatter ----------
  let peak = 1e-9; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(mix[i])); for (let i = 0; i < n; i++) mix[i] /= peak;
  let ep = 1e-9; for (let i = 0; i < n; i++) ep = Math.max(ep, env[i]);
  const nz = new Float32Array(n), nz2 = new Float32Array(n), nz3 = new Float32Array(n);
  for (let i = 0; i < n; i++) { const w = rnd() * 2 - 1, e = env[i] / ep; nz[i] = w * e * Math.sqrt(e); nz2[i] = (rnd() * 2 - 1) * (.35 + .65 * e); nz3[i] = (rnd() * 2 - 1) * tick[i]; }
  filter(nz, sr, 2, E.raspHz * (load ? 1 : .7), .8, E.rasp * (load ? 2.6 : .7), mix);
  filter(nz2, sr, 0, load ? 900 : 500, .7, E.intake * (load ? .5 : .25), mix);
  if (E.clatter) { filter(nz3, sr, 2, 1900, 3, E.clatter * (load ? 1.6 : 2.2), mix); filter(nz3, sr, 2, 3400, 4, E.clatter * (load ? 1 : 1.3), mix); }

  // ---------- grit, then tone: muffled off the throttle, open on it ----------
  const drive = load ? 2.4 : 1.2, sat = new Float32Array(n);
  for (let i = 0; i < n; i++) sat[i] = Math.tanh(mix[i] * drive);
  const top = load ? Math.min(7500, (2400 + rpm * .75) * E.bright) : (1000 + rpm * .4) * E.bright;
  const out = filter(filter(sat, sr, 0, top, .75), sr, 1, 28, .7);
  let sum = 0; for (let i = 0; i < n; i++) sum += out[i] * out[i];
  let k = .2 / Math.sqrt(sum / n + 1e-12), pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(out[i]) * k);
  if (pk > .97) k *= .97 / pk;
  for (let i = 0; i < n; i++) out[i] *= k;
  return { data: out, rpm: cycles * sr / n * 120 };
}
