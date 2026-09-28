import { z } from 'zod';

export interface PaymentModel {
  discard: { discarder: number; others: number }; // multiples of base points
  selfDraw: { each: number };
}

export interface Ruleset {
  id: string;
  version: number;
  name: string;
  minFan: number;
  capFan: number;
  pointsTable: Record<number, number>; // fan -> base points
  payment: PaymentModel;
  sevenPairsAllowed: boolean;
  flowersCount: boolean;
  drawDealerStays: boolean;
}

export const HALF_SPICY: Record<number, number> = {
  1: 2,
  2: 4,
  3: 8,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
  9: 96,
  10: 128,
};

export const DISCARDER_PAYS: PaymentModel = {
  discard: { discarder: 1, others: 0 },
  selfDraw: { each: 0.5 },
};

export const ALL_PAY: PaymentModel = {
  discard: { discarder: 1, others: 0.5 },
  selfDraw: { each: 1 },
};

const HK_DISCARDER_PAYS: Ruleset = {
  id: 'hk-discarder-pays',
  version: 1,
  name: 'Hong Kong, discarder pays',
  minFan: 3,
  capFan: 10,
  pointsTable: HALF_SPICY,
  payment: DISCARDER_PAYS,
  sevenPairsAllowed: false,
  flowersCount: true,
  drawDealerStays: true,
};

const HK_ALL_PAY: Ruleset = {
  ...HK_DISCARDER_PAYS,
  id: 'hk-all-pay',
  name: 'Hong Kong, all pay',
  payment: ALL_PAY,
};

const HK_CASUAL: Ruleset = {
  ...HK_DISCARDER_PAYS,
  id: 'hk-casual',
  name: 'Hong Kong, casual',
  minFan: 1,
  capFan: 8,
};

export const PRESETS: readonly Ruleset[] = [HK_DISCARDER_PAYS, HK_ALL_PAY, HK_CASUAL];

export const DEFAULT_PRESET_ID = 'hk-discarder-pays';

export function getPreset(id: string): Ruleset {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown ruleset preset: ${id}`);
  return preset;
}

const paymentModelSchema = z.object({
  discard: z.object({ discarder: z.number(), others: z.number() }),
  selfDraw: z.object({ each: z.number() }),
});

// JSON object keys are always strings, so the table is parsed from string keys
// and turned back into numeric keys.
const pointsTableSchema = z
  .record(z.string().regex(/^\d+$/), z.number().int().nonnegative())
  .transform((table): Record<number, number> => {
    const out: Record<number, number> = {};
    for (const [fan, points] of Object.entries(table)) out[Number(fan)] = points;
    return out;
  });

export const rulesetSchema: z.ZodType<Ruleset> = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  name: z.string(),
  minFan: z.number().int().nonnegative(),
  capFan: z.number().int().positive(),
  pointsTable: pointsTableSchema,
  payment: paymentModelSchema,
  sevenPairsAllowed: z.boolean(),
  flowersCount: z.boolean(),
  drawDealerStays: z.boolean(),
});

/** Base points for a fan count, with fan clamped to the ruleset's cap. */
export function basePointsFor(fan: number, ruleset: Ruleset): number {
  const clamped = Math.min(fan, ruleset.capFan);
  const points = ruleset.pointsTable[clamped];
  if (points === undefined) {
    throw new Error(`Ruleset ${ruleset.id} has no points table entry for ${clamped} fan`);
  }
  return points;
}
