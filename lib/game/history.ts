import type { Seat, Wind } from '@/lib/tiles';
import type { GameEvent, HandWonPayload, StoredEvent } from './events';
import type { GameState } from './reducer';
import { applyVoidsAndCorrections, initialState, reduce, replay } from './reducer';

/** One effective hand (win or draw), with the rotation it saw and the scores it left. */
export interface HandRecord {
  id: string;
  seq: number;
  kind: 'win' | 'draw';
  winner?: Seat;
  discarder?: Seat;
  fan?: number;
  payments?: [number, number, number, number];
  dealerBefore: Seat;
  prevailingBefore: Wind;
  repeatBefore: number;
  scoresAfter: [number, number, number, number];
}

/** Effective hands only (voided hands dropped, corrected hands reflect their replacement), in order. */
export function deriveHistory(events: StoredEvent[]): HandRecord[] {
  const effective = applyVoidsAndCorrections(events);
  const records: HandRecord[] = [];
  let state: GameState = initialState;

  for (const event of effective) {
    const { payload } = event;
    if (payload.type !== 'HandWon' && payload.type !== 'HandDrawn') {
      state = reduce(state, event);
      continue;
    }
    const dealerBefore = state.dealer;
    const prevailingBefore = state.prevailing;
    const repeatBefore = state.dealerRepeat;
    state = reduce(state, event);
    records.push({
      id: event.id,
      seq: event.seq,
      kind: payload.type === 'HandWon' ? 'win' : 'draw',
      winner: payload.type === 'HandWon' ? payload.winner : undefined,
      discarder: payload.type === 'HandWon' ? payload.discarder : undefined,
      fan: payload.type === 'HandWon' ? payload.fan : undefined,
      payments: payload.type === 'HandWon' ? payload.payments : undefined,
      dealerBefore,
      prevailingBefore,
      repeatBefore,
      scoresAfter: state.scores,
    });
  }
  return records;
}

export interface PreviewEditResult {
  before: GameState;
  after: GameState;
  dealerChanged: boolean;
  laterHandsAffected: number;
}

const sameOutcome = (a: HandRecord, b: HandRecord): boolean =>
  a.dealerBefore === b.dealerBefore &&
  a.prevailingBefore === b.prevailingBefore &&
  a.repeatBefore === b.repeatBefore &&
  a.scoresAfter[0] === b.scoresAfter[0] &&
  a.scoresAfter[1] === b.scoresAfter[1] &&
  a.scoresAfter[2] === b.scoresAfter[2] &&
  a.scoresAfter[3] === b.scoresAfter[3];

/**
 * Previews voiding (`replacement: null`) or correcting `targetId`'s hand
 * without appending anything: it replays the log once as-is and once with a
 * synthetic `HandVoided`/`HandCorrected` appended, and reports what changed.
 */
export function previewEdit(
  events: StoredEvent[],
  targetId: string,
  replacement: HandWonPayload | null,
): PreviewEditResult {
  const before = replay(events);
  const beforeHistory = deriveHistory(events);
  const targetSeq = events.find((event) => event.id === targetId)?.seq ?? -1;

  const gameId = events[0]?.gameId ?? '';
  const seq = events.reduce((max, event) => Math.max(max, event.seq), -1) + 1;
  const editPayload: GameEvent =
    replacement === null
      ? { type: 'HandVoided', targetId }
      : { type: 'HandCorrected', targetId, replacement };
  const editEvent: StoredEvent = {
    id: crypto.randomUUID(),
    gameId,
    seq,
    v: 1,
    at: Date.now(),
    payload: editPayload,
  };

  const modifiedEvents = [...events, editEvent];
  const after = replay(modifiedEvents);
  const afterHistory = deriveHistory(modifiedEvents);

  const dealerChanged = before.dealer !== after.dealer;

  const beforeById = new Map(
    beforeHistory.filter((record) => record.seq > targetSeq).map((record) => [record.id, record]),
  );
  let laterHandsAffected = 0;
  for (const record of afterHistory) {
    if (record.seq <= targetSeq || record.id === targetId) continue;
    const prior = beforeById.get(record.id);
    if (!prior || !sameOutcome(prior, record)) laterHandsAffected += 1;
  }

  return { before, after, dealerChanged, laterHandsAffected };
}
