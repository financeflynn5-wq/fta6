// Every tunable number lives here, so balancing the game never means digging through systems.

export const WORLD = {
  BLOCK: 40, PITCH: 54, ROAD: 14,
  blocksIdx: [-3, -2, -1, 0, 1, 2],
  roadsAt: [-108, -54, 0, 54, 108],
  nodes: [-162, -108, -54, 0, 54, 108, 162],  // road grid incl. the ring road by the sea wall
  LIMIT: 170,                                   // sea wall
  CURB: 0.3,
  LANE: 2.6,
};

export const CAR = {
  halfLen: 2.3, halfWid: 0.95, wheelbase: 2.8,
  types: {
    car:    { name: 'SEDAN',   mass: 1200, maxSpeed: 36, accel: 15, health: 100 },
    taxi:   { name: 'TAXI',    mass: 1250, maxSpeed: 33, accel: 13, health: 110 },
    police: { name: 'CRUISER', mass: 1450, maxSpeed: 38.5, accel: 17, health: 140 },
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

export const TRAFFIC = { count: 28, cruise: 11.5, pedCountNear: 5, pedCountFar: 2 };

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
    pay: { car: 500, taxi: 650, police: 2200 },    // a delivered order car, in mint condition (plus a little for distance)
    scrap: { car: 90, taxi: 110, police: 450 },    // any other stolen car is still worth scrap
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
