# 0008. Order the request pipeline so cheap checks run first and shared budget is spent last

Status: Accepted

## Context

Every call to the model costs money, the endpoint is public, and there are no accounts. Anyone can script a loop against it. Per-person limits are forgeable, because both a device id and an IP address can be rotated.

## Decision

`/api/recognize` runs its defences in a deliberate order. Each stage assumes the earlier ones failed.

| Order | Stage                  | What it does                                                                           |
| ----- | ---------------------- | -------------------------------------------------------------------------------------- |
| 0     | Kill switch and config | `RECOGNITION_DISABLED=1`, a missing key, or missing limiter config refuses immediately |
| 1     | Origin                 | The `Origin` host must match the serving host                                          |
| 2     | Type and declared size | JPEG, PNG or WebP only; declared length at most 4 MB                                   |
| 3     | Identity limits        | Sliding windows of 30 per device and 60 per IP per hour                                |
| 4     | Read the body          | Streamed with a hard 4 MB cap, then a magic-byte check                                 |
| 5     | **Global cap**         | Daily cap across all callers, default 1,000                                            |
| 6     | Model call             | 20 s budget, one retry, output capped at 1,024 tokens                                  |
| 7     | Validate and log       | Zod re-validation; one metadata-only log line                                          |

The global cap is counted last. If it were counted first, one abusive device could burn the day's budget on requests the device limit would have refused anyway. Counting last means the shared budget is spent only by requests that were going to reach the model.

The pipeline fails closed. If the counter store is down, the route returns `unavailable` instead of spending without limits. In production, missing Upstash configuration refuses to start, because an in-memory limiter is per-instance and would let each serverless instance spend its own budget. A malformed `RECOGNITION_DAILY_CAP` makes the limiter refuse to build, so a typo cannot silently raise the cap.

## Alternatives considered

- **No rate limit.** A retry-loop bug or a script becomes a surprise bill.
- **In-memory counters.** They do not work across serverless instances.
- **Counting the global cap first.** One abuser can exhaust everyone's budget with refused requests.
- **Failing open when Redis is down.** Spend becomes unbounded exactly when monitoring is weakest.

## Consequences

- Worst-case spend is bounded: `min(per-identity limits x callers, global cap) x cost per call`, with at most two model calls per request.
- With no accounts, identity is a forgeable claim, so the global cap is the one control an attacker cannot route around. It turns an unbounded bill into a bounded outage.
- That outage is survivable by design. When the cap is hit the client shows the same manual-entry message as any other recognition failure, so games continue.
- An attacker with many IPs and device ids can still reach the cap and lock real players out of recognition for the rest of the day. This is accepted, and raising the cap is a configuration change.
- Rate-limit counters need an external store (Upstash Redis).
