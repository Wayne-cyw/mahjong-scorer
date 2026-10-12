import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Seat } from '@/lib/tiles';
import { basePointsFor, getPreset, settle } from '@/lib/scoring';
import type { GameEvent, StoredEvent } from './events';
import { applyVoidsAndCorrections, handLabel, initialState, reduce, replay } from './reducer';

const ruleset = getPreset('hk-discarder-pays'); // minFan 3, capFan 10, drawDealerStays true
const startingPoints = 2000;

let seqCounter = 0;
/** One envelope; seq auto-increments unless given, so tests can build sequences tersely. */
function env(payload: GameEvent, overrides: Partial<StoredEvent> = {}): StoredEvent {
  return {
    id: overrides.id ?? `evt-${seqCounter}`,
    gameId: 'g1',
    seq: overrides.seq ?? seqCounter++,
    v: 1,
    at: overrides.at ?? 1_700_000_000_000 + seqCounter,
    payload,
  };
}

function resetSeq() {
  seqCounter = 0;
}

/** GameCreated + SeatsAssigned + FirstDealerChosen, ready to play from `firstDealer`. */
function setupEvents(firstDealer: Seat, rules = ruleset): StoredEvent[] {
  return [
    env({
      type: 'GameCreated',
      playerIds: ['p0', 'p1', 'p2', 'p3'],
      ruleset: rules,
      startingPoints,
    }),
    env({ type: 'SeatsAssigned', seatOf: { p0: 0, p1: 1, p2: 2, p3: 3 } }),
    env({ type: 'FirstDealerChosen', seat: firstDealer }),
  ];
}

/** A HandWon event with valid, zero-sum payments for the given winner/discarder/fan. */
function handWon(
  winner: Seat,
  opts: { discarder?: Seat; fan?: number } = {},
  overrides: Partial<StoredEvent> = {},
): StoredEvent {
  const fan = opts.fan ?? ruleset.minFan;
  const basePoints = basePointsFor(fan, ruleset);
  const payments = settle({
    winner,
    discarder: opts.discarder,
    basePoints,
    model: ruleset.payment,
  });
  return env(
    {
      type: 'HandWon',
      winner,
      discarder: opts.discarder,
      fan,
      breakdown: [],
      payments,
      engineVersion: 'test',
    },
    overrides,
  );
}

function handDrawn(overrides: Partial<StoredEvent> = {}): StoredEvent {
  return env({ type: 'HandDrawn' }, overrides);
}

/** A non-dealer always wins, so the dealer advances every hand (repeat always resets to 0). */
function winByNextSeat(dealer: Seat): StoredEvent {
  const winner = ((dealer + 1) % 4) as Seat;
  return handWon(winner, { discarder: dealer });
}

describe('GameCreated / SeatsAssigned / FirstDealerChosen / DiceRolled', () => {
  it('GameCreated sets starting scores for every seat and the ruleset', () => {
    resetSeq();
    const state = replay([
      env({ type: 'GameCreated', playerIds: ['a', 'b', 'c', 'd'], ruleset, startingPoints: 500 }),
    ]);
    expect(state.scores).toEqual([500, 500, 500, 500]);
    expect(state.ruleset).toEqual(ruleset);
    expect(state.playerIds).toEqual(['a', 'b', 'c', 'd']);
  });

  it('SeatsAssigned sets seatOf', () => {
    resetSeq();
    const state = replay([env({ type: 'SeatsAssigned', seatOf: { alice: 2, bob: 0 } })]);
    expect(state.seatOf).toEqual({ alice: 2, bob: 0 });
  });

  it('FirstDealerChosen sets firstDealer = dealer, prevailing E, status playing', () => {
    resetSeq();
    const state = replay([env({ type: 'FirstDealerChosen', seat: 2 })]);
    expect(state.firstDealer).toBe(2);
    expect(state.dealer).toBe(2);
    expect(state.prevailing).toBe('E');
    expect(state.dealerRepeat).toBe(0);
    expect(state.status).toBe('playing');
  });

  it('DiceRolled sets lastRoll', () => {
    resetSeq();
    const state = replay([
      env({ type: 'DiceRolled', total: 9, dice: [3, 3, 3], source: 'virtual' }),
    ]);
    expect(state.lastRoll).toEqual({ total: 9, dice: [3, 3, 3], source: 'virtual' });
  });
});

describe('rotation rule table', () => {
  it('dealer wins: dealer stays, repeat +1, prevailing unchanged', () => {
    resetSeq();
    const events = [...setupEvents(0), handWon(0, { discarder: 1 })];
    const state = replay(events);
    expect(state.dealer).toBe(0);
    expect(state.dealerRepeat).toBe(1);
    expect(state.prevailing).toBe('E');
    expect(state.status).toBe('playing');
    expect(state.handsPlayed).toBe(1);
  });

  it('another seat wins: next seat deals, repeat resets to 0', () => {
    resetSeq();
    const events = [...setupEvents(0), handWon(1, { discarder: 0 })];
    const state = replay(events);
    expect(state.dealer).toBe(1);
    expect(state.dealerRepeat).toBe(0);
    expect(state.prevailing).toBe('E');
  });

  it('draw with drawDealerStays true: dealer stays, repeat +1', () => {
    resetSeq();
    const events = [...setupEvents(0), handDrawn()];
    const state = replay(events);
    expect(state.dealer).toBe(0);
    expect(state.dealerRepeat).toBe(1);
    expect(state.prevailing).toBe('E');
    expect(state.handsPlayed).toBe(1);
  });

  it('draw with drawDealerStays false: next seat deals, repeat resets to 0', () => {
    resetSeq();
    const passRuleset = { ...ruleset, drawDealerStays: false };
    const events = [...setupEvents(0, passRuleset), handDrawn()];
    const state = replay(events);
    expect(state.dealer).toBe(1);
    expect(state.dealerRepeat).toBe(0);
  });

  it('prevailing wind advances E to S to W to N as the deal returns to the first dealer, then completes', () => {
    resetSeq();
    const events = [...setupEvents(0)];
    const milestones: { afterHand: number; prevailing: string; status: string }[] = [];

    let dealer: Seat = 0;
    for (let round = 0; round < 4; round += 1) {
      for (let i = 0; i < 4; i += 1) {
        events.push(winByNextSeat(dealer));
        dealer = ((dealer + 1) % 4) as Seat;
        const handNumber = round * 4 + i + 1;
        if (i === 3) {
          const state = replay(events);
          milestones.push({
            afterHand: handNumber,
            prevailing: state.prevailing,
            status: state.status,
          });
        }
      }
    }

    expect(milestones).toEqual([
      { afterHand: 4, prevailing: 'S', status: 'playing' },
      { afterHand: 8, prevailing: 'W', status: 'playing' },
      { afterHand: 12, prevailing: 'N', status: 'playing' },
      { afterHand: 16, prevailing: 'N', status: 'complete' },
    ]);

    const final = replay(events);
    expect(final.dealer).toBe(0);
    expect(final.dealerRepeat).toBe(0);
  });

  it('a draw as the final hand also completes the game (draw passes the deal)', () => {
    resetSeq();
    const passRuleset = { ...ruleset, drawDealerStays: false };
    const events = [...setupEvents(0, passRuleset)];
    let dealer: Seat = 0;
    // 15 hands: E, S, W rounds complete, N round hands 1-3.
    for (let i = 0; i < 15; i += 1) {
      events.push(winByNextSeat(dealer));
      dealer = ((dealer + 1) % 4) as Seat;
    }
    const beforeFinal = replay(events);
    expect(beforeFinal.prevailing).toBe('N');
    expect(beforeFinal.status).toBe('playing');
    expect(beforeFinal.dealer).toBe(3);

    events.push(handDrawn());
    const final = replay(events);
    expect(final.status).toBe('complete');
    expect(final.dealer).toBe(0);
    expect(final.prevailing).toBe('N');
  });
});

describe('events after completion', () => {
  function completedGame(): StoredEvent[] {
    const events = [...setupEvents(0)];
    let dealer: Seat = 0;
    for (let i = 0; i < 16; i += 1) {
      events.push(winByNextSeat(dealer));
      dealer = ((dealer + 1) % 4) as Seat;
    }
    return events;
  }

  it('HandWon/HandDrawn after complete change nothing (dealer, prevailing, scores, handsPlayed frozen)', () => {
    resetSeq();
    const events = completedGame();
    const before = replay(events);
    expect(before.status).toBe('complete');

    const withExtraWin = [...events, handWon(0, { discarder: 1 })];
    const withExtraDraw = [...events, handDrawn()];

    for (const extended of [withExtraWin, withExtraDraw]) {
      const after = replay(extended);
      expect(after.dealer).toBe(before.dealer);
      expect(after.prevailing).toBe(before.prevailing);
      expect(after.scores).toEqual(before.scores);
      expect(after.handsPlayed).toBe(before.handsPlayed);
      expect(after.status).toBe('complete');
    }
  });

  it('StateOverridden still applies after completion', () => {
    resetSeq();
    const events = [
      ...completedGame(),
      env({ type: 'StateOverridden', dealer: 2, prevailing: 'S', dealerRepeat: 3 }),
    ];
    const after = replay(events);
    expect(after.dealer).toBe(2);
    expect(after.prevailing).toBe('S');
    expect(after.dealerRepeat).toBe(3);
  });

  it('GameEnded still applies after completion', () => {
    resetSeq();
    const events = [...completedGame(), env({ type: 'GameEnded', reason: 'completed' })];
    const after = replay(events);
    expect(after.status).toBe('ended');
  });
});

describe('handLabel', () => {
  it('computes ((dealer - firstDealer + 4) mod 4) + 1', () => {
    resetSeq();
    for (const firstDealer of [0, 1, 2, 3] as Seat[]) {
      for (const dealer of [0, 1, 2, 3] as Seat[]) {
        const state = {
          ...initialState,
          firstDealer,
          dealer,
          prevailing: 'S' as const,
          dealerRepeat: 2,
        };
        const label = handLabel(state);
        expect(label.hand).toBe((((dealer - firstDealer + 4) % 4) + 1) as 1 | 2 | 3 | 4);
        expect(label.round).toBe('S');
        expect(label.repeat).toBe(2);
      }
    }
  });
});

describe('scores', () => {
  it('follow payments and always sum to 4 x startingPoints', () => {
    resetSeq();
    const events = [
      ...setupEvents(0),
      handWon(1, { discarder: 3, fan: 4 }),
      handWon(2, { fan: 5 }), // self-draw
      handWon(2, { discarder: 0, fan: 3 }),
    ];
    let expected = [startingPoints, startingPoints, startingPoints, startingPoints];
    for (const e of events) {
      const state = replay(events.slice(0, events.indexOf(e) + 1));
      const payload = e.payload;
      if (payload.type === 'HandWon') {
        expected = expected.map((s, i) => s + (payload.payments[i] ?? 0)) as typeof expected;
      }
      expect(state.scores.reduce((a, b) => a + b, 0)).toBe(4 * startingPoints);
    }
    const final = replay(events);
    expect(final.scores).toEqual(expected);
  });
});

describe('reduce with a stray HandVoided/HandCorrected', () => {
  it('is a no-op (applyVoidsAndCorrections strips these before reduce ever sees them)', () => {
    resetSeq();
    const state = { ...initialState, dealer: 1 as Seat, dealerRepeat: 3 };
    expect(reduce(state, env({ type: 'HandVoided', targetId: 'x' }))).toBe(state);
    expect(
      reduce(
        state,
        env({
          type: 'HandCorrected',
          targetId: 'x',
          replacement: {
            winner: 0,
            fan: 3,
            breakdown: [],
            payments: [1, -1, 0, 0],
            engineVersion: 'test',
          },
        }),
      ),
    ).toBe(state);
  });
});

describe('applyVoidsAndCorrections / replay with void and correction', () => {
  it('drops HandVoided/HandCorrected events and the hands they target/replace in place', () => {
    resetSeq();
    const hand1 = handWon(1, { discarder: 0 }, { id: 'h1' });
    const hand2 = handWon(2, { discarder: 1 }, { id: 'h2' });
    const voided = env({ type: 'HandVoided', targetId: 'h1' });
    const replacementPayments = settle({
      winner: 3,
      discarder: 0,
      basePoints: basePointsFor(ruleset.minFan, ruleset),
      model: ruleset.payment,
    });
    const corrected = env({
      type: 'HandCorrected',
      targetId: 'h2',
      replacement: {
        winner: 3,
        discarder: 0,
        fan: ruleset.minFan,
        breakdown: [],
        payments: replacementPayments,
        engineVersion: 'test',
      },
    });

    const result = applyVoidsAndCorrections([hand1, hand2, voided, corrected]);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('h2');
    expect(result[0]!.payload).toMatchObject({ type: 'HandWon', winner: 3, discarder: 0 });
  });

  it('void of hand 2 of 5 replays equal to a fresh replay without it', () => {
    resetSeq();
    const base = setupEvents(0);
    const hands = [
      handWon(1, { discarder: 0 }, { id: 'h1' }),
      handWon(2, { discarder: 1 }, { id: 'h2' }),
      handWon(3, { discarder: 2 }, { id: 'h3' }),
      handWon(0, { discarder: 3 }, { id: 'h4' }),
      handWon(1, { discarder: 0 }, { id: 'h5' }),
    ];
    const withVoid = [...base, ...hands, env({ type: 'HandVoided', targetId: 'h2' })];
    const withoutHand2 = [...base, hands[0]!, hands[2]!, hands[3]!, hands[4]!];

    expect(replay(withVoid)).toEqual(replay(withoutHand2));
  });

  it('a correction changes payments and downstream rotation', () => {
    resetSeq();
    const base = setupEvents(0);
    // Originally hand1 is won by seat 1 (not the dealer), so the deal moves on.
    const hand1 = handWon(1, { discarder: 0 }, { id: 'h1' });
    const hand2 = handWon(2, { discarder: 1 }, { id: 'h2' });
    const original = [...base, hand1, hand2];
    const before = replay(original);
    expect(before.dealer).toBe(2); // 0 -> 1 (hand1) -> 2 (hand2)

    // Correct hand1 so the dealer (seat 0) wins instead: the dealer now stays for hand1.
    const correctedPayments = settle({
      winner: 0,
      discarder: 1,
      basePoints: basePointsFor(ruleset.minFan, ruleset),
      model: ruleset.payment,
    });
    const correction = env({
      type: 'HandCorrected',
      targetId: 'h1',
      replacement: {
        winner: 0,
        discarder: 1,
        fan: ruleset.minFan,
        breakdown: [],
        payments: correctedPayments,
        engineVersion: 'test',
      },
    });
    const corrected = [...original, correction];
    const after = replay(corrected);

    // hand1: dealer (0) wins -> dealer stays at 0. hand2: winner 2 != dealer 0 -> dealer becomes 1.
    expect(after.dealer).toBe(1);
    expect(after.dealer).not.toBe(before.dealer);
    expect(after.scores).not.toEqual(before.scores);
  });

  it('StateOverridden is reproduced exactly by replay', () => {
    resetSeq();
    const events = [
      ...setupEvents(0),
      handWon(1, { discarder: 0 }),
      env({ type: 'StateOverridden', dealer: 3, prevailing: 'W', dealerRepeat: 5 }),
    ];
    const state = replay(events);
    expect(state.dealer).toBe(3);
    expect(state.prevailing).toBe('W');
    expect(state.dealerRepeat).toBe(5);
  });
});

describe('property: replay is deterministic and scores sum to a constant', () => {
  it('holds over random legal event sequences', () => {
    const seatArb = fc.constantFrom<Seat>(0, 1, 2, 3);
    const handIntentArb = fc.oneof(
      fc.record({
        kind: fc.constant('win' as const),
        winner: seatArb,
        selfDraw: fc.boolean(),
        discarderOffset: fc.integer({ min: 1, max: 3 }),
        fan: fc.integer({ min: ruleset.minFan, max: ruleset.capFan }),
      }),
      fc.record({ kind: fc.constant('draw' as const) }),
    );

    fc.assert(
      fc.property(
        seatArb,
        fc.integer({ min: 100, max: 5000 }),
        fc.array(handIntentArb, { maxLength: 40 }),
        (firstDealer, points, intents) => {
          let seq = 0;
          const gameId = 'prop-game';
          const push = (payload: GameEvent): StoredEvent => ({
            id: `evt-${seq}`,
            gameId,
            seq: seq++,
            v: 1,
            at: 0,
            payload,
          });

          const events: StoredEvent[] = [
            push({
              type: 'GameCreated',
              playerIds: ['p0', 'p1', 'p2', 'p3'],
              ruleset,
              startingPoints: points,
            }),
            push({ type: 'SeatsAssigned', seatOf: { p0: 0, p1: 1, p2: 2, p3: 3 } }),
            push({ type: 'FirstDealerChosen', seat: firstDealer }),
          ];

          for (const intent of intents) {
            if (intent.kind === 'draw') {
              events.push(push({ type: 'HandDrawn' }));
              continue;
            }
            const discarder = intent.selfDraw
              ? undefined
              : (((intent.winner + intent.discarderOffset) % 4) as Seat);
            const basePoints = basePointsFor(intent.fan, ruleset);
            const payments = settle({
              winner: intent.winner,
              discarder,
              basePoints,
              model: ruleset.payment,
            });
            events.push(
              push({
                type: 'HandWon',
                winner: intent.winner,
                discarder,
                fan: intent.fan,
                breakdown: [],
                payments,
                engineVersion: 'test',
              }),
            );
          }

          const s1 = replay(events);
          const s2 = replay(events);
          expect(s2).toEqual(s1);
          expect(s1.scores.reduce((a, b) => a + b, 0)).toBe(4 * points);
        },
      ),
      { numRuns: 200 },
    );
  });
});
