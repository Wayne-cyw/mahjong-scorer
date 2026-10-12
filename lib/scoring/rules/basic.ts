import { bonusWind } from '@/lib/tiles';
import { isDragon, isStandard, tripletTiles, windTile } from './helpers';
import type { FanRule } from './types';

// Assumptions where Old Style tables differ are noted on each rule; the default
// preset follows the engineering design's table literally.

export const BASIC_RULES: readonly FanRule[] = [
  {
    id: 'self-drawn',
    nameEn: 'Self-drawn',
    nameZh: '自摸',
    fan: 1,
    applies: (_r, c) => c.hand.selfDrawn,
  },
  {
    id: 'concealed-hand',
    nameEn: 'Concealed hand',
    nameZh: '門前清',
    fan: 1,
    // Concealed kongs do not open the hand. Self-drawn concealed hands score
    // only self-drawn (the table has no separate fan for them).
    applies: (_r, c) => !c.hand.selfDrawn && c.hand.melds.every((m) => !m.exposed),
  },
  {
    id: 'no-flowers',
    nameEn: 'No flowers',
    nameZh: '無花',
    fan: 1,
    applies: (_r, c) => c.ruleset.flowersCount && c.hand.bonus.length === 0,
  },
  {
    id: 'own-flower',
    nameEn: 'Own seat flower or season',
    nameZh: '正花',
    fan: 1,
    applies: (_r, c) =>
      c.ruleset.flowersCount
        ? c.hand.bonus.filter((b) => bonusWind(b) === c.ctx.seatWind).length
        : 0,
  },
  {
    id: 'complete-flowers',
    nameEn: 'Complete set of flowers or seasons',
    nameZh: '一台花',
    fan: 2,
    applies: (_r, c) => {
      if (!c.ruleset.flowersCount) return false;
      const has = new Set(c.hand.bonus);
      const flowers = ['f1', 'f2', 'f3', 'f4'] as const;
      const seasons = ['f5', 'f6', 'f7', 'f8'] as const;
      return flowers.every((b) => has.has(b)) || seasons.every((b) => has.has(b));
    },
  },
  {
    id: 'dragon-pung',
    nameEn: 'Dragon pung',
    nameZh: '三元牌',
    fan: 1,
    applies: (r) => (isStandard(r) ? tripletTiles(r).filter(isDragon).length : 0),
  },
  {
    id: 'seat-wind',
    nameEn: 'Seat wind pung',
    nameZh: '門風',
    fan: 1,
    applies: (r, c) => isStandard(r) && tripletTiles(r).includes(windTile(c.ctx.seatWind)),
  },
  {
    id: 'prevailing-wind',
    nameEn: 'Prevailing wind pung',
    nameZh: '圈風',
    fan: 1,
    applies: (r, c) => isStandard(r) && tripletTiles(r).includes(windTile(c.ctx.prevailing)),
  },
  {
    id: 'all-chows',
    nameEn: 'All chows',
    nameZh: '平糊',
    fan: 1,
    // Assumption: any pair is allowed; flowers do not prevent the fan.
    applies: (r) => isStandard(r) && r.sets.every((s) => s.kind === 'chow'),
  },
  {
    id: 'last-tile',
    nameEn: 'Win on the last tile',
    nameZh: '海底撈月',
    fan: 1,
    applies: (_r, c) => c.hand.flags.lastTile === true,
  },
  {
    id: 'kong-replacement',
    nameEn: 'Win on a kong replacement tile',
    nameZh: '槓上開花',
    fan: 1,
    applies: (_r, c) => c.hand.flags.kongReplacement === true,
  },
  {
    id: 'robbing-kong',
    nameEn: 'Robbing a kong',
    nameZh: '搶槓',
    fan: 1,
    applies: (_r, c) => c.hand.flags.robbingKong === true,
  },
];
