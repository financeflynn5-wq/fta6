// You (Rocco, unless another character is picked on the menu): walking, sprinting, getting in and out of cars, and getting knocked about.
import { PLAYER } from '../config.js';
import { clamp, damp, lerp, angleDiff } from '../core/utils.js';
import { groundY } from '../world/city.js';
import { makeCharacter, animateCharacter, CIVILIANS, PLAYABLE } from '../characters/models.js';
import { AIDriver } from '../vehicles/aiDriver.js';

const pickCivilian = () => CIVILIANS[Math.floor(Math.random() * CIVILIANS.length)];

export function createPlayer(game) {
  let who = 'rocco';
  try { const s = localStorage.getItem('fta6.who'); if (PLAYABLE.some(([id]) => id === s)) who = s; } catch { /* storage blocked: Rocco it is */ }
  let look; try { if (who === 'bighead') look = JSON.parse(localStorage.getItem('fta6.look') || 'null') || undefined; } catch { /* a fresh face, then */ }
  let model = makeCharacter(who, { props: false, look }); game.scene.add(model);
  const body = game.physics.addPerson(null, PLAYER.spawn.x, PLAYER.spawn.z, PLAYER.radius);
  const vel = { x: 0, y: 0 };

  const player = {
    isPlayer: true, model, who, body, mode: 'foot', vehicle: null, nearCar: null,
    x: PLAYER.spawn.x, z: PLAYER.spawn.z, y: .3, vx: 0, vz: 0, speed: 0, face: Math.PI,
    px: PLAYER.spawn.x, pz: PLAYER.spawn.z, ix: PLAYER.spawn.x, iz: PLAYER.spawn.z,   // last step's position, and where Rocco is drawn this frame
    health: PLAYER.health, armor: 0, aiming: false, stamina: PLAYER.stamina, tumble: 0, winded: false, stepT: 0, frozen: false,

    preStep(dt) {
      const input = game.input;
      player.px = player.x; player.pz = player.z;
      if (player.frozen || game.state !== 'playing') { if (player.mode === 'car') { const c = player.vehicle.controls; c.throttle = 0; c.steer = 0; c.handbrake = true; } else body.setLinvel({ x: 0, y: 0 }, true); return; }
      if (player.mode === 'car') {
        const v = player.vehicle, c = v.controls;
        c.throttle = input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
        c.steer = input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
        c.handbrake = input.down('Space');
        if (input.hit('KeyH')) game.honk(v);
        if (input.hit('KeyE', 'KeyF')) player.exit();
        return;
      }
      if (player.tumble > 0) {
        player.tumble -= dt; const v = body.linvel(); vel.x = v.x * Math.max(0, 1 - 3 * dt); vel.y = v.y * Math.max(0, 1 - 3 * dt); body.setLinvel(vel, true); return;
      }
      // walk relative to where the camera looks
      const f = input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']), r = input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
      const yaw = game.cam.yaw, len = Math.hypot(f, r) || 1;
      const mx = (Math.cos(yaw) * f - Math.sin(yaw) * r) / len, mz = (Math.sin(yaw) * f + Math.cos(yaw) * r) / len;
      const moving = f || r;
      const wantSprint = input.down('ShiftLeft', 'ShiftRight') && moving && !player.winded;
      player.stamina = clamp(player.stamina + (wantSprint ? -dt : dt * PLAYER.staminaRegen * (moving ? 1 : 2)), 0, PLAYER.stamina);
      if (player.stamina <= 0) player.winded = true; else if (player.stamina > PLAYER.stamina * .35) player.winded = false;
      const top = player.aiming ? PLAYER.walk * (game.combat?.aiming ? .55 : .8) : wantSprint ? PLAYER.sprint : PLAYER.walk;
      const v = body.linvel();
      vel.x = damp(v.x, moving ? mx * top : 0, PLAYER.accel, dt); vel.y = damp(v.y, moving ? mz * top : 0, PLAYER.accel, dt);
      body.setLinvel(vel, true);
      if (moving && !player.aiming) player.face += angleDiff(Math.atan2(mx, mz), player.face) * Math.min(1, dt * 14);   // when aiming, combat turns Rocco

      // which car could we take? (not one another player is sitting in)
      let best = null, bd = PLAYER.enterRange;
      for (const c of game.traffic.vehicles) { if (c.wrecked || c.ghost && c.driver || Math.abs(c.y - player.y) > 2.5) continue; const d = c.distanceTo(player.x, player.z); if (d < bd) { bd = d; best = c; } }
      player.nearCar = best;
      if (best && input.hit('KeyE', 'KeyF')) player.enter(best.ghost ? game.net.claim(best) : best);      // a car another player left behind becomes ours first
    },

    postStep() {
      if (player.mode === 'car') { const v = player.vehicle; player.x = v.x; player.z = v.z; player.vx = v.vx; player.vz = v.vz; player.speed = v.speed; return; }
      const p = body.translation(), v = body.linvel();
      player.x = p.x; player.z = p.y; player.vx = v.x; player.vz = v.y; player.speed = Math.hypot(v.x, v.y);
      if (Math.abs(player.x - player.px) + Math.abs(player.z - player.pz) > 2) { player.px = player.x; player.pz = player.z; }   // respawned or stepped out of a car
    },

    enter(car) {
      const old = car.driver, speed = car.speed;
      if (old instanceof AIDriver && old.mode !== 'wait') {
        // whoever was driving gets tossed out of the driver's door
        const cop = car.type === 'police';
        const out = car.halfWid + .95;
        game.peds.spawn(cop ? 'pigeon' : (old.kind || undefined) ?? pickCivilian(), car.x - car.rx * out, car.z - car.rz * out, -car.rx * 4 + car.vx * .4, -car.rz * 4 + car.vz * .4, cop);
      }
      car.driver = 'player'; player.vehicle = car; player.mode = 'car'; player.nearCar = null;
      car.dropRider();                                   // whoever was riding is now that pedestrian
      body.setEnabled(false); if (!car.seat(model)) model.visible = false;      // on a bike you can see Rocco ride
      game.onCarTaken(car, old, speed);
    },

    exit() {
      const car = player.vehicle, ph = game.physics;
      // driver's side first, then passenger side, then out the back
      const side = car.halfWid + .8, end = car.halfLen + .9;
      const spots = [[-car.rx * side, -car.rz * side], [car.rx * side, car.rz * side], [-car.fx * end, -car.fz * end], [car.fx * end, car.fz * end]];
      let sx = car.x + spots[0][0], sz = car.z + spots[0][1];
      for (const [ox, oz] of spots) {
        const x = car.x + ox, z = car.z + oz;
        if (ph.blocked(car.x, car.z, x + ox * .3, z + oz * .3) >= 0) continue;
        if (game.traffic.vehicles.some(o => o !== car && o.distanceTo(x, z) < .6)) continue;
        sx = x; sz = z; break;
      }
      if (car.rider === model) { car.unseat(); game.scene.add(model); }
      body.setEnabled(true); body.setTranslation({ x: sx, y: sz }, true);
      player.x = player.px = sx; player.z = player.pz = sz; player.face = -car.h + Math.PI / 2;
      car.driver = null; car.controls.throttle = 0; player.vehicle = null; player.mode = 'foot'; model.visible = true;
      if (car.speed > PLAYER.bailSpeed) {         // bailing out at speed hurts
        body.setLinvel({ x: car.vx * .7, y: car.vz * .7 }, true); player.tumble = 1.3; player.hurt(4 + (car.speed - PLAYER.bailSpeed) * 1.3);
      } else body.setLinvel({ x: 0, y: 0 }, true);
      game.audio.door(); game.onCarLeft(car);
    },

    // Become someone else (the menus): a new body in the same spot, holding the same guns.
    setCharacter(kind, made) {
      const old = model, riding = player.vehicle?.rider === old;
      if (riding) player.vehicle.unseat();
      model = player.model = made || makeCharacter(kind, { props: false }); player.who = kind;
      model.position.copy(old.position); model.rotation.y = player.face; model.visible = old.visible;
      game.combat?.rehand(old);                              // the guns change hands before the old body goes
      old.removeFromParent(); old.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
      if (!riding || !player.vehicle.seat(model)) game.scene.add(model);
      try { localStorage.setItem('fta6.who', kind); } catch { /* fine */ }
      game.env?.touch();
    },

    // Hit by a moving car while on foot.
    knock(car) {
      if (player.mode !== 'foot' || player.tumble > .6) return;
      const rel = Math.hypot(car.vx - player.vx, car.vz - player.vz); if (rel < 3.5) return;
      body.setLinvel({ x: car.vx * .9, y: car.vz * .9 }, true); player.tumble = 1.4;
      player.hurt(rel * 2.1); game.audio.bonk(); game.cam.shake(.5);
    },
    // Knocked off a motorbike by a crash.
    thrown(impact) {
      const car = player.vehicle; if (!car || game.over) return;
      const vx = car.vx, vz = car.vz;
      player.exit(); body.setLinvel({ x: vx * .6, y: vz * .6 }, true);
      player.tumble = Math.max(player.tumble, 1.5); player.hurt(impact * 1.5); game.cam.shake(.5); game.hud.toast('WIPEOUT!', 'bad');
    },
    // Armor soaks damage first.
    hurt(d) {
      if (game.over) return;
      const soak = Math.min(player.armor, d); player.armor -= soak; d -= soak;
      player.health = Math.max(0, player.health - d); game.hud.hurt(); if (player.health <= 0) game.knockedOut();
    },

    // spot: { x, z, face } outside the hospital or police station; defaults to the start.
    respawn(spot = { x: PLAYER.spawn.x, z: PLAYER.spawn.z, face: Math.PI }) {
      if (player.mode === 'car') { const car = player.vehicle; if (car.rider === model) { car.unseat(); game.scene.add(model); } car.driver = null; player.vehicle = null; player.mode = 'foot'; model.visible = true; body.setEnabled(true); }
      body.setTranslation({ x: spot.x, y: spot.z }, true); body.setLinvel({ x: 0, y: 0 }, true);
      player.x = player.px = spot.x; player.z = player.pz = spot.z; player.health = PLAYER.health; player.armor = 0; player.stamina = PLAYER.stamina; player.tumble = 0; player.face = spot.face;
    },

    update(dt, t) {
      if (game.police.stars === 0 && player.health < PLAYER.health) player.health = Math.min(PLAYER.health, player.health + PLAYER.regen * dt);
      if (player.mode !== 'foot') { player.ix = player.vehicle.ix; player.iz = player.vehicle.iz; return; }
      const k = game.alpha ?? 1;     // draw between the last two physics steps, so walking is smooth at any frame rate
      player.ix = lerp(player.px, player.x, k); player.iz = lerp(player.pz, player.z, k);
      player.y = damp(player.y, groundY(player.ix, player.iz, player.y), 16, dt);
      model.position.set(player.ix, player.y, player.iz);
      if (player.tumble > 0) player.face += dt * 10;
      model.rotation.y = player.face;
      animateCharacter(model, t, dt, player.speed, player.tumble > 0 ? 'down' : player.speed > .4 ? 'move' : 'stand');
      if (player.speed > 1 && player.tumble <= 0 && (player.stepT -= dt * player.speed) <= 0) { player.stepT = 1.9; game.audio.step(); }
    },
  };
  game.physics.owners.set(body.collider(0).handle, player);
  return player;
}

