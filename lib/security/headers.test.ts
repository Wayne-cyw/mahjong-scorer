import { describe, expect, it } from 'vitest';
import { buildCsp, securityHeaders } from './headers';

const asMap = (headers: { key: string; value: string }[]): Record<string, string> =>
  Object.fromEntries(headers.map((h) => [h.key, h.value]));

function directive(csp: string, name: string): string[] {
  const found = csp
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .find(([n]) => n === name);
  if (!found) throw new Error(`missing directive ${name}`);
  return found.slice(1);
}

describe('securityHeaders', () => {
  const headers = asMap(securityHeaders({ production: true }));

  it('sets nosniff, a referrer policy and camera for self only', () => {
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toContain('camera=(self)');
    expect(headers['Permissions-Policy']).toContain('microphone=()');
  });

  it('carries the CSP with frame-ancestors none and the camera preview sources', () => {
    const csp = headers['Content-Security-Policy'] ?? '';
    expect(csp).not.toBe('');
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'img-src')).toEqual(expect.arrayContaining(["'self'", 'blob:', 'data:']));
    expect(directive(csp, 'connect-src')).toContain("'self'");
    expect(directive(csp, 'worker-src')).toContain("'self'");
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
  });
});

describe('buildCsp', () => {
  it('allows no third-party origins by default', () => {
    const csp = buildCsp({ production: true });
    expect(directive(csp, 'connect-src')).toEqual(["'self'"]);
    expect(directive(csp, 'script-src')).not.toContain("'unsafe-eval'");
    expect(csp).not.toMatch(/https?:\/\//);
  });

  it('adds only the PostHog host and Sentry ingest origin when enabled', () => {
    const csp = buildCsp({
      production: true,
      posthogHost: 'https://eu.i.posthog.com/',
      sentryDsn: 'https://pub@o123.ingest.sentry.io/456',
    });
    expect(directive(csp, 'connect-src')).toEqual([
      "'self'",
      'https://eu.i.posthog.com',
      'https://o123.ingest.sentry.io',
    ]);
  });

  it('ignores a malformed host or DSN rather than emitting a broken policy', () => {
    const csp = buildCsp({ production: true, posthogHost: 'not a url', sentryDsn: '???' });
    expect(directive(csp, 'connect-src')).toEqual(["'self'"]);
  });

  it('allows eval and websockets in development only', () => {
    const csp = buildCsp({ production: false });
    expect(directive(csp, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(csp, 'connect-src')).toEqual(expect.arrayContaining(['ws:', 'wss:']));
  });
});
