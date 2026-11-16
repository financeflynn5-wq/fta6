// The map of Sunset Coast as plain data: a 15 x 15 grid of corners, 54 m apart.
// Each corner has a height, each square between corners has a kind of land, and some of
// the grid lines carry a road. Everything else (terrain, traffic, radar) reads from here.
//
//            north: Vista Heights (steep streets, the lookout)
//   west: The Dustlands      DOWNTOWN (flat, the original city)      east: Port Sunset
//            south: Palm Promenade, the beach, the pier, the sea
import { WORLD } from '../config.js';

export const STEP = WORLD.PITCH;              // 54 m between grid lines
export const N = WORLD.nodes.length;          // 15 corners each way
export const X0 = WORLD.nodes[0];             // -378
export const FLAT = 10;                       // ground is level this far either side of a grid line (roads stay flat across)
export const ROAD_HALF = WORLD.ROAD / 2;      // 7
export const WATER = -1;                      // sea level; downtown streets are at 0
export const SEABED = WATER - 1.15;           // nothing sinks lower than this: you wade, you don't drown
export const CITY = { i0: 4, i1: 10 };        // downtown = corners 4..10 both ways (x, z from -162 to 162)
export const CITY_EDGE = 169;                 // outer edge of downtown's ring road

// Heights in metres. Rows run south (z = -378) to north (z = 378); columns west to east.
//          x: -378 -324 -270 -216 -162 -108  -54    0   54  108  162  216  270  324  378
export const HEIGHT = [
  /* -378 */ [-3,  -3,  -3,  -3,  -3,  -3,  -3,  -3,  -3,  -3,  -3,  -3,  -3,  -3,  -3],
  /* -324 */ [-3,  -3,  -3,  -3,  -3,  -3,  -3,  -3,  -3,  -3,  -3,  -3,  -3,  -3,  -3],
  /* -270 */ [ 4, -.2, -.4, -.4, -.4, -.4, -.4, -.4, -.4, -.4, -.4, -.5, -2.6, -3,  -3],
  /* -216 */ [16,   1,  .5,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,  -3],
  /* -162 */ [27,   3,   3,   1,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,  -3],
  /* -108 */ [32,   5,   6,   2,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,  -3],
  /*  -54 */ [30,   4,   4,   2,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,  -3],
  /*    0 */ [28,   3,   2,   1,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,  -3],
  /*   54 */ [32,   5,   5,   3,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,  -3],
  /*  108 */ [36,   7,   8,   4,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,  -3],
  /*  162 */ [36,   7,   7,   4,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,  -3],
  /*  216 */ [38,   7,   6,   4,   4,   5,   6,   7,   7,   6,   4,   2,   1,  .5,  -3],
  /*  270 */ [46,  12,  10,   8,   9,  12,  14,  15,  16,  12,   8,   5,   3,   2,  -3],
  /*  324 */ [56,  20,  16,  12,  13,  18,  22,  24,  25,  19,  11,   7,   5,   4,  -2],
  /*  378 */ [80,  62,  58,  54,  56,  62,  68,  72,  74,  66,  56,  46,  38,  30,   8],
];

// What each square of land is. (ci, cj) is the square north-east of corner (ci, cj).
export function cellType(ci, cj) {
  if (ci >= CITY.i0 && ci < CITY.i1 && cj >= CITY.i0 && cj < CITY.i1) return 'city';
  if (cj <= 1) return 'sea';
  if (ci === 0) return 'rock';
  if (cj === 13) return ci === 13 ? 'grass' : 'rock';
  if (cj === 2) return ci <= 11 ? 'sand' : 'sea';
  if (ci === 13) return cj <= 9 ? 'quay' : 'grass';
  if (ci >= 10) return cj <= 9 ? 'port' : 'grass';
  if (cj === 3) return ci <= 3 ? 'scrub' : 'park';
  if (cj >= 10) return ci <= 3 ? 'grass' : 'hill';
  return (ci + cj) % 2 ? 'dirt' : 'scrub';       // the Dustlands
}

// ---------- roads ----------
// A road is a run along a grid line: [axis, line index, from, to].
// 'x' runs west-east along row j; 'z' runs south-north along column i.
const RUNS = [
  // the outer loop: coast road, port road, hill road, desert road
  ['x', 3, 1, 12], ['z', 12, 3, 11], ['x', 11, 1, 12], ['z', 1, 3, 11],
  // ways in and out of downtown
  ['z', 4, 3, 4], ['z', 7, 3, 4], ['z', 10, 3, 4], ['x', 7, 1, 4],
  // Port Sunset
  ['x', 4, 10, 13], ['x', 7, 10, 13], ['x', 10, 10, 13], ['z', 13, 4, 10],
  // Vista Heights
  ['x', 12, 4, 10], ['x', 13, 4, 10],
  ['z', 4, 10, 13], ['z', 5, 10, 12], ['z', 6, 10, 13], ['z', 7, 10, 13], ['z', 8, 10, 13], ['z', 9, 10, 12], ['z', 10, 10, 13],
];
const roadSet = new Set();
const key = (i1, j1, i2, j2) => (i1 < i2 || j1 < j2) ? i1 + ',' + j1 + ',' + i2 + ',' + j2 : i2 + ',' + j2 + ',' + i1 + ',' + j1;
for (let i = CITY.i0; i <= CITY.i1; i++) for (let j = CITY.i0; j <= CITY.i1; j++) {
  if (i < CITY.i1) roadSet.add(key(i, j, i + 1, j));
  if (j < CITY.i1) roadSet.add(key(i, j, i, j + 1));
}
for (const [axis, line, a, b] of RUNS) for (let k = a; k < b; k++) roadSet.add(axis === 'x' ? key(k, line, k + 1, line) : key(line, k, line, k + 1));

// Is there a road between these two neighbouring corners?
export const hasRoad = (i1, j1, i2, j2) => roadSet.has(key(i1, j1, i2, j2));
export const nodeHasRoad = (i, j) => hasRoad(i, j, i + 1, j) || hasRoad(i - 1, j, i, j) || hasRoad(i, j, i, j + 1) || hasRoad(i, j - 1, i, j);
export const nodeX = (i) => X0 + STEP * i;
// Every stretch of road as { i, j, di, dj } (one entry per direction of travel).
export const ROAD_EDGES = [];
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  if (i < N - 1 && hasRoad(i, j, i + 1, j)) ROAD_EDGES.push({ i, j, di: 1, dj: 0 }, { i: i + 1, j, di: -1, dj: 0 });
  if (j < N - 1 && hasRoad(i, j, i, j + 1)) ROAD_EDGES.push({ i, j, di: 0, dj: 1 }, { i, j: j + 1, di: 0, dj: -1 });
}
export const inDowntown = (x, z) => Math.abs(x) <= CITY_EDGE && Math.abs(z) <= CITY_EDGE;

// Names for the radar, fares and "now entering" banners.
const DOWNTOWN = [['PIER SIDE', 'SUNSET STRIP', 'DOCKSIDE'], ['NEON ROW', 'MIDTOWN', 'MARKET ROW'], ['PALM HEIGHTS', 'OLD TOWN', 'THE FLATS']];
export function districtAt(x, z) {
  if (inDowntown(x, z)) { const t = (v) => Math.max(0, Math.min(2, Math.floor((v / CITY_EDGE + 1) * 1.5))); return DOWNTOWN[t(z)][t(x)]; }
  if (z < -CITY_EDGE && z >= -226 && Math.abs(x) <= CITY_EDGE) return 'PALM PROMENADE';
  if (z < -226 && x > -340 && x < 230) return 'SUNSET BEACH';
  if (x > CITY_EDGE && z < 190) return 'PORT SUNSET';
  if (z > CITY_EDGE && x >= -CITY_EDGE) return x > 190 ? 'LIGHTHOUSE BLUFFS' : 'VISTA HEIGHTS';
  if (x < -CITY_EDGE) return z > 190 ? 'HIGH MEADOWS' : 'THE DUSTLANDS';
  return 'SUNSET BEACH';
}
