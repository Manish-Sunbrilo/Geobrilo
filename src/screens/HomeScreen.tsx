import React, { useCallback, useRef, useState } from 'react';
import {
  DimensionValue,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { getMusterReport } from '../services/attendanceApi';
import { getLocalMusterStatusForToday } from '../db/musterRepo';
import { formatIstDate, parseIstDateTime } from '../utils/datetime';
import type { AppStackParamList } from '../navigation/types';

const palette = {
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primaryLight: '#818CF8',
  onPrimary: '#FFFFFF',
  present: '#16A34A',
  completed: '#0EA5A4',
  notMarked: '#9CA3AF',
  danger: '#DC2626',
  light: {
    background: '#F3F4F8',
    card: '#FFFFFF',
    border: '#E5E7EB',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    chipBackground: 'rgba(255,255,255,0.2)',
    chipText: '#FFFFFF',
  },
  dark: {
    background: '#0B1120',
    card: '#151B2C',
    border: '#232B3D',
    textPrimary: '#F3F4F6',
    textSecondary: '#9CA3AF',
    chipBackground: 'rgba(255,255,255,0.12)',
    chipText: '#F3F4F6',
  },
};

type Status = 'present' | 'completed' | 'not_marked';

function parseTimeToDate(value: string, reference: Date): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const hhmmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hhmmMatch) {
    const result = new Date(reference);
    result.setHours(Number(hhmmMatch[1]), Number(hhmmMatch[2]), Number(hhmmMatch[3] ?? '0'), 0);
    return result;
  }
  const parsed = new Date(trimmed.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDuration(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

type QuickAction = {
  key: keyof AppStackParamList;
  label: string;
  icon: string;
  accent?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
  { key: 'MarkAttendance', label: 'Mark Attendance', icon: '📍', accent: true },
  { key: 'TrackMe', label: 'Track Me', icon: '🧭' },
  { key: 'MonthlyAttendance', label: 'Monthly Attendance', icon: '📅' },
  { key: 'ShowMyTrip', label: 'Show My Trip', icon: '🗺️' },
  // ApplyLeave / SalarySlip screens still exist and are routed, just hidden
  // from Quick Actions for now.
  { key: 'Profile', label: 'Profile', icon: '👤' },
];

function HomeScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? palette.dark : palette.light;
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const numColumns = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const contentMaxWidth = isTablet ? 720 : undefined;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [status, setStatus] = useState<Status>('not_marked');
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTicking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * `baseSeconds` is however much was already worked in earlier, completed
   * sessions today -- checking in again after a checkout resumes ticking
   * from that running total instead of restarting at zero.
   */
  const applyStatus = useCallback(
    (next: Status, options?: { baseSeconds?: number; openCheckIn?: Date; totalSeconds?: number }) => {
      stopTicking();
      setStatus(next);
      if (next === 'completed') {
        setElapsedSeconds(options?.totalSeconds ?? 0);
      } else if (next === 'present' && options?.openCheckIn) {
        const base = options.baseSeconds ?? 0;
        const openCheckInMs = options.openCheckIn.getTime();
        const tick = () => setElapsedSeconds(base + (Date.now() - openCheckInMs) / 1000);
        tick();
        intervalRef.current = setInterval(tick, 1000);
      } else {
        setElapsedSeconds(0);
      }
    },
    [stopTicking],
  );

  const loadTodayAttendance = useCallback(async () => {
    if (!user) {
      return;
    }
    const today = formatIstDate();

    // Local SQLite is checked first: it reflects a check-in the instant it's
    // recorded, unlike the server report, which lags behind the fire-and-forget
    // sync push and the server's own queue-processing delay.
    const local = await getLocalMusterStatusForToday(user.userid, today);
    if (local.status === 'present') {
      applyStatus('present', { baseSeconds: local.baseSeconds, openCheckIn: parseIstDateTime(local.openCheckInAt) });
      return;
    }
    if (local.status === 'completed') {
      applyStatus('completed', { totalSeconds: local.totalSeconds });
      return;
    }

    const result = await getMusterReport(user.userid, today, today);
    if (!result.success || result.records.length === 0) {
      applyStatus('not_marked');
      return;
    }

    const record = result.records[0];
    const now = new Date();
    const checkInDate = record.checkIn ? parseTimeToDate(record.checkIn, now) : null;
    const checkOutDate = record.checkOut ? parseTimeToDate(record.checkOut, now) : null;

    if (checkInDate && checkOutDate) {
      applyStatus('completed', { totalSeconds: (checkOutDate.getTime() - checkInDate.getTime()) / 1000 });
    } else if (checkInDate) {
      applyStatus('present', { openCheckIn: checkInDate });
    } else {
      applyStatus('not_marked');
    }
  }, [user, applyStatus]);

  useFocusEffect(
    useCallback(() => {
      loadTodayAttendance();
      return () => stopTicking();
    }, [loadTodayAttendance, stopTicking]),
  );

  const statusLabel: Record<Status, string> = {
    present: 'Status: Present',
    completed: 'Status: Completed',
    not_marked: 'Status: Not Marked',
  };
  const statusColor: Record<Status, string> = {
    present: palette.present,
    completed: palette.completed,
    not_marked: palette.notMarked,
  };

  const displayName = user?.firstname ? `${user.firstname} ${user.lastname ?? ''}`.trim() : user?.userid ?? '';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'U';

  const tileWidthPercent = `${100 / numColumns - 3}%` as DimensionValue;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>
        <View style={[styles.centerColumn, contentMaxWidth ? { maxWidth: contentMaxWidth } : null]}>
          <View style={styles.hero}>
            <View style={[styles.decorCircle, styles.decorCircleLarge]} />
            <View style={[styles.decorCircle, styles.decorCircleSmall]} />

            <View style={styles.heroTopRow}>
              <View style={styles.heroIdentity}>
                <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
                <View style={styles.heroTextGroup}>
                  <Text style={styles.heroGreeting}>Welcome back</Text>
                  <Text style={styles.heroName} numberOfLines={1}>
                    {displayName}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.avatarCircle}
                onPress={() => setProfileMenuVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.avatarText}>{initials}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.chip, { backgroundColor: theme.chipBackground }]}>
              <Text style={[styles.chipText, { color: theme.chipText }]}>EMPLOYEE DASHBOARD</Text>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              TODAY'S WORKING HOURS
            </Text>
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>
              {formatDuration(elapsedSeconds)}
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor[status] }]} />
              <Text style={[styles.statusText, { color: theme.textSecondary }]}>
                {statusLabel[status]}
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Quick Actions</Text>

          <View style={styles.grid}>
            {QUICK_ACTIONS.map(action => (
              <TouchableOpacity
                key={action.key}
                style={[
                  styles.gridButton,
                  { width: tileWidthPercent },
                  action.accent
                    ? styles.gridButtonAccent
                    : { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 },
                ]}
                onPress={() => navigation.navigate(action.key as never)}
                activeOpacity={0.85}
              >
                <Text style={styles.gridButtonIcon}>{action.icon}</Text>
                <Text
                  style={[
                    styles.gridButtonText,
                    { color: action.accent ? palette.onPrimary : theme.textPrimary },
                  ]}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal visible={profileMenuVisible} transparent animationType="fade" onRequestClose={() => setProfileMenuVisible(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setProfileMenuVisible(false)}>
          <View style={[styles.profileMenu, { top: insets.top + 62, backgroundColor: theme.card }]}>
            <TouchableOpacity
              style={styles.profileMenuItem}
              onPress={() => {
                setProfileMenuVisible(false);
                logout();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.profileMenuItemText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 32,
  },
  centerColumn: {
    width: '100%',
  },
  hero: {
    backgroundColor: palette.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: palette.primaryLight,
    opacity: 0.3,
  },
  decorCircleLarge: {
    width: 180,
    height: 180,
    top: -70,
    right: -50,
  },
  decorCircleSmall: {
    width: 120,
    height: 120,
    bottom: -60,
    left: -30,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 12,
  },
  heroTextGroup: {
    flex: 1,
  },
  heroGreeting: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.onPrimary,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: {
    color: palette.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statCard: {
    marginHorizontal: 20,
    marginTop: -28,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    marginHorizontal: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  gridButton: {
    aspectRatio: 1.9,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  gridButtonAccent: {
    backgroundColor: palette.primary,
  },
  gridButtonIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  gridButtonText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  menuBackdrop: {
    flex: 1,
  },
  profileMenu: {
    position: 'absolute',
    right: 20,
    borderRadius: 14,
    paddingVertical: 6,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8,
  },
  profileMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  profileMenuItemText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.danger,
  },
});

export default HomeScreen;
