import { describe, expect, it } from 'vitest';
import type { Seat } from '@/lib/tiles';
import { settle } from './payments';
import { ALL_PAY, DISCARDER_PAYS, PRESETS, basePointsFor, type PaymentModel } from './ruleset';

const sum = (p: readonly number[]): number => p.reduce((a, b) => a + b, 0);

describe('settle: discard win', () => {
  it('DISCARDER_PAYS: discarder pays the full base, others pay nothing', () => {
    expect(settle({ winner: 0, discarder: 2, basePoints: 8, model: DISCARDER_PAYS })).toEqual([
      8, 0, -8, 0,
    ]);
  });

  it('ALL_PAY: discarder pays full, others pay half', () => {
    expect(settle({ winner: 1, discarder: 3, basePoints: 8, model: ALL_PAY })).toEqual([
      -4, 16, -4, -8,
    ]);
  });
});

describe('settle: self-draw', () => {
  it('DISCARDER_PAYS: each other pays half the base', () => {
    expect(settle({ winner: 2, basePoints: 8, model: DISCARDER_PAYS })).toEqual([-4, -4, 12, -4]);
  });

  it('ALL_PAY: each other pays the full base', () => {
    expect(settle({ winner: 3, basePoints: 8, model: ALL_PAY })).toEqual([-8, -8, -8, 24]);
  });
});

describe('settle: invariants', () => {
  const models: PaymentModel[] = [DISCARDER_PAYS, ALL_PAY];
  const seats: Seat[] = [0, 1, 2, 3];

  it('always sums to exactly zero for every winner and discarder', () => {
    for (const model of models) {
      for (const winner of seats) {
        expect(sum(settle({ winner, basePoints: 16, model }))).toBe(0);
        for (const discarder of seats) {
          if (discarder === winner) continue;
          expect(sum(settle({ winner, discarder, basePoints: 16, model }))).toBe(0);
        }
      }
    }
  });

  it('winner is positive and payers are non-positive', () => {
    const p = settle({ winner: 1, discarder: 0, basePoints: 8, model: ALL_PAY });
    expect(p[1]).toBeGreaterThan(0);
    for (const seat of [0, 2, 3]) expect(p[seat]).toBeLessThanOrEqual(0);
  });

  it('throws when a payment is not an integer', () => {
    expect(() => settle({ winner: 0, basePoints: 3, model: DISCARDER_PAYS })).toThrow();
    expect(() => settle({ winner: 0, discarder: 1, basePoints: 3, model: ALL_PAY })).toThrow();
  });

  it('throws when the payments would not sum to zero', () => {
    const broken = { discard: { discarder: Number.NaN, others: 0 }, selfDraw: { each: 1 } };
    expect(() => settle({ winner: 0, discarder: 1, basePoints: 8, model: broken })).toThrow();
  });

  it('throws when the discarder is the winner', () => {
    expect(() =>
      settle({ winner: 0, discarder: 0, basePoints: 8, model: DISCARDER_PAYS }),
    ).toThrow();
  });

  it('every preset table value settles to integers under its own model', () => {
    for (const preset of PRESETS) {
      for (const key of Object.keys(preset.pointsTable)) {
        const base = basePointsFor(Number(key), preset);
        for (const winner of seats) {
          const self = settle({ winner, basePoints: base, model: preset.payment });
          expect(self.every(Number.isInteger)).toBe(true);
          expect(sum(self)).toBe(0);
          for (const discarder of seats) {
            if (discarder === winner) continue;
            const p = settle({ winner, discarder, basePoints: base, model: preset.payment });
            expect(p.every(Number.isInteger)).toBe(true);
            expect(sum(p)).toBe(0);
          }
        }
      }
    }
  });
});
