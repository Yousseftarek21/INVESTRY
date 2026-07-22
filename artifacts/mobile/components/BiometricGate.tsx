import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';

interface Props {
  children: React.ReactNode;
  enabled: boolean;
}

export function BiometricGate({ children, enabled }: Props) {
  const colors = useColors();
  const t = useT();
  const [unlocked, setUnlocked] = useState(!enabled || Platform.OS === 'web');
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | 'none'>('none');
  const [errorMsg, setErrorMsg] = useState('');
  // Independent of errorMsg — a safety net that guarantees a way to retry
  // even if something hangs/throws without ever reaching an explicit error
  // (see the timeout effect below and the try/catch this used to be
  // missing entirely, which could leave the screen stuck forever with no
  // button and no message at all).
  const [showRetry, setShowRetry] = useState(false);
  const attemptIdRef = useRef(0);

  const authenticate = useCallback(async () => {
    setErrorMsg('');
    setShowRetry(false);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t.biometricAuthPrompt,
        fallbackLabel: t.biometricFallbackLabel,
        cancelLabel: t.biometricCancelLabel,
        disableDeviceFallback: false,
      });
      if (result.success) setUnlocked(true);
      else { setErrorMsg(t.biometricAuthFailed); setShowRetry(true); }
    } catch {
      setErrorMsg(t.biometricAuthFailed);
      setShowRetry(true);
    }
  }, [t]);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') { setUnlocked(true); return; }
    setUnlocked(false);
    setErrorMsg('');
    setShowRetry(false);
    const attemptId = ++attemptIdRef.current;

    // Safety net: guarantees a retry button appears within a few seconds no
    // matter what — whether a native call throws, hangs, or the biometric
    // prompt is dismissed in a way that doesn't resolve cleanly. Cleared
    // the moment this attempt actually settles (success/failure/new attempt).
    const timeoutId = setTimeout(() => {
      if (attemptIdRef.current === attemptId) setShowRetry(true);
    }, 5000);

    (async () => {
      try {
        const available = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!available || !enrolled) { setUnlocked(true); return; }
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('face');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('fingerprint');
        } else {
          setBiometricType('none');
        }
        await authenticate();
      } catch {
        setErrorMsg(t.biometricAuthFailed);
        setShowRetry(true);
      }
    })();

    return () => clearTimeout(timeoutId);
  }, [enabled, authenticate, t]);

  // Always render children — the app's navigator (and its Clerk-session-
  // dependent auth routing) mounts and settles on its own timeline,
  // completely independent of how long Face ID/Touch ID takes. The lock
  // screen renders as an absolute overlay on top instead of gating the
  // mount itself.
  //
  // This used to `return <>{children}</>` only once unlocked, which meant
  // the (auth)/(tabs) redirect logic didn't mount — and didn't read
  // useAuth().isSignedIn — until biometric auth succeeded. Face ID is
  // local and often resolves in under a second; Clerk's session restore
  // involves a network round-trip and can still be settling at that exact
  // moment. If biometric finished first, the routing logic mounted, read
  // isSignedIn before it had caught up to the real persisted session, and
  // redirected to sign-in even though the session was valid — the bug
  // behind biometric unlock intermittently landing back on sign-in.
  return (
    <View style={{ flex: 1 }}>
      {children}
      {!unlocked && (
        <View style={[styles.container, StyleSheet.absoluteFillObject, { backgroundColor: colors.background }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '20' }]}>
            <Feather name={biometricType === 'face' ? 'eye' : 'shield'} size={40} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>INVESTRY</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {t.biometricSubtitle}
          </Text>
          {/* The retry button only appears once this attempt has actually
              settled unsuccessfully (or a 5s safety-net timeout fires,
              covering any hang/throw that never reaches an explicit error)
              — on a fresh mount, authenticate() is already firing
              automatically, so showing a "tap to scan" button by default
              would be a pointless extra step in front of the system Face
              ID prompt that's about to appear on its own. */}
          {showRetry && (
            <>
              {!!errorMsg && <Text style={[styles.error, { color: colors.red }]}>{errorMsg}</Text>}
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary }]}
                onPress={authenticate}
                activeOpacity={0.85}
              >
                <Feather
                  name={biometricType === 'face' ? 'eye' : biometricType === 'fingerprint' ? 'crosshair' : 'lock'}
                  size={17}
                  color={colors.primaryForeground}
                />
                <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
                  {biometricType === 'face' ? t.biometricUseFaceId : biometricType === 'fingerprint' ? t.biometricUseTouchId : t.biometricUnlock}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40, zIndex: 999, elevation: Platform.OS === 'android' ? 999 : undefined },
  iconWrap: { width: 88, height: 88, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 2 },
  error: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, marginTop: 12 },
  btnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
