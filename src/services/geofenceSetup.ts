import BackgroundGeolocation, { type GeofenceEvent, type Subscription } from 'react-native-background-geolocation';
import { getAllBranches } from '../db/branchRepo';

const BRANCH_GEOFENCE_RADIUS_METERS = 1000;
const GEOFENCE_ID_PREFIX = 'branch-';

/** Registers a circular geofence around every known branch, replacing any previously registered set. */
export async function registerBranchGeofences(): Promise<void> {
  const branches = await getAllBranches();
  const geofences = branches
    .filter(b => b.latitude && b.longitude)
    .map(b => ({
      identifier: `${GEOFENCE_ID_PREFIX}${b.idbranch}`,
      radius: BRANCH_GEOFENCE_RADIUS_METERS,
      latitude: Number(b.latitude),
      longitude: Number(b.longitude),
      notifyOnEntry: true,
      notifyOnExit: true,
    }));

  await BackgroundGeolocation.removeGeofences();
  if (geofences.length > 0) {
    await BackgroundGeolocation.addGeofences(geofences);
  }
}

/**
 * Mirrors the reference Android app's GeofenceBroadcastReceiver: geofence
 * transitions are only logged, not acted on (no auto check-in/out -- the
 * reference app never wired that up either).
 */
export function subscribeToBranchGeofenceEvents(): Subscription {
  return BackgroundGeolocation.onGeofence((event: GeofenceEvent) => {
    const branchId = event.identifier.startsWith(GEOFENCE_ID_PREFIX)
      ? event.identifier.slice(GEOFENCE_ID_PREFIX.length)
      : event.identifier;
    console.log(`[Geofence] ${event.action} branch ${branchId}`);
  });
}
