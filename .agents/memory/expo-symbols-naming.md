---
name: expo-symbols SF Symbol naming
description: How to find valid SF Symbol name strings for expo-symbols' SymbolView, since Apple's docs use different names than the TS type accepts.
---

`SymbolView`'s `name` prop is typed against the `sf-symbols-typescript` package (used internally by `expo-symbols`), not Apple's raw SF Symbols catalog names. Apple names variants like `rosette.fill`, but the TS union may only expose the base name (e.g. `rosette`, no `.fill` suffix) if that's the only variant the package ships.

**Why:** Guessing the Apple catalog name and passing it straight to `SymbolView` causes a TS2322 type error (`Type '"x.fill"' is not assignable to type 'SFSymbols7_0'`) — it fails at typecheck, not runtime, so it's caught late if you don't typecheck after adding a new symbol.

**How to apply:** Before using a new SF Symbol name, grep the installed `sf-symbols-typescript` package's `dist/index.d.ts` (path resolvable via `find node_modules/.pnpm -path "*sf-symbols-typescript*" -name "*.d.ts"`) for the symbol's base name to confirm the exact string the type accepts, rather than trusting Apple's SF Symbols app naming. Always follow the existing codebase pattern of `Platform.OS === 'ios' ? <SymbolView .../> : <Feather .../>` for cross-platform fallback.
