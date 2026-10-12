import { basePointsFor, type Ruleset } from './ruleset';
import { HK_RULES } from './rules';
import type { FanRule, RuleContext } from './rules/types';
import { settle } from './payments';
import { enumerateReadings } from './readings';
import type { FanLine, Reading, ScoreResult, SeatContext, WinningHand } from './types';
import { validateHand } from './validate';

const ZERO: [number, number, number, number] = [0, 0, 0, 0];

interface Scored {
  reading: Reading;
  lines: FanLine[];
  fan: number;
  limit: boolean;
}

function scoreReading(reading: Reading, c: RuleContext, rules: readonly FanRule[]): Scored {
  const matched: { rule: FanRule; times: number }[] = [];
  for (const rule of rules) {
    if (rule.fallback) continue;
    const v = rule.applies(reading, c);
    const times = v === true ? 1 : v === false ? 0 : v;
    if (times > 0) matched.push({ rule, times });
  }

  const excluded = new Set(matched.flatMap((m) => m.rule.excludes ?? []));
  let kept = matched.filter((m) => !excluded.has(m.rule.id));

  const limit = kept.some((m) => m.rule.fan === 'limit');
  // A limit hand scores the cap once, however many limit patterns it matches.
  if (limit) kept = kept.filter((m) => m.rule.fan === 'limit').slice(0, 1);

  const lines: FanLine[] = kept.map(({ rule, times }) => ({
    ruleId: rule.id,
    nameEn: rule.nameEn,
    nameZh: rule.nameZh,
    fan: rule.fan === 'limit' ? c.ruleset.capFan : rule.fan * times,
  }));

  if (lines.length === 0) {
    const chicken = rules.find((r) => r.fallback);
    if (chicken) {
      lines.push({ ruleId: chicken.id, nameEn: chicken.nameEn, nameZh: chicken.nameZh, fan: 0 });
    }
  }
  const fan = limit ? c.ruleset.capFan : lines.reduce((sum, l) => sum + l.fan, 0);
  return { reading, lines, fan, limit };
}

function invalid(reason: NonNullable<ScoreResult['reason']>): ScoreResult {
  return {
    valid: false,
    reason,
    fan: 0,
    scoredFan: 0,
    breakdown: [],
    basePoints: 0,
    payments: [...ZERO],
  };
}

/**
 * Scores a winning hand by trying every valid reading and keeping the highest
 * (ADR-35). Invalid hands return `valid: false` with a reason; nothing here
 * throws for bad hands, only for programmer errors such as a discard win with
 * no discarder.
 */
export function scoreHand(
  hand: WinningHand,
  ctx: SeatContext,
  ruleset: Ruleset,
  rules: readonly FanRule[] = HK_RULES,
): ScoreResult {
  if (!hand.selfDrawn && ctx.discarder === undefined) {
    throw new Error('A win on a discard needs a discarder');
  }

  const validation = validateHand(hand);
  if (!validation.ok) return invalid(validation.reason);

  const readings = enumerateReadings(hand, { sevenPairsAllowed: ruleset.sevenPairsAllowed });
  if (readings.length === 0) return invalid('not-a-winning-hand');

  const rc: RuleContext = { hand, ctx, ruleset };
  let best: Scored | undefined;
  for (const reading of readings) {
    const scored = scoreReading(reading, rc, rules);
    if (!best || scored.fan > best.fan) best = scored;
  }
  if (!best) return invalid('not-a-winning-hand');

  const scoredFan = Math.min(best.fan, ruleset.capFan);
  if (best.fan < ruleset.minFan) {
    return {
      valid: false,
      reason: 'below-minimum',
      fan: best.fan,
      scoredFan,
      breakdown: best.lines,
      basePoints: 0,
      payments: [...ZERO],
      reading: best.reading,
    };
  }

  const basePoints = scoredFan === 0 ? 0 : basePointsFor(scoredFan, ruleset);
  const payments = settle({
    winner: ctx.winner,
    discarder: hand.selfDrawn ? undefined : ctx.discarder,
    basePoints,
    model: ruleset.payment,
  });
  return {
    valid: true,
    fan: best.fan,
    scoredFan,
    breakdown: best.lines,
    basePoints,
    payments,
    reading: best.reading,
  };
}
