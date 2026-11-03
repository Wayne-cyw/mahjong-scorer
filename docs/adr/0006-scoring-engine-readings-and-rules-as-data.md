# 0006. The scoring engine enumerates readings and treats rules as data

Status: Accepted

## Context

A winning hand can often be read more than one way, and Hong Kong tables disagree on minimum fan, caps and who pays. A greedy parser misreads ambiguous hands, and hard-coded rules force a rewrite for every house variation.

## Decision

- **Enumerate and maximise.** `scoreHand` validates the hand, generates every valid reading (including seven pairs when allowed, and thirteen orphans), scores each against the fan rules, and keeps the reading with the highest fan.
- **Rules are data.** Each fan rule is an object with an `applies` function and an `excludes` list. The engine evaluates rules in a fixed order, removes excluded rules, collapses limit hands to the cap once, and falls back to "chicken hand" at 0 fan when nothing matches.
- **Presets are versioned data copied into the game.** A `Ruleset` (minimum fan, cap, points table, payment model, seven pairs, flowers, draw behaviour) is embedded in `GameCreated`, so editing a preset later never changes games already played. Three presets ship: discarder pays (default), all pay, and casual.
- **Integers and a zero-sum check.** Points are integers, and payments are asserted to sum to zero.
- **Bad hands are results, not exceptions.** Invalid hands return `valid: false` with a reason (`too-many-copies`, `wrong-tile-count`, `not-a-winning-hand`, `below-minimum`). The engine throws only on programmer errors.
- **Below minimum still explains itself.** A hand under the minimum returns `valid: false` but still carries its breakdown and fan, so the review screen can show "2 fan, minimum 3".

## Alternatives considered

- **Greedy parsing.** Misreads ambiguous hands.
- **Rules hard-coded per ruleset.** A rewrite per house rule.
- **Floating-point points.** Rounding disputes.

## Consequences

- Ambiguity is handled correctly: `m1m1m1 m2m2m2 m3m3m3` is three pungs or three chows, and they score differently. Only trying every reading and taking the maximum is right.
- Copying the preset into the game freezes the rules a game was played under.
- The review screen can re-score on every tap and show the reason inline, without try/catch.
- Zero-sum payments act as a free correctness oracle for broken points tables.
- Enumerating readings costs more than a single pass, and rules as data are slightly more indirect to read than a plain `if`.
- Data covers variation within Hong Kong. A structurally different game, such as Taiwanese mahjong with 17-tile hands, would need a code-level seam, not just more data.
