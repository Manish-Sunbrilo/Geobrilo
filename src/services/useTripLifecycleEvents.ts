import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import BackgroundGeolocation, { type ConnectivityChangeEvent } from 'react-native-background-geolocation';
import { getLastAliveAt, getSession, getTrackingState, setLastAliveAt } from './storage';
import { insertTripEvent, TRIP_EVENT_APP_BACKGROUNDED, TRIP_EVENT_CONNECTIVITY_LOST, TRIP_EVENT_CONNECTIVITY_RESTORED, TRIP_EVENT_LOCATION_GAP } from '../db/tripEventsRepo';
import { syncAll, syncUnsyncedTripEvents } from './syncService';
import { formatIstDateTime, parseIstDateTime } from '../utils/datetime';

/** Below this, a quiet period is treated as normal (stationary, or just no heartbeat yet), not a gap worth reporting. */
const GAP_THRESHOLD_MS = 5 * 60 * 1000;

async function getActiveTripContext(): Promise<{ tripguid: string; userid: string } | null> {
  const [tracking, session] = await Promise.all([getTrackingState(), getSession()]);
  if (!tracking?.isTracking || !session?.userid) {
    return null;
  }
  return { tripguid: tracking.tripGuid, userid: session.userid };
}

async function markAlive(): Promise<void> {
  await setLastAliveAt(formatIstDateTime());
}

/**
 * Reports on things that can happen to an in-progress trip that the user
 * (or the office) would otherwise have no visibility into: the app being
 * backgrounded, connectivity dropping (e.g. flight mode), or an unexplained
 * gap in the tracking service being alive at all (e.g. the device was
 * powered off) -- see the LOCATION_GAP comment below for why that last one
 * is necessarily retroactive rather than real-time.
 *
 * Every detected event is written to local SQLite first (tripEventsRepo) and
 * flows out through the same offline sync queue as check-ins/trips -- so it
 * still gets recorded even if the very thing being reported is "we have no
 * connectivity right now".
 */
export function useTripLifecycleEvents(enabled: boolean): void {
  const wasConnectedRef = useRef<boolean | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    (async () => {
      // Retroactive gap check: if tracking was active and nothing (heartbeat
      // or location fix) has confirmed the service was alive for longer than
      // GAP_THRESHOLD_MS, the device was very likely off, killed, or
      // otherwise unreachable for that whole span -- there's no OS hook that
      // reliably fires *at the moment* of shutdown to report this live.
      const trip = await getActiveTripContext();
      if (trip) {
        const lastAliveAt = await getLastAliveAt();
        if (lastAliveAt) {
          const gapMs = Date.now() - parseIstDateTime(lastAliveAt).getTime();
          if (gapMs > GAP_THRESHOLD_MS) {
            const gapMinutes = Math.round(gapMs / 60000);
            await insertTripEvent(
              trip.tripguid,
              TRIP_EVENT_LOCATION_GAP,
              formatIstDateTime(),
              `No activity for ~${gapMinutes} min (last seen ${lastAliveAt})`,
              trip.userid,
            );
            syncUnsyncedTripEvents().catch(() => undefined);
          }
        }
      }
      if (!cancelled) {
        await markAlive();
      }
    })();

    const heartbeatSubscription = BackgroundGeolocation.onHeartbeat(() => {
      markAlive().catch(() => undefined);
    });

    const connectivitySubscription = BackgroundGeolocation.onConnectivityChange(
      (event: ConnectivityChangeEvent) => {
        const wasConnected = wasConnectedRef.current;
        wasConnectedRef.current = event.connected;
        // Skip the very first callback (initial state on registration) --
        // only real transitions are worth reporting.
        if (wasConnected === null || wasConnected === event.connected) {
          return;
        }
        (async () => {
          const trip = await getActiveTripContext();
          if (!trip) {
            return;
          }
          if (event.connected) {
            await insertTripEvent(trip.tripguid, TRIP_EVENT_CONNECTIVITY_RESTORED, formatIstDateTime(), '', trip.userid);
            syncAll().catch(() => undefined);
          } else {
            await insertTripEvent(trip.tripguid, TRIP_EVENT_CONNECTIVITY_LOST, formatIstDateTime(), '', trip.userid);
            syncUnsyncedTripEvents().catch(() => undefined);
          }
        })();
      },
    );

    const appStateSubscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === 'active') {
        markAlive().catch(() => undefined);
        return;
      }
      if (prev === 'active' && next === 'background') {
        (async () => {
          const trip = await getActiveTripContext();
          if (!trip) {
            return;
          }
          await insertTripEvent(trip.tripguid, TRIP_EVENT_APP_BACKGROUNDED, formatIstDateTime(), '', trip.userid);
          syncUnsyncedTripEvents().catch(() => undefined);
        })();
      }
    });

    return () => {
      cancelled = true;
      heartbeatSubscription.remove();
      connectivitySubscription.remove();
      appStateSubscription.remove();
    };
  }, [enabled]);
}
