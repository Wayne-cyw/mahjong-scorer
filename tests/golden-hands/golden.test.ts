import { describe, expect, it } from 'vitest';
import { getPreset, scoreHand } from '@/lib/scoring';
import { HK_RULES } from '@/lib/scoring';
import { GOLDEN_HANDS } from './hands';

describe('golden hands', () => {
  it('has at least 40 entries', () => {
    expect(GOLDEN_HANDS.length).toBeGreaterThanOrEqual(40);
  });

  it('covers every fan rule id', () => {
    const covered = new Set(GOLDEN_HANDS.flatMap((g) => (g.expect.lines ?? []).map(([id]) => id)));
    const missing = HK_RULES.map((r) => r.id).filter((id) => !covered.has(id));
    expect(missing).toEqual([]);
  });

  it.each(GOLDEN_HANDS.map((g) => [g.name, g] as const))('%s', (_name, g) => {
    const preset = { ...getPreset(g.preset ?? 'hk-discarder-pays'), ...g.overrides };
    const r = scoreHand(g.hand, g.ctx, preset);

    expect(r.valid).toBe(g.expect.valid);
    if (g.expect.reason !== undefined) expect(r.reason).toBe(g.expect.reason);
    if (g.expect.fan !== undefined) expect(r.fan).toBe(g.expect.fan);
    if (g.expect.scoredFan !== undefined) expect(r.scoredFan).toBe(g.expect.scoredFan);
    if (g.expect.lines) {
      expect(r.breakdown.map((l) => [l.ruleId, l.fan])).toEqual(g.expect.lines);
    }
    if (g.expect.payments) expect(r.payments).toEqual(g.expect.payments);
    expect(r.payments.reduce((a, b) => a + b, 0)).toBe(0);
  });
});
