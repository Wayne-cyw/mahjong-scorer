# 0010. A static CSP, trading `unsafe-inline` for offline caching

Status: Accepted

## Context

The app takes photos, holds a paid API key on the server, and stores player names on the device. Cross-site scripting is the main way that trust could be lost, and a strict Content Security Policy is the standard defence. But the app is also offline-first: pages must be statically served so the service worker can cache them.

## Decision

The CSP is **static, with no per-request nonce**. Pages stay statically served and cacheable. The cost is that `script-src` must allow `'unsafe-inline'`, because the Next.js App Router emits inline bootstrap scripts. Everything else is locked to the same origin, and third-party origins (error monitoring, analytics) are added only when configured. In development the policy also allows `unsafe-eval` and websockets for tooling.

The softer script policy is compensated for elsewhere:

- `react/no-danger` is banned by lint, so there is no raw HTML injection path.
- `frame-ancestors 'none'` prevents embedding.
- `Permissions-Policy` allows only the camera (`camera=(self)`) and disables microphone, geolocation and payment.
- Sentry events are scrubbed of user data, request bodies, cookies, headers and query strings.

## Alternatives considered

- **A nonce-based CSP.** Stronger, but it forces dynamic rendering, which would defeat static caching and weaken offline play.
- **No CSP.** Unacceptable for an app that handles player names and a camera.

## Consequences

- Offline capability is preserved, which is a core requirement.
- `'unsafe-inline'` for scripts is a real softening of the policy. It is accepted knowingly, and should be revisited if Next.js offers a static-friendly way to avoid inline bootstrap scripts.
- The trade-off is recorded here so a future change can weigh it, rather than rediscovering it.
