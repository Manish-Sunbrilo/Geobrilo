import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Circle, Marker, type MapType, type Region } from 'react-native-maps';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { launchCamera } from 'react-native-image-picker';
import BackgroundGeolocation from 'react-native-background-geolocation';
import { useAuth } from '../context/AuthContext';
import { ensureLocationReady } from '../services/geolocationSetup';
import { reverseGeocode } from '../services/geocoding';
import { getAllBranches, type BranchRow } from '../db/branchRepo';
import { getOpenMusterSession, insertMuster, type OpenMusterSession } from '../db/musterRepo';
import { syncUnsyncedMusters } from '../services/syncService';
import { generateUuidV4 } from '../utils/uuid';
import { ensureCameraPermission } from '../utils/cameraPermission';
import MapZoomControls from '../components/MapZoomControls';
import MapTypeToggle from '../components/MapTypeToggle';
import {
  MUSTER_CHECK_IN,
  MUSTER_CHECK_OUT,
  MUSTER_MISSED_CHECKIN,
  MUSTER_MISSED_CHECKOUT,
  type MusterPresenseType,
} from '../constants/attendance';

const BRANCH_RADIUS_METERS = 1000;
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

type Coords = {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number;
  speed: number;
  heading: number;
};

function isToday(yyyyMmDd: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return today === yyyyMmDd;
}

/**
 * Normally "now". For a missed-checkout entry the record is dated to the day
 * it was actually missed (overrideDate), not today — only the time-of-day
 * component comes from when this screen is actually submitted, since the
 * real time they left isn't known.
 */
function buildMusterDateTime(overrideDate?: string): string {
  const iso = new Date().toISOString();
  if (overrideDate) {
    return `${overrideDate} ${iso.slice(11, 19)}`;
  }
  return iso.slice(0, 19).replace('T', ' ');
}

function MarkAttendanceScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? palette.dark : palette.light;
  const navigation = useNavigation();
  const { user } = useAuth();

  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationText, setLocationText] = useState('Fetching location...');
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  const [remark, setRemark] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState(new Date());
  const [openSession, setOpenSession] = useState<OpenMusterSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>({ latitude: 20.5937, longitude: 78.9629, latitudeDelta: 10, longitudeDelta: 10 });
  const [mapType, setMapType] = useState<MapType>('standard');

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

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    getAllBranches().then(setBranches).catch(() => setBranches([]));

    (async () => {
      try {
        await ensureLocationReady();
        await BackgroundGeolocation.requestPermission();
        const location = await BackgroundGeolocation.getCurrentPosition({
          samples: 1,
          persist: false,
        });
        const nextCoords: Coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          altitude: location.coords.altitude ?? 0,
          speed: location.coords.speed ?? 0,
          heading: location.coords.heading ?? 0,
        };
        setCoords(nextCoords);
        regionRef.current = {
          latitude: nextCoords.latitude,
          longitude: nextCoords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        const address = await reverseGeocode(nextCoords.latitude, nextCoords.longitude);
        setLocationText(address ?? `${nextCoords.latitude.toFixed(6)}, ${nextCoords.longitude.toFixed(6)}`);
      } catch (err) {
        console.error('[MarkAttendance] location error:', err);
        setLocationText('Could not determine location. Check location permissions.');
      }
    })();
  }, []);

  const refreshOpenSession = useCallback(async () => {
    if (!user) {
      return;
    }
    setCheckingSession(true);
    try {
      setOpenSession(await getOpenMusterSession(user.userid));
    } finally {
      setCheckingSession(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      refreshOpenSession();
    }, [refreshOpenSession]),
  );

  const handleTakeSelfie = async () => {
    const hasPermission = await ensureCameraPermission();
    if (!hasPermission) {
      Alert.alert('Camera permission required', 'Please allow camera access to take a selfie.');
      return;
    }
    launchCamera({ mediaType: 'photo', includeBase64: true, quality: 0.6, cameraType: 'front' }, response => {
      const base64 = response.assets?.[0]?.base64;
      if (base64) {
        setSelfieBase64(base64);
      } else if (response.errorCode === 'camera_unavailable') {
        Alert.alert('Camera unavailable', 'No camera was found on this device. This is expected on the iOS Simulator — try a real device.');
      } else if (response.errorMessage) {
        Alert.alert('Camera error', response.errorMessage);
      }
    });
  };

  const submitMuster = async (musterpresensetype: MusterPresenseType, guid: string, overrideDate?: string) => {
    if (!user) {
      return;
    }
    if (!coords) {
      Alert.alert('Location required', 'Please wait for your location to be detected.');
      return;
    }
    if (!selfieBase64) {
      Alert.alert('Selfie required', 'Please take a selfie before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      await insertMuster({
        musterdate: buildMusterDateTime(overrideDate),
        userid: user.userid,
        guid,
        musterpresensetype,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        altitude: coords.altitude,
        speed: coords.speed,
        heading: coords.heading,
        selfieimage: selfieBase64,
        remark,
      });

      syncUnsyncedMusters().catch(() => undefined);

      const label = musterpresensetype === MUSTER_CHECK_IN ? 'Check-In' : 'Check-Out';
      Alert.alert(`${label} recorded`, 'Your attendance has been recorded and will sync shortly.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const insertMissedCheckinMarker = async (guid: string) => {
    if (!user) {
      return;
    }
    await insertMuster({
      musterdate: buildMusterDateTime(),
      userid: user.userid,
      guid,
      musterpresensetype: MUSTER_MISSED_CHECKIN,
      latitude: 0,
      longitude: 0,
      accuracy: 0,
      altitude: 0,
      speed: 0,
      heading: 0,
      selfieimage: '',
      remark: 'Auto-marked: check-in entry not found',
    });
  };

  const showMissedCheckoutDialog = useCallback((session: OpenMusterSession) => {
    Alert.alert(
      'Missed checkout detected',
      `You checked in on ${session.checkInDate} but never checked out. Was this a missed checkout, or are you still finishing that shift (e.g. night shift)?`,
      [
        {
          text: 'Checkout Now (Night Shift)',
          onPress: () => submitMuster(MUSTER_CHECK_OUT, session.guid),
        },
        {
          text: 'Missed Checkout',
          onPress: () => submitMuster(MUSTER_MISSED_CHECKOUT, session.guid, session.checkInDate),
        },
      ],
      { cancelable: false },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, selfieBase64, remark]);

  useEffect(() => {
    if (!checkingSession && openSession && !isToday(openSession.checkInDate) && !isSubmitting) {
      showMissedCheckoutDialog(openSession);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSession, checkingSession]);

  const handleCheckIn = () => {
    if (openSession) {
      return;
    }
    submitMuster(MUSTER_CHECK_IN, generateUuidV4());
  };

  const handleCheckOut = () => {
    if (openSession) {
      if (isToday(openSession.checkInDate)) {
        submitMuster(MUSTER_CHECK_OUT, openSession.guid);
      } else {
        showMissedCheckoutDialog(openSession);
      }
      return;
    }

    Alert.alert(
      'No check-in found today',
      "You haven't checked in today. Continue with check-out anyway? This will be recorded as a missed check-in.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            const guid = generateUuidV4();
            await insertMissedCheckinMarker(guid);
            submitMuster(MUSTER_CHECK_OUT, guid);
          },
        },
      ],
    );
  };

  const sessionStatusText = checkingSession
    ? 'Checking today’s status...'
    : openSession
    ? isToday(openSession.checkInDate)
      ? 'Checked in — not yet checked out.'
      : `Open session since ${openSession.checkInDate} — checkout required.`
    : 'No active session. Ready to check in.';

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.mapContainer}>
            {coords ? (
              <>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  mapType={mapType}
                  initialRegion={regionRef.current}
                  onRegionChangeComplete={region => {
                    regionRef.current = region;
                  }}
                >
                  <Marker coordinate={coords} title="You are here" />
                  {branches.map(branch => (
                    <Circle
                      key={branch.idbranch}
                      center={{
                        latitude: Number(branch.latitude),
                        longitude: Number(branch.longitude),
                      }}
                      radius={BRANCH_RADIUS_METERS}
                      strokeColor="#DC2626"
                      fillColor="rgba(220,38,38,0.08)"
                    />
                  ))}
                </MapView>
                <MapZoomControls onZoomIn={() => handleZoom(0.5)} onZoomOut={() => handleZoom(2)} />
                <MapTypeToggle
                  mapType={mapType}
                  onToggle={() => setMapType(t => (t === 'standard' ? 'hybrid' : 'standard'))}
                />
              </>
            ) : (
              <View style={[styles.map, styles.mapLoading]}>
                <ActivityIndicator color={palette.primary} />
              </View>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.timeText, { color: theme.textPrimary }]}>
              {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={[styles.dateText, { color: theme.textSecondary }]}>
              {now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <Text style={[styles.locationText, { color: theme.textSecondary }]}>{locationText}</Text>
          <Text style={[styles.sessionStatusText, { color: palette.primary }]}>{sessionStatusText}</Text>

          <View style={styles.selfieRow}>
            {selfieBase64 ? (
              <Image source={{ uri: `data:image/jpeg;base64,${selfieBase64}` }} style={styles.selfieImage} />
            ) : (
              <View style={[styles.selfieImage, styles.selfiePlaceholder, { backgroundColor: theme.inputBackground }]}>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>No Selfie</Text>
              </View>
            )}
            <TouchableOpacity style={styles.selfieButton} onPress={handleTakeSelfie}>
              <Text style={styles.selfieButtonText}>Take Selfie</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: theme.textSecondary }]}>Remark (optional)</Text>
          <TextInput
            style={[
              styles.remarkInput,
              { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary },
            ]}
            value={remark}
            onChangeText={setRemark}
            placeholder="Add a note"
            placeholderTextColor={theme.textSecondary}
            multiline
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.checkInButton,
                (!!openSession || isSubmitting || checkingSession) && styles.buttonDisabled,
              ]}
              onPress={handleCheckIn}
              disabled={!!openSession || isSubmitting || checkingSession}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color={palette.onPrimary} />
              ) : (
                <Text style={styles.checkInButtonText}>Check In</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.checkOutButton,
                { borderColor: palette.primary },
                (isSubmitting || checkingSession) && styles.buttonDisabled,
              ]}
              onPress={handleCheckOut}
              disabled={isSubmitting || checkingSession}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color={palette.primary} />
              ) : (
                <Text style={[styles.checkOutButtonText, { color: palette.primary }]}>Check Out</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { padding: 16 },
  mapContainer: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  map: { flex: 1 },
  mapLoading: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5E7EB' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timeText: { fontSize: 20, fontWeight: '700' },
  dateText: { fontSize: 14, fontWeight: '500' },
  locationText: { fontSize: 13, marginBottom: 6 },
  sessionStatusText: { fontSize: 13, fontWeight: '700', marginBottom: 16 },
  selfieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  selfieImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginRight: 16,
  },
  selfiePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfieButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  selfieButtonText: { color: palette.onPrimary, fontWeight: '700', fontSize: 13 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  remarkInput: {
    minHeight: 70,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingTop: 10,
    fontSize: 14,
    marginBottom: 20,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInButton: {
    backgroundColor: palette.primary,
  },
  checkOutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  buttonDisabled: { opacity: 0.5 },
  checkInButtonText: { color: palette.onPrimary, fontSize: 15, fontWeight: '700' },
  checkOutButtonText: { fontSize: 15, fontWeight: '700' },
});

export default MarkAttendanceScreen;
