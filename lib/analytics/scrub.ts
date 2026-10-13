import type { Event } from '@sentry/nextjs';

/**
 * Strips everything from a Sentry event that could carry personal data (ADR-20,
 * ADR-60): request bodies, cookies, headers, query strings, the user, free-form
 * extras and breadcrumbs. Player names live in the request body or in app data,
 * so none of those survive; the exception, stack and tags do.
 */
export function scrubSentryEvent<T extends Event>(event: T): T {
  const scrubbed: T = { ...event };
  delete scrubbed.user;
  delete scrubbed.extra;
  delete scrubbed.breadcrumbs;
  delete scrubbed.contexts;

  if (scrubbed.request) {
    const { url, method } = scrubbed.request;
    scrubbed.request = {
      ...(url === undefined ? {} : { url: url.replace(/[?#].*$/, '') }),
      ...(method === undefined ? {} : { method }),
    };
  }
  return scrubbed;
}
