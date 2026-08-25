import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { syncAll } from './syncService';

const SYNC_INTERVAL_MS = 45000;

/**
 * Keeps locally-queued muster/trip records flowing to the server without
 * requiring a specific screen to be open. Local writes (check-in, trip
 * start/end, trip locations) always succeed offline; this is what actually
 * gets them to the server once connectivity is back, whether that happens
 * while the app is open, or by the time it's foregrounded again.
 */
export function useAutoSync(enabled: boolean): void {
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const runSync = () => {
      if (isSyncingRef.current) {
        return;
      }
      isSyncingRef.current = true;
      syncAll()
        .catch(() => undefined)
        .finally(() => {
          isSyncingRef.current = false;
        });
    };

    runSync();
    const interval = setInterval(runSync, SYNC_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        runSync();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled]);
}
