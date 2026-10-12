import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { chow, hand, kong, pung, tiles } from './hand-test-utils';
import { enumerateReadings } from './readings';
import type { Reading } from './types';

const opts = { sevenPairsAllowed: false };
const standard = (rs: Reading[]) =>
  rs.filter((r): r is Extract<Reading, { sets: unknown }> => 'sets' in r);
const kinds = (r: Extract<Reading, { sets: unknown }>) =>
  r.sets
    .map((s) => s.kind)
    .sort()
    .join(',');

describe('enumerateReadings', () => {
  it('returns both the three-pungs and the three-chows reading', () => {
    const h = hand('m1m1m1m2m2m2m3m3m3p5p6p7z1z1');
    const rs = standard(enumerateReadings(h, opts));
    const shapes = rs.map(kinds).sort();
    expect(shapes).toContain('chow,chow,chow,chow');
    expect(shapes).toContain('chow,pung,pung,pung');
    expect(rs).toHaveLength(2);
  });

  it('finds a single reading for an unambiguous hand', () => {
    const rs = enumerateReadings(hand('m1m2m3p4p5p6s7s8s9z5z5z5z1z1'), opts);
    expect(rs).toHaveLength(1);
    const r = rs[0];
    expect(r && 'sets' in r && r.pair).toBe('z1');
  });

  it('keeps declared melds fixed and exposed', () => {
    const h = hand('m1m2m3p4p5p6z1z1', { melds: [pung('z5z5z5', true), chow('s1s2s3', true)] });
    const rs = standard(enumerateReadings(h, opts));
    expect(rs).toHaveLength(1);
    const exposed = rs[0]?.sets.filter((s) => s.exposed) ?? [];
    expect(exposed).toHaveLength(2);
  });

  it('accepts a kong as a fixed set', () => {
    const h = hand('m1m2m3p4p5p6z1z1', { melds: [kong('z5z5z5z5'), chow('s1s2s3')] });
    expect(enumerateReadings(h, opts)).toHaveLength(1);
  });

  it('never builds chows across suits or through honours', () => {
    expect(enumerateReadings(hand('m8m9z1z2z3p1p2p3s1s2s3z5z5z6'), opts)).toEqual([]);
    expect(enumerateReadings(hand('m9p1p2p3s1s2s3z5z5z5m1m1m1z1'), opts)).toEqual([]);
  });

  it('recognises thirteen orphans with each duplicate', () => {
    const base = 'm1m9p1p9s1s9z1z2z3z4z5z6z7';
    for (const dup of tiles(base)) {
      const rs = enumerateReadings(hand(base + dup), opts);
      expect(rs).toEqual([{ special: 'thirteen-orphans' }]);
    }
  });

  it('only reads seven pairs when allowed', () => {
    const h = hand('m1m1m2m2p3p3p4p4s5s5z1z1z5z5');
    expect(enumerateReadings(h, { sevenPairsAllowed: false })).toEqual([]);
    expect(enumerateReadings(h, { sevenPairsAllowed: true })).toEqual([{ special: 'seven-pairs' }]);
  });

  it('does not treat four of a kind as two pairs of seven pairs', () => {
    const h = hand('m1m1m1m1p3p3p4p4s5s5z1z1z5z5');
    expect(enumerateReadings(h, { sevenPairsAllowed: true })).toEqual([]);
  });

  it('returns [] for a non-winning hand', () => {
    expect(enumerateReadings(hand('m1m3m5p2p4p6s1s3s5z1z2z3z4z5'), opts)).toEqual([]);
  });

  it('finds the chow reading of a same-suit run', () => {
    const rs = standard(enumerateReadings(hand('m1m2m3m4m5m6m7m8m9p2p3p4z1z1'), opts));
    expect(rs).toHaveLength(1);
    expect(rs[0]?.sets.map((s) => s.kind)).toEqual(['chow', 'chow', 'chow', 'chow']);
  });

  it('is independent of concealed tile order', () => {
    const base = tiles('m1m1m1m2m2m2m3m3m3p5p6p7z1z1');
    const reference = JSON.stringify(enumerateReadings(hand(base.join('')), opts));
    fc.assert(
      fc.property(
        fc.shuffledSubarray(base, { minLength: base.length, maxLength: base.length }),
        (shuffled) => {
          const h = { ...hand(base.join('')), concealed: shuffled };
          expect(JSON.stringify(enumerateReadings(h, opts))).toBe(reference);
        },
      ),
      { numRuns: 200 },
    );
  });
});
