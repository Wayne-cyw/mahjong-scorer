import { applyStoredAnalyticsConsent } from '@/lib/analytics/consent';
import { buildSentryOptions } from '@/lib/analytics/sentry-options';

// Client-side Sentry: initialised only when a public DSN is configured.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  void import('@sentry/nextjs').then((Sentry) => Sentry.init(buildSentryOptions(dsn)));
}

// PostHog starts only if the user previously opted in (stored in Dexie `settings`).
void applyStoredAnalyticsConsent();
