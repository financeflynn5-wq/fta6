// Every tunable number lives here, so balancing the game never means digging through systems.

export const WORLD = {
  BLOCK: 40, PITCH: 54, ROAD: 14,
  blocksIdx: [-3, -2, -1, 0, 1, 2],
  roadsAt: [-108, -54, 0, 54, 108],
  // every corner of the map grid, 54 m apart; downtown is the middle seven (-162..162). Roads: world/map.js
  nodes: [-378, -324, -270, -216, -162, -108, -54, 0, 54, 108, 162, 216, 270, 324, 378],
  LIMIT: 372,                                   // edge of the world
  CURB: 0.3,
  LANE: 2.6,
};

export const CAR = {
  halfLen: 2.3, halfWid: 0.95, wheelbase: 2.8,
  types: {
    car:    { name: 'SEDAN',   mass: 1200, maxSpeed: 36, accel: 15, health: 100 },
    taxi:   { name: 'TAXI',    mass: 1250, maxSpeed: 33, accel: 13, health: 110 },
    police: { name: 'CRUISER', mass: 1450, maxSpeed: 38.5, accel: 17, health: 140 },
    // Any CAR number can be overridden per vehicle (size, grip, steering, brakes...). Extras:
    //   lean / leanMax: body roll (negative lean tips into the turn, like a bike)   pitch: engine note
    //   cam: how far back the camera sits   cruise: traffic speed multiplier   rider: the driver sits on it, in the open
    sport:  { name: 'FLAMINGO GT', mass: 1050, maxSpeed: 47, accel: 21, health: 85, halfWid: .98, grip: 31, gripHandbrake: 12, brake: 36, steerInFast: 5, lean: .6, pitch: 1.3 },
    van:    { name: 'VAN',         mass: 1900, maxSpeed: 30, accel: 11, health: 150, halfLen: 2.6, halfWid: 1.03, wheelbase: 3.2, grip: 21, steerLock: .64, lean: 1.7, leanMax: .11, pitch: .85, cam: 1.15, cruise: .95 },
    truck:  { name: 'BOX TRUCK',   mass: 4200, maxSpeed: 26, accel: 8, health: 260, halfLen: 3.7, halfWid: 1.25, wheelbase: 4.9, grip: 18, gripHandbrake: 10, brake: 22, steerLock: .8, steerIn: 5, steerInFast: 3, lean: 1.4, leanMax: .09, pitch: .6, cam: 1.55, cruise: .85 },
    limo:   { name: 'STRETCH',     mass: 1800, maxSpeed: 34, accel: 12, health: 130, halfLen: 3.1, wheelbase: 4.4, grip: 23, steerLock: .75, lean: 1.2, pitch: .9, cam: 1.2, cruise: .95 },
    bike:   { name: 'MOTORBIKE',   mass: 260, maxSpeed: 44, accel: 23, health: 55, halfLen: 1.05, halfWid: .32, wheelbase: 1.55, grip: 29, gripHandbrake: 13, brake: 34, steerLock: .5, steerIn: 9, steerInFast: 6, lean: -18, leanMax: .7, pitch: 1.75, cam: .82, cruise: 1.1, rider: true, throwAt: 7 },
  },
  maxReverse: 11, reverseAccel: 9,
  brake: 30, handbrakeDecel: 6, engineBrake: 2.2, drag: 0.012,
  // Tyres. grip is the most sideways acceleration (m/s^2) they hold. Steering may only ask for
  // gripUse of it, so turning the wheel alone never breaks the car loose: only the handbrake does.
  grip: 26, gripUse: .92, gripHandbrake: 11,
  steerLock: .6,                          // front wheel lock (rad): the turning circle at parking speed
  // how fast the steering wheel moves, in full locks per second:
  // turning in (slow / flat out), returning to centre, and swinging through centre to the other side
  steerIn: 7.5, steerInFast: 4.4, steerOut: 9, steerFlip: 13,
  yawGrip: 16, yawSlide: 7,               // how quickly the body answers the wheels: gripping / sliding
  // handbrake drifts
  driftMinSpeed: 4.5,                     // below this the handbrake just stops the car
  driftYaw: 2.2,                          // how fast the car can swing round on the handbrake (rad/s)
  driftAngle: .65,                        // slide angle (rad) where the swing starts to run out, so drifts don't become spins
  looseIn: 8, looseOut: 2.8,              // how fast the rear lets go / bites again (per second)
  slideKeep: .65,                         // share of sideways speed turned back into forward speed when the tyres bite
  damageScale: 1.7, damageMin: 2.2,
};

// ---------- crash damage you can see (vehicles/damage.js, fx/debris.js) ----------
// A knock is the sudden change of speed in m/s (the same number CAR.damageMin is compared with).
export const DAMAGE = {
  range: 170,                          // only vehicles this close to you are dented (nobody sees the rest)
  edge: .24,                           // before bending, panels are cut into triangles no longer than this (m): smaller = smoother dents, more work
  knockMin: 2.2, depthPer: .034,       // dents start at this knock, and go this many metres deeper per m/s above it
  maxDepth: .5, maxDent: .62,          // the most one hit presses in, and the furthest any point may end up from where it began
  crumple: .7, crumplePer: 2.2,        // how far behind the hit the body gives way: metres, plus this many per metre of depth
  wide: { wall: .55, car: .45, post: .22, ledge: .9 },   // half-width of a dent beyond what touched the car
  buckle: .45, wrinkle: .5,            // how much bonnets and boots tent upwards, and how ragged a dent is
  scuff: .06, scuffPer: .02,            // paint scraped off by any knock, plus per m/s
  glassReach: .9, glassReachPer: .13,  // a knock cracks glass this far from it (m), plus per m/s
  glassPer: .06, glassOut: 1.25,       // how fast glass cracks (1 = crazed all over), and when panes start falling out
  lightPer: .12,                       // a lamp goes dark once the knocks next to it add up to 1 / this
  tearAt: .5, tearHit: .13,            // dent depth added up on the nose or tail that tears the bumper off, and the least single hit that does it
  steamAt: .38,                        // depth added up on the nose that makes the radiator steam
  shards: 260, shardLife: 14,          // small flying bits: how many at once, and seconds before they are swept up
  parts: 6, partLife: 45,              // torn-off bumpers lying around at once, and how long they stay
};

export const PLAYER = {
  radius: 0.36, walk: 4.3, sprint: 7.8, accel: 14,
  health: 100, regen: 3, stamina: 6, staminaRegen: 0.6,
  enterRange: 2.4, bailSpeed: 9,
  spawn: { x: -45.6, z: -21.5 },
};

export const POLICE = {
  // index = stars
  pursuers: [0, 1, 2, 3, 4, 6],
  heat: [0, 1, 30, 80, 160, 280],
  evadeTime: [0, 7, 9, 11, 13, 15],
  sightRange: 80, nearRange: 16,
  spawnMin: 62, spawnMax: 125,
  footSpeed: 6.5,
  bounty: [0, 150, 400, 900, 1800, 3500],
  crime: { carjack: 10, alarm: 6, pedHit: 14, copRam: 16, copPedHit: 45, copCarTheft: 35, perSecond: 1.1 },
};

export const TRAFFIC = {
  count: 30, cruise: 11.5, pedCountNear: 5, pedCountFar: 2,
  near: 260,                 // traffic lives within this distance of you
  // how often each vehicle turns up: [driving around, parked]
  mix: { car: [48, 54], taxi: [14, 8], van: [12, 12], bike: [10, 9], truck: [6, 4], sport: [6, 8], limo: [4, 5] },
  // the Sunset Loop and Highway 6: how many cars keep to the highway, how often street traffic takes a ramp up, and what drives there
  highway: { count: 12, rampChance: .3, mix: { car: 44, sport: 14, taxi: 10, van: 10, truck: 10, limo: 6, bike: 6 } },
};

// How cars meet the land (world/ride.js). Flat downtown is unaffected.
export const RIDE = {
  gravity: 16,               // m/s^2 while airborne: lower = longer, floatier jumps
  slopePull: 9,              // how hard hills drag a car back (9.8 would be real life)
  steep: .8, steepPull: 40,  // slopes steeper than this (rise over run) can't be climbed: mountain sides, cliffs
  ledge: .55,                // a step taller than this (per axle, per tick) is a wall, not a bump
  absorb: .4,                // drops smaller than this are soaked up by the suspension instead of counting as a jump
  hardLanding: 9, landingDamage: 3,     // landing speed (m/s) that starts to hurt, and damage per m/s beyond it
  waterDrag: 2.4, floodDepth: .8,       // water slows a car; deeper than this kills the engine
  wadeDepth: .55, wadeSpeed: .55,       // on foot: deeper than this you wade at this share of your speed
};

export const TIME = { day: 210, dusk: 26, night: 130, dawn: 26 };

// ---------- weapons and combat ----------
// rate: shots (or swings) per second. spread: radians of aim drift before the multipliers in AIM. mag: rounds per clip.
// zoom: how far aiming zooms in. ads: seconds to bring the gun up. adsSpread / hipSpread: override AIM's multipliers.
// model: how a weapon sits in the hand when a .glb from assets/weapons/ replaces the stand-in.
export const WEAPONS = {
  fists:   { name: 'FISTS',    slot: 1, melee: true, damage: 12, range: 1.7, rate: 2.8, knock: 4 },
  pistol:  { name: 'PISTOL',   slot: 2, damage: 26, rate: 4.5, mag: 12, reload: 1.15, spread: .01,  range: 90,  pellets: 1, auto: false, kick: .05, length: .5, give: 36, loud: 1, zoom: 1.3, ads: .16 },
  smg:     { name: 'SMG',      slot: 3, damage: 13, rate: 12,  mag: 30, reload: 1.6,  spread: .03,  range: 70,  pellets: 1, auto: true,  kick: .025, length: .82, give: 90, twoHand: true, loud: .8, zoom: 1.3, ads: .18 },
  shotgun: { name: 'SHOTGUN',  slot: 4, damage: 11, rate: 1.25, mag: 6, reload: 2.1,  spread: .075, range: 32,  pellets: 8, auto: false, kick: .14, length: 1.3, give: 18, twoHand: true, loud: 1.5, zoom: 1.2, ads: .2, adsSpread: .75, hipSpread: 1.2 },
  burst:   { name: 'BURST RIFLE', slot: 5, damage: 20, rate: 2.6, burst: 3, burstGap: .07, mag: 30, reload: 1.8, spread: .012, range: 110, pellets: 1, auto: false, kick: .04, length: 1.1, give: 60, twoHand: true, loud: 1.2, zoom: 1.8, ads: .22 },
  sniper:  { name: 'SNIPER',   slot: 6, damage: 95, rate: .9,  mag: 5,  reload: 2.4,  spread: .002, range: 220, pellets: 1, auto: false, kick: .2, length: 1.5, give: 10, twoHand: true, scope: true, loud: 1.8, ads: .26, adsSpread: 0, hipSpread: 25 },
};

// ---------- aiming (hold right mouse) ----------
export const AIM = {
  sens: 1,                                 // mouse sensitivity to start with ([ and ] change it in the game)
  adsSens: .8,                             // extra slow-down while aiming, on top of the zoom
  shoulder: 1, height: 1.85, dist: 3.4,    // the camera while aiming: metres right of, above and behind Rocco
  zoom: 1.3,                               // zoom while aiming, for weapons that don't set their own
  time: .2, timeOut: .16,                  // seconds to bring a gun up / lower it
  level: .03,                              // with nobody in front, the view settles this far below the horizon (rad)
  snap: .2,                                // start aiming with someone this close to dead ahead (rad) and the crosshair lands on them. 0 = off
  hipSpread: 1.7, adsSpread: .45, moveSpread: .6,   // spread multipliers: from the hip, aiming, and extra at a full walk
  bloom: .35, bloomMax: 1.5,               // each shot opens the spread this much, up to this much; it closes again in half a second
  recoil: .28, recoilReturn: 9,            // share of a weapon's kick that lifts the view, and how fast it settles
  scopeZoom: [4, 8],                       // scope magnifications (mouse wheel while looking through it)
  // the view down the sights (first person, with the gun's own sights on the middle of the screen)
  eye: 1.6, eyeAhead: 0,                   // Rocco's eye: metres above his feet and ahead of his middle (ahead of 0, the view can clip into a wall he is pressed against)
  swap: .3,                                // how far into the aim Rocco himself drops out of the picture and the gun starts to rise in front of the eye (0-1)
  kick: 1, sway: 1, bob: 1,                // how much the gun jumps when fired, drifts and trails the hand, and bobs with his steps (0 = off)
  nightGlow: .3,                           // the gun in your hands never gets darker than this, so the sights can be read at night
};

export const COMBAT = {
  armor: 100,                                   // max armor; armor soaks damage before health does
  hp: { critter: 45, bot: 70, officer: 80 },
  headshot: 2.2,                                // damage multiplier above the shoulders
  aimAssist: .045,                              // radians: a near miss on a body still counts as a hit
  // heat added, and the stars it forces
  crime: { shotsFired: [5, 1], assault: [10, 1], ko: [22, 1], copAssault: [40, 2], copKo: [80, 3], carShot: [6, 0] },
  witnessRange: 45,                             // shots fired this close to a cop are noticed
  // armed cops: officers on foot draw pistols at this many stars and keep their distance
  copGunStars: 2, copRange: 32, copHold: 8, copRate: .85, copDamage: 7, copAccuracy: .5,
  pickupRespawn: 60,
  koTime: 14,                                   // how long a knocked-out citizen lies there
};

// Where you wake up: Sunset General after you're wasted, Sunset PD after you're nabbed.
// block: the city block (index into WORLD.blocksIdx); side: which street the front door faces.
export const RESPAWN = {
  hospital: { block: [1, -1], side: [1, 0], name: 'SUNSET GENERAL' },
  station:  { block: [-2, 1], side: [0, -1], name: 'SUNSET PD' },
};

// ---------- jobs ----------
// chop: Scrap's chop shop (block / side work like RESPAWN). Park a stolen car on its marker to sell it.
export const JOBS = {
  chop: { block: [1, 2], side: [-1, 0], name: "SCRAP'S CHOP SHOP", radius: 5 },
  orders: {
    first: 14, gap: 16, life: 360,                 // seconds: before the first order, between orders, until an ignored order is swapped
    // a delivered order, in mint condition (plus a little for distance); any other stolen vehicle is still worth scrap
    pay:   { car: 500, taxi: 650, van: 600, bike: 450, truck: 900, limo: 1400, sport: 1700, police: 2200 },
    scrap: { car: 90, taxi: 110, van: 120, bike: 60, truck: 200, limo: 280, sport: 340, police: 450 },
    want:  { car: 4, taxi: 2, van: 2, bike: 2, truck: 1, limo: 1, sport: 2 },   // how often Scrap asks for each
    rare: ['sport', 'limo'],
    minDist: 90,                                   // order cars are parked at least this far from you
    hotEvery: 3,                                   // every third order is a police cruiser
  },
  taxi: {
    flag: 20, perMetre: .45,                       // fare = flag + street distance * perMetre
    tip: .5, pace: 13, slack: 8,                   // tip (share of the fare) melts once you take longer than distance / pace + slack seconds
    bump: .25, bumpImpact: 5,                      // every hard knock costs this share of the tip
    streak: .1, streakMax: 5,                      // each fare in a row pays 10% more, up to +50%
    pickupMin: 45, pickupMax: 140, tripMin: 120, tripMax: 330,
    hail: 12, stop: 6.5,                           // passenger runs over once the cab stops this close; drop-off circle radius
  },
};

// ---------- things to do around the map (src/activities/) ----------
export const ACTIVITIES = {
  races: { pay: { gold: 1500, silver: 800, bronze: 400, finish: 150 }, firstGold: 1000, gate: 8.5, gateFoot: 3.2 },
  stunts: { first: 500, again: 100, barge: 1000, bigAir: 12, airPay: 4 },   // bigAir: metres flown before any jump pays; airPay: $ per metre
  tins: { each: 150, all: 10000 },                                          // golden tins hidden around the map
  pizza: { count: 4, base: 100, tip: 160, pace: 13, slack: 14, cold: 20, perfect: 500 },   // seconds allowed = distance / pace + slack
  traps: { perKmh: 12, cooldown: 20 },                                      // speed cameras pay per km/h over their limit
  bowling: { perPin: 50, strike: 1000, settle: 4.5 },
};

// ---------- walk-in buildings (world/interiors.js) ----------
// prices at the counters, and what a hold-up is worth
export const INDOORS = {
  snack: 15, meal: 25, armor: 300, ammo: 120, play: 10, jackpot: 250, room: 40, clothes: 100, patchUp: 50,
  bribe: 400,                                   // per wanted star, at the Sunset PD front desk
  robTime: 2.2, robCash: [150, 450], robHeat: 60, robStars: 2, tillRefill: 300,     // seconds of aiming at the clerk; what the till holds; how long until it fills again
};
