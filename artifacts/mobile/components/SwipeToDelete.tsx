import React, { useCallback, useRef, useState } from 'react';
import {
  Animated, I18nManager, PanResponder, Platform,
  Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';

const REVEAL_W = 84;
const COMMIT_W = 210;
// In RTL the delete panel sits on the visual left (via `end`), so the reveal
// gesture mirrors too: dragging right (positive dx) opens it, instead of left.
const DIR = I18nManager.isRTL ? 1 : -1;

interface SwipeToDeleteProps {
  onDelete: () => void;
  children: React.ReactNode;
}

export function SwipeToDelete({ onDelete, children }: SwipeToDeleteProps) {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);

  // Keep onDelete in a ref so the stable PanResponder always calls the latest.
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  // Fire each threshold's haptic tick exactly once per drag, the moment the
  // finger crosses it — matching iOS's own swipe-to-delete, which is the
  // reference this was missing. Reset at the start of every new gesture.
  const revealTickFired = useRef(false);
  const commitTickFired = useRef(false);

  const snapClose = useCallback(() => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }).start();
    isOpenRef.current = false;
    setIsOpen(false);
  }, []);

  const snapOpen = useCallback(() => {
    Animated.spring(translateX, { toValue: DIR * REVEAL_W, useNativeDriver: true, tension: 60, friction: 9 }).start();
    isOpenRef.current = true;
    setIsOpen(true);
  }, []);

  // Delegate the actual deletion to the parent's onDelete — which already
  // shows the confirmation dialog (Alert on native, modal on web). Always
  // snap the row itself back closed first, immediately, regardless of what
  // the user decides in that dialog. Previously this called onDelete()
  // alone: a full commit-swipe left translateX wherever the drag ended, and
  // if the user then tapped Cancel on the confirmation, the row stayed
  // stuck mid-swipe with the red delete background showing — nothing had
  // ever reset it. Confirmed deletes still look identical (the row is about
  // to unmount from the list anyway); cancelled ones now correctly return
  // to normal instead of being left visually broken.
  const commitDelete = useCallback(() => {
    snapClose();
    onDeleteRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5,
      onPanResponderGrant: () => {
        revealTickFired.current = false;
        commitTickFired.current = false;
      },
      onPanResponderMove: (_, { dx }) => {
        const base = isOpenRef.current ? DIR * REVEAL_W : 0;
        const raw = base + dx;
        const next = DIR === -1
          ? Math.min(0, Math.max(raw, -(COMMIT_W + 20)))
          : Math.max(0, Math.min(raw, COMMIT_W + 20));
        translateX.setValue(next);

        const pastReveal = DIR === -1 ? next <= -(REVEAL_W / 2) : next >= REVEAL_W / 2;
        const pastCommit  = DIR === -1 ? next <= -COMMIT_W        : next >= COMMIT_W;
        if (pastReveal && !revealTickFired.current) {
          revealTickFired.current = true;
          impact(Haptics.ImpactFeedbackStyle.Light);
        }
        if (pastCommit && !commitTickFired.current) {
          commitTickFired.current = true;
          impact(Haptics.ImpactFeedbackStyle.Medium);
        }
      },
      onPanResponderRelease: (_, { dx }) => {
        const base = isOpenRef.current ? DIR * REVEAL_W : 0;
        const total = base + dx;
        const pastCommit    = DIR === -1 ? total <= -COMMIT_W        : total >= COMMIT_W;
        const pastReveal     = DIR === -1 ? total < -(REVEAL_W / 2)   : total > REVEAL_W / 2;
        const closingDrag    = DIR === -1 ? dx > REVEAL_W / 2         : dx < -(REVEAL_W / 2);

        if (pastCommit) {
          commitDelete();
        } else if (!isOpenRef.current && pastReveal) {
          snapOpen();
        } else if (isOpenRef.current && closingDrag) {
          snapClose();
        } else if (isOpenRef.current) {
          snapOpen();
        } else {
          snapClose();
        }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => snapClose(),
    }),
  ).current;

  const deleteOpacity = translateX.interpolate({
    inputRange: DIR === -1 ? [-REVEAL_W, -(REVEAL_W / 2), 0] : [0, REVEAL_W / 2, REVEAL_W],
    outputRange: DIR === -1 ? [1, 0.4, 0] : [0, 0.4, 1],
    extrapolate: 'clamp',
  });

  if (Platform.OS === 'web') return <>{children}</>;

  return (
    <View style={st.wrap}>
      <Pressable onPress={commitDelete} style={[st.deleteBack, { backgroundColor: colors.red }]}>
        <Animated.View style={[st.deleteInner, { opacity: deleteOpacity }]}>
          <Feather name="trash-2" size={22} color="#fff" />
          <Text style={st.deleteLabel}>{t.delete}</Text>
        </Animated.View>
      </Pressable>

      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }] }}>
        {isOpen && <Pressable style={StyleSheet.absoluteFillObject} onPress={snapClose} />}
        {children}
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap:        { overflow: 'hidden', borderRadius: 16 },
  deleteBack:  { position: 'absolute', end: 0, top: 0, bottom: 0, width: REVEAL_W, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  deleteInner: { alignItems: 'center', gap: 4 },
  deleteLabel: { color: '#fff', fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 },
});
