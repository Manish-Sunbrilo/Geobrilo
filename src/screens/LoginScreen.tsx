import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { signIn } from '../services/authApi';
import { getRememberedUserId, setRememberedUserId } from '../services/storage';
import { useAuth } from '../context/AuthContext';

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

type FieldErrors = {
  userId?: string;
  password?: string;
};

function LoginScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? palette.dark : palette.light;
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLandscape = width > height;
  const useSplitLayout = isTablet || (isLandscape && height < 500);
  const navigation = useNavigation();
  const { setUser, provisioned } = useAuth();

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [focusedField, setFocusedField] = useState<'userId' | 'password' | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    getRememberedUserId().then(remembered => {
      if (remembered) {
        setUserId(remembered);
        setRememberMe(true);
      }
    });
  }, []);

  const validate = (): boolean => {
    const nextErrors: FieldErrors = {};

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
      const result = await signIn(userId, password);
      if (result.success) {
        await setRememberedUserId(rememberMe ? result.user.userid : null);
        await setUser(result.user);
      } else {
        Alert.alert('Login failed', result.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = (field: 'userId' | 'password', hasError?: string) => [
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

  const brandPanel = (
    <View
      style={[
        styles.brandPanel,
        useSplitLayout ? styles.brandPanelSplit : { height: Math.max(220, height * 0.32) },
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
      <Text style={styles.brandSubtitle}>Field attendance, made simple</Text>
    </View>
  );

  const formCard = (
    <View
      style={[
        styles.card,
        {
          maxWidth: useSplitLayout ? 440 : 480,
          backgroundColor: theme.card,
        },
        useSplitLayout ? styles.cardSplit : styles.cardStacked,
      ]}
    >
      <Text style={[styles.title, { color: theme.textPrimary }]}>
        Welcome back
      </Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Sign in with your registered User ID
      </Text>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          User ID
        </Text>
        <TextInput
          style={inputStyle('userId', errors.userId)}
          placeholder="Enter your User ID"
          placeholderTextColor={theme.placeholder}
          value={userId}
          onChangeText={text => {
            setUserId(text);
            if (errors.userId) {
              setErrors(prev => ({ ...prev, userId: undefined }));
            }
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
        {errors.userId ? (
          <Text style={styles.errorText}>{errors.userId}</Text>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          Password
        </Text>
        <View style={styles.passwordRow}>
          <TextInput
            ref={passwordInputRef}
            style={[
              inputStyle('password', errors.password),
              styles.passwordInput,
            ]}
            placeholder="Enter your password"
            placeholderTextColor={theme.placeholder}
            value={password}
            onChangeText={text => {
              setPassword(text);
              if (errors.password) {
                setErrors(prev => ({ ...prev, password: undefined }));
              }
            }}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            editable={!isSubmitting}
          />
          <TouchableOpacity
            style={styles.showHideButton}
            onPress={() => setShowPassword(prev => !prev)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={[styles.showHideText, { color: palette.primary }]}
            >
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        </View>
        {errors.password ? (
          <Text style={styles.errorText}>{errors.password}</Text>
        ) : null}
      </View>

      <View style={styles.optionsRow}>
        <Pressable
          style={styles.rememberMeRow}
          onPress={() => setRememberMe(prev => !prev)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: rememberMe
                  ? palette.primary
                  : theme.inputBorder,
                backgroundColor: rememberMe
                  ? palette.primary
                  : 'transparent',
              },
            ]}
          >
            {rememberMe ? (
              <Text style={styles.checkboxMark}>✓</Text>
            ) : null}
          </View>
          <Text
            style={[styles.rememberMeText, { color: theme.textSecondary }]}
          >
            Remember me
          </Text>
        </Pressable>

        <TouchableOpacity
          onPress={() =>
            Alert.alert(
              'Forgot password',
              "Password recovery isn't available yet. Please contact support.",
            )
          }
        >
          <Text style={styles.forgotPasswordText}>Forgot password?</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.loginButton, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        activeOpacity={0.85}
      >
        {isSubmitting ? (
          <ActivityIndicator color={palette.onPrimary} />
        ) : (
          <Text style={styles.loginButtonText}>Log In</Text>
        )}
      </TouchableOpacity>

      {!provisioned && (
        <>
          <View style={styles.dividerRow}>
            <View
              style={[styles.dividerLine, { backgroundColor: theme.border }]}
            />
            <Text style={[styles.dividerText, { color: theme.textSecondary }]}>
              OR
            </Text>
            <View
              style={[styles.dividerLine, { backgroundColor: theme.border }]}
            />
          </View>

          <View style={styles.signUpRow}>
            <Text style={{ color: theme.textSecondary }}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp' as never)}>
              <Text style={styles.signUpText}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
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
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 14,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.onPrimary,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 14,
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
    minHeight: 420,
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
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxMark: {
    color: palette.onPrimary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  rememberMeText: {
    fontSize: 13,
  },
  forgotPasswordText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  loginButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: palette.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signUpText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default LoginScreen;
