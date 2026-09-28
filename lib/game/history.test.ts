import { describe, expect, it } from 'vitest';
import type { Seat } from '@/lib/tiles';
import { basePointsFor, getPreset, settle } from '@/lib/scoring';
import type { GameEvent, HandWonPayload, StoredEvent } from './events';
import { deriveHistory, previewEdit } from './history';

const ruleset = getPreset('hk-discarder-pays');
const startingPoints = 2000;

let seqCounter = 0;
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

function setupEvents(firstDealer: Seat): StoredEvent[] {
  return [
    env({
      type: 'GameCreated',
      playerIds: ['p0', 'p1', 'p2', 'p3'],
      ruleset,
      startingPoints,
    }),
    env({ type: 'SeatsAssigned', seatOf: { p0: 0, p1: 1, p2: 2, p3: 3 } }),
    env({ type: 'FirstDealerChosen', seat: firstDealer }),
  ];
}

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

describe('deriveHistory', () => {
  it('lists effective wins/draws in order with the rotation seen and the scores left', () => {
    resetSeq();
    const base = setupEvents(0);
    const hand1 = handWon(1, { discarder: 0, fan: 4 }, { id: 'h1' });
    const draw = handDrawn({ id: 'h2' });
    const events = [...base, hand1, draw];

    const history = deriveHistory(events);

    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      id: 'h1',
      kind: 'win',
      winner: 1,
      discarder: 0,
      fan: 4,
      dealerBefore: 0,
      prevailingBefore: 'E',
      repeatBefore: 0,
    });
    expect(history[0]!.scoresAfter.reduce((a, b) => a + b, 0)).toBe(4 * startingPoints);

    // hand1: winner 1 != dealer 0, so dealer becomes 1 for the draw.
    expect(history[1]).toMatchObject({
      id: 'h2',
      kind: 'draw',
      dealerBefore: 1,
      prevailingBefore: 'E',
      repeatBefore: 0,
    });
  });

  it('excludes voided hands and reflects a correction in place', () => {
    resetSeq();
    const base = setupEvents(0);
    const hand1 = handWon(1, { discarder: 0 }, { id: 'h1' });
    const hand2 = handWon(2, { discarder: 1 }, { id: 'h2' });
    const voided = env({ type: 'HandVoided', targetId: 'h1' });
    const events = [...base, hand1, hand2, voided];

    const history = deriveHistory(events);
    expect(history.map((r) => r.id)).toEqual(['h2']);
    // With hand1 dropped, hand2's winner (2) is the dealer (0)? No: dealer stays 0, winner 2 != 0.
    expect(history[0]!.dealerBefore).toBe(0);
  });
});

describe('previewEdit', () => {
  function twoHandSetup(): { events: StoredEvent[]; hand1: StoredEvent } {
    resetSeq();
    const base = setupEvents(0);
    const hand1 = handWon(1, { discarder: 0 }, { id: 'h1' });
    const hand2 = handWon(2, { discarder: 1 }, { id: 'h2' });
    return { events: [...base, hand1, hand2], hand1 };
  }

  it('reports dealerChanged true when a correction flips who won the targeted hand', () => {
    const { events } = twoHandSetup();
    const replacement: HandWonPayload = {
      winner: 0, // the dealer, instead of the original winner (1)
      discarder: 1,
      fan: ruleset.minFan,
      breakdown: [],
      payments: settle({
        winner: 0,
        discarder: 1,
        basePoints: basePointsFor(ruleset.minFan, ruleset),
        model: ruleset.payment,
      }),
      engineVersion: 'test',
    };

    const result = previewEdit(events, 'h1', replacement);

    expect(result.dealerChanged).toBe(true);
    expect(result.before.dealer).toBe(2); // 0 -> 1 (h1) -> 2 (h2)
    expect(result.after.dealer).not.toBe(result.before.dealer);
    expect(result.laterHandsAffected).toBeGreaterThan(0);
  });

  it('reports dealerChanged false when a correction only changes fan/payments, not the winner', () => {
    const { events } = twoHandSetup();
    const replacement: HandWonPayload = {
      winner: 1, // same winner as the original hand1
      discarder: 0,
      fan: ruleset.capFan,
      breakdown: [],
      payments: settle({
        winner: 1,
        discarder: 0,
        basePoints: basePointsFor(ruleset.capFan, ruleset),
        model: ruleset.payment,
      }),
      engineVersion: 'test',
    };

    const result = previewEdit(events, 'h1', replacement);

    expect(result.dealerChanged).toBe(false);
    expect(result.after.dealer).toBe(result.before.dealer);
    // Scores still change because the payments changed.
    expect(result.after.scores).not.toEqual(result.before.scores);
  });

  it('previews a void (replacement: null) and reports laterHandsAffected for hands after the target', () => {
    const { events } = twoHandSetup();
    const result = previewEdit(events, 'h1', null);

    expect(result.before.dealer).toBe(2);
    // Voiding h1 means h2's winner (2) is judged against dealer 0, not dealer 1.
    expect(result.after.dealer).not.toBe(result.before.dealer);
    expect(result.dealerChanged).toBe(true);
    expect(result.laterHandsAffected).toBeGreaterThan(0);
  });

  it('reports laterHandsAffected 0 when editing the most recent hand', () => {
    const { events } = twoHandSetup();
    const replacement: HandWonPayload = {
      winner: 2,
      discarder: 1,
      fan: ruleset.capFan,
      breakdown: [],
      payments: settle({
        winner: 2,
        discarder: 1,
        basePoints: basePointsFor(ruleset.capFan, ruleset),
        model: ruleset.payment,
      }),
      engineVersion: 'test',
    };

    const result = previewEdit(events, 'h2', replacement);
    expect(result.laterHandsAffected).toBe(0);
  });
});
