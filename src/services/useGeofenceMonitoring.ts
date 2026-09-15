import { useEffect } from 'react';
import { ensureLocationReady } from './geolocationSetup';
import { registerBranchGeofences, subscribeToBranchGeofenceEvents } from './geofenceSetup';

/** Registers branch geofences and logs enter/exit transitions while a user is signed in. */
export function useGeofenceMonitoring(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let subscription: ReturnType<typeof subscribeToBranchGeofenceEvents> | null = null;
    let cancelled = false;

    (async () => {
      try {
        await ensureLocationReady();
        if (cancelled) {
          return;
        }
        subscription = subscribeToBranchGeofenceEvents();
        await registerBranchGeofences();
      } catch (err) {
        console.error('[useGeofenceMonitoring] setup failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);
}
