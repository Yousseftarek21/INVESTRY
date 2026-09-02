import React, { useRef } from 'react';
import { I18nManager, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { TapGesture } from 'react-native-gesture-handler';
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
  /** The card's own tap-to-edit gesture, if it has one (built with
      Gesture.Tap() by the caller, wrapping a sibling region of its own
      nested action buttons — see recurring-income.tsx/dividends.tsx for
      the pattern). Wired into this Swipeable's own pan gesture via
      blocksExternalGesture below, so the tap only activates once the pan
      gesture has genuinely failed to recognize a swipe — real fix for
      swipe losing to a tap on real devices, not just the drag-offset
      widening below. Omit for cards with no whole-card tap target. */
  tapGesture?: TapGesture;
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
export function SwipeToDelete({ onDelete, children, tapGesture }: SwipeToDeleteProps) {
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
        // Widened from the library's own 10dp default (DEFAULT_DRAG_OFFSET
        // in ReanimatedSwipeable.tsx) — these are the only activation-
        // threshold props this component actually wires into its pan
        // gesture (they map straight to activeOffsetX internally; a raw
        // activeOffsetX or failOffsetY prop passed here would silently do
        // nothing — verified by reading the component's own source, not
        // assumed). Raising this makes the swipe gesture claim a real touch
        // more decisively before it can lose the race to a child
        // touchable's own tap recognizer.
        //
        // A second, structural half of this fix was tried once and reverted:
        // swapping each card's own TouchableOpacity (and its nested
        // buttons) to react-native-gesture-handler's own TouchableOpacity
        // did stop the swipe-vs-tap race, but nesting native gesture-handler
        // *button views* two levels deep inside this Swipeable broke those
        // nested buttons instead — their tap registered visually (a press
        // flash) without ever completing.
        //
        // blocksExternalGesture below is the real fix, done differently:
        // verified by reading ReanimatedSwipeable's own source, this prop
        // genuinely calls panGesture.blocksExternalGesture(tapGesture) on
        // Swipeable's own internal pan gesture — the caller's tap gesture
        // then only activates once this pan gesture has genuinely failed to
        // recognize a swipe. Unlike the reverted attempt, this never nests
        // a native *button view* inside another one — tapGesture is a
        // lightweight Gesture.Tap() recognizer the caller attaches to a
        // SIBLING region of its own nested action buttons, not an ancestor
        // of them (see recurring-income.tsx/dividends.tsx for the pattern).
        // Nested buttons stay plain RN TouchableOpacity throughout.
        blocksExternalGesture={tapGesture}
        dragOffsetFromLeftEdge={16}
        dragOffsetFromRightEdge={16}
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
