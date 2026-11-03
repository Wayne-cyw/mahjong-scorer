# Architecture decision records

Each record captures one significant decision: the pressure that forced it, what was chosen, what was rejected, and what the choice costs. Records are numbered in the order they were written. If a decision is reversed, the old record stays and is marked superseded by the new one.

| #                                                         | Decision                                                                             | Status   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| [0001](0001-local-first-stateless-server.md)              | The phone is the application; the server is a stateless proxy                        | Accepted |
| [0002](0002-append-only-event-log.md)                     | The game is an append-only event log                                                 | Accepted |
| [0003](0003-store-computed-results.md)                    | Store the computed result, not only the inputs                                       | Accepted |
| [0004](0004-single-write-path.md)                         | One write path with optimistic concurrency                                           | Accepted |
| [0005](0005-pure-domain-core.md)                          | A pure domain core, enforced by the linter                                           | Accepted |
| [0006](0006-scoring-engine-readings-and-rules-as-data.md) | The scoring engine enumerates readings and treats rules as data                      | Accepted |
| [0007](0007-recognition-is-untrusted-and-advisory.md)     | Recognition is an untrusted, stateless, advisory subsystem                           | Accepted |
| [0008](0008-recognition-request-pipeline.md)              | Order the request pipeline so cheap checks run first and shared budget is spent last | Accepted |
| [0009](0009-service-worker-never-interrupts-a-hand.md)    | The service worker never interrupts a hand                                           | Accepted |
| [0010](0010-static-csp-for-offline.md)                    | A static CSP, trading `unsafe-inline` for offline caching                            | Accepted |

## Template

```markdown
# NNNN. Title

Status: Accepted | Proposed | Superseded by NNNN

## Context

The force or constraint that made a decision necessary.

## Decision

What was chosen.

## Alternatives considered

What else was on the table and why it lost.

## Consequences

What this makes easier, and what it costs.
```
