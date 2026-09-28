import { describe, expect, it } from 'vitest';
import {
  ALL_PAY,
  DEFAULT_PRESET_ID,
  DISCARDER_PAYS,
  HALF_SPICY,
  PRESETS,
  basePointsFor,
  getPreset,
  rulesetSchema,
} from './ruleset';

describe('presets', () => {
  it('has exactly the three named presets, all version 1', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['hk-discarder-pays', 'hk-all-pay', 'hk-casual']);
    expect(PRESETS.every((p) => p.version === 1)).toBe(true);
  });

  it('defaults to hk-discarder-pays', () => {
    expect(DEFAULT_PRESET_ID).toBe('hk-discarder-pays');
    expect(getPreset(DEFAULT_PRESET_ID).payment).toEqual(DISCARDER_PAYS);
  });

  it('hk-all-pay differs from the default only in payment model, id and name', () => {
    const base = getPreset('hk-discarder-pays');
    const allPay = getPreset('hk-all-pay');
    expect(allPay.payment).toEqual(ALL_PAY);
    expect({ ...allPay, id: base.id, name: base.name, payment: base.payment }).toEqual(base);
  });

  it('hk-casual has min 1 and cap 8', () => {
    const casual = getPreset('hk-casual');
    expect(casual.minFan).toBe(1);
    expect(casual.capFan).toBe(8);
    expect(casual.payment).toEqual(DISCARDER_PAYS);
  });

  it('every preset has a table entry for each fan from minFan to capFan', () => {
    for (const p of PRESETS) {
      for (let fan = p.minFan; fan <= p.capFan; fan++) {
        expect(p.pointsTable[fan]).toBeGreaterThan(0);
      }
    }
  });

  it('getPreset throws on an unknown id', () => {
    expect(() => getPreset('nope')).toThrow();
  });
});

describe('HALF_SPICY', () => {
  it('matches the spec table, extended with 1 and 2 fan', () => {
    expect(HALF_SPICY).toEqual({
      1: 2,
      2: 4,
      3: 8,
      4: 16,
      5: 24,
      6: 32,
      7: 48,
      8: 64,
      9: 96,
      10: 128,
    });
  });
});

describe('basePointsFor', () => {
  const hk = getPreset('hk-discarder-pays');

  it('looks up the table', () => {
    expect(basePointsFor(3, hk)).toBe(8);
    expect(basePointsFor(7, hk)).toBe(48);
  });

  it('clamps fan to the cap', () => {
    expect(basePointsFor(10, hk)).toBe(128);
    expect(basePointsFor(13, hk)).toBe(128);
    expect(basePointsFor(20, getPreset('hk-casual'))).toBe(64);
  });

  it('throws when the fan has no table entry', () => {
    expect(() => basePointsFor(0, hk)).toThrow();
    expect(() => basePointsFor(-1, hk)).toThrow();
    expect(() => basePointsFor(2.5, hk)).toThrow();
  });
});

describe('rulesetSchema', () => {
  it('JSON round-trips every preset', () => {
    for (const p of PRESETS) {
      const parsed = rulesetSchema.parse(JSON.parse(JSON.stringify(p)));
      expect(parsed).toEqual(p);
      expect(typeof Object.keys(parsed.pointsTable)[0]).toBe('string');
      expect(parsed.pointsTable[p.minFan]).toBe(p.pointsTable[p.minFan]);
    }
  });

  it('rejects malformed rulesets', () => {
    const good = JSON.parse(JSON.stringify(getPreset('hk-casual'))) as Record<string, unknown>;
    expect(rulesetSchema.safeParse({ ...good, minFan: 'x' }).success).toBe(false);
    expect(rulesetSchema.safeParse({ ...good, pointsTable: { a: 1 } }).success).toBe(false);
    expect(rulesetSchema.safeParse({ ...good, payment: undefined }).success).toBe(false);
  });
});
