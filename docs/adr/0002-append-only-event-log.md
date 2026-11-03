# 0002. The game is an append-only event log

Status: Accepted

## Context

A game is a sequence of things that happened. Tables dispute and correct: someone mis-taps, someone remembers a flower, the app disagrees with the physical table. Correcting one hand can change every later hand, because the dealer and wind depend on earlier results. Disputes need an audit trail.

## Decision

The record of a game is a list of versioned events in Dexie (IndexedDB). Events are appended, never edited or deleted. Undo and edit are themselves events (`HandVoided`, `HandCorrected`) that reference the original. Manual dealer or wind fixes are `StateOverridden` events. Game state is a pure function of the log: `replay(events)` removes voided hands, swaps in corrections, and folds the result through a pure reducer.

Ordering uses a per-game sequence number (`seq`), part of the table's compound primary key `[gameId+seq]`. Timestamps are display-only because phone clocks are unreliable.

## Alternatives considered

- **Current state in `localStorage`.** About 5 MB, synchronous, strings only, and no history.
- **A mutable `hands` table.** Loses the audit trail, and editing one row can silently change everything after it.
- **SQLite in WebAssembly.** Heavier than the problem needs.
- **Raw IndexedDB.** Verbose and untyped; Dexie gives a typed API and versioned migrations.

## Consequences

- Mistakes become data, not damage. A correction keeps both the original and the fix.
- History edits are safe: after any change the answer is "replay". A preview of an edit replays the log with a hypothetical event appended, so the warning shown before an edit cannot disagree with the result after it.
- Sync later means shipping events, not merging state.
- Each append is a single IndexedDB transaction, so a crash can lose at most the action in flight.
- Reads cost a replay. A full game is around 100 events, so this is negligible today. Snapshots would be needed if logs grew by orders of magnitude.
