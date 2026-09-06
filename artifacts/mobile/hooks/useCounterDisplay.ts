import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { useColors } from '@/hooks/useColors';

export const defaultCounterFormatter = (n: number) => n.toLocaleString('en-EG', { maximumFractionDigits: 0 });

// `flashOnChange` is off for values whose change isn't a gain/loss — e.g. the
// cash card's total re-tweening because the display currency was switched,
// not because the underlying balance moved. Flashing that green/red would
// read as "you just made/lost money" for what's actually just a unit change.
//
// `snapWhile`, when true, makes every change during that window apply
// instantly instead of tweening — for a value whose caller is still
// reconciling a cached figure against the server's authoritative one (e.g.
// the Cash total: shown from on-device cache immediately, then possibly
// corrected once the real fetch lands). Without this, that background
// correction visibly "counts" from the stale cached number to the real one
// right after the screen opens, which reads as a bug rather than a sync
// detail. Once the caller flips this back to false, later genuine changes
// (a live edit, a real balance update) animate exactly as before.
export function useCounterDisplay(
  target: number,
  formatter: (n: number) => string = defaultCounterFormatter,
  flashOnChange: boolean = true,
  snapWhile: boolean = false,
): { text: string; tint: Animated.AnimatedInterpolation<string> | null } {
  const anim = useRef(new Animated.Value(target)).current;
  const [text, setText] = useState(formatter(target));
  const prev = useRef(target);
  const colors = useColors();
  // Direction of the last change, held so the flash colour stays correct for
  // the whole fade rather than following the next tick mid-animation.
  const [dir, setDir] = useState<'up' | 'down' | null>(null);
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = anim.addListener(({ value }) => setText(formatter(value)));
    return () => anim.removeListener(id);
  }, [formatter]);

  useEffect(() => {
    if (prev.current === target) return;
    const rising = target > prev.current;
    prev.current = target;
    if (snapWhile) {
      anim.stopAnimation();
      anim.setValue(target);
      return;
    }
    Animated.timing(anim, { toValue: target, duration: 700, useNativeDriver: false }).start();
    if (!flashOnChange) return;
    // The counter tween alone is direction-blind — it looks identical
    // whether the value just rose or fell. Flashing the figure's colour and
    // settling it back makes a live price tick something you can see.
    setDir(rising ? 'up' : 'down');
    flash.stopAnimation();
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, { toValue: 1, duration: 140, useNativeDriver: false }),
      Animated.timing(flash, { toValue: 0, duration: 520, delay: 60, useNativeDriver: false }),
    ]).start();
  }, [target]);

  const tint = flashOnChange && dir
    ? flash.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.text, dir === 'up' ? colors.green : colors.red],
      })
    : null;

  return { text, tint };
}
