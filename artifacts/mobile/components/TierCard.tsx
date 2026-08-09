import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useAppSettings } from '@/context/AppSettingsContext';
import { Tier } from '@/utils/portfolioTier';
import { tierName } from '@/components/TierCelebration';

// Same struck-gold stops as TierSeal — the card's whole background carries
// the seal's metal rather than a generic accent color, so the two read as
// the same object at two sizes, not two different treatments of "gold".
const GOLD_GRADIENT: [string, string, string] = ['#fff3c4', '#DDB94A', '#7a5c12'];

/**
 * A membership card, not a badge — tapping the sealed avatar opens this.
 * The physical-card metaphor (issuer mark, contactless glyph, embossed-style
 * tier name, a member-since line) is what a badge fundamentally can't do: it
 * makes the tier feel like something *issued* to the user, the way a real
 * bank's tier cards do, rather than a status label the UI is asserting
 * about them.
 *
 * Only ever mounted with a real tier (see index.tsx, which gates both the
 * seal and this card on actually holding Pro) — there's no "not yet Pro"
 * version of a card that represents something you don't have.
 */
export function TierCard({
  visible,
  onClose,
  tier,
  since,
}: {
  visible: boolean;
  onClose: () => void;
  tier: Tier;
  since: string | null;
}) {
  const colors = useColors();
  const t = useT();
  const { language } = useAppSettings();
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    scale.setValue(0.92);
    opacity.setValue(0);
    shine.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 8, tension: 70, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    Animated.timing(shine, {
      toValue: 1, duration: 1300, delay: 150,
      easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();
  }, [visible, scale, opacity, shine]);

  if (!visible) return null;

  // White text over the gold gradient — the scrim below guarantees this
  // stays legible against the gradient's lighter end, not just its darker one.
  const onCard = '#FFFFFF';
  const sinceDate = since
    ? new Date(since).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-EG', { month: 'short', year: 'numeric' })
    : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View style={{ opacity, transform: [{ scale }], width: '100%', maxWidth: 380 }}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <LinearGradient
              colors={GOLD_GRADIENT}
              start={{ x: 0.05, y: 0 }}
              end={{ x: 0.95, y: 1 }}
              style={s.card}
            >
              {/* Scrim: keeps white text legible over the gradient's pale
                  gold end, not just its darker one. */}
              <LinearGradient
                colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.32)']}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />

              {/* Sweep, same construction as TierCelebration's — the two
                  moments (unlocking Pro, opening its card) share one
                  animation signature. */}
              <Animated.View
                pointerEvents="none"
                style={[
                  s.sweep,
                  {
                    transform: [
                      { rotate: '18deg' },
                      { translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-260, 320] }) },
                    ],
                  },
                ]}
              />

              <View style={s.topRow}>
                <Text style={[s.issuer, { color: onCard }]}>INVESTRY</Text>
                {/* Rotated wifi glyph = the contactless symbol every physical
                    card actually carries — a small, specific detail that
                    sells the metaphor far more than a generic icon would. */}
                <Feather name="wifi" size={20} color={onCard} style={{ opacity: 0.85, transform: [{ rotate: '90deg' }] }} />
              </View>

              <View style={s.chipRow}>
                <View style={[s.chip, { borderColor: onCard + '55' }]}>
                  <View style={[s.chipLine, { backgroundColor: onCard + '55' }]} />
                  <View style={[s.chipLine, { backgroundColor: onCard + '55' }]} />
                </View>
              </View>

              <Text style={[s.tierName, { color: onCard }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {tierName(tier.id, t)}
              </Text>

              {!!sinceDate && (
                <Text style={[s.since, { color: onCard + 'CC' }]}>{t.tierMemberSince(sinceDate)}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={[s.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.closeTxt, { color: colors.text }]}>{t.tierCelebrateDismiss}</Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  card: {
    borderRadius: 24, padding: 22, aspectRatio: 1.65,
    justifyContent: 'space-between', overflow: 'hidden',
  },
  sweep: { position: 'absolute', top: -80, bottom: -80, width: 90, backgroundColor: 'rgba(255,255,255,0.16)' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  issuer: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 2.5 },
  chipRow: { flexDirection: 'row' },
  chip: {
    width: 34, height: 25, borderRadius: 5, borderWidth: 1,
    padding: 4, justifyContent: 'space-evenly',
  },
  chipLine: { height: 1.5, borderRadius: 1 },
  tierName: { fontSize: 34, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  since: { fontSize: 11.5, fontFamily: 'Inter_500Medium', marginTop: -6 },
  closeBtn: {
    alignSelf: 'center', marginTop: 16, paddingHorizontal: 20, paddingVertical: 11,
    borderRadius: 14, borderWidth: 1,
  },
  closeTxt: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold' },
});
