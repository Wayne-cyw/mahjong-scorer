import { z } from 'zod';
import type { Seat, Wind } from '@/lib/tiles';
import { WINDS, bonusSchema, tileSchema } from '@/lib/tiles';
import type { FanLine, Meld, WinningHand } from '@/lib/scoring';
import { rulesetSchema } from '@/lib/scoring';

/** Engine version stamped on a `HandWon` scored by manual fan entry, not the tile engine (ADR-24). */
export const MANUAL_ENGINE_VERSION = 'manual';

const seatSchema: z.ZodType<Seat> = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

const windSchema: z.ZodType<Wind> = z.enum(WINDS as [Wind, ...Wind[]]);

const dieSchema = z.number().int().min(1).max(6);
const diceTripleSchema = z.tuple([dieSchema, dieSchema, dieSchema]);

const paymentSchema = z.number().int();

/** Per-seat point changes: whole points that sum to exactly 0 (as `settle` guarantees). */
const paymentsSchema = z
  .tuple([paymentSchema, paymentSchema, paymentSchema, paymentSchema])
  .refine((payments) => payments.reduce((sum, amount) => sum + amount, 0) === 0, {
    message: 'Payments must sum to 0',
  });

const meldSchema: z.ZodType<Meld> = z.object({
  kind: z.enum(['chow', 'pung', 'kong']),
  tiles: z.array(tileSchema),
  exposed: z.boolean(),
});

const winningHandFlagsSchema = z.object({
  lastTile: z.boolean().optional(),
  kongReplacement: z.boolean().optional(),
  robbingKong: z.boolean().optional(),
  heavenly: z.boolean().optional(),
  earthly: z.boolean().optional(),
});

const winningHandSchema: z.ZodType<WinningHand> = z.object({
  concealed: z.array(tileSchema),
  melds: z.array(meldSchema),
  bonus: z.array(bonusSchema),
  winningTile: tileSchema,
  selfDrawn: z.boolean(),
  flags: winningHandFlagsSchema,
});

const fanLineSchema: z.ZodType<FanLine> = z.object({
  ruleId: z.string(),
  nameEn: z.string(),
  nameZh: z.string(),
  fan: z.number(),
});

const gameCreatedSchema = z.object({
  type: z.literal('GameCreated'),
  playerIds: z.array(z.string()),
  ruleset: rulesetSchema,
  startingPoints: z.number(),
});

const seatsAssignedSchema = z.object({
  type: z.literal('SeatsAssigned'),
  seatOf: z.record(z.string(), seatSchema),
});

const firstDealerChosenSchema = z.object({
  type: z.literal('FirstDealerChosen'),
  seat: seatSchema,
  dice: diceTripleSchema.optional(),
});

const diceRolledSchema = z.object({
  type: z.literal('DiceRolled'),
  total: z.number().int(),
  dice: diceTripleSchema.optional(),
  source: z.enum(['virtual', 'physical']),
});

// The base HandWon schema (with its `type` tag) is the single source of truth: both the
// GameEvent union member and HandWonPayload (used by HandCorrected.replacement) derive from it,
// so the two can never drift apart.
const handWonSchema = z.object({
  type: z.literal('HandWon'),
  winner: seatSchema,
  discarder: seatSchema.optional(),
  hand: winningHandSchema.optional(), // absent for manual fan entry (Phase 1 has no photographed tiles)
  fan: z.number(),
  breakdown: z.array(fanLineSchema),
  payments: paymentsSchema,
  engineVersion: z.string(),
  manual: z.boolean().optional(),
});

const handWonPayloadSchema = handWonSchema.omit({ type: true });

/** The fields of a `HandWon` event, without the `type` tag (`HandCorrected.replacement`'s shape). */
export type HandWonPayload = z.infer<typeof handWonPayloadSchema>;

const handDrawnSchema = z.object({ type: z.literal('HandDrawn') });

const handVoidedSchema = z.object({
  type: z.literal('HandVoided'),
  targetId: z.string(),
});

const handCorrectedSchema = z.object({
  type: z.literal('HandCorrected'),
  targetId: z.string(),
  replacement: handWonPayloadSchema,
});

const stateOverriddenSchema = z.object({
  type: z.literal('StateOverridden'),
  dealer: seatSchema,
  prevailing: windSchema,
  dealerRepeat: z.number(),
});

const gameEndedSchema = z.object({
  type: z.literal('GameEnded'),
  reason: z.enum(['completed', 'manual']),
});

/** Every event the game log can hold, parsed with Zod when loaded (ADR-25, ADR-26). */
export const gameEventSchema = z.discriminatedUnion('type', [
  gameCreatedSchema,
  seatsAssignedSchema,
  firstDealerChosenSchema,
  diceRolledSchema,
  handWonSchema,
  handDrawnSchema,
  handVoidedSchema,
  handCorrectedSchema,
  stateOverriddenSchema,
  gameEndedSchema,
]);

export type GameEvent = z.infer<typeof gameEventSchema>;

/** One envelope wraps every stored event: an id and per-game sequence order it, `v` versions its payload (ADR-27). */
export interface EventEnvelope<T> {
  id: string; // crypto.randomUUID()
  gameId: string;
  seq: number; // 0, 1, 2 ... per game; defines order
  v: 1; // payload schema version
  at: number; // epoch ms
  payload: T;
}

export type StoredEvent = EventEnvelope<GameEvent>;

export const storedEventSchema: z.ZodType<StoredEvent> = z.object({
  id: z.string().min(1),
  gameId: z.string().min(1),
  seq: z.number().int().nonnegative(),
  v: z.literal(1),
  at: z.number(),
  payload: gameEventSchema,
});

/** Thrown by `parseStoredEvent` for malformed data or an unrecognized schema version. */
export class UnknownEventError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'UnknownEventError';
  }
}

/** Parses a stored event, throwing `UnknownEventError` (wrapping the Zod issues) on bad data or an unknown `v`. */
export function parseStoredEvent(raw: unknown): StoredEvent {
  const result = storedEventSchema.safeParse(raw);
  if (!result.success) {
    throw new UnknownEventError('Invalid stored event', { cause: result.error });
  }
  return result.data;
}
