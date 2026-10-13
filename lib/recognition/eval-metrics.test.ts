import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  estimateCost,
  groupSummaries,
  labelsSchema,
  matchTiles,
  percentile,
  summarize,
  type PhotoOutcome,
} from './eval-metrics';

const hand = {
  concealed: ['m1', 'm2', 'm3', 'p4', 'p5', 'p6', 's7', 's8', 's9', 'z5', 'z5'] as const,
  melds: [['z1', 'z1', 'z1']],
  bonus: ['f1'] as const,
};

describe('matchTiles', () => {
  it('matches a perfect reading', () => {
    const m = matchTiles(hand, {
      concealed: [...hand.concealed],
      melds: hand.melds,
      bonus: [...hand.bonus],
    });
    expect(m).toEqual({ expected: 15, got: 15, matched: 15, exact: true });
  });

  it('ignores which row or group a tile was reported in', () => {
    const m = matchTiles(
      { concealed: ['m1', 'm1', 'm1'], melds: [], bonus: [] },
      { concealed: [], melds: [['m1', 'm1', 'm1']], bonus: [] },
    );
    expect(m.exact).toBe(true);
  });

  it('counts a misread tile as unmatched on both sides', () => {
    const m = matchTiles(
      { concealed: ['m1', 'm2', 'm3'], melds: [], bonus: [] },
      { concealed: ['m1', 'm2', 'm4'], melds: [], bonus: [] },
    );
    expect(m).toEqual({ expected: 3, got: 3, matched: 2, exact: false });
  });

  it('penalises extra and missing tiles', () => {
    const extra = matchTiles(
      { concealed: ['m1'], melds: [], bonus: [] },
      { concealed: ['m1', 'm1'], melds: [], bonus: [] },
    );
    expect(extra).toMatchObject({ expected: 1, got: 2, matched: 1, exact: false });
    const missing = matchTiles(
      { concealed: ['m1', 'm2'], melds: [], bonus: [] },
      { concealed: ['m1'], melds: [], bonus: [] },
    );
    expect(missing).toMatchObject({ expected: 2, got: 1, matched: 1, exact: false });
  });
});

describe('percentile', () => {
  it('uses the nearest rank', () => {
    const v = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(v, 50)).toBe(50);
    expect(percentile(v, 95)).toBe(100);
    expect(percentile([7], 95)).toBe(7);
  });

  it('does not depend on input order and handles empty input', () => {
    expect(percentile([3, 1, 2], 50)).toBe(2);
    expect(percentile([], 50)).toBeNaN();
  });
});

describe('estimateCost', () => {
  it('prices tokens per million', () => {
    expect(estimateCost(1_000_000, 100_000, { input: 1, output: 5 })).toBeCloseTo(1.5);
    expect(estimateCost(1600, 90, { input: 1, output: 5 })).toBeCloseTo(0.00205);
  });
});

const ok = (over: Partial<Extract<PhotoOutcome, { ok: true }>> = {}): PhotoOutcome => ({
  ok: true,
  file: 'a.jpg',
  expected: 14,
  got: 14,
  matched: 14,
  exact: true,
  latencyMs: 1000,
  inputTokens: 1600,
  outputTokens: 90,
  ...over,
});

describe('summarize', () => {
  const prices = { input: 1, output: 5 };

  it('reports per-tile accuracy over every expected tile, zero-correction rate and latency', () => {
    const s = summarize(
      [
        ok({ latencyMs: 800 }),
        ok({ matched: 12, exact: false, latencyMs: 1200 }),
        ok({ latencyMs: 4000 }),
        ok({ latencyMs: 900 }),
      ],
      prices,
    );
    expect(s.photos).toBe(4);
    expect(s.failures).toEqual([]);
    expect(s.tileAccuracy).toBeCloseTo(54 / 56);
    expect(s.zeroCorrectionRate).toBeCloseTo(0.75);
    expect(s.latencyP50).toBe(900);
    expect(s.latencyP95).toBe(4000);
  });

  it('counts a failed photo as all its tiles wrong and lists the failure', () => {
    const s = summarize(
      [ok(), { ok: false, file: 'bad.jpg', expected: 14, latencyMs: 20000, error: 'timeout' }],
      prices,
    );
    expect(s.tileAccuracy).toBeCloseTo(14 / 28);
    expect(s.zeroCorrectionRate).toBeCloseTo(0.5);
    expect(s.failures).toEqual([{ file: 'bad.jpg', error: 'timeout' }]);
  });

  it('averages cost over photos that report token usage', () => {
    const s = summarize([ok(), ok({ inputTokens: 2400, outputTokens: 110 })], prices);
    expect(s.costPerHand).toBeCloseTo((0.00205 + 0.00295) / 2);
  });

  it('leaves failed photos out of the latency percentiles', () => {
    const s = summarize(
      [
        ok({ latencyMs: 2000 }),
        ok({ latencyMs: 3000 }),
        {
          ok: false,
          file: 'missing.jpg',
          expected: 14,
          latencyMs: 1,
          error: 'photo file not found',
        },
        { ok: false, file: 'slow.jpg', expected: 14, latencyMs: 20000, error: 'timeout' },
      ],
      prices,
    );
    expect(s.latencyP50).toBe(2000);
    expect(s.latencyP95).toBe(3000);
    expect(s.failures).toHaveLength(2);
  });

  it('is well-defined with no photos', () => {
    const s = summarize([], prices);
    expect(s.photos).toBe(0);
    expect(s.tileAccuracy).toBeNaN();
  });
});

describe('groupSummaries', () => {
  it('summarises per tag so tile sets and lighting can be compared', () => {
    const outcomes = [
      { tags: { set: 'A', lighting: 'bright' }, outcome: ok() },
      { tags: { set: 'A', lighting: 'dim' }, outcome: ok({ matched: 13, exact: false }) },
      { tags: { set: 'B', lighting: 'bright' }, outcome: ok() },
    ];
    const bySet = groupSummaries(outcomes, 'set', { input: 1, output: 5 });
    expect([...bySet.keys()].sort()).toEqual(['A', 'B']);
    expect(bySet.get('A')?.photos).toBe(2);
    expect(bySet.get('A')?.tileAccuracy).toBeCloseTo(27 / 28);
    expect(bySet.get('B')?.tileAccuracy).toBe(1);
  });

  it('files untagged photos under "(untagged)"', () => {
    const g = groupSummaries([{ tags: {}, outcome: ok() }], 'set', { input: 1, output: 5 });
    expect([...g.keys()]).toEqual(['(untagged)']);
  });
});

describe('labelsSchema', () => {
  it('accepts the shipped example file', () => {
    const raw = JSON.parse(
      readFileSync(
        new URL('../../tests/recognition-eval/labels.example.json', import.meta.url),
        'utf8',
      ),
    );
    expect(labelsSchema.safeParse(raw).success).toBe(true);
  });

  it('rejects a photo listed twice', () => {
    const entry = { file: 'a.jpg', concealed: [], melds: [], bonus: [] };
    const r = labelsSchema.safeParse([entry, { ...entry }]);
    expect(r.success).toBe(false);
    expect(r.error?.message).toMatch(/Duplicate entry for a\.jpg/);
  });

  it('rejects unknown tile codes and a missing file name', () => {
    expect(
      labelsSchema.safeParse([{ file: 'a.jpg', concealed: ['x1'], melds: [], bonus: [] }]).success,
    ).toBe(false);
    expect(labelsSchema.safeParse([{ concealed: [], melds: [], bonus: [] }]).success).toBe(false);
  });
});
