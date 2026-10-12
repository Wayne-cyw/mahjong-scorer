import { WINDS, type Tile, type Wind } from '@/lib/tiles';
import type { Meld, Reading } from '../types';
import type { RuleContext } from './types';

export type StandardReading = Extract<Reading, { sets: Meld[] }>;

export const isStandard = (r: Reading): r is StandardReading => 'sets' in r;

export const windTile = (w: Wind): Tile => `z${WINDS.indexOf(w) + 1}` as Tile;

export const isDragon = (t: Tile): boolean => t === 'z5' || t === 'z6' || t === 'z7';
export const isWindTile = (t: Tile): boolean =>
  t === 'z1' || t === 'z2' || t === 'z3' || t === 'z4';
export const isHonour = (t: Tile): boolean => t.startsWith('z');
export const isTerminal = (t: Tile): boolean =>
  !isHonour(t) && (t.endsWith('1') || t.endsWith('9'));

/** Pungs and kongs of a standard reading, by tile. */
export const tripletTiles = (r: StandardReading): Tile[] =>
  r.sets.filter((s) => s.kind !== 'chow').map((s) => s.tiles[0] as Tile);

/** Every tile in the winning hand, whichever reading is used. */
export const allTiles = (c: RuleContext): Tile[] => [
  ...c.hand.concealed,
  ...c.hand.melds.flatMap((m) => m.tiles),
];

/** The numbered suits present in the hand. */
export const numberedSuits = (tiles: readonly Tile[]): Set<string> =>
  new Set(tiles.filter((t) => !isHonour(t)).map((t) => t[0] as string));
