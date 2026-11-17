// Cops vs Robbers: a timed team match played in a room (net.js). Two halves; one team robs while the other
// polices, then they swap. Robbers pick up money all over the city, but it only counts once it is dropped at a
// stash ring. A robber who goes down loses what they carry, and if a cop did it the cops recover it. The team
// that stashed more over both halves wins; recovered money breaks a tie.
//
// Who decides what: the host (net.isHost) keeps the clock, the teams and the score, and sends them inside its
// snapshot (`g`). Every player's own game decides what happens to that player (what they earned, that they went
// down) and announces it: bank, bust, copdown, cuff, alarm, till. All numbers are in MATCH (config.js).
import { MATCH, INDOORS } from '../config.js';
import { cash } from '../activities/kit.js';

const $ = (id) => document.getElementById(id);
const div = (cls, text) => { const d = document.createElement('div'); d.className = cls; if (text !== undefined) d.textContent = text; return d; };
const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const roll = ([a, b]) => Math.round((a + Math.random() * (b - a)) / 10) * 10;
const fresh = () => ({ ph: 'lobby', hf: 1, tl: 0, len: MATCH.halfTime, tm: {}, sc: [0, 0], rec: [0, 0], pl: {} });

export function createMatch(game) {
  const net = game.net, p = game.player, kit = game.activities.kit, T = MATCH.teams;
  let g = fresh();
  const my = { wish: -1, team: -1, role: null, solo: 0, stashT: 0, cuffT: 0, cuffing: null, downT: 0, shield: 0, cruiser: null, tills: null, smashT: 0, setup: false };
  const part = { update() { }, abort() { } };          // what the activities see while a match is on: no races or pizza runs
  const pings = [];                                   // store alarms on the cops' radar
  const ride = kit.blip({ get x() { return my.cruiser?.x ?? 0; }, get z() { return my.cruiser?.z ?? 0; }, color: '#4d8dff', glyph: 'C', ink: '#fff', pin: true, size: 6.5, visible: () => my.role === 'cop' && match.on && my.cruiser && !my.cruiser.gone && !my.cruiser.wrecked && p.vehicle !== my.cruiser });
  let stashes = null, safe = null, barKey = '', lobbyKey = '', listKey = '';
  const hudEl = $('hud');

  const robTeam = () => (g.hf === 1 ? 0 : 1);
  const roleOf = (team) => (team < 0 ? null : team === robTeam() ? 'rob' : 'cop');
  const nameOf = (id) => (id === net.id ? net.name : net.remotes.get(id)?.name || g.pl[id]?.n || 'Someone');
  const playing = () => match.on && g.ph === 'play';
  const room = (id) => game.indoors.rooms.find(q => q.id === id);

  // ---------- places ----------
  function places() {
    if (stashes) return;
    stashes = []; safe = [];
    const front = (q, out) => ({ x: q.door.x + q.face[0] * out, z: q.door.z + q.face[1] * out, face: Math.atan2(q.face[0], q.face[1]), name: q.name });
    for (const id of MATCH.stashes) {
      const q = room(id), at = q ? front(q, 3.2) : id === 'chop' ? game.jobs.blips().find(b => b.kind === 'chop') : null; if (!at) continue;
      const s = { x: at.x, z: at.z, mark: kit.marker(0x5dff8a, MATCH.stashRadius, true) };
      s.blip = kit.blip({ x: s.x, z: s.z, color: '#5dff8a', glyph: '$', pin: true, size: 7.5, visible: () => my.role === 'rob' && playing() });
      stashes.push(s);
    }
    for (const id of MATCH.safehouses) { const q = room(id); if (q) safe.push(front(q, 2.2)); }
  }
  // Where I start a half or come back: cops at Sunset PD, robbers at the safehouse furthest from any cop.
  function spawnSpot() {
    const jit = () => (Math.random() - .5) * 3;
    if (my.role === 'cop' || !safe.length) { const s = game.landmarks.station; return { x: s.x + jit(), z: s.z + jit() * .3, face: s.face, name: s.name }; }
    const cops = [...net.remotes.values()].filter(r => r.team >= 0 && r.team !== my.team), st = game.landmarks.station;
    let best = safe[0], bd = -1;
    for (const s of safe) { let d = Math.hypot(s.x - st.x, s.z - st.z); for (const c of cops) d = Math.min(d, Math.hypot(s.x - c.x, s.z - c.z)); if (d > bd) { bd = d; best = s; } }
    return { x: best.x + jit() * .5, z: best.z + jit() * .5, face: best.face, name: best.name };
  }
  function giveKit() {
    const c = game.combat, kitFor = my.role === 'cop' ? MATCH.copKit : MATCH.robberKit;
    c.reset(true);
    for (const id in kitFor) c.give(id, kitFor[id]);
  }
  function cruiser() {
    if (my.role !== 'cop') return;
    const v = my.cruiser; if (v && !v.gone && !v.wrecked && Math.hypot(v.x - p.x, v.z - p.z) < 60) return;
    let s = null; for (const far of [45, 45, 90, 90, 160]) if ((s = game.traffic.findRoadSpot(0, far))) break; if (!s) return;
    my.cruiser = game.traffic.add('police', s.x, s.z, s.h); my.cruiser.temp = true; my.cruiser.stolen = true;
  }
  function place(spot) {
    p.respawn(spot); game.cam.yaw = Math.atan2(Math.cos(spot.face), Math.sin(spot.face));
    game.over = false; $('busted').hidden = true; my.downT = 0; my.shield = net.clock + MATCH.shield;
    cruiser();
  }

  // ---------- a half begins / the match ends, on this screen ----------
  function begin() {
    places();
    if (!my.setup) {
      my.setup = true; my.solo = game.money; my.tills = [INDOORS.robCash, INDOORS.tillRefill];
      const c = game.combat; my.guns = { owned: [...c.owned], clip: { ...c.clip }, ammo: { ...c.ammo }, weapon: c.weapon };      // handed back afterwards
      INDOORS.robCash = MATCH.holdUp; INDOORS.tillRefill = MATCH.tillRefill;
      const A = game.activities; if (A.busy && A.busy !== part) A.busy.abort?.('A MATCH IS STARTING');      // a race, a job or a story mission in progress is called off
      A.begin(part); game.police.clear(); hudEl.classList.add('inMatch');
    }
    my.team = g.tm[net.id] ?? -1; my.role = roleOf(my.team);
    game.money = 0; my.stashT = 0; my.cuffT = 0; pings.length = 0;
    for (const q of game.indoors.rooms) q.till = 0;
    for (const s of stashes) if (my.role === 'rob') s.mark.place(s.x, s.z); else s.mark.hide();
    giveKit(); place(spawnSpot());
    if (game.state === 'paused') game.setState('playing');
  }
  function teardown() {
    if (!my.setup) return;
    my.setup = false; game.money = my.solo; [INDOORS.robCash, INDOORS.tillRefill] = my.tills;
    const c = game.combat; c.reset(true); c.owned = new Set(my.guns.owned); c.clip = my.guns.clip; c.ammo = my.guns.ammo; c.weapon = my.guns.weapon;
    game.activities.end(); for (const s of stashes || []) s.mark.hide(); hudEl.classList.remove('inMatch');
    my.team = -1; my.role = null; p.frozen = false; game.over = false; $('busted').hidden = true; $('results').hidden = true; my.downT = 0;
    kit.ui.hint(''); pings.length = 0;
  }

  // The host's word arrived (or, on the host, changed): act on what is new.
  function phase(was, wasHalf) {
    const mine = g.tm[net.id] ?? -1;
    if (g.ph === 'lobby') { teardown(); return; }
    if (mine < 0) return;                                  // a match I am not part of (yet)
    const side = () => (roleOf(mine) === 'rob' ? 'ROBBER' : 'COP');
    if (g.ph === 'count' && (was !== 'count' || wasHalf !== g.hf || !my.setup)) {
      begin(); p.frozen = true;
      kit.ui.banner(`YOU ARE A ${side()}`, `Half ${g.hf}. ` + (my.role === 'rob' ? 'Grab cash anywhere, then stand in a green ring to stash it' : 'Take the robbers down, or hold C beside one on foot to cuff them. Your cruiser is the blue C on the radar'), my.role === 'rob' ? 'gold' : '', MATCH.countdown);
    } else if (g.ph === 'play') {
      if (!my.setup || my.team !== mine) begin();           // joined while it was running
      p.frozen = false; if (was === 'count') { kit.ui.banner('GO!', '', 'gold', 1.2); game.audio.evade(); }
    } else if (g.ph === 'half') {
      if (!my.setup) begin();
      const lost = game.money; game.money = 0; p.frozen = false;
      kit.ui.banner('HALF TIME', (lost > 0 ? `You never stashed ${cash(lost)}. ` : '') + 'Sides swap for the second half', '', MATCH.breakTime - 1); game.audio.busted();
    } else if (g.ph === 'end') { if (!my.setup) begin(); game.money = 0; p.frozen = false; results(); }
  }
  function adopt(ng) {
    const was = g.ph, wasHalf = g.hf; g = ng;
    if (was !== g.ph || wasHalf !== g.hf || (g.ph !== 'lobby' && (g.tm[net.id] ?? -1) !== my.team)) phase(was, wasHalf);
  }
  const set = (ph, tl) => { const was = g.ph, wasHalf = g.hf; g.ph = ph; g.tl = tl; phase(was, wasHalf); };

  // ---------- things that happen, heard by everyone (and by me, for my own) ----------
  const stat = (id) => (g.pl[id] ||= { n: nameOf(id), b: 0, u: 0 });
  const heard = {
    bank(from, d) {
      const a = Math.max(0, Math.min(1e6, +d?.a || 0)), team = g.tm[from] ?? -1; if (!a || g.ph !== 'play') return;
      if (match.on) game.hud.toast(`${nameOf(from).toUpperCase()} STASHED ${cash(a)}`, team === my.team ? 'good' : 'bad');
      if (net.isHost && team === robTeam()) { g.sc[team] += a; stat(from).b += a; }
    },
    bust(from, d) {
      const a = Math.max(0, Math.min(1e6, +d?.a || 0)), by = d?.by, cop = by && (g.tm[by] ?? -1) >= 0 && g.tm[by] !== g.tm[from];
      if (match.on) game.hud.toast(cop ? `${nameOf(by).toUpperCase()} BUSTED ${nameOf(from).toUpperCase()}${a ? ': ' + cash(a) + ' RECOVERED' : ''}` : `${nameOf(from).toUpperCase()} WIPED OUT${a ? ' AND DROPPED ' + cash(a) : ''}`, cop === (my.role === 'cop') ? 'good' : 'bad');
      if (net.isHost && cop && g.ph === 'play') { g.rec[g.tm[by]] += a; stat(by).u++; }
    },
    copdown(from, d) { if (match.on) game.hud.toast(d?.by ? `${nameOf(d.by).toUpperCase()} TOOK DOWN OFFICER ${nameOf(from).toUpperCase()}` : `OFFICER ${nameOf(from).toUpperCase()} IS DOWN`, my.role === 'rob' ? 'good' : 'bad'); },
    cuff(from) { if (playing() && my.role === 'rob' && !game.over && p.mode === 'foot' && !match.shielded() && (g.tm[from] ?? -1) !== my.team) match.down(from); },
    cuffing(from) { if (playing() && my.role === 'rob') game.hud.toast(`${nameOf(from).toUpperCase()} IS CUFFING YOU: RUN!`, 'bad'); },
    alarm(from, d) {
      if (!playing() || my.role !== 'cop' || !Number.isFinite(d?.x) || !Number.isFinite(d?.z)) return;
      game.hud.toast(`ALARM: ${String(d.txt || 'ROBBERY').slice(0, 24)}`, 'bad'); game.audio.alarm();
      const ping = { until: net.clock + MATCH.alarmTime, blip: kit.blip({ x: d.x, z: d.z, color: '#ff3048', glyph: '!', ink: '#fff', pin: true, size: 8, hot: true }) };
      pings.push(ping);
    },
    till(from, d) { const q = room(d?.id); if (q && playing()) { q.till = game.time + Math.min(600, +d.t || 0); q.told = false; } },
    end() { if (net.isHost && g.ph !== 'lobby') set('lobby', 0); },
  };
  const tell = (type, d, to) => { net.send(type, d, to); if (!to) heard[type](net.id, d); };      // told to the others, and acted on here
  for (const k in heard) net.on(k, heard[k]);

  const match = {
    get on() { return net.active && g.ph !== 'lobby' && my.setup; },
    get playing() { return playing(); },
    get role() { return my.role; }, get state() { return g; }, get team() { return my.team; }, get wish() { return my.wish; },
    teams: T,

    // ---------- the lobby (ui: the pause menu) ----------
    pick(team) { my.wish = team; refresh(); },
    setLength(sec) { if (net.isHost && g.ph === 'lobby') { g.len = sec; refresh(); } },
    // The host starts it: everyone takes the side they asked for, and anyone who did not pick fills the smaller one.
    start() {
      if (!net.isHost || g.ph !== 'lobby') return 'Only the host can start the match.';
      const tm = {}, n = [0, 0], ids = [[net.id, my.wish], ...[...net.remotes.values()].map(r => [r.id, r.wish ?? -1])];
      for (const [id, w] of ids) if (w === 0 || w === 1) { tm[id] = w; n[w]++; }
      for (const [id, w] of ids) if (!(w === 0 || w === 1)) { const t = n[0] <= n[1] ? 0 : 1; tm[id] = t; n[t]++; }
      if (!n[0] || !n[1]) return 'Each side needs at least one player.';
      const len = g.len; g = fresh(); g.len = len; g.tm = tm; g.hf = 1; for (const [id] of ids) stat(id);
      set('count', MATCH.countdown); refresh();
      return '';
    },
    stop() { if (net.isHost) set('lobby', 0); else net.send('end', 0, net.hostId); },

    // ---------- hooks from the rest of the game ----------
    // main.js: money is being added. Only a robber in a running half earns.
    earns(n) { return n <= 0 || (my.role === 'rob' && playing()); },
    // main.js: my health ran out (or, from `cuff`, a cop cuffed me).
    down(cuffedBy) {
      if (game.over) return;
      game.over = true; p.frozen = true; if (p.mode === 'foot') p.tumble = 5;
      const by = cuffedBy || net.hitter(), enemy = by && (g.tm[by] ?? -1) >= 0 && g.tm[by] !== my.team, cop = my.role === 'cop';
      const secs = cop ? MATCH.copDown : MATCH.robberDown; my.downT = g.ph === 'play' ? secs : 1.5;
      let title = cop ? 'OFFICER DOWN' : enemy ? 'BUSTED!' : 'WASTED', sub = '';
      if (playing() && cop) { tell('copdown', { by: enemy ? by : null }); game.audio.wasted(); }
      else if (playing()) {
        const a = Math.round(game.money); game.money = 0; tell('bust', { a, by: enemy ? by : null }); enemy ? game.audio.busted() : game.audio.wasted();
        sub = a > 0 ? (enemy ? `${nameOf(by)} took back ${cash(a)}. ` : `You dropped ${cash(a)}. `) : 'You had nothing on you. ';
      }
      $('bustText').textContent = title; $('bustSub').textContent = sub + `Back in ${Math.round(my.downT)} seconds.`; $('busted').hidden = false;
    },
    // hits.js: I knocked a citizen out.
    mugged() { if (my.role === 'rob' && playing()) { const a = roll(MATCH.mug); game.addMoney(a); game.hud.toast(`MUGGED  +${cash(a)}`, 'good'); } },
    // places.js: my car went through something breakable.
    smashed() { if (my.role === 'rob' && playing()) { game.addMoney(roll(MATCH.smash)); if (net.clock - my.smashT > 2) { my.smashT = net.clock; game.hud.toast('SMASH AND GRAB', 'good'); } } },
    // interiors.js: I held up a store. Its till is empty on every screen, and the cops hear the alarm.
    robbed(here) { if (my.role !== 'rob' || !playing()) return; tell('till', { id: here.id, t: MATCH.tillRefill }); tell('alarm', { x: Math.round(here.door.x), z: Math.round(here.door.z), txt: here.name }); },
    shielded() { return match.on && (g.ph !== 'play' || net.clock < my.shield); },

    // ---------- every frame ----------
    update(dt, t) {
      if (!net.active) { if (my.setup || g.ph !== 'lobby') { g = fresh(); teardown(); refresh(); } bar(); return; }
      // the host keeps the clock, and puts latecomers on the smaller side
      if (net.isHost && g.ph !== 'lobby') {
        g.tl -= dt;
        if (g.tl <= 0) {
          if (g.ph === 'count') set('play', g.len);
          else if (g.ph === 'play') set(g.hf < 2 ? 'half' : 'end', g.hf < 2 ? MATCH.breakTime : 0);
          else if (g.ph === 'half') { g.hf = 2; set('count', MATCH.countdown); }
        }
        for (const r of net.remotes.values()) if (!(r.id in g.tm)) { const n = [0, 0]; for (const k in g.tm) n[g.tm[k]]++; g.tm[r.id] = n[0] <= n[1] ? 0 : 1; stat(r.id); }
      } else if (g.ph === 'play' || g.ph === 'count') g.tl = Math.max(0, g.tl - dt);        // between the host's reports the clock still ticks
      // who I can see, and in what colour
      const on = match.on;
      for (const r of net.remotes.values()) {
        r.team = on ? g.tm[r.id] ?? -1 : -1;
        r.tint(on && r.team >= 0 ? T[r.team].color : r.color);
        if (!on || r.team === my.team || g.ph !== 'play') { r.show = true; continue; }
        const d = Math.hypot(r.x - p.x, r.z - p.z);
        r.show = my.role === 'cop' ? r.hot || d < MATCH.seeRange : d < MATCH.copRange;
      }
      const lk = on ? my.team + ':' + [...net.remotes.values()].map(r => r.team).join() : ''; if (lk !== listKey) { listKey = lk; net.poke(); }      // the player list wears team colours
      for (let i = pings.length - 1; i >= 0; i--) if (net.clock > pings[i].until || !playing()) { kit.unblip(pings[i].blip); pings.splice(i, 1); }
      bar(); lobbyUi();
      if (!on) return;
      for (const s of stashes) s.mark.tick(t, p);
      // down: back on the street after a wait
      if (game.over && my.downT > 0 && (my.downT -= dt) <= 0) { giveKit(); place(spawnSpot()); p.frozen = g.ph === 'count'; }
      if (my.role === 'cop') { const v = p.vehicle; if (v?.type === 'police') { v.siren = playing(); my.siren = v; } else if (my.siren) { my.siren.siren = false; my.siren = null; } }
      if (!playing() || game.over) { kit.ui.hint(''); my.stashT = 0; my.cuffT = 0; return; }
      let hint = '';
      if (my.role === 'rob') {
        // stashing: stand (or sit in a stopped car) in a green ring
        const at = game.money > 0 && stashes.find(s => s.mark.inside(p, p.vehicle ? 1.5 : 0));
        if (at && p.speed < 1.5) {
          my.stashT += dt; hint = `<b>STASH</b>Stashing ${cash(game.money)}… ${Math.min(99, Math.round(my.stashT / MATCH.stashTime * 100))}%`;
          if (my.stashT >= MATCH.stashTime) { const a = Math.round(game.money); game.money = 0; my.stashT = 0; tell('bank', { a }); game.audio.evade(); kit.ui.banner(`STASHED ${cash(a)}`, 'It counts for your team now', 'gold', 2); hint = ''; }
        } else { my.stashT = 0; if (at) hint = '<b>STASH</b>Stop here to stash your cash'; }
      } else {
        // cuffing: hold C beside a robber who is on foot
        let near = null, nd = MATCH.cuffRange;
        if (p.mode === 'foot') for (const r of net.remotes.values()) { if (r.team < 0 || r.team === my.team || r.inCar || r.away || Math.abs(r.y - p.y) > 2) continue; const d = Math.hypot(r.x - p.x, r.z - p.z); if (d < nd) { nd = d; near = r; } }
        if (near && my.cuffT >= 0) {
          if (game.input.down('KeyC')) {
            if (my.cuffing !== near) { my.cuffing = near; my.cuffT = 0; net.send('cuffing', 0, near.id); }
            my.cuffT += dt; hint = `<b>CUFF</b>Cuffing ${near.name}… ${Math.min(99, Math.round(my.cuffT / MATCH.cuffTime * 100))}%`;
            if (my.cuffT >= MATCH.cuffTime) { net.send('cuff', 0, near.id); my.cuffT = -1.2; my.cuffing = null; hint = ''; }
          } else { my.cuffT = 0; my.cuffing = null; hint = `<b>CUFF</b>Hold <kbd>C</kbd> to cuff ${near.name}`; }
        } else if (my.cuffT < 0) my.cuffT = Math.min(0, my.cuffT + dt); else { my.cuffT = 0; my.cuffing = null; }
      }
      kit.ui.hint(hint);
    },
  };

  // ---------- what rides on the snapshots ----------
  net.pack = (s) => { s.tm = my.wish; if (my.role === 'rob' && playing()) s.ca = Math.round(game.money); if (net.isHost) s.g = g; };
  net.unpack = (r, s) => {
    r.wish = s.tm ?? -1; r.carried = s.ca || 0; r.hot = r.carried >= MATCH.hotAt;
    if (s.g && typeof s.g === 'object' && r.id === net.hostId && Array.isArray(s.g.sc) && s.g.tm) adopt(s.g);
  };
  net.canHit = (r) => (!match.on ? g.ph === 'lobby' : g.ph === 'play' && r.team >= 0 && r.team !== my.team);
  net.shielded = () => match.shielded();
  net.onChange(() => { refresh(); });

  // ---------- the bar at the top of the screen ----------
  const top = document.querySelector('.actTop'), barEl = div('match'); barEl.hidden = true; top.prepend(barEl);
  const side = [0, 1].map(i => { const d = div('mTeam t' + i), name = div('mName', T[i].name), score = div('mScore', '$0'), role = div('mRole'); d.style.setProperty('--team', T[i].color); d.append(name, score, role); return { d, score, role }; });
  const mid = div('mMid'), clockEl = div('mClock', '0:00'), phaseEl = div('mPhase'), mine = div('mMine'); mid.append(clockEl, phaseEl);
  barEl.append(side[0].d, mid, side[1].d, mine);
  function bar() {
    const on = match.on; if (barEl.hidden === on) barEl.hidden = !on; if (!on) return;
    const hot = my.role === 'rob' && game.money >= MATCH.hotAt;
    const key = [g.ph, g.hf, Math.ceil(g.tl), g.sc[0], g.sc[1], g.rec[0], g.rec[1], my.team, Math.round(game.money / 10), hot].join();
    if (key === barKey) return; barKey = key;
    for (const i of [0, 1]) { side[i].score.textContent = cash(g.sc[i]); side[i].role.textContent = (i === robTeam() ? 'ROBBERS' : 'COPS') + (i === my.team ? ' · YOU' : ''); side[i].d.classList.toggle('me', i === my.team); }
    clockEl.textContent = g.ph === 'play' ? mmss(g.tl) : g.ph === 'count' ? String(Math.max(1, Math.ceil(g.tl))) : g.ph === 'half' ? 'HALF' : 'END';
    clockEl.classList.toggle('late', g.ph === 'play' && g.tl <= 30);
    phaseEl.textContent = g.ph === 'count' ? 'GET READY' : g.ph === 'half' ? 'SIDES SWAP' : g.ph === 'end' ? 'FINAL' : `HALF ${g.hf} OF 2`;
    mine.textContent = my.role === 'rob' ? `CARRYING ${cash(game.money)}` + (hot ? ' · YOU ARE HOT: THE COPS CAN SEE YOU' : '') : my.role === 'cop' ? `YOUR TEAM HAS RECOVERED ${cash(g.rec[my.team])}` : '';
    mine.classList.toggle('hot', hot);
  }

  // ---------- the lobby on the pause menu ----------
  const lob = { box: $('mLobby'), lists: [$('mList0'), $('mList1')], join: [$('mJoin0'), $('mJoin1')], who: $('mWho'), len: $('mLen'), start: $('mStart'), stop: $('mStop') };
  [0, 1].forEach(i => { const el = lob.box.querySelectorAll('.mSide')[i]; lob.join[i].addEventListener('click', () => match.pick(my.wish === i ? -1 : i)); el.style.setProperty('--team', T[i].color); el.querySelector('b').textContent = T[i].name; });
  for (const sec of MATCH.lengths) { const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost'; b.dataset.len = sec; b.textContent = `${sec / 60} min`; b.addEventListener('click', () => match.setLength(sec)); lob.len.append(b); }
  lob.start.addEventListener('click', () => { const why = match.start(); if (why) lob.who.textContent = why; else game.input.lock(); });
  lob.stop.addEventListener('click', () => match.stop());
  function lobbyUi() {
    const open = net.active; if (lob.box.hidden === open) lob.box.hidden = !open; if (!open || game.state !== 'paused') return;
    const all = [{ id: net.id, name: net.name + ' (you)', wish: my.wish }, ...[...net.remotes.values()].map(r => ({ id: r.id, name: r.name, wish: r.wish ?? -1 }))];
    const running = g.ph !== 'lobby', sideOf = (o) => (running ? g.tm[o.id] ?? -1 : o.wish), host = nameOf(net.hostId);
    const key = JSON.stringify([all.map(o => [o.name, sideOf(o)]), g.ph, g.len, net.isHost, host]); if (key === lobbyKey) return; lobbyKey = key;
    for (const i of [0, 1]) {
      lob.lists[i].textContent = ''; for (const o of all) if (sideOf(o) === i) { const li = document.createElement('li'); li.textContent = o.name; lob.lists[i].append(li); }
      lob.join[i].hidden = running; lob.join[i].textContent = my.wish === i ? 'Leave' : 'Join';
    }
    const loose = all.filter(o => sideOf(o) < 0).map(o => o.name);
    lob.who.textContent = running ? 'A match is being played.' : (loose.length ? `No side yet: ${loose.join(', ')}. Anyone without a side fills the smaller one. ` : '') + (net.isHost ? 'You are the host: start when everyone is in.' : net.hostId ? `Waiting for ${host} to start the match.` : 'Finding the host…');
    lob.len.hidden = lob.start.hidden = running || !net.isHost; lob.stop.hidden = !running || !net.isHost;
    for (const b of lob.len.querySelectorAll('button')) b.classList.toggle('on', +b.dataset.len === g.len);
  }
  const refresh = () => { lobbyKey = ''; barKey = ''; };

  // ---------- the final score ----------
  function results() {
    const box = $('results'), body = $('resBody'); body.textContent = '';
    const w = g.sc[0] !== g.sc[1] ? (g.sc[0] > g.sc[1] ? 0 : 1) : g.rec[0] !== g.rec[1] ? (g.rec[0] > g.rec[1] ? 0 : 1) : -1;
    $('resTitle').textContent = w < 0 ? 'DEAD HEAT' : `${T[w].name} WIN`; $('resTitle').style.color = w < 0 ? '' : T[w].color;
    $('resSub').textContent = w < 0 ? 'Same haul, same recoveries. Play it again.' : w === my.team ? 'That is your team. Nice work.' : 'Your team lost this one.';
    for (const i of [0, 1]) {
      const row = div('resTeam'); row.style.setProperty('--team', T[i].color);
      row.append(div('resName', T[i].name), div('resBig', cash(g.sc[i])), div('resSmall', `stashed as robbers · ${cash(g.rec[i])} recovered as cops`));
      const people = Object.entries(g.pl).filter(([id]) => g.tm[id] === i);
      for (const [id, s] of people) row.append(div('resP', `${s.n}${id === net.id ? ' (you)' : ''}: stashed ${cash(s.b)}, ${s.u} ${s.u === 1 ? 'bust' : 'busts'}`));
      body.append(row);
    }
    const best = (k) => Object.values(g.pl).filter(s => s[k] > 0).sort((a, b) => b[k] - a[k])[0];
    const earner = best('b'), cop = best('u');
    $('resAwards').textContent = [earner && `Top earner: ${earner.n} (${cash(earner.b)})`, cop && `Top cop: ${cop.n} (${cop.u} ${cop.u === 1 ? 'bust' : 'busts'})`].filter(Boolean).join('  ·  ');
    $('resBack').hidden = !net.isHost; $('resWait').hidden = net.isHost; $('resWait').textContent = `Waiting for ${nameOf(net.hostId)} to go back to the lobby.`;
    box.hidden = false; game.audio.evade(); document.exitPointerLock?.();       // the mouse comes back for the button
  }
  $('resBack').addEventListener('click', () => match.stop());

  return match;
}
