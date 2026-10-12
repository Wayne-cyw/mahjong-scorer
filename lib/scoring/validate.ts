import { isBonus, tileIndex, toCounts, type Tile } from '@/lib/tiles';
import type { Meld, WinningHand } from './types';

export type InvalidReason = 'too-many-copies' | 'wrong-tile-count' | 'not-a-winning-hand';

const isConsecutiveSuited = (tiles: readonly Tile[]): boolean => {
  const [a, b, c] = tiles.map((t) => ({ suit: t[0], rank: Number(t.slice(1)) }));
  if (!a || !b || !c || a.suit === 'z') return false;
  if (a.suit !== b.suit || b.suit !== c.suit) return false;
  const ranks = [a.rank, b.rank, c.rank].sort((x, y) => x - y);
  return ranks[1] === (ranks[0] ?? 0) + 1 && ranks[2] === (ranks[0] ?? 0) + 2;
};

const isWellFormed = (m: Meld): boolean => {
  if (m.kind === 'chow') return m.tiles.length === 3 && isConsecutiveSuited(m.tiles);
  const size = m.kind === 'pung' ? 3 : 4;
  return m.tiles.length === size && m.tiles.every((t) => t === m.tiles[0]);
};

/**
 * Pipeline step 1: at most 4 copies of any tile, exactly 14 tiles plus 1 per
 * kong, well-formed declared melds, and a winning tile held in `concealed`.
 */
export function validateHand(
  hand: WinningHand,
): { ok: true } | { ok: false; reason: InvalidReason } {
  const meldTiles = hand.melds.flatMap((m) => m.tiles);
  const all = [...hand.concealed, ...meldTiles];

  if (all.some((t) => !Number.isInteger(tileIndex(t)) || isBonus(t))) {
    return { ok: false, reason: 'not-a-winning-hand' };
  }
  if (toCounts(all).some((n) => n > 4)) return { ok: false, reason: 'too-many-copies' };

  const kongs = hand.melds.filter((m) => m.kind === 'kong').length;
  if (all.length !== 14 + kongs) return { ok: false, reason: 'wrong-tile-count' };

  if (!hand.melds.every(isWellFormed)) return { ok: false, reason: 'not-a-winning-hand' };
  if (!hand.concealed.includes(hand.winningTile)) {
    return { ok: false, reason: 'not-a-winning-hand' };
  }
  return { ok: true };
}
