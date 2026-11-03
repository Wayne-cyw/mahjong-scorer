# Testing

Test effort follows risk. A wrong score destroys a table's trust, so the scoring engine gets the most rigour. A slightly late animation does not.

## Layers

| Layer            | Tool                                         | What it covers                                                                                                           |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Unit tests       | Vitest                                       | Tiles, scoring, payments, reducer, dice, seats, history, repository, backup, recognition validation, analytics scrubbing |
| Golden hands     | Vitest, `tests/golden-hands/`                | 50 hand-verified scoring cases as plain data                                                                             |
| Property tests   | fast-check, `lib/scoring/properties.test.ts` | Invariants over generated hands                                                                                          |
| End to end       | Playwright, `tests/e2e/`                     | Full game, scoring and camera flows on mobile viewports with the network mocked                                          |
| Recognition eval | `pnpm eval`, `tests/recognition-eval/`       | Per-tile accuracy of the real model on labelled photos                                                                   |

## Golden hands

Each case in `hands.ts` names a hand, the seat context and the expected fan lines and payments. The expected values are worked out by hand from the rules table, never pasted from engine output. A scoring change or bug fix must add a golden hand in the same pull request. When one fails, the author decides whether the data or the engine is wrong and records which in the commit body.

## Property tests

Properties assert what must hold for every hand, not just chosen examples:

- Payments always sum to exactly zero.
- Fan never exceeds the ruleset's cap.
- Reordering the tiles never changes the result.
- A fifth copy of a tile is always rejected.

## Coverage

Coverage is measured over `lib/tiles`, `lib/scoring` and `lib/game` with a 95% branch threshold (`pnpm test:coverage`). The same bar on UI styling would be wasted effort, which is why the threshold targets the pure core.

## End to end

Playwright runs against Chromium and WebKit on mobile viewports. Recognition is mocked at the network layer, so the suite never calls a paid API and never depends on the model.

## Recognition eval

The eval calls the same code path as `/api/recognize` against labelled photos in `tests/recognition-eval/photos/` (gitignored, never committed). The target is 97% per-tile accuracy. It runs on demand and on prompt or model changes, not on every pull request, because it costs money and takes minutes. The script requires explicit prices, stops at a default $0.50 of spend, rejects label files that escape the photos folder, and counts billed-but-failed calls toward the cap. See `tests/recognition-eval/README.md`.

## What gates a merge

The **verify gate** must be green before anything is committed:

```bash
pnpm lint
pnpm typecheck
pnpm format:check
pnpm test
pnpm build
```

CI (`.github/workflows/ci.yml`) runs lint, type-check, unit tests, a production dependency audit, the build, the post-build secret check and the Playwright suite. Separate jobs scan git history with gitleaks and build the Docker image, which is never deployed but proves the app can leave its host without a rewrite.

Bundle size (`.size-limit.json`, 170 KB gzipped) and Lighthouse (`lighthouserc.json`) budgets are configured in the repository.
