import { describe, expect, it } from 'vitest';
import { chow, hand, kong, pung, tiles } from './hand-test-utils';
import { validateHand } from './validate';

describe('validateHand', () => {
  it('accepts 14 tiles', () => {
    expect(validateHand(hand('m1m2m3p4p5p6s7s8s9z1z1z1z5z5'))).toEqual({ ok: true });
  });

  it('rejects a fifth copy of a tile', () => {
    const h = hand('m1m1m2p4p5p6s7s8s9z1z1', { melds: [pung('m1m1m1')], winningTile: 'z1' });
    expect(validateHand(h)).toEqual({ ok: false, reason: 'too-many-copies' });
  });

  it('rejects fewer than 14 tiles', () => {
    expect(validateHand(hand('m1m2m3p4p5p6s7s8s9z1z1'))).toEqual({
      ok: false,
      reason: 'wrong-tile-count',
    });
  });

  it('counts a kong as one extra tile: 15 valid, 14 invalid', () => {
    const concealed = 'p1p2p3s4s5s6z1z1';
    const valid = hand(concealed, { melds: [kong('m2m2m2m2'), pung('z5z5z5')] });
    expect(validateHand(valid)).toEqual({ ok: true });
    const tooFew = hand('p1p2p3s4s5z1z1', { melds: [kong('m2m2m2m2'), pung('z5z5z5')] });
    expect(validateHand(tooFew)).toEqual({ ok: false, reason: 'wrong-tile-count' });
  });

  it('counts declared melds toward the four-copy limit', () => {
    const melds = [pung('m1m1m1'), chow('s1s2s3')];
    const ok = hand('m1m2m3p4p5p6z1z1', { melds, winningTile: 'z1' });
    expect(validateHand(ok)).toEqual({ ok: true });
    const bad = hand('m1m1m3p4p5p6z1z1', { melds, winningTile: 'z1' });
    expect(validateHand(bad)).toEqual({ ok: false, reason: 'too-many-copies' });
  });

  it('requires the winning tile to be among the concealed tiles', () => {
    const h = hand('m1m2m3p4p5p6s7s8s9z1z1z1z5z5', { winningTile: 'p9' });
    expect(validateHand(h)).toEqual({ ok: false, reason: 'not-a-winning-hand' });
  });

  it('rejects malformed melds', () => {
    const h = hand('m1m2m3p4p5p6z1z1', {
      melds: [pung('m5m5m6'), chow('s1s2s3')],
      winningTile: 'z1',
    });
    expect(validateHand(h)).toEqual({ ok: false, reason: 'not-a-winning-hand' });
    const wrapChow = hand('m1m2m3p4p5p6z1z1', { melds: [chow('s8s9s1'), chow('s1s2s3')] });
    expect(validateHand(wrapChow)).toEqual({ ok: false, reason: 'not-a-winning-hand' });
  });

  it('rejects bonus or unknown codes in the tiles instead of throwing', () => {
    const withBonus = {
      ...hand('m1m2m3p4p5p6s7s8s9z1z1z1z5z5'),
      concealed: tiles('m1m2m3p4p5p6s7s8s9z1z1z1z5'),
    };
    withBonus.concealed.push('f1' as never);
    expect(validateHand(withBonus)).toEqual({ ok: false, reason: 'not-a-winning-hand' });
    const garbage = {
      ...withBonus,
      concealed: [...withBonus.concealed.slice(0, 13), 'x9' as never],
    };
    expect(validateHand(garbage)).toEqual({ ok: false, reason: 'not-a-winning-hand' });
  });
});
