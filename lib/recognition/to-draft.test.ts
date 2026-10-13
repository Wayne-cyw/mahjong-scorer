import { describe, expect, it } from 'vitest';
import { emptyDraft } from '@/lib/game';
import type { Tile } from '@/lib/tiles';
import type { RecognitionResult } from './validate';
import { countCorrections, draftFromRecognition, failureMessage } from './to-draft';

const result = (over: Partial<RecognitionResult> = {}): RecognitionResult => ({
  isMahjongHand: true,
  concealed: ['m1', 'm2', 'm3', 'p4', 'p5', 'p6', 's7', 's8', 's9', 'z5', 'z5'],
  melds: [['z1', 'z1', 'z1']],
  bonus: ['f1'],
  uncertain: [],
  warnings: [],
  ...over,
});

describe('draftFromRecognition', () => {
  it('builds a draft with exposed melds, no winning tile and the right flags', () => {
    const { draft } = draftFromRecognition(result(), true);
    expect(draft.concealed).toEqual(result().concealed);
    expect(draft.melds).toEqual([{ kind: 'pung', tiles: ['z1', 'z1', 'z1'], exposed: true }]);
    expect(draft.bonus).toEqual(['f1']);
    expect(draft.winningTile).toBeNull();
    expect(draft.selfDrawn).toBe(true);
    expect(draft.flags).toEqual({});
  });

  it('classifies chows, pungs and kongs from the tiles', () => {
    const { draft } = draftFromRecognition(
      result({
        concealed: ['m1', 'm1'],
        melds: [
          ['p1', 'p2', 'p3'],
          ['s5', 's5', 's5'],
          ['z2', 'z2', 'z2', 'z2'],
        ],
      }),
      false,
    );
    expect(draft.melds.map((m) => m.kind)).toEqual(['chow', 'pung', 'kong']);
    expect(draft.selfDrawn).toBe(false);
  });

  it('does not treat a run across suits or honours as a chow', () => {
    const { draft } = draftFromRecognition(
      result({
        concealed: [],
        melds: [
          ['m1', 'p2', 's3'],
          ['z1', 'z2', 'z3'],
        ],
      }),
      false,
    );
    expect(draft.melds).toEqual([]);
    // Unrecognisable groups land in the concealed hand so nothing the model saw is lost.
    expect(draft.concealed).toEqual(['m1', 'p2', 's3', 'z1', 'z2', 'z3']);
  });

  it('maps uncertain positions to concealed, bonus and flattened-meld tiles', () => {
    const { uncertain } = draftFromRecognition(
      result({
        uncertain: [
          { row: 'concealed', index: 2 },
          { row: 'bonus', index: 0 },
          { row: 'melds', index: 1 },
        ],
      }),
      true,
    );
    expect([...uncertain.concealed]).toEqual([2]);
    expect([...uncertain.bonus]).toEqual([0]);
    expect([...uncertain.melds]).toEqual(['0:1']);
  });

  it('points an uncertain tile of an unrecognisable group at the concealed hand', () => {
    const { draft, uncertain } = draftFromRecognition(
      result({
        concealed: ['m1'],
        melds: [['m1', 'p2', 's3']],
        uncertain: [{ row: 'melds', index: 1 }],
      }),
      true,
    );
    expect(draft.concealed).toEqual(['m1', 'm1', 'p2', 's3']);
    expect([...uncertain.concealed]).toEqual([2]);
    expect([...uncertain.melds]).toEqual([]);
  });

  it('passes warnings through', () => {
    const { warnings } = draftFromRecognition(result({ warnings: ['Expected 14 tiles'] }), true);
    expect(warnings).toEqual(['Expected 14 tiles']);
  });
});

describe('countCorrections', () => {
  const base = draftFromRecognition(result(), true).draft;

  it('is zero when nothing changed, even if the winning tile was marked', () => {
    expect(countCorrections(base, { ...base, winningTile: 'm1' })).toBe(0);
  });

  it('counts a replaced tile as one correction', () => {
    const edited = { ...base, concealed: ['m9' as Tile, ...base.concealed.slice(1)] };
    expect(countCorrections(base, edited)).toBe(1);
  });

  it('counts an added or a removed tile as one correction each', () => {
    expect(countCorrections(base, { ...base, concealed: [...base.concealed, 'm9' as Tile] })).toBe(
      1,
    );
    expect(countCorrections(base, { ...base, concealed: base.concealed.slice(1) })).toBe(1);
  });

  it('counts tiles moved between concealed and a meld as no change', () => {
    const moved = {
      ...base,
      concealed: base.concealed.filter((t) => t !== 'z5'),
      melds: [
        ...base.melds,
        { kind: 'pung' as const, tiles: ['z5', 'z5', 'z5'] as Tile[], exposed: true },
      ],
    };
    expect(countCorrections(base, moved)).toBe(1);
  });

  it('is zero for a hand typed from scratch (nothing was recognised)', () => {
    expect(countCorrections(emptyDraft(true), base)).toBe(0);
  });
});

describe('failureMessage', () => {
  it('gives a friendly line for every error code, none empty', () => {
    for (const code of [
      'not-a-photo',
      'forbidden-origin',
      'too-large',
      'unsupported-type',
      'rate-limited',
      'invalid-model-output',
      'upstream',
      'unavailable',
      'timeout',
    ] as const) {
      expect(failureMessage(code).length).toBeGreaterThan(10);
    }
  });

  it('says to enter tiles by hand when offline', () => {
    expect(failureMessage('unavailable')).toMatch(/manual|by hand|enter/i);
  });
});
