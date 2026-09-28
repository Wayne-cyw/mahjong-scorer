import { describe, expect, it } from 'vitest';
import type { Seat } from '@/lib/tiles';
import { breakPointStacks, rollDice, rollDie, tiedPlayers, wallToBreak } from './dice';
import type { FillBytes } from './dice';

/** Builds a fill function that returns the given bytes in order, one call per rollDie invocation. */
function fillFrom(bytes: number[]): FillBytes {
  let i = 0;
  return (buf: Uint8Array) => {
    const b = bytes[i];
    if (b === undefined) throw new Error('fillFrom: ran out of bytes');
    buf[0] = b;
    i += 1;
  };
}

describe('rollDie', () => {
  it('maps injected bytes to the exact expected face (byte % 6 + 1)', () => {
    // 0 -> 1, 1 -> 2, 5 -> 6, 6 -> 1, 251 -> (251 % 6) + 1 = 6
    expect(rollDie(fillFrom([0]))).toBe(1);
    expect(rollDie(fillFrom([1]))).toBe(2);
    expect(rollDie(fillFrom([5]))).toBe(6);
    expect(rollDie(fillFrom([6]))).toBe(1);
    expect(rollDie(fillFrom([251]))).toBe(6);
  });

  it('rejects bytes >= 252 and redraws until an accepted byte arrives', () => {
    // 252, 253, 254, 255 are all rejected (252 = 6 * 42, removes modulo bias); then 0 -> face 1.
    expect(rollDie(fillFrom([252, 253, 254, 255, 0]))).toBe(1);
  });

  it('defaults to the real crypto generator and stays fair over 60,000 rolls', () => {
    const counts = [0, 0, 0, 0, 0, 0];
    const rolls = 60_000;
    for (let i = 0; i < rolls; i++) {
      const face = rollDie();
      counts[face - 1] = (counts[face - 1] ?? 0) + 1;
    }
    const expected = rolls / 6;
    for (const count of counts) {
      expect(Math.abs(count - expected)).toBeLessThanOrEqual(expected * 0.03);
    }
  });
});

describe('rollDice', () => {
  it('rolls exactly three dice from the injected fill, in order', () => {
    const dice = rollDice(fillFrom([0, 2, 5]));
    expect(dice).toEqual([1, 3, 6]);
  });
});

describe('wallToBreak', () => {
  it('lands totals 5, 9, 13 and 17 on the dealer for every dealer seat', () => {
    for (const dealer of [0, 1, 2, 3] as Seat[]) {
      for (const total of [5, 9, 13, 17]) {
        expect(wallToBreak(dealer, total)).toBe(dealer);
      }
    }
  });

  it('rotates counter-clockwise from the dealer for other totals', () => {
    // dealer = 0: (0 + total - 1) % 4
    expect(wallToBreak(0, 3)).toBe(2);
    expect(wallToBreak(0, 4)).toBe(3);
    expect(wallToBreak(0, 6)).toBe(1);
    expect(wallToBreak(0, 18)).toBe(1);
  });

  it('throws on a total outside 3-18', () => {
    expect(() => wallToBreak(0, 2)).toThrow();
    expect(() => wallToBreak(0, 19)).toThrow();
  });
});

describe('breakPointStacks', () => {
  it('is the stack count from the right end, equal to the total', () => {
    expect(breakPointStacks(3)).toBe(3);
    expect(breakPointStacks(18)).toBe(18);
  });
});

describe('tiedPlayers', () => {
  it('returns the index of a single maximum', () => {
    expect(tiedPlayers([2, 5, 3, 1])).toEqual([1]);
  });

  it('returns all indices sharing the maximum value', () => {
    expect(tiedPlayers([4, 6, 6, 2])).toEqual([1, 2]);
  });

  it('returns every index when all rolls tie', () => {
    expect(tiedPlayers([3, 3, 3, 3])).toEqual([0, 1, 2, 3]);
  });
});
