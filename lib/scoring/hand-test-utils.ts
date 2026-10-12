import type { Bonus, Tile } from '@/lib/tiles';
import type { Meld, WinningHand } from './types';

/** Test helper: splits 'm1m2z5' into tile codes. */
export const tiles = (s: string): Tile[] => (s.match(/[mpsz][1-9]/g) ?? []) as Tile[];

export const pung = (s: string, exposed = false): Meld => ({
  kind: 'pung',
  tiles: tiles(s),
  exposed,
});
export const chow = (s: string, exposed = false): Meld => ({
  kind: 'chow',
  tiles: tiles(s),
  exposed,
});
export const kong = (s: string, exposed = false): Meld => ({
  kind: 'kong',
  tiles: tiles(s),
  exposed,
});

export function hand(
  concealed: string,
  opts: Partial<Omit<WinningHand, 'concealed'>> & { winningTile?: Tile } = {},
): WinningHand {
  const ts = tiles(concealed);
  const winningTile = opts.winningTile ?? ts[ts.length - 1];
  if (!winningTile) throw new Error('hand needs at least one concealed tile');
  return {
    concealed: ts,
    melds: opts.melds ?? [],
    bonus: (opts.bonus ?? []) as Bonus[],
    winningTile,
    selfDrawn: opts.selfDrawn ?? false,
    flags: opts.flags ?? {},
  };
}
