import { describe, expect, it } from 'vitest';
import type { FanLine, WinningHand } from '@/lib/scoring';
import { getPreset } from '@/lib/scoring';
import {
  MANUAL_ENGINE_VERSION,
  UnknownEventError,
  gameEventSchema,
  parseStoredEvent,
  storedEventSchema,
} from './events';
import type { GameEvent, HandWonPayload, StoredEvent } from './events';

const ruleset = getPreset('hk-discarder-pays');

const hand: WinningHand = {
  concealed: ['m1', 'm2', 'm3'],
  melds: [{ kind: 'pung', tiles: ['p5', 'p5', 'p5'], exposed: true }],
  bonus: ['f1'],
  winningTile: 'm3',
  selfDrawn: true,
  flags: { lastTile: true },
};

const breakdown: FanLine[] = [
  { ruleId: 'self-drawn', nameEn: 'Self-drawn', nameZh: '自摸', fan: 1 },
];

/** One valid payload for every member of the GameEvent union. */
const validEvents: GameEvent[] = [
  { type: 'GameCreated', playerIds: ['p1', 'p2', 'p3', 'p4'], ruleset, startingPoints: 2000 },
  { type: 'SeatsAssigned', seatOf: { p1: 0, p2: 1, p3: 2, p4: 3 } },
  { type: 'FirstDealerChosen', seat: 0, dice: [3, 4, 5] },
  { type: 'FirstDealerChosen', seat: 1 },
  { type: 'DiceRolled', total: 9, dice: [3, 3, 3], source: 'virtual' },
  { type: 'DiceRolled', total: 7, source: 'physical' },
  {
    type: 'HandWon',
    winner: 1,
    discarder: 2,
    hand,
    fan: 3,
    breakdown,
    payments: [-8, 24, -8, -8],
    engineVersion: 'v1',
  },
  {
    type: 'HandWon',
    winner: 0,
    fan: 3,
    breakdown,
    payments: [24, -8, -8, -8],
    engineVersion: MANUAL_ENGINE_VERSION,
    manual: true,
  },
  { type: 'HandDrawn' },
  { type: 'HandVoided', targetId: 'evt-1' },
  {
    type: 'HandCorrected',
    targetId: 'evt-1',
    replacement: {
      winner: 1,
      fan: 4,
      breakdown,
      payments: [-16, 48, -16, -16],
      engineVersion: 'v1',
    },
  },
  { type: 'StateOverridden', dealer: 2, prevailing: 'S', dealerRepeat: 1 },
  { type: 'GameEnded', reason: 'completed' },
  { type: 'GameEnded', reason: 'manual' },
];

describe('gameEventSchema', () => {
  it('parses a valid example of every event type', () => {
    for (const event of validEvents) {
      expect(gameEventSchema.parse(event)).toEqual(event);
    }
  });

  it('rejects an unknown event type', () => {
    expect(gameEventSchema.safeParse({ type: 'NotAnEvent' }).success).toBe(false);
  });

  it('rejects a HandWon with a wrong-length payments tuple', () => {
    const bad = {
      type: 'HandWon',
      winner: 0,
      fan: 3,
      breakdown,
      payments: [1, 2, 3],
      engineVersion: 'v1',
    };
    expect(gameEventSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects HandWon payments that do not sum to zero', () => {
    const bad = {
      type: 'HandWon',
      winner: 0,
      fan: 3,
      breakdown,
      payments: [24, -8, -8, -7],
      engineVersion: 'v1',
    };
    expect(gameEventSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects HandWon payments that are not whole points', () => {
    const bad = {
      type: 'HandWon',
      winner: 0,
      fan: 3,
      breakdown,
      payments: [1.5, -0.5, -0.5, -0.5],
      engineVersion: 'v1',
    };
    expect(gameEventSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a HandCorrected replacement whose payments do not sum to zero', () => {
    const bad = {
      type: 'HandCorrected',
      targetId: 'evt-1',
      replacement: {
        winner: 1,
        fan: 4,
        breakdown,
        payments: [-16, 48, -16, -15],
        engineVersion: 'v1',
      },
    };
    expect(gameEventSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a seat value of 4', () => {
    const bad = { type: 'FirstDealerChosen', seat: 4 };
    expect(gameEventSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects dice outside 1-6', () => {
    const bad = { type: 'DiceRolled', total: 9, dice: [3, 3, 7], source: 'virtual' };
    expect(gameEventSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts HandWon without hand (manual fan entry) and rejects invalid manual flag type', () => {
    const good = {
      type: 'HandWon',
      winner: 0,
      fan: 3,
      breakdown,
      payments: [24, -8, -8, -8],
      engineVersion: MANUAL_ENGINE_VERSION,
      manual: true,
    };
    expect(gameEventSchema.safeParse(good).success).toBe(true);

    const bad = { ...good, manual: 'yes' };
    expect(gameEventSchema.safeParse(bad).success).toBe(false);
  });
});

describe('storedEventSchema / parseStoredEvent', () => {
  const envelope: StoredEvent = {
    id: 'id-1',
    gameId: 'game-1',
    seq: 0,
    v: 1,
    at: 1_700_000_000_000,
    payload: { type: 'HandDrawn' },
  };

  it('parses a valid stored event', () => {
    expect(storedEventSchema.parse(envelope)).toEqual(envelope);
    expect(parseStoredEvent(envelope)).toEqual(envelope);
  });

  it('rejects v: 2 (unknown schema version)', () => {
    const bad = { ...envelope, v: 2 };
    expect(storedEventSchema.safeParse(bad).success).toBe(false);
    expect(() => parseStoredEvent(bad)).toThrow(UnknownEventError);
  });

  it('rejects a negative seq', () => {
    const bad = { ...envelope, seq: -1 };
    expect(storedEventSchema.safeParse(bad).success).toBe(false);
    expect(() => parseStoredEvent(bad)).toThrow(UnknownEventError);
  });

  it('rejects malformed payloads and non-object input', () => {
    expect(() => parseStoredEvent({ ...envelope, payload: { type: 'Nope' } })).toThrow(
      UnknownEventError,
    );
    expect(() => parseStoredEvent(null)).toThrow(UnknownEventError);
    expect(() => parseStoredEvent('not an event')).toThrow(UnknownEventError);
  });
});

describe('HandWonPayload', () => {
  it('is assignable into HandCorrected.replacement without the type field', () => {
    const payload: HandWonPayload = {
      winner: 3,
      fan: 3,
      breakdown,
      payments: [-8, -8, -8, 24],
      engineVersion: 'v1',
    };
    const event: GameEvent = { type: 'HandCorrected', targetId: 'evt-2', replacement: payload };
    expect(gameEventSchema.parse(event)).toEqual(event);
  });
});
