// Thin wrapper around Rapier (2D). The city is flat, so all collisions happen on the
// ground plane: physics x = world x, physics y = world z.
import RAPIER from 'rapier';

export const GROUP = { BUILDING: 1, PROP: 2, CAR: 4, PED: 8, LOW: 16 };   // LOW: walls and boxes a flying car clears
const groups = (member, filter) => ((member << 16) | filter) >>> 0;
const ALL = 0xffff;

export async function createPhysics() {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: 0 });
  world.timestep = 1 / 60;
  const queue = new RAPIER.EventQueue(true);
  const owners = new Map();          // collider handle -> game object
  const ray = new RAPIER.Ray({ x: 0, y: 0 }, { x: 1, y: 0 });
  const buildingsOnly = groups(ALL, GROUP.BUILDING), solidStuff = groups(ALL, GROUP.BUILDING | GROUP.PROP | GROUP.LOW);

  const physics = {
    RAPIER, world, owners,
    // low = something short (a rail, one container): it stops cars on the ground but not ones in the air
    addStaticBox(x, z, hw, hd, low = false) {
      world.createCollider(RAPIER.ColliderDesc.cuboid(hw, hd).setTranslation(x, z).setCollisionGroups(groups(low ? GROUP.LOW : GROUP.BUILDING, ALL)).setFriction(.25).setRestitution(.15));
    },
    // A car high in the air only hits buildings; back on the ground it hits everything again.
    setFlying(body, on) { body.collider(0).setCollisionGroups(groups(GROUP.CAR, on ? GROUP.BUILDING : ALL)); },
    addStaticPost(x, z, r) {
      world.createCollider(RAPIER.ColliderDesc.ball(r).setTranslation(x, z).setCollisionGroups(groups(GROUP.PROP, ALL)).setFriction(.2).setRestitution(.2));
    },
    addCar(owner, x, z, angle, hl, hw, mass) {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, z).setRotation(angle).setLinearDamping(0).setAngularDamping(0).setCcdEnabled(true));
      const col = world.createCollider(RAPIER.ColliderDesc.cuboid(hl, hw).setMass(mass).setFriction(.25).setRestitution(.2)
        .setCollisionGroups(groups(GROUP.CAR, ALL)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
      owners.set(col.handle, owner); return body;
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
    blocked(ax, az, bx, bz) {
      const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz); if (len < .01) return -1;
      ray.origin.x = ax; ray.origin.y = az; ray.dir.x = dx / len; ray.dir.y = dz / len;
      const hit = world.castRay(ray, len, true, undefined, buildingsOnly);
      return hit ? hit.timeOfImpact : -1;
    },
    canSee(ax, az, bx, bz) { return physics.blocked(ax, az, bx, bz) < 0; },
    // Free distance along a direction (buildings only), capped at max.
    probe(ax, az, dx, dz, max) {
      ray.origin.x = ax; ray.origin.y = az; ray.dir.x = dx; ray.dir.y = dz;
      const hit = world.castRay(ray, max, true, undefined, buildingsOnly);
      return hit ? hit.timeOfImpact : max;
    },
    // Same, but trees, lamp posts and signal poles count too.
    probeSolid(ax, az, dx, dz, max) {
      ray.origin.x = ax; ray.origin.y = az; ray.dir.x = dx; ray.dir.y = dz;
      const hit = world.castRay(ray, max, true, undefined, solidStuff);
      return hit ? hit.timeOfImpact : max;
    },
    // Is there room to drive a car straight from a to b (two rays, one per side)?
    canDrive(ax, az, bx, bz) {
      const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1, ox = -dz / len * 1.25, oz = dx / len * 1.25;
      return physics.blocked(ax + ox, az + oz, bx + ox, bz + oz) < 0 && physics.blocked(ax - ox, az - oz, bx - ox, bz - oz) < 0;
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
