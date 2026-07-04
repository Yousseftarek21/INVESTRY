import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useSignUp, useSSO } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);
}

function PasswordStrengthBar({ password }: { password: string }) {
  const colors = useColors();
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const strengthColor = score <= 1 ? colors.red : score <= 3 ? '#F59E0B' : colors.green;
  const strengthLabel = score <= 1 ? 'Weak' : score <= 3 ? 'Fair' : 'Strong';

  if (!password) return null;
  return (
    <View style={strengthStyles.wrap}>
      <View style={strengthStyles.bars}>
        {[1, 2, 3, 4, 5].map(i => (
          <View
            key={i}
            style={[
              strengthStyles.bar,
              { backgroundColor: i <= score ? strengthColor : colors.muted },
            ]}
          />
        ))}
      </View>
      <Text style={[strengthStyles.label, { color: strengthColor }]}>{strengthLabel}</Text>
    </View>
  );
}

const strengthStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bars: { flex: 1, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', width: 42 },
});

export default function SignUpScreen() {
  useWarmUpBrowser();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [code, setCode] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }).start();
  }, []);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const isFetching = fetchStatus === 'fetching';
  const handleSignUp = async () => {
    if (!agreedToTerms) { setGlobalError('Please accept the Terms & Privacy Policy to continue.'); return; }
    setGlobalError('');
    const { error } = await signUp.password({ emailAddress: email, password });
    if (error) { setGlobalError(error.message ?? 'Sign up failed'); return; }
    await signUp.verifications.sendEmailCode();
  };

  const finalizeNavigate = ({ session, decorateUrl }: { session?: any; decorateUrl: (url: string) => string }) => {
    if (session?.currentTask) return;
    const url = decorateUrl('/');
    if (url.startsWith('http') && typeof window !== 'undefined') {
      window.location.href = url;
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  const handleVerify = async () => {
    setGlobalError('');
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === 'complete') {
      await signUp.finalize({ navigate: finalizeNavigate });
    } else {
      setGlobalError('Invalid code. Please check and try again.');
    }
  };

  const handleGoogle = useCallback(async () => {
    setGlobalError('');
    setGoogleLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId) {
        await setActive!({ session: createdSessionId, navigate: finalizeNavigate });
      }
    } catch (err: any) {
      setGlobalError(err?.message ?? 'Google sign-up failed');
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow]);

  const handleApple = useCallback(async () => {
    setGlobalError('');
    setAppleLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_apple',
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId) {
        await setActive!({ session: createdSessionId, navigate: finalizeNavigate });
      }
    } catch (err: any) {
      setGlobalError(err?.message ?? 'Apple sign-up failed');
    } finally {
      setAppleLoading(false);
    }
  }, [startSSOFlow]);

  // Email verification step
  const needsVerification =
    signUp.status === 'missing_requirements' &&
    signUp.unverifiedFields.includes('email_address') &&
    signUp.missingFields.length === 0;

  if (needsVerification) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.inner, { paddingTop: topPad + 24, paddingBottom: botPad + 24 }]}>
          <Pressable onPress={() => router.replace('/(auth)/sign-up' as any)} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.text} />
          </Pressable>
          <View style={styles.iconWrap}>
            <View style={[styles.iconCircle, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="mail" size={28} color={colors.primary} />
            </View>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Verify your email</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            We sent a 6-digit code to{'\n'}{email}
          </Text>

          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <TextInput
              style={[styles.input, { color: colors.text, textAlign: 'center', fontSize: 22, letterSpacing: 8 }]}
              placeholder="······"
              placeholderTextColor={colors.mutedForeground}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>
          {errors.fields.code && (
            <Text style={[styles.fieldError, { color: colors.red }]}>{errors.fields.code.message}</Text>
          )}

          {globalError ? (
            <View style={[styles.errorBanner, { backgroundColor: colors.red + '15', borderColor: colors.red + '30' }]}>
              <Feather name="alert-circle" size={14} color={colors.red} />
              <Text style={[styles.errorBannerText, { color: colors.red }]}>{globalError}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: (isFetching || code.length < 4) ? 0.5 : 1 }]}
            onPress={handleVerify}
            disabled={isFetching || code.length < 4}
          >
            {isFetching
              ? <ActivityIndicator color={colors.primaryForeground} />
              : <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Verify Email</Text>
            }
          </Pressable>

          <Pressable onPress={() => signUp.verifications.sendEmailCode()}>
            <Text style={[styles.linkText, { color: colors.primary, textAlign: 'center' }]}>Resend code</Text>
          </Pressable>

          {/* Required for Clerk bot protection */}
          <View nativeID="clerk-captcha" />
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: fadeAnim }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.inner, { paddingTop: topPad + 16, paddingBottom: botPad + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.text} />
          </Pressable>

          <View style={styles.headerWrap}>
            <Text style={[styles.appLabel, { color: colors.primary }]}>INVESTRY</Text>
            <Text style={[styles.title, { color: colors.text }]}>Create account</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Start tracking your investments today
            </Text>
          </View>

          {/* Apple (iOS only, satisfies App Store guideline 4.8) */}
          {Platform.OS === 'ios' && (
            <Pressable
              style={[styles.socialBtn, { backgroundColor: colors.text, borderColor: colors.text, marginBottom: 10 }]}
              onPress={handleApple}
              disabled={appleLoading}
            >
              {appleLoading
                ? <ActivityIndicator color={colors.background} />
                : <>
                    <Feather name="command" size={17} color={colors.background} />
                    <Text style={[styles.socialBtnText, { color: colors.background }]}>Continue with Apple</Text>
                  </>
              }
            </Pressable>
          )}

          {/* Google */}
          <Pressable
            style={[styles.socialBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading
              ? <ActivityIndicator color={colors.text} />
              : <>
                  <Text style={styles.googleG}>G</Text>
                  <Text style={[styles.socialBtnText, { color: colors.text }]}>Continue with Google</Text>
                </>
            }
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>



          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email address</Text>
            <View style={[styles.inputWrap, { borderColor: errors.fields.emailAddress ? colors.red : colors.border, backgroundColor: colors.card }]}>
              <Feather name="mail" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
            {errors.fields.emailAddress && (
              <Text style={[styles.fieldError, { color: colors.red }]}>{errors.fields.emailAddress.message}</Text>
            )}
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Password</Text>
            <View style={[styles.inputWrap, { borderColor: errors.fields.password ? colors.red : colors.border, backgroundColor: colors.card }]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Min 8 chars, uppercase, number, symbol"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoComplete="new-password"
              />
              <Pressable onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
                <Feather name={showPass ? 'eye' : 'eye-off'} size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <PasswordStrengthBar password={password} />
            {errors.fields.password && (
              <Text style={[styles.fieldError, { color: colors.red }]}>{errors.fields.password.message}</Text>
            )}
          </View>

          {/* Terms */}
          <Pressable
            style={styles.termsRow}
            onPress={() => setAgreedToTerms(v => !v)}
          >
            <View style={[
              styles.checkbox,
              {
                backgroundColor: agreedToTerms ? colors.primary : 'transparent',
                borderColor: agreedToTerms ? colors.primary : colors.border,
              },
            ]}>
              {agreedToTerms && <Feather name="check" size={12} color={colors.primaryForeground} />}
            </View>
            <Text style={[styles.termsText, { color: colors.mutedForeground }]}>
              I agree to the{' '}
              <Text style={{ color: colors.primary }}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={{ color: colors.primary }}>Privacy Policy</Text>
            </Text>
          </Pressable>

          {globalError ? (
            <View style={[styles.errorBanner, { backgroundColor: colors.red + '15', borderColor: colors.red + '30' }]}>
              <Feather name="alert-circle" size={14} color={colors.red} />
              <Text style={[styles.errorBannerText, { color: colors.red }]}>{globalError}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryBtn, {
              backgroundColor: colors.primary,
              opacity: (!email || !password || isFetching || !agreedToTerms) ? 0.5 : 1,
            }]}
            onPress={handleSignUp}
            disabled={!email || !password || isFetching || !agreedToTerms}
          >
            {isFetching
              ? <ActivityIndicator color={colors.primaryForeground} />
              : <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Create Account</Text>
            }
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Already have an account? </Text>
            <Pressable onPress={() => router.replace('/(auth)/sign-in' as any)}>
              <Text style={[styles.linkText, { color: colors.primary }]}>Sign in</Text>
            </Pressable>
          </View>

          {/* Required for Clerk bot protection */}
          <View nativeID="clerk-captcha" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { paddingHorizontal: 24, gap: 16 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerWrap: { gap: 6, marginBottom: 4 },
  appLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 2.5 },
  title: { fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -0.8 },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },

  socialBtn: {
    height: 52, borderRadius: 16, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  googleG: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#4285F4' },
  socialBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  eyeBtn: { padding: 4 },
  fieldError: { fontSize: 12, fontFamily: 'Inter_400Regular' },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0,
  },
  termsText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },

  iconWrap: { alignItems: 'center', marginVertical: 12 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 24, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1,
  },
  errorBannerText: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },

  primaryBtn: { height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },

  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  linkText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
