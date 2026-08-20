import React, { useState } from 'react';
import {
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
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../context/AuthContext';
import { ensureCameraPermission } from '../utils/cameraPermission';

const palette = {
  primary: '#4F46E5',
  primaryLight: '#818CF8',
  onPrimary: '#FFFFFF',
  error: '#DC2626',
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

function ProfileScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? palette.dark : palette.light;
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { user } = useAuth();

  const [email, setEmail] = useState(user?.email1 ?? '');
  const [phone, setPhone] = useState(user?.phone1 ?? '');
  const [photoBase64, setPhotoBase64] = useState<string | undefined>(user?.profilephoto);

  if (!user) {
    return null;
  }

  const handlePickPhoto = () => {
    Alert.alert('Update Photo', undefined, [
      {
        text: 'Take Photo',
        onPress: async () => {
          const hasPermission = await ensureCameraPermission();
          if (!hasPermission) {
            Alert.alert('Camera permission required', 'Please allow camera access to take a photo.');
            return;
          }
          launchCamera({ mediaType: 'photo', includeBase64: true, quality: 0.7 }, response => {
            const base64 = response.assets?.[0]?.base64;
            if (base64) {
              setPhotoBase64(base64);
            } else if (response.errorCode === 'camera_unavailable') {
              Alert.alert('Camera unavailable', 'No camera was found on this device. This is expected on the iOS Simulator — try a real device.');
            } else if (response.errorMessage) {
              Alert.alert('Camera error', response.errorMessage);
            }
          });
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: () =>
          launchImageLibrary({ mediaType: 'photo', includeBase64: true, quality: 0.7 }, response => {
            const base64 = response.assets?.[0]?.base64;
            if (base64) {
              setPhotoBase64(base64);
            }
          }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const fullName = [user.firstname, user.lastname].filter(Boolean).join(' ') || user.userid;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.centerColumn, { maxWidth: isTablet ? 560 : 480 }]}>
            <View style={styles.hero}>
              <View style={[styles.decorCircle, styles.decorCircleLarge]} />
              <View style={[styles.decorCircle, styles.decorCircleSmall]} />
            </View>

            <View style={styles.photoContainer}>
              {photoBase64 ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${photoBase64}` }}
                  style={styles.photo}
                />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder, { backgroundColor: theme.inputBackground }]}>
                  <Text style={[styles.photoPlaceholderText, { color: palette.primary }]}>
                    {fullName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <TouchableOpacity style={styles.photoEditButton} onPress={handlePickPhoto}>
                <Text style={styles.photoEditButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.name, { color: theme.textPrimary }]}>{fullName}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{user.userid}</Text>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>User ID</Text>
                <Text style={[styles.readonlyValue, { color: theme.textPrimary }]}>{user.userid}</Text>
              </View>
              {user.eno ? (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Employee Number</Text>
                  <Text style={[styles.readonlyValue, { color: theme.textPrimary }]}>{user.eno}</Text>
                </View>
              ) : null}

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                    },
                  ]}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Phone</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                    },
                  ]}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType={Platform.OS === 'android' ? 'numeric' : 'phone-pad'}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    height: 120,
    backgroundColor: palette.primary,
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
    width: 160,
    height: 160,
    top: -60,
    right: -40,
  },
  decorCircleSmall: {
    width: 100,
    height: 100,
    bottom: -50,
    left: -20,
  },
  photoContainer: {
    alignSelf: 'center',
    marginTop: -60,
    marginBottom: 12,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: palette.onPrimary,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 40,
    fontWeight: '700',
  },
  photoEditButton: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    backgroundColor: palette.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  photoEditButtonText: {
    color: palette.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  readonlyValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 15,
  },
});

export default ProfileScreen;
