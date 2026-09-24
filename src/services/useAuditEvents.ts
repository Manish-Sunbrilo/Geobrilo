import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import BackgroundGeolocation, { type ConnectivityChangeEvent } from 'react-native-background-geolocation';
import { ensureLocationReady } from './geolocationSetup';
import { DEFAULT_DEVICE_CONFIG } from '../config/apiConfig';
import {
  getDeviceConfig,
  getLastAliveAt,
  getLastKnownConnected,
  getSession,
  getTrackingState,
  setLastAliveAt,
  setLastKnownConnected,
} from './storage';
import {
  insertAuditEvent,
  E_FLIGHTMODE_ENABLE,
  E_FLIGHTMODE_DISABLE,
  E_GEOBRILO_APP_OFF,
  E_GEOBRILO_APP_ON,
  E_GEOBRILO_DEVICE_OFF,
  E_GEOBRILO_DEVICE_ON,
  E_GEOBRILO_INTERNET_OFF,
  E_GEOBRILO_INTERNET_ON,
} from '../db/auditEventsRepo';
import { syncAll, syncUnsyncedAuditEvents } from './syncService';
import { formatIstDateTime, parseIstDateTime } from '../utils/datetime';

/** Below this, a quiet period is treated as normal (stationary, or just no heartbeat yet), not a gap worth reporting. */
const GAP_THRESHOLD_MS = 5 * 60 * 1000;

async function currentIdentity(): Promise<{ userid: string; tripguid: string } | null> {
  const [session, tracking] = await Promise.all([getSession(), getTrackingState()]);
  if (!session?.userid) {
    return null;
  }
  return { userid: session.userid, tripguid: tracking?.isTracking ? tracking.tripGuid : '' };
}

async function markAlive(): Promise<void> {
  await setLastAliveAt(formatIstDateTime());
}

/**
 * BackgroundGeolocation.onConnectivityChange doesn't reliably reach JS while
 * the app is backgrounded -- confirmed live: toggling airplane mode on while
 * backgrounded (screen locked long enough for Android to kill the process),
 * then off after returning to the app, only ever recorded the "restored"
 * half of the pair. A plain network probe, independent of that native
 * callback, is what actually catches the missed half (see
 * reconcileConnectivity below).
 */
async function probeConnectivity(): Promise<boolean> {
  try {
    const config = (await getDeviceConfig()) ?? DEFAULT_DEVICE_CONFIG;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      await fetch(config.baseUrl, { method: 'HEAD', signal: controller.signal });
      return true;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}

/**
 * Compares actual current connectivity against the last known state
 * *persisted to disk* (not just an in-memory ref) and retroactively records
 * whatever pair of events was missed. Persisting is what makes this survive
 * the case that actually bit us: the app process itself got killed while
 * backgrounded (e.g. screen locked while the user reached Settings to
 * toggle airplane mode) -- an in-memory ref alone resets to unknown on every
 * fresh JS engine start, right when a missed transition is most likely.
 */
async function reconcileConnectivity(
  identity: { userid: string; tripguid: string },
  reasonSuffix: string,
): Promise<boolean> {
  const [persisted, current] = await Promise.all([getLastKnownConnected(), probeConnectivity()]);
  if (persisted !== null && persisted !== current) {
    const now = formatIstDateTime();
    if (current) {
      await insertAuditEvent(E_FLIGHTMODE_DISABLE, now, identity.userid, identity.tripguid, `Flight mode is disabled now (${reasonSuffix})`);
      await insertAuditEvent(E_GEOBRILO_INTERNET_ON, now, identity.userid, identity.tripguid, '');
    } else {
      await insertAuditEvent(E_FLIGHTMODE_ENABLE, now, identity.userid, identity.tripguid, `Flight mode is enabled now (${reasonSuffix})`);
      await insertAuditEvent(E_GEOBRILO_INTERNET_OFF, now, identity.userid, identity.tripguid, '');
    }
  }
  setLastKnownConnected(current).catch(() => undefined);
  return current;
}

/**
 * Reports app/device/connectivity audit events for as long as the user is
 * logged in -- not scoped to an active trip (tripguid is included when one
 * happens to be running, empty otherwise). Every event is written to local
 * SQLite first (auditEventsRepo) and flows out through the same offline
 * sync queue as check-ins/trips, so it's captured even if the very thing
 * being reported is "we have no connectivity right now".
 *
 * This engages the tracking SDK's lightweight "geofences-only" mode
 * (heartbeat + connectivity + geofence monitoring, no continuous GPS) as
 * soon as the user logs in, so these events fire independent of Track Me.
 * TrackMeScreen upgrades to full start() for an active trip's duration and
 * downgrades back to startGeofences() (not stop()) when it ends, keeping
 * this monitoring alive continuously rather than only during trips.
 */
export function useAuditEvents(enabled: boolean): void {
  const wasConnectedRef = useRef<boolean | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    (async () => {
      // Retroactive gap check: if nothing (heartbeat or location fix) has
      // confirmed the service was alive for longer than GAP_THRESHOLD_MS,
      // the device was very likely off, killed, or otherwise unreachable for
      // that whole span -- there's no OS hook that reliably fires *at the
      // moment* of shutdown to report this live.
      const identity = await currentIdentity();
      if (identity) {
        const lastAliveAt = await getLastAliveAt();
        if (lastAliveAt) {
          const gapMs = Date.now() - parseIstDateTime(lastAliveAt).getTime();
          if (gapMs > GAP_THRESHOLD_MS) {
            const gapMinutes = Math.round(gapMs / 60000);
            const now = formatIstDateTime();
            await insertAuditEvent(
              E_GEOBRILO_DEVICE_OFF,
              now,
              identity.userid,
              identity.tripguid,
              `No activity for ~${gapMinutes} min (last seen ${lastAliveAt})`,
            );
            await insertAuditEvent(E_GEOBRILO_DEVICE_ON, now, identity.userid, identity.tripguid, '');
          }
        }

        // Same idea, specifically for connectivity: catches a flight-mode/
        // internet transition that happened while this process was dead.
        const current = await reconcileConnectivity(identity, 'detected on app start');
        wasConnectedRef.current = current;

        // One sync call covers whatever either check above just inserted
        // (syncUnsyncedAuditEvents is safe to call even if nothing new
        // exists -- it's a no-op read of an empty unsynced list).
        syncUnsyncedAuditEvents().catch(() => undefined);
      }
      if (cancelled) {
        return;
      }
      await markAlive();

      try {
        await ensureLocationReady();
        // The SDK can already be mid-start on its own (e.g. auto-resuming a
        // previously-enabled session on boot, per its own doStartOnBoot
        // logic) by the time this effect runs. Calling startGeofences()
        // again while that's in flight throws "Waiting for previous start
        // action to complete" -- harmless (the SDK ends up started either
        // way), but checking current state first avoids the redundant call
        // and its noisy error entirely.
        const state = await BackgroundGeolocation.getState();
        if (!state.enabled) {
          await BackgroundGeolocation.requestPermission();
          await BackgroundGeolocation.startGeofences();
        }
      } catch (err) {
        console.warn('[useAuditEvents] failed to engage geofences-only mode:', err);
      }
    })();

    const heartbeatSubscription = BackgroundGeolocation.onHeartbeat(() => {
      markAlive().catch(() => undefined);
    });

    const connectivitySubscription = BackgroundGeolocation.onConnectivityChange(
      (event: ConnectivityChangeEvent) => {
        const wasConnected = wasConnectedRef.current;
        wasConnectedRef.current = event.connected;
        setLastKnownConnected(event.connected).catch(() => undefined);
        // Skip the very first callback (initial state on registration) --
        // only real transitions are worth reporting.
        if (wasConnected === null || wasConnected === event.connected) {
          return;
        }
        (async () => {
          const identity = await currentIdentity();
          if (!identity) {
            return;
          }
          const now = formatIstDateTime();
          // There's no reliable way to detect airplane mode specifically
          // (no public API on iOS at all) vs. just losing wifi/cell signal --
          // both event pairs fire together off the same connectivity signal.
          if (event.connected) {
            await insertAuditEvent(E_FLIGHTMODE_DISABLE, now, identity.userid, identity.tripguid, '');
            await insertAuditEvent(E_GEOBRILO_INTERNET_ON, now, identity.userid, identity.tripguid, '');
            syncAll().catch(() => undefined);
          } else {
            await insertAuditEvent(E_FLIGHTMODE_ENABLE, now, identity.userid, identity.tripguid, '');
            await insertAuditEvent(E_GEOBRILO_INTERNET_OFF, now, identity.userid, identity.tripguid, '');
            syncUnsyncedAuditEvents().catch(() => undefined);
          }
        })().catch(err => console.warn('[useAuditEvents] connectivity handler failed:', err));
      },
    );

    const appStateSubscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === 'active') {
        markAlive().catch(() => undefined);
        if (prev === 'background') {
          (async () => {
            const identity = await currentIdentity();
            if (!identity) {
              return;
            }
            const now = formatIstDateTime();
            await insertAuditEvent(E_GEOBRILO_APP_ON, now, identity.userid, identity.tripguid, '');

            // Catch up on a connectivity transition that happened while
            // backgrounded and never reached the onConnectivityChange
            // listener below.
            wasConnectedRef.current = await reconcileConnectivity(identity, 'while app was backgrounded');

            syncAll().catch(() => undefined);
          })().catch(err => console.warn('[useAuditEvents] resume reconciliation failed:', err));
        }
        return;
      }
      if (prev === 'active' && next === 'background') {
        (async () => {
          const identity = await currentIdentity();
          if (!identity) {
            return;
          }
          await insertAuditEvent(E_GEOBRILO_APP_OFF, formatIstDateTime(), identity.userid, identity.tripguid, '');
          syncUnsyncedAuditEvents().catch(() => undefined);
        })().catch(err => console.warn('[useAuditEvents] app-off handler failed:', err));
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
