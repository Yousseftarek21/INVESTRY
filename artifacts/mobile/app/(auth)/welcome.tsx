import React, { useRef, useState, useEffect } from 'react';
import {
  Animated, Dimensions, FlatList, Platform, Pressable,
  StyleSheet, Text, View, ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

const { width: W, height: H } = Dimensions.get('window');
const ONBOARDING_KEY = '@invstry_onboarding_done';

const SLIDES = [
  {
    id: '1',
    icon: 'award' as const,
    iconColor: '#D4AC0D',
    iconBg: '#D4AC0D18',
    title: 'Track Gold & Silver',
    subtitle: 'Live prices for 24K, 22K, 21K & 18K gold and sterling silver — all in Egyptian pounds.',
  },
  {
    id: '2',
    icon: 'bar-chart-2' as const,
    iconColor: '#4A9EFF',
    iconBg: '#4A9EFF18',
    title: 'EGX Stocks & Real Estate',
    subtitle: 'Monitor your Egyptian Exchange stocks and property investments in one unified view.',
  },
  {
    id: '3',
    icon: 'pie-chart' as const,
    iconColor: '#00D4AA',
    iconBg: '#00D4AA18',
    title: 'Your Complete Portfolio',
    subtitle: 'See your total net worth, allocation breakdown, and gain/loss at a glance — always up to date.',
  },
];

function Dot({ active, color }: { active: boolean; color: string }) {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: active ? 1 : 0, useNativeDriver: false }).start();
  }, [active]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: [7, 22] });
  return (
    <Animated.View style={[styles.dot, { width, backgroundColor: active ? color : color + '40' }]} />
  );
}

export default function WelcomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(done => {
      if (done) setShowWelcome(true);
    });
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const markDone = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  };

  const handleNext = async () => {
    if (currentIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      await markDone();
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setShowWelcome(true);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }
  };

  const handleSkip = async () => {
    await markDone();
    setShowWelcome(true);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]) setCurrentIndex(viewableItems[0].index ?? 0);
  }).current;

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  if (showWelcome) {
    return (
      <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: fadeAnim }]}>
        <View style={[styles.welcomeInner, { paddingTop: topPad + 40, paddingBottom: botPad + 20 }]}>
          {/* Logo mark */}
          <View style={styles.logoWrap}>
            <View style={[styles.logoRing2, { borderColor: colors.primary + '14' }]} />
            <View style={[styles.logoRing1, { borderColor: colors.primary + '28' }]} />
            <View style={[styles.logoCircle, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="trending-up" size={36} color={colors.primary} />
            </View>
          </View>

          <View style={styles.welcomeText}>
            <Text style={[styles.welcomeApp, { color: colors.primary }]}>INVSTRY</Text>
            <Text style={[styles.welcomeTitle, { color: colors.text }]}>
              Your Egypt Investment Tracker
            </Text>
            <Text style={[styles.welcomeDesc, { color: colors.mutedForeground }]}>
              Track gold, silver, EGX stocks and real estate — live prices in Egyptian pounds.
            </Text>
          </View>

          <View style={styles.welcomeActions}>
            <Pressable
              style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(auth)/sign-up' as any)}
            >
              <Text style={[styles.btnPrimaryText, { color: colors.primaryForeground }]}>Get Started</Text>
              <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
            </Pressable>

            <Pressable
              style={[styles.btnSecondary, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => router.push('/(auth)/sign-in' as any)}
            >
              <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Sign In</Text>
            </Pressable>
          </View>

          <Text style={[styles.welcomeFooter, { color: colors.mutedForeground }]}>
            Egypt · Live Market Data · {new Date().getFullYear()}
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: fadeAnim }]}>
      {/* Skip button */}
      <View style={[styles.skipRow, { paddingTop: topPad + 12 }]}>
        <Pressable onPress={handleSkip} style={[styles.skipBtn, { backgroundColor: colors.muted }]}>
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
        </Pressable>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: W }]}>
            <View style={[styles.slideIconWrap, { backgroundColor: item.iconBg, borderColor: item.iconColor + '30' }]}>
              <Feather name={item.icon} size={48} color={item.iconColor} />
            </View>
            <Text style={[styles.slideTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.slideSubtitle, { color: colors.mutedForeground }]}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Dots + Next */}
      <View style={[styles.footer, { paddingBottom: botPad + 32 }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <Dot key={s.id} active={i === currentIndex} color={colors.primary} />
          ))}
        </View>

        <Pressable
          style={[styles.nextBtn, { backgroundColor: colors.primary }]}
          onPress={handleNext}
        >
          {currentIndex < SLIDES.length - 1 ? (
            <Feather name="arrow-right" size={22} color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>Get Started</Text>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Onboarding
  skipRow: { alignItems: 'flex-end', paddingHorizontal: 24 },
  skipBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  skipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  slide: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 24,
  },
  slideIconWrap: {
    width: 120, height: 120, borderRadius: 36, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  slideTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.8, textAlign: 'center' },
  slideSubtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 24, textAlign: 'center' },
  footer: { paddingHorizontal: 32, gap: 28, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 7, borderRadius: 4 },
  nextBtn: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16,
  },
  nextBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold' },

  // Welcome
  welcomeInner: { flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'space-between' },
  logoWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  logoRing1: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1,
  },
  logoRing2: {
    position: 'absolute', width: 210, height: 210, borderRadius: 105, borderWidth: 1,
  },
  logoCircle: {
    width: 110, height: 110, borderRadius: 34, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  welcomeText: { alignItems: 'center', gap: 10, marginTop: 8 },
  welcomeApp: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 3 },
  welcomeTitle: { fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -0.8, textAlign: 'center', lineHeight: 38 },
  welcomeDesc: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 24 },
  welcomeActions: { width: '100%', gap: 12 },
  btnPrimary: {
    height: 56, borderRadius: 18, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnPrimaryText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  btnSecondary: {
    height: 56, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  btnSecondaryText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  welcomeFooter: { fontSize: 11, fontFamily: 'Inter_400Regular', letterSpacing: 0.3 },
});
