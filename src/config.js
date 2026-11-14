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
  brake: 30, handbrakeDecel: 7, engineBrake: 2.2, drag: 0.012,
  grip: 27, gripHandbrake: 8.5,          // max sideways acceleration (m/s^2) before the tyres let go
  steerLow: 0.6, steerHigh: 0.13,        // steering lock (rad) at standstill / top speed
  steerIn: 7, steerOut: 11,              // how fast the wheel turns in / returns to centre
  yawGrip: 13, yawSlide: 5.5,
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
