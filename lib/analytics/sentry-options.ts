import type { ErrorEvent } from '@sentry/nextjs';
import { scrubSentryEvent } from './scrub';

/**
 * Shared Sentry options for the client and server (ADR-20, ADR-60). Errors only:
 * no tracing (no sample rate is set, so no trace headers), no replay, no breadcrumbs, no default PII, every event scrubbed.
 */
export function buildSentryOptions(dsn: string) {
  return {
    dsn,
    release: process.env.NEXT_PUBLIC_COMMIT_SHA || undefined,
    environment: process.env.NODE_ENV,
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    beforeSend: (event: ErrorEvent): ErrorEvent => scrubSentryEvent(event),
  };
}
