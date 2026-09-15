import { GOOGLE_MAPS_API_KEY } from '../config/mapsConfig';

/** Reverse geocoding via Google's Geocoding API (Maps Platform), using the
 * same key configured for the native map SDKs. */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`,
    );
    const data = await response.json();
    if (data?.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
      return null;
    }
    const address = data.results[0]?.formatted_address;
    return typeof address === 'string' ? address : null;
  } catch {
    return null;
  }
}
