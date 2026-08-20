import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getTripReport } from '../services/tripApi';
import { getStoredCompanyCode } from '../services/storage';
import { getAllTrips, insertTripFromApi, tripExists, type TripRow } from '../db/tripsRepo';
import { getLocationsForTrip, insertTripLocationFromApi } from '../db/tripLocationsRepo';
import { smoothPath } from '../utils/smoothPath';
import MapZoomControls from '../components/MapZoomControls';

const MIN_DELTA = 0.0008;
const MAX_DELTA = 40;

const palette = {
  primary: '#4F46E5',
  onPrimary: '#FFFFFF',
  light: {
    background: '#F3F4F8',
    card: '#FFFFFF',
    border: '#E5E7EB',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
  },
  dark: {
    background: '#0B1120',
    card: '#151B2C',
    border: '#232B3D',
    textPrimary: '#F3F4F6',
    textSecondary: '#9CA3AF',
  },
};

type LatLng = { latitude: number; longitude: number };

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function filterPoints(points: LatLng[]): LatLng[] {
  const result: LatLng[] = [];
  for (const point of points) {
    const prev = result[result.length - 1];
    if (!prev) {
      result.push(point);
      continue;
    }
    const distance = haversineMeters(prev, point);
    if (distance < 5 || distance > 300) {
      continue;
    }
    result.push(point);
  }
  return result;
}

function formatDuration(startIso?: string, endIso?: string): string {
  if (!startIso || !endIso) {
    return 'Not Completed';
  }
  const start = new Date(startIso.replace(' ', 'T'));
  const end = new Date(endIso.replace(' ', 'T'));
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (Number.isNaN(minutes) || minutes < 0) {
    return 'Not Completed';
  }
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hrs > 0 ? `${hrs}hr ${mins}min` : `${mins}min`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function ShowMyTripScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? palette.dark : palette.light;
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>({ latitude: 20.5937, longitude: 78.9629, latitudeDelta: 10, longitudeDelta: 10 });

  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<TripRow | null>(null);
  const [points, setPoints] = useState<LatLng[]>([]);

  const loadTrips = useCallback(async () => {
    if (!user) {
      return;
    }
    setLoading(true);
    const now = new Date();
    const fromDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const toDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(lastDay)}`;
    const companyCode = (await getStoredCompanyCode()) ?? '';

    const result = await getTripReport(user.userid, fromDate, toDate, companyCode);
    if (result.success) {
      for (const trip of result.trips) {
        if (!(await tripExists(trip.tripguid))) {
          await insertTripFromApi(
            trip.tripguid,
            trip.description ?? trip.tripguid,
            trip.tripStart ?? '',
            trip.tripEnd ?? null,
            user.userid,
          );
          for (const point of trip.points) {
            await insertTripLocationFromApi(
              trip.tripguid,
              point.latitude,
              point.longitude,
              point.accuracy ?? '0',
              point.altitude ?? '0',
              point.speed ?? '0',
              point.heading ?? '0',
              point.trackedOn ?? '',
              user.userid,
            );
          }
        }
      }
    }

    setTrips(await getAllTrips());
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [loadTrips]),
  );

  const handleSelectTrip = async (trip: TripRow) => {
    setPickerVisible(false);
    setSelectedTrip(trip);
    const rows = await getLocationsForTrip(trip.tripguid);
    const rawPoints = rows.map(r => ({ latitude: Number(r.latitude), longitude: Number(r.longitude) }));
    const filtered = filterPoints(rawPoints);
    setPoints(filtered);
    if (filtered.length > 0) {
      requestAnimationFrame(() => {
        mapRef.current?.fitToCoordinates(filtered, {
          edgePadding: { top: 60, bottom: 60, left: 60, right: 60 },
          animated: true,
        });
      });
    }
  };

  const smoothedPoints = useMemo(() => smoothPath(points), [points]);

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
      <View style={styles.pickerRow}>
        <TouchableOpacity
          style={[styles.pickerButton, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => setPickerVisible(true)}
        >
          <Text style={{ color: theme.textPrimary }} numberOfLines={1}>
            {selectedTrip ? selectedTrip.description : 'Select a trip'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.showButton}
          onPress={() => selectedTrip && handleSelectTrip(selectedTrip)}
          disabled={!selectedTrip}
        >
          <Text style={styles.showButtonText}>Show Trip</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={palette.primary} />
      ) : (
        <>
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={regionRef.current}
              onRegionChangeComplete={region => {
                regionRef.current = region;
              }}
            >
              {smoothedPoints.length > 1 && (
                <Polyline coordinates={smoothedPoints} strokeColor={palette.primary} strokeWidth={4} />
              )}
              {points.length > 0 && <Marker coordinate={points[0]} title="Start" pinColor="green" />}
              {points.length > 1 && (
                <Marker coordinate={points[points.length - 1]} title="End" pinColor="red" />
              )}
            </MapView>
            <MapZoomControls onZoomIn={() => handleZoom(0.5)} onZoomOut={() => handleZoom(2)} />
          </View>

          {selectedTrip && (
            <View style={[styles.detailsCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.detailsHeader, { color: theme.textSecondary }]}>Trip Details</Text>
              <Text style={[styles.detailsValue, { color: theme.textPrimary }]}>
                {selectedTrip.description}
              </Text>
              <Text style={[styles.detailsSub, { color: theme.textSecondary }]}>
                {selectedTrip.start_time}
              </Text>
              <Text style={[styles.detailsDuration, { color: theme.textPrimary }]}>
                {formatDuration(selectedTrip.start_time, selectedTrip.end_time ?? undefined)}
              </Text>
              {selectedTrip.remark ? (
                <Text style={[styles.detailsSub, { color: theme.textSecondary }]}>
                  Remark: {selectedTrip.remark}
                </Text>
              ) : null}
            </View>
          )}
        </>
      )}

      <Modal visible={pickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Select a Trip</Text>
            <FlatList
              data={trips}
              keyExtractor={item => item.tripguid}
              style={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => handleSelectTrip(item)}>
                  <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>{item.description}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                    {item.start_time} · {formatDuration(item.start_time, item.end_time ?? undefined)}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={{ color: theme.textSecondary, textAlign: 'center', padding: 20 }}>
                  No trips found.
                </Text>
              }
            />
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setPickerVisible(false)}>
              <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pickerRow: { flexDirection: 'row', padding: 16, gap: 12 },
  pickerButton: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  showButton: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showButtonText: { color: palette.onPrimary, fontWeight: '700', fontSize: 13 },
  loader: { marginTop: 40 },
  mapContainer: { height: 280, marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  map: { flex: 1 },
  detailsCard: { margin: 16, borderRadius: 16, padding: 16 },
  detailsHeader: { fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  detailsValue: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  detailsSub: { fontSize: 13, marginBottom: 4 },
  detailsDuration: { fontSize: 22, fontWeight: '800', marginVertical: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  modalList: { marginBottom: 12 },
  modalItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.2)' },
  modalCloseButton: { alignSelf: 'center', paddingVertical: 8 },
});

export default ShowMyTripScreen;
