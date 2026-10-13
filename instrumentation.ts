import { buildSentryOptions } from '@/lib/analytics/sentry-options';

/** Server-side Sentry: initialised only when a DSN is configured. */
export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.init(buildSentryOptions(dsn));
}

export const onRequestError: typeof import('@sentry/nextjs').captureRequestError = async (
  ...args
) => {
  if (!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(...args);
};
