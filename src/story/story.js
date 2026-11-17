// Story mode. An option on the title screen (and the pause menu): the same city, with a string of jobs from
// Big Sal, Scrap, Tiff and Officer Dale on top. Free roam is the game without them.
//   - whoever has the next job waits at a green ring (a green letter on the radar); step into it on foot
//   - they talk (dialogue.js), then the mission's steps run one after another (missions.js says what they are)
//   - wasted, nabbed, out of time or a wrecked car fails it; hold Y to try again from the start, hold X to quit
//   - progress is kept in the browser, so the story carries on next time
// While a mission runs it counts as the one activity in progress, so races and the rest wait their turn.
import * as THREE from 'three';
import { STORY } from '../config.js';
import { clamp, angleDiff } from '../core/utils.js';
import { fmtTime, cash } from '../activities/kit.js';
import { makeCharacter, animateCharacter, setCharacterShadow } from '../characters/models.js';
import { groundY } from '../world/terrain.js';
import { createDialogue, CAST } from './dialogue.js';
import { createGunmen } from './gunmen.js';
import { buildMissions } from './missions.js';

const GREEN = 0x6dff8a, GOLD = 0xffd34d, RED = 0xff3048, KEY = 'fta6.story.v1';
const GLYPH = { sal: 'S', tiff: 'T', dale: 'D', scrap: '⚙' };
const WHERE = { sal: 'THE MOTEL', tiff: 'THE ARCADE', dale: 'SUNSET PD', scrap: 'THE CHOP SHOP' };
const $ = (id) => document.getElementById(id);

export function createStory(game) {
  const A = game.activities, kit = A.kit, p = game.player, hud = game.hud, audio = game.audio, police = game.police, traffic = game.traffic, outlaws = game.outlaws;
  const talk = createDialogue(game), gunmen = createGunmen(game);
  const { missions, spots } = buildMissions(game);

  // ---------- what is remembered ----------
  let data = { done: 0, on: false };
  try { data = { ...data, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { /* a fresh start */ }
  data.done = clamp(data.done | 0, 0, missions.length);
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private window: this session only */ } };

  let run = null;            // the mission in progress
  let retry = null;          // { m, t }: the mission that just failed, offered again for a little while
  let page = 0;              // seconds until the pager says who has the next job (0 = nothing to say)
  let hintHtml = '', held = 0, shownFor = null, ending = 0, stepOut = false;

  // ---------- things in the world ----------
  // rings are never thrown away: a finished step hands them back for the next one
  const pool = {};
  const takeRing = (color, r, beam) => { const k = color + '/' + r + '/' + beam, m = (pool[k] ||= []).pop() || kit.marker(color, r, beam); m.key = k; return m; };
  const useRing = (color, r, beam = true) => { const m = takeRing(color, r, beam); run.rings.push(m); return m; };
  const useBlip = (o) => { run.blips.push(kit.blip(o)); return o; };
  const startRing = kit.marker(GREEN, STORY.ring, true);
  const startBlip = kit.blip({ x: 0, z: 0, color: '#6dff8a', glyph: 'S', pin: true, hot: true, size: 8.5, visible: () => story.on && !A.busy && data.done < missions.length });
  // the arrow that hangs over a car you are after
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(.6, 1.2, 4), new THREE.MeshBasicMaterial({ color: GREEN, toneMapped: false }));
  arrow.rotation.x = Math.PI; arrow.visible = false; game.scene.add(arrow);
  let arrowOn = null, arrowColor = GREEN;
  const point = (v, color = GREEN) => { arrowOn = v; arrowColor = color; };
  // Whoever has the next job waits outside their door (their counter inside stays open). Scrap has no shop to stand in,
  // so he is always on the pavement beside it.
  const bots = {};
  function bot(id) {
    if (bots[id]) return bots[id];
    const g = spots[id], m = bots[id] = makeCharacter(CAST[id].kind, { props: false });
    m.position.set(g.bx, groundY(g.bx, g.bz), g.bz); m.rotation.y = g.face; m.visible = false; game.scene.add(m); game.env.touch(); return m;
  }
  let waiting = null;        // which giver is standing outside
  function setWaiting(id) {
    if (id === waiting) return;
    for (const k of [waiting, id]) { const c = k && spots[k].room?.clerk; if (c) c.model.scale.setScalar(k === id ? .0001 : 1); }      // they can't be behind the counter as well
    waiting = id;
  }
  function updateBots(dt, t) {
    for (const id in spots) {
      const here = id === 'scrap' || id === waiting; if (!here && !bots[id]) continue;
      const m = bot(id), d = Math.hypot(m.position.x - p.x, m.position.z - p.z);
      m.visible = here && d < 110; if (!m.visible || d > 70) continue;
      setCharacterShadow(m, d < 50); animateCharacter(m, t, dt, 0, 'stand');
      const want = d < 9 ? Math.atan2(p.x - m.position.x, p.z - m.position.z) : spots[id].face;
      m.rotation.y += angleDiff(want, m.rotation.y) * Math.min(1, dt * 4);
    }
  }
  // turn you and the camera to whoever you are talking to
  function faceGiver(id) {
    const g = spots[id], dx = g.bx - p.x, dz = g.bz - p.z;
    p.face = Math.atan2(dx, dz); game.cam.yaw = Math.atan2(dz, dx) + .55; game.cam.pitch = .22;
  }

  // the hint under the activity panel (what to do at a ring), and the objective row on the job list
  const hint = document.createElement('div'); hint.className = 'actHint story'; hint.hidden = true; document.querySelector('.actTop').appendChild(hint);
  const setHint = (h) => { if (h !== hintHtml) { hint.innerHTML = h; hint.hidden = !h; hintHtml = h; } };
  const val = (v) => typeof v === 'function' ? v(run) : v;
  const baseLines = game.jobs.lines;
  game.jobs.lines = () => { const rows = baseLines(); if (run?.phase === 'steps' && run.s) { const t = run.line; if (t) rows.unshift(['MISSION', t, '']); } return rows; };

  // ---------- the kinds of step ----------
  // enter(s, st) sets a step up, update(s, st, dt, t) returns true when it is done. st is the step's own scratch pad.
  let tip = '';
  const atRing = (ring, s) => ring.inside(p) && (s.y == null || Math.abs(p.y - s.y) < 4);
  const allowed = (s) => {
    if (s.mode && s.mode !== p.mode) { tip = s.mode === 'foot' ? 'On foot' : 'Bring a car'; return false; }
    if (s.clean && police.stars > 0) { tip = 'Lose the cops first'; return false; }
    return true;
  };
  const KINDS = {
    go: {
      enter(s, st) { const [x, z] = val(s.go); st.ring = useRing(GREEN, s.r ?? 6).place(x, z, s.y ?? null); useBlip({ x, z, color: '#6dff8a', glyph: '', pin: true, hot: true, size: 7 }); },
      update(s, st, dt, t) { st.ring.tick(t, p, 900); if (!atRing(st.ring, s) || !allowed(s)) return false; if (s.stop && p.speed > 2) { tip = 'Stop here'; return false; } return true; },
    },
    say: { enter(s, st) { talk.play(val(s.say), () => { st.done = true; }); }, update: (s, st) => !!st.done },
    car: {
      enter(s, st) {
        const [x, z, h] = val(s.at);
        for (const v of traffic.vehicles.slice()) if (!v.driver && Math.hypot(v.x - x, v.z - z) < 5.5) traffic.remove(v);        // whatever was parked there makes way
        const v = st.v = traffic.add(s.car, x, z, h); if (s.own) v.stolen = true;
        run.cars[s.as || s.car] = run.refs[s.as || s.car] = v;
        st.blip = useBlip({ x, z, color: '#6dff8a', glyph: '', pin: true, hot: true, size: 7 });
      },
      update(s, st) { const v = st.v; st.blip.x = v.x; st.blip.z = v.z; point(v); return p.vehicle === v; },
    },
    bring: {
      enter(s, st) {
        const [x, z] = val(s.to), v = st.v = run.cars[s.bring];
        st.ring = useRing(GREEN, s.r ?? 5).place(x, z);
        useBlip({ x, z, color: '#6dff8a', glyph: '', pin: true, hot: true, size: 7, visible: () => p.vehicle === v });
        st.blip = useBlip({ x: v.x, z: v.z, color: '#6dff8a', glyph: '', pin: true, hot: true, size: 7, visible: () => p.vehicle !== v });
      },
      update(s, st, dt, t) {
        const v = st.v; st.ring.tick(t, p, 900); st.blip.x = v.x; st.blip.z = v.z;
        st.away = p.vehicle !== v; if (st.away) { point(v); return false; }
        if (!st.ring.inside(p) || !allowed(s)) return false;
        if (v.speed > 1.5) { tip = 'Stop here'; return false; }
        delete run.cars[s.bring];
        if (s.take) {                                       // handed over: whoever wanted it drives it off
          p.exit(); for (let i = 0; i < 3; i++) game.fx.spark(v.x + Math.random() * 3 - 1.5, v.y + .9, v.z + Math.random() * 3 - 1.5, 8, 1.2);
          audio.wrench(); traffic.remove(v); p.nearCar = null;
        } else if (s.park) { p.exit(); v.temp = true; }
        return true;
      },
      line: (s, st) => st.away ? `Get back in the ${st.v.stats.name.toLowerCase()}` : null,
    },
    grab: {
      enter(s, st) {
        st.items = val(s.grab).map(([x, z, y]) => ({ x, z, y, ring: useRing(GOLD, s.r ?? 2.2, s.beam ?? true).place(x, z, y ?? null), blip: useBlip({ x, z, color: '#ffd34d', glyph: '', pin: true, size: 5.5 }) }));
        st.n = 0; st.total = st.items.length; run.count = st.total > 1 ? `0/${st.total}` : '';
      },
      update(s, st, dt, t) {
        for (const it of st.items) {
          if (it.got) continue;
          it.ring.tick(t, p, 600);
          if (!atRing(it.ring, it) || !allowed(s)) continue;
          it.got = true; it.ring.hide(); it.blip.visible = () => false; st.n++; audio.pickup();
          hud.toast(st.total > 1 ? `${s.what || 'GOT IT'}  ${st.n}/${st.total}` : (s.what || 'GOT IT'), 'good');
          if (st.total > 1) run.count = `${st.n}/${st.total}`;
          s.each?.(run, st.n);
        }
        return st.n >= st.total;
      },
      exit() { run.count = ''; },
    },
    goons: {
      enter(s, st) {
        st.group = val(s.goons).map(([x, z, o]) => gunmen.add(s.kind || 'possum', x, z, { ...s.opts, ...o })); run.goons.push(...st.group);
        st.blips = st.group.map(g => useBlip({ x: g.ped.x, z: g.ped.z, color: '#ff3048', glyph: '', pin: true, size: 4.2, visible: () => !g.out }));
      },
      update(s, st) {
        st.group.forEach((g, i) => { st.blips[i].x = g.ped.x; st.blips[i].z = g.ped.z; });
        const left = gunmen.alive(st.group); run.count = `${st.group.length - left}/${st.group.length}`;
        return left === 0;
      },
      exit() { run.count = ''; },
    },
    flee: {
      enter(s, st) { st.tries = 0; },
      update(s, st, dt) {
        if (!st.r) {
          st.r = outlaws.runaway(s.flee, s.min ?? 70, s.max ?? 130, { speed: s.speed, giveUp: s.giveUp ?? STORY.giveUp, lost: STORY.lost, crook: s.crook });
          if (!st.r) { if (++st.tries > 900) fail('NOBODY SHOWED UP'); return false; }
          run.refs[s.as || s.flee] = st.r.car; run.runaways.push(st.r);
          st.blip = useBlip({ x: 0, z: 0, color: '#ff3048', glyph: '!', ink: '#fff', pin: true, hot: true, size: 7 });
        }
        const v = st.r.car; st.blip.x = v.x; st.blip.z = v.z; point(v, RED);
        const state = outlaws.update(st.r, dt);
        if (state === 'gone') { fail(s.gone || 'THEY GOT AWAY'); return false; }
        const left = clamp((v.health / v.stats.health - st.r.giveUp) / (1 - st.r.giveUp), 0, 1);
        run.count = state === 'run' ? `${Math.round(left * 100)}%` : '';
        return state === 'stopped';
      },
      exit() { run.count = ''; },
    },
    lose: { update: () => police.stars === 0 },
    until: { update: (s, st, dt, t) => !!s.until(run, dt, t) },
    run: { enter(s) { s.run(run); }, update: () => true },
    timer: { enter(s) { run.timer = s.timer; }, update: () => true },
    wait: { enter(s, st) { st.t = s.wait; }, update: (s, st, dt) => (st.t -= dt) <= 0 },
  };
  const kindOf = (s) => Object.keys(KINDS).find(k => k in s);

  // ---------- running a mission ----------
  function endStep() {
    if (!run.s) return;
    KINDS[run.kind].exit?.(run.s, run.st);
    for (const m of run.rings) { m.hide(); pool[m.key].push(m); } run.rings.length = 0;
    for (const b of run.blips) kit.unblip(b); run.blips.length = 0;
    run.s = null; setHint('');
  }
  function nextStep() {
    endStep();
    if (++run.i >= run.m.steps.length) { finish(); return; }
    run.s = run.m.steps[run.i]; run.kind = kindOf(run.s); run.st = {}; run.line = val(run.s.text) || '';
    KINDS[run.kind].enter?.(run.s, run.st);
  }
  function begin(m, again = false) {
    A.begin(part); retry = null; page = 0; startRing.hide(); setHint('');
    run = { m, i: -1, s: null, st: null, kind: null, line: '', phase: 'intro', cars: {}, refs: {}, goons: [], runaways: [], rings: [], blips: [], timer: null, count: '' };
    const go = () => { if (!run || run.m !== m) return; run.phase = 'steps'; kit.ui.banner(m.title, again ? 'Take two' : '', 'go', 2.4); audio.pager(); nextStep(); };
    if (again) go(); else { faceGiver(m.giver); talk.play(m.intro, go); }
  }
  // Take everything a mission put in the world back out of it.
  function cleanup() {
    talk.stop(); endStep();
    gunmen.clear(run.goons); for (const r of run.runaways) outlaws.release(r);
    for (const k in run.cars) run.cars[k].temp = true;
    arrow.visible = false; arrowOn = null; run = null; shownFor = undefined; stepOut = true; A.end();      // standing in a start ring? step out of it first
  }
  function fail(reason, offer = true) {
    if (!run) return;
    const m = run.m; cleanup();
    kit.ui.banner('MISSION FAILED', reason, 'bad', 3.6); if (!game.over) audio.busted();
    if (offer) { retry = { m, t: STORY.retry }; held = 0; }
  }
  function finish() {
    run.phase = 'outro'; arrow.visible = false; arrowOn = null; kit.ui.panel('');
    const m = run.m;
    audio.pager(); talk.play(m.outro, () => { if (run && run.m === m) pass(); });
  }
  function pass() {
    const m = run.m, pay = STORY.pay[m.id] || 0; cleanup();
    data.done = Math.min(missions.length, missions.indexOf(m) + 1); store(); refreshMenus();
    game.addMoney(pay); m.reward?.(game); audio.evade();
    kit.ui.banner('MISSION PASSED', `${m.title}  +${cash(pay)}`, 'gold', 4.5);
    if (data.done >= missions.length) ending = 6; else page = 7;
  }
  // Back to where the job was handed out, for another go.
  function again(m) {
    const g = spots[m.giver], armor = p.armor;
    police.clear(); p.respawn({ x: g.x, z: g.z, face: g.face }); p.armor = armor; game.cam.yaw = Math.atan2(Math.cos(g.face), Math.sin(g.face));
    begin(m, true);
  }

  // ---------- the menus ----------
  const playBtn = $('playBtn'), row = document.createElement('div'); row.className = 'modes'; playBtn.replaceWith(row);
  const storyBtn = document.createElement('button'); storyBtn.type = 'button'; storyBtn.id = 'storyBtn'; storyBtn.textContent = 'Story mode';
  row.append(storyBtn, playBtn); playBtn.textContent = 'Free roam';
  const note = document.createElement('p'); note.className = 'tip modeNote'; row.after(note);
  const fresh = document.createElement('button'); fresh.type = 'button'; fresh.className = 'ghost small'; fresh.textContent = 'Start over'; fresh.hidden = true; note.after(fresh);
  let picked;                // which button started the game
  storyBtn.addEventListener('click', () => { picked = true; playBtn.click(); });
  // a real click on "Free roam" means free roam; Enter (main.js presses the button for you) picks whatever you played last
  playBtn.addEventListener('click', (e) => { story.setMode(picked ?? (e.isTrusted ? false : data.on)); picked = undefined; });
  fresh.addEventListener('click', () => {
    if (!fresh.dataset.sure) { fresh.dataset.sure = '1'; fresh.textContent = 'Wipe story, cash and guns? Click again'; return; }
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing to wipe */ }
    game.wallet?.wipe(); location.reload();
  });
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'ghost';
  const next = document.createElement('p'); next.className = 'tip';
  $('resumeBtn').after(next, toggle);
  toggle.addEventListener('click', () => story.setMode(!story.on));
  function refreshMenus() {
    const m = missions[data.done], n = missions.length;
    note.innerHTML = data.done === 0 ? '<b>Story:</b> eight jobs for Big Sal, Scrap, Tiff and Officer Dale, ending with the Sunset Tower job. <b>Free roam:</b> the whole map and nobody telling you what to do.'
      : m ? `<b>Story so far:</b> ${data.done} of ${n} jobs done. Next up: ${m.title}, from ${CAST[m.giver].name}.` : '<b>Story finished.</b> Sunset Coast is yours.';
    storyBtn.textContent = data.done === 0 ? 'Story mode' : m ? 'Continue the story' : 'Story mode';
    fresh.hidden = data.done === 0 && !game.wallet?.saved;
    toggle.textContent = `Story mode: ${story.on ? 'on' : 'off'}`;
    next.innerHTML = !story.on ? 'Free roam. Turn story mode on to get jobs from the crew.'
      : run ? `<b>${run.m.title}:</b> ${run.line || 'in progress'}` : m ? `<b>Next job:</b> ${m.title}. ${CAST[m.giver].name} is waiting at ${WHERE[m.giver].toLowerCase()} (the green ${GLYPH[m.giver]} on the radar).` : 'Story finished. Sunset Coast is yours.';
  }

  // ---------- every frame ----------
  const part = {
    // wasted or nabbed (activities.js calls this). The job is already done once the last talk has started.
    abort(msg) { if (!run) return; if (run.phase === 'outro') pass(); else fail(msg || (p.health <= 0 ? 'YOU WENT DOWN' : 'YOU GOT NABBED')); },
    progress() { return story.on || data.done ? ['Story', data.done >= missions.length ? 'finished' : `${data.done}/${missions.length} jobs`] : null; },
    update(dt, t) {
      talk.update(dt); gunmen.update(dt, t); game.wallet?.update(dt);
      const giver = run ? run.m.giver : story.on && data.done < missions.length ? missions[data.done].giver : null;
      setWaiting(giver === 'scrap' ? null : giver); updateBots(dt, t);

      if (!run) { idle(dt, t); return; }
      if (run.phase !== 'steps') return;                   // people are talking
      if (A.quitHeld(dt)) { fail('MISSION ABANDONED', false); return; }
      for (const k in run.cars) {
        const v = run.cars[k];
        if (!traffic.vehicles.includes(v)) { fail(`YOU LOST THE ${v.stats.name}`); return; }
        if (v.wrecked) { fail(`THE ${v.stats.name} IS WRECKED`); return; }
        v.temp = false;                                    // never tidied away while the job needs it
      }
      if (run.timer != null && (run.timer -= dt) <= 0) { fail('OUT OF TIME'); return; }
      arrowOn = null; tip = '';
      const s = run.s, done = KINDS[run.kind].update(s, run.st, dt, t);
      if (!run) return;                                    // it failed in there
      if (run.s === s) {
        run.line = KINDS[run.kind].line?.(s, run.st) || val(s.text) || run.line;
        setHint(tip ? `<b>${run.m.title}</b>${tip}` : '');
        if (done) {
          if (s.plus && run.timer != null) { run.timer += s.plus; hud.toast(`+${s.plus} SECONDS`, 'good'); audio.pickup(); }
          nextStep(); if (!run || run.phase !== 'steps') return;
        }
      }
      if (run.timer != null) kit.ui.panel(run.m.title, fmtTime(Math.max(0, run.timer)), run.count); else if (run.count) kit.ui.panel(run.m.title, run.count, ''); else kit.ui.panel('');
      arrow.visible = !!arrowOn;
      if (arrowOn) { arrow.material.color.set(arrowColor); arrow.position.set(arrowOn.ix, arrowOn.y + 3.6 + Math.sin(t * 4) * .25, arrowOn.iz); arrow.rotation.y = t * 2.5; }
    },
  };

  // Nothing running: the ring where the next job starts, the retry offer, the pager.
  function idle(dt, t) {
    const m = story.on && !A.busy && !game.over ? missions[data.done] : null;
    if (m !== shownFor) {
      shownFor = m;
      if (m) { const g = spots[m.giver]; startRing.place(g.x, g.z); startBlip.x = g.x; startBlip.z = g.z; startBlip.glyph = GLYPH[m.giver]; } else startRing.hide();
    }
    let h = '';
    if (retry) {
      if (!story.on || A.busy) retry = null;
      else if (!game.over) {
        if ((retry.t -= dt) <= 0) retry = null;
        else {
          h = `<b>${retry.m.title}</b>Hold <kbd>Y</kbd> to try again`;
          held = game.input.down('KeyY') ? held + dt : 0;
          if (held > .6) { const m2 = retry.m; held = 0; again(m2); return; }
        }
      }
    }
    if (m) {
      const g = spots[m.giver], d = Math.hypot(p.x - g.x, p.z - g.z);
      startRing.tick(t, p);
      if (d >= 14) stepOut = false;
      if (d < 14 && Math.abs(p.y - groundY(g.x, g.z)) < 3) {
        if (p.mode !== 'foot') h = `<b>${m.title}</b>Step into the green ring on foot<em>${CAST[m.giver].name}: ${m.brief}</em>`;
        else if (d >= STORY.ring) { stepOut = false; h = `<b>${m.title}</b>Step into the green ring<em>${CAST[m.giver].name}: ${m.brief}</em>`; }
        else if (stepOut) h = '';
        else if (police.stars > 0) h = `<b>${m.title}</b>Lose the cops first`;
        else { begin(m); return; }
      }
      if (page > 0 && (page -= dt) <= 0) { hud.toast(`${CAST[m.giver].name} HAS A JOB: ${WHERE[m.giver]}`, 'job'); audio.pager(); }
    }
    if (ending > 0 && (ending -= dt) <= 0) { kit.ui.banner('THE END', 'Sunset Coast is yours. Thanks for playing the story.', 'gold', 8); audio.evade(); }
    setHint(h);
  }

  const story = {
    on: false, missions, spots, talk, gunmen,
    get mission() { return run; }, get done() { return data.done; },
    setMode(v) {
      if (!v && run) fail('STORY MODE OFF', false);
      story.on = !!v; data.on = story.on; store(); retry = null; shownFor = undefined;
      if (story.on && p.who !== 'rocco') game.who.pick('rocco');          // the story is Rocco's
      if (story.on && data.done < missions.length) page = 3.5;
      refreshMenus();
    },
    // for tests and the curious: jump to a job (0 = the first), or start it on the spot
    jump(n) { if (run) fail('SKIPPED', false); data.done = clamp(n, 0, missions.length); store(); shownFor = undefined; refreshMenus(); },
    start(n = data.done, skipTalk = true) { if (run) fail('SKIPPED', false); data.done = clamp(n, 0, missions.length - 1); begin(missions[data.done], skipTalk); },
    fail,
  };
  A.parts.story = part;
  document.addEventListener('pointerlockchange', refreshMenus);          // the pause menu shows where the story stands
  refreshMenus();
  return story;
}
