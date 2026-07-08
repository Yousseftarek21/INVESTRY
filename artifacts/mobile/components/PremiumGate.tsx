import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSubscription } from '@/context/SubscriptionContext';
import { useT } from '@/hooks/useTranslation';

interface PremiumGateProps {
  feature: string;
  description: string;
  children: React.ReactNode;
}

const ACCENT = '#C9A227';
const BADGE = 'PRO';

export function PremiumGate({ feature, description, children }: PremiumGateProps) {
  const { isPro, launchAccess, showPaywall } = useSubscription();
  const { isSignedIn } = useAuth();
  const t = useT();

  // Launch Access is the single source of truth for "is everything unlocked
  // right now" — never rely on `plan` alone here, since it could momentarily
  // be stale/unresolved (loading, cache, network hiccup) even though the
  // backend has already granted everyone access.
  if (launchAccess || isPro) return <>{children}</>;

  const accent = ACCENT;
  const badge = BADGE;

  // Signed-out visitors aren't missing a paid plan — they're missing an
  // account. During Launch Access every signed-in user gets this feature
  // for free, so prompt them to sign in instead of showing a pay prompt.
  if (!isSignedIn) {
    return (
      <View style={[g.wrapper, { marginHorizontal: 20, marginVertical: 8 }]}>
        <View style={[g.glowRingOuter, { borderColor: accent + '18' }]} />
        <View style={[g.glowRingInner, { borderColor: accent + '28' }]} />

        <View style={[g.card, { borderColor: accent + '30', backgroundColor: '#060D1A' }]}>
          <View style={[g.topBar, { backgroundColor: accent }]} />

          <View style={g.body}>
            <View style={g.headerRow}>
              <View style={[g.badge, { backgroundColor: accent + '15', borderColor: accent + '35' }]}>
                <Feather name="user" size={10} color={accent} style={{ marginRight: 5 }} />
                <Text style={[g.badgeTxt, { color: accent }]}>{badge}</Text>
              </View>
              <View style={[g.lockCircle, { backgroundColor: accent + '12', borderColor: accent + '25' }]}>
                <Feather name="lock" size={13} color={accent} />
              </View>
            </View>

            <Text style={g.featureName}>{feature}</Text>
            <Text style={g.featureDesc}>{description}</Text>

            <View style={[g.divider, { backgroundColor: accent + '20' }]} />

            <Pressable
              onPress={() => router.push('/(auth)/welcome' as any)}
              style={({ pressed }) => [g.btn, { backgroundColor: accent, opacity: pressed ? 0.88 : 1 }]}
            >
              <Feather name="log-in" size={14} color="#000" style={{ marginRight: 7 }} />
              <Text style={g.btnTxt}>{t.subSignInButton}</Text>
            </Pressable>

            <Text style={[g.unlockHint, { color: accent + '80' }]}>
              {t.subSignInToUnlockDesc}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[g.wrapper, { marginHorizontal: 20, marginVertical: 8 }]}>
      {/* Subtle glow rings */}
      <View style={[g.glowRingOuter, { borderColor: accent + '18' }]} />
      <View style={[g.glowRingInner, { borderColor: accent + '28' }]} />

      <View style={[g.card, { borderColor: accent + '30', backgroundColor: '#060D1A' }]}>
        {/* Top accent bar */}
        <View style={[g.topBar, { backgroundColor: accent }]} />

        <View style={g.body}>
          {/* Header row */}
          <View style={g.headerRow}>
            <View style={[g.badge, { backgroundColor: accent + '15', borderColor: accent + '35' }]}>
              <Feather name="zap" size={10} color={accent} style={{ marginRight: 5 }} />
              <Text style={[g.badgeTxt, { color: accent }]}>{badge}</Text>
            </View>
            <View style={[g.lockCircle, { backgroundColor: accent + '12', borderColor: accent + '25' }]}>
              <Feather name="lock" size={13} color={accent} />
            </View>
          </View>

          {/* Feature name */}
          <Text style={g.featureName}>{feature}</Text>

          {/* Description */}
          <Text style={g.featureDesc}>{description}</Text>

          {/* Divider */}
          <View style={[g.divider, { backgroundColor: accent + '20' }]} />

          {/* Upgrade button */}
          <Pressable
            onPress={() => showPaywall()}
            style={({ pressed }) => [g.btn, { backgroundColor: accent, opacity: pressed ? 0.88 : 1 }]}
          >
            <Feather name="zap" size={14} color="#000" style={{ marginRight: 7 }} />
            <Text style={g.btnTxt}>{t.subUpgradeTo} {badge}</Text>
          </Pressable>

          <Text style={[g.unlockHint, { color: accent + '80' }]}>
            {t.subFromYearlyPro}
          </Text>
        </View>
      </View>
    </View>
  );
}

const g = StyleSheet.create({
  wrapper: { position: 'relative' },

  glowRingOuter: {
    position: 'absolute', top: -8, left: -8, right: -8, bottom: -8,
    borderRadius: 30, borderWidth: 1,
  },
  glowRingInner: {
    position: 'absolute', top: -3, left: -3, right: -3, bottom: -3,
    borderRadius: 25, borderWidth: 1,
  },

  card: {
    borderRadius: 22, borderWidth: 1.5, overflow: 'hidden',
  },
  topBar: { height: 2 },
  body: { padding: 22, gap: 12 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, borderWidth: 1,
  },
  badgeTxt: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  lockCircle: {
    width: 34, height: 34, borderRadius: 11, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  featureName: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: -0.4 },
  featureDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#5A6C80', lineHeight: 20 },

  divider: { height: 1 },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, paddingVertical: 15,
  },
  btnTxt: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#000' },

  unlockHint: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: -4 },
});
