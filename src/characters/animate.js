// How everybody moves. One function poses a whole character each frame from a few facts (how fast they
// are going and what they are doing), in two layers:
//   the big shapes   shoulders, hips and the body's tilt: the walk and run cycle, panic, falling, lying down and
//                    getting up. Other systems lay their own arm and leg poses over these (a gun held up, a punch).
//   the follow-through   knees, elbows, feet, the twist of the chest against the hips, the lean into a turn,
//                    where the head and eyes look, blinking, tails and antennas. These read whatever the big
//                    shapes ended up as, so they keep working when another system has taken the arms over.
import * as THREE from 'three';
import { JOINT } from './rig.js';

const HALF = Math.PI / 2, MID = .95, HIP = .21, LEG = .74;      // MID: height of the middle of a standing body, which is what a tumble turns about
const WAIST = .92, L1 = JOINT.knee, L2 = JOINT.ankle, STAND = L1 + L2;
const LID_SHUT = 2.15;                                           // how far the eyelids swing to close
const ease = (k) => k * k * (3 - 2 * k), turn = (to, from) => { let d = (to - from) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; return d; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, sw = (x) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const _v = new THREE.Vector3();
export const tumbleEase = ease;

function begin(c) {
  const u = c.userData;
  return u.anim = {
    gait: 0, spd: 0, flail: 0, free: 1, shut: 0,
    ax: [u.arms[0].rotation.x, u.arms[1].rotation.x], az: [u.arms[0].rotation.z, u.arms[1].rotation.z], lx: [u.legs[0].rotation.x, u.legs[1].rotation.x],
    held: [-1, -1], legHeld: [-1, -1], eb: [.16, .16], kb: [0, 0],
    yaw: null, lastYaw: c.rotation.y, yr: 0, look: 0, lookTo: 0, lookT: Math.random() * 3,
    blinkT: .5 + Math.random() * 4, blink: 0, px: 0, py: 0, pvx: 0, pvy: 0, step: 0, ar: 0, av: 0, br: 0, bv: 0, pose: '',
  };
}

// pose: 'move' (walk/run by speed), 'stand', 'flail' (panic run), 'down' (knocked flat), plus how people get knocked flat and up again:
//   'fly'   thrown through the air, going head over heels: userData.flip is how far round they are (radians, + = forwards)
//   'down'  lying where they landed: on their back, or on their front when userData.prone is set
//   'up'    getting back to their feet: userData.rise runs 0..1 (sit up and stand from the back, a push-up from the front)
//   'sky' / 'dive' / 'chute'   falling flat, falling head first, hanging under a parachute
// A stagger (reelCharacter) is laid over whatever pose they are in.
// Things a caller can leave on userData: gaze + gazeT (look that way, radians off straight ahead, for gazeT seconds),
// smoothYaw (turn the body toward its heading at this rate instead of snapping). An arm or leg posed by someone else
// may carry userData.bend: how far its elbow or knee should fold (radians); without it the limb is held straight.
export function animateCharacter(c, t, dt, speed, pose = 'move', alert = false) {
  const u = c.userData, a = u.anim || begin(c);
  const A = u.arms, L = u.legs, K = u.knees, F = u.feet, E = u.elbows, ch = u.chest;
  const air = pose === 'sky' || pose === 'dive' ? 1 : 0, hang = pose === 'chute';
  const floored = pose === 'down' || pose === 'fly' || pose === 'up';
  const moving = pose !== 'stand' && !floored && !air && !hang && speed > .3;
  const h = Math.min(dt, 1 / 30);

  // has anybody posed the arms or legs since we last did? (holding a gun up, a punch, sitting down: they run after us)
  for (let i = 0; i < 2; i++) {
    const r = A[i].rotation, lr = L[i].rotation;
    a.held[i] = Math.abs(r.x - a.ax[i]) > 1e-5 || Math.abs(r.z - a.az[i]) > 1e-5 ? (A[i].userData.bend ?? 0) : -1;
    a.legHeld[i] = Math.abs(lr.x - a.lx[i]) > 1e-5 ? (L[i].userData.bend ?? 0) : -1;
    A[i].userData.bend = L[i].userData.bend = undefined;
  }
  const armsFree = a.held[0] < 0 && a.held[1] < 0;
  a.free += ((armsFree ? 1 : 0) - a.free) * Math.min(1, dt * 10);

  // ---------- the stride ----------
  a.gait += ((moving ? 1 : 0) - a.gait) * Math.min(1, dt * 9);           // eases in and out, so nobody snaps to attention when they stop
  if (moving) a.spd += (speed - a.spd) * Math.min(1, dt * 7);
  a.flail += ((pose === 'flail' ? 1 : 0) - a.flail) * Math.min(1, dt * 10);
  if (moving) u.phase += dt * (3.2 + speed * 1.55);
  const ph = u.phase, stiff = u.bot ? .78 : 1, run = sw((a.spd - 3.4) / 3.4) * a.gait;
  const amp = a.gait * Math.min(.8, .4 + a.spd * .075) * stiff;
  const s0 = Math.sin(ph), c0 = Math.cos(ph + .3);
  // hips: + is the leg going back. The leg coming forward folds at the knee to clear the ground; a runner lifts the knees in front.
  const hipR = (s0 - run * .3) * amp, hipL = (-s0 - run * .3) * amp;
  const lift = amp * (1.05 + run * 1.2), flex = amp * .1 + run * .3;
  const knee = [flex + lift * sw(-c0), flex + lift * sw(c0)], elbow = [0, 0];
  L[0].rotation.x = hipR; L[1].rotation.x = hipL;
  let axR = -s0 * amp * (.95 + run * .3), axL = s0 * amp * (.95 + run * .3);
  if (a.flail > .01) { axR += (-2.7 + Math.sin(t * 17) * .4 - axR) * a.flail; axL += (-2.7 + Math.cos(t * 15) * .4 - axL) * a.flail; }
  A[0].rotation.x = axR; A[1].rotation.x = axL;
  const idleBend = u.bot ? .24 : .16;
  for (let i = 0; i < 2; i++) elbow[i] = idleBend + a.gait * (.12 + run * 1.05) + Math.max(0, -A[i].rotation.x) * .4 * a.gait * (1 - a.flail) + a.flail * (.55 + Math.sin(t * 13 + i * 2) * .25);

  // ---------- knocked over: th is how far the body has gone over (- = onto its back), hc how high its middle is ----------
  if (u.th === undefined) { u.th = 0; u.hc = MID; }
  let armOut = 0, legOut = 0;
  if (pose === 'fly') {
    // limp in the air: arms trail above the head, legs kick loose
    u.th = u.flip || 0; u.hc += (MID - u.hc) * Math.min(1, dt * 10);
    const w = u.phase * 3;
    A[0].rotation.x = -2.2 + Math.sin(t * 9 + w) * .7; A[1].rotation.x = -1.5 + Math.cos(t * 8 + w) * .8; armOut = .7;
    L[0].rotation.x = .55 * Math.sin(t * 8 + w + 1); L[1].rotation.x = -.6 * Math.sin(t * 7 + w); legOut = .3;
    knee[0] = .55 + Math.sin(t * 9 + w) * .4; knee[1] = .5 + Math.cos(t * 8 + w) * .4; elbow[0] = .5 + Math.sin(t * 11 + w) * .3; elbow[1] = .45 + Math.cos(t * 10 + w) * .3;
  } else if (pose === 'down') {
    const to = u.prone ? HALF : -HALF, k = Math.min(1, dt * 14);
    u.th += turn(to, u.th) * k; if (Math.abs(u.th) > Math.PI) u.th = turn(u.th, 0);
    u.hc += (.28 - u.hc) * Math.min(1, dt * 12);
    // sprawled: no two land quite the same
    const v = Math.sin(u.phase * 7.3), s = u.prone ? -1 : 1;
    A[0].rotation.x = s * (-2.3 + v * .4); A[1].rotation.x = s * (-1.0 - v * .5); armOut = .55 + v * .2;
    L[0].rotation.x = s * (.42 + v * .15); L[1].rotation.x = s * (-.28 + v * .2); legOut = .22;
    knee[0] = 0; knee[1] = .45 - v * .1; elbow[0] = .35 + v * .2; elbow[1] = .6 - v * .25;       // one knee up, the arms loosely bent
  } else if (pose === 'up') {
    const r = Math.min(1, Math.max(0, u.rise || 0)); let th, hc;
    if (u.prone) {
      // a push-up, then up onto the feet
      if (r < .4) { const k = ease(r / .4); th = HALF - k * (HALF - 1); hc = .28 + k * (MID * Math.cos(1) - .28); A[0].rotation.x = A[1].rotation.x = -th - .5 * (1 - k); }
      else { const k = ease((r - .4) / .6); th = 1 - k; hc = MID * Math.cos(th); A[0].rotation.x = A[1].rotation.x = -th * (1 - k); }
      L[0].rotation.x = .12 * (1 - r); L[1].rotation.x = -.1 * (1 - r); armOut = .2 * (1 - r);
    } else {
      // sit up with the hands behind, then rock forward and stand
      let legs;
      if (r < .45) { const k = ease(r / .45); th = -HALF + k * (HALF - .45); legs = -k; hc = .2 + HIP * Math.cos(th); A[0].rotation.x = A[1].rotation.x = -1.6 + k * 2.3; armOut = .5 * (1 - k) + .25; }
      else {
        const k = ease((r - .45) / .55), psi = -1.45 * (1 - k); th = -.45 * (1 - k) + .38 * Math.sin(Math.PI * k);
        legs = psi - th; hc = Math.max(.2, LEG * Math.cos(psi)) + HIP * Math.cos(th);
        A[0].rotation.x = A[1].rotation.x = .7 * (1 - k) - .5 * Math.sin(Math.PI * k); armOut = .25 * (1 - k);
      }
      L[0].rotation.x = legs + .08; L[1].rotation.x = legs - .08;
    }
    knee[0] = knee[1] = 0; elbow[0] = elbow[1] = .35 * (1 - r) + .16;
    const k = Math.min(1, dt * 22); u.th += turn(th, u.th) * k; u.hc += (hc - u.hc) * k;
  } else {
    const k = Math.min(1, dt * 9); u.th += turn(0, u.th) * k; u.hc += (MID - u.hc) * k;
  }
  u.lie = Math.max(-1, Math.min(1, -u.th / HALF));          // 1 = flat on the back, -1 = flat on the front (the Big Heads' necks read this)
  const flat = Math.min(1, Math.abs(u.lie));

  // falling: flat on the wind, arms and legs spread and fluttering ('dive': tucked in, head down); under a parachute: hanging from the lines
  u.fall = (u.fall || 0) + (air - (u.fall || 0)) * Math.min(1, dt * (air ? 6 : 10)); const fall = u.fall, tuck = pose === 'dive' ? 1 : 0; u.tuck = (u.tuck || 0) + (tuck - (u.tuck || 0)) * Math.min(1, dt * 5);
  if (air) {
    const fl = Math.sin(t * 19) * .07, k = 1 - u.tuck;
    A[0].rotation.x = -3.5 * k + .35 * u.tuck + fl; A[1].rotation.x = -3.5 * k + .35 * u.tuck - fl;
    L[0].rotation.x = .5 * k + Math.sin(t * 15) * .1; L[1].rotation.x = .5 * k + Math.cos(t * 13) * .1;
    knee[0] = .6 * k + .1 + Math.sin(t * 15) * .08; knee[1] = .6 * k + .1 + Math.cos(t * 13) * .08; elbow[0] = elbow[1] = .55 * k + .1;
  } else if (hang) {
    A[0].rotation.x = -2.95 + Math.sin(t * 2.1) * .05; A[1].rotation.x = -2.95 + Math.cos(t * 1.7) * .05; L[0].rotation.x = .18 + Math.sin(t * 1.6) * .12; L[1].rotation.x = -.05 + Math.sin(t * 1.6 + 1) * .12;
    knee[0] = .3 + Math.sin(t * 1.6) * .1; knee[1] = .45 + Math.sin(t * 1.6 + 1) * .1; elbow[0] = elbow[1] = .5;
  }
  const spread = fall * (1 - u.tuck * .8);
  L[0].rotation.z = -spread * .38 - legOut; L[1].rotation.z = spread * .38 + legOut;
  if (!u.big) { A[0].rotation.z = -.12 - spread * .75 - (hang ? .22 : 0) - armOut; A[1].rotation.z = .12 + spread * .75 + (hang ? .22 : 0) + armOut; }
  const up = (1 - flat) * (1 - fall) * (hang ? 0 : 1);            // 1 while they are on their feet

  // ---------- knees and feet: the knee folds, the foot stays near level ----------
  for (let i = 0; i < 2; i++) {
    const held = a.legHeld[i] >= 0, want = held ? a.legHeld[i] : knee[i];
    a.kb[i] += (want - a.kb[i]) * Math.min(1, dt * (moving && !held ? 45 : 14));
    K[i].rotation.x = a.kb[i];
    F[i].rotation.x = up > .5 ? clamp(-(L[i].rotation.x + a.kb[i]) * .72, -.7, .7) : .32;
  }

  // ---------- turning: ease round to the new heading, and lean into it ----------
  if (u.smoothYaw && !floored && !air) { if (a.yaw === null) a.yaw = c.rotation.y; a.yaw += turn(c.rotation.y, a.yaw) * Math.min(1, dt * u.smoothYaw); c.rotation.y = a.yaw; } else a.yaw = null;
  a.yr += (clamp(turn(c.rotation.y, a.lastYaw) / Math.max(dt, .004), -7, 7) - a.yr) * Math.min(1, dt * 7); a.lastYaw = c.rotation.y;
  const lean = clamp(-a.yr * a.spd * .011, -.2, .2) * a.gait;

  // ---------- the body: tipped over about its middle, or upright and riding on its legs ----------
  // feet stay on the ground: the hips sink as the legs split and rise as they pass. A runner gets some air on top.
  let bounce = 0;
  if (up > 0 && a.legHeld[0] < 0 && a.legHeld[1] < 0) {
    const r0 = L1 * Math.cos(L[0].rotation.x) + L2 * Math.cos(L[0].rotation.x + a.kb[0]), r1 = L1 * Math.cos(L[1].rotation.x) + L2 * Math.cos(L[1].rotation.x + a.kb[1]);
    bounce = Math.max(r0, r1) - STAND + run * Math.abs(s0) * .075;
  }
  u.body.rotation.x = u.th + fall * (1.3 + u.tuck * .75 + Math.sin(t * 2.3) * .05);
  u.body.position.y = u.hc - MID * Math.cos(u.th) + (1 - flat) * bounce + fall * .55;
  u.body.position.z = -MID * Math.sin(u.th) - fall * 1.05;
  const twist = a.free * up, breath = Math.sin(t * 1.7 + u.phase) * (1 - a.gait) * (u.bot ? .25 : 1);
  u.body.rotation.z = (s0 * amp * .04 + lean) * up + (air ? Math.sin(t * 3.1) * .06 : hang ? Math.sin(t * 1.4) * .04 : 0);
  u.body.rotation.y = -s0 * amp * .09 * twist;                                   // the hips go with the legs...
  ch.rotation.y = s0 * amp * .26 * twist;                                         // ...the shoulders against them, with the arms
  ch.rotation.x = (run * .15 + a.gait * .03 + breath * .012) * up;                // a runner leans in; standing still they breathe
  ch.rotation.z = (-s0 * amp * .05 + lean * .6) * up;
  _v.set(0, WAIST, 0).applyEuler(ch.rotation); ch.position.set(-_v.x, WAIST - _v.y + breath * .006 * up, -_v.z);      // the chest turns about the waist

  // ---------- the head: looks at what caught its eye, glances about when idle, and stays level over a moving body ----------
  let want = 0;
  if (u.gazeT > 0) { u.gazeT -= dt; want = clamp(u.gaze || 0, -1.15, 1.15); }
  else if (!moving && !floored && armsFree) { if ((a.lookT -= dt) <= 0) { a.lookT = 1.2 + Math.random() * 3.6; a.lookTo = Math.random() < .35 ? 0 : (Math.random() - .5) * 1.3; } want = a.lookTo; }
  a.look += (want - a.look) * Math.min(1, dt * (u.bot ? 10 : 5));
  u.head.rotation.y = a.look * up - ch.rotation.y * .85 - u.body.rotation.y;
  u.head.rotation.z = Math.sin(ph * .5) * .06 * a.gait - ch.rotation.z * .5;
  if (!u.big) u.head.rotation.x = -ch.rotation.x * .8;
  if (u.big) {                       // arms go round the giant head rather than through it
    const out = pose === 'flail' ? .85 : hang ? .5 : .12 + spread * .8 + armOut; A[0].rotation.z = -out; A[1].rotation.z = out;
    bobble(u, dt, pose === 'fly' || pose === 'up' ? 'down' : pose, moving, 3.2 + speed * 1.55, ph, amp);
  }

  // ---------- elbows ----------
  for (let i = 0; i < 2; i++) {
    a.eb[i] += ((a.held[i] >= 0 ? a.held[i] : elbow[i]) - a.eb[i]) * Math.min(1, dt * 16);
    E[i].rotation.x = -a.eb[i];
  }

  // staggering from a blow: the body rocks away from it, the arms fly up for balance, the head snaps
  if (u.reel > 0) {
    u.reel = Math.max(0, u.reel - dt * 2.3);
    const e = Math.sin(Math.min(1, u.reel) * HALF) * (1 - flat), f = u.reelF || 0, sd = u.reelS || 0;
    u.body.rotation.x += f * .5 * e; u.body.rotation.z += -sd * .42 * e + Math.sin(t * 21) * .03 * e;
    u.body.position.z += f * .12 * e;
    A[0].rotation.x += (-1.9 - A[0].rotation.x) * e * .8; A[1].rotation.x += (-1.3 - A[1].rotation.x) * e * .8;
    A[0].rotation.z -= .7 * e; A[1].rotation.z += .7 * e;
    if (!u.big) u.head.rotation.x = f * .45 * e;
    if (!moving) { L[0].rotation.x += -f * .35 * e; L[1].rotation.x += f * .2 * e; }
  }

  // ---------- eyes: a blink now and then, shut when they are out cold, wide when scared ----------
  if ((a.blinkT -= dt) <= 0) { a.blinkT = 1.6 + Math.random() * 4.4; a.blink = 1; }
  if (a.blink > 0) a.blink = Math.max(0, a.blink - dt / .17);
  a.shut += ((pose === 'down' ? 1 : 0) - a.shut) * Math.min(1, dt * 8);
  const shut = Math.max(a.shut, Math.sin(a.blink * Math.PI));
  if (u.lid) u.lid.rotation.x = shut * LID_SHUT - (1 - shut) * (pose === 'flail' || alert ? .22 : 0);
  if (u.eyes) u.eyes.scale.y = 1 - .88 * shut;
  // googly pupils are loose in the eye: every footfall bounces them, a turn of the head drags them, and they settle when all is still
  const foot = s0 >= 0 ? 1 : -1;
  if (foot !== a.step) { a.step = foot; if (amp > .05) { a.pvy -= amp * 5; a.pvx += foot * amp * 2; a.av += amp * 4 * foot; } }
  if (pose !== a.pose) { if (floored) { a.pvx += (Math.random() - .5) * 30; a.pvy += (Math.random() - .5) * 30; a.av += 10; } a.pose = pose; }
  if (pose === 'fly') { a.pvx += (Math.random() - .5) * 90 * h; a.pvy += (Math.random() - .5) * 90 * h; }
  if (u.reel > .9) { a.pvx += (u.reelS || 0) * 60 * h; a.pvy += 40 * h; }
  const tx = clamp(a.look * .7, -.75, .75);
  a.pvx += (-150 * (a.px - tx) - 12 * a.pvx) * h; a.pvy += (-150 * a.py - 12 * a.pvy) * h;
  a.px = clamp(a.px + a.pvx * h, -1.1, 1.1); a.py = clamp(a.py + a.pvy * h, -1.1, 1.1);
  const open = shut > .45 ? .001 : 1;
  for (let i = 0; i < u.pupils.length; i++) {
    const p = u.pupils[i], d = p.userData; p.position.x = d.bx + a.px * .027 * d.amp; p.position.y = d.by + a.py * .026 * d.amp; p.scale.setScalar(open);
  }
  // tails and antennas trail behind whatever the body does
  if (u.tail) { const wag = u.tailStiff ? .1 : .35; u.tail.rotation.y = Math.sin(t * 3 + u.phase) * wag * (1 - a.gait * .5) + s0 * amp * (u.tailStiff ? .1 : .3) + a.yr * .04; u.tail.rotation.x = -a.gait * (u.tailStiff ? .06 : .2); }
  if (u.antenna) {
    a.av += (-120 * a.ar - 6 * a.av) * h; a.ar = clamp(a.ar + a.av * h, -.6, .6); a.bv += (-120 * a.br - 6 * a.bv - a.yr * 6) * h; a.br = clamp(a.br + a.bv * h, -.6, .6);
    u.antenna.rotation.x = a.ar; u.antenna.rotation.z = a.br;
  }
  if (u.siren) { const on = alert ? Math.floor(t * 6) % 2 : -1; u.siren[0].emissiveIntensity = on === 1 ? 6 : .1; u.siren[1].emissiveIntensity = on === 0 ? 6 : .1; }

  for (let i = 0; i < 2; i++) { a.ax[i] = A[i].rotation.x; a.az[i] = A[i].rotation.z; a.lx[i] = L[i].rotation.x; }
}

// Somebody else poses the whole body (a rider on a bike, someone at a boat's wheel): fold the knees and elbows to match
// and square everything else up.
export function poseJoints(c, knee = 0, elbow = 0) {
  const u = c.userData;
  u.knees.forEach(k => { k.rotation.x = knee; }); u.elbows.forEach(e => { e.rotation.x = -elbow; }); u.feet.forEach(f => { f.rotation.x = 0; });
  u.chest.rotation.set(0, 0, 0); u.chest.position.set(0, 0, 0); u.head.rotation.set(0, 0, 0); u.body.rotation.y = 0;
  if (u.anim) { u.anim.kb[0] = u.anim.kb[1] = knee; u.anim.eb[0] = u.anim.eb[1] = elbow; u.anim.gait = 0; }
}

// A blow landed: make them stagger. (dx, dz) is the way the blow travels, face is which way they are looking.
export function reelCharacter(c, dx, dz, face, power = 1) {
  const u = c.userData, fx = Math.sin(face), fz = Math.cos(face), l = Math.hypot(dx, dz) || 1;
  u.reelF = (dx * fx + dz * fz) / l; u.reelS = (dx * fz - dz * fx) / l; u.reel = Math.min(1.25, Math.max(u.reel || 0, .55 + power * .45));
}
// Which way somebody goes over when knocked flying along (vx, vz): facing the blow they land on their back, otherwise on their front.
// Returns { face, prone, to }: the heading to hold while they tumble, how they land, and the angle to tumble through (flips = extra somersaults).
export function tumblePlan(face, vx, vz, flips = 0) {
  if (Math.hypot(vx, vz) < .3) return { face, prone: false, to: -HALF - flips * Math.PI * 2 };
  const yaw = Math.atan2(vx, vz), back = Math.cos(face - yaw) < .2;
  return { face: back ? yaw + Math.PI : yaw, prone: !back, to: (back ? -1 : 1) * (HALF + flips * Math.PI * 2) };
}
// Put somebody straight back on their feet (a respawn): no half-finished fall carries over.
export function standCharacter(c) { const u = c.userData; u.th = 0; u.hc = MID; u.reel = 0; u.flip = 0; u.prone = false; u.rise = 0; if (u.anim) { u.anim.gait = 0; u.anim.shut = 0; u.anim.yaw = null; } }

// Big Heads are bobbleheads: the head sits on a soft spring. Every stride nudges it, and being
// knocked over, punched or scared gives it a proper shove, so it nods and rolls a moment after the body.
const BOB = { stiff: 95, damp: 5.5, sway: .17, kick: 5.5, max: .5 };      // sway: how far (radians) a full stride rocks the head
function bobble(u, dt, pose, moving, rate, ph, amp) {
  const b = u.big, h = Math.min(dt, 1 / 30);
  if (pose !== b.pose) {
    if (pose === 'down') { b.vx -= BOB.kick; b.vz += (u.phase % 2 - 1) * BOB.kick; }
    else if (pose === 'flail' || b.pose === 'down') { b.vx += BOB.kick * .55; b.vz -= (u.phase % 2 - 1) * BOB.kick * .5; }
    b.pose = pose;
  }
  // the stride pushes just hard enough for the spring to swing `sway` at this step rate, so a sprint rocks it more than a stroll
  const push = moving ? amp * BOB.sway * Math.hypot(BOB.stiff - rate * rate, rate * BOB.damp) : 0;
  b.vx += (-BOB.stiff * b.rx + Math.cos(ph) * push * .6) * h; b.vz += (-BOB.stiff * b.rz + Math.sin(ph) * push) * h;
  const k = Math.max(0, 1 - BOB.damp * h); b.vx *= k; b.vz *= k;
  b.rx = Math.max(-BOB.max, Math.min(BOB.max, b.rx + b.vx * h)); b.rz = Math.max(-BOB.max, Math.min(BOB.max, b.rz + b.vz * h));
  u.head.rotation.x = b.rx; u.head.rotation.z = b.rz;
  u.head.position.z = u.lie * b.rest;              // lying down: the big head rests on the ground, not in it (u.lie is negative face down)
}
// Give a Big Head's head a shove from outside (a punch, a bullet, a car): dx, dz in the character's own frame are not needed, any direction reads fine.
export function bonkHead(c, power = 1) { const b = c.userData.big; if (b) { b.vx += (Math.random() - .5) * 9 * power; b.vz += (Math.random() < .5 ? -1 : 1) * 6 * power; } }
