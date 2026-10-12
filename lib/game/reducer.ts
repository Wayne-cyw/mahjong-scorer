import type { Seat, Wind } from '@/lib/tiles';
import { WINDS } from '@/lib/tiles';
import type { Ruleset } from '@/lib/scoring';
import type { HandWonPayload, StoredEvent } from './events';
import { nextSeat } from './seats';

/** Derived game state: a pure fold of the event log, never stored directly (ADR-28). */
export interface GameState {
  scores: [number, number, number, number];
  firstDealer: Seat;
  dealer: Seat; // seat currently dealing (East this hand)
  prevailing: Wind; // round wind
  dealerRepeat: number; // consecutive hands kept by this dealer
  status: 'setup' | 'playing' | 'complete' | 'ended';
  playerIds: string[];
  seatOf: Record<string, Seat>;
  ruleset: Ruleset | null;
  lastRoll: {
    total: number;
    dice?: [number, number, number];
    source: 'virtual' | 'physical';
  } | null;
  handsPlayed: number;
}

/** The state of a game with no events applied yet. */
export const initialState: GameState = {
  scores: [0, 0, 0, 0],
  firstDealer: 0,
  dealer: 0,
  prevailing: 'E',
  dealerRepeat: 0,
  status: 'setup',
  playerIds: [],
  seatOf: {},
  ruleset: null,
  lastRoll: null,
  handsPlayed: 0,
};

/** The wind after `wind`, or `undefined` once North's round itself ends. */
const nextWind = (wind: Wind): Wind | undefined => WINDS[WINDS.indexOf(wind) + 1];

type Rotation = Pick<GameState, 'dealer' | 'dealerRepeat' | 'prevailing' | 'status'>;

/** Dealer wins, or a draw the ruleset keeps with the dealer: dealer stays, repeat +1. */
function dealerStays(state: GameState): Rotation {
  return {
    dealer: state.dealer,
    dealerRepeat: state.dealerRepeat + 1,
    prevailing: state.prevailing,
    status: 'playing',
  };
}

/**
 * Another seat wins, or a draw the ruleset passes on: next seat deals, repeat
 * resets to 0. When the deal returns to the first dealer the round is done:
 * the prevailing wind advances, or the game completes after North's round.
 */
function advanceDealer(state: GameState): Rotation {
  const dealer = nextSeat(state.dealer);
  if (dealer !== state.firstDealer) {
    return { dealer, dealerRepeat: 0, prevailing: state.prevailing, status: 'playing' };
  }
  const advanced = nextWind(state.prevailing);
  if (advanced === undefined) {
    return { dealer, dealerRepeat: 0, prevailing: state.prevailing, status: 'complete' };
  }
  return { dealer, dealerRepeat: 0, prevailing: advanced, status: 'playing' };
}

const addPayments = (
  scores: [number, number, number, number],
  payments: [number, number, number, number],
): [number, number, number, number] => [
  scores[0] + payments[0],
  scores[1] + payments[1],
  scores[2] + payments[2],
  scores[3] + payments[3],
];

/**
 * Folds one stored event into state. `HandVoided`/`HandCorrected` are handled
 * by `applyVoidsAndCorrections` before a list ever reaches `reduce`, so they
 * are no-ops here (kept only so a stray one never throws).
 */
export function reduce(state: GameState, event: StoredEvent): GameState {
  const payload = event.payload;
  switch (payload.type) {
    case 'GameCreated': {
      const starting = payload.startingPoints;
      return {
        ...state,
        playerIds: payload.playerIds,
        ruleset: payload.ruleset,
        scores: [starting, starting, starting, starting],
      };
    }
    case 'SeatsAssigned':
      return { ...state, seatOf: { ...payload.seatOf } };
    case 'FirstDealerChosen':
      return {
        ...state,
        firstDealer: payload.seat,
        dealer: payload.seat,
        prevailing: 'E',
        dealerRepeat: 0,
        status: 'playing',
      };
    case 'DiceRolled':
      return {
        ...state,
        lastRoll: { total: payload.total, dice: payload.dice, source: payload.source },
      };
    case 'HandWon': {
      if (state.status !== 'playing') return state;
      const rotation = payload.winner === state.dealer ? dealerStays(state) : advanceDealer(state);
      return {
        ...state,
        ...rotation,
        scores: addPayments(state.scores, payload.payments),
        handsPlayed: state.handsPlayed + 1,
      };
    }
    case 'HandDrawn': {
      if (state.status !== 'playing') return state;
      const dealerKeeps = state.ruleset?.drawDealerStays ?? true;
      const rotation = dealerKeeps ? dealerStays(state) : advanceDealer(state);
      return { ...state, ...rotation, handsPlayed: state.handsPlayed + 1 };
    }
    case 'HandVoided':
    case 'HandCorrected':
      return state;
    case 'StateOverridden':
      return {
        ...state,
        dealer: payload.dealer,
        prevailing: payload.prevailing,
        dealerRepeat: payload.dealerRepeat,
      };
    case 'GameEnded':
      return { ...state, status: 'ended' };
    /* c8 ignore next 4 -- exhaustiveness guard, unreachable for a valid GameEvent */
    default: {
      const exhaustive: never = payload;
      return exhaustive;
    }
  }
}

/**
 * Drops voided hands and every `HandVoided`/`HandCorrected` event, and swaps
 * a corrected hand's payload in place, keeping every other envelope (id, seq,
 * ...) unchanged. The result folds through `reduce` with no special cases.
 */
export function applyVoidsAndCorrections(events: StoredEvent[]): StoredEvent[] {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);

  const voided = new Set<string>();
  const corrections = new Map<string, HandWonPayload>();
  for (const event of sorted) {
    if (event.payload.type === 'HandVoided') voided.add(event.payload.targetId);
    if (event.payload.type === 'HandCorrected') {
      corrections.set(event.payload.targetId, event.payload.replacement);
    }
  }

  const result: StoredEvent[] = [];
  for (const event of sorted) {
    if (event.payload.type === 'HandVoided' || event.payload.type === 'HandCorrected') continue;
    if (voided.has(event.id)) continue;
    const replacement = corrections.get(event.id);
    if (replacement !== undefined && event.payload.type === 'HandWon') {
      result.push({ ...event, payload: { type: 'HandWon', ...replacement } });
    } else {
      result.push(event);
    }
  }
  return result;
}

/** Full game state as of these events: void/correct, then fold in order (ADR-28). */
export function replay(events: StoredEvent[]): GameState {
  return applyVoidsAndCorrections(events).reduce(reduce, initialState);
}

/** The on-screen hand label: `((dealer - firstDealer + 4) mod 4) + 1`. */
export function handLabel(state: GameState): { round: Wind; hand: 1 | 2 | 3 | 4; repeat: number } {
  const hand = (((state.dealer - state.firstDealer + 4) % 4) + 1) as 1 | 2 | 3 | 4;
  return { round: state.prevailing, hand, repeat: state.dealerRepeat };
}
