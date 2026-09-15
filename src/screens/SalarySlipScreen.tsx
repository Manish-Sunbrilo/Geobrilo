import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OptionPicker from '../components/OptionPicker';

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

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function SalarySlipScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? palette.dark : palette.light;
  const [month, setMonth] = useState('');

  const handleDownload = () => {
    if (!month) {
      Alert.alert('Select a month', 'Please select a month to download the salary slip.');
      return;
    }
    // No backend endpoint exists for salary slips yet -- this mirrors the
    // reference app, which also stops at this confirmation with no real
    // download behind it.
    Alert.alert('Downloading', `Downloading salary slip for ${month}...`);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['bottom']}>
      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Salary Slip</Text>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Month</Text>
          <OptionPicker
            label="Select month"
            value={month}
            options={MONTHS}
            onChange={setMonth}
            theme={theme}
            primaryColor={palette.primary}
          />

          <TouchableOpacity style={styles.downloadButton} onPress={handleDownload} activeOpacity={0.85}>
            <Text style={styles.downloadButtonText}>Download</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16 },
  card: { borderRadius: 16, padding: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  downloadButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  downloadButtonText: { color: palette.onPrimary, fontSize: 15, fontWeight: '700' },
});

export default SalarySlipScreen;
