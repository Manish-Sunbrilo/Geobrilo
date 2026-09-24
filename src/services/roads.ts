import { GOOGLE_MAPS_API_KEY } from '../config/mapsConfig';
import { haversineMeters, type LatLng } from '../utils/geo';

/** Google's Roads API accepts at most 100 points per snapToRoads call. */
const MAX_POINTS_PER_REQUEST = 100;

/** Below this fraction of input points actually matched to a road (via
 * `originalIndex` in the response), the snap is treated as unreliable --
 * e.g. a pedestrian/campus route through parking lots and walkways that
 * Roads API (built for on-road vehicle travel) can't confidently place --
 * rather than silently rendering a route missing most of the real trip. */
const MIN_MATCH_RATIO = 0.5;

/**
 * Above this distance (meters) from the *nearest* real recorded point,
 * a snapped point is considered untrustworthy. Checking only the snap's
 * start/end isn't enough: with a sparse trace (few points, e.g. a short
 * walk), Roads API can anchor both endpoints near real points while still
 * routing the *middle* of the path through a completely wrong nearby road
 * (observed: a 2-minute campus walk snapped onto a highway a few hundred
 * meters away) -- so every snapped point needs its own check.
 */
const MAX_POINT_DRIFT_METERS = 150;

function nearestDistanceMeters(point: LatLng, candidates: LatLng[]): number {
  let min = Infinity;
  for (const candidate of candidates) {
    const distance = haversineMeters(point, candidate);
    if (distance < min) {
      min = distance;
    }
  }
  return min;
}

function pathLengthMeters(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1], points[i]);
  }
  return total;
}

/**
 * Below this fraction of the *original recorded path's total length*, a
 * snap is rejected even if every individual point passed the per-point
 * drift check above -- that check alone missed a real bug: a genuine
 * out-and-back excursion (e.g. a ~100m westward walk and back) got pulled
 * onto the nearest through-road and collapsed into a short straight
 * segment, silently erasing real recorded movement, because every
 * individual snapped point still landed within MAX_POINT_DRIFT_METERS of
 * *some* original point even though the overall shape was gone.
 */
const MIN_LENGTH_RATIO = 0.6;

/**
 * Snaps a recorded GPS trace onto the most likely roads travelled, via
 * Google's Roads API (the purpose-built tool for this -- Directions API
 * computes routes between waypoints/stops, not a road-aligned fit through an
 * arbitrary trace). Falls back to the original points whenever the snap
 * can't be trusted (network error, no results, API not enabled, or the
 * quality checks below fail) so a bad snap never replaces a perfectly good
 * recorded route with a wrong or truncated one.
 *
 * Longer trips are snapped in independent batches of 100 -- each batch is
 * snapped on its own, so the path may show a small discontinuity at each
 * batch boundary rather than one perfectly continuous road-matched line.
 */
export async function snapToRoads(points: LatLng[]): Promise<LatLng[]> {
  if (points.length < 2) {
    return points;
  }

  const snapped: LatLng[] = [];
  let matchedCount = 0;

  for (let i = 0; i < points.length; i += MAX_POINTS_PER_REQUEST) {
    const batch = points.slice(i, i + MAX_POINTS_PER_REQUEST);
    const path = batch.map(p => `${p.latitude},${p.longitude}`).join('|');

    try {
      const response = await fetch(
        `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(path)}&interpolate=true&key=${GOOGLE_MAPS_API_KEY}`,
      );
      const data = await response.json();
      if (!Array.isArray(data?.snappedPoints) || data.snappedPoints.length === 0) {
        return points;
      }
      for (const snappedPoint of data.snappedPoints) {
        snapped.push({
          latitude: snappedPoint.location.latitude,
          longitude: snappedPoint.location.longitude,
        });
        if (typeof snappedPoint.originalIndex === 'number') {
          matchedCount++;
        }
      }
    } catch {
      return points;
    }
  }

  const matchRatio = matchedCount / points.length;
  const maxDrift = Math.max(...snapped.map(p => nearestDistanceMeters(p, points)));
  // <= (not <): a coin-flip match rate (exactly half matched, as observed on
  // a real 4-point trip that lost its last 2 points) is exactly the
  // unreliable case this guards against, not a borderline-acceptable one.
  if (matchRatio <= MIN_MATCH_RATIO || maxDrift > MAX_POINT_DRIFT_METERS) {
    return points;
  }

  const originalLength = pathLengthMeters(points);
  if (originalLength > 0 && pathLengthMeters(snapped) / originalLength < MIN_LENGTH_RATIO) {
    return points;
  }

  return snapped;
}
