// Rocco: walking, sprinting, getting in and out of cars, and getting knocked about.
import { PLAYER } from '../config.js';
import { clamp, damp, angleDiff } from '../core/utils.js';
import { groundY } from '../world/city.js';
import { makeCharacter, animateCharacter, CIVILIANS } from '../characters/models.js';
import { AIDriver } from '../vehicles/aiDriver.js';

const pickCivilian = () => CIVILIANS[Math.floor(Math.random() * CIVILIANS.length)];

export function createPlayer(game) {
  const model = makeCharacter('rocco'); game.scene.add(model);
  const body = game.physics.addPerson(null, PLAYER.spawn.x, PLAYER.spawn.z, PLAYER.radius);
  const vel = { x: 0, y: 0 };

  const player = {
    isPlayer: true, model, body, mode: 'foot', vehicle: null, nearCar: null,
    x: PLAYER.spawn.x, z: PLAYER.spawn.z, y: .3, vx: 0, vz: 0, speed: 0, face: Math.PI,
    health: PLAYER.health, stamina: PLAYER.stamina, tumble: 0, winded: false, stepT: 0, frozen: false,

    preStep(dt) {
      const input = game.input;
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
      const top = wantSprint ? PLAYER.sprint : PLAYER.walk;
      const v = body.linvel();
      vel.x = damp(v.x, moving ? mx * top : 0, PLAYER.accel, dt); vel.y = damp(v.y, moving ? mz * top : 0, PLAYER.accel, dt);
      body.setLinvel(vel, true);
      if (moving) player.face += angleDiff(Math.atan2(mx, mz), player.face) * Math.min(1, dt * 14);

      // which car could we take?
      let best = null, bd = PLAYER.enterRange;
      for (const c of game.traffic.vehicles) { if (c.wrecked) continue; const d = c.distanceTo(player.x, player.z); if (d < bd) { bd = d; best = c; } }
      player.nearCar = best;
      if (best && input.hit('KeyE', 'KeyF')) player.enter(best);
    },

    postStep() {
      if (player.mode === 'car') { const v = player.vehicle; player.x = v.x; player.z = v.z; player.vx = v.vx; player.vz = v.vz; player.speed = v.speed; return; }
      const p = body.translation(), v = body.linvel();
      player.x = p.x; player.z = p.y; player.vx = v.x; player.vz = v.y; player.speed = Math.hypot(v.x, v.y);
    },

    enter(car) {
      const old = car.driver, speed = car.speed;
      if (old instanceof AIDriver && old.mode !== 'wait') {
        // whoever was driving gets tossed out of the driver's door
        const cop = car.type === 'police';
        game.peds.spawn(cop ? 'pigeon' : (old.kind || undefined) ?? pickCivilian(), car.x - car.rx * 1.9, car.z - car.rz * 1.9, -car.rx * 4 + car.vx * .4, -car.rz * 4 + car.vz * .4, cop);
      }
      car.driver = 'player'; player.vehicle = car; player.mode = 'car'; player.nearCar = null;
      body.setEnabled(false); model.visible = false;
      game.onCarTaken(car, old, speed);
    },

    exit() {
      const car = player.vehicle, ph = game.physics;
      // driver's side first, then passenger side, then out the back
      const spots = [[-car.rx * 1.75, -car.rz * 1.75], [car.rx * 1.75, car.rz * 1.75], [-car.fx * 3.2, -car.fz * 3.2], [car.fx * 3.2, car.fz * 3.2]];
      let sx = car.x + spots[0][0], sz = car.z + spots[0][1];
      for (const [ox, oz] of spots) {
        const x = car.x + ox, z = car.z + oz;
        if (ph.blocked(car.x, car.z, x + ox * .3, z + oz * .3) >= 0) continue;
        if (game.traffic.vehicles.some(o => o !== car && o.distanceTo(x, z) < .6)) continue;
        sx = x; sz = z; break;
      }
      body.setEnabled(true); body.setTranslation({ x: sx, y: sz }, true);
      player.x = sx; player.z = sz; player.face = -car.h + Math.PI / 2;
      car.driver = null; car.controls.throttle = 0; player.vehicle = null; player.mode = 'foot'; model.visible = true;
      if (car.speed > PLAYER.bailSpeed) {         // bailing out at speed hurts
        body.setLinvel({ x: car.vx * .7, y: car.vz * .7 }, true); player.tumble = 1.3; player.hurt(4 + (car.speed - PLAYER.bailSpeed) * 1.3);
      } else body.setLinvel({ x: 0, y: 0 }, true);
      game.audio.door(); game.onCarLeft(car);
    },

    // Hit by a moving car while on foot.
    knock(car) {
      if (player.mode !== 'foot' || player.tumble > .6) return;
      const rel = Math.hypot(car.vx - player.vx, car.vz - player.vz); if (rel < 3.5) return;
      body.setLinvel({ x: car.vx * .9, y: car.vz * .9 }, true); player.tumble = 1.4;
      player.hurt(rel * 2.1); game.audio.bonk(); game.cam.shake(.5);
    },
    hurt(d) { player.health = Math.max(0, player.health - d); game.hud.hurt(); if (player.health <= 0) game.knockedOut(); },

    respawn() {
      if (player.mode === 'car') { const car = player.vehicle; car.driver = null; player.vehicle = null; player.mode = 'foot'; model.visible = true; body.setEnabled(true); }
      body.setTranslation({ x: PLAYER.spawn.x, y: PLAYER.spawn.z }, true); body.setLinvel({ x: 0, y: 0 }, true);
      player.x = PLAYER.spawn.x; player.z = PLAYER.spawn.z; player.health = PLAYER.health; player.stamina = PLAYER.stamina; player.tumble = 0; player.face = Math.PI;
    },

    update(dt, t) {
      if (game.police.stars === 0 && player.health < PLAYER.health) player.health = Math.min(PLAYER.health, player.health + PLAYER.regen * dt);
      if (player.mode !== 'foot') return;
      player.y = damp(player.y, groundY(player.x, player.z), 16, dt);
      model.position.set(player.x, player.y, player.z);
      if (player.tumble > 0) player.face += dt * 10;
      model.rotation.y = player.face;
      animateCharacter(model, t, dt, player.speed, player.tumble > 0 ? 'down' : player.speed > .4 ? 'move' : 'stand');
      if (player.speed > 1 && player.tumble <= 0 && (player.stepT -= dt * player.speed) <= 0) { player.stepT = 1.9; game.audio.step(); }
    },
  };
  game.physics.owners.set(body.collider(0).handle, player);
  return player;
}

