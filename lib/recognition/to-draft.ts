import type { HandDraft } from '@/lib/game';
import type { Meld } from '@/lib/scoring';
import type { Tile } from '@/lib/tiles';
import type { RecognizeErrorCode } from './errors';
import type { RecognitionResult } from './validate';

/** Positions the model flagged, expressed against the draft's own arrays. */
export interface UncertainTiles {
  /** Indexes into `draft.concealed`. */
  concealed: ReadonlySet<number>;
  /** `"<meld index>:<tile index>"` into `draft.melds`. */
  melds: ReadonlySet<string>;
  /** Indexes into `draft.bonus`. */
  bonus: ReadonlySet<number>;
}

export interface RecognizedDraft {
  draft: HandDraft;
  uncertain: UncertainTiles;
  warnings: string[];
}

const isRun = (tiles: readonly Tile[]): boolean => {
  const suit = tiles[0]?.charAt(0);
  if (!suit || suit === 'z' || tiles.some((t) => t.charAt(0) !== suit)) return false;
  const ranks = tiles.map((t) => Number(t.slice(1))).sort((a, b) => a - b);
  return ranks.every((rank, i) => i === 0 || rank === (ranks[i - 1] ?? 0) + 1);
};

/** The meld a group of tiles forms, or null when it is not a chow, pung or kong. */
const meldKind = (tiles: readonly Tile[]): Meld['kind'] | null => {
  const same = tiles.every((t) => t === tiles[0]);
  if (same && tiles.length === 4) return 'kong';
  if (same && tiles.length === 3) return 'pung';
  if (tiles.length === 3 && isRun(tiles)) return 'chow';
  return null;
};

/**
 * Turns a recognition into a draft for the review screen. Melds start exposed because the model
 * never decides exposed versus concealed, and it never picks the winning tile (ADR-46). A group
 * that is not a valid meld is put in the concealed hand so no tile the model saw is dropped.
 */
export function draftFromRecognition(
  result: RecognitionResult,
  selfDrawn: boolean,
): RecognizedDraft {
  const concealed: Tile[] = [...result.concealed];
  const melds: Meld[] = [];
  // Where each tile of the flattened melds row ended up.
  const placed: ({ concealed: number } | { meld: number; tile: number })[] = [];

  for (const group of result.melds) {
    const kind = meldKind(group);
    if (kind === null) {
      for (const tile of group) {
        concealed.push(tile);
        placed.push({ concealed: concealed.length - 1 });
      }
    } else {
      melds.push({ kind, tiles: [...group], exposed: true });
      group.forEach((_, tile) => placed.push({ meld: melds.length - 1, tile }));
    }
  }

  const uncertain = {
    concealed: new Set<number>(),
    melds: new Set<string>(),
    bonus: new Set<number>(),
  };
  for (const { row, index } of result.uncertain) {
    if (row === 'concealed') uncertain.concealed.add(index);
    else if (row === 'bonus') uncertain.bonus.add(index);
    else {
      const at = placed[index];
      if (at && 'concealed' in at) uncertain.concealed.add(at.concealed);
      else if (at) uncertain.melds.add(`${at.meld}:${at.tile}`);
    }
  }

  return {
    draft: {
      concealed,
      melds,
      bonus: [...result.bonus],
      winningTile: null,
      selfDrawn,
      flags: {},
    },
    uncertain,
    warnings: [...result.warnings],
  };
}

const tally = (tiles: readonly string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const t of tiles) counts.set(t, (counts.get(t) ?? 0) + 1);
  return counts;
};

const allTiles = (d: HandDraft): string[] => [
  ...d.concealed,
  ...d.melds.flatMap((m) => m.tiles),
  ...d.bonus,
];

/**
 * How many tiles the player had to change from the recognised hand: the larger of tiles added
 * and tiles removed, so a swap is one correction. Marking the winning tile or moving a tile
 * between the hand and a meld is not a change. Zero when nothing was recognised.
 */
export function countCorrections(recognised: HandDraft, final: HandDraft): number {
  const before = allTiles(recognised);
  if (before.length === 0) return 0;
  const a = tally(before);
  const b = tally(allTiles(final));
  let added = 0;
  let removed = 0;
  for (const code of new Set([...a.keys(), ...b.keys()])) {
    const delta = (b.get(code) ?? 0) - (a.get(code) ?? 0);
    if (delta > 0) added += delta;
    else removed -= delta;
  }
  return Math.max(added, removed);
}

const MANUAL = 'Enter the tiles by hand below.';

/** A plain-language reason a photo could not be read, always ending with the way forward. */
export function failureMessage(code: RecognizeErrorCode): string {
  switch (code) {
    case 'unavailable':
      return `Photo reading is not available right now (are you offline?). ${MANUAL}`;
    case 'rate-limited':
      return `Too many photos in the last hour. ${MANUAL}`;
    case 'timeout':
      return `Reading the photo took too long. ${MANUAL}`;
    case 'too-large':
      return `That photo is too large to send. ${MANUAL}`;
    case 'unsupported-type':
    case 'not-a-photo':
      return `That file could not be used as a photo. ${MANUAL}`;
    case 'forbidden-origin':
    case 'invalid-model-output':
    case 'upstream':
      return `We could not read that photo. ${MANUAL}`;
  }
}
