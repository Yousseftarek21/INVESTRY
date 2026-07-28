// Reads the SignIn/SignUp resources off the Clerk instance from useClerk()
// rather than importing useSignIn/useSignUp from '@clerk/react/legacy'.
//
// That legacy import was a cross-package hop: <ClerkProvider> is rendered from
// '@clerk/expo', but the legacy hooks read the React context owned by
// '@clerk/shared/react' as resolved by '@clerk/react'. When those two packages
// resolved to different copies of @clerk/shared, the contexts didn't match and
// the hook threw "useSignIn can only be used within the <ClerkProvider />
// component" — on every render of the sign-in AND sign-up screens, making both
// completely unreachable (builds 53 and 54).
//
// useClerk() comes from '@clerk/expo' — the same package that renders the
// provider — so it can never disagree with it, no matter how the dependency
// tree resolves. clerk.client exposes the identical SignIn/SignUp resources the
// legacy hooks wrap, so the flow below is unchanged.
import { useClerk } from '@clerk/expo';

export type StartAppleAuthParams = { unsafeMetadata?: Record<string, unknown> };

export interface AppleFullName {
  givenName: string | null;
  familyName: string | null;
}

type ClerkInstance = ReturnType<typeof useClerk>;

export interface StartAppleAuthResult {
  createdSessionId: string | null;
  setActive: ClerkInstance['setActive'];
  signIn: ClerkInstance['client'] extends infer C ? (C extends { signIn: infer S } ? S : undefined) : undefined;
  signUp: ClerkInstance['client'] extends infer C ? (C extends { signUp: infer S } ? S : undefined) : undefined;
  appleFullName: AppleFullName | null;
}

// Clerk's own `useSignInWithApple` (from @clerk/expo/apple) only forwards the
// Apple identity token to its backend — it never reads the `fullName` field
// from the native credential, so Clerk never learns the user's name from
// Sign in with Apple. Apple only returns that name once, on the very first
// authorization ever for this Apple ID + app, so if it's dropped here the
// app has no way to recover it later — the user ends up asked to type their
// name in manually, which is exactly what Apple's HIG (and App Review)
// flags: don't ask for information the Authentication Services framework
// already gave you. This hook re-implements Clerk's own flow (same
// `oauth_token_apple` strategy, same transfer handling) but additionally
// captures and returns that name so the caller can persist it via
// `user.update()` right after activating the session.
export function useAppleAuthWithName() {
  const clerk = useClerk();

  async function startAppleAuthenticationFlow(params?: StartAppleAuthParams): Promise<StartAppleAuthResult> {
    const setActive = clerk.setActive;
    const signIn = clerk.client?.signIn as StartAppleAuthResult['signIn'];
    const signUp = clerk.client?.signUp as StartAppleAuthResult['signUp'];

    const [AppleAuthentication, Crypto] = await Promise.all([
      import('expo-apple-authentication'),
      import('expo-crypto'),
    ]);

    if (!(await AppleAuthentication.isAvailableAsync())) {
      throw new Error('Apple Authentication is not available on this device.');
    }

    const nonce = Crypto.randomUUID();
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });

    const { identityToken, fullName } = credential;
    if (!identityToken) throw new Error('No identity token received from Apple Sign-In.');
    if (!signIn || !signUp) return { createdSessionId: null, setActive, signIn, signUp, appleFullName: null };

    await signIn.create({ strategy: 'oauth_token_apple', token: identityToken });

    let createdSessionId: string | null;
    if (signIn.firstFactorVerification.status === 'transferable') {
      await signUp.create({ transfer: true, unsafeMetadata: params?.unsafeMetadata });
      createdSessionId = signUp.createdSessionId ?? null;
    } else {
      createdSessionId = signIn.createdSessionId ?? null;
    }

    const appleFullName = (fullName?.givenName || fullName?.familyName)
      ? { givenName: fullName.givenName ?? null, familyName: fullName.familyName ?? null }
      : null;

    return { createdSessionId, setActive, signIn, signUp, appleFullName };
  }

  return { startAppleAuthenticationFlow };
}
