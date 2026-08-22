import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useSignIn, useSSO, useClerk } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { backArrow } from '@/utils/rtl';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { FieldPlaceholder } from '@/components/FieldPlaceholder';
import { useAppleAuthWithName } from '@/hooks/useAppleAuthWithName';

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
  const clerk = useClerk();
  const { setActive } = clerk;
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useAppleAuthWithName();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');

  // Forgot-password flow — a small state machine layered on the same
  // useSignIn() resource: 'request' sends the reset code, 'verify' takes
  // the code + new password and completes the reset in one step.
  const [resetMode, setResetMode] = useState<'none' | 'request' | 'verify'>('none');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [resetError, setResetError] = useState('');

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

  const openForgotPassword = () => {
    setResetError('');
    setResetEmail(email);
    setResetCode('');
    setNewPassword('');
    setResetMode('request');
  };

  const handleSendResetCode = async () => {
    if (!signIn) return;
    setResetError('');
    try {
      await signIn.create({ identifier: resetEmail });
      const { error } = await signIn.resetPasswordEmailCode.sendCode();
      if (error) { setResetError(error.message ?? 'Could not send reset code.'); return; }
      setResetMode('verify');
    } catch (err: any) {
      setResetError(err?.errors?.[0]?.message ?? err?.message ?? 'Could not send reset code. Please try again.');
    }
  };

  const handleSubmitReset = async () => {
    if (!signIn) return;
    setResetError('');
    try {
      const verify = await signIn.resetPasswordEmailCode.verifyCode({ code: resetCode });
      if (verify.error) { setResetError(verify.error.message ?? 'Invalid code. Please check and try again.'); return; }
      const submit = await signIn.resetPasswordEmailCode.submitPassword({ password: newPassword });
      if (submit.error) { setResetError(submit.error.message ?? 'Could not set new password.'); return; }
      if (signIn.status === 'complete') {
        await activateSession(signIn.createdSessionId);
      } else {
        setResetError(`Reset could not complete. Please try again. (${signIn.status})`);
      }
    } catch (err: any) {
      setResetError(err?.errors?.[0]?.message ?? err?.message ?? 'Reset failed. Please try again.');
    }
  };

  const handleGoogle = useCallback(async () => {
    setGlobalError('');
    setGoogleLoading(true);
    try {
      // Deliberately not passing redirectUrl — @clerk/expo's own default is
      // AuthSession.makeRedirectUri({ path: 'sso-callback' }), and that exact
      // path-suffixed URL is what needs to be whitelisted in Clerk Dashboard's
      // redirect URLs. Overriding it with a bare makeRedirectUri() (no path)
      // silently mismatches that whitelist and drops the session.
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
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
      const { createdSessionId, setActive: setAppleActive, appleFullName } = await startAppleAuthenticationFlow();
      if (createdSessionId && setAppleActive) {
        await setAppleActive({ session: createdSessionId, navigate: finalizeNavigate });
        // Apple only returns the name on the very first authorization ever —
        // persist it now (if Clerk doesn't already have one) so the user is
        // never asked to type it in afterward, matching what Sign in with
        // Apple's Authentication Services already gave us.
        if (appleFullName && clerk.user && !clerk.user.firstName && !clerk.user.lastName) {
          clerk.user.update({
            firstName: appleFullName.givenName ?? undefined,
            lastName: appleFullName.familyName ?? undefined,
          }).catch(() => {});
        }
      } else {
        setGlobalError('Apple sign-in did not complete. Please try again.');
      }
    } catch (err: any) {
      // The user dismissing the native Apple prompt is not an error worth surfacing.
      if (err?.code !== 'ERR_REQUEST_CANCELED') {
        setGlobalError(err?.message ?? 'Apple sign-in failed');
      }
    } finally {
      setAppleLoading(false);
    }
  }, [startAppleAuthenticationFlow, clerk]);

  if (resetMode !== 'none') {
    return (
      <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: fadeAnim }]}>
        <ExpoLinearGradient
          colors={[colors.primary + '26', colors.primary + '06', colors.background + '00']}
          locations={[0, 0.3, 0.65]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.45 }}
          style={StyleSheet.absoluteFillObject}
        />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.inner, { paddingTop: topPad + 16, paddingBottom: botPad + 40, paddingLeft: insets.left + 24, paddingRight: insets.right + 24 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable onPress={() => setResetMode('none')} style={[styles.backBtn, { backgroundColor: colors.muted }]}>
              <Feather name={backArrow()} size={20} color={colors.text} />
            </Pressable>

            <View style={styles.headerWrap}>
              <Text style={[styles.title, { color: colors.text }]}>{t.resetPasswordTitle}</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {resetMode === 'request' ? t.resetPasswordRequestSubtitle : `${t.resetPasswordVerifySubtitle}\n${resetEmail}`}
              </Text>
            </View>

            {resetMode === 'request' ? (
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t.emailAddress}</Text>
                <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <Feather name="mail" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder={t.emailPlaceholder}
                    placeholderTextColor={colors.mutedForeground}
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                  />
                </View>
              </View>
            ) : (
              <>
                <View style={styles.fieldGroup}>
                  <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <TextInput
                      style={[styles.input, { color: colors.text, textAlign: 'center', fontSize: 22, letterSpacing: 8 }]}
                      placeholder="······"
                      placeholderTextColor={colors.mutedForeground}
                      value={resetCode}
                      onChangeText={setResetCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t.newPasswordLabel}</Text>
                  <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <Feather name="lock" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                      <TextInput
                        style={[styles.input, { color: colors.text }]}
                        placeholderTextColor={colors.mutedForeground}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry={!showNewPass}
                        autoComplete="new-password"
                      />
                      <FieldPlaceholder text={t.newPasswordPlaceholder} visible={newPassword.length === 0} color={colors.mutedForeground} />
                    </View>
                    <Pressable onPress={() => setShowNewPass(v => !v)} style={styles.eyeBtn}>
                      <Feather name={showNewPass ? 'eye' : 'eye-off'} size={16} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                </View>
              </>
            )}

            {resetError ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.red + '15', borderColor: colors.red + '30' }]}>
                <Feather name="alert-circle" size={14} color={colors.red} />
                <Text style={[styles.errorBannerText, { color: colors.red }]}>{resetError}</Text>
              </View>
            ) : null}

            {resetMode === 'request' ? (
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: (!resetEmail || isFetching) ? 0.5 : 1 }]}
                onPress={handleSendResetCode}
                disabled={!resetEmail || isFetching}
              >
                {isFetching
                  ? <ActivityIndicator color={colors.primaryForeground} />
                  : <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>{t.sendResetCodeBtn}</Text>
                }
              </Pressable>
            ) : (
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: (resetCode.length < 4 || !newPassword || isFetching) ? 0.5 : 1 }]}
                onPress={handleSubmitReset}
                disabled={resetCode.length < 4 || !newPassword || isFetching}
              >
                {isFetching
                  ? <ActivityIndicator color={colors.primaryForeground} />
                  : <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>{t.resetPasswordBtn}</Text>
                }
              </Pressable>
            )}

            {/* Required for Clerk bot protection */}
            <View nativeID="clerk-captcha" />
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: fadeAnim }]}>
      <ExpoLinearGradient
        colors={[colors.primary + '26', colors.primary + '06', colors.background + '00']}
        locations={[0, 0.3, 0.65]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.45 }}
        style={StyleSheet.absoluteFillObject}
      />
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
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.muted }]}>
            <Feather name={backArrow()} size={20} color={colors.text} />
          </Pressable>

          {/* Header */}
          <View style={[styles.badgeHero, { borderColor: colors.primary + '35' }]}>
            <ExpoLinearGradient
              colors={[colors.primary + '2A', colors.primary + '08']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Feather name="log-in" size={24} color={colors.primary} />
          </View>
          <View style={styles.headerWrap}>
            <Text style={[styles.appLabel, { color: colors.primary }]}>INVESTRY</Text>
            <Text style={[styles.title, { color: colors.text }]}>{t.welcomeBack}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {t.signInSubtitle}
            </Text>
          </View>

          {/* Apple — placed above Google; Apple's guidelines expect Sign in
              with Apple to be at least as prominent as other third-party
              login options when both are offered. iOS-only: the native
              flow needs a real device build, and Android has no equivalent. */}
          {Platform.OS === 'ios' && (
            <Pressable
              style={[styles.socialBtn, { backgroundColor: colors.text, borderColor: colors.text }]}
              onPress={handleApple}
              disabled={appleLoading}
            >
              {appleLoading
                ? <ActivityIndicator color={colors.background} />
                : <>
                    {/* Drawn from FontAwesome's bundled font rather than the
                        U+F8FF private-use codepoint this used to rely on.
                        That bare character survives only if every tool in the
                        chain preserves it byte-for-byte — it had silently been
                        stripped from this file, leaving an empty <Text> and a
                        button with no logo at all. An icon font can't be lost
                        that way. */}
                    <FontAwesome name="apple" size={19} color={colors.background} style={styles.appleGlyph} />
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
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t.passwordLabel}</Text>
            <View style={[styles.inputWrap, { borderColor: errors.fields.password ? colors.red : colors.border, backgroundColor: colors.card }]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoComplete="password"
                />
                <FieldPlaceholder text={t.passwordPlaceholder} visible={password.length === 0} color={colors.mutedForeground} />
              </View>
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
            <Pressable onPress={openForgotPassword} style={styles.forgotRow}>
              <Text style={[styles.forgotText, { color: colors.primary }]}>{t.forgotPassword}</Text>
            </Pressable>
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
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  badgeHero: {
    width: 56, height: 56, borderRadius: 18, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    alignSelf: 'center', marginTop: 8,
  },
  headerWrap: { gap: 6, marginBottom: 4 },
  appLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 2.5 },
  title: { fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -0.8 },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },

  socialBtn: {
    height: 52, borderRadius: 16, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  googleG: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#4285F4' },
  appleGlyph: { marginTop: -2 },
  socialBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  forgotRow: { alignItems: 'flex-end', marginTop: 2 },
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
