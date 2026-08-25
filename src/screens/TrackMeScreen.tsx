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
import MapView, { Marker, Polyline, type MapType, type Region } from 'react-native-maps';
import BackgroundGeolocation, { type Location, type Subscription } from 'react-native-background-geolocation';
import { useAuth } from '../context/AuthContext';
import { ensureLocationReady } from '../services/geolocationSetup';
import { insertTrip, updateTripEnd, updateTripRemark } from '../db/tripsRepo';
import { getLocationsForTrip, insertTripLocation } from '../db/tripLocationsRepo';
import { syncUnsyncedTripEnds, syncUnsyncedTripLocations, syncUnsyncedTripStarts } from '../services/syncService';
import { generateUuidV4 } from '../utils/uuid';
import { getTrackingState, setTrackingState, clearTrackingState } from '../services/storage';
import { smoothPath } from '../utils/smoothPath';
import MapZoomControls from '../components/MapZoomControls';
import MapTypeToggle from '../components/MapTypeToggle';

const MIN_DELTA = 0.00015;
const MAX_DELTA = 40;

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

type LatLng = { latitude: number; longitude: number };

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
        setPath(existingPoints.map(p => ({ latitude: Number(p.latitude), longitude: Number(p.longitude) })));
        await attachLocationListener(state.tripGuid);
      }
    })();
    return () => {
      subscriptionRef.current?.remove();
    };
  }, []);

  const attachLocationListener = async (guid: string) => {
    await ensureLocationReady();
    subscriptionRef.current?.remove();
    subscriptionRef.current = BackgroundGeolocation.onLocation(async (location: Location) => {
      const point: LatLng = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setPath(prev => [...prev, point]);
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
        new Date().toISOString().slice(0, 19).replace('T', ' '),
        user.userid,
      );
      syncUnsyncedTripLocations().catch(() => undefined);
    });
  };

  const handleStart = async () => {
    if (!user) {
      return;
    }
    setIsBusy(true);
    try {
      const guid = generateUuidV4();
      const startTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await insertTrip(guid, description, startTime, user.userid);
      syncUnsyncedTripStarts().catch(() => undefined);

      await setTrackingState({ isTracking: true, tripGuid: guid, description });
      setTripGuid(guid);
      setIsTracking(true);
      setPath([]);

      await ensureLocationReady();
      await BackgroundGeolocation.requestPermission();
      await BackgroundGeolocation.start();
      await attachLocationListener(guid);
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
      const endTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await updateTripRemark(tripGuid, remark);
      await updateTripEnd(tripGuid, endTime);
      syncUnsyncedTripEnds().catch(() => undefined);

      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      await BackgroundGeolocation.stop();
      await clearTrackingState();

      setIsTracking(false);
      setTripGuid(null);
      setPath([]);
      setRemark('');
      setDescription(defaultDescription());
    } finally {
      setIsBusy(false);
    }
  };

  const lastPoint = path[path.length - 1];
  const smoothedPath = useMemo(() => smoothPath(path), [path]);

  useEffect(() => {
    if (!lastPoint) {
      return;
    }
    if (!hasCenteredRef.current) {
      const next: Region = { latitude: lastPoint.latitude, longitude: lastPoint.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      regionRef.current = next;
      hasCenteredRef.current = true;
      mapRef.current?.animateToRegion(next, 500);
    } else {
      mapRef.current?.animateCamera({ center: lastPoint }, { duration: 500 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPoint?.latitude, lastPoint?.longitude]);

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
          onRegionChangeComplete={region => {
            regionRef.current = region;
          }}
        >
          {smoothedPath.length > 1 && <Polyline coordinates={smoothedPath} strokeColor={palette.primary} strokeWidth={4} />}
          {path.length > 0 && <Marker coordinate={path[0]} title="Start" pinColor="green" />}
          {lastPoint && path.length > 1 && (
            <Marker coordinate={lastPoint} title="Current position" pinColor="red" />
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
