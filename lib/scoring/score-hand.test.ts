import { describe, expect, it } from 'vitest';
import { hand, kong, pung } from './hand-test-utils';
import { getPreset, type Ruleset } from './ruleset';
import { scoreHand } from './score-hand';
import type { SeatContext, WinningHand } from './types';

const base: SeatContext = { seatWind: 'E', prevailing: 'E', winner: 0, discarder: 1, dealer: 0 };
// minFan 0 so each rule can be seen on its own; seven pairs on.
const open: Ruleset = { ...getPreset('hk-discarder-pays'), minFan: 0, sevenPairsAllowed: true };

const h = (concealed: string, o: Parameters<typeof hand>[1] = {}): WinningHand =>
  hand(concealed, { bonus: ['f2'], ...o }); // f2 is the south flower: no fan for an east seat

const ids = (hd: WinningHand, ctx: SeatContext = base, rs: Ruleset = open) =>
  scoreHand(hd, ctx, rs).breakdown.map((l) => l.ruleId);

// 11 concealed tiles + one exposed pung: no fan at all.
const CHICKEN = h('p4p5p6s7s8s9m3m4m5p9p9', { melds: [pung('m2m2m2', true)] });

describe('basic fan', () => {
  it('scores a chicken hand at 0 fan', () => {
    const r = scoreHand(CHICKEN, base, open);
    expect(r.valid).toBe(true);
    expect(r.breakdown.map((l) => l.ruleId)).toEqual(['chicken-hand']);
    expect(r.fan).toBe(0);
    expect(r.payments).toEqual([0, 0, 0, 0]);
  });

  it('adds self-drawn', () => {
    expect(ids({ ...CHICKEN, selfDrawn: true })).toEqual(['self-drawn']);
  });

  it('scores a concealed hand won on a discard', () => {
    const concealed = h('m2m2m2p4p5p6s7s8s9m3m4m5p9p9');
    expect(ids(concealed)).toEqual(['concealed-hand']);
    expect(ids({ ...concealed, selfDrawn: true })).toEqual(['self-drawn']);
  });

  it('ignores a concealed kong when judging a concealed hand', () => {
    const hd = h('p4p5p6s7s8s9m3m4m5p9p9', { melds: [kong('m2m2m2m2')] });
    expect(ids(hd)).toEqual(['concealed-hand']);
  });

  it('scores no flowers only when flowers count', () => {
    const none = { ...CHICKEN, bonus: [] };
    expect(ids(none)).toEqual(['no-flowers']);
    expect(ids(none, base, { ...open, flowersCount: false })).toEqual(['chicken-hand']);
  });

  it('scores own seat flowers and seasons', () => {
    const own = { ...CHICKEN, bonus: ['f1' as const, 'f5' as const] };
    const r = scoreHand(own, base, open);
    expect(r.breakdown).toMatchObject([{ ruleId: 'own-flower', fan: 2 }]);
    expect(ids(own, { ...base, seatWind: 'W' })).toEqual(['chicken-hand']);
  });

  it('scores a complete set of flowers on top of the own flower', () => {
    const all = { ...CHICKEN, bonus: ['f1', 'f2', 'f3', 'f4'] as WinningHand['bonus'] };
    const r = scoreHand(all, base, open);
    expect(r.breakdown.map((l) => [l.ruleId, l.fan])).toEqual([
      ['own-flower', 1],
      ['complete-flowers', 2],
    ]);
  });

  it('counts each dragon pung once', () => {
    const hd = h('p4p5p6m3m4m5p9p9', {
      melds: [pung('z5z5z5', true), pung('z7z7z7', true)],
      winningTile: 'p9',
    });
    const r = scoreHand(hd, base, open);
    expect(r.breakdown).toMatchObject([{ ruleId: 'dragon-pung', fan: 2 }]);
  });

  it('scores seat and prevailing wind pungs separately', () => {
    const mk = (z: string) =>
      h('p4p5p6m3m4m5s7s8s9p9p9', {
        melds: [pung(z + z + z, true)],
        winningTile: 'p9',
        bonus: ['f3'],
      });
    const ctx = { ...base, seatWind: 'S' as const, prevailing: 'E' as const };
    expect(ids(mk('z2'), ctx)).toEqual(['seat-wind']);
    expect(ids(mk('z1'), ctx)).toEqual(['prevailing-wind']);
    expect(ids(mk('z1'), base)).toEqual(['seat-wind', 'prevailing-wind']);
  });

  it('scores all chows', () => {
    const hd = h('m1m2m3p4p5p6s7s8s9m4m5m6p2p2');
    expect(ids(hd)).toEqual(['concealed-hand', 'all-chows']);
  });

  it('scores situational flags', () => {
    const f = (flags: WinningHand['flags']) => ids({ ...CHICKEN, flags });
    expect(f({ lastTile: true })).toEqual(['last-tile']);
    expect(f({ kongReplacement: true })).toEqual(['kong-replacement']);
    expect(f({ robbingKong: true })).toEqual(['robbing-kong']);
  });
});

describe('pattern fan', () => {
  it('scores all pungs', () => {
    const hd = h('s5s5s5p8p8p8m9m9', { melds: [pung('m2m2m2', true), pung('p3p3p3', true)] });
    expect(scoreHand(hd, base, open).breakdown).toMatchObject([{ ruleId: 'all-pungs', fan: 3 }]);
  });

  it('scores mixed one suit but not all one suit', () => {
    const hd = h('m1m2m3m4m5m6m7m8m9z1z1z1z5z5');
    const got = ids(hd);
    expect(got).toContain('mixed-one-suit');
    expect(got).not.toContain('all-one-suit');
  });

  it('scores all one suit and excludes mixed one suit', () => {
    const hd = h('m1m2m3m4m5m6m7m8m9m1m2m3m5m5');
    const r = scoreHand(hd, base, open);
    expect(r.breakdown.map((l) => l.ruleId)).toEqual([
      'concealed-hand',
      'all-chows',
      'all-one-suit',
    ]);
    expect(r.fan).toBe(9);
  });

  it('scores seven pairs only when the ruleset allows it', () => {
    const hd = h('m1m1m2m2p3p3p4p4s5s5z1z1z5z5');
    expect(ids(hd)).toEqual(['concealed-hand', 'seven-pairs']);
    const off = scoreHand(hd, base, { ...open, sevenPairsAllowed: false });
    expect(off).toMatchObject({ valid: false, reason: 'not-a-winning-hand' });
  });

  it('scores small three dragons and excludes the dragon pung fan', () => {
    const hd = h('z5z5z5z6z6z6z7z7m1m2m3p4p5p6');
    const r = scoreHand(hd, base, open);
    expect(r.breakdown.map((l) => [l.ruleId, l.fan])).toEqual([
      ['concealed-hand', 1],
      ['small-three-dragons', 5],
    ]);
  });

  it('scores great three dragons and excludes the dragon pung fan', () => {
    const hd = h('z5z5z5z6z6z6z7z7z7m1m2m3p4p4');
    const r = scoreHand(hd, base, open);
    expect(r.breakdown.map((l) => [l.ruleId, l.fan])).toEqual([
      ['concealed-hand', 1],
      ['great-three-dragons', 8],
    ]);
  });

  it('scores four concealed pungs in place of all pungs', () => {
    const concealed = h('m1m1m1p2p2p2s3s3s3z5z5z5p9p9', { winningTile: 'p9' });
    expect(ids(concealed)).toEqual(['concealed-hand', 'dragon-pung', 'four-concealed-pungs']);
  });

  it('does not count a pung completed by a discard as concealed', () => {
    const hd = h('m1m1m1p2p2p2s3s3s3z5z5z5p9p9', { winningTile: 'm1' });
    expect(ids(hd)).toEqual(['concealed-hand', 'dragon-pung', 'all-pungs']);
    expect(ids({ ...hd, selfDrawn: true })).toContain('four-concealed-pungs');
  });
});

describe('limit hands', () => {
  const cap = open.capFan;
  const limitOf = (concealed: string, o: Parameters<typeof hand>[1] = {}) =>
    scoreHand(h(concealed, o), base, open);

  it.each([
    ['small-four-winds', 'z1z1z1z2z2z2z3z3z3z4z4m1m2m3'],
    ['great-four-winds', 'z1z1z1z2z2z2z3z3z3z4z4z4m1m1'],
    ['all-honours', 'z1z1z1z2z2z2z3z3z3z5z5z5z6z6'],
    ['all-terminals', 'm1m1m1m9m9m9p1p1p1p9p9p9s1s1'],
    ['nine-gates', 'm1m1m1m2m3m4m5m5m6m7m8m9m9m9'],
    ['thirteen-orphans', 'm1m9p1p9s1s9z1z2z3z4z5z6z7z7'],
  ])('scores %s as the limit', (id, concealed) => {
    const r = limitOf(concealed);
    expect(r.breakdown.map((l) => l.ruleId)).toEqual([id]);
    expect(r.fan).toBe(cap);
    expect(r.scoredFan).toBe(cap);
  });

  it('scores four kongs', () => {
    const r = limitOf('p9p9', {
      melds: [kong('m1m1m1m1'), kong('p2p2p2p2'), kong('s3s3s3s3'), kong('z5z5z5z5')],
    });
    expect(r.breakdown.map((l) => l.ruleId)).toEqual(['four-kongs']);
  });

  it('scores heavenly and earthly hands and skips other fan', () => {
    const heavenly = limitOf('m2m2m2p4p5p6s7s8s9m3m4m5p9p9', { flags: { heavenly: true } });
    expect(heavenly.breakdown.map((l) => l.ruleId)).toEqual(['heavenly']);
    const earthly = limitOf('m2m2m2p4p5p6s7s8s9m3m4m5p9p9', { flags: { earthly: true } });
    expect(earthly.breakdown.map((l) => l.ruleId)).toEqual(['earthly']);
  });
});

describe('minimum, cap and payments', () => {
  const preset = getPreset('hk-discarder-pays');

  it('rejects a hand below the minimum but still returns its breakdown', () => {
    const r = scoreHand({ ...CHICKEN, selfDrawn: true }, base, preset);
    expect(r).toMatchObject({
      valid: false,
      reason: 'below-minimum',
      fan: 1,
      payments: [0, 0, 0, 0],
    });
    expect(r.breakdown.map((l) => l.ruleId)).toEqual(['self-drawn']);
  });

  it('scores the cap when fan exceeds it', () => {
    const hd = h('m1m1m1p2p2p2s3s3s3z5z5z5p9p9', { selfDrawn: true });
    const casual = scoreHand(hd, base, getPreset('hk-casual'), undefined);
    expect(casual).toMatchObject({ valid: true, fan: 10, scoredFan: 8 });
  });

  // All pungs 3 + red dragon pung 1 + self-drawn 1 = 5 fan = 24 base points.
  const golden = h('s5s5s5p8p8p8m9m9', {
    melds: [pung('m2m2m2', true), pung('z7z7z7', true)],
    selfDrawn: true,
  });

  it('scores the design golden hand: all pungs, red dragon pung, self-drawn', () => {
    const r = scoreHand(golden, base, preset);
    expect(r.breakdown.map((l) => [l.ruleId, l.fan])).toEqual([
      ['self-drawn', 1],
      ['dragon-pung', 1],
      ['all-pungs', 3],
    ]);
    expect(r).toMatchObject({ valid: true, fan: 5, scoredFan: 5, basePoints: 24 });
    expect(r.payments).toEqual([36, -12, -12, -12]);
  });

  it('settles a self-draw under all-pay', () => {
    const r = scoreHand(golden, base, getPreset('hk-all-pay'));
    expect(r.payments).toEqual([72, -24, -24, -24]);
  });

  it('charges only the discarder on a discard win when discarder pays', () => {
    const hd = { ...golden, selfDrawn: false };
    const r = scoreHand(hd, { ...base, discarder: 2 }, preset);
    expect(r.breakdown.map((l) => l.ruleId)).toEqual(['dragon-pung', 'all-pungs']);
    expect(r.payments).toEqual([16, 0, -16, 0]);
    const all = scoreHand(hd, { ...base, discarder: 2 }, getPreset('hk-all-pay'));
    expect(all.payments).toEqual([32, -8, -16, -8]);
  });

  it('always sums payments to zero', () => {
    for (const p of ['hk-discarder-pays', 'hk-all-pay', 'hk-casual']) {
      const r = scoreHand(golden, base, getPreset(p));
      expect(r.payments.reduce((a, b) => a + b, 0)).toBe(0);
    }
  });
});

describe('invalid hands', () => {
  it('reports each reason instead of throwing', () => {
    expect(scoreHand(h('m1m2m3'), base, open)).toMatchObject({
      valid: false,
      reason: 'wrong-tile-count',
    });
    const five = h('m1m1p4p5p6s7s8s9m3m4m5p9p9', { melds: [pung('m1m1m1', true)] });
    expect(scoreHand(five, base, open)).toMatchObject({ valid: false, reason: 'too-many-copies' });
    expect(scoreHand(h('m1m3m5p2p4p6s1s3s5z1z2z3z4z5'), base, open)).toMatchObject({
      valid: false,
      reason: 'not-a-winning-hand',
    });
  });

  it('treats a discard win with no discarder as a programmer error', () => {
    const noDiscarder: SeatContext = { ...base, discarder: undefined };
    expect(() => scoreHand(CHICKEN, noDiscarder, open)).toThrow();
  });
});
