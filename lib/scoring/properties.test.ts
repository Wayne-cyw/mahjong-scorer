import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { tileFromIndex, type Seat, type Tile } from '@/lib/tiles';
import { hand } from './hand-test-utils';
import { PRESETS } from './ruleset';
import { scoreHand } from './score-hand';
import type { Meld, SeatContext, WinningHand } from './types';

const RUNS = 1000;

const setArb: fc.Arbitrary<Meld> = fc.oneof(
  fc
    .tuple(fc.integer({ min: 0, max: 2 }), fc.integer({ min: 0, max: 6 }))
    .map(([suit, rank]): Meld => {
      const start = suit * 9 + rank;
      return {
        kind: 'chow',
        tiles: [tileFromIndex(start), tileFromIndex(start + 1), tileFromIndex(start + 2)],
        exposed: false,
      };
    }),
  fc.integer({ min: 0, max: 33 }).map((i): Meld => {
    const t = tileFromIndex(i);
    return { kind: 'pung', tiles: [t, t, t], exposed: false };
  }),
);

const fits = (tiles: Tile[]): boolean => {
  const counts = new Map<Tile, number>();
  for (const t of tiles) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.values()].every((n) => n <= 4);
};

/** A guaranteed winning hand: four sets and a pair, with at most 4 copies of any tile. */
const winningArb: fc.Arbitrary<{ hand: WinningHand; ctx: SeatContext; preset: number }> = fc
  .tuple(
    fc.array(setArb, { minLength: 4, maxLength: 4 }),
    fc.integer({ min: 0, max: 33 }),
    fc.boolean(),
    fc.integer({ min: 0, max: 3 }),
    fc.integer({ min: 1, max: 3 }),
    fc.integer({ min: 0, max: PRESETS.length - 1 }),
    fc.subarray(['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'] as const),
  )
  .filter(([sets, pairIdx]) => {
    const pair = tileFromIndex(pairIdx);
    return fits([...sets.flatMap((s) => s.tiles), pair, pair]);
  })
  .map(([sets, pairIdx, selfDrawn, winner, offset, preset, bonus]) => {
    const pair = tileFromIndex(pairIdx);
    const concealed = [...sets.flatMap((s) => s.tiles), pair, pair];
    const w = winner as Seat;
    const ctx: SeatContext = {
      seatWind: 'E',
      prevailing: 'E',
      winner: w,
      discarder: selfDrawn ? undefined : (((winner + offset) % 4) as Seat),
      dealer: 0,
    };
    const winningTile = concealed[concealed.length - 1] as Tile;
    return {
      hand: { concealed, melds: [], bonus: [...bonus], winningTile, selfDrawn, flags: {} },
      ctx,
      preset,
    };
  });

const presetAt = (i: number) => PRESETS[i] ?? PRESETS[0]!;

describe('scoring properties', () => {
  it('payments always sum to zero', () => {
    fc.assert(
      fc.property(winningArb, ({ hand: h, ctx, preset }) => {
        const r = scoreHand(h, ctx, presetAt(preset));
        expect(r.payments.reduce((a, b) => a + b, 0)).toBe(0);
        expect(r.payments.every(Number.isInteger)).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });

  it('scored fan never exceeds the cap and the winner never pays', () => {
    fc.assert(
      fc.property(winningArb, ({ hand: h, ctx, preset }) => {
        const rs = presetAt(preset);
        const r = scoreHand(h, ctx, rs);
        expect(r.scoredFan).toBeLessThanOrEqual(rs.capFan);
        expect(r.payments[ctx.winner] ?? 0).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: RUNS },
    );
  });

  it('is valid or below-minimum for every constructed winning hand', () => {
    fc.assert(
      fc.property(winningArb, ({ hand: h, ctx, preset }) => {
        const r = scoreHand(h, ctx, presetAt(preset));
        expect(r.valid || r.reason === 'below-minimum').toBe(true);
      }),
      { numRuns: RUNS },
    );
  });

  it('tile order never changes the result', () => {
    fc.assert(
      fc.property(winningArb, fc.infiniteStream(fc.nat()), ({ hand: h, ctx, preset }, stream) => {
        const it = stream[Symbol.iterator]();
        const shuffled = [...h.concealed];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = it.next().value % (i + 1);
          [shuffled[i], shuffled[j]] = [shuffled[j] as Tile, shuffled[i] as Tile];
        }
        const rs = presetAt(preset);
        expect(scoreHand({ ...h, concealed: shuffled }, ctx, rs)).toEqual(scoreHand(h, ctx, rs));
      }),
      { numRuns: RUNS },
    );
  });

  it('always rejects a fifth copy of a tile', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 33 }),
        fc.array(fc.integer({ min: 0, max: 33 }), { minLength: 9, maxLength: 9 }),
        fc.boolean(),
        (idx, rest, selfDrawn) => {
          const t = tileFromIndex(idx);
          const concealed = [t, t, t, t, t, ...rest.map(tileFromIndex)];
          const h: WinningHand = {
            concealed,
            melds: [],
            bonus: [],
            winningTile: t,
            selfDrawn,
            flags: {},
          };
          const ctx: SeatContext = {
            seatWind: 'E',
            prevailing: 'E',
            winner: 0,
            discarder: selfDrawn ? undefined : 1,
            dealer: 0,
          };
          const r = scoreHand(h, ctx, presetAt(0));
          expect(r).toMatchObject({ valid: false, reason: 'too-many-copies' });
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe('scoring speed', () => {
  it('re-scores an ambiguous hand with a p95 under 5 ms', () => {
    // Three pungs or three chows plus a chow: the worst shape for the search.
    const h = hand('m1m1m1m2m2m2m3m3m3p5p6p7z1z1', { bonus: ['f2'] });
    const ctx: SeatContext = { seatWind: 'E', prevailing: 'E', winner: 0, discarder: 1, dealer: 0 };
    const rs = presetAt(0);
    for (let i = 0; i < 50; i++) scoreHand(h, ctx, rs); // warm-up
    const times: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const start = performance.now();
      scoreHand(h, ctx, rs);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    expect(times[Math.floor(times.length * 0.95)] ?? Infinity).toBeLessThan(5);
  });
});
