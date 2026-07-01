import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useSignIn, useSSO } from '@clerk/expo';
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

export default function SignInScreen() {
  useWarmUpBrowser();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [code, setCode] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const isFetching = fetchStatus === 'fetching';

  const handleSignIn = async () => {
    setGlobalError('');
    const { error } = await signIn.password({ emailAddress: email, password });
    if (error) { setGlobalError(error.message ?? 'Sign in failed'); return; }

    if (signIn.status === 'complete') {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl('/');
          if (url.startsWith('http')) {
            router.replace('/(tabs)');
          } else {
            router.replace('/(tabs)');
          }
        },
      });
    } else if (signIn.status === 'needs_client_trust') {
      await signIn.mfa.sendEmailCode();
    }
  };

  const handleVerify = async () => {
    setGlobalError('');
    await signIn.mfa.verifyEmailCode({ code });
    if (signIn.status === 'complete') {
      await signIn.finalize({
        navigate: () => router.replace('/(tabs)'),
      });
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
        await setActive!({
          session: createdSessionId,
          navigate: () => router.replace('/(tabs)'),
        });
      }
    } catch (err: any) {
      setGlobalError(err?.message ?? 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow]);

  // OTP verification view
  if (signIn.status === 'needs_client_trust') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.inner, { paddingTop: topPad + 24, paddingBottom: botPad + 24 }]}>
          <Pressable onPress={() => signIn.reset()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.text} />
          </Pressable>
          <View style={styles.iconWrap}>
            <View style={[styles.iconCircle, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="mail" size={28} color={colors.primary} />
            </View>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Check your email</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            We sent a verification code to {email}
          </Text>

          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="6-digit code"
              placeholderTextColor={colors.mutedForeground}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
            />
          </View>
          {errors.fields.code && (
            <Text style={[styles.fieldError, { color: colors.red }]}>{errors.fields.code.message}</Text>
          )}

          <Pressable
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: isFetching ? 0.7 : 1 }]}
            onPress={handleVerify}
            disabled={isFetching || code.length < 4}
          >
            {isFetching
              ? <ActivityIndicator color={colors.primaryForeground} />
              : <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Verify</Text>
            }
          </Pressable>

          <Pressable onPress={() => signIn.mfa.sendEmailCode()}>
            <Text style={[styles.linkText, { color: colors.primary }]}>Resend code</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: fadeAnim }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.inner, { paddingTop: topPad + 16, paddingBottom: botPad + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.text} />
          </Pressable>

          {/* Header */}
          <View style={styles.headerWrap}>
            <Text style={[styles.appLabel, { color: colors.primary }]}>INVSTRY</Text>
            <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Sign in to your account
            </Text>
          </View>

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

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email address</Text>
            <View style={[styles.inputWrap, { borderColor: errors.fields.identifier ? colors.red : colors.border, backgroundColor: colors.card }]}>
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
            {errors.fields.identifier && (
              <Text style={[styles.fieldError, { color: colors.red }]}>{errors.fields.identifier.message}</Text>
            )}
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Password</Text>
              <Pressable onPress={() => router.push('/(auth)/forgot-password' as any)}>
                <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot?</Text>
              </Pressable>
            </View>
            <View style={[styles.inputWrap, { borderColor: errors.fields.password ? colors.red : colors.border, backgroundColor: colors.card }]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Enter password"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoComplete="password"
              />
              <Pressable onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
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
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: (!email || !password || isFetching) ? 0.5 : 1 }]}
            onPress={handleSignIn}
            disabled={!email || !password || isFetching}
          >
            {isFetching
              ? <ActivityIndicator color={colors.primaryForeground} />
              : <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Sign In</Text>
            }
          </Pressable>

          {/* Footer */}
          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Don't have an account? </Text>
            <Pressable onPress={() => router.replace('/(auth)/sign-up' as any)}>
              <Text style={[styles.linkText, { color: colors.primary }]}>Create one</Text>
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
