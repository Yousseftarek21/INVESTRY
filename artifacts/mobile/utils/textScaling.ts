import React from 'react';
import { Text, TextInput } from 'react-native';

// Cap how much the OS "Larger Text" accessibility setting can scale text.
// Without this, an extreme accessibility text size setting can stretch
// placeholder text in inputs into oddly letter-spaced, hard-to-read
// layouts (a real bug, not just cosmetic).
//
// The obvious fix — Text.defaultProps.maxFontSizeMultiplier — does nothing:
// React 19 dropped defaultProps support for function components, and RN's
// Text/TextInput are function components, so that assignment is a silent
// no-op.
//
// Patching React.createElement isn't enough either: this project (like any
// Expo/babel-preset-expo app) compiles JSX with the *automatic* runtime, so
// `<Text>` compiles to `jsx(Text, props)` / `jsxDEV(...)` calls from
// react/jsx-runtime and react/jsx-dev-runtime — React.createElement is never
// invoked for JSX-authored elements at all. All three entry points are
// patched here so every Text and TextInput in the app gets capped from this
// one place regardless of dev/prod bundling; any call site that explicitly
// passes its own maxFontSizeMultiplier still wins.
const MAX_FONT_SCALE = 1.3;

function withCappedFontScale(type: unknown, props: any) {
  if ((type === Text || type === TextInput) && props && props.maxFontSizeMultiplier === undefined) {
    return { ...props, maxFontSizeMultiplier: MAX_FONT_SCALE };
  }
  return props;
}

const originalCreateElement: (...args: any[]) => any = React.createElement;
(React as any).createElement = function patchedCreateElement(type: unknown, props: any, ...rest: unknown[]) {
  return originalCreateElement(type, withCappedFontScale(type, props), ...rest);
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jsxRuntime = require('react/jsx-runtime');
const originalJsx = jsxRuntime.jsx;
const originalJsxs = jsxRuntime.jsxs;
jsxRuntime.jsx = function patchedJsx(type: unknown, props: any, key?: unknown) {
  return originalJsx(type, withCappedFontScale(type, props), key);
};
jsxRuntime.jsxs = function patchedJsxs(type: unknown, props: any, key?: unknown) {
  return originalJsxs(type, withCappedFontScale(type, props), key);
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jsxDevRuntime = require('react/jsx-dev-runtime');
const originalJsxDEV = jsxDevRuntime.jsxDEV;
jsxDevRuntime.jsxDEV = function patchedJsxDEV(type: unknown, props: any, ...rest: unknown[]) {
  return originalJsxDEV(type, withCappedFontScale(type, props), ...rest);
};
