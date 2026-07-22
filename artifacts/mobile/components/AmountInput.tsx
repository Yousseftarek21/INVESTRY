import React, { useEffect, useRef, useState } from 'react';
import { NativeSyntheticEvent, TextInput, TextInputProps, TextInputSelectionChangeEventData } from 'react-native';
import { cleanAmountInput, formatAmountInput } from '@/utils/parseAmount';

interface AmountInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string; // clean numeric string, e.g. "5000" or "5000.5" — no commas
  onChangeText: (clean: string) => void;
}

function countDigits(str: string, uptoIndex: number): number {
  let count = 0;
  for (let i = 0; i < uptoIndex && i < str.length; i++) {
    if (/\d/.test(str[i])) count++;
  }
  return count;
}

/** Index right after the Nth digit character in str (comma/decimal-point-aware). */
function indexAfterDigitCount(str: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (/\d/.test(str[i])) {
      count++;
      if (count === digitCount) return i + 1;
    }
  }
  return str.length;
}

/**
 * A numeric TextInput that live-formats with thousands-separator commas
 * while keeping the cursor in the right place.
 *
 * The naive version of this (reformat the value on every keystroke) is a
 * real bug source on React Native: inserting/removing a comma shifts every
 * character after it, and the platform has no way to know the cursor
 * should shift with it — it often snaps to the wrong spot, making
 * backspace/edits feel like they're deleting the wrong digit. This
 * component fixes that directly: it tracks the cursor as a *count of
 * digits to its left* (which commas don't affect) rather than a raw
 * string index, and re-derives the correct index into the newly-formatted
 * string after every change.
 */
export function AmountInput({ value, onChangeText, onSelectionChange, keyboardType, ...rest }: AmountInputProps) {
  const displayValue = formatAmountInput(value);
  const selectionRef = useRef<{ start: number; end: number }>({ start: displayValue.length, end: displayValue.length });
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined);

  // `selection` is only ever meant to correct the cursor right after *this*
  // component reformats the text — left set indefinitely, it would fight a
  // manual tap to reposition the cursor on any later re-render. Clearing it
  // back to undefined right after applying it makes it a one-shot nudge
  // instead of a standing constraint.
  useEffect(() => {
    if (selection === undefined) return;
    const id = requestAnimationFrame(() => setSelection(undefined));
    return () => cancelAnimationFrame(id);
  }, [selection]);

  const handleChangeText = (raw: string) => {
    const oldDigitsBeforeCursor = countDigits(displayValue, selectionRef.current.start);
    const oldDigitCount = (displayValue.match(/\d/g) || []).length;

    const clean = cleanAmountInput(raw);
    const newDigitCount = (clean.match(/\d/g) || []).length;
    const digitDelta = newDigitCount - oldDigitCount;

    onChangeText(clean);

    const newDisplay = formatAmountInput(clean);
    const targetDigits = Math.max(0, Math.min(newDigitCount, oldDigitsBeforeCursor + digitDelta));
    const pos = indexAfterDigitCount(newDisplay, targetDigits);
    selectionRef.current = { start: pos, end: pos };
    setSelection({ start: pos, end: pos });
  };

  const handleSelectionChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    selectionRef.current = e.nativeEvent.selection;
    onSelectionChange?.(e);
  };

  return (
    <TextInput
      {...rest}
      value={displayValue}
      onChangeText={handleChangeText}
      selection={selection}
      onSelectionChange={handleSelectionChange}
      keyboardType={keyboardType ?? 'decimal-pad'}
    />
  );
}
