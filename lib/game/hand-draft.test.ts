import { describe, expect, it } from 'vitest';
import type { Meld } from '@/lib/scoring';
import { validateHand } from '@/lib/scoring';
import type { Bonus, Tile } from '@/lib/tiles';
import {
  addMeld,
  addTile,
  draftToHand,
  emptyDraft,
  removeMeld,
  removeTile,
  setFlag,
  setWinningTile,
  toggleMeldExposed,
  type HandDraft,
} from './hand-draft';

const addAll = (d: HandDraft, tiles: Array<Tile | Bonus>): HandDraft =>
  tiles.reduce((acc, t) => addTile(acc, t), d);

describe('emptyDraft', () => {
  it('starts empty with the given self-drawn flag and no winning tile', () => {
    expect(emptyDraft(true)).toEqual({
      concealed: [],
      melds: [],
      bonus: [],
      winningTile: null,
      selfDrawn: true,
      flags: {},
    });
    expect(emptyDraft(false).selfDrawn).toBe(false);
  });
});

describe('addTile / removeTile', () => {
  it('adds playing tiles to concealed without mutating the input', () => {
    const d = emptyDraft(false);
    const next = addTile(d, 'm1');
    expect(next.concealed).toEqual(['m1']);
    expect(d.concealed).toEqual([]);
  });

  it('refuses a fifth copy, counting copies inside melds', () => {
    const pung: Meld = { kind: 'pung', tiles: ['m1', 'm1', 'm1'], exposed: true };
    const d = addMeld(emptyDraft(false), pung);
    const once = addTile(d, 'm1');
    expect(once.concealed).toEqual(['m1']);
    expect(addTile(once, 'm1')).toBe(once);
  });

  it('routes flowers and seasons to bonus, once each', () => {
    const d = addTile(emptyDraft(false), 'f3');
    expect(d.bonus).toEqual(['f3']);
    expect(d.concealed).toEqual([]);
    expect(addTile(d, 'f3')).toBe(d);
  });

  it('removes one copy of a tile, or a bonus tile', () => {
    let d = addAll(emptyDraft(false), ['m1', 'm1', 'f1']);
    d = removeTile(d, 'm1');
    expect(d.concealed).toEqual(['m1']);
    d = removeTile(d, 'f1');
    expect(d.bonus).toEqual([]);
  });

  it('ignores removal of a tile that is not there', () => {
    const d = addTile(emptyDraft(false), 'm1');
    expect(removeTile(d, 'p9')).toBe(d);
  });

  it('clears the winning tile when its last concealed copy is removed', () => {
    let d = addAll(emptyDraft(false), ['m1', 'm1']);
    d = setWinningTile(d, 'm1');
    d = removeTile(d, 'm1');
    expect(d.winningTile).toBe('m1');
    d = removeTile(d, 'm1');
    expect(d.winningTile).toBeNull();
  });
});

describe('setWinningTile', () => {
  it('only accepts a tile already in the concealed hand', () => {
    const d = addTile(emptyDraft(false), 'm1');
    expect(setWinningTile(d, 'm1').winningTile).toBe('m1');
    expect(setWinningTile(d, 'p9')).toBe(d);
  });

  it('can be cleared with null', () => {
    const d = setWinningTile(addTile(emptyDraft(false), 'm1'), 'm1');
    expect(setWinningTile(d, null).winningTile).toBeNull();
  });
});

describe('melds', () => {
  const chow: Meld = { kind: 'chow', tiles: ['m1', 'm2', 'm3'], exposed: true };

  it('toggles a meld exposed flag immutably', () => {
    const d = addMeld(emptyDraft(false), chow);
    const toggled = toggleMeldExposed(d, 0);
    expect(toggled.melds[0]?.exposed).toBe(false);
    expect(d.melds[0]?.exposed).toBe(true);
    expect(toggleMeldExposed(d, 5)).toBe(d);
  });

  it('refuses a meld that would exceed 4 copies and removes by index', () => {
    const d = addAll(emptyDraft(false), ['m1', 'm1', 'm1', 'm1']);
    expect(addMeld(d, chow)).toBe(d);
    const withMeld = addMeld(emptyDraft(false), chow);
    expect(removeMeld(withMeld, 0).melds).toEqual([]);
  });
});

describe('setFlag', () => {
  it('sets and unsets a flag', () => {
    const d = setFlag(emptyDraft(true), 'lastTile', true);
    expect(d.flags).toEqual({ lastTile: true });
    expect(setFlag(d, 'lastTile', false).flags).toEqual({});
  });
});

describe('draftToHand', () => {
  it('is null until a winning tile is set', () => {
    expect(draftToHand(emptyDraft(false))).toBeNull();
    expect(draftToHand(addTile(emptyDraft(false), 'm1'))).toBeNull();
  });

  it('builds a WinningHand the engine validates', () => {
    let d = addAll(emptyDraft(true), [
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
    ]);
    d = setWinningTile(addTile(d, 'f2'), 'z5');
    const hand = draftToHand(d);
    expect(hand).not.toBeNull();
    expect(hand?.winningTile).toBe('z5');
    expect(hand?.bonus).toEqual(['f2']);
    expect(hand?.selfDrawn).toBe(true);
    expect(hand && validateHand(hand)).toEqual({ ok: true });
  });

  it('returns copies, so editing the draft later cannot change the hand', () => {
    const d = setWinningTile(addTile(emptyDraft(false), 'm1'), 'm1');
    const hand = draftToHand(d);
    expect(hand?.concealed).not.toBe(d.concealed);
  });
});
