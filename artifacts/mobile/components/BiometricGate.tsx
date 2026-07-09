import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  children: React.ReactNode;
  enabled: boolean;
}

export function BiometricGate({ children, enabled }: Props) {
  const colors = useColors();
  const [unlocked, setUnlocked] = useState(!enabled || Platform.OS === 'web');
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | 'none'>('none');
  const [errorMsg, setErrorMsg] = useState('');

  const authenticate = useCallback(async () => {
    setErrorMsg('');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access INVESTRY',
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) setUnlocked(true);
      else setErrorMsg('Authentication failed. Try again.');
    } catch {
      setErrorMsg('Authentication failed. Try again.');
    }
  }, []);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') { setUnlocked(true); return; }
    setUnlocked(false);
    setErrorMsg('');
    (async () => {
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
      authenticate();
    })();
  }, [enabled, authenticate]);

  if (unlocked) return <>{children}</>;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primary + '20' }]}>
        <Feather name={biometricType === 'face' ? 'eye' : 'shield'} size={40} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>INVESTRY</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Authenticate to view your portfolio
      </Text>
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
          {biometricType === 'face' ? 'Use Face ID' : biometricType === 'fingerprint' ? 'Use Touch ID' : 'Unlock'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 },
  iconWrap: { width: 88, height: 88, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 2 },
  error: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, marginTop: 12 },
  btnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
