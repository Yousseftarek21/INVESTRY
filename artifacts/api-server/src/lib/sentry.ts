import * as Sentry from "@sentry/node";

// No-op when SENTRY_DSN isn't set (local dev, or before the DSN is
// provisioned) — every call site guards on Sentry actually being
// initialized, so nothing breaks in its absence.
export const sentryEnabled = Boolean(process.env.SENTRY_DSN);

export function initSentry(): void {
  if (!sentryEnabled) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "production",
    tracesSampleRate: 0.1,
  });
}

export { Sentry };
