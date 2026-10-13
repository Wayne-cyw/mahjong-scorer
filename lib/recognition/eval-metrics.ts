import { z } from 'zod';
import { bonusSchema, tileSchema } from '@/lib/tiles';

/** One entry of `labels.json`: the tiles actually in a photo, plus optional tags for grouping. */
export const labelsSchema = z.array(
  z.object({
    file: z.string().min(1),
    set: z.string().optional(), // which physical tile set, to check coverage across sets
    lighting: z.string().optional(), // e.g. bright, dim, warm
    concealed: z.array(tileSchema),
    melds: z.array(z.array(tileSchema)),
    bonus: z.array(bonusSchema),
  }),
);

export type Label = z.infer<typeof labelsSchema>[number];

interface TileHand {
  concealed: readonly string[];
  melds: readonly (readonly string[])[];
  bonus: readonly string[];
}

const flatten = (h: TileHand): string[] => [...h.concealed, ...h.melds.flat(), ...h.bonus];

export interface TileMatch {
  expected: number;
  got: number;
  /** Tiles present in both, counted as a multiset. */
  matched: number;
  /** Nothing missing, nothing extra: the player would not have to change a tile. */
  exact: boolean;
}

/**
 * Compares a reading with the label as a multiset of tiles. Which row or meld group a tile was
 * reported in is not scored: the review screen lets the player fix grouping, and it is the tile
 * identity that decides whether they have to retype anything.
 */
export function matchTiles(expected: TileHand, got: TileHand): TileMatch {
  const want = new Map<string, number>();
  for (const t of flatten(expected)) want.set(t, (want.get(t) ?? 0) + 1);
  let matched = 0;
  const gotTiles = flatten(got);
  for (const t of gotTiles) {
    const left = want.get(t) ?? 0;
    if (left > 0) {
      matched += 1;
      want.set(t, left - 1);
    }
  }
  const expectedCount = flatten(expected).length;
  return {
    expected: expectedCount,
    got: gotTiles.length,
    matched,
    exact: matched === expectedCount && gotTiles.length === expectedCount,
  };
}

/** Nearest-rank percentile; NaN for an empty list. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] ?? Number.NaN;
}

export interface Prices {
  /** US dollars per million input tokens. */
  input: number;
  /** US dollars per million output tokens. */
  output: number;
}

export const estimateCost = (inputTokens: number, outputTokens: number, prices: Prices): number =>
  (inputTokens * prices.input + outputTokens * prices.output) / 1_000_000;

export type PhotoOutcome =
  | ({
      ok: true;
      file: string;
      latencyMs: number;
      inputTokens: number;
      outputTokens: number;
    } & TileMatch)
  | { ok: false; file: string; expected: number; latencyMs: number; error: string };

export interface Summary {
  photos: number;
  /** Matched tiles over the larger of expected and read tiles, summed across photos. */
  tileAccuracy: number;
  /** Share of photos where no tile had to be changed. */
  zeroCorrectionRate: number;
  latencyP50: number;
  latencyP95: number;
  /** Average estimated cost in US dollars over photos that report token usage. */
  costPerHand: number;
  failures: { file: string; error: string }[];
}

export function summarize(outcomes: readonly PhotoOutcome[], prices: Prices): Summary {
  let matched = 0;
  let denominator = 0;
  let exact = 0;
  const costs: number[] = [];
  const failures: Summary['failures'] = [];
  for (const o of outcomes) {
    if (o.ok) {
      matched += o.matched;
      denominator += Math.max(o.expected, o.got);
      if (o.exact) exact += 1;
      costs.push(estimateCost(o.inputTokens, o.outputTokens, prices));
    } else {
      // A photo that could not be read counts every expected tile as wrong.
      denominator += o.expected;
      failures.push({ file: o.file, error: o.error });
    }
  }
  const latencies = outcomes.map((o) => o.latencyMs);
  return {
    photos: outcomes.length,
    tileAccuracy: denominator === 0 ? Number.NaN : matched / denominator,
    zeroCorrectionRate: outcomes.length === 0 ? Number.NaN : exact / outcomes.length,
    latencyP50: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    costPerHand: costs.length === 0 ? Number.NaN : costs.reduce((a, b) => a + b, 0) / costs.length,
    failures,
  };
}

/** One summary per value of a tag (tile set, lighting), so coverage gaps show up. */
export function groupSummaries(
  items: readonly { tags: { set?: string; lighting?: string }; outcome: PhotoOutcome }[],
  by: 'set' | 'lighting',
  prices: Prices,
): Map<string, Summary> {
  const groups = new Map<string, PhotoOutcome[]>();
  for (const { tags, outcome } of items) {
    const key = tags[by] ?? '(untagged)';
    groups.set(key, [...(groups.get(key) ?? []), outcome]);
  }
  return new Map([...groups].map(([key, outcomes]) => [key, summarize(outcomes, prices)]));
}
