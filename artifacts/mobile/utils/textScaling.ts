import { Text, TextInput } from 'react-native';

// Cap how much the OS "Larger Text" accessibility setting can scale text.
// Without this, an extreme accessibility text size setting can stretch
// placeholder text in inputs into oddly letter-spaced, hard-to-read
// layouts (a real bug, not just cosmetic) — this affects every Text and
// TextInput in the app from a single place instead of patching each one.
const MAX_FONT_SCALE = 1.3;

(Text as any).defaultProps = (Text as any).defaultProps ?? {};
(Text as any).defaultProps.maxFontSizeMultiplier = MAX_FONT_SCALE;

(TextInput as any).defaultProps = (TextInput as any).defaultProps ?? {};
(TextInput as any).defaultProps.maxFontSizeMultiplier = MAX_FONT_SCALE;
