# Recognition evaluation

Measures how well the model reads hand photos, using the same call `/api/recognize` makes.
Run it on every prompt or model change (ADR-48). It gates Phase 3: **97% per-tile accuracy**.

## Set up

1. Put labelled photos in `tests/recognition-eval/photos/` (gitignored; photos are never committed).
   Aim for at least 200 photos covering at least 5 physical tile sets and several lighting
   conditions (bright, dim, warm).
2. Add `tests/recognition-eval/photos/labels.json`. Copy `labels.example.json` and list, for each
   photo, the tiles actually in it:

   ```json
   {
     "file": "set-a-bright-01.jpg",
     "set": "set-a",
     "lighting": "bright",
     "concealed": ["m1", "m2", "m3"],
     "melds": [["z1", "z1", "z1"]],
     "bonus": ["f1"]
   }
   ```

   Tile codes: `m1-m9` characters, `p1-p9` dots, `s1-s9` bamboo, `z1-z4` winds (E S W N),
   `z5-z7` white, green, red dragons, `f1-f8` flowers and seasons. `set` and `lighting` are
   optional tags used only for the per-group breakdown.

3. Export `GEMINI_API_KEY` in your shell. Use a key with its own low spend limit, not the production one.

## Run

```bash
pnpm eval --input-price <usd per M> --output-price <usd per M>
pnpm eval --model gemini-3.8-flash --input-price <p> --output-price <p>
pnpm eval --max-edge 2048 ...  # test the larger-image question from the design doc
pnpm eval --limit 20 ...       # quick smoke run, cheapest way to check a change
```

| Flag             | Default                                    | Meaning                                            |
| ---------------- | ------------------------------------------ | -------------------------------------------------- |
| `--model`        | `$RECOGNITION_MODEL` or `gemini-3.8-flash` | Model to evaluate                                  |
| `--dir`          | `tests/recognition-eval/photos`            | Folder holding the photos                          |
| `--labels`       | `<dir>/labels.json`                        | Labels file                                        |
| `--max-edge`     | `1568`                                     | Long edge in px after resize (the phone uses 1568) |
| `--input-price`  | required                                   | US dollars per million input tokens, for cost      |
| `--output-price` | required                                   | US dollars per million output tokens, for cost     |
| `--limit`        | all                                        | Only run the first N labelled photos               |

Photos are resized the way the phone does (orientation fixed, 1568 px long edge, JPEG 0.85,
metadata dropped) before they are sent. Nothing is written to disk.

## What it reports

- **Per-tile accuracy**: matched tiles over the larger of tiles expected and tiles read, summed
  across photos. A photo that fails to read counts every expected tile as wrong. Which row or
  meld group a tile was reported in is not scored, because the review screen lets the player fix
  grouping; tile identity is what decides whether they retype anything.
- **Zero-correction rate**: share of photos where no tile had to be changed.
- **Latency p50 / p95** per photo the model answered, one request at a time, so it reflects a
  single player. Failed photos are left out (an instant error would flatter the percentiles, a
  timeout would inflate them) and are listed separately.
- **Cost per hand**: estimated from token usage and the prices you pass. There are no defaults, so a
  stale list price cannot silently misreport cost; copy them from Google's current pricing page.
  Output tokens include thinking tokens, which are billed as output. Failed requests report no usage and are left
  out of the average.
- A breakdown by `set` and by `lighting`, and the list of failed photos.

The Phase 3 gate also needs a 10 s p95 round trip and a 15 s median per hand in table tests;
this script measures model latency only, not the full phone-to-route round trip.

## Exit codes

`0` ran to completion (even if some photos failed; they are listed). Exit 0 does not mean the
97% gate passed: read the accuracy line. `2` could not start: no
photo folder, no `labels.json`, a `labels.json` that is not valid JSON or lists a photo twice, a
bad flag value, a missing `--input-price` or `--output-price`, or no `GEMINI_API_KEY`. The message says what is missing. `1` the run stopped
early or hit an unexpected error: after 5 photos in a row fail with `upstream` (usually a rate
limit, an invalid key or an outage) it stops and reports what it has.
