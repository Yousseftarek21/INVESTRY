import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * A placeholder drawn as ordinary text on top of a TextInput, for fields that
 * use `secureTextEntry`.
 *
 * iOS swaps a secure UITextField onto its own font metrics so the masking dots
 * lay out evenly. A custom `fontFamily` placeholder inherits that tracking, so
 * "Enter password" renders as "E n t e r  p a s s w o r d" while the label
 * directly above it — a plain Text — looks perfectly normal. Only secure
 * fields are affected; the email input beside it has always been fine.
 *
 * Two earlier attempts (dc7f0be, 38a8afa) read this as an accessibility
 * font-scaling problem and capped maxFontSizeMultiplier. That cap limits font
 * *size* and cannot introduce letter-spacing, which is why the symptom
 * survived both. Rather than fight UITextField's placeholder rendering, the
 * caller drops the native `placeholder` prop and renders this instead — a
 * normal Text, unaffected by anything secureTextEntry does to the field.
 *
 * pointerEvents="none" keeps taps falling through to the input underneath, so
 * focus, autofill and the keyboard behave exactly as before.
 */
export function FieldPlaceholder({
  text, visible, color, fontSize = 15,
}: {
  text: string;
  visible: boolean;
  color: string;
  fontSize?: number;
}) {
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.wrap]}>
      {/* No textAlign: the default start-alignment follows the writing
          direction, so this stays correct in Arabic without extra handling. */}
      <Text numberOfLines={1} style={[s.text, { color, fontSize }]}>
        {text}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { justifyContent: 'center' },
  text: { fontFamily: 'Inter_400Regular' },
});
