import type { Seat } from '@/lib/tiles';

/** Fills a byte buffer with random bytes; the injection point for tests (ADR-62). */
export type FillBytes = (buf: Uint8Array) => void;

const defaultFill: FillBytes = (buf) => crypto.getRandomValues(buf);

/**
 * Rolls one fair die (1-6) using rejection sampling so every face is exactly
 * equally likely: 252 = 6 * 42, so bytes 252-255 are redrawn to remove modulo bias.
 */
export function rollDie(fill: FillBytes = defaultFill): number {
  const buf = new Uint8Array(1);
  let byte: number;
  do {
    fill(buf);
    byte = buf[0]!;
  } while (byte >= 252);
  return (byte % 6) + 1;
}

/** Rolls three fair dice, in order. */
export const rollDice = (fill: FillBytes = defaultFill): [number, number, number] => [
  rollDie(fill),
  rollDie(fill),
  rollDie(fill),
];

/**
 * The wall to break, counting the dealer as 1 and moving counter-clockwise:
 * seat `(dealer + total - 1) mod 4`. Totals 5, 9, 13 and 17 land on the dealer.
 */
export const wallToBreak = (dealer: Seat, total: number): Seat => {
  if (!Number.isInteger(total) || total < 3 || total > 18) {
    throw new RangeError(`Dice total out of range: ${total}`);
  }
  return ((dealer + total - 1) % 4) as Seat;
};

/** The break point is `total` stacks from the right end of the wall to break. */
export const breakPointStacks = (total: number): number => total;

/** Indices holding the maximum value, for re-rolls among tied players only (ADR-32). */
export const tiedPlayers = (rolls: number[]): number[] => {
  const max = Math.max(...rolls);
  return rolls.reduce<number[]>((indices, roll, i) => {
    if (roll === max) indices.push(i);
    return indices;
  }, []);
};
