import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import { cleanAmountInput, formatAmountInput, toWesternDigits } from '@/utils/parseAmount';

interface AmountInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string; // clean numeric string, e.g. "5000" or "5000.5" — no commas
  onChangeText: (clean: string) => void;
}

// Where the Nth digit (1-indexed; commas/decimal point don't count) sits in
// a comma-formatted string — the position right after it. Counting digits
// rather than raw characters is what survives a comma shifting position as
// digits are added or removed (e.g. "1,234" -> "12,345").
function cursorIndexForDigitCount(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] >= '0' && formatted[i] <= '9') {
      seen++;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
}

function digitCountBefore(text: string, index: number): number {
  let count = 0;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] >= '0' && text[i] <= '9') count++;
  }
  return count;
}

/**
 * A numeric TextInput that live-formats with thousands-separator commas.
 *
 * Where an edit happened is found by diffing the previous displayed string
 * against the new raw text `onChangeText` reports: the length of their
 * common prefix is exactly where they start to differ, which is where the
 * insert/delete occurred, wherever in the string that was. That position's
 * DIGIT count (not raw character index, since commas move) carries over to
 * the reformatted string, landing the cursor exactly where the user was
 * editing — including backspacing repeatedly from the middle, not just
 * from the end. Every case (digit inserted at the end, deleted from the
 * middle, repeated backspaces walking left) is covered by
 * scratchpad/test_amount_cursor.mjs.
 *
 * This deliberately avoids tracking the TextInput's own selection via
 * onSelectionChange: that requires the native selection-changed event to
 * land before the *next* keystroke's onChangeText fires, which isn't
 * guaranteed under fast real typing and silently broke the plain
 * type-at-the-end case in an earlier version of this file (see git
 * history). The diff here only ever looks at this render's own
 * displayValue and the current keystroke's own text, both already in
 * hand — there's nothing to race.
 */
export function AmountInput({ value, onChangeText, keyboardType, ...rest }: AmountInputProps) {
  const displayValue = formatAmountInput(value);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined);

  // One-shot nudge, not a standing constraint — clearing it back to undefined
  // right after applying it means it never fights a manual tap to move the
  // cursor somewhere else afterward.
  useEffect(() => {
    if (selection === undefined) return;
    const id = requestAnimationFrame(() => setSelection(undefined));
    return () => cancelAnimationFrame(id);
  }, [selection]);

  const handleChangeText = (rawInput: string) => {
    // Normalize to Western digits FIRST, before any diffing or counting.
    // An Arabic keyboard's numeric keys can produce Arabic-Indic glyphs
    // (٠-٩, U+0660-0669) in what onChangeText reports — digitCountBefore
    // and cursorIndexForDigitCount below only ever recognize ASCII '0'-'9',
    // so an un-normalized raw string containing those glyphs was never
    // counted as having any digits at all at/after that point, sending the
    // cursor to a wrong position on literally every keystroke (not a
    // cosmetic offset — typing felt entirely broken). prevDisplay is
    // always Western already (built from formatAmountInput, which itself
    // normalizes), so diffing raw against it only works once raw is too.
    const raw = toWesternDigits(rawInput);
    const prevDisplay = displayValue;
    let prefixLen = 0;
    const minLen = Math.min(prevDisplay.length, raw.length);
    while (prefixLen < minLen && prevDisplay[prefixLen] === raw[prefixLen]) prefixLen++;
    const editEnd = raw.length >= prevDisplay.length
      ? prefixLen + (raw.length - prevDisplay.length) // right after whatever was inserted
      : prefixLen; // right where the deletion happened

    const clean = cleanAmountInput(raw);
    onChangeText(clean);

    const formatted = formatAmountInput(clean);

    // Typing the decimal point itself is a special case: digit-counting alone
    // lands the cursor right after the digit *before* the dot, since the dot
    // isn't a digit and doesn't advance the count — but that's the position
    // just BEFORE the dot in the reformatted string, not after it. Left
    // uncorrected, the very next digit the user types gets inserted before
    // the dot instead of after it (e.g. "5002" + "." + "5" silently becomes
    // "50025" instead of "5002.5"). Only applies to a fresh insertion whose
    // last inserted character is the dot — deletions and mid-string edits
    // fall through to the normal digit-count path below.
    const insertedDot = raw.length > prevDisplay.length && raw[editEnd - 1] === '.';
    let end: number;
    if (insertedDot) {
      const dotIndex = formatted.indexOf('.');
      end = dotIndex === -1 ? formatted.length : dotIndex + 1;
    } else {
      const digitCount = digitCountBefore(raw, editEnd);
      end = cursorIndexForDigitCount(formatted, digitCount);
    }
    setSelection({ start: end, end });
  };

  return (
    <TextInput
      {...rest}
      style={[rest.style, st.ltr]}
      value={displayValue}
      onChangeText={handleChangeText}
      selection={selection}
      keyboardType={keyboardType ?? 'decimal-pad'}
    />
  );
}

const st = StyleSheet.create({
  // Digits are always read left-to-right, in Arabic UI same as English — but
  // when the app is in Arabic (I18nManager.forceRTL(true) in
  // AppSettingsContext), a plain TextInput inherits RTL writing direction
  // from the app, and every cursor-index computed above (cursorIndexForDigitCount,
  // digitCountBefore) assumes a plain left-to-right character offset. Under
  // native RTL rendering those two stop agreeing — the logical position this
  // file computes and the position the OS actually renders the cursor at
  // diverge, which is what showed up as digits landing in the wrong spot and
  // the cursor jumping around while typing an amount in Arabic. Forcing this
  // one field back to ltr makes the field's own visual/logical mapping match
  // what this file's math assumes, regardless of the app's overall language.
  ltr: { writingDirection: 'ltr' },
});
