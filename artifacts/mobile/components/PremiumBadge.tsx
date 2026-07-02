import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { Feather } from '@expo/vector-icons';

const GOLD = '#D4AC0D';
const GOLD_LIGHT = '#F5C518';
const PURPLE = '#A47FCA';
const PURPLE_DARK = '#8A5FB8';

type Plan = 'pro' | 'pro_plus';

export function PremiumBadge({ plan, size = 'md' }: { plan: Plan; size?: 'sm' | 'md' }) {
  const isProPlus = plan === 'pro_plus';
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const shimmerX = useRef(new Animated.Value(-1)).current;

  const compact = size === 'sm';
  const height = compact ? 20 : 24;
  const fontSize = compact ? 10 : 11;
  const iconSize = compact ? 10 : 12;
  const paddingHorizontal = compact ? 8 : 10;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  useEffect(() => {
    if (!isProPlus) return;
    let cancelled = false;
    const runShimmer = () => {
      if (cancelled) return;
      shimmerX.setValue(-1);
      Animated.sequence([
        Animated.delay(8500),
        Animated.timing(shimmerX, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && !cancelled) runShimmer();
      });
    };
    runShimmer();
    return () => {
      cancelled = true;
    };
  }, [isProPlus, shimmerX]);

  const translateX = shimmerX.interpolate({
    inputRange: [-1, 1],
    outputRange: [-60, 60],
  });

  const isIOS = Platform.OS === 'ios';
  const iconColor = isProPlus ? '#FFFFFF' : GOLD;
  const label = isProPlus ? 'PRO+' : 'PRO';

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ scale }],
        borderRadius: 999,
        shadowColor: isProPlus ? PURPLE : GOLD,
        shadowOffset: { width: 0, height: isProPlus ? 3 : 2 },
        shadowOpacity: isProPlus ? 0.55 : 0.35,
        shadowRadius: isProPlus ? 10 : 6,
        elevation: isProPlus ? 6 : 3,
      }}
    >
      <LinearGradient
        colors={isProPlus ? [PURPLE, PURPLE_DARK] : [GOLD_LIGHT, GOLD]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.pill,
          { height, paddingHorizontal, gap: compact ? 3 : 4 },
        ]}
      >
        {!isProPlus && (
          <View style={styles.iconChip}>
            {isIOS ? (
              <SymbolView name="rosette" tintColor={iconColor} size={iconSize} />
            ) : (
              <Feather name="award" size={iconSize} color={iconColor} />
            )}
          </View>
        )}
        {isProPlus &&
          (isIOS ? (
            <SymbolView name="rosette" tintColor={iconColor} size={iconSize} />
          ) : (
            <Feather name="award" size={iconSize} color={iconColor} />
          ))}
        <Text style={[styles.label, { fontSize }]}>{label}</Text>

        {isProPlus && (
          <Animated.View
            pointerEvents="none"
            style={[styles.shimmerClip, { transform: [{ translateX }] }]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    overflow: 'hidden',
  },
  iconChip: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.4,
  },
  shimmerClip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 40,
  },
});
