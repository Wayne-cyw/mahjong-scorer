import { toCounts } from '@/lib/tiles';
import {
  allTiles,
  isHonour,
  isStandard,
  isTerminal,
  isWindTile,
  numberedSuits,
  tripletTiles,
} from './helpers';
import type { FanRule } from './types';

export const LIMIT_RULES: readonly FanRule[] = [
  {
    id: 'small-four-winds',
    nameEn: 'Small four winds',
    nameZh: '小四喜',
    fan: 'limit',
    applies: (r) =>
      isStandard(r) && tripletTiles(r).filter(isWindTile).length === 3 && isWindTile(r.pair),
  },
  {
    id: 'great-four-winds',
    nameEn: 'Great four winds',
    nameZh: '大四喜',
    fan: 'limit',
    applies: (r) => isStandard(r) && tripletTiles(r).filter(isWindTile).length === 4,
  },
  {
    id: 'all-honours',
    nameEn: 'All honours',
    nameZh: '字一色',
    fan: 'limit',
    applies: (_r, c) => allTiles(c).every(isHonour),
  },
  {
    id: 'all-terminals',
    nameEn: 'All terminals',
    nameZh: '清么九',
    fan: 'limit',
    applies: (_r, c) => allTiles(c).every(isTerminal),
  },
  {
    id: 'nine-gates',
    nameEn: 'Nine gates',
    nameZh: '九子連環',
    fan: 'limit',
    // Fully concealed, one suit, 1112345678999 plus any one tile of that suit.
    applies: (r, c) => {
      if (!isStandard(r) || c.hand.melds.length > 0) return false;
      const tiles = c.hand.concealed;
      const suits = numberedSuits(tiles);
      if (suits.size !== 1 || tiles.some(isHonour)) return false;
      const counts = toCounts(tiles);
      const base = [3, 1, 1, 1, 1, 1, 1, 1, 3];
      const suitIndex = ['m', 'p', 's'].indexOf([...suits][0] ?? '');
      const own = counts.slice(suitIndex * 9, suitIndex * 9 + 9);
      return own.every((n, i) => n >= (base[i] ?? 0));
    },
  },
  {
    id: 'thirteen-orphans',
    nameEn: 'Thirteen orphans',
    nameZh: '十三么',
    fan: 'limit',
    applies: (r) => 'special' in r && r.special === 'thirteen-orphans',
  },
  {
    id: 'four-kongs',
    nameEn: 'Four kongs',
    nameZh: '十八羅漢',
    fan: 'limit',
    applies: (_r, c) => c.hand.melds.filter((m) => m.kind === 'kong').length === 4,
  },
  {
    id: 'heavenly',
    nameEn: 'Heavenly hand',
    nameZh: '天糊',
    fan: 'limit',
    applies: (_r, c) => c.hand.flags.heavenly === true,
  },
  {
    id: 'earthly',
    nameEn: 'Earthly hand',
    nameZh: '地糊',
    fan: 'limit',
    applies: (_r, c) => c.hand.flags.earthly === true,
  },
];
