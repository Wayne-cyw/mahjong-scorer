import type { Bonus, Tile } from './types';

interface TileName {
  en: string;
  zh: string;
}

const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'] as const;

const SUITS = {
  m: { en: 'Character', zh: '萬' },
  p: { en: 'Dot', zh: '筒' },
  s: { en: 'Bamboo', zh: '索' },
} as const;

const HONORS: Record<string, TileName> = {
  z1: { en: 'East Wind', zh: '東風' },
  z2: { en: 'South Wind', zh: '南風' },
  z3: { en: 'West Wind', zh: '西風' },
  z4: { en: 'North Wind', zh: '北風' },
  z5: { en: 'White Dragon', zh: '白板' },
  z6: { en: 'Green Dragon', zh: '發財' },
  z7: { en: 'Red Dragon', zh: '紅中' },
};

const BONUS_NAMES: Record<Bonus, TileName> = {
  f1: { en: 'Plum', zh: '梅' },
  f2: { en: 'Orchid', zh: '蘭' },
  f3: { en: 'Chrysanthemum', zh: '菊' },
  f4: { en: 'Bamboo Flower', zh: '竹' },
  f5: { en: 'Spring', zh: '春' },
  f6: { en: 'Summer', zh: '夏' },
  f7: { en: 'Autumn', zh: '秋' },
  f8: { en: 'Winter', zh: '冬' },
};

/** English and Traditional Chinese display name for a tile or bonus code. */
export const tileName = (code: Tile | Bonus): TileName => {
  const honor = HONORS[code];
  if (honor) return honor;
  if (code.startsWith('f')) return BONUS_NAMES[code as Bonus];
  const suit = SUITS[code.charAt(0) as keyof typeof SUITS];
  const n = Number(code.slice(1));
  return { en: `${n} ${suit.en}`, zh: `${NUMERALS[n - 1]}${suit.zh}` };
};
