# Golden hands

Hand-verified scoring cases for the Hong Kong preset. `hands.ts` holds the data and `golden.test.ts` runs it.

- Derive every expected value by hand from the rules table in the engineering design. Never paste engine output into `expect`.
- Every scoring bug or rule change adds a golden hand in the same PR (ADR-61, ADR-78).
- The release goal is 150 veteran-reviewed hands; the file starts with the cases needed to cover every rule id, every exclusion, the cap, the minimum and both payment models.
- When a golden hand fails, decide whether the test data or the engine is wrong and note which in the commit body.
