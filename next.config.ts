import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';
import { securityHeaders } from './lib/security/headers';

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});

const sentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    // Release tag for Sentry; a build identifier, not a secret.
    NEXT_PUBLIC_COMMIT_SHA:
      process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.COMMIT_SHA || '',
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders({
          production: process.env.NODE_ENV === 'production',
          posthogHost: process.env.NEXT_PUBLIC_POSTHOG_KEY
            ? process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
            : undefined,
          sentryDsn,
        }),
      },
    ];
  },
};

const configured = withSerwist(nextConfig);

// Sentry's build plugin (source maps, release) is wrapped in only when a DSN
// is configured, so a plain build is untouched.
async function resolveConfig(): Promise<NextConfig> {
  if (!sentryDsn) return configured;
  const { withSentryConfig } = await import('@sentry/nextjs/config');
  return withSentryConfig(configured, {
    silent: true,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    release: { name: process.env.NEXT_PUBLIC_COMMIT_SHA || undefined },
    sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
    telemetry: false,
  });
}

export default resolveConfig();
