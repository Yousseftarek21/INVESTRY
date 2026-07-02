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

const PLAN_LABEL: Record<'pro' | 'pro_plus', string> = {
  pro: 'PRO',
  pro_plus: 'PRO+',
};

const PLAN_COLOR: Record<'pro' | 'pro_plus', string> = {
  pro: '#D4AC0D',
  pro_plus: '#A47FCA',
};

function hasAccess(userPlan: Plan, required: 'pro' | 'pro_plus'): boolean {
  if (required === 'pro') return userPlan === 'pro' || userPlan === 'pro_plus';
  return userPlan === 'pro_plus';
}

export function PremiumGate({ requiredPlan, feature, description, children }: PremiumGateProps) {
  const colors = useColors();
  const { plan, showPaywall } = useSubscription();

  if (hasAccess(plan, requiredPlan)) return <>{children}</>;

  const accentColor = PLAN_COLOR[requiredPlan];
  const badgeLabel = PLAN_LABEL[requiredPlan];

  return (
    <View style={[g.card, { backgroundColor: colors.card, borderColor: accentColor + '30' }]}>
      {/* Top accent */}
      <View style={[g.topAccent, { backgroundColor: accentColor }]} />

      <View style={g.body}>
        {/* Badge + Lock row */}
        <View style={g.topRow}>
          <View style={[g.badge, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
            <Feather name="star" size={10} color={accentColor} style={{ marginRight: 4 }} />
            <Text style={[g.badgeTxt, { color: accentColor }]}>{badgeLabel}</Text>
          </View>
          <View style={[g.lockWrap, { backgroundColor: accentColor + '12' }]}>
            <Feather name="lock" size={14} color={accentColor} />
          </View>
        </View>

        {/* Title + description */}
        <Text style={[g.featureTitle, { color: colors.text }]}>{feature}</Text>
        <Text style={[g.featureDesc, { color: colors.mutedForeground }]}>{description}</Text>

        {/* Upgrade button */}
        <Pressable
          onPress={() => showPaywall(requiredPlan)}
          style={({ pressed }) => [g.btn, { backgroundColor: accentColor, opacity: pressed ? 0.85 : 1 }]}
        >
          <Feather name="zap" size={14} color="#000" style={{ marginRight: 7 }} />
          <Text style={g.btnTxt}>Upgrade to {badgeLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const g = StyleSheet.create({
  card: {
    borderRadius: 20, borderWidth: 1,
    overflow: 'hidden',
    marginHorizontal: 20, marginVertical: 8,
  },
  topAccent: {
    height: 3, width: '100%',
  },
  body: {
    padding: 20, gap: 10,
  },
  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1,
  },
  badgeTxt: {
    fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1,
  },
  lockWrap: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.3,
  },
  featureDesc: {
    fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, paddingVertical: 13, marginTop: 4,
  },
  btnTxt: {
    fontSize: 14, fontFamily: 'Inter_700Bold', color: '#000',
  },
});
