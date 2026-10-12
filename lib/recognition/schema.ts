import { z } from 'zod';
import { bonusSchema, tileSchema } from '@/lib/tiles';

/**
 * What the model returns, and the shape sent as `output_config.format`.
 * Every field is required and there are no unions, which keeps the schema inside the
 * structured-output complexity limits (ADR-44). `uncertain` indexes count tiles left to right
 * within a row; for `melds` that means across the whole row, ignoring group boundaries.
 */
export const recognitionSchema = z.object({
  isMahjongHand: z.boolean(), // false = photo shows no tiles
  concealed: z.array(tileSchema), // top row, left to right
  melds: z.array(z.object({ tiles: z.array(tileSchema) })), // bottom row, one entry per group
  bonus: z.array(bonusSchema), // flowers and seasons to the side
  uncertain: z.array(
    z.object({
      row: z.enum(['concealed', 'melds', 'bonus']),
      index: z.number().int(),
    }),
  ),
});

export type Recognition = z.infer<typeof recognitionSchema>;

/** Structured outputs reject numeric bounds, which Zod adds to every `.int()` (ADR-43). */
const UNSUPPORTED_KEYS = new Set(['minimum', 'maximum']);

const stripUnsupported = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (typeof node !== 'object' || node === null) return node;
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => !UNSUPPORTED_KEYS.has(key))
      .map(([key, value]) => [key, stripUnsupported(value)]),
  );
};

/** JSON Schema for the model's structured output. */
export const recognitionJsonSchema = (): object =>
  stripUnsupported(z.toJSONSchema(recognitionSchema, { target: 'draft-7' })) as object;
