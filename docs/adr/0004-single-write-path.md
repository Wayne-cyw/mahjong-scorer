# 0004. One write path with optimistic concurrency

Status: Accepted

## Context

Anything that can append to the log can corrupt a game. Two browser tabs on the same game are a realistic hazard, and so is a stale screen: a player taps Confirm on a state that has already moved on.

## Decision

Exactly one place calls `appendEvent`: the Zustand game store. Components never touch Dexie. Every write action runs through one `commit(plan)` pattern:

1. A **plan** is a pure function from current state to either an event payload or a refusal reason. Guards live here.
2. The store appends with the `seq` it expects next.
3. In a single IndexedDB transaction, `appendEvent` compares that to the highest stored `seq`. A mismatch throws `DuplicateSeqError` without writing, and the compound primary key is a last-line backstop.
4. On conflict, the store reloads the log, replays it, **re-runs the plan's guard against fresh state**, and retries up to three times, or refuses.
5. After a durable append it derives state and emits analytics. The denormalized `games` status row is synced last and is best-effort.

## Alternatives considered

- **Components write directly.** Many writers, many bugs.
- **A cross-tab lock.** Complex and browser-fragile.
- **Last write wins.** Silently forks the game.

## Consequences

- One path means one place to validate, test and review. "Only store actions write events" is mechanical to check.
- Re-running the guard on conflict matters: retrying the same payload against fresh state could append something now invalid, such as a win recorded after another tab ended the game.
- The UI updates only after the commit, so what the screen shows is what is durable.
- Side effects are ordered by importance. A failed `games` row sync is logged and swallowed, because the log and screen are already correct.
- More ceremony per action than a plain `set()`.
