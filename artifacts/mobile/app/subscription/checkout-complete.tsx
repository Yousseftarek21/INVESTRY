/**
 * `/subscription/checkout-complete` — redirect target passed as successUrl/
 * cancelUrl to Stripe Checkout (see SubscriptionContext.purchase()).
 *
 * On native, `expo-web-browser`'s openAuthSessionAsync intercepts this deep
 * link before the app ever renders it. On web, Stripe performs a real
 * top-level navigation to this URL, so the route must exist — otherwise the
 * app shows the Expo Router not-found screen instead of returning the user
 * to the app.
 */
import { Redirect } from 'expo-router';

export default function CheckoutCompletePage() {
  return <Redirect href="/(tabs)" />;
}
