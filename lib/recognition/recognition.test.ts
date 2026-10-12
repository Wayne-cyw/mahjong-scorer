import { describe, expect, it } from 'vitest';
import { BONUSES, TILES } from '@/lib/tiles';
import {
  RecognitionInvalidError,
  buildPrompt,
  recognitionJsonSchema,
  validateRecognition,
} from './index';

const hand = (overrides: Record<string, unknown> = {}) => ({
  isMahjongHand: true,
  concealed: ['m1', 'm2', 'm3', 'p4', 'p5', 'p6', 's7', 's8', 's9', 'z1', 'z1', 'z1', 'z5', 'z5'],
  melds: [],
  bonus: [],
  uncertain: [],
  ...overrides,
});

describe('validateRecognition', () => {
  it('accepts a well-formed 14-tile hand', () => {
    const result = validateRecognition(hand());
    expect(result.isMahjongHand).toBe(true);
    expect(result.concealed).toHaveLength(14);
    expect(result.melds).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('flattens melds to tile arrays and keeps bonus tiles', () => {
    const result = validateRecognition(
      hand({
        concealed: ['m1', 'm2', 'm3', 'p4', 'p5', 'p6', 's7', 's8', 's9', 'z5', 'z5'],
        melds: [{ tiles: ['z1', 'z1', 'z1'] }],
        bonus: ['f1', 'f6'],
      }),
    );
    expect(result.melds).toEqual([['z1', 'z1', 'z1']]);
    expect(result.bonus).toEqual(['f1', 'f6']);
    expect(result.warnings).toEqual([]);
  });

  it('lowercases tile and bonus codes before parsing', () => {
    const result = validateRecognition(
      hand({
        concealed: [
          'M1',
          'm2',
          'm3',
          'p4',
          'p5',
          'p6',
          's7',
          's8',
          's9',
          'Z1',
          'Z1',
          'Z1',
          'Z5',
          'z5',
        ],
        bonus: ['F3'],
      }),
    );
    expect(result.concealed[0]).toBe('m1');
    expect(result.concealed[9]).toBe('z1');
    expect(result.bonus).toEqual(['f3']);
  });

  it('rejects a fifth copy of a tile across concealed and melds', () => {
    const raw = hand({
      concealed: ['m1', 'm1', 'm1', 'p4', 'p5', 'p6', 's7', 's8', 's9', 'z5', 'z5'],
      melds: [{ tiles: ['m1', 'm1', 'm1', 'm1'] }],
    });
    expect(() => validateRecognition(raw)).toThrow(RecognitionInvalidError);
  });

  it('rejects a repeated bonus tile, since each exists once', () => {
    expect(() => validateRecognition(hand({ bonus: ['f1', 'f1'] }))).toThrow(
      RecognitionInvalidError,
    );
  });

  it.each([
    ['13 tiles', 13],
    ['15 tiles', 15],
  ])('warns instead of failing on %s', (_label, count) => {
    const tiles = [
      'm1',
      'm2',
      'm3',
      'p4',
      'p5',
      'p6',
      's7',
      's8',
      's9',
      'z1',
      'z1',
      'z1',
      'z5',
      'z5',
      'z6',
    ];
    const result = validateRecognition(hand({ concealed: tiles.slice(0, count) }));
    expect(result.concealed).toHaveLength(count);
    expect(result.warnings).toHaveLength(1);
  });

  it('expects one extra tile per kong', () => {
    const result = validateRecognition(
      hand({
        concealed: ['m1', 'm2', 'm3', 'p4', 'p5', 'p6', 's7', 's8', 's9', 'z5', 'z5'],
        melds: [{ tiles: ['z1', 'z1', 'z1', 'z1'] }],
      }),
    );
    expect(result.warnings).toEqual([]);
  });

  it('skips the tile-count warning when the photo is not a hand', () => {
    const result = validateRecognition(hand({ isMahjongHand: false, concealed: [] }));
    expect(result.isMahjongHand).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it('keeps in-range uncertain positions and drops out-of-range ones with a warning', () => {
    const result = validateRecognition(
      hand({
        uncertain: [
          { row: 'concealed', index: 3 },
          { row: 'concealed', index: 14 },
          { row: 'melds', index: 0 },
        ],
      }),
    );
    expect(result.uncertain).toEqual([{ row: 'concealed', index: 3 }]);
    expect(result.warnings).toHaveLength(1);
  });

  it.each([
    ['a missing field', hand({ uncertain: undefined })],
    ['an unknown tile code', hand({ concealed: ['m1', 'x9'] })],
    ['a non-object', 'not json'],
    ['null', null],
  ])('throws RecognitionInvalidError for %s', (_label, raw) => {
    expect(() => validateRecognition(raw)).toThrow(RecognitionInvalidError);
  });
});

describe('recognitionJsonSchema', () => {
  const schema = recognitionJsonSchema() as {
    properties: Record<string, unknown>;
    required: string[];
  };

  it('marks every top-level property required', () => {
    expect(Object.keys(schema.properties).sort()).toEqual(
      ['bonus', 'concealed', 'isMahjongHand', 'melds', 'uncertain'].sort(),
    );
    expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
  });

  it('carries no numeric bounds, which structured outputs reject', () => {
    const text = JSON.stringify(schema);
    expect(text).not.toContain('"minimum"');
    expect(text).not.toContain('"maximum"');
  });

  it('has no union types anywhere (ADR-44)', () => {
    const text = JSON.stringify(schema);
    expect(text).not.toContain('"oneOf"');
    expect(text).not.toContain('"anyOf"');
  });
});

describe('buildPrompt', () => {
  const prompt = buildPrompt();

  it('names all 42 tile and bonus codes', () => {
    expect(TILES.length + BONUSES.length).toBe(42);
    for (const code of [...TILES, ...BONUSES]) expect(prompt).toContain(code);
  });

  it('states the layout convention and asks for uncertain tiles', () => {
    expect(prompt).toMatch(/top row/i);
    expect(prompt).toMatch(/bottom row/i);
    expect(prompt).toMatch(/uncertain/i);
  });
});
