import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';

// The one shape every "which icon means X" decision in the app should be
// expressed in. Plain Feather glyph names are kept as a bare string for
// backward compatibility with the many existing call sites that already
// pass one; anything that needs MaterialCommunityIcons (a bigger glyph
// set, used where Feather has no good match — brand marks, "finance",
// "cash-minus", etc.) is tagged with its library explicitly.
export type RowIcon =
  | keyof typeof Feather.glyphMap
  | { lib: 'feather'; name: keyof typeof Feather.glyphMap }
  | { lib: 'mci'; name: keyof typeof MaterialCommunityIcons.glyphMap };

// Renders a RowIcon anywhere a plain `<Feather name=.../>` used to be
// hardcoded. Use this (not a raw <Feather>/<MaterialCommunityIcons>) at
// any call site that displays one of the app-wide concept icons from
// constants/conceptIcons.ts, so a future icon change only ever has to
// happen in one place.
export function ConceptIcon({ icon, size, color }: { icon: RowIcon; size: number; color: string }) {
  if (typeof icon === 'object') {
    return icon.lib === 'mci'
      ? <MaterialCommunityIcons name={icon.name} size={size} color={color} />
      : <Feather name={icon.name} size={size} color={color} />;
  }
  return <Feather name={icon} size={size} color={color} />;
}
