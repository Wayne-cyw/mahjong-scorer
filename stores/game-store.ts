import { create } from 'zustand';
import type { Seat, Wind } from '@/lib/tiles';
import type { FanLine, WinningHand } from '@/lib/scoring';
import { basePointsFor, getPreset, settle } from '@/lib/scoring';
import type { GameEvent, GameState, HandRecord, HandWonPayload, StoredEvent } from '@/lib/game';
import {
  MANUAL_ENGINE_VERSION,
  deriveHistory,
  initialState,
  replay,
  rollDice as rollThreeDice,
} from '@/lib/game';
import {
  DuplicateSeqError,
  appendEvent,
  createGame as dbCreateGame,
  loadEvents,
  savePlayer,
} from '@/lib/db';

/** The one place in the app that calls `appendEvent`: every write goes through this store. */
export interface GameStoreState {
  gameId: string | null;
  events: StoredEvent[];
  state: GameState;
  history: HandRecord[];
  loading: boolean;
  error: string | null;
  createGame: (args: {
    playerNames: string[];
    presetId: string;
    startingPoints?: number;
  }) => Promise<string>;
  assignSeats: (seatOf: Record<string, Seat>) => Promise<void>;
  chooseFirstDealer: (seat: Seat, dice?: [number, number, number]) => Promise<void>;
  rollDice: (args?: { physicalTotal?: number }) => Promise<void>;
  recordWin: (args: {
    winner: Seat;
    discarder?: Seat;
    fan: number;
    hand?: WinningHand;
    breakdown?: FanLine[];
    engineVersion?: string;
  }) => Promise<void>;
  recordDraw: () => Promise<void>;
  voidHand: (targetId: string) => Promise<void>;
  correctHand: (targetId: string, replacement: HandWonPayload) => Promise<void>;
  overrideState: (args: { dealer: Seat; prevailing: Wind; dealerRepeat: number }) => Promise<void>;
  endGame: (reason: 'completed' | 'manual') => Promise<void>;
  loadGame: (gameId: string) => Promise<void>;
}

const DEFAULT_STARTING_POINTS = 2000;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Appends `payload` to `gameId`'s log, retrying once by reloading the log and
 * re-appending if another writer won the race for the next `seq` (ADR-55).
 * Returns the full, up-to-date event list for the game.
 */
async function appendAndSync(
  gameId: string,
  currentEvents: StoredEvent[],
  payload: GameEvent,
): Promise<StoredEvent[]> {
  try {
    const event = await appendEvent(gameId, payload);
    return [...currentEvents, event];
  } catch (error) {
    if (!(error instanceof DuplicateSeqError)) throw error;
    const reloaded = await loadEvents(gameId);
    const event = await appendEvent(gameId, payload);
    return [...reloaded, event];
  }
}

export const useGameStore = create<GameStoreState>()((set, get) => {
  /** Build the payload, append, replay, and set — the pattern every write action follows (ADR-07). */
  const commit = async (gameId: string, payload: GameEvent): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const events = await appendAndSync(gameId, get().events, payload);
      set({
        events,
        state: replay(events),
        history: deriveHistory(events),
        loading: false,
        error: null,
      });
    } catch (error) {
      set({ loading: false, error: errorMessage(error) });
      throw error;
    }
  };

  /** Marks a call as refused: no event is appended, `error` is set, and the promise resolves. */
  const refuse = (message: string): void => {
    set({ error: message });
  };

  return {
    gameId: null,
    events: [],
    state: initialState,
    history: [],
    loading: false,
    error: null,

    createGame: async ({ playerNames, presetId, startingPoints }) => {
      set({ loading: true, error: null });
      try {
        const ruleset = getPreset(presetId);
        const players = await Promise.all(playerNames.map((name) => savePlayer(name)));
        const gameId = await dbCreateGame();
        const payload: GameEvent = {
          type: 'GameCreated',
          playerIds: players.map((player) => player.id),
          ruleset,
          startingPoints: startingPoints ?? DEFAULT_STARTING_POINTS,
        };
        const events = await appendAndSync(gameId, [], payload);
        set({
          gameId,
          events,
          state: replay(events),
          history: deriveHistory(events),
          loading: false,
          error: null,
        });
        return gameId;
      } catch (error) {
        set({ loading: false, error: errorMessage(error) });
        throw error;
      }
    },

    assignSeats: async (seatOf) => {
      const { gameId, state } = get();
      if (gameId === null) return refuse('No game loaded');
      if (state.status !== 'setup') return refuse('Game has already left setup');
      await commit(gameId, { type: 'SeatsAssigned', seatOf });
    },

    chooseFirstDealer: async (seat, dice) => {
      const { gameId, state } = get();
      if (gameId === null) return refuse('No game loaded');
      if (state.status !== 'setup') return refuse('Game has already left setup');
      await commit(gameId, { type: 'FirstDealerChosen', seat, dice });
    },

    rollDice: async (args) => {
      const { gameId, state } = get();
      if (gameId === null || state.status !== 'playing') {
        return refuse('Game is not in progress');
      }
      const physicalTotal = args?.physicalTotal;
      let payload: GameEvent;
      if (physicalTotal === undefined) {
        const dice = rollThreeDice();
        payload = {
          type: 'DiceRolled',
          total: dice[0] + dice[1] + dice[2],
          dice,
          source: 'virtual',
        };
      } else {
        payload = { type: 'DiceRolled', total: physicalTotal, source: 'physical' };
      }
      await commit(gameId, payload);
    },

    recordWin: async ({ winner, discarder, fan, hand, breakdown, engineVersion }) => {
      const { gameId, state } = get();
      if (gameId === null || state.status !== 'playing') {
        return refuse('Game is not in progress');
      }
      const ruleset = state.ruleset;
      if (ruleset === null) return refuse('No ruleset for this game');
      const manual = hand === undefined;
      const basePoints = basePointsFor(fan, ruleset);
      const payments = settle({ winner, discarder, basePoints, model: ruleset.payment });
      const payload: GameEvent = {
        type: 'HandWon',
        winner,
        discarder,
        hand,
        fan,
        breakdown: breakdown ?? [],
        payments,
        engineVersion: manual ? MANUAL_ENGINE_VERSION : (engineVersion ?? MANUAL_ENGINE_VERSION),
        manual,
      };
      await commit(gameId, payload);
    },

    recordDraw: async () => {
      const { gameId, state } = get();
      if (gameId === null || state.status !== 'playing') {
        return refuse('Game is not in progress');
      }
      await commit(gameId, { type: 'HandDrawn' });
    },

    voidHand: async (targetId) => {
      const { gameId } = get();
      if (gameId === null) return refuse('No game loaded');
      await commit(gameId, { type: 'HandVoided', targetId });
    },

    correctHand: async (targetId, replacement) => {
      const { gameId } = get();
      if (gameId === null) return refuse('No game loaded');
      await commit(gameId, { type: 'HandCorrected', targetId, replacement });
    },

    overrideState: async ({ dealer, prevailing, dealerRepeat }) => {
      const { gameId } = get();
      if (gameId === null) return refuse('No game loaded');
      await commit(gameId, { type: 'StateOverridden', dealer, prevailing, dealerRepeat });
    },

    endGame: async (reason) => {
      const { gameId } = get();
      if (gameId === null) return refuse('No game loaded');
      await commit(gameId, { type: 'GameEnded', reason });
    },

    loadGame: async (gameId) => {
      set({ loading: true, error: null });
      try {
        const events = await loadEvents(gameId);
        set({
          gameId,
          events,
          state: replay(events),
          history: deriveHistory(events),
          loading: false,
          error: null,
        });
      } catch (error) {
        set({ loading: false, error: errorMessage(error) });
        throw error;
      }
    },
  };
});
