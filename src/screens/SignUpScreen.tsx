import React, { useRef, useState } from 'react';
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
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { signUp } from '../services/authApi';
import { useAuth } from '../context/AuthContext';
import { replaceBranches } from '../db/branchRepo';
import { DEFAULT_DEVICE_CONFIG } from '../config/apiConfig';

const palette = {
  primary: '#4F46E5',
  primaryDark: '#3730A3',
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
    placeholder: '#9CA3AF',
  },
  dark: {
    background: '#0B1120',
    card: '#151B2C',
    border: '#232B3D',
    inputBackground: '#1B2436',
    inputBorder: '#2A3348',
    textPrimary: '#F3F4F6',
    textSecondary: '#9CA3AF',
    placeholder: '#6B7280',
  },
};

type FieldKey = 'baseUrl' | 'clientCode' | 'environment' | 'userId' | 'password';
type FieldErrors = Partial<Record<FieldKey, string>>;

function isValidBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.host.length > 0;
  } catch {
    return false;
  }
}

function SignUpScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? palette.dark : palette.light;
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLandscape = width > height;
  const useSplitLayout = isTablet || (isLandscape && height < 500);
  const navigation = useNavigation();
  const { markSignedUp } = useAuth();

  const [baseUrl, setBaseUrl] = useState(DEFAULT_DEVICE_CONFIG.baseUrl);
  const [clientCode, setClientCode] = useState(DEFAULT_DEVICE_CONFIG.clientCode);
  const [environment, setEnvironment] = useState(DEFAULT_DEVICE_CONFIG.environment);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [focusedField, setFocusedField] = useState<FieldKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clientCodeInputRef = useRef<TextInput>(null);
  const environmentInputRef = useRef<TextInput>(null);
  const userIdInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const validate = (): boolean => {
    const nextErrors: FieldErrors = {};

    if (!baseUrl.trim()) {
      nextErrors.baseUrl = 'Base URL is required';
    } else if (!isValidBaseUrl(baseUrl.trim())) {
      nextErrors.baseUrl = 'Base URL looks invalid. Please check it and try again.';
    }

    if (!clientCode.trim()) {
      nextErrors.clientCode = 'Client Code is required';
    }

    if (!environment.trim()) {
      nextErrors.environment = 'Environment is required';
    }

    if (!userId.trim()) {
      nextErrors.userId = 'User ID is required';
    }

    if (!password) {
      nextErrors.password = 'Password is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signUp({
        baseUrl: baseUrl.trim(),
        clientCode: clientCode.trim(),
        environment: environment.trim(),
        userId,
        password,
      });
      if (result.success) {
        const validBranches = result.branches.filter(
          (b): b is { idbranch: string; latitude: string; longitude: string } =>
            Boolean(b.idbranch && b.latitude && b.longitude),
        );
        await replaceBranches(validBranches);
        markSignedUp();
        Alert.alert('Signup successful', 'You can now log in with your new account.', [
          { text: 'OK', onPress: () => navigation.navigate('Login' as never) },
        ]);
      } else {
        Alert.alert('Signup failed', result.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = (field: FieldKey, hasError?: string) => [
    styles.input,
    {
      backgroundColor: theme.inputBackground,
      borderColor: hasError
        ? palette.error
        : focusedField === field
        ? palette.primary
        : theme.inputBorder,
      color: theme.textPrimary,
    },
  ];

  const clearFieldError = (field: FieldKey) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const brandPanel = (
    <View
      style={[
        styles.brandPanel,
        useSplitLayout ? styles.brandPanelSplit : { height: Math.max(200, height * 0.26) },
      ]}
    >
      <View style={[styles.decorCircle, styles.decorCircleLarge]} />
      <View style={[styles.decorCircle, styles.decorCircleSmall]} />
      <Image
        source={require('../assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Geobrilo logo"
      />
      <Text style={styles.brandTitle}>Geobrilo</Text>
      <Text style={styles.brandSubtitle}>Set up your workspace</Text>
    </View>
  );

  const formCard = (
    <View
      style={[
        styles.card,
        { maxWidth: useSplitLayout ? 460 : 480, backgroundColor: theme.card },
        useSplitLayout ? styles.cardSplit : styles.cardStacked,
      ]}
    >
      <Text style={[styles.title, { color: theme.textPrimary }]}>
        Create your account
      </Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Sign up to get started with Geobrilo
      </Text>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Base URL</Text>
        <TextInput
          style={inputStyle('baseUrl', errors.baseUrl)}
          placeholder="https://your-server.com"
          placeholderTextColor={theme.placeholder}
          value={baseUrl}
          onChangeText={text => {
            setBaseUrl(text);
            clearFieldError('baseUrl');
          }}
          onFocus={() => setFocusedField('baseUrl')}
          onBlur={() => setFocusedField(null)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="next"
          onSubmitEditing={() => clientCodeInputRef.current?.focus()}
          editable={!isSubmitting}
        />
        {errors.baseUrl ? <Text style={styles.errorText}>{errors.baseUrl}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Client Code</Text>
        <TextInput
          ref={clientCodeInputRef}
          style={inputStyle('clientCode', errors.clientCode)}
          placeholder="Client Code"
          placeholderTextColor={theme.placeholder}
          value={clientCode}
          onChangeText={text => {
            setClientCode(text);
            clearFieldError('clientCode');
          }}
          onFocus={() => setFocusedField('clientCode')}
          onBlur={() => setFocusedField(null)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => environmentInputRef.current?.focus()}
          editable={!isSubmitting}
        />
        {errors.clientCode ? (
          <Text style={styles.errorText}>{errors.clientCode}</Text>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Environment</Text>
        <TextInput
          ref={environmentInputRef}
          style={inputStyle('environment', errors.environment)}
          placeholder="Environment"
          placeholderTextColor={theme.placeholder}
          value={environment}
          onChangeText={text => {
            setEnvironment(text);
            clearFieldError('environment');
          }}
          onFocus={() => setFocusedField('environment')}
          onBlur={() => setFocusedField(null)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => userIdInputRef.current?.focus()}
          editable={!isSubmitting}
        />
        {errors.environment ? (
          <Text style={styles.errorText}>{errors.environment}</Text>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>User ID</Text>
        <TextInput
          ref={userIdInputRef}
          style={inputStyle('userId', errors.userId)}
          placeholder="Choose a User ID"
          placeholderTextColor={theme.placeholder}
          value={userId}
          onChangeText={text => {
            setUserId(text);
            clearFieldError('userId');
          }}
          onFocus={() => setFocusedField('userId')}
          onBlur={() => setFocusedField(null)}
          autoCapitalize="none"
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordInputRef.current?.focus()}
          editable={!isSubmitting}
        />
        {errors.userId ? <Text style={styles.errorText}>{errors.userId}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            ref={passwordInputRef}
            style={[inputStyle('password', errors.password), styles.passwordInput]}
            placeholder="Create a password"
            placeholderTextColor={theme.placeholder}
            value={password}
            onChangeText={text => {
              setPassword(text);
              clearFieldError('password');
            }}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            editable={!isSubmitting}
          />
          <TouchableOpacity
            style={styles.showHideButton}
            onPress={() => setShowPassword(prev => !prev)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.showHideText, { color: palette.primary }]}>
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        </View>
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
      </View>

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        activeOpacity={0.85}
      >
        {isSubmitting ? (
          <ActivityIndicator color={palette.onPrimary} />
        ) : (
          <Text style={styles.submitButtonText}>Sign Up</Text>
        )}
      </TouchableOpacity>

      <View style={styles.loginRow}>
        <Text style={{ color: theme.textSecondary }}>
          Already have an account?{' '}
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login' as never)}>
          <Text style={styles.loginText}>Log in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {useSplitLayout ? (
        <View style={styles.splitContainer}>
          {brandPanel}
          <ScrollView
            style={styles.splitFormArea}
            contentContainerStyle={styles.splitFormContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {formCard}
          </ScrollView>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {brandPanel}
          {formCard}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  splitFormArea: {
    flex: 1,
  },
  splitFormContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 32,
  },
  brandPanel: {
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  brandPanelSplit: {
    flex: 1,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopRightRadius: 36,
    borderBottomEndRadius: 36,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: palette.primaryLight,
    opacity: 0.35,
  },
  decorCircleLarge: {
    width: 220,
    height: 220,
    top: -80,
    right: -60,
  },
  decorCircleSmall: {
    width: 140,
    height: 140,
    bottom: -50,
    left: -40,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.onPrimary,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  card: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  cardStacked: {
    marginTop: -28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  cardSplit: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 26,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  passwordRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 60,
  },
  showHideButton: {
    position: 'absolute',
    right: 14,
  },
  showHideText: {
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: palette.error,
    fontSize: 12,
    marginTop: 6,
  },
  submitButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: palette.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default SignUpScreen;
