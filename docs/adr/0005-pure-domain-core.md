# 0005. A pure domain core, enforced by the linter

Status: Accepted

## Context

The scoring engine, rotation rules and dice are the product's value and its biggest risk. Frameworks, storage and UI change often. The rules of mahjong do not. The code is also changed by several agents in parallel, so conventions that rely on everyone remembering them will erode.

## Decision

`lib/tiles`, `lib/scoring` and `lib/game` are plain TypeScript with no imports from React, Next.js, Dexie, Zustand, the network, or the UI, store and storage layers. ESLint's `no-restricted-imports` fails the build if any appear. `react/no-danger` is also an error.

```
components/  ->  stores/  ->  lib/db           (I/O and framework: replaceable)
                    |
                    +------>  lib/game, lib/scoring, lib/tiles   (pure: the valuable part)
```

## Alternatives considered

- **Scoring inside React components.** Untestable and tied to the UI.
- **A third-party mahjong library.** Hong Kong rules and this event model are specific, and owning the riskiest logic is the point.

## Consequences

- The riskiest logic can be tested exhaustively, with property tests, in milliseconds and with no environment.
- The same core could run in a native app or on a server without a rewrite.
- A lint failure survives deadlines in a way a written convention does not.
- Two shapes of data sometimes exist (domain types versus storage or UI shapes), with a thin adapter between them.
