import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useSignIn, useSSO, useClerk } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);
}

export default function SignInScreen() {
  useWarmUpBrowser();
  const colors = useColors();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { signIn, errors, fetchStatus } = useSignIn();
  const { setActive } = useClerk();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }).start();
  }, []);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const isFetching = fetchStatus === 'fetching';

  const finalizeNavigate = ({ session, decorateUrl }: { session?: any; decorateUrl: (url: string) => string }) => {
    if (session?.currentTask) return;
    const url = decorateUrl('/');
    if (url.startsWith('http') && typeof window !== 'undefined') {
      window.location.href = url;
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  const activateSession = async (createdSessionId: string | null | undefined) => {
    await setActive!({ session: createdSessionId });
    router.replace('/(tabs)' as any);
  };

  const handleSignIn = async () => {
    if (!signIn) return;
    setGlobalError('');
    try {
      const result = await signIn.password({ emailAddress: email, password });
      if (result.error) { setGlobalError(result.error.message ?? 'Incorrect email or password.'); return; }
      if (signIn.status === 'complete' || signIn.status === 'needs_client_trust') {
        await activateSession(signIn.createdSessionId);
      } else {
        setGlobalError(`Sign-in could not complete. Please try again. (${signIn.status})`);
      }
    } catch (err: any) {
      setGlobalError(err?.errors?.[0]?.message ?? err?.message ?? 'Sign in failed. Please try again.');
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
      } else {
        setGlobalError('Google sign-in did not complete. Please try again.');
      }
    } catch (err: any) {
      setGlobalError(err?.message ?? 'Google sign-in failed');
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
      } else {
        setGlobalError('Apple sign-in did not complete. Please try again.');
      }
    } catch (err: any) {
      setGlobalError(err?.message ?? 'Apple sign-in failed');
    } finally {
      setAppleLoading(false);
    }
  }, [startSSOFlow]);

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: fadeAnim }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.inner, { paddingTop: topPad + 16, paddingBottom: botPad + 40, paddingLeft: insets.left + 24, paddingRight: insets.right + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.text} />
          </Pressable>

          {/* Header */}
          <View style={styles.headerWrap}>
            <Text style={[styles.appLabel, { color: colors.primary }]}>INVESTRY</Text>
            <Text style={[styles.title, { color: colors.text }]}>{t.welcomeBack}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {t.signInSubtitle}
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
                    <Text style={[styles.socialBtnText, { color: colors.background }]}>{t.continueWithApple}</Text>
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
                  <Text style={[styles.socialBtnText, { color: colors.text }]}>{t.continueWithGoogle}</Text>
                </>
            }
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>{t.orDivider}</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t.emailAddress}</Text>
            <View style={[styles.inputWrap, { borderColor: errors.fields.identifier ? colors.red : colors.border, backgroundColor: colors.card }]}>
              <Feather name="mail" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t.emailPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
            {errors.fields.identifier && (
              <Text style={[styles.fieldError, { color: colors.red }]}>{errors.fields.identifier.message}</Text>
            )}
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t.passwordLabel}</Text>
            </View>
            <View style={[styles.inputWrap, { borderColor: errors.fields.password ? colors.red : colors.border, backgroundColor: colors.card }]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t.passwordPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoComplete="password"
              />
              <Pressable
                onPress={() => setShowPass(v => !v)}
                style={[styles.eyeBtn, { opacity: password.length > 0 ? 1 : 0 }]}
                disabled={password.length === 0}
              >
                <Feather name={showPass ? 'eye' : 'eye-off'} size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {errors.fields.password && (
              <Text style={[styles.fieldError, { color: colors.red }]}>{errors.fields.password.message}</Text>
            )}
          </View>

          {globalError ? (
            <View style={[styles.errorBanner, { backgroundColor: colors.red + '15', borderColor: colors.red + '30' }]}>
              <Feather name="alert-circle" size={14} color={colors.red} />
              <Text style={[styles.errorBannerText, { color: colors.red }]}>{globalError}</Text>
            </View>
          ) : null}

          {/* Sign In button */}
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: (!email || !password || isFetching || !signIn) ? 0.5 : 1 }]}
            onPress={handleSignIn}
            disabled={!email || !password || isFetching || !signIn}
          >
            {isFetching
              ? <ActivityIndicator color={colors.primaryForeground} />
              : <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>{t.signInBtnLabel}</Text>
            }
          </Pressable>

          {/* Footer */}
          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>{t.dontHaveAccount}</Text>
            <Pressable onPress={() => router.replace('/(auth)/sign-up' as any)}>
              <Text style={[styles.linkText, { color: colors.primary }]}>{t.createOne}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { paddingHorizontal: 24, gap: 18 },
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
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  forgotText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  eyeBtn: { padding: 4 },
  fieldError: { fontSize: 12, fontFamily: 'Inter_400Regular' },

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

  primaryBtn: {
    height: 54, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },

  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  linkText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
