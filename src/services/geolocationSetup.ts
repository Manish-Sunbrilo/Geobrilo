import BackgroundGeolocation from 'react-native-background-geolocation';

// DesiredAccuracy is only exposed as a static property on the default-exported
// class at runtime, not as a standalone named export from the package.
const DesiredAccuracy = BackgroundGeolocation.DesiredAccuracy;

let readyPromise: Promise<void> | null = null;

/**
 * react-native-background-geolocation requires ready() to be called once
 * before any other API (getCurrentPosition/start/stop/geofences). Safe to
 * call from multiple screens -- the underlying ready() call only happens once.
 */
const LOCATION_CONFIG = {
  geolocation: {
    desiredAccuracy: DesiredAccuracy.High,
    distanceFilter: 10,
    locationAuthorizationRequest: 'Always' as const,
  },
  // Confirmed via the SDK's own internal log (transistor_log.db) that this
  // belongs under `activity`, NOT `geolocation` -- placing it under
  // `geolocation` (an earlier attempt) was silently ignored by the native
  // side, which is why disableStopDetection kept showing up `false` in the
  // dumped live config despite being set `true` in JS.
  activity: {
    // Android's accelerometer/Activity-Recognition-based Stop-Detection
    // System otherwise declares "isMoving: false" almost immediately, sets
    // up a 150m "stationary geofence" around the current position, and
    // fully STOPS the location-tracking service until that geofence is
    // exited -- which is a much bigger, laggier bar than distanceFilter,
    // and is exactly why trips were only ever recording one point. Since
    // tracking here is explicitly start/stopped by the user (not an
    // always-on background feature), we want unconditional GPS-based
    // tracking for the whole active trip instead of that heuristic.
    disableStopDetection: true,
  },
  app: {
    stopOnTerminate: false,
    startOnBoot: true,
    // Presence of `notification` is what triggers Android's required
    // foreground-service notification for background tracking.
    notification: {
      title: 'Geobrilo',
      text: 'Tracking your trip location',
    },
    // Fires onHeartbeat even while stationary (60s is the Android
    // minimum) -- used as an "is the tracking service actually alive"
    // signal, since location fixes alone go quiet during normal
    // stationary periods too and would cause false positives.
    heartbeatInterval: 60,
  },
  logger: {
    debug: false,
  },
};

export function ensureLocationReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = BackgroundGeolocation.ready(LOCATION_CONFIG)
      // ready() only ever applies its config on the very first call for a
      // given install -- every later app launch just returns whatever was
      // already persisted natively, silently ignoring any config changes
      // made here since (e.g. a device that installed an earlier build
      // before disableStopDetection existed). An explicit setConfig() call
      // after ready() guarantees this config actually takes effect on every
      // launch, not just a fresh install.
      .then(() => BackgroundGeolocation.setConfig(LOCATION_CONFIG))
      .then(() => undefined);
  }
  return readyPromise;
}
