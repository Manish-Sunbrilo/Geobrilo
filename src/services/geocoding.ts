/**
 * Lightweight reverse geocoding via OpenStreetMap Nominatim (free, no API
 * key). The reference Android app used the on-device Geocoder for the same
 * purpose; this is the closest key-free equivalent available in RN without
 * adding a paid Google/Apple geocoding dependency.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      { headers: { 'User-Agent': 'GeobriloApp/1.0' } },
    );
    const data = await response.json();
    return typeof data?.display_name === 'string' ? data.display_name : null;
  } catch {
    return null;
  }
}
