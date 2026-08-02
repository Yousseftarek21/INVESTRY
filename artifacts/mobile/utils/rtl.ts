import { I18nManager } from 'react-native';

// Feather's chevron/arrow glyphs don't auto-mirror the way flexDirection and
// most style properties do under I18nManager.forceRTL — a bare "chevron-left"
// used for a back button keeps pointing left even once the whole screen has
// mirrored around it, pointing away from "back" instead of toward it. Use
// these wherever an icon's meaning is directional (back/forward) rather than
// purely decorative.
export function backChevron(): 'chevron-left' | 'chevron-right' {
  return I18nManager.isRTL ? 'chevron-right' : 'chevron-left';
}
export function backArrow(): 'arrow-left' | 'arrow-right' {
  return I18nManager.isRTL ? 'arrow-right' : 'arrow-left';
}
export function forwardChevron(): 'chevron-left' | 'chevron-right' {
  return I18nManager.isRTL ? 'chevron-left' : 'chevron-right';
}
export function forwardArrow(): 'arrow-left' | 'arrow-right' {
  return I18nManager.isRTL ? 'arrow-left' : 'arrow-right';
}
