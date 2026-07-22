// Text-scaling cap temporarily disabled.
//
// The previous approach patched react/jsx-runtime's jsx/jsxs/jsxDEV exports
// globally (every single component in the app goes through these on every
// render) to work around Text.defaultProps being a no-op on React 19. That's
// an unusually invasive technique, and shortly after it shipped, sign-in
// started silently bouncing back to the sign-in screen. Never confirmed this
// was the actual cause, but it's the single riskiest change in that OTA and
// disabling it is safer than debugging live while the app is unusable.
//
// TODO: re-implement the accessibility text-scale cap with a narrower,
// lower-risk approach (e.g. explicit maxFontSizeMultiplier on the specific
// inputs that showed the letter-spacing bug) once sign-in is confirmed
// stable again.
