import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useColors';

/**
 * A stock's company logo, or its ticker initials when there's no logo (new
 * listings often don't have one yet) or the image fails to load.
 */
export function StockLogo({ symbol, logoUrl, size = 40, radius }: {
  symbol: string;
  logoUrl?: string;
  size?: number;
  radius?: number;
}) {
  const colors = useColors();
  const [failed, setFailed] = useState(false);
  const r = radius ?? Math.round(size * 0.3);

  if (logoUrl && !failed) {
    return (
      <View style={[s.box, { width: size, height: size, borderRadius: r, backgroundColor: '#FFFFFF' }]}>
        <Image
          source={{ uri: logoUrl }}
          style={{ width: size, height: size }}
          contentFit="cover"
          cachePolicy="disk"
          transition={120}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  return (
    <View style={[s.box, {
      width: size, height: size, borderRadius: r,
      backgroundColor: colors.primary + '15', borderWidth: 1, borderColor: colors.primary + '28',
    }]}>
      <Text style={[s.initials, { color: colors.primary, fontSize: Math.max(8, Math.round(size * 0.24)) }]} numberOfLines={1}>
        {symbol.slice(0, 4)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  initials: { fontFamily: 'Inter_700Bold', letterSpacing: 0.2 },
});
