# 0003. Store the computed result, not only the inputs

Status: Accepted

## Context

A `HandWon` event could store just the tiles and recompute fan and payments on every load. That is smaller and always current. But scoring rules have bugs, and a table cares about the score it actually agreed to and settled.

## Decision

A won hand stores its tiles (when photographed or entered), the fan, the line-by-line breakdown, the per-seat payments and the `engineVersion` that produced them. A hand entered as a bare fan total has no tiles, is flagged `manual`, and is stamped `engineVersion: 'manual'`. The event schema requires four integer payments that sum to exactly zero.

## Alternatives considered

- **Recompute on load.** Shipping a rule fix would silently rewrite history that players already settled.
- **Store only the total.** Loses the "show the math" principle.

## Consequences

- Fixing a scoring bug never changes past games. Rescoring is an explicit action, expressed as a `HandCorrected` event.
- Any disputed number traces to the exact engine version that produced it.
- Manual entry is first class. A veteran who says "five fan" does not have to enter fourteen tiles, and the hand is honestly marked as not engine-scored.
- A bad payment set cannot be stored, because the schema rejects it.
- Events are larger, and the fan is deliberately duplicated: it can be derived from the tiles and is also stored. The stored copy is what was agreed.
