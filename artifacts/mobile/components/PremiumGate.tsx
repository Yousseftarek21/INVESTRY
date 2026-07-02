import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useSubscription, Plan } from '@/context/SubscriptionContext';

interface PremiumGateProps {
  requiredPlan: 'pro' | 'pro_plus';
  feature: string;
  description: string;
  children: React.ReactNode;
}

const ACCENT: Record<'pro' | 'pro_plus', string> = {
  pro: '#D4AC0D',
  pro_plus: '#A47FCA',
};

const BADGE: Record<'pro' | 'pro_plus', string> = {
  pro: 'PRO',
  pro_plus: 'PRO+',
};

function hasAccess(userPlan: Plan, required: 'pro' | 'pro_plus'): boolean {
  if (required === 'pro') return userPlan === 'pro' || userPlan === 'pro_plus';
  return userPlan === 'pro_plus';
}

export function PremiumGate({ requiredPlan, feature, description, children }: PremiumGateProps) {
  const { plan, showPaywall } = useSubscription();

  if (hasAccess(plan, requiredPlan)) return <>{children}</>;

  const accent = ACCENT[requiredPlan];
  const badge = BADGE[requiredPlan];

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
              <Feather name={requiredPlan === 'pro' ? 'star' : 'zap'} size={10} color={accent} style={{ marginRight: 5 }} />
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
            onPress={() => showPaywall(requiredPlan)}
            style={({ pressed }) => [g.btn, { backgroundColor: accent, opacity: pressed ? 0.88 : 1 }]}
          >
            <Feather name="zap" size={14} color="#000" style={{ marginRight: 7 }} />
            <Text style={g.btnTxt}>Upgrade to {badge}</Text>
          </Pressable>

          <Text style={[g.unlockHint, { color: accent + '80' }]}>
            {requiredPlan === 'pro' ? 'From 399.99 EGP/year' : 'From 559.99 EGP/year'}
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
