import React, { useState } from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { cleanAmountInput, formatAmountInput } from '@/utils/parseAmount';

interface AmountInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string; // clean numeric string, e.g. "5000" or "5000.5" — no commas
  onChangeText: (clean: string) => void;
}

/**
 * A numeric TextInput that shows thousands-separator commas for readability
 * while not focused, but plain digits while actively being edited.
 *
 * Live-inserting commas into a focused, controlled TextInput is a real bug
 * source on React Native, not just a style choice: every time a comma gets
 * added or removed mid-edit, the platform has no reliable way to know where
 * the cursor should land afterward, so it often snaps to the wrong spot —
 * making backspace/edits feel like they're deleting the wrong digit,
 * especially when editing in the middle of a number. Only formatting the
 * *display* value, and only while blurred, sidesteps the problem entirely
 * instead of trying to fix cursor placement after the fact.
 */
export function AmountInput({ value, onChangeText, onFocus, onBlur, keyboardType, ...rest }: AmountInputProps) {
  const [focused, setFocused] = useState(false);
  const displayValue = focused ? value : formatAmountInput(value);

  return (
    <TextInput
      {...rest}
      value={displayValue}
      onChangeText={(v) => onChangeText(cleanAmountInput(v))}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      keyboardType={keyboardType ?? 'decimal-pad'}
    />
  );
}
