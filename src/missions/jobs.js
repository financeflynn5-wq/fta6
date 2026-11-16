// Jobs that pay. Two ways to earn:
//   Chop-shop orders: Scrap pages you with a car he wants. Steal the marked one, lose any heat,
//     and park it on the pink marker outside his shop. Any other stolen car is still worth scrap.
//   Taxi fares: sit in a cab and people hail you. Get them there quickly and smoothly for a tip.
import * as THREE from 'three';
import { WORLD, JOBS } from '../config.js';
import { choose, clamp, rnd } from '../core/utils.js';
import { groundY } from '../world/city.js';
import { ctex } from '../world/materials.js';
import { frontage, hangSign } from '../world/landmarks.js';
import { animateCharacter, setCharacterShadow, CIVILIANS } from '../characters/models.js';

const PINK = 0xff4fd8, GOLD = 0xffd34d;
const DISTRICTS = [['PALM HEIGHTS', 'NEON ROW', 'PIER SIDE'], ['OLD TOWN', 'MIDTOWN', 'SUNSET STRIP'], ['THE FLATS', 'MARKET ROW', 'DOCKSIDE']];
const third = (v) => clamp(Math.floor((v / WORLD.LIMIT + 1) * 1.5), 0, 2);
const district = (x, z) => DISTRICTS[third(z)][third(x)];
const money = (n) => '$' + Math.round(n).toLocaleString('en-US'), round10 = (n) => Math.round(n / 10) * 10;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---------- glowing markers ----------
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); return new THREE.CanvasTexture(c); }
const fadeTex = canvasTex(4, 128, (x) => { const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)'); x.fillStyle = g; x.fillRect(0, 0, 4, 128); });
const ringTex = canvasTex(256, 256, (x) => {
  const g = x.createRadialGradient(128, 128, 70, 128, 128, 126); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.45, 'rgba(255,255,255,.25)'); g.addColorStop(.8, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
});
const glow = (color, map, opacity) => new THREE.MeshBasicMaterial({ map, color: new THREE.Color(color).multiplyScalar(1.5), opacity, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });

// A ring on the road with a low wall of light, and a tall thin beam you can spot over the rooftops.
function makeMarker(scene, color, radius) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 2.2, 40, 1, true), glow(color, fadeTex, .5)); wall.position.y = 1.1;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.4, .4, 80, 10, 1, true), glow(color, fadeTex, .5)); beam.position.y = 40;
  const flat = new THREE.PlaneGeometry(radius * 2.5, radius * 2.5); flat.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(flat, glow(color, ringTex, .8)); ring.position.y = .06;
  g.add(wall, beam, ring); g.visible = false; scene.add(g);
  return {
    x: 0, z: 0,
    place(x, z) { this.x = x; this.z = z; g.position.set(x, groundY(x, z), z); g.visible = true; },
    hide() { g.visible = false; },
    pulse(t, strong = 1) { wall.material.opacity = (.32 + Math.sin(t * 4) * .1) * strong; ring.material.opacity = (.6 + Math.sin(t * 4) * .2) * strong; beam.material.opacity = .45 * strong; wall.scale.y = 1 + Math.sin(t * 2.2) * .12; },
  };
}

function chopSign(name) {
  const [top, ...rest] = name.split(' ');
  return ctex(1024, (x, s) => {
    const h = s / 2.3, y0 = (s - h) / 2;
    x.clearRect(0, 0, s, s);
    x.fillStyle = '#17181f'; x.beginPath(); x.roundRect(10, y0, s - 20, h, 40); x.fill();
    x.lineWidth = 14; x.strokeStyle = '#ff4fd8'; x.stroke();
    // emblem: a gold gear
    const cx = 70 + h * .34, cy = s / 2, r = h * .3;
    x.fillStyle = '#ffd34d'; x.beginPath();
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rr = i % 2 ? r : r * .76; x.lineTo(cx + Math.cos(a - .12) * rr, cy + Math.sin(a - .12) * rr); x.lineTo(cx + Math.cos(a + .12) * rr, cy + Math.sin(a + .12) * rr); }
    x.fill(); x.fillStyle = '#17181f'; x.beginPath(); x.arc(cx, cy, r * .34, 0, 7); x.fill();
    const tx = (cx + r + s - 30) / 2;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '900 128px "Archivo Black",Impact,sans-serif'; x.fillStyle = '#ffffff'; x.fillText(top, tx, cy - h * .2);
    x.font = '900 104px "Archivo Black",Impact,sans-serif'; x.fillStyle = '#ff4fd8'; x.fillText(rest.join(' '), tx, cy + h * .22);
  });
}

export function createJobs(game) {
  const { player, police, hud, audio, peds, traffic, fx } = game, O = JOBS.orders, T = JOBS.taxi;
  const half = WORLD.BLOCK / 2, mid = WORLD.PITCH / 2;

  // ---------- Scrap's chop shop ----------
  const [csx, csz] = JOBS.chop.side;
  const front = frontage(game.city.solids.boxes, JOBS.chop.block, JOBS.chop.side);
  const bcx = mid + WORLD.PITCH * JOBS.chop.block[0], bcz = mid + WORLD.PITCH * JOBS.chop.block[1];
  const chop = {
    x: csx ? bcx + csx * (half + 3.6) : (front ? front.fx : bcx), z: csz ? bcz + csz * (half + 3.6) : (front ? front.fz : bcz),
    r: JOBS.chop.radius, name: JOBS.chop.name,
  };
  if (front) hangSign(game.scene, front, JOBS.chop.side, chopSign(chop.name));
  for (const v of traffic.vehicles.slice()) if (!v.driver && dist(v, chop) < chop.r + 4) traffic.remove(v);   // keep the bay clear
  const chopMark = makeMarker(game.scene, PINK, chop.r); chopMark.place(chop.x, chop.z);
  const stopMark = makeMarker(game.scene, GOLD, 3.2);
  // the arrow that hangs over the car Scrap wants
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(.6, 1.2, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(PINK).multiplyScalar(1.4), toneMapped: false }));
  arrow.rotation.x = Math.PI; arrow.visible = false; game.scene.add(arrow);

  // ---------- chop-shop orders ----------
  let order = null, orderWait = O.first, done = 0, warnT = 0, scrapped = 0, sinceHot = 0;
  const isOrderCar = (car) => !!(order && car && !car.wrecked && (order.car ? order.car === car : car.type === order.type));
  const orderValue = (car) => round10(order.pay * (.4 + .6 * car.health / car.stats.health));
  const scrapValue = (car) => Math.max(20, round10(O.scrap[car.type] * car.health / car.stats.health));

  function newOrder() {
    if (++sinceHot >= O.hotEvery) {
      sinceHot = 0;
      order = { type: 'police', car: null, pay: O.pay.police, life: O.life };
      hud.toast(`HOT ORDER: A COP CRUISER  ${money(order.pay)}`, 'job');
    } else {
      let total = 0, type = 'car'; for (const k in O.want) total += O.want[k];
      let pickN = Math.random() * total; for (const k in O.want) { pickN -= O.want[k]; if (pickN < 0) { type = k; break; } }
      const away = (x, z) => Math.hypot(x - chop.x, z - chop.z) > 60;
      const parked = traffic.vehicles.filter(v => v.type === type && !v.driver && !v.stolen && !v.wrecked && dist(v, player) > O.minDist && away(v.x, v.z));
      const car = parked.length ? choose(parked) : traffic.spawnParked(type, O.minDist, away);
      if (!car) { orderWait = 4; return; }
      order = { type, car, pay: round10(O.pay[type] + dist(car, chop) * 1.2), life: O.life };
      hud.toast(`${O.rare.includes(type) ? 'RARE ORDER:' : 'SCRAP WANTS'} A ${car.stats.name}  ${money(order.pay)}`, 'job');
    }
    audio.pager();
  }
  function endOrder(text) { if (text) hud.toast(text, 'bad'); order = null; orderWait = O.gap; }

  function chopCar(car) {
    let pay, label;
    if (isOrderCar(car)) {
      const frac = car.health / car.stats.health;
      pay = orderValue(car); label = frac > .9 ? 'MINT CONDITION' : frac > .5 ? 'ORDER DELIVERED' : 'ROUGH, BUT SOLD';
      done++; order = null; orderWait = O.gap;
    } else { pay = scrapValue(car); label = 'SCRAPPED'; scrapped++; }
    player.exit();                                // also ends any fare riding in this car
    for (let i = 0; i < 3; i++) fx.spark(car.x + rnd(-1.5, 1.5), .9, car.z + rnd(-1.5, 1.5), 8, 1.2);
    for (let i = 0; i < 6; i++) fx.smoke(car.x + rnd(-1.5, 1.5), .8, car.z + rnd(-1.5, 1.5), .85, 2.2, 1.1);
    audio.wrench(); traffic.remove(car); player.nearCar = null;
    game.addMoney(pay); hud.toast(`${label}  +${money(pay)}`, 'good');
  }

  // ---------- taxi fares ----------
  let fare = null, fareWait = 1, streak = 0, fares = 0, cabHint = true, bumpT = 0;
  const posts = game.city.solids.posts;

  // A spot at the kerb of a random block: where someone stands (x, z) and where a cab pulls up (sx, sz).
  function kerbSpot(ok) {
    for (let tries = 0; tries < 80; tries++) {
      const cx = mid + WORLD.PITCH * choose(WORLD.blocksIdx), cz = mid + WORLD.PITCH * choose(WORLD.blocksIdx);
      const [nx, nz] = choose([[1, 0], [-1, 0], [0, 1], [0, -1]]), u = rnd(-13, 13);
      const x = cx + nx * (half - .9) - nz * u, z = cz + nz * (half - .9) + nx * u;
      const sx = cx + nx * (half + 3.2) - nz * u, sz = cz + nz * (half + 3.2) + nx * u;
      if (Math.hypot(sx - chop.x, sz - chop.z) < chop.r + 12 || !ok(sx, sz)) continue;
      if (posts.some(p => Math.abs(p.x - x) < 1.3 && Math.abs(p.z - z) < 1.3)) continue;
      return { x, z, sx, sz, nx, nz };
    }
    return null;
  }
  function hail() {
    const near = (x, z) => { const d = Math.hypot(x - player.x, z - player.z); return d > T.pickupMin && d < T.pickupMax; };
    const s = kerbSpot(near); if (!s) { fareWait = 2; return; }
    const ped = peds.release(peds.spawn(choose(CIVILIANS), s.x, s.z)); ped.panic = 0; ped.face = Math.atan2(s.nx, s.nz); ped.speed = 0;
    fare = { state: 'hail', ped, at: s, cab: null, dest: null, amount: 0, par: 0, time: 0, mood: 1, idle: 0 };
    stopMark.place(s.sx, s.sz);
    if (cabHint) { cabHint = false; hud.toast('CAB\'S YOURS: PICK UP THE GOLD MARKER', 'info'); }
  }
  function board(cab) {
    const from = fare.at, far = (x, z) => { const d = Math.abs(x - from.sx) + Math.abs(z - from.sz); return d > T.tripMin && d < T.tripMax; };
    const to = kerbSpot(far) || kerbSpot(() => true);
    const street = Math.abs(to.sx - from.sx) + Math.abs(to.sz - from.sz);
    fare.state = 'ride'; fare.cab = cab; fare.dest = { ...to, name: district(to.sx, to.sz) };
    fare.amount = round10((T.flag + street * T.perMetre) * (1 + Math.min(streak, T.streakMax) * T.streak));
    fare.par = street / T.pace + T.slack; fare.time = 0; fare.mood = 1;
    fare.ped.model.visible = false; stopMark.place(to.sx, to.sz);
    audio.door(); hud.toast(`${fare.dest.name}, AND STEP ON IT`, 'info');
  }
  const tipNow = () => Math.round(fare.amount * T.tip * fare.mood * clamp(2 - fare.time / fare.par, 0, 1));
  // Put the passenger back on the street beside the cab (or wherever they stand) and let them walk off.
  function letOut(scared = false) {
    const ped = fare.ped, cab = fare.cab;
    if (cab) {
      const kerb = fare.dest, side = kerb && ((kerb.x - cab.x) * cab.rx + (kerb.z - cab.z) * cab.rz) < 0 ? -1 : 1;
      ped.x = cab.x + cab.rx * 1.7 * side; ped.z = cab.z + cab.rz * 1.7 * side;
    }
    ped.model.visible = true; peds.adopt(ped); if (scared) ped.panic = 8;
    fare = null; stopMark.hide();
  }
  function loseFare(text) { hud.toast(text, 'bad'); letOut(true); streak = 0; fareWait = 6; }
  function payFare() {
    const tip = tipNow(), total = fare.amount + tip;
    streak++; fares++; audio.door();
    game.addMoney(total);
    hud.toast(tip > 0 ? `FARE ${money(fare.amount)} + ${money(tip)} TIP` : `FARE ${money(fare.amount)}. NO TIP`, 'good');
    if (streak > 1 && streak <= T.streakMax + 1) hud.toast(`${streak} IN A ROW: FARES PAY +${Math.round(Math.min(streak, T.streakMax) * T.streak * 100)}%`, 'info');
    letOut(); fareWait = 2.5;
  }
  function showPed(ped, t, dt, pose) {
    const far = dist(ped, player);
    ped.y = groundY(ped.x, ped.z); ped.model.position.set(ped.x, ped.y, ped.z); ped.model.rotation.y = ped.face;
    ped.model.visible = far < 130; setCharacterShadow(ped.model, far < 60);
    if (far < 90) animateCharacter(ped.model, t, dt, ped.speed, pose);
  }

  function updateFare(dt, t, cab) {
    if (!fare) {
      if (cab && police.stars === 0 && (fareWait -= dt) <= 0) hail();
      return;
    }
    const ped = fare.ped;
    if (fare.state === 'ride') {
      fare.time += dt; bumpT -= dt;
      if (player.vehicle !== fare.cab) loseFare('FARE WALKED OFF');
      else if (fare.cab.wrecked) loseFare('FARE BAILED OUT');
      else if (police.stars > 0) loseFare('TOO MUCH HEAT: FARE BAILED');
      else if (Math.hypot(fare.cab.x - fare.dest.sx, fare.cab.z - fare.dest.sz) < T.stop && fare.cab.speed < 1.2) payFare();
      return;
    }
    // waiting at the kerb, or running over to the cab
    if (!cab || police.stars > 0) { if ((fare.idle += dt) > 20 || police.stars > 0) { letOut(police.stars > 0); fareWait = 3; return; } }
    else fare.idle = 0;
    const d = cab ? dist(ped, cab) : 1e9;
    if (cab && d < T.hail && cab.speed < 1.2) fare.state = 'board';
    else if (fare.state === 'board' && (!cab || d > T.hail + 5 || cab.speed > 4)) fare.state = 'hail';
    if (fare.state === 'board') {
      const side = ((ped.x - cab.x) * cab.rx + (ped.z - cab.z) * cab.rz) < 0 ? -1 : 1;
      const tx = cab.x + cab.rx * 1.5 * side, tz = cab.z + cab.rz * 1.5 * side, dx = tx - ped.x, dz = tz - ped.z, left = Math.hypot(dx, dz);
      if (left < .6) { board(cab); return; }
      ped.speed = 5.5; ped.x += dx / left * ped.speed * dt; ped.z += dz / left * ped.speed * dt; ped.face = Math.atan2(dx, dz);
      showPed(ped, t, dt, 'move');
    } else {
      ped.speed = 0;
      if (cab && d < 45) ped.face = Math.atan2(cab.x - ped.x, cab.z - ped.z);
      showPed(ped, t, dt, cab && d < 45 ? 'flail' : 'stand');
    }
  }

  const jobs = {
    chop,
    get order() { return order; }, get fare() { return fare; },
    get stats() { return { orders: done, scrapped, fares, streak }; },
    orderNow() { orderWait = 0; },                      // for tests

    onCarTaken(car) {
      if (isOrderCar(car)) hud.toast(police.stars > 0 ? 'GOT IT. LOSE THE COPS, THEN SCRAP\'S' : 'GOT IT. TAKE IT TO SCRAP\'S', 'job');
    },
    // a hard knock with a passenger aboard costs you some of the tip
    onCrash(v, impact) {
      if (!fare || fare.state !== 'ride' || v !== fare.cab || impact < T.bumpImpact || bumpT > 0) return;
      bumpT = 1.2; fare.mood *= 1 - T.bump; audio.oof(); hud.toast(choose(['HEY! WATCH IT!', 'EASY ON THE PAINT!', 'MY COFFEE!']), 'bad');
    },

    // Blips for the radar: Scrap's, the car he wants, and the fare.
    blips() {
      const car = player.vehicle, holding = isOrderCar(car);
      const out = [{ x: chop.x, z: chop.z, kind: 'chop', hot: holding }];
      if (order?.car && !holding) out.push({ x: order.car.x, z: order.car.z, kind: 'car', hot: true });
      if (fare) out.push(fare.state === 'ride' ? { x: fare.dest.sx, z: fare.dest.sz, kind: 'dest', hot: true } : { x: fare.ped.x, z: fare.ped.z, kind: 'fare', hot: true });
      return out;
    },

    // What the job panel says: [tag, text, cash] rows.
    lines() {
      const rows = [], car = player.vehicle, metres = (p) => Math.max(10, round10(Math.hypot(p.x - player.x, p.z - player.z))) + ' m';
      if (fare) {
        if (fare.state === 'ride') { const tip = tipNow(); rows.push(['FARE', `Drop off in ${fare.dest.name} · ${metres({ x: fare.dest.sx, z: fare.dest.sz })}`, money(fare.amount) + (tip > 0 ? ` + ${money(tip)} tip` : '')]); }
        else rows.push(['FARE', fare.state === 'board' ? 'Hold still, they\'re getting in' : `Pick up in ${district(fare.at.sx, fare.at.sz)} · ${metres(fare.ped)}`, '']);
      }
      if (order) {
        if (isOrderCar(car)) rows.push(['ORDER', police.stars > 0 ? 'Lose the cops, then park it at Scrap\'s' : `Park it at Scrap's · ${metres(chop)}`, money(orderValue(car))]);
        else if (order.car) rows.push(['ORDER', `Steal the marked ${order.car.stats.name.toLowerCase()} · ${metres(order.car)}`, money(order.pay)]);
        else rows.push(['HOT ORDER', 'Bring Scrap a cop cruiser', money(order.pay)]);
      } else if (car && !car.wrecked && !fare && dist(car, chop) < 60) rows.push(['SCRAP', 'Park on the pink marker to sell this car', money(scrapValue(car))]);
      return rows;
    },

    update(dt, t) {
      const car = player.vehicle, holding = isOrderCar(car);
      chopMark.pulse(t, car ? 1 : .45); stopMark.pulse(t * 1.3);
      const tagged = order?.car && !holding ? order.car : null;
      arrow.visible = !!tagged;
      if (tagged) { arrow.position.set(tagged.ix, tagged.y + 3.5 + Math.sin(t * 4) * .25, tagged.iz); arrow.rotation.y = t * 2.5; }
      if (game.state !== 'playing' || game.over) return;

      // orders
      if (!order) { if ((orderWait -= dt) <= 0 && police.stars === 0) newOrder(); }
      else if (order.car && !traffic.vehicles.includes(order.car)) endOrder('ORDER LOST');
      else if (order.car?.wrecked) endOrder('ORDER WRECKED');
      else if (!holding && (order.life -= dt) <= 0) { order = null; orderWait = 1; }      // ignored for long enough: Scrap asks for something else

      // parking a car on Scrap's marker
      if (car && !car.wrecked && dist(car, chop) < chop.r) {
        if (police.stars > 0) { if ((warnT -= dt) <= 0) { warnT = 5; hud.toast('LOSE THE COPS FIRST', 'bad'); } }
        else if (car.speed < 1.5) chopCar(car);
      } else warnT = 0;

      // fares: any taxi you're driving, unless it's the one Scrap ordered
      const cab = player.vehicle && player.vehicle.type === 'taxi' && !player.vehicle.wrecked && !isOrderCar(player.vehicle) ? player.vehicle : null;
      updateFare(dt, t, cab);
    },
  };
  return jobs;
}
