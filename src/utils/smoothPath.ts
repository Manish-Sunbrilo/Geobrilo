export type LatLng = { latitude: number; longitude: number };

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

export function smoothPath(points: LatLng[], segments = 8): LatLng[] {
  if (points.length < 3) {
    return points;
  }

  const extended = [points[0], ...points, points[points.length - 1]];
  const result: LatLng[] = [];

  for (let i = 0; i < extended.length - 3; i++) {
    const p0 = extended[i];
    const p1 = extended[i + 1];
    const p2 = extended[i + 2];
    const p3 = extended[i + 3];

    for (let s = 0; s < segments; s++) {
      const t = s / segments;
      result.push({
        latitude: catmullRom(p0.latitude, p1.latitude, p2.latitude, p3.latitude, t),
        longitude: catmullRom(p0.longitude, p1.longitude, p2.longitude, p3.longitude, t),
      });
    }
  }

  result.push(points[points.length - 1]);
  return result;
}
