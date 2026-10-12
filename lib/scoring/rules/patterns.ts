import type { Tile } from '@/lib/tiles';
import { allTiles, isDragon, isHonour, isStandard, numberedSuits, tripletTiles } from './helpers';
import type { FanRule } from './types';

const dragonPungs = (tiles: readonly Tile[]) => tiles.filter(isDragon).length;

export const PATTERN_RULES: readonly FanRule[] = [
  {
    id: 'all-pungs',
    nameEn: 'All pungs',
    nameZh: '對對糊',
    fan: 3,
    applies: (r) => isStandard(r) && r.sets.every((s) => s.kind !== 'chow'),
  },
  {
    id: 'mixed-one-suit',
    nameEn: 'Mixed one suit',
    nameZh: '混一色',
    fan: 3,
    applies: (_r, c) => {
      const tiles = allTiles(c);
      return numberedSuits(tiles).size === 1 && tiles.some(isHonour);
    },
  },
  {
    id: 'seven-pairs',
    nameEn: 'Seven pairs',
    nameZh: '七對子',
    fan: 4,
    applies: (r, c) => 'special' in r && r.special === 'seven-pairs' && c.ruleset.sevenPairsAllowed,
  },
  {
    id: 'small-three-dragons',
    nameEn: 'Small three dragons',
    nameZh: '小三元',
    fan: 5,
    excludes: ['dragon-pung'],
    applies: (r) => isStandard(r) && dragonPungs(tripletTiles(r)) === 2 && isDragon(r.pair),
  },
  {
    id: 'all-one-suit',
    nameEn: 'All one suit',
    nameZh: '清一色',
    fan: 7,
    excludes: ['mixed-one-suit'],
    applies: (_r, c) => {
      const tiles = allTiles(c);
      return numberedSuits(tiles).size === 1 && !tiles.some(isHonour);
    },
  },
  {
    id: 'great-three-dragons',
    nameEn: 'Great three dragons',
    nameZh: '大三元',
    fan: 8,
    excludes: ['dragon-pung'],
    applies: (r) => isStandard(r) && dragonPungs(tripletTiles(r)) === 3,
  },
  {
    id: 'four-concealed-pungs',
    nameEn: 'Four concealed pungs',
    nameZh: '坎坎糊',
    fan: 8,
    // Assumption: the 8 fan replaces all pungs rather than stacking on it.
    excludes: ['all-pungs'],
    applies: (r, c) => {
      if (!isStandard(r)) return false;
      const concealed = r.sets.filter((s) => {
        if (s.kind === 'chow' || s.exposed) return false;
        // A pung completed by a discard is exposed, unless the winning tile
        // completed the pair instead.
        const completedByDiscard =
          !c.hand.selfDrawn && s.tiles[0] === c.hand.winningTile && r.pair !== c.hand.winningTile;
        return !completedByDiscard;
      });
      return concealed.length === 4;
    },
  },
];
