// Same lower-level resources Clerk's own useSignInWithApple (@clerk/expo/apple)
// uses internally — the newer signal-based useSignIn()/useSignUp() exported
// from the '@clerk/expo' root don't expose `setActive`/`.create()` in the
// shape this flow needs (that comes from useClerk() instead), so this
// mirrors Clerk's own implementation choice rather than inventing a new one.
import { useSignIn, useSignUp } from '@clerk/react/legacy';

export type StartAppleAuthParams = { unsafeMetadata?: Record<string, unknown> };

export interface AppleFullName {
  givenName: string | null;
  familyName: string | null;
}

export interface StartAppleAuthResult {
  createdSessionId: string | null;
  setActive: ReturnType<typeof useSignIn>['setActive'];
  signIn: ReturnType<typeof useSignIn>['signIn'];
  signUp: ReturnType<typeof useSignUp>['signUp'];
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
  const { signIn, setActive } = useSignIn();
  const { signUp } = useSignUp();

  async function startAppleAuthenticationFlow(params?: StartAppleAuthParams): Promise<StartAppleAuthResult> {
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
