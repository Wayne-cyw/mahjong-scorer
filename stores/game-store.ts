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
import { analytics } from '@/lib/analytics/analytics';
import {
  DuplicateSeqError,
  appendEvent,
  createGame as dbCreateGame,
  loadEvents,
  savePlayer,
  setGameStatus,
} from '@/lib/db';

/**
 * The one place in the app that calls `appendEvent`: every write goes through this store.
 *
 * Every write action resolves `true` when its event was appended and `false`
 * when it was refused (no event appended, `error` set). It rejects only when
 * the write itself failed (e.g. IndexedDB error), also setting `error`.
 */
/**
 * Optional context for the `hand_recorded` analytics event. The camera flow
 * supplies these; they default to a manual hand with no corrections and no
 * measured duration. None of it is stored in the event log.
 */
export interface HandAnalytics {
  method?: 'photo' | 'manual';
  /** How many tiles the player corrected after recognition. */
  corrections?: number;
  /** `Date.now()` when the player started entering this hand; used for `durationMs`. */
  startedAt?: number;
}

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
  assignSeats: (seatOf: Record<string, Seat>) => Promise<boolean>;
  chooseFirstDealer: (seat: Seat, dice?: [number, number, number]) => Promise<boolean>;
  rollDice: (args?: { physicalTotal?: number }) => Promise<boolean>;
  recordWin: (
    args: {
      winner: Seat;
      discarder?: Seat;
      fan: number;
      hand?: WinningHand;
      breakdown?: FanLine[];
      engineVersion?: string;
    } & HandAnalytics,
  ) => Promise<boolean>;
  recordDraw: (args?: HandAnalytics) => Promise<boolean>;
  voidHand: (targetId: string) => Promise<boolean>;
  correctHand: (targetId: string, replacement: HandWonPayload) => Promise<boolean>;
  overrideState: (args: {
    dealer: Seat;
    prevailing: Wind;
    dealerRepeat: number;
  }) => Promise<boolean>;
  endGame: (reason: 'completed' | 'manual') => Promise<boolean>;
  loadGame: (gameId: string) => Promise<void>;
}

const DEFAULT_STARTING_POINTS = 2000;

/** How many times a write reloads and retries after losing the seq race to another writer. */
const MAX_APPEND_ATTEMPTS = 3;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

type GameStatus = GameState['status'];

/**
 * An action's guard and payload builder, run against a game's current state:
 * returns the event to append, or `{ refuse }` with the reason it may not be.
 * It is re-run against a freshly reloaded state if another writer appended first.
 */
type Plan = (state: GameState) => { payload: GameEvent } | { refuse: string };

const NOT_IN_PROGRESS = { refuse: 'Game is not in progress' } as const;
const LEFT_SETUP = { refuse: 'Game has already left setup' } as const;

/** Emits `hand_recorded` for a won or drawn hand; defaults describe a manual entry. */
const emitHandAnalytics = ({ method, corrections, startedAt }: HandAnalytics = {}): void => {
  analytics.capture('hand_recorded', {
    method: method ?? 'manual',
    corrections: corrections ?? 0,
    durationMs: startedAt === undefined ? 0 : Math.max(0, Math.round(Date.now() - startedAt)),
  });
};

/** Emits the lifecycle events implied by a status transition (setup→playing, →complete). */
const emitLifecycleAnalytics = (previous: GameStatus, next: GameStatus): void => {
  if (previous === 'setup' && next === 'playing') analytics.capture('game_started');
  if (previous !== 'complete' && next === 'complete') analytics.capture('game_completed');
};

const emitHandEdited = (): void => analytics.capture('hand_edited');

type RecordWinArgs = Parameters<GameStoreState['recordWin']>[0];
type WinDetails = Omit<RecordWinArgs, keyof HandAnalytics>;

/** Splits `recordWin` args into the hand itself and the analytics-only context. */
const splitWinArgs = ({
  method,
  corrections,
  startedAt,
  ...win
}: RecordWinArgs): { win: WinDetails; context: HandAnalytics } => ({
  win,
  context: { method, corrections, startedAt },
});

/** Builds the `HandWon` payload for a playing game, or the reason it is refused. */
const planWin = (
  state: GameState,
  { winner, discarder, fan, hand, breakdown, engineVersion }: WinDetails,
): ReturnType<Plan> => {
  if (state.status !== 'playing') return NOT_IN_PROGRESS;
  const ruleset = state.ruleset;
  if (ruleset === null) return { refuse: 'No ruleset for this game' };
  const manual = hand === undefined;
  const basePoints = basePointsFor(fan, ruleset);
  const payments = settle({ winner, discarder, basePoints, model: ruleset.payment });
  return {
    payload: {
      type: 'HandWon',
      winner,
      discarder,
      hand,
      fan,
      breakdown: breakdown ?? [],
      payments,
      engineVersion: manual ? MANUAL_ENGINE_VERSION : (engineVersion ?? MANUAL_ENGINE_VERSION),
      manual,
    },
  };
};

const nextSeqOf = (events: readonly StoredEvent[]): number => {
  const last = events.at(-1);
  return last ? last.seq + 1 : 0;
};

const derive = (events: StoredEvent[]) => ({
  events,
  state: replay(events),
  history: deriveHistory(events),
});

export const useGameStore = create<GameStoreState>()((set, get) => {
  /** Marks a call as refused: no event is appended, `error` is set, and the promise resolves `false`. */
  const refuse = (message: string): false => {
    set({ loading: false, error: message });
    return false;
  };

  /**
   * Plan, append, replay, and set: the pattern every write action follows (ADR-07).
   * The append carries the next `seq` this store expects, so a stale view (another
   * tab appended since this store loaded) is detected instead of silently appended
   * on top of. On that conflict the log is reloaded and replayed, the action's guard
   * is re-run against the fresh state, and the append is retried or refused (ADR-55).
   */
  const commit = async (plan: Plan, onAppended?: () => void): Promise<boolean> => {
    const { gameId } = get();
    if (gameId === null) return refuse('No game loaded');
    const previousStatus = get().state.status;
    set({ loading: true, error: null });
    try {
      let currentEvents = get().events;
      let currentState = get().state;
      for (let attempt = 1; ; attempt++) {
        const planned = plan(currentState);
        if ('refuse' in planned) return refuse(planned.refuse);
        try {
          const event = await appendEvent(gameId, planned.payload, nextSeqOf(currentEvents));
          set({ ...derive([...currentEvents, event]), loading: false, error: null });
          break;
        } catch (error) {
          if (!(error instanceof DuplicateSeqError) || attempt >= MAX_APPEND_ATTEMPTS) throw error;
          const fresh = derive(await loadEvents(gameId));
          set(fresh);
          currentEvents = fresh.events;
          currentState = fresh.state;
        }
      }
    } catch (error) {
      set({ loading: false, error: errorMessage(error) });
      throw error;
    }
    // Analytics fire only after a durable append, never for a refused action.
    // `capture` is a no-op without consent and never throws.
    onAppended?.();
    emitLifecycleAnalytics(previousStatus, get().state.status);

    // Keep the denormalized `games` row (used for fast listing) in sync with the
    // replayed lifecycle status, but only write when it actually changed. This is
    // best-effort: the event append and state update above are already durable and
    // correct, so a failure here must not surface as a `commit()` rejection or set
    // the store's `error` (a caller like `await action(); goToNextScreen()` must
    // still navigate even if this denormalized write fails).
    if (get().state.status !== previousStatus) {
      try {
        await setGameStatus(gameId, get().state.status);
      } catch (error) {
        console.error('Failed to sync games row status', error);
      }
    }
    return true;
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
        const event = await appendEvent(gameId, payload, 0);
        set({ gameId, ...derive([event]), loading: false, error: null });
        return gameId;
      } catch (error) {
        set({ loading: false, error: errorMessage(error) });
        throw error;
      }
    },

    assignSeats: (seatOf) =>
      commit((state) =>
        state.status !== 'setup' ? LEFT_SETUP : { payload: { type: 'SeatsAssigned', seatOf } },
      ),

    chooseFirstDealer: (seat, dice) =>
      commit((state) =>
        state.status !== 'setup'
          ? LEFT_SETUP
          : { payload: { type: 'FirstDealerChosen', seat, dice } },
      ),

    rollDice: (args) =>
      commit((state) => {
        if (state.status !== 'playing') return NOT_IN_PROGRESS;
        const physicalTotal = args?.physicalTotal;
        if (physicalTotal !== undefined) {
          return { payload: { type: 'DiceRolled', total: physicalTotal, source: 'physical' } };
        }
        const dice = rollThreeDice();
        return {
          payload: {
            type: 'DiceRolled',
            total: dice[0] + dice[1] + dice[2],
            dice,
            source: 'virtual',
          },
        };
      }),

    recordWin: (args) => {
      const { win, context } = splitWinArgs(args);
      return commit(
        (state) => planWin(state, win),
        () => emitHandAnalytics(context),
      );
    },

    recordDraw: (args) =>
      commit(
        (state) =>
          state.status !== 'playing' ? NOT_IN_PROGRESS : { payload: { type: 'HandDrawn' } },
        () => emitHandAnalytics(args),
      ),

    voidHand: (targetId) =>
      commit(() => ({ payload: { type: 'HandVoided', targetId } }), emitHandEdited),

    correctHand: (targetId, replacement) =>
      commit(() => ({ payload: { type: 'HandCorrected', targetId, replacement } }), emitHandEdited),

    overrideState: ({ dealer, prevailing, dealerRepeat }) =>
      commit(() => ({ payload: { type: 'StateOverridden', dealer, prevailing, dealerRepeat } })),

    endGame: (reason) => commit(() => ({ payload: { type: 'GameEnded', reason } })),

    loadGame: async (gameId) => {
      set({ loading: true, error: null });
      try {
        set({ gameId, ...derive(await loadEvents(gameId)), loading: false, error: null });
      } catch (error) {
        set({ loading: false, error: errorMessage(error) });
        throw error;
      }
    },
  };
});
