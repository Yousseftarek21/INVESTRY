import React, { useEffect, useState } from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { cleanAmountInput, formatAmountInput } from '@/utils/parseAmount';

interface AmountInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string; // clean numeric string, e.g. "5000" or "5000.5" — no commas
  onChangeText: (clean: string) => void;
}

/**
 * A numeric TextInput that live-formats with thousands-separator commas.
 *
 * Deliberately anchors the cursor to the end of the value after every
 * keystroke rather than trying to preserve an arbitrary mid-string cursor
 * position — amount fields are typed/corrected from the right in the
 * overwhelming majority of real use (type a number, backspace the last
 * digit), and always snapping to the end for that case is simple and
 * reliable. The previous approach tried to support editing in the middle
 * too, which meant computing a cursor position from scratch on every
 * change — more surface area for exactly the kind of subtle off-by-one bug
 * this component exists to avoid.
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

  const handleChangeText = (raw: string) => {
    const clean = cleanAmountInput(raw);
    onChangeText(clean);
    const end = formatAmountInput(clean).length;
    setSelection({ start: end, end });
  };

  return (
    <TextInput
      {...rest}
      value={displayValue}
      onChangeText={handleChangeText}
      selection={selection}
      keyboardType={keyboardType ?? 'decimal-pad'}
    />
  );
}
