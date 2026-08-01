import React, { useRef } from 'react';
import { I18nManager, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';

const REVEAL_W = 84;

interface SwipeToDeleteProps {
  onDelete: () => void;
  children: React.ReactNode;
}

// Rebuilt on react-native-gesture-handler's Swipeable instead of a hand-rolled
// PanResponder. The old PanResponder lived inside the same gesture arena as
// the screen's ScrollView, and the two recognizers would occasionally race —
// the row would open, then immediately get reclaimed and snapped shut by the
// ScrollView's own pan recognizer. Swipeable is built on PanGestureHandler,
// which negotiates with ScrollView through the native gesture-handler system
// instead of competing with it via separate responder chains.
//
// Trade-off: this drops the old "swipe far enough and it deletes immediately
// without lifting your finger" shortcut. That path was also the source of
// the earlier stuck-row bug, and skipping straight to a delete without an
// explicit tap is inherently riskier — Swipeable's model (swipe reveals a
// button, tap the button to delete) is the more standard, safer pattern.
export function SwipeToDelete({ onDelete, children }: SwipeToDeleteProps) {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const swipeableRef = useRef<SwipeableMethods>(null);

  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  const commitDelete = () => {
    swipeableRef.current?.close();
    onDeleteRef.current();
  };

  const renderActions = (progress: SharedValue<number>) => {
    const style = useAnimatedStyle(() => ({
      opacity: Math.min(progress.value, 1),
    }));
    return (
      <Pressable onPress={commitDelete} style={[st.deleteBack, { backgroundColor: colors.red }]}>
        <Animated.View style={[st.deleteInner, style]}>
          <Feather name="trash-2" size={22} color="#fff" />
          <Text style={st.deleteLabel}>{t.delete}</Text>
        </Animated.View>
      </Pressable>
    );
  };

  if (Platform.OS === 'web') return <>{children}</>;

  return (
    <View style={st.wrap}>
      <Swipeable
        ref={swipeableRef}
        friction={2}
        rightThreshold={REVEAL_W / 2}
        leftThreshold={REVEAL_W / 2}
        overshootRight={!I18nManager.isRTL}
        overshootLeft={I18nManager.isRTL}
        renderRightActions={I18nManager.isRTL ? undefined : renderActions}
        renderLeftActions={I18nManager.isRTL ? renderActions : undefined}
        onSwipeableWillOpen={() => impact(Haptics.ImpactFeedbackStyle.Light)}
      >
        {children}
      </Swipeable>
    </View>
  );
}

const st = StyleSheet.create({
  wrap:        { overflow: 'hidden', borderRadius: 16 },
  deleteBack:  { width: REVEAL_W, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  deleteInner: { alignItems: 'center', gap: 4 },
  deleteLabel: { color: '#fff', fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 },
});
