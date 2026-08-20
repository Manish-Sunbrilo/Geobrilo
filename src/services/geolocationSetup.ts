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
export function ensureLocationReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = BackgroundGeolocation.ready({
      geolocation: {
        desiredAccuracy: DesiredAccuracy.High,
        distanceFilter: 10,
        locationAuthorizationRequest: 'Always',
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
      },
      logger: {
        debug: false,
      },
    }).then(() => undefined);
  }
  return readyPromise;
}
