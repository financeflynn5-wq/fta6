// Where a shot meets a ball: the distance along the ray (ox, oy, oz) + t (dx, dy, dz), or -1 for a miss.
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r, tmin, tmax) {
  const px = ox - cx, py = oy - cy, pz = oz - cz, a = dx * dx + dy * dy + dz * dz, b = 2 * (px * dx + py * dy + pz * dz), c = px * px + py * py + pz * pz - r * r;
  const disc = b * b - 4 * a * c; if (disc < 0) return -1;
  const s = Math.sqrt(disc), t1 = (-b - s) / (2 * a), t2 = (-b + s) / (2 * a);
  if (t2 < tmin || t1 > tmax) return -1;
  return Math.max(t1, tmin);
}
