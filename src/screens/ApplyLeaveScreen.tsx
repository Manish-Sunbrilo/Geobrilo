import React, { useState } from 'react';
import {
  Alert,
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
import OptionPicker from '../components/OptionPicker';

const palette = {
  primary: '#4F46E5',
  onPrimary: '#FFFFFF',
  taken: '#EF7F1B',
  remaining: '#ECECEC',
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

const LEAVE_TYPES = ['Casual Leave', 'Sick Leave', 'Personal Leave'];

/**
 * Static leave balances -- the reference Android app derived these from an
 * XML response it never actually got (it queries the sign-in endpoint, which
 * has no leave data, and misreads unrelated fields as leave counts). There's
 * no real leave-balance API behind this feature yet, so these are shown as a
 * fixed balance until one exists.
 */
const LEAVE_BALANCES: Record<string, { used: number; total: number }> = {
  'Casual Leave': { used: 3, total: 12 },
  'Sick Leave': { used: 2, total: 10 },
  'Personal Leave': { used: 1, total: 5 },
};

const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;

function todayAsDdMmYyyy(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
}

function BalanceBar({
  label,
  used,
  total,
  theme,
}: {
  label: string;
  used: number;
  total: number;
  theme: typeof palette.light;
}) {
  const percent = total > 0 ? Math.min(1, used / total) : 0;
  return (
    <View style={styles.balanceRow}>
      <View style={styles.balanceHeader}>
        <Text style={[styles.balanceLabel, { color: theme.textPrimary }]}>{label}</Text>
        <Text style={[styles.balanceCount, { color: theme.textSecondary }]}>
          {used} / {total} days used
        </Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: palette.remaining }]}>
        <View style={[styles.barFill, { width: `${percent * 100}%` }]} />
      </View>
    </View>
  );
}

function ApplyLeaveScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? palette.dark : palette.light;

  const [leaveType, setLeaveType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const resetForm = () => {
    setLeaveType('');
    setStartDate('');
    setEndDate('');
    setReason('');
  };

  const handleApply = () => {
    if (!leaveType) {
      Alert.alert('Leave type required', 'Please select a leave type.');
      return;
    }
    if (!DATE_PATTERN.test(startDate)) {
      Alert.alert('Start date required', 'Please enter the start date as DD/MM/YYYY.');
      return;
    }
    if (!DATE_PATTERN.test(endDate)) {
      Alert.alert('End date required', 'Please enter the end date as DD/MM/YYYY.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Reason required', 'Please enter a reason for leave.');
      return;
    }

    Alert.alert(
      'Leave Applied',
      `Type: ${leaveType}\nStart: ${startDate}\nEnd: ${endDate}\nReason: ${reason.trim()}`,
    );
    resetForm();
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Leave Balance</Text>
            {LEAVE_TYPES.map(type => (
              <BalanceBar
                key={type}
                label={type}
                used={LEAVE_BALANCES[type].used}
                total={LEAVE_BALANCES[type].total}
                theme={theme}
              />
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Apply for Leave</Text>

            <Text style={[styles.label, { color: theme.textSecondary }]}>Leave Type</Text>
            <OptionPicker
              label="Select leave type"
              value={leaveType}
              options={LEAVE_TYPES}
              onChange={setLeaveType}
              theme={theme}
              primaryColor={palette.primary}
            />

            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Start Date</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary },
                  ]}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder={todayAsDdMmYyyy()}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.dateField}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>End Date</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary },
                  ]}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder={todayAsDdMmYyyy()}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <Text style={[styles.label, { color: theme.textSecondary }]}>Reason</Text>
            <TextInput
              style={[
                styles.reasonInput,
                { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary },
              ]}
              value={reason}
              onChangeText={setReason}
              placeholder="Reason for leave"
              placeholderTextColor={theme.textSecondary}
              multiline
            />

            <TouchableOpacity style={styles.applyButton} onPress={handleApply} activeOpacity={0.85}>
              <Text style={styles.applyButtonText}>Apply Leave</Text>
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
  card: { borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 14 },
  balanceRow: { marginBottom: 14 },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  balanceLabel: { fontSize: 13, fontWeight: '600' },
  balanceCount: { fontSize: 12 },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: palette.taken, borderRadius: 4 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateField: { flex: 1 },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  reasonInput: {
    minHeight: 80,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingTop: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  applyButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  applyButtonText: { color: palette.onPrimary, fontSize: 15, fontWeight: '700' },
});

export default ApplyLeaveScreen;
