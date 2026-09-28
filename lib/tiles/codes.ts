import { z } from 'zod';
import type { Bonus, Tile, Wind } from './types';

export const WINDS: readonly Wind[] = ['E', 'S', 'W', 'N'];

/** The 34 playing tiles in engine order: m1-m9, p1-p9, s1-s9, z1-z7 (ADR-22). */
export const TILES: readonly Tile[] = [
  'm1',
  'm2',
  'm3',
  'm4',
  'm5',
  'm6',
  'm7',
  'm8',
  'm9',
  'p1',
  'p2',
  'p3',
  'p4',
  'p5',
  'p6',
  'p7',
  'p8',
  'p9',
  's1',
  's2',
  's3',
  's4',
  's5',
  's6',
  's7',
  's8',
  's9',
  'z1',
  'z2',
  'z3',
  'z4',
  'z5',
  'z6',
  'z7',
];

/** The 8 bonus tiles: flowers f1-f4 and seasons f5-f8. Tracked outside count arrays. */
export const BONUSES: readonly Bonus[] = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];

export const tileSchema = z.enum(TILES as [Tile, ...Tile[]]);
export const bonusSchema = z.enum(BONUSES as [Bonus, ...Bonus[]]);

const TILE_INDEX: ReadonlyMap<string, number> = new Map(TILES.map((t, i) => [t, i]));
const BONUS_SET: ReadonlySet<string> = new Set(BONUSES);

export const isTile = (s: string): s is Tile => TILE_INDEX.has(s);

export const isBonus = (s: string): s is Bonus => BONUS_SET.has(s);

export const tileIndex = (t: Tile): number => {
  const i = TILE_INDEX.get(t);
  if (i === undefined) throw new RangeError(`Unknown tile: ${t}`);
  return i;
};

export const tileFromIndex = (i: number): Tile => {
  const tile = Number.isInteger(i) ? TILES[i] : undefined;
  if (tile === undefined) throw new RangeError(`Tile index out of range: ${i}`);
  return tile;
};

/** Converts tiles to a 34-slot count array indexed by engine order. */
export const toCounts = (tiles: readonly Tile[]): number[] => {
  const counts = new Array<number>(TILES.length).fill(0);
  for (const t of tiles) {
    const i = tileIndex(t);
    counts[i] = (counts[i] ?? 0) + 1;
  }
  return counts;
};

/** Bonus `fN` belongs to seat wind `(N - 1) mod 4`. */
export const bonusWind = (b: Bonus): Wind => {
  const n = Number(b.slice(1));
  const wind = WINDS[(n - 1) % 4];
  if (wind === undefined) throw new RangeError(`Unknown bonus tile: ${b}`);
  return wind;
};
