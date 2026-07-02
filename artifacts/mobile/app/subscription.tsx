/**
 * /subscription route — not used as a standalone page.
 * The paywall is rendered as a modal from the root layout via SubscriptionScreen.
 * This file exists only to satisfy Expo Router's file-system routing requirement.
 */
import { Redirect } from 'expo-router';

export default function SubscriptionPage() {
  return <Redirect href="/(tabs)" />;
}
