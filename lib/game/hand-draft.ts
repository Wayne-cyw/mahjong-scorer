import type { Meld, WinningHand } from '@/lib/scoring';
import { isBonus, type Bonus, type Tile } from '@/lib/tiles';

/** The most copies of one playing tile that exist, counting concealed tiles and melds together. */
const MAX_COPIES = 4;

/**
 * A hand being entered on the review screen. Unlike a `WinningHand` it may be incomplete, so it
 * has no tile-count rules and a nullable winning tile; `scoreHand` judges validity (ADR-40).
 * Every function here is pure and returns a new draft, or the same object when nothing changed.
 */
export interface HandDraft {
  concealed: Tile[];
  melds: Meld[];
  bonus: Bonus[]; // flowers and seasons, each at most once
  winningTile: Tile | null; // always one of `concealed` when set
  selfDrawn: boolean;
  flags: WinningHand['flags'];
}

export type HandFlag = keyof WinningHand['flags'];

export function emptyDraft(selfDrawn: boolean): HandDraft {
  return { concealed: [], melds: [], bonus: [], winningTile: null, selfDrawn, flags: {} };
}

const copiesOf = (d: HandDraft, tile: Tile): number =>
  d.concealed.filter((t) => t === tile).length +
  d.melds.reduce((n, m) => n + m.tiles.filter((t) => t === tile).length, 0);

/**
 * Adds a playing tile to the concealed hand, or a flower/season to `bonus`. A fifth copy of a
 * playing tile (counting melds) and a repeated bonus tile are ignored.
 */
export function addTile(d: HandDraft, tile: Tile | Bonus): HandDraft {
  if (isBonus(tile)) {
    return d.bonus.includes(tile) ? d : { ...d, bonus: [...d.bonus, tile] };
  }
  if (copiesOf(d, tile) >= MAX_COPIES) return d;
  return { ...d, concealed: [...d.concealed, tile] };
}

/**
 * Removes one copy of a tile from the concealed hand, or a bonus tile. Losing the last concealed
 * copy of the winning tile clears the winning tile.
 */
export function removeTile(d: HandDraft, tile: Tile | Bonus): HandDraft {
  if (isBonus(tile)) {
    return d.bonus.includes(tile) ? { ...d, bonus: d.bonus.filter((b) => b !== tile) } : d;
  }
  const at = d.concealed.lastIndexOf(tile);
  if (at === -1) return d;
  const concealed = d.concealed.filter((_, i) => i !== at);
  const winningTile = d.winningTile === tile && !concealed.includes(tile) ? null : d.winningTile;
  return { ...d, concealed, winningTile };
}

/** Declares a meld, refusing one that would push any tile past 4 copies. */
export function addMeld(d: HandDraft, meld: Meld): HandDraft {
  const fits = meld.tiles.every(
    (tile) => copiesOf(d, tile) + meld.tiles.filter((t) => t === tile).length <= MAX_COPIES,
  );
  return fits ? { ...d, melds: [...d.melds, meld] } : d;
}

export function removeMeld(d: HandDraft, index: number): HandDraft {
  if (index < 0 || index >= d.melds.length) return d;
  return { ...d, melds: d.melds.filter((_, i) => i !== index) };
}

/** Flips a meld between exposed and concealed (only meaningful for a kong's score). */
export function toggleMeldExposed(d: HandDraft, index: number): HandDraft {
  const meld = d.melds[index];
  if (!meld) return d;
  return {
    ...d,
    melds: d.melds.map((m, i) => (i === index ? { ...m, exposed: !m.exposed } : m)),
  };
}

/** Marks the winning tile, which must be in `concealed` (ignored otherwise); null clears it. */
export function setWinningTile(d: HandDraft, tile: Tile | null): HandDraft {
  if (tile === null) return d.winningTile === null ? d : { ...d, winningTile: null };
  return d.concealed.includes(tile) ? { ...d, winningTile: tile } : d;
}

/** Sets or clears one situational flag; unset flags are left out so drafts compare cleanly. */
export function setFlag(d: HandDraft, flag: HandFlag, value: boolean): HandDraft {
  const { [flag]: _removed, ...rest } = d.flags;
  return { ...d, flags: value ? { ...rest, [flag]: true } : rest };
}

/** The `WinningHand` for scoring, or null until a winning tile is set. Arrays are copied. */
export function draftToHand(d: HandDraft): WinningHand | null {
  if (d.winningTile === null) return null;
  return {
    concealed: [...d.concealed],
    melds: d.melds.map((m) => ({ ...m, tiles: [...m.tiles] })),
    bonus: [...d.bonus],
    winningTile: d.winningTile,
    selfDrawn: d.selfDrawn,
    flags: { ...d.flags },
  };
}
