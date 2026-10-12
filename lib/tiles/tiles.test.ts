import { describe, expect, it } from 'vitest';
import {
  BONUSES,
  TILES,
  WINDS,
  bonusSchema,
  bonusWind,
  isBonus,
  isTile,
  tileFromIndex,
  tileIndex,
  tileName,
  tileSchema,
  toCounts,
  type Bonus,
  type Tile,
  type Wind,
} from './index';

describe('tile tables', () => {
  it('lists 34 playing tiles in engine order', () => {
    expect(TILES).toHaveLength(34);
    expect(new Set(TILES).size).toBe(34);
    expect(TILES[0]).toBe('m1');
    expect(TILES[8]).toBe('m9');
    expect(TILES[9]).toBe('p1');
    expect(TILES[18]).toBe('s1');
    expect(TILES[26]).toBe('s9');
    expect(TILES[27]).toBe('z1');
    expect(TILES[30]).toBe('z4');
    expect(TILES[33]).toBe('z7');
  });

  it('lists 8 bonus tiles and 4 winds', () => {
    expect(BONUSES).toEqual(['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8']);
    expect(WINDS).toEqual(['E', 'S', 'W', 'N']);
  });
});

describe('tileIndex / tileFromIndex', () => {
  it('round-trips all 34 tiles and matches the table position', () => {
    TILES.forEach((tile, i) => {
      expect(tileIndex(tile)).toBe(i);
      expect(tileFromIndex(i)).toBe(tile);
    });
  });

  it('throws on out-of-range or non-integer indices', () => {
    expect(() => tileFromIndex(-1)).toThrow(RangeError);
    expect(() => tileFromIndex(34)).toThrow(RangeError);
    expect(() => tileFromIndex(1.5)).toThrow(RangeError);
    expect(() => tileFromIndex(Number.NaN)).toThrow(RangeError);
  });
});

describe('toCounts', () => {
  it('returns 34 zeros for an empty hand', () => {
    const counts = toCounts([]);
    expect(counts).toHaveLength(34);
    expect(counts.every((c) => c === 0)).toBe(true);
  });

  it('counts a known hand', () => {
    const hand: Tile[] = [
      'm1',
      'm1',
      'm1',
      'p5',
      'p6',
      'p7',
      's9',
      's9',
      'z1',
      'z1',
      'z7',
      'z7',
      'z7',
      'm9',
    ];
    const counts = toCounts(hand);
    expect(counts).toHaveLength(34);
    expect(counts[tileIndex('m1')]).toBe(3);
    expect(counts[tileIndex('m9')]).toBe(1);
    expect(counts[tileIndex('p5')]).toBe(1);
    expect(counts[tileIndex('p6')]).toBe(1);
    expect(counts[tileIndex('p7')]).toBe(1);
    expect(counts[tileIndex('s9')]).toBe(2);
    expect(counts[tileIndex('z1')]).toBe(2);
    expect(counts[tileIndex('z7')]).toBe(3);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(hand.length);
  });
});

describe('bonusWind', () => {
  it('maps each bonus tile to its seat wind', () => {
    const expected: Record<Bonus, Wind> = {
      f1: 'E',
      f5: 'E',
      f2: 'S',
      f6: 'S',
      f3: 'W',
      f7: 'W',
      f4: 'N',
      f8: 'N',
    };
    for (const bonus of BONUSES) {
      expect(bonusWind(bonus)).toBe(expected[bonus]);
    }
  });
});

describe('tileName', () => {
  it('has non-empty English and Traditional Chinese names for every code', () => {
    for (const code of [...TILES, ...BONUSES]) {
      const { en, zh } = tileName(code);
      expect(en.length).toBeGreaterThan(0);
      expect(zh.length).toBeGreaterThan(0);
    }
  });

  it('has unique names across all 42 codes', () => {
    const codes = [...TILES, ...BONUSES];
    expect(new Set(codes.map((c) => tileName(c).en)).size).toBe(42);
    expect(new Set(codes.map((c) => tileName(c).zh)).size).toBe(42);
  });

  it('names known tiles', () => {
    expect(tileName('m1')).toEqual({ en: '1 Character', zh: '一萬' });
    expect(tileName('p9')).toEqual({ en: '9 Dot', zh: '九筒' });
    expect(tileName('s5')).toEqual({ en: '5 Bamboo', zh: '五索' });
    expect(tileName('z1')).toEqual({ en: 'East Wind', zh: '東風' });
    expect(tileName('z5')).toEqual({ en: 'White Dragon', zh: '白板' });
    expect(tileName('z6')).toEqual({ en: 'Green Dragon', zh: '發財' });
    expect(tileName('z7')).toEqual({ en: 'Red Dragon', zh: '紅中' });
    expect(tileName('f1')).toEqual({ en: 'Plum', zh: '梅' });
    expect(tileName('f8')).toEqual({ en: 'Winter', zh: '冬' });
  });
});

describe('guards and schemas', () => {
  it('accepts every valid tile and bonus code', () => {
    for (const tile of TILES) {
      expect(isTile(tile)).toBe(true);
      expect(tileSchema.safeParse(tile).success).toBe(true);
      expect(isBonus(tile)).toBe(false);
    }
    for (const bonus of BONUSES) {
      expect(isBonus(bonus)).toBe(true);
      expect(bonusSchema.safeParse(bonus).success).toBe(true);
      expect(isTile(bonus)).toBe(false);
    }
  });

  it('rejects invalid strings', () => {
    const invalid = ['', 'm0', 'm10', 'p', 'x1', 'z8', 'z0', 'f0', 'f9', 'M1', ' m1', 'm1 ', 'm11'];
    for (const s of invalid) {
      expect(isTile(s)).toBe(false);
      expect(isBonus(s)).toBe(false);
      expect(tileSchema.safeParse(s).success).toBe(false);
      expect(bonusSchema.safeParse(s).success).toBe(false);
    }
  });

  it('rejects non-string input in the schemas', () => {
    expect(tileSchema.safeParse(1).success).toBe(false);
    expect(bonusSchema.safeParse(null).success).toBe(false);
  });
});
