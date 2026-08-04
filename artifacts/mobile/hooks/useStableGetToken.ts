import { useCallback, useRef } from 'react';
import { useAuth } from '@clerk/expo';

// @clerk/expo's useAuth().getToken is a plain arrow function defined fresh
// inside the hook body on every render (confirmed in its source — no
// useCallback), so it has a new identity every single render regardless of
// whether auth state actually changed. Any useCallback/useEffect that lists
// it as a dependency inherits that churn — the callback's own identity
// changes every render too, so an effect keyed on it re-fires on every
// render, not just on real changes. Observed in production: a burst of
// duplicate push/register + push/preferences calls in the same second, and
// a "Recent updates" screen flickering between real data and empty as
// superseded requests kept winning the race.
//
// This wraps it in a genuinely stable callback (backed by a ref that's kept
// current every render) so dependent hooks can safely depend on it.
export function useStableGetToken() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  return useCallback(() => getTokenRef.current(), []);
}
