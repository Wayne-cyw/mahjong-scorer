# Security and privacy

The app handles no money and no accounts, but it takes photos, holds a paid API key on the server, and stores player names on the device. Controls are built into the structure so that the safe behaviour is the default.

## Privacy by construction

| Concern          | Control                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Photos           | Resized on the phone, EXIF (including GPS) stripped, processed in memory on the server, never written to disk or logs, never used for training |
| Player names     | Stay on the device. The server holds no database and the recognition request carries only an image                                             |
| Analytics        | Opt-in, stored as a local setting. Capture is a no-op without consent and never throws                                                         |
| Error monitoring | Sentry events are scrubbed of user data, extras, breadcrumbs, request bodies, cookies, headers and query strings                               |
| Server logs      | One JSON line per recognition request with outcome, latency, model, token counts and tile count. Never the image, ids or addresses             |

## Browser hardening

- A strict, static Content Security Policy ([ADR 0010](adr/0010-static-csp-for-offline.md)).
- `react/no-danger` is a lint error, so there is no raw HTML injection path.
- `frame-ancestors 'none'` prevents embedding.
- `Permissions-Policy` allows the camera for the app's own origin and disables microphone, geolocation and payment.

## Protecting the API key and the budget

The only thing that costs money is one model call per recognition. Every control is a way of bounding how many calls can happen and how big each one is. Worst-case daily spend is `min(per-identity limits x callers, daily cap) x cost per call`.

| Layer           | Control                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Phone           | Image resized to 1568 px at JPEG 0.85; one request in flight; abandoned uploads aborted                             |
| Request checks  | Origin must match the host; JPEG, PNG or WebP only; 4 MB cap enforced while streaming; magic-byte check             |
| Identity limits | Sliding windows of 30 per hour per device and 60 per hour per IP                                                    |
| Global cap      | A daily cap across all callers (`RECOGNITION_DAILY_CAP`, default 1,000), counted only after the earlier checks pass |
| Per-call bounds | 20 s timeout, output capped at 1,024 tokens, one retry (to a fallback model, for 429 and 5xx only)                  |
| Visibility      | Token-count logging per request                                                                                     |
| Kill switch     | `RECOGNITION_DISABLED=1` refuses every request before the key, limiter or model is touched                          |

The ordering and the fail-closed behaviour are explained in [ADR 0008](adr/0008-recognition-request-pipeline.md). When the cap is reached, or the limiter store is down, the client shows the same manual-entry message as any other recognition failure, so games continue.

### Configuration

| Variable                                             | Effect                                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`                                     | Server-only model key. No `NEXT_PUBLIC_` prefix                                                                   |
| `RECOGNITION_DAILY_CAP`                              | Positive integer of calls per rolling day across all callers. A malformed value makes the limiter refuse to build |
| `RECOGNITION_DISABLED`                               | `1` refuses every request                                                                                         |
| `RECOGNITION_MODEL`                                  | Primary model                                                                                                     |
| `RECOGNITION_FALLBACK_MODEL`                         | Model used for the single retry; `none` retries the primary                                                       |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shared rate-limit counters. Required in production                                                                |

## Key-leak controls

| Stage   | Control                                                                                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prevent | The key is a server-only environment variable. After every build, `pnpm check:secrets` fails if a `NEXT_PUBLIC_*` name looks secret or any file under `.next/static` or `public` contains a key pattern |
| Contain | A separate key per environment, with a low-limit key for previews. CI holds no production secrets                                                                                                       |
| Detect  | gitleaks scans full git history in CI; GitHub secret scanning and push protection                                                                                                                       |
| Respond | Rotation runbook below                                                                                                                                                                                  |

### Rotation runbook

1. Set `RECOGNITION_DISABLED=1` in production and redeploy. This stops spend immediately.
2. Create a new key and update the hosting environment variable.
3. Revoke the old key.
4. Remove the kill switch and redeploy.
5. Review logs and provider usage for the exposure window, and check history with `gitleaks git`.

## Known gaps

- Daily spend rollups and alerts are not built.
- The monthly spend limit is a provider console setting, not code.
- With no accounts, identity is a self-reported device id plus an IP address, both forgeable. The global cap is the only control an attacker cannot rotate around.
- The CSP allows `'unsafe-inline'` for scripts ([ADR 0010](adr/0010-static-csp-for-offline.md)).
- The gitleaks history scan has an Anthropic key rule; the post-build bundle check covers Gemini keys but the history scan does not yet.
