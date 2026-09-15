import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getMusterReport } from '../services/attendanceApi';
import { getLocalMusterRangeSummary, type LocalMusterRangeEntry } from '../db/musterRepo';
import { getIstParts, formatIstDate } from '../utils/datetime';
import type { MusterRecord } from '../types/attendance';

const palette = {
  primary: '#4F46E5',
  present: '#DCFCE7',
  presentText: '#166534',
  absent: '#FEE2E2',
  absentText: '#991B1B',
  holidayText: '#4338CA',
  light: {
    background: '#F3F4F8',
    card: '#FFFFFF',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
  },
  dark: {
    background: '#0B1120',
    card: '#151B2C',
    textPrimary: '#F3F4F6',
    textSecondary: '#9CA3AF',
    border: '#232B3D',
  },
};

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizeDateKey(value: string): string {
  const isoMatch = value.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    return isoMatch[0];
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateKey(parsed);
}

function buildMonthGrid(year: number, month: number): Array<Date | null> {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < leadingBlanks; i++) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function formatWorkingHours(minutes?: number): string {
  if (minutes == null || Number.isNaN(minutes)) {
    return '-';
  }
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hrs} hrs ${mins} mins`;
}

function MonthlyAttendanceScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? palette.dark : palette.light;
  const { user } = useAuth();

  const istNow = getIstParts();
  const [year] = useState(istNow.year);
  const [month] = useState(istNow.month);
  const [records, setRecords] = useState<MusterRecord[]>([]);
  const [localOverrides, setLocalOverrides] = useState<Map<string, LocalMusterRangeEntry>>(new Map());
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      return;
    }
    setLoading(true);
    setError(null);
    const fromDate = `${year}-${pad(month + 1)}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const toDate = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
    const [result, localSummary] = await Promise.all([
      getMusterReport(user.userid, fromDate, toDate),
      getLocalMusterRangeSummary(user.userid, fromDate, toDate),
    ]);
    setLoading(false);
    setLocalOverrides(localSummary);
    if (!result.success) {
      setError(result.message);
      return;
    }
    setRecords(result.records);
    setHolidayDates(new Set(result.holidays.map(h => normalizeDateKey(h.date))));
  }, [user, year, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, MusterRecord>();
    for (const record of records) {
      if (record.date) {
        map.set(normalizeDateKey(record.date), record);
      }
    }
    // Local SQLite is more current/accurate than the server report -- it
    // reflects check-ins/outs the instant they're recorded, already in local
    // (IST) time, isn't subject to the server's own report-generation lag,
    // and (unlike a naive last-checkout-minus-first-checkin span) sums every
    // completed session so a lunch break isn't counted as worked time. A
    // missing checkOut here means the day's latest session is still open --
    // that's not backfilled from a stale server value.
    for (const [day, entry] of localOverrides) {
      const existing = map.get(day);
      map.set(day, {
        date: day,
        checkIn: entry.checkIn ? entry.checkIn.slice(11, 16) : existing?.checkIn,
        checkOut: entry.checkOut ? entry.checkOut.slice(11, 16) : undefined,
        minuteDifference: Math.round(entry.totalSeconds / 60),
        remark: existing?.remark,
      });
    }
    return map;
  }, [records, localOverrides]);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const allRecords = useMemo(
    () =>
      Array.from(attendanceByDate.values()).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [attendanceByDate],
  );

  const selectedRecord = selectedDate ? attendanceByDate.get(selectedDate) : undefined;
  const visibleRecords = selectedDate
    ? selectedRecord
      ? [selectedRecord]
      : []
    : allRecords;

  const renderCell = (date: Date | null, index: number) => {
    if (!date) {
      return <View key={index} style={styles.cell} />;
    }
    const key = dateKey(date);
    const hasAttendance = attendanceByDate.has(key);
    const isHoliday = holidayDates.has(key);
    const isSunday = date.getDay() === 0;
    const isPast = key < formatIstDate();
    const isSelected = selectedDate === key;

    let cellStyle = styles.cellDefault;
    let textColor = theme.textPrimary;
    if (hasAttendance) {
      cellStyle = styles.cellPresent;
      textColor = palette.presentText;
    } else if (isHoliday) {
      textColor = palette.holidayText;
    } else if (isPast && !isSunday) {
      cellStyle = styles.cellAbsent;
      textColor = palette.absentText;
    } else if (isSunday) {
      textColor = palette.absentText;
    }

    return (
      <TouchableOpacity
        key={index}
        style={[styles.cell, cellStyle, isSelected && styles.cellSelected]}
        onPress={() => setSelectedDate(isSelected ? null : key)}
      >
        <Text style={[styles.cellText, { color: textColor }]}>{date.getDate()}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.calendarCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.monthLabel, { color: theme.textPrimary }]}>{monthLabel}</Text>
          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((label, i) => (
              <Text key={i} style={[styles.weekdayLabel, { color: theme.textSecondary }]}>
                {label}
              </Text>
            ))}
          </View>
          {Array.from({ length: grid.length / 7 }, (_, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {grid.slice(weekIndex * 7, weekIndex * 7 + 7).map((date, i) => renderCell(date, weekIndex * 7 + i))}
            </View>
          ))}
        </View>

        {loading && <ActivityIndicator style={styles.loader} color={palette.primary} />}
        {error && (
          <Text style={styles.noticeText}>
            {error} Showing what's saved on this device below.
          </Text>
        )}

        {!loading && (
          <View style={[styles.listCard, { backgroundColor: theme.card }]}>
            <View style={styles.listHeaderRow}>
              <Text style={[styles.listHeaderCell, styles.dateCol, { color: theme.textSecondary }]}>
                Date
              </Text>
              <Text style={[styles.listHeaderCell, { color: theme.textSecondary }]}>In</Text>
              <Text style={[styles.listHeaderCell, { color: theme.textSecondary }]}>Out</Text>
              <Text style={[styles.listHeaderCell, styles.hoursCol, { color: theme.textSecondary }]}>
                Hours
              </Text>
            </View>
            {visibleRecords.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No attendance records for this selection.
              </Text>
            ) : (
              visibleRecords.map((record, index) => (
                <View
                  key={`${record.date ?? 'record'}-${index}`}
                  style={[styles.recordRow, { borderColor: theme.border }]}
                >
                  <Text style={[styles.recordCell, styles.dateCol, { color: theme.textPrimary }]}>
                    {record.date ?? '-'}
                  </Text>
                  <Text style={[styles.recordCell, { color: theme.textPrimary }]}>
                    {record.checkIn ?? '-'}
                  </Text>
                  <Text style={[styles.recordCell, { color: theme.textPrimary }]}>
                    {record.checkOut ?? '-'}
                  </Text>
                  <Text style={[styles.recordCell, styles.hoursCol, { color: theme.textPrimary }]}>
                    {formatWorkingHours(record.minuteDifference)}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    padding: 16,
  },
  calendarCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  weekdayLabel: {
    width: 36,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  cell: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellDefault: {},
  cellPresent: {
    backgroundColor: palette.present,
  },
  cellAbsent: {
    backgroundColor: palette.absent,
  },
  cellSelected: {
    borderWidth: 2,
    borderColor: palette.primary,
  },
  cellText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loader: {
    marginVertical: 20,
  },
  noticeText: {
    color: palette.holidayText,
    textAlign: 'center',
    fontSize: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  listCard: {
    borderRadius: 16,
    padding: 16,
  },
  listHeaderRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  listHeaderCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateCol: {
    flex: 1.4,
  },
  hoursCol: {
    flex: 1.4,
  },
  recordRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  recordCell: {
    flex: 1,
    fontSize: 13,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
});

export default MonthlyAttendanceScreen;
