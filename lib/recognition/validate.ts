import { TILES, type Bonus, type Tile } from '@/lib/tiles';
import { recognitionSchema, type Recognition } from './schema';

export interface RecognitionResult {
  isMahjongHand: boolean;
  concealed: Tile[];
  melds: Tile[][];
  bonus: Bonus[];
  uncertain: Recognition['uncertain'];
  warnings: string[];
}

/** The model output could not be turned into a valid hand. */
export class RecognitionInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecognitionInvalidError';
  }
}

const MAX_COPIES = 4;
const HAND_SIZE = 14; // one more per kong

const lowerAll = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v))
    : value;

/** Enum casing is not guaranteed by structured outputs (ADR-43), so normalise before parsing. */
const normalise = (raw: unknown): unknown => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const r = raw as Record<string, unknown>;
  return {
    ...r,
    concealed: lowerAll(r.concealed),
    bonus: lowerAll(r.bonus),
    melds: Array.isArray(r.melds)
      ? r.melds.map((m) =>
          typeof m === 'object' && m !== null
            ? { ...m, tiles: lowerAll((m as Record<string, unknown>).tiles) }
            : m,
        )
      : r.melds,
  };
};

/** Parses and sanity-checks one model answer. A wrong tile count is a warning, not an error. */
export const validateRecognition = (raw: unknown): RecognitionResult => {
  const parsed = recognitionSchema.safeParse(normalise(raw));
  if (!parsed.success) {
    throw new RecognitionInvalidError(`Model output failed the schema: ${parsed.error.message}`);
  }
  const { isMahjongHand, concealed, bonus, uncertain } = parsed.data;
  const melds = parsed.data.melds.map((m) => m.tiles);
  const warnings: string[] = [];

  const copies = new Map<Tile, number>(TILES.map((t) => [t, 0]));
  for (const tile of [...concealed, ...melds.flat()]) {
    const n = (copies.get(tile) ?? 0) + 1;
    if (n > MAX_COPIES)
      throw new RecognitionInvalidError(`More than ${MAX_COPIES} copies of ${tile}`);
    copies.set(tile, n);
  }
  if (new Set(bonus).size !== bonus.length) {
    throw new RecognitionInvalidError('A bonus tile appears more than once');
  }

  if (isMahjongHand) {
    const total = concealed.length + melds.flat().length;
    const expected = HAND_SIZE + melds.filter((m) => m.length === 4).length;
    if (total !== expected) {
      warnings.push(`Expected ${expected} tiles but read ${total}; check the review screen.`);
    }
  }

  const rowLength = {
    concealed: concealed.length,
    melds: melds.flat().length,
    bonus: bonus.length,
  } as const;
  const inRange = uncertain.filter((u) => u.index >= 0 && u.index < rowLength[u.row]);
  if (inRange.length !== uncertain.length) {
    warnings.push('Some uncertain positions pointed outside their row and were ignored.');
  }

  return { isMahjongHand, concealed, melds, bonus, uncertain: inRange, warnings };
};
