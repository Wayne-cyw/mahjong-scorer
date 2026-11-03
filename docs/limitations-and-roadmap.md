# Limitations and roadmap

An honest account of what is unfinished, what is known to be weak, and what comes next.

## Known limitations

| Limitation                                                               | Why it exists                                                                                | Mitigation                                                                                                                              |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| One phone is the scorekeeper; no live scoreboard on other devices        | Local-first design ([ADR 0001](adr/0001-local-first-stateless-server.md))                    | The event log makes sync a matter of shipping events later                                                                              |
| Data lives in one browser's storage; a cleared or lost phone loses games | No accounts and no server copy                                                               | Persistent-storage request, Home Screen install nudge, one-tap JSON backup                                                              |
| Hong Kong rules only                                                     | Scoring is built around 14-tile hands and fan                                                | House rules are data ([ADR 0006](adr/0006-scoring-engine-readings-and-rules-as-data.md)); a different game would need a code-level seam |
| Recognition accuracy is unmeasured on real photos                        | The labelled photo set has not been collected                                                | A player always confirms tiles; manual entry always works                                                                               |
| Recognition can be locked out for the day if the global cap is hit       | Spend is bounded over availability ([ADR 0008](adr/0008-recognition-request-pipeline.md))    | The cap is configuration, and the manual picker keeps play going                                                                        |
| Scripts allow `'unsafe-inline'` in the CSP                               | Static pages are needed for offline caching ([ADR 0010](adr/0010-static-csp-for-offline.md)) | Rest of the policy locked to same origin; raw HTML banned by lint                                                                       |
| 50 golden hands against a target of 150                                  | Work in progress                                                                             | New scoring bugs each add a case                                                                                                        |
| No replay or re-score benchmarks                                         | Not written yet                                                                              | Replay is expected to be negligible at roughly 100 events per game                                                                      |
| No daily spend rollup or alerts                                          | Not built                                                                                    | Per-request token logging exists; a monthly provider spend limit is set in the provider console                                         |

## Roadmap

- [x] Photo-to-score loop with manual fallback
- [x] Full-game tracking, history edits, backup and restore
- [x] Global spend cap, kill switch and secret scanning
- [ ] Run the recognition eval on a real labelled photo set and pick the cheapest model that reaches 97% per tile
- [ ] Grow the golden-hand suite toward 150 veteran-reviewed cases
- [ ] Add replay and re-score performance benchmarks
- [ ] Daily spend rollup and alerts
- [ ] Canned recognition sample for a zero-cost public demo
- [ ] On-device tile detection, falling back to the API only when unsure
- [ ] Other rulesets, which need a variant seam for hand size, scoring unit and dealer-streak bonuses
- [ ] Multi-device sync and accounts

## Open questions

- Which exact house rules should the default preset carry: minimum fan, cap, points table and payment model?
- For sync, should sequence numbers be assigned by a server or by per-device ranges?
- Should concealed kongs, usually shown with two tiles face down, always be entered by hand?
