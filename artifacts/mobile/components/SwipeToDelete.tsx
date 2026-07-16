import React, { useCallback, useRef, useState } from 'react';
import {
  Alert, Animated, PanResponder, Platform,
  Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

const REVEAL_W = 84;
const COMMIT_W = 210;

interface SwipeToDeleteProps {
  onDelete: () => void;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel?: string;
  cancelLabel?: string;
  children: React.ReactNode;
}

export function SwipeToDelete({
  onDelete,
  confirmTitle,
  confirmMessage,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  children,
}: SwipeToDeleteProps) {
  const colors = useColors();
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);

  // Keep all confirmation props in a ref so the stable PanResponder
  // callbacks always read the latest values without needing to recreate.
  const propsRef = useRef({ onDelete, confirmTitle, confirmMessage, confirmLabel, cancelLabel });
  propsRef.current = { onDelete, confirmTitle, confirmMessage, confirmLabel, cancelLabel };

  const snapClose = useCallback(() => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }).start();
    isOpenRef.current = false;
    setIsOpen(false);
  }, []);

  const snapOpen = useCallback(() => {
    Animated.spring(translateX, { toValue: -REVEAL_W, useNativeDriver: true, tension: 60, friction: 9 }).start();
    isOpenRef.current = true;
    setIsOpen(true);
  }, []);

  // Shows confirmation Alert; only animates slide-out after user confirms.
  const commitDelete = useCallback(() => {
    const { confirmTitle, confirmMessage, confirmLabel, cancelLabel, onDelete } = propsRef.current;
    Alert.alert(confirmTitle, confirmMessage, [
      {
        text: cancelLabel,
        style: 'cancel',
        onPress: snapClose,
      },
      {
        text: confirmLabel,
        style: 'destructive',
        onPress: () => {
          Animated.timing(translateX, { toValue: -600, duration: 200, useNativeDriver: true }).start(() => {
            onDelete();
          });
        },
      },
    ]);
  }, [snapClose]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5,
      onPanResponderMove: (_, { dx }) => {
        const base = isOpenRef.current ? -REVEAL_W : 0;
        const next = Math.min(0, Math.max(base + dx, -(COMMIT_W + 20)));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, { dx }) => {
        const base = isOpenRef.current ? -REVEAL_W : 0;
        const total = base + dx;

        if (total <= -COMMIT_W) {
          commitDelete();
        } else if (!isOpenRef.current && total < -(REVEAL_W / 2)) {
          snapOpen();
        } else if (isOpenRef.current && dx > REVEAL_W / 2) {
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
    inputRange: [-REVEAL_W, -(REVEAL_W / 2), 0],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp',
  });

  if (Platform.OS === 'web') return <>{children}</>;

  return (
    <View style={st.wrap}>
      <Pressable onPress={commitDelete} style={[st.deleteBack, { backgroundColor: colors.red }]}>
        <Animated.View style={[st.deleteInner, { opacity: deleteOpacity }]}>
          <Feather name="trash-2" size={22} color="#fff" />
          <Text style={st.deleteLabel}>Delete</Text>
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
  deleteBack:  { position: 'absolute', right: 0, top: 0, bottom: 0, width: REVEAL_W, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  deleteInner: { alignItems: 'center', gap: 4 },
  deleteLabel: { color: '#fff', fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 },
});
