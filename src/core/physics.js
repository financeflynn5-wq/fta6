// Thin wrapper around Rapier (2D). The city is flat, so all collisions happen on the
// ground plane: physics x = world x, physics y = world z.
import RAPIER from 'rapier';

// LOW: walls and boxes a flying car clears. The UP groups are the upper level (bridges, elevated roads, roofs):
// cars and people up there only touch each other and the rails up there, never what is on the ground below.
// EDGE: the walls round the edge of the world. They stop everything on land; boats and helicopters go past them.
export const GROUP = { BUILDING: 1, PROP: 2, CAR: 4, PED: 8, LOW: 16, UP_CAR: 32, RAIL: 64, UP_PED: 128, EDGE: 256 };
const UP = GROUP.UP_CAR | GROUP.RAIL | GROUP.UP_PED;
const groups = (member, filter) => ((member << 16) | filter) >>> 0;
const ALL = 0xffff;

export async function createPhysics() {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: 0 });
  world.timestep = 1 / 60;
  const queue = new RAPIER.EventQueue(true);
  const owners = new Map();          // collider handle -> game object
  const ray = new RAPIER.Ray({ x: 0, y: 0 }, { x: 1, y: 0 });
  const buildingsOnly = groups(ALL, GROUP.BUILDING | GROUP.EDGE), solidStuff = groups(ALL, GROUP.BUILDING | GROUP.PROP | GROUP.LOW | GROUP.EDGE), railsOnly = groups(ALL, GROUP.RAIL);
  const roofs = groups(ALL, GROUP.BUILDING | GROUP.LOW), disc = new RAPIER.Ball(1), at = { x: 0, y: 0 };
  const edgeFree = new Set();        // people the edge walls let through (the player, who may have to wade back from a boat)
  // How tall each static thing is, so a look-out high above the street sees (and shoots) over the roofs below.
  const heights = new Map();
  const taller = (c) => (heights.get(c.handle) ?? 1e9) > physics.eyeY;

  const physics = {
    RAPIER, world, owners,
    eyeY: 1.6,          // height the camera, shots and lines of sight are judged from (world.js keeps it at the player's eye)
    // low = something short (a rail, one container): it stops cars on the ground but not ones in the air.
    // h = how tall it is (leave out for "taller than anything").
    // edge = one of the walls round the world: no height (nothing looks or shoots into it), and craft pass it.
    addStaticBox(x, z, hw, hd, low = false, h = low ? 2.6 : 1e9, edge = false) {
      const c = world.createCollider(RAPIER.ColliderDesc.cuboid(hw, hd).setTranslation(x, z).setCollisionGroups(groups(edge ? GROUP.EDGE : low ? GROUP.LOW : GROUP.BUILDING, ALL)).setFriction(.25).setRestitution(.15));
      heights.set(c.handle, edge ? -1e9 : h); return c;
    },
    // A straight wall at any angle: hl long, ht thick (half sizes), turned by rot.
    // kind: 'solid' (like a building), 'low' (stops cars on the ground only) or 'rail' (the edge of a bridge or roof: upper level only).
    addWall(x, z, hl, ht, rot, kind = 'solid', h = kind === 'solid' ? 1e9 : 1) {
      const g = kind === 'rail' ? groups(GROUP.RAIL, GROUP.UP_CAR | GROUP.UP_PED) : groups(kind === 'low' ? GROUP.LOW : GROUP.BUILDING, ALL);
      const c = world.createCollider(RAPIER.ColliderDesc.cuboid(hl, ht).setTranslation(x, z).setRotation(rot).setCollisionGroups(g).setFriction(.25).setRestitution(.15));
      heights.set(c.handle, h); return c;
    },
    // Where a car is: 0 = on the ground (hits everything there), 1 = high in the air (only buildings), 2 = on the upper level,
    // 3 = a helicopter in the air (touches nothing: vehicles/helis.js looks after it), 4 = a boat (everything but the edge of the world).
    setCarMode(body, mode) {
      const g = mode === 2 ? groups(GROUP.UP_CAR, UP) : groups(GROUP.CAR, mode === 1 ? GROUP.BUILDING | GROUP.EDGE : mode === 3 ? 0 : mode === 4 ? ALL ^ GROUP.EDGE : ALL);
      for (let i = 0; i < body.numColliders(); i++) body.collider(i).setCollisionGroups(g);
    },
    setFlying(body, on) { physics.setCarMode(body, on ? 1 : 0); },
    // Someone on foot steps onto (or off) the upper level.
    setPersonUp(body, up) { body.collider(0).setCollisionGroups(up ? groups(GROUP.UP_PED, UP) : groups(GROUP.PED, edgeFree.has(body.handle) ? ALL ^ GROUP.EDGE : ALL)); },
    // In the air (falling, under a parachute, up on a roof) a person touches nothing: player/skydive.js looks after them.
    setPersonAir(body, on, up = false) { if (on) body.collider(0).setCollisionGroups(groups(GROUP.PED, 0)); else physics.setPersonUp(body, up); },
    // The edge walls stop holding this person in (world.js turns them back gently instead).
    freeOfEdge(body) { edgeFree.add(body.handle); physics.setPersonUp(body, false); },
    addStaticPost(x, z, r, h = 7) {
      const c = world.createCollider(RAPIER.ColliderDesc.ball(r).setTranslation(x, z).setCollisionGroups(groups(GROUP.PROP, ALL)).setFriction(.2).setRestitution(.2));
      heights.set(c.handle, h); return c;
    },
    // tail: [x, half length, half width] of a second, lighter box behind the first (a helicopter's boom).
    addCar(owner, x, z, angle, hl, hw, mass, tail) {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, z).setRotation(angle).setLinearDamping(0).setAngularDamping(0).setCcdEnabled(true));
      const col = world.createCollider(RAPIER.ColliderDesc.cuboid(hl, hw).setMass(mass).setFriction(.25).setRestitution(.2)
        .setCollisionGroups(groups(GROUP.CAR, ALL)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
      owners.set(col.handle, owner);
      if (tail) { const t = world.createCollider(RAPIER.ColliderDesc.cuboid(tail[1], tail[2]).setTranslation(tail[0], 0).setMass(0).setFriction(.25).setRestitution(.2).setCollisionGroups(groups(GROUP.CAR, ALL)), body); owners.set(t.handle, owner); }
      return body;
    },
    addPerson(owner, x, z, r, mass = 80) {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, z).lockRotations().setLinearDamping(0));
      const col = world.createCollider(RAPIER.ColliderDesc.ball(r).setMass(mass).setFriction(0).setRestitution(0)
        .setCollisionGroups(groups(GROUP.PED, ALL)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
      owners.set(col.handle, owner); return body;
    },
    remove(body) {
      for (let i = 0; i < body.numColliders(); i++) owners.delete(body.collider(i).handle);
      world.removeRigidBody(body);
    },
    // Distance to the first building between two points, or -1 when the line is clear.
    // Buildings lower than the eye height don't count, unless street = true (what a car on the road can drive through).
    blocked(ax, az, bx, bz, street = false) {
      const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz); if (len < .01) return -1;
      ray.origin.x = ax; ray.origin.y = az; ray.dir.x = dx / len; ray.dir.y = dz / len;
      const hit = world.castRay(ray, len, true, undefined, buildingsOnly, undefined, undefined, street ? undefined : taller);
      return hit ? hit.timeOfImpact : -1;
    },
    canSee(ax, az, bx, bz) { return physics.blocked(ax, az, bx, bz) < 0; },
    // Free distance along a direction (buildings only), capped at max.
    probe(ax, az, dx, dz, max) {
      ray.origin.x = ax; ray.origin.y = az; ray.dir.x = dx; ray.dir.y = dz;
      const hit = world.castRay(ray, max, true, undefined, buildingsOnly, undefined, undefined, taller);
      return hit ? hit.timeOfImpact : max;
    },
    // Same, but trees, lamp posts and signal poles count too.
    probeSolid(ax, az, dx, dz, max) {
      ray.origin.x = ax; ray.origin.y = az; ray.dir.x = dx; ray.dir.y = dz;
      const hit = world.castRay(ray, max, true, undefined, solidStuff, undefined, undefined, taller);
      return hit ? hit.timeOfImpact : max;
    },
    // What a driver on the street feels ahead: everything solid at ground level, whatever the eye height is.
    // up = true: what a driver on the upper level feels instead (the rails).
    probeDrive(ax, az, dx, dz, max, up = false) {
      ray.origin.x = ax; ray.origin.y = az; ray.dir.x = dx; ray.dir.y = dz;
      const hit = world.castRay(ray, max, true, undefined, up ? railsOnly : solidStuff);
      return hit ? hit.timeOfImpact : max;
    },
    // What stands under a disc of radius r seen from height y: out.top = the tallest roof at or below y (-1e9 for none),
    // out.wall = something there reaches above y, out.vague = one of them has no known height.
    under(x, z, r, y, out) {
      out.top = -1e9; out.wall = false; out.vague = false; disc.radius = r; at.x = x; at.y = z;
      world.intersectionsWithShape(at, 0, disc, (c) => {
        const h = heights.get(c.handle) ?? 1e9;
        if (h > 1e8) out.vague = true; else if (h > y) out.wall = true; else if (h > out.top) out.top = h;
        return true;
      }, undefined, roofs);
      return out;
    },
    // Is there room to drive a car straight from a to b (two rays, one per side)?
    canDrive(ax, az, bx, bz) {
      const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1, ox = -dz / len * 1.25, oz = dx / len * 1.25;
      return physics.blocked(ax + ox, az + oz, bx + ox, bz + oz, true) < 0 && physics.blocked(ax - ox, az - oz, bx - ox, bz - oz, true) < 0;
    },
    // Where a car is being hit right now, in the car's own frame (x forward, y to its right): the contact
    // carrying the most force. Fills `out` with one or two points (a flat face against a wall touches along
    // a line), the direction pointing into the car, and what it hit. Returns null when nothing is touching.
    contactOf(body, out) {
      const col = body.collider(0); let best = -1;
      world.contactPairsWith(col, (other) => {
        world.contactPair(col, other, (m, flipped) => {
          const n = m.numContacts(); if (!n) return;
          let force = 0, near = 1e9;
          for (let i = 0; i < n; i++) { force += Math.abs(m.contactImpulse(i)); near = Math.min(near, m.contactDist(i)); }
          const score = force > 0 ? 1 + force : 1 / (1 + Math.max(0, near) * 50);     // nothing solved yet: the closest pair
          if (score <= best) return; best = score;
          const p0 = flipped ? m.localContactPoint2(0) : m.localContactPoint1(0), p1 = n > 1 ? (flipped ? m.localContactPoint2(1) : m.localContactPoint1(1)) : p0;
          const nn = flipped ? m.localNormal2() : m.localNormal1();
          out.ax = p0.x; out.az = p0.y; out.bx = p1.x; out.bz = p1.y; out.nx = -nn.x; out.nz = -nn.y;
          out.owner = owners.get(other.handle) || null; out.round = other.shapeType() === RAPIER.ShapeType.Ball; out.r = out.round ? other.radius() : 0;
          const og = other.collisionGroups() >>> 16; out.low = !out.owner && (og === GROUP.LOW || og === GROUP.RAIL);
        });
      });
      return best < 0 ? null : out;
    },
    // Runs one fixed step; onContact(a, b) fires once when two owned things first touch.
    step(onContact) {
      world.step(queue);
      queue.drainCollisionEvents((h1, h2, started) => {
        if (!started) return;
        const a = owners.get(h1), b = owners.get(h2);
        if (a || b) onContact(a, b);
      });
    },
  };
  return physics;
}
