import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, type MapType, type Region } from 'react-native-maps';
import RoutePolyline from '../components/RoutePolyline';
import DirectionArrowMarker from '../components/DirectionArrowMarker';
import BackgroundGeolocation, { type Location, type Subscription } from 'react-native-background-geolocation';
import { useAuth } from '../context/AuthContext';
import { ensureLocationReady } from '../services/geolocationSetup';
import { insertTrip, updateTripEnd, updateTripRemark } from '../db/tripsRepo';
import { getLocationsForTrip, insertTripLocation } from '../db/tripLocationsRepo';
import { syncUnsyncedTripEnds, syncUnsyncedTripLocations, syncUnsyncedTripStarts } from '../services/syncService';
import { generateUuidV4 } from '../utils/uuid';
import { getTrackingState, setTrackingState, clearTrackingState, setLastAliveAt } from '../services/storage';
import { smoothPath } from '../utils/smoothPath';
import { snapToRoads } from '../services/roads';
import { formatIstDateTime } from '../utils/datetime';
import type { LatLng } from '../utils/geo';
import MapZoomControls from '../components/MapZoomControls';
import MapTypeToggle from '../components/MapTypeToggle';

const MIN_DELTA = 0.00015;
const MAX_DELTA = 40;
/** Camera tilt (degrees) needed for 3D building shapes to actually show height instead of a flat outline. */
const BUILDING_TILT_PITCH = 45;

const palette = {
  primary: '#4F46E5',
  onPrimary: '#FFFFFF',
  light: {
    background: '#F3F4F8',
    card: '#FFFFFF',
    border: '#E5E7EB',
    inputBackground: '#F9FAFB',
    inputBorder: '#E2E4EA',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
  },
  dark: {
    background: '#0B1120',
    card: '#151B2C',
    border: '#232B3D',
    inputBackground: '#1B2436',
    inputBorder: '#2A3348',
    textPrimary: '#F3F4F6',
    textSecondary: '#9CA3AF',
  },
};

/** Live road-snapping is throttled (both by time and by how many new points
 * have come in) since -- unlike a one-time snap when reviewing a finished
 * trip -- this repeats for as long as the trip is active, and each call is a
 * billed Roads API request. Tune these if the route updates feel too
 * sluggish or the request volume needs to come down further. */
const LIVE_SNAP_MIN_INTERVAL_MS = 20000;
const LIVE_SNAP_MIN_NEW_POINTS = 8;

function defaultDescription(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Trip_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function TrackMeScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? palette.dark : palette.light;
  const { user } = useAuth();

  const [description, setDescription] = useState(defaultDescription());
  const [isTracking, setIsTracking] = useState(false);
  const [tripGuid, setTripGuid] = useState<string | null>(null);
  const [path, setPath] = useState<LatLng[]>([]);
  const [heading, setHeading] = useState(0);
  const [snappedPath, setSnappedPath] = useState<LatLng[]>([]);
  const [snappedUpToCount, setSnappedUpToCount] = useState(0);
  const pathRef = useRef<LatLng[]>([]);
  const snapRequestIdRef = useRef(0);
  const lastSnapAtRef = useRef(0);
  const lastSnapCountRef = useRef(0);
  const [isBusy, setIsBusy] = useState(false);
  const [remarkModalVisible, setRemarkModalVisible] = useState(false);
  const [remark, setRemark] = useState('');
  const subscriptionRef = useRef<Subscription | null>(null);
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>({
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 10,
    longitudeDelta: 10,
  });
  const hasCenteredRef = useRef(false);
  const [mapType, setMapType] = useState<MapType>('standard');

  useEffect(() => {
    (async () => {
      const state = await getTrackingState();
      if (state?.isTracking) {
        setIsTracking(true);
        setTripGuid(state.tripGuid);
        setDescription(state.description);
        const existingPoints = await getLocationsForTrip(state.tripGuid);
        const restoredPath = existingPoints.map(p => ({ latitude: Number(p.latitude), longitude: Number(p.longitude) }));
        pathRef.current = restoredPath;
        setPath(restoredPath);
        maybeSnapLivePath(restoredPath);
        await attachLocationListener(state.tripGuid);
      }
    })();
    return () => {
      subscriptionRef.current?.remove();
    };
  }, []);

  const maybeSnapLivePath = (currentPath: LatLng[]) => {
    if (currentPath.length < 2) {
      return;
    }
    const now = Date.now();
    const grewEnough = currentPath.length - lastSnapCountRef.current >= LIVE_SNAP_MIN_NEW_POINTS;
    const enoughTimePassed = now - lastSnapAtRef.current >= LIVE_SNAP_MIN_INTERVAL_MS;
    if (!grewEnough && !enoughTimePassed) {
      return;
    }
    lastSnapAtRef.current = now;
    lastSnapCountRef.current = currentPath.length;
    const requestId = ++snapRequestIdRef.current;
    const snappedUpTo = currentPath.length;
    snapToRoads(currentPath).then(result => {
      if (snapRequestIdRef.current === requestId) {
        setSnappedPath(result);
        setSnappedUpToCount(snappedUpTo);
      }
    });
  };

  const handleIncomingLocation = async (guid: string, location: Location) => {
    // Defensive: an occasional malformed/partial location event (observed
    // on iOS right after start()) can arrive without `coords` -- skip it
    // rather than crash the whole screen on `.latitude` of undefined.
    if (!location?.coords) {
      console.warn('[TrackMe] location fired without coords, skipping:', location);
      return;
    }
    const point: LatLng = { latitude: location.coords.latitude, longitude: location.coords.longitude };
    const nextPath = [...pathRef.current, point];
    pathRef.current = nextPath;
    setPath(nextPath);
    // GPS heading is -1 (undefined) when the device isn't moving fast
    // enough for a reliable bearing -- keep pointing the last known
    // direction rather than snapping to an arbitrary value.
    if (typeof location.coords.heading === 'number' && location.coords.heading >= 0) {
      setHeading(location.coords.heading);
    }
    setLastAliveAt(formatIstDateTime()).catch(() => undefined);
    maybeSnapLivePath(nextPath);
    if (!user) {
      return;
    }
    await insertTripLocation(
      guid,
      location.coords.latitude,
      location.coords.longitude,
      location.coords.accuracy,
      location.coords.altitude ?? 0,
      location.coords.speed ?? 0,
      location.coords.heading ?? 0,
      formatIstDateTime(new Date()),
      user.userid,
    );
    syncUnsyncedTripLocations().catch(() => undefined);
  };

  const attachLocationListener = async (guid: string) => {
    await ensureLocationReady();
    subscriptionRef.current?.remove();
    subscriptionRef.current = BackgroundGeolocation.onLocation(
      (location: Location) => {
        handleIncomingLocation(guid, location);
      },
      (error: unknown) => {
        console.warn('[TrackMe] onLocation error:', error);
      },
    );
  };

  const handleStart = async () => {
    if (!user) {
      return;
    }
    setIsBusy(true);
    try {
      const guid = generateUuidV4();
      const startTime = formatIstDateTime(new Date());
      await insertTrip(guid, description, startTime, user.userid);
      syncUnsyncedTripStarts().catch(() => undefined);

      await setTrackingState({ isTracking: true, tripGuid: guid, description });
      setTripGuid(guid);
      setIsTracking(true);
      pathRef.current = [];
      setPath([]);
      setSnappedPath([]);
      setSnappedUpToCount(0);
      lastSnapAtRef.current = 0;
      lastSnapCountRef.current = 0;
      hasCenteredRef.current = false;

      await ensureLocationReady();
      await BackgroundGeolocation.requestPermission();
      await BackgroundGeolocation.start();
      // Force "moving" pace immediately rather than trusting the SDK's own
      // Activity-Recognition-based motion detection -- on hardware missing
      // a gyroscope/magnetometer (confirmed via this device's own sensor
      // log), that detection is unreliable and can declare "not moving"
      // right away, dropping into a low-power geofence-only mode that stops
      // recording further points for the rest of the trip.
      await BackgroundGeolocation.changePace(true);
      await attachLocationListener(guid);
      // start()'s own first fix can take a while on a cold GPS lock --
      // request one explicitly, accepting a recent cached position
      // (maximumAge) and a loose accuracy (100m, vs the plugin's default
      // 25m stationaryRadius) so a fast network/wifi fix can satisfy this
      // immediately instead of blocking for a full satellite lock. The
      // ongoing onLocation stream (above) keeps refining accuracy regardless.
      BackgroundGeolocation.getCurrentPosition({ persist: true, maximumAge: 10000, timeout: 30, desiredAccuracy: 100 })
        .then(location => handleIncomingLocation(guid, location))
        .catch(err => console.warn('[TrackMe] getCurrentPosition failed:', err));
    } catch {
      Alert.alert('Could not start tracking', 'Please check location permissions and try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const confirmEnd = async () => {
    if (!tripGuid || !user) {
      return;
    }
    setRemarkModalVisible(false);
    setIsBusy(true);
    try {
      const endTime = formatIstDateTime(new Date());
      await updateTripRemark(tripGuid, remark);
      await updateTripEnd(tripGuid, endTime);
      syncUnsyncedTripEnds().catch(() => undefined);

      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      // Downgrade to lightweight geofences-only mode instead of a full
      // stop() -- useAuditEvents engages that mode as soon as the user logs
      // in and expects it to keep running for app/device/connectivity audit
      // events independent of whether a trip is active, not just stop dead
      // the moment this trip ends.
      await BackgroundGeolocation.startGeofences();
      await clearTrackingState();

      setIsTracking(false);
      setTripGuid(null);
      // Path is intentionally kept (not cleared) so the completed route with
      // its Start/End pins stays visible on the map -- it's only cleared
      // when a new trip actually starts.
      // One final snap ignores the live throttle -- worth the extra call to
      // leave the just-finished trip showing its cleanest possible route.
      const requestId = ++snapRequestIdRef.current;
      const finalPointCount = pathRef.current.length;
      snapToRoads(pathRef.current).then(result => {
        if (snapRequestIdRef.current === requestId) {
          setSnappedPath(result);
          setSnappedUpToCount(finalPointCount);
        }
      });
      setRemark('');
      setDescription(defaultDescription());
    } finally {
      setIsBusy(false);
    }
  };

  const lastPoint = path[path.length - 1];
  const smoothedPath = useMemo(() => smoothPath(path), [path]);
  // Only the points not yet covered by a confirmed snap -- smoothed on its
  // own so the route keeps extending live instead of freezing at the last
  // snap while waiting for the next throttled one.
  const livePathTail = useMemo(() => smoothPath(path.slice(snappedUpToCount)), [path, snappedUpToCount]);
  const displayPath = useMemo(() => {
    if (snappedPath.length < 2) {
      return smoothedPath;
    }
    return livePathTail.length > 0 ? [...snappedPath, ...livePathTail] : snappedPath;
  }, [snappedPath, livePathTail, smoothedPath]);

  useEffect(() => {
    if (!lastPoint) {
      return;
    }
    // Turn-by-turn-style auto-follow: rotate the camera to match travel
    // direction (not just recentering) while a trip is actively tracking, so
    // "up" on screen means "the way you're going" -- same as Uber/Zomato's
    // live rider view. DirectionArrowMarker's rotation is an absolute compass
    // bearing (not screen-relative), so once the camera heading matches it,
    // the arrow lands pointing straight up on screen for free. Only while
    // isTracking -- once a trip ends this stays frozen at its last heading
    // rather than fighting the user's own panning while reviewing the route.
    if (!hasCenteredRef.current) {
      const next: Region = { latitude: lastPoint.latitude, longitude: lastPoint.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      regionRef.current = next;
      hasCenteredRef.current = true;
      mapRef.current?.animateToRegion(next, 500);
      // animateToRegion has no pitch/heading params -- 3D building shapes
      // (showsBuildings above) only actually render with visible height once
      // the camera is tilted, and the follow-rotation needs a separate call too.
      mapRef.current?.animateCamera(
        { pitch: BUILDING_TILT_PITCH, heading: isTracking ? heading : 0 },
        { duration: 500 },
      );
    } else {
      mapRef.current?.animateCamera(
        { center: lastPoint, pitch: BUILDING_TILT_PITCH, heading: isTracking ? heading : 0 },
        { duration: 500 },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPoint?.latitude, lastPoint?.longitude, heading, isTracking]);

  const handleZoom = (factor: number) => {
    const current = regionRef.current;
    const next: Region = {
      ...current,
      latitudeDelta: Math.min(MAX_DELTA, Math.max(MIN_DELTA, current.latitudeDelta * factor)),
      longitudeDelta: Math.min(MAX_DELTA, Math.max(MIN_DELTA, current.longitudeDelta * factor)),
    };
    regionRef.current = next;
    mapRef.current?.animateToRegion(next, 250);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['bottom']}>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          mapType={mapType}
          initialRegion={regionRef.current}
          showsBuildings
          onRegionChangeComplete={region => {
            regionRef.current = region;
          }}
        >
          <RoutePolyline coordinates={displayPath} color={palette.primary} />
          {path.length > 0 && <Marker coordinate={path[0]} title="Start" pinColor="green" />}
          {lastPoint && path.length > 1 && isTracking && (
            <DirectionArrowMarker coordinate={lastPoint} heading={heading} color={palette.primary} />
          )}
          {lastPoint && path.length > 1 && !isTracking && (
            <Marker coordinate={lastPoint} title="End" pinColor="red" />
          )}
        </MapView>
        <MapZoomControls onZoomIn={() => handleZoom(0.5)} onZoomOut={() => handleZoom(2)} />
        <MapTypeToggle
          mapType={mapType}
          onToggle={() => setMapType(t => (t === 'standard' ? 'hybrid' : 'standard'))}
        />
      </View>

      <View style={styles.form}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Description</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary },
          ]}
          value={description}
          onChangeText={setDescription}
          editable={!isTracking}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.startButton, (isTracking || isBusy) && styles.buttonDisabled]}
            onPress={handleStart}
            disabled={isTracking || isBusy}
            activeOpacity={0.85}
          >
            {isBusy && !isTracking ? (
              <ActivityIndicator color={palette.onPrimary} />
            ) : (
              <Text style={styles.startButtonText}>Start Tracking</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.endButton, (!isTracking || isBusy) && styles.buttonDisabled]}
            onPress={() => setRemarkModalVisible(true)}
            disabled={!isTracking || isBusy}
            activeOpacity={0.85}
          >
            <Text style={[styles.endButtonText, { color: theme.textPrimary }]}>End Tracking</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={remarkModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>End Trip</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Add an optional remark before ending this trip.
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary },
              ]}
              value={remark}
              onChangeText={setRemark}
              placeholder="Remark"
              placeholderTextColor={theme.textSecondary}
              multiline
            />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity onPress={() => setRemarkModalVisible(false)} style={styles.modalCancelButton}>
                <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmEnd} style={styles.modalConfirmButton}>
                <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>End Trip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mapContainer: { height: 300 },
  map: { flex: 1 },
  form: { padding: 16 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 16,
  },
  buttonRow: { flexDirection: 'row', gap: 12 },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  startButton: { backgroundColor: palette.primary },
  startButtonText: { color: palette.onPrimary, fontWeight: '700', fontSize: 14 },
  endButton: { borderWidth: 1.5, borderColor: '#DC2626' },
  endButtonText: { fontWeight: '700', fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, marginBottom: 12 },
  modalInput: {
    minHeight: 70,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingTop: 10,
    fontSize: 14,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  modalButtonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  modalCancelButton: { paddingVertical: 10, paddingHorizontal: 8 },
  modalConfirmButton: {
    backgroundColor: palette.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
});

export default TrackMeScreen;
