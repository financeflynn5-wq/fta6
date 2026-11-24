// Every tunable number lives here, so balancing the game never means digging through systems.

export const WORLD = {
  BLOCK: 40, PITCH: 54, ROAD: 14,
  blocksIdx: [-3, -2, -1, 0, 1, 2],
  roadsAt: [-108, -54, 0, 54, 108],
  // every grid line of the map, 54 m apart; downtown is -162..162. West to east the map uses the first 15 (-378..378);
  // south to north it uses them all (-378..972: the valley beyond the hills). Roads: world/map.js
  nodes: [-378, -324, -270, -216, -162, -108, -54, 0, 54, 108, 162, 216, 270, 324, 378, 432, 486, 540, 594, 648, 702, 756, 810, 864, 918, 972],
  COLS: 15,                                     // grid lines west to east
  LIMIT: 372,                                   // edge of the world: west, east and south
  LIMIT_N: 966,                                 // ...and north
  CURB: 0.3,
  LANE: 2.6,
};

// ---------- how far in front of the camera the picture starts (world/world.js) ----------
// The further out it starts, the less far-off surfaces flicker against each other, but anything nearer the lens is cut away.
export const VIEW = {
  near: .3,          // on the ground, where walls, poles and people pass right by the camera
  nearMax: 5,        // high in clear air (a helicopter, a parachute): it eases out to this
  perMetre: .22,     // how much further out for every metre of clear air round the camera
  clutter: 10,       // trees, lamp posts and signs reach this far above the ground: clear air starts above them
  side: 14,          // a wall this near the camera (and taller than it) keeps the picture starting close
  unknown: 45,       // a wall with no height written down, and no building outline to read it from, is taken to be no taller than this
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
    // Mouse Bear Trucking's box truck: the same truck in the company's colours, with the mascot's ears on the cab (vehicles/vehicleModels.js)
    mbtruck: { name: 'MOUSE BEAR TRUCK', mass: 4200, maxSpeed: 26, accel: 8, health: 260, halfLen: 3.7, halfWid: 1.25, wheelbase: 4.9, grip: 18, gripHandbrake: 10, brake: 22, steerLock: .8, steerIn: 5, steerInFast: 3, lean: 1.4, leanMax: .09, pitch: .6, cam: 1.55, cruise: .85 },
    limo:   { name: 'STRETCH',     mass: 1800, maxSpeed: 34, accel: 12, health: 130, halfLen: 3.1, wheelbase: 4.4, grip: 23, steerLock: .75, lean: 1.2, pitch: .9, cam: 1.2, cruise: .95 },
    // Boats and helicopters (craft: which). They take maxSpeed, accel, health and size from here; how they float and fly is in BOAT and HELI below.
    //   draft: how deep the hull sits (m)   turn: helm rate (rad/s)   tail: a helicopter's boom, as a second box [x, half length, half width]
    speedboat:  { name: 'SPEEDBOAT',      craft: 'boat', mass: 1400, maxSpeed: 27, accel: 9, health: 120, halfLen: 3.3, halfWid: 1.08, draft: .5, turn: 1.2, cam: 1.25 },
    jetski:     { name: 'JET SKI',        craft: 'boat', mass: 320, maxSpeed: 25, accel: 12, health: 55, halfLen: 1.8, halfWid: .64, draft: .3, turn: 1.9, cam: .85, rider: true, throwAt: 9 },
    policeboat: { name: 'POLICE BOAT',    craft: 'boat', mass: 1700, maxSpeed: 28.5, accel: 10, health: 170, halfLen: 3.6, halfWid: 1.3, draft: .5, turn: 1.3, cam: 1.3, tall: 2.5 },
    heli:       { name: 'DRAGONFLY',      craft: 'heli', mass: 1300, maxSpeed: 50, accel: 11, health: 110, halfLen: 2.75, halfWid: 1.05, tail: [-4.7, 1.95, .3], cam: 1.75, tall: 2.6 },
    policeheli: { name: 'POLICE CHOPPER', craft: 'heli', mass: 1400, maxSpeed: 52, accel: 12, health: 150, halfLen: 2.75, halfWid: 1.05, tail: [-4.7, 1.95, .3], cam: 1.75, tall: 2.6 },
    armyheli:   { name: 'PELICAN',        craft: 'heli', mass: 2600, maxSpeed: 46, accel: 9, health: 240, halfLen: 3.2, halfWid: 1.2, tail: [-5.5, 2.3, .32], cam: 2.1, tall: 3 },
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

// ---------- boats (vehicles/boats.js) ----------
export const BOAT = {
  reverse: 6, reverseAccel: 5,         // top speed and acceleration astern
  drag: .002, coast: .45,              // water drag (grows with the square of speed); with the throttle shut a boat loses this share of its speed each second
  keel: 3.2, keelFast: 1.5,            // how fast a sideways slide dies (per second): at a crawl / flat out (boats skid wide when fast)
  turnAt: 6,                           // speed (m/s) at which the helm has its full bite
  brake: 8,                            // Space, or pulling back while moving: engines hard astern (m/s^2)
  lean: .012, leanMax: .32,            // banking into a turn
  trim: .1, lift: .16, bob: .05,       // bow rise climbing onto the plane (rad), how far the hull lifts at speed (m), waves at rest (m)
  beach: 6, hardHit: .45,              // push back off a beach (m/s per metre aground); a bank this far above the keel is a wall, not a beach
  limit: 210,                          // how far past the edge of the map a boat can go (m)
  sinkTime: 12,                        // a wreck burns this long, then goes down
  wake: 1,                             // foam (0 = none)
};
// ---------- helicopters (vehicles/helis.js) ----------
export const HELI = {
  spoolUp: 3, spoolDown: 7,            // seconds for the rotor to reach full speed, and to stop
  climb: 10, sink: 8, liftRate: 2.8,   // m/s up (Space), m/s down (Shift), how quickly it answers
  flare: 2.2,                          // ...but close to the ground it only sinks this fast
  back: 14, brake: .7, slide: 1.4,     // top speed backwards; with the stick let go it slows at this share of its acceleration; how fast sideways drift dies (per second)
  yaw: 1.5, yawFast: .9, yawRate: 4,   // turn rate hovering / flat out (rad/s), and how quickly it answers
  ceiling: 260,                        // metres above the sea
  tilt: .22, bank: .5,                 // nose-down flat out (rad), most bank in a turn (rad)
  hardLanding: 5.5, landingDamage: 9,  // touchdown speed (m/s) that starts to hurt, and damage per m/s beyond it
  wallDamage: 3.4,                       // damage per m/s of flying into the side of something
  fall: 11,                            // m/s^2 once the engine is dead (the blades still slow it a little)
  radius: 2.3, skids: 1.2,             // the disc that must be clear of walls, and the smaller one it lands on
  step: 1.5,                           // anything this far (m) above the skids is a wall; lower things it rides up over
  vague: 16,                           // a building with no known height is taken to be this tall
  limit: 320,                          // how far past the edge of the map it can go
  wash: 9,                             // rotor wash kicks up dust or spray below this height
  jump: 2.5,                           // you can bail out below this height
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

// ---------- smoke, fire and sparks (fx/effects.js) ----------
export const FX = {
  particles: 900,                      // puffs, flames and sparks alive at once
  near: 90, far: 190,                  // effects are drawn in full this close to the camera (m), and not at all past this
  wind: [.8, .35],                     // the sea breeze that smoke leans with (m/s east, m/s south)
  nightGlow: .03,                      // light the city itself throws on smoke after dark
  // smoke from a damaged engine (vehicles/vehicle.js). It starts when health drops under smokeAt of full.
  smokeAt: .45,
  wreckLife: 4.2, wreckSize: 1.25,     // the black column over a wreck: seconds each puff lasts, and its starting size (m)
  flames: true,                        // wrecks burn at the bonnet
};

// ---------- vehicle sound (core/audio.js, audio/carSounds.js, audio/engineLoops.js) ----------
export const SOUND = {
  master: .5,
  // which engine each vehicle has, and how high it is pitched. Anything not listed sounds like the sedan.
  engine: { car: ['i4', 1], taxi: ['i4', .95], police: ['v8', 1.04], sport: ['v8', 1.2], van: ['diesel', 1.12], truck: ['diesel', .84], mbtruck: ['diesel', .84], limo: ['v8', .88], bike: ['bike', 1],
    speedboat: ['v8', .78], policeboat: ['v8', .72], jetski: ['bike', .8] },      // helicopters have their own sound (audio/craftSounds.js)
  rotorVol: 1, washVol: 1,             // rotor chop and turbine whine; water rushing past a boat
  engineVol: 1, trafficVol: 1, tyreVol: 1, windVol: 1, sirenVol: 1,      // turn any layer up or down (1 = as mixed)
  traffic: 5,                          // how many other cars you can hear at once
  hearing: 60,                         // and from how far (m)
  reverb: .2,                          // how much street echo crashes, horns, sirens and traffic get
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
  crew: 2,                   // officers in each cruiser. One gets out at a time; once both are down the car is left empty and nobody else climbs out of it
  nextOut: 3,                // seconds after a cruiser's officer goes down before its second one gets out
  backup: 10,                // seconds before a replacement cruiser is sent for one that was emptied, wrecked or stolen
  footMax: 4,                // beat cops stop joining a chase on foot once this many officers are after you
  bounty: [0, 150, 400, 900, 1800, 3500],
  crime: { carjack: 10, alarm: 6, pedHit: 14, copRam: 16, copPedHit: 45, copCarTheft: 35, perSecond: 1.1 },
};

export const TRAFFIC = {
  count: 30, cruise: 11.5, pedCountNear: 5, pedCountFar: 2,
  near: 260,                 // traffic lives within this distance of you
  // how often each vehicle turns up: [driving around, parked]
  mix: { car: [48, 54], taxi: [14, 8], van: [12, 12], bike: [10, 9], truck: [6, 4], sport: [6, 8], limo: [4, 5], mbtruck: [6, 0] },
  // the Sunset Loop and Highway 6: how many cars keep to the highway, how often street traffic takes a ramp up, and what drives there
  highway: { count: 12, rampChance: .3, mix: { car: 44, sport: 14, taxi: 10, van: 10, truck: 10, limo: 6, bike: 6, mbtruck: 7 } },
};

// Mouse Bear Trucking: the depot north of Port Sunset (world/mousebear.js) and its trucks (vehicles/mousebearFleet.js).
export const MOUSEBEAR = {
  onRoad: 3,                 // at least this many company trucks are always driving somewhere near you (the traffic mix adds more)
  respawn: 45, far: 150,     // a truck taken from the yard is put back after this many seconds, once you are this far away
  headSpin: .35,             // how fast the mascot on the sign turns (rad/s)
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

// ---------- Frostbite Peak: the snow mountain and its ice road (world/snowland.js, world/snowpeak.js) ----------
export const SNOW = {
  halfWidth: 3.4, pinch: 2.75,   // half the width of the road (m): most of the way up, and through the two squeezes
  grade: .112,                   // how steeply the road climbs (rise over run)
  snowLine: 96,                  // snow lies above about this height (m); the road is dirt below it
  cut: 4.6, fill: 3.6,           // how far the bank beside the road runs before it is the mountainside again: uphill side, downhill side (m)
  // How slippery each kind of ground is: 0 = tarmac, 1 = sheet ice
  packed: .5, powder: .6,
  // Tyres on sheet ice, as shares of what they do on tarmac: sideways grip, drive, brakes. Packed snow is `packed` of the way there.
  grip: .14, drive: .5, brake: .2,
  over: 1.6,                     // on ice the wheel can ask for this many times the turn the tyres will hold; the rest is slide
  yaw: 5,                        // how quickly the truck answers the wheel on ice (16 on tarmac)
  cliff: .72, slide: 11,         // ground steeper than this (rise over run) can't be held: you go down it, gaining up to `slide` m/s every second
  offRoad: 6,                    // the trucking mission: this many seconds off the road and the load is lost
  flakes: 1600,                  // snowflakes in the air round the camera
};

export const TIME = { day: 210, dusk: 26, night: 130, dawn: 26 };

// ---------- weapons and combat ----------
// rate: shots (or swings) per second. spread: radians of aim drift before the multipliers in AIM. mag: rounds per clip.
// zoom: how far aiming zooms in. ads: seconds to bring the gun up. adsSpread / hipSpread: override AIM's multipliers.
// model: how a weapon sits in the hand when a .glb from assets/weapons/ replaces the stand-in.
export const WEAPONS = {
  fists:   { name: 'FISTS',    slot: 1, melee: true, damage: 12, range: 1.7, rate: 2.8, knock: 4 },
  knife:   { name: 'KNIFE',    slot: 1.5, melee: true, blade: true, damage: 30, range: 1.75, rate: 2.3, knock: 1.6, length: .34 },     // key 1 swaps fists and knife
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

export const CAST = {
  bigHead: .8,                                  // how big a Big Head's head is: 1 is the original giant (over a metre across), .67 is no bigger than a critter's
};

export const COMBAT = {
  armor: 100,                                   // max armor; armor soaks damage before health does
  hp: { critter: 45, bighead: 50, bot: 70, officer: 80 },   // a Big Head's head is a wider target than most, so they get a slightly thicker skull
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
    scrap: { car: 90, taxi: 110, van: 120, bike: 60, truck: 200, mbtruck: 240, limo: 280, sport: 340, police: 450, speedboat: 400, jetski: 150, policeboat: 600, heli: 900, policeheli: 1500, armyheli: 2000 },
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
  // bounty hunts (the ring outside Sunset PD): time: seconds on the clock; extra: seconds each catch adds; pay, and step more for every one after the first;
  // giveUp: a crook stops when their car is down to this share of its health; speed: how fast the first one drives, how much faster each next one is, and the most;
  // they turn up between minDist and maxDist metres away and have got away once they are lost metres off
  bounty: { time: 110, extra: 50, pay: 400, step: 150, giveUp: .5, speed: [21, 1.5, 31], minDist: 80, maxDist: 150, lost: 420 },
  // the Golden Acres derby (the west paddock): where the ring is and how wide; rivals (one more per win, up to max), their top speed,
  // cash per wreck and for winning, seconds allowed outside the ring or out of your car
  derby: { x: -214, z: 858, radius: 34, rivals: 3, max: 6, speed: 19, wreck: 300, win: 1500, out: 6 },
  // Coral Plaza smash spree: where the start ring is, the box that counts (x0, x1, z0, z1), seconds, cash per thing broken (glass pays more),
  // how many broken things set the alarm off, how many for each medal and what a medal adds
  spree: { x: 96, z: 521, box: [30, 132, 533, 646], time: 60, each: 20, glass: 35, alarm: 12, medals: { gold: 45, silver: 30, bronze: 15 }, pay: { gold: 1500, silver: 800, bronze: 400 } },
  // the Golden Acres gun range (the east field): where you stand, seconds, targets up at once, how long one stays up, cash per hit,
  // hits for each medal and what a medal adds, rounds in the pistol the range lends you if you turn up empty-handed
  range: { x: -60, z: 829, time: 45, up: 3, stay: 4.5, perHit: 25, medals: { gold: 22, silver: 15, bronze: 8 }, pay: { gold: 1200, silver: 600, bronze: 300 }, lend: 60 },
  // Spray 'n' Scram (block / side work like RESPAWN): stop in the ring in a car to have it fixed, repainted and forgotten by the cops (if none can see you)
  spray: { block: [-2, -2], side: [1, 0], name: "SPRAY 'N' SCRAM", radius: 4.5, price: 250, colors: [0xff2d55, 0xffd60a, 0x34e06b, 0x00c2ff, 0xff7a00, 0xb980ff, 0xf4f1ea, 0x15171c, 0xff7aa2, 0x2bb3c0] },
};

// ---------- story mode (src/story/) ----------
export const STORY = {
  ring: 1.6,                                    // the ring you step into to start a mission (m)
  retry: 14,                                    // seconds the "hold Y to retry" offer stays up after a mission fails
  // the Possum Posse's gunmen (a mission can override any of these): health, damage per hit, chance to hit up close, seconds between shots,
  // how far they shoot, how close you get before they notice, the distance they like to keep, walking speed
  goon: { hp: 55, damage: 6, accuracy: .4, rate: 1.15, range: 36, wake: 44, hold: 11, speed: 3.4 },
  giveUp: .45,                                  // a car you are told to run down stops when its health drops to this share
  ram: 1.4, ramSoak: .45,                       // ramming a crook's car: extra damage to it per m/s of closing speed, and the share of the knock your own car takes
  lost: 420,                                    // a runaway this far from you (m) for three seconds has got away
  ease: 150,                                    // further off than this (m) a runaway slows to two thirds speed, so you can catch up
  // what each mission pays
  pay: { rent: 600, parts: 900, repo: 1200, signal: 1500, mall: 3000, barn: 2500, army: 3500, tower: 25000 },
  saveEvery: 3,                                 // seconds between writes of your cash and guns to the browser's storage
};

// ---------- walk-in buildings (world/interiors.js) ----------
// prices at the counters, and what a hold-up is worth
export const INDOORS = {
  snack: 15, meal: 25, armor: 300, ammo: 120, play: 10, jackpot: 250, room: 40, clothes: 100, patchUp: 50,
  bribe: 400,                                   // per wanted star, at the Sunset PD front desk
  drawDist: 95,                                 // a room's furniture is only drawn within this many metres
  robTime: 2.2, robCash: [150, 450], robHeat: 60, robStars: 2, tillRefill: 300,     // seconds of aiming at the clerk; what the till holds; how long until it fills again
  // Bullseye Guns: what each gun costs (a gun you already own is refilled for its ammo price instead)
  guns: { pistol: 350, smg: 900, shotgun: 1200, burst: 2200, sniper: 4000 },
  gunAmmo: { pistol: 60, smg: 120, shotgun: 140, burst: 200, sniper: 300 },
  // Upstairs (world/rooms.js). lootRefill: seconds until a searched drawer has something in it again. witness: how near
  // somebody on the same floor has to be to see you at it (a star, unless a gun has them cowering first).
  lootRefill: 480, witness: 9, burgleHeat: 25,
  // safes: seconds standing at the dial, what is inside, and how many stars the alarm brings
  safes: { house: { time: 3, cash: [300, 900], stars: 0 }, office: { time: 5, cash: [1200, 2600], stars: 2, heat: 60 }, vault: { time: 8, cash: [6000, 12000], stars: 3, heat: 120 } }, safeRefill: 900,
  soda: 5, workout: 20, catCash: 250, catBonus: 10000, gemRefill: 1200,
};

// ---------- the valley in the north (world/north.js and friends, world/places.js) ----------
// Things a car can smash. Mall glass you can drive through is a wall until it is hit hard enough.
export const SMASH = {
  through: 3.5,                                 // m/s straight at a sheet of mall glass to burst through it
  touch: 2.5,                                   // m/s to knock down a fence panel or shatter a shop window
  keep: .9,                                     // share of your speed you keep after bursting through glass
  keepProp: .96,                                // ...and after ploughing through a table, a kiosk or a hay bale
  damage: 1.5,                                  // what it costs the car
  mend: 170,                                    // everything is put back once you are this far away (m)
};
// Fort Pelican is a restricted area.
// Falling and parachutes (player/skydive.js).
export const SKY = {
  gravity: 18, terminal: 27, dive: 40,   // free fall: m/s² down, top speed spread flat, top speed tucked into a dive (W)
  steer: 11, steerRate: 1.6,             // how fast you can slide across the sky in free fall, and how quickly
  openAbove: 5,                          // a parachute will not open lower than this, m
  openTime: .8, brake: 3.2,              // seconds for the canopy to fill; how hard it then slows you (per second)
  sink: 5, glide: 8,                     // under the canopy: m/s down, m/s forward
  fast: 12.5, fastSink: 7.5,             // ...holding W
  flare: 4, flareSink: 2.6,              // ...holding S
  turn: 1.5,                             // radians a second (A/D)
  safe: 9, hurt: .75,                    // hitting the ground slower than `safe` m/s is free; over it costs (m/s over)² x hurt. Flat out is always fatal
  waterSafe: 14, waterHurt: 3, waterMax: 60,      // the sea is kinder: it never kills
  step: .5,                              // a drop bigger than this off a roof is a fall
  vague: 16,                             // how tall a building of unknown height counts as (the same guess the helicopters make)
  price: 250, carry: 3, respawn: 45,     // a parachute at Bullseye Guns; how many you can carry; seconds before a pack by a helipad comes back
};

// ---------- sharks (wildlife/sharks.js) ----------
export const SHARK = {
  count: 7,                        // how many swim near you at once
  near: 55, far: 140, gone: 210,   // they turn up between near and far (m) from you; one left further behind than gone is moved closer
  depth: .95,                      // the shallowest water they will enter (m): keep to the shallows and they can't quite reach you
  cruise: 2.6, stalk: 5.2, charge: 10.5, turn: 1.5,      // m/s patrolling, circling and attacking; how fast they turn (rad/s)
  sense: 55,                       // a swimmer this close gets noticed (m)
  hunters: 3,                      // how many come for you at once
  circle: [3.5, 6.5],              // seconds one circles before its first charge (the ones that join in are quicker)
  bite: 22, reach: 1.15, gap: 1.6, // damage per bite; how close its nose has to get (m); the least time between two bites, however many are after you
  hp: 150, bounty: 200,            // how much shooting one takes; what a dead one pays
  ramAfter: 5, ram: 7, tip: .45,   // seconds a boat may sit still before one rams it; what that costs the boat; chance a jet ski throws you
  runOver: 5.5,                    // a boat faster than this (m/s) hurts a shark it hits
  float: 12,                       // seconds a dead one floats before it sinks
};

// ---------- Sunset Zoo (world/zoo.js builds it, wildlife/zooLife.js runs the animals) ----------
export const ZOO = {
  // hp; walk and run (m/s; you sprint at 7.8); r = how much room it takes up (m); temper:
  //   hunter = hunts you and anyone else on foot once it is out      guard = goes for whoever comes within `guard` metres
  //   calm = leaves you alone until it is hurt                       shy = runs from anything within `shy` metres
  // hit = what a bite, a punch or a tusk costs you; reach (m); knock = how hard it throws you (m/s); cool = seconds between attacks;
  // heavy = a car stops dead against it, and it can push a fence over; swim = takes to water; verb = what the screen says it did to you
  kinds: {
    lion: { hp: 260, walk: 1.5, run: 9.6, turn: 3.4, r: .7, temper: 'hunter', hit: 24, reach: 1.7, knock: 6, cool: 1.6, call: 'roar', verb: 'MAULED BY A LION!' },
    lioness: { hp: 220, walk: 1.6, run: 10.4, turn: 3.6, r: .65, temper: 'hunter', hit: 20, reach: 1.6, knock: 6, cool: 1.5, call: 'growl', verb: 'MAULED BY A LIONESS!' },
    bear: { hp: 380, walk: 1.3, run: 8.3, turn: 3, r: .85, temper: 'hunter', hit: 28, reach: 1.7, knock: 8, cool: 1.8, call: 'growl', verb: 'MAULED BY A BEAR!' },
    gorilla: { hp: 320, walk: 1.2, run: 7.4, turn: 3.2, r: .8, temper: 'guard', guard: 6.5, hit: 28, reach: 1.6, knock: 12, cool: 1.8, call: 'chest', verb: 'PUNCHED BY A GORILLA!' },
    hippo: { hp: 600, walk: 1, run: 6.6, turn: 2.2, r: 1.15, temper: 'guard', guard: 5.5, hit: 36, reach: 2.3, knock: 7, cool: 2, call: 'grunt', verb: 'BITTEN BY A HIPPO!', heavy: true, swim: true },
    elephant: { hp: 900, walk: 1.2, run: 7.2, turn: 1.8, r: 1.6, temper: 'calm', hit: 40, reach: 3.2, knock: 13, cool: 2.4, call: 'trumpet', verb: 'TRAMPLED BY AN ELEPHANT!', heavy: true },
    giraffe: { hp: 300, walk: 1.4, run: 8, turn: 2.2, r: .8, temper: 'shy', shy: 5 },
    zebra: { hp: 160, walk: 1.5, run: 10, turn: 3.2, r: .65, temper: 'shy', shy: 8, call: 'bray' },
    penguin: { hp: 25, walk: .75, run: 2.1, turn: 5, r: .28, temper: 'shy', shy: 2.6, call: 'squawk', swim: true },
  },
  sense: 42, lose: 75,             // how far a loose hunter notices someone on foot; how far away you must get before it gives up (m)
  grudge: 22,                      // seconds an animal you hurt stays after you
  mercy: 1.2,                      // seconds after one of them gets you before another can
  stars: 2, heat: 3,               // letting animals out: stars at least, and heat
  cruelty: 1,                      // stars at least for knocking out one that was doing no harm (0 = nobody minds)
  carKnock: 4.5,                   // a car faster than this (m/s) bowls an animal over...
  carHurt: 7, carCost: .7,         // ...which costs the animal this much per m/s, and the car this much per m/s
  claw: .3, ram: .6,               // share of its hit an animal takes off a car you are sitting in: the lighter kinds, the two heavy ones
  leash: 200, reset: 240,          // how far from the zoo they stray (m); everyone is back home once you are this far away
};

// The law off the road: the police helicopter and the patrol boats (police/airSea.js).
export const POLICE_CRAFT = {
  heliStars: 3,              // a helicopter joins the chase from this many stars...
  heliStarsOff: 3,           // ...or this many, when you are in a boat or in the air and the cruisers can't follow
  heliPace: .75,             // how hard it flies after you on the ground (1 = flat out, 52 m/s): a sports car or a motorbike held wide open gets away
  heliPaceAir: .88,          // and when you are flying too: a Dragonfly held wide open slowly gets away
  heliFrom: 260,             // how far away it arrives from, m
  cruise: 75,                // the height it comes in at, m above the sea
  orbit: 30, orbitRate: .35, // it circles you this far out, at this many radians a second
  above: 24,                 // and this far above you (or above the roofs under it)
  heliSight: 110,            // while it is this close, has a clear line to you past the buildings and you are not under cover, the cops can see you
  heliLag: 1.5,              // seconds after everyone loses sight of you before it stops following you and circles where you were last seen
  heliSpot: 50,              // once it has lost you it only picks you up again inside this distance
  searchGrow: 4, searchMax: 30,   // its search circle widens by this many m a second, up to this much wider than `orbit`
  heliGiveUp: 6,             // seconds with nobody seeing you before it gives up and flies off
  heliStay: 55,              // seconds over you before it runs low on fuel and flies off (0 = it stays for good)
  boatSight: 80,
  boatFrom: [110, 170],      // patrol boats arrive from this far off, over open water
  boats: [0, 1, 1, 2, 2, 3], // how many, by stars, while you are afloat
  grab: 1.6,                 // seconds alongside a stopped boat before you are busted
  giveUp: 25,                // seconds after you leave the water before the boats drift off
  heliAgain: 40,             // seconds before another helicopter comes after one gives up, runs low on fuel or is brought down
  heliPay: 500, boatPay: 300,
};

export const BASE = {
  stars: 3,                                     // wanted level for trespassing (0 = the army doesn't mind)
  grace: 4,                                     // seconds inside the fence before the alarm goes
  heat: 70,                                     // heat added when it does
};

// ---------- Cops vs Robbers (net/match.js) ----------
// Two teams, two halves. One team robs while the other polices, then they swap; the team that stashed more wins.
// Playing together. OFF here: a copy of the game that is only files (GitHub Pages, a folder on a computer) never shows the
// "Play together" menu and never connects to anything. It is ON where the game's own server (server/ in this repo) hands
// out the page, because that server is also the relay: it marks the page and the game finds the relay at the same address.
// `enabled` and `relay` force it on for every copy with a relay somewhere else ('wss://...'). ?mp in the address switches
// it on for one page (the playtests).
export const NET = { enabled: false, relay: '' };

export const MATCH = {
  teams: [{ name: 'CRITTERS', color: '#ff6b8b' }, { name: 'TIN BOTS', color: '#4de3ff' }],   // team 0 robs in the first half
  lengths: [240, 360, 600], halfTime: 360,       // seconds a half can last (the host picks), and the usual pick
  countdown: 5, breakTime: 10,                   // seconds frozen before each half; seconds of half time
  // robbers
  holdUp: [1000, 2500], tillRefill: 120,         // what a till pays in a match, and how long until it fills again
  mug: [50, 200], smash: [20, 100],              // knocking a citizen out; driving through something breakable
  hotAt: 3000,                                   // carrying this much puts you on every cop's radar
  stashTime: 3, stashRadius: 4,                  // seconds standing in a stash ring; how wide the ring is
  stashes: ['tower', 'guns', 'hospital', 'gunsNorth', 'chop'],      // rooms (world/interiors.js) whose front door has a stash ring, plus the chop shop
  safehouses: ['motel', 'noodle', 'crab', 'taco', 'donut'],          // where robbers start and come back
  robberKit: { pistol: 36 }, robberDown: 8,      // their guns; seconds out after going down
  // cops
  copKit: { pistol: 60, shotgun: 24 }, copDown: 12,
  cuffRange: 2.6, cuffTime: 1.5,                 // hold C this close to a robber on foot for this long
  seeRange: 90,                                  // a robber closer than this shows on a cop's radar (hot ones and alarms always do)
  copRange: 160,                                 // a cop closer than this shows on a robber's radar
  alarmTime: 20,                                 // seconds a store alarm stays on the cops' radar
  shield: 5,                                     // seconds nobody can hurt you after coming back
};

// ---------- fist fights and knives (combat/combat.js, combat/brawlers.js) ----------
export const MELEE = {
  combo: 1.1,                                   // seconds you have to land the next punch for it to count as the same combination
  finisher: 3, finisherDamage: 2, finisherKnock: 6,    // every third punch in a row is a haymaker: this much more damage, and it floors them
  lunge: 3.2, lungeRange: 3,                    // a swing steps you toward whoever it is aimed at: m/s, and from how far away
  guard: .22, guardKnife: .5,                   // holding right mouse with fists or a knife up: the share of a punch (of a blade) that still gets through
  fightBack: { critter: .3, bighead: .35, bot: .45 },   // chance a citizen you punch squares up instead of running
  knifePrice: 150,                              // at Bullseye Guns
};
// People who fight you on foot. Every group below starts from `base` and overrides what it needs.
// hp, damage per hit, seconds between swings, reach (m), the wind-up before a swing lands (s), walking speed, how far they chase from home (m),
// how many may be on you at once (the rest circle), cash each one drops
export const BRAWL = {
  base: { hp: 95, damage: 7, rate: 1.25, reach: 1.55, wind: .4, speed: 3.9, leash: 70, crowd: 2, cash: [20, 60] },
  knife: { damage: 1.9, rate: 1.05, wind: .32 },             // what a blade changes
  pistol: { damage: 6, accuracy: .36, rate: 1.2, range: 30, hold: 9 },
  floorAt: 3,                                   // their punches floor you once this many have landed in a row without one of yours landing
  calm: 9,                                      // seconds with you out of reach and out of sight before they give up and go home
};
// The woods in High Meadows, and the camp in the clearing in the middle of them.
export const CAMP = {
  name: 'WHISPER WOODS', x: -208, z: 274, clear: 15,          // the clearing: centre and radius
  wake: 19,                                     // step this close (m) and they come for you
  crew: 7, knives: 2,                           // how many live there, and how many of them carry a blade
  fighter: { hp: 85, damage: 7, speed: 4.1, leash: 85, crowd: 2, cash: [5, 35] },
  reward: 500, back: 150,                       // cash for fighting them all off; they are back once you have been this many seconds away
};
// The bar downtown: bump into a drinker and he takes it personally.
export const BAR = {
  name: 'THE TIPSY POSSUM', drinkers: 6, drink: 20, tipsy: 22,      // a drink costs this, heals 25 and leaves you swaying this many seconds
  bump: .78,                                    // closer than this (m) to a drinker while you are moving counts as a bump
  join: .5,                                     // chance each of the others piles in when a fight starts
  fighter: { hp: 70, damage: 6, speed: 3.1, rate: 1.5, wind: .5, leash: 34, crowd: 2, cash: [10, 45] },
  back: 90,
};
// Gangs with a corner of their own. Hang about on it and they tell you once; stay, or touch one, and it is a fight.
// who: the cast family. armed: how many of each crew carry a knife / a pistol. turf: [x, z, name] of each corner.
export const GANGS = {
  warn: 9, warnTime: 4.5, close: 3.2,           // inside `warn` m they tell you to move on; still there after warnTime, or inside `close`, and they attack
  crew: 4, reward: 350, back: 120,
  fighter: { hp: 110, damage: 9, speed: 4.2, leash: 75, crowd: 2, cash: [40, 120] },
  gangs: {
    vipers: { name: 'NEON VIPERS', who: 'bighead', color: 0x9b3dff, ink: '#c58bff', glyph: 'V', knives: 1, pistols: 1, turf: [[27, -72, 'SUNSET STRIP'], [-186, 30, 'THE GAS STOP']] },
    kings: { name: 'SCRAP KINGS', who: 'scrap', color: 0xff7a1a, ink: '#ffa85c', glyph: 'K', knives: 2, pistols: 0, turf: [[200, 100, 'PORT SUNSET'], [222, -40, 'THE CONTAINER YARD']] },
    posse: { name: 'POSSUM POSSE', who: 'possum', color: 0x35c46a, ink: '#7be3a0', glyph: 'P', knives: 1, pistols: 2, turf: [[150, 660, 'BEHIND CORAL PLAZA'], [-112, -188, 'PALM PROMENADE']] },
  },
};

// ---------- the second chapter of the story (story/missions2.js, story/sea.js, world/siteTower.js) ----------
export const STORY2 = {
  // what each mission pays
  pay: { fish: 4000, cup: 6000, treasure: 40000, grand: 60000, frost: 15000 },
  frostClean: 5000,                 // the Frostbite Run: extra for getting the truck to the top without a scratch
  // the gun on the bow of your boat: shots a second, damage per hit, how far it reaches (m), how wide it looks for a target (radians)
  gun: { rate: 9, damage: 8, range: 120, cone: .22 },
  // crooks in boats: hull strength, seconds between their shots, damage per hit, chance to hit up close, range (m),
  // their top speed as a share of a stock speedboat's: while they are catching you up, and once they have
  raider: { health: 150, rate: 1.1, damage: 3.5, accuracy: .42, range: 55, fast: 1.3, pace: .96 },
  // fish: how many golden marlin and snapper swim in a school; a boat faster than `calm` m/s scares the ones within `scare` m,
  // and sends the ones within `dive` m under; cruising and bolting speeds (m/s); what a snapper is worth
  fish: { rare: 5, common: 10, calm: 9, scare: 15, dive: 6, speed: 2.6, flee: 7.5, pay: 20 },
  // spears: seconds between throws, reach (m), how wide the aim looks for a fish (radians), flight speed (m/s), how near the fish it must land (m)
  spear: { cool: .8, range: 36, cone: .24, speed: 36, hit: 1.9 },
  // the boat race: how close you pass a buoy gate (m). Each rival's top speed is a share of yours (skill); it drops by `band` for every
  // gate they are ahead and rises the same when they are behind, but never under `slow` or over `fast`
  race: { gate: 15, band: .45, slow: .78, fast: .972, skill: [.95, .92, .88] },
  // cracking the safe: seconds on the clock, tumblers to set, seconds lost on a miss, how wide the sweet spot is (0..1 of the dial) and how fast the needle sweeps
  safe: { time: 35, pins: 4, miss: 4, zone: .13, sweep: .95 },
  // the tower: guards that keep coming up the ramp once you are trapped on the roof (most at once, seconds between them)
  trap: { most: 5, every: 3.2 },
  // the treasure: seconds of digging at each spot, how many cars roll up for the shootout (three gunmen in each),
  // and how many boats come after you in each wave
  dig: 1.6, cars: 2, boats: [2, 3],
};
