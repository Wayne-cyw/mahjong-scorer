import type { Reading, SeatContext, WinningHand } from '../types';
import type { Ruleset } from '../ruleset';

export interface RuleContext {
  hand: WinningHand;
  ctx: SeatContext;
  ruleset: Ruleset;
}

export interface FanRule {
  id: string;
  nameEn: string;
  nameZh: string;
  fan: number | 'limit';
  /** `true` counts once, a number counts that many times (e.g. 2 dragon pungs). */
  applies: (r: Reading, c: RuleContext) => boolean | number;
  /** Rule ids removed from the breakdown when this rule scores (ADR-36). */
  excludes?: string[];
  /** Scores only when no other rule did (chicken hand). */
  fallback?: boolean;
}
