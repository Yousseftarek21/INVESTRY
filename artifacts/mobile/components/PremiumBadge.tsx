import React, { useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Feather } from '@expo/vector-icons';

const PURPLE = '#A47FCA';

export function PremiumBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const iconSize = size === 'sm' ? 14 : 17;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  useEffect(() => {
    let cancelled = false;
    const runShimmer = () => {
      if (cancelled) return;
      Animated.sequence([
        Animated.delay(8500),
        Animated.timing(glow, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && !cancelled) runShimmer();
      });
    };
    runShimmer();
    return () => {
      cancelled = true;
    };
  }, [glow]);

  const isIOS = Platform.OS === 'ios';
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });

  return (
    <Animated.View style={{ opacity: Animated.multiply(opacity, glowOpacity), transform: [{ scale }] }}>
      {isIOS ? (
        <SymbolView name="rosette" tintColor={PURPLE} size={iconSize} />
      ) : (
        <Feather name="award" size={iconSize} color={PURPLE} />
      )}
    </Animated.View>
  );
}
