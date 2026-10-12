import { TILES, tileFromIndex, toCounts, type Tile } from '@/lib/tiles';
import type { Meld, Reading, WinningHand } from './types';

const TERMINALS_AND_HONOURS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

type StandardReading = Extract<Reading, { sets: Meld[] }>;

/** A chow can start at index i when i is a numbered tile of rank 1-7 (never across suits). */
const canStartChow = (i: number): boolean => i < 27 && i % 9 <= 6;

function decompose(counts: number[], from: number, acc: Meld[], out: Meld[][]): void {
  let i = from;
  while (i < counts.length && counts[i] === 0) i++;
  if (i === counts.length) {
    out.push(acc.map((m) => m));
    return;
  }
  const tile = tileFromIndex(i);
  const n = counts[i] ?? 0;

  if (n >= 3) {
    counts[i] = n - 3;
    acc.push({ kind: 'pung', tiles: [tile, tile, tile], exposed: false });
    decompose(counts, i, acc, out);
    acc.pop();
    counts[i] = n;
  }
  if (canStartChow(i) && (counts[i + 1] ?? 0) > 0 && (counts[i + 2] ?? 0) > 0) {
    counts[i] = n - 1;
    counts[i + 1] = (counts[i + 1] ?? 0) - 1;
    counts[i + 2] = (counts[i + 2] ?? 0) - 1;
    acc.push({
      kind: 'chow',
      tiles: [tile, tileFromIndex(i + 1), tileFromIndex(i + 2)],
      exposed: false,
    });
    decompose(counts, i, acc, out);
    acc.pop();
    counts[i] = n;
    counts[i + 1] = (counts[i + 1] ?? 0) + 1;
    counts[i + 2] = (counts[i + 2] ?? 0) + 1;
  }
}

const readingKey = (r: StandardReading): string =>
  `${r.pair}|${r.sets
    .map((s) => `${s.kind}:${s.exposed ? 'x' : 'c'}:${s.tiles.join('')}`)
    .sort()
    .join(',')}`;

/**
 * Pipeline steps 2-4: every distinct way to read the hand (ADR-35), with
 * declared melds fixed. `[]` means the hand is not a winning hand. Assumes the
 * hand passed `validateHand`.
 */
export function enumerateReadings(
  hand: WinningHand,
  opts: { sevenPairsAllowed: boolean },
): Reading[] {
  const counts = toCounts(hand.concealed);
  const readings: Reading[] = [];
  const seen = new Set<string>();

  for (let p = 0; p < TILES.length; p++) {
    if ((counts[p] ?? 0) < 2) continue;
    counts[p] = (counts[p] ?? 0) - 2;
    const found: Meld[][] = [];
    decompose(counts, 0, [], found);
    counts[p] = (counts[p] ?? 0) + 2;

    const pair: Tile = tileFromIndex(p);
    for (const sets of found) {
      const reading: StandardReading = { sets: [...hand.melds, ...sets], pair };
      const key = readingKey(reading);
      if (seen.has(key)) continue;
      seen.add(key);
      readings.push(reading);
    }
  }

  if (hand.melds.length === 0 && hand.concealed.length === 14) {
    if (isThirteenOrphans(counts)) readings.push({ special: 'thirteen-orphans' });
    else if (opts.sevenPairsAllowed && counts.filter((n) => n === 2).length === 7) {
      readings.push({ special: 'seven-pairs' });
    }
  }
  return readings;
}

function isThirteenOrphans(counts: readonly number[]): boolean {
  const onlyOrphans = counts.every((n, i) => n === 0 || TERMINALS_AND_HONOURS.includes(i));
  return (
    onlyOrphans &&
    TERMINALS_AND_HONOURS.every((i) => (counts[i] ?? 0) >= 1) &&
    counts.reduce((a, b) => a + b, 0) === 14
  );
}
