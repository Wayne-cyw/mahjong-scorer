import { BASIC_RULES } from './basic';
import { LIMIT_RULES } from './limits';
import { PATTERN_RULES } from './patterns';
import type { FanRule } from './types';

const CHICKEN_HAND: FanRule = {
  id: 'chicken-hand',
  nameEn: 'Chicken hand',
  nameZh: '雞糊',
  fan: 0,
  fallback: true,
  applies: () => true,
};

/** The default Hong Kong preset as data, evaluated in this fixed order (ADR-36). */
export const HK_RULES: readonly FanRule[] = [
  ...BASIC_RULES,
  ...PATTERN_RULES,
  ...LIMIT_RULES,
  CHICKEN_HAND,
];

export type { FanRule, RuleContext } from './types';
