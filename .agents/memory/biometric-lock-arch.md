---
name: Biometric lock architecture
description: How the biometric lock gate is wired into the app
---

## Component tree
```
AppSettingsProvider
  BiometricWrapper          ← reads biometricLock from useAppSettings()
    BiometricGate           ← receives enabled prop, handles LocalAuthentication
      ErrorBoundary
        ... (rest of app)
```

BiometricWrapper is a small function component inside _layout.tsx — it must be inside AppSettingsProvider to use the context.

## BiometricGate (components/BiometricGate.tsx)
- Takes `enabled: boolean` and `children`
- On web or when enabled=false: passes through immediately
- Checks hasHardwareAsync + isEnrolledAsync; if no biometrics enrolled, passes through
- Detects FACIAL_RECOGNITION vs FINGERPRINT to show correct icon/label
- Authenticate triggers on mount; user can retry with a button

## AppSettingsContext
- Added `biometricLock: boolean` + `setBiometricLock`
- Persisted at `@invstry_biometric`
- Default: false

## Settings
A new SECURITY section appears before NOTIFICATIONS with a biometric lock toggle.

**Why:** Gate sits at the provider level so the entire app (including Clerk/navigation) is hidden behind auth. Web bypasses because `expo-local-authentication` doesn't support web.
