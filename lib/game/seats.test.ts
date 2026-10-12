import { describe, expect, it } from 'vitest';
import type { Seat, Wind } from '@/lib/tiles';
import { nextSeat, seatWind } from './seats';

describe('seatWind', () => {
  it('gives the dealer East for every possible dealer seat', () => {
    for (const dealer of [0, 1, 2, 3] as Seat[]) {
      expect(seatWind(dealer, dealer)).toBe('E');
    }
  });

  it('derives winds counter-clockwise from the dealer for each dealer seat', () => {
    const expected: Record<Seat, Wind[]> = {
      0: ['E', 'S', 'W', 'N'],
      1: ['N', 'E', 'S', 'W'],
      2: ['W', 'N', 'E', 'S'],
      3: ['S', 'W', 'N', 'E'],
    };
    for (const dealer of [0, 1, 2, 3] as Seat[]) {
      for (const seat of [0, 1, 2, 3] as Seat[]) {
        expect(seatWind(seat, dealer)).toBe(expected[dealer][seat]);
      }
    }
  });
});

describe('nextSeat', () => {
  it('wraps seat indices around in play order', () => {
    expect(nextSeat(0)).toBe(1);
    expect(nextSeat(1)).toBe(2);
    expect(nextSeat(2)).toBe(3);
    expect(nextSeat(3)).toBe(0);
  });
});
