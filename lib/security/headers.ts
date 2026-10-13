/**
 * Security headers (ADR-59). Pure so it can be tested and imported by
 * `next.config.ts`.
 *
 * The CSP is static (no per-request nonce) so pages stay statically served and
 * cacheable by the service worker. Next.js App Router emits inline bootstrap
 * scripts, so `script-src` needs `'unsafe-inline'`; everything else is locked to
 * same origin. Third-party origins are added only when monitoring or analytics
 * is configured.
 */
export interface SecurityHeaderOptions {
  production: boolean;
  /** PostHog API host, only when analytics is configured. */
  posthogHost?: string;
  /** Sentry DSN, only when error monitoring is configured. */
  sentryDsn?: string;
}

export interface HeaderEntry {
  key: string;
  value: string;
}

/** The origin of a URL, or `null` when it is not a valid http(s) URL. */
function originOf(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}

export function buildCsp(options: SecurityHeaderOptions): string {
  const connect = ["'self'"];
  for (const origin of [originOf(options.posthogHost), originOf(options.sentryDsn)]) {
    if (origin && !connect.includes(origin)) connect.push(origin);
  }
  const script = ["'self'", "'unsafe-inline'"];
  if (!options.production) {
    script.push("'unsafe-eval'");
    connect.push('ws:', 'wss:');
  }

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': script,
    'style-src': ["'self'", "'unsafe-inline'"],
    // blob: is the photo preview object URL; data: covers inlined icons.
    'img-src': ["'self'", 'blob:', 'data:'],
    'font-src': ["'self'"],
    'connect-src': connect,
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
    'media-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

export function securityHeaders(options: SecurityHeaderOptions): HeaderEntry[] {
  return [
    { key: 'Content-Security-Policy', value: buildCsp(options) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
    },
  ];
}
