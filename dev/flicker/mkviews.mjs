import fs from 'fs';
const nodes = [-378, -324, -270, -216, -162, -108, -54, 0, 54, 108, 162, 216, 270, 324, 378, 432, 486, 540, 594, 648, 702, 756, 810, 864, 918, 972];
const ground = [], air = [];
for (let i = 1; i < 14; i++) for (let j = 2; j < 25; j++) {
  const x = nodes[i], z = nodes[j];
  for (const [dx, dz, n] of [[1, 0, 'E'], [-1, 0, 'W'], [0, 1, 'N'], [0, -1, 'S']])
    ground.push({ name: `g${x}_${z}${n}`, pos: [x + dz * 2.5, 2.2, z + dx * 2.5], look: [x + dx * 60 + dz * 2.5, 1, z + dz * 60 + dx * 2.5], rel: true });
}
// mid-block views (inside lots, parks, yards): look diagonally
for (let i = 1; i < 14; i++) for (let j = 2; j < 24; j++) {
  const x = nodes[i] + 27, z = nodes[j] + 27;
  for (const [dx, dz, n] of [[1, 1, 'a'], [-1, -1, 'b']]) ground.push({ name: `m${x}_${z}${n}`, pos: [x - dx * 18, 2.2, z - dz * 18], look: [x + dx * 30, .5, z + dz * 30], rel: true });
}
for (let i = 1; i < 14; i += 2) for (let j = 2; j < 25; j += 2) {
  const x = nodes[i], z = nodes[j];
  for (const [dx, dz, n] of [[1, 0, 'E'], [-1, 0, 'W'], [0, 1, 'N'], [0, -1, 'S']]) {
    air.push({ name: `a40_${x}_${z}${n}`, pos: [x, 40, z], look: [x + dx * 140, 0, z + dz * 140], rel: true });
    air.push({ name: `a150_${x}_${z}${n}`, pos: [x, 150, z], look: [x + dx * 260, 0, z + dz * 260], rel: true });
  }
}
const split = (list, n) => Array.from({ length: n }, (_, k) => list.filter((_, i) => i % n === k));
split(ground, 3).forEach((l, k) => fs.writeFileSync(`views-g${k}.json`, JSON.stringify(l)));
fs.writeFileSync('views-air.json', JSON.stringify(air));
console.log(ground.length, air.length);
