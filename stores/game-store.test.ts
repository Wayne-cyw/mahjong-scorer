import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbModule from '@/lib/db';
import { getDb, loadEvents } from '@/lib/db';
import { basePointsFor, getPreset, settle } from '@/lib/scoring';
import { initialState, nextSeat } from '@/lib/game';
import type { Seat } from '@/lib/tiles';
import { useGameStore } from './game-store';

const ruleset = getPreset('hk-discarder-pays'); // minFan 3, capFan 10, discarder pays

/** Resets the store's data fields (not its actions) to a clean slate between tests. */
function resetStore(): void {
  useGameStore.setState({
    gameId: null,
    events: [],
    state: initialState,
    history: [],
    loading: false,
    error: null,
  });
}

beforeEach(async () => {
  const db = getDb();
  await Promise.all([db.games.clear(), db.events.clear(), db.players.clear(), db.settings.clear()]);
  resetStore();
});

/** Creates a game, assigns seats 0-3 to the four created players, and chooses seat 0 as first dealer. */
async function setupPlayingGame(): Promise<string> {
  const gameId = await useGameStore
    .getState()
    .createGame({ playerNames: ['Alice', 'Bob', 'Cara', 'Dee'], presetId: ruleset.id });
  const playerIds = useGameStore.getState().state.playerIds;
  const seatOf = Object.fromEntries(playerIds.map((id, i) => [id, i as Seat]));
  await useGameStore.getState().assignSeats(seatOf);
  await useGameStore.getState().chooseFirstDealer(0);
  return gameId;
}

/** Wins every hand with the seat after the dealer, forcing the dealer to advance every time. */
async function playToComplete(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const { state } = useGameStore.getState();
    if (state.status === 'complete') return;
    const dealer = state.dealer;
    await useGameStore
      .getState()
      .recordWin({ winner: nextSeat(dealer), discarder: dealer, fan: ruleset.minFan });
  }
  throw new Error('Game did not complete within 20 hands');
}

describe('createGame', () => {
  it('saves players, appends GameCreated, and derives state from it', async () => {
    const gameId = await useGameStore.getState().createGame({
      playerNames: ['Alice', 'Bob', 'Cara', 'Dee'],
      presetId: ruleset.id,
      startingPoints: 2000,
    });

    const { state, events, history } = useGameStore.getState();
    expect(state.playerIds).toHaveLength(4);
    expect(state.scores).toEqual([2000, 2000, 2000, 2000]);
    expect(state.ruleset?.id).toBe(ruleset.id);
    expect(events).toHaveLength(1);
    expect(events[0]?.payload.type).toBe('GameCreated');
    expect(history).toEqual([]);

    const stored = await loadEvents(gameId);
    expect(stored).toHaveLength(1);
  });

  it('defaults startingPoints when omitted', async () => {
    await useGameStore
      .getState()
      .createGame({ playerNames: ['A', 'B', 'C', 'D'], presetId: ruleset.id });
    expect(useGameStore.getState().state.scores).toEqual([2000, 2000, 2000, 2000]);
  });
});

describe('full setup -> play -> complete -> end flow', () => {
  it('drives a game from creation through every write action to ended, matching a reload', async () => {
    const gameId = await setupPlayingGame();
    expect(useGameStore.getState().state.status).toBe('playing');

    // A virtual dice roll.
    await useGameStore.getState().rollDice();
    const afterRoll = useGameStore.getState().state.lastRoll;
    expect(afterRoll?.source).toBe('virtual');
    expect(afterRoll?.dice).toHaveLength(3);
    expect(afterRoll?.total).toBe((afterRoll?.dice ?? []).reduce((a, b) => a + b, 0));

    // A physical dice roll (total supplied, no per-die values).
    await useGameStore.getState().rollDice({ physicalTotal: 11 });
    expect(useGameStore.getState().state.lastRoll).toEqual({
      total: 11,
      dice: undefined,
      source: 'physical',
    });

    // A manual win: payments must come from the preset's own points table and payment model.
    const before = useGameStore.getState().state.scores;
    await useGameStore.getState().recordWin({ winner: 0, discarder: 1, fan: ruleset.minFan });
    const expectedPayments = settle({
      winner: 0,
      discarder: 1,
      basePoints: basePointsFor(ruleset.minFan, ruleset),
      model: ruleset.payment,
    });
    const after = useGameStore.getState().state.scores;
    expect(after).toEqual([
      before[0] + expectedPayments[0],
      before[1] + expectedPayments[1],
      before[2] + expectedPayments[2],
      before[3] + expectedPayments[3],
    ]);
    // Dealer (seat 0) won, so the dealer stays and the repeat counter increments.
    expect(useGameStore.getState().state.dealer).toBe(0);
    expect(useGameStore.getState().state.dealerRepeat).toBe(1);

    // A draw.
    await useGameStore.getState().recordDraw();
    expect(useGameStore.getState().state.handsPlayed).toBe(2);

    // Drive the rest of the way to 'complete'.
    await playToComplete();
    expect(useGameStore.getState().state.status).toBe('complete');

    const finalState = useGameStore.getState().state;
    const finalHistory = useGameStore.getState().history;

    await useGameStore.getState().endGame('completed');
    expect(useGameStore.getState().state.status).toBe('ended');

    // Reloading from the event log (simulating an app restart) reproduces the same state.
    resetStore();
    expect(useGameStore.getState().state).toEqual(initialState);
    await useGameStore.getState().loadGame(gameId);
    expect(useGameStore.getState().state.status).toBe('ended');
    expect(useGameStore.getState().state).toEqual({ ...finalState, status: 'ended' });
    expect(useGameStore.getState().history).toEqual(finalHistory);
  });
});

describe('voidHand / correctHand / overrideState', () => {
  it('appends the corresponding edit events and recomputes state', async () => {
    const gameId = await setupPlayingGame();
    await useGameStore.getState().recordWin({ winner: 1, discarder: 0, fan: ruleset.minFan });
    const wonEvent = useGameStore.getState().events.find((e) => e.payload.type === 'HandWon');
    expect(wonEvent).toBeDefined();
    const targetId = wonEvent!.id;

    const dealerAfterWin = useGameStore.getState().state.dealer;
    expect(dealerAfterWin).toBe(1); // seat 1 won, so seat 1 now deals

    await useGameStore.getState().voidHand(targetId);
    expect(useGameStore.getState().state.dealer).toBe(0); // voided: back to no hand played
    expect(useGameStore.getState().state.handsPlayed).toBe(0);

    const stored = await loadEvents(gameId);
    expect(stored.some((e) => e.payload.type === 'HandVoided')).toBe(true);

    await useGameStore.getState().overrideState({ dealer: 2, prevailing: 'S', dealerRepeat: 3 });
    expect(useGameStore.getState().state.dealer).toBe(2);
    expect(useGameStore.getState().state.prevailing).toBe('S');
    expect(useGameStore.getState().state.dealerRepeat).toBe(3);
  });

  it('correctHand replaces a HandWon payload in place', async () => {
    await setupPlayingGame();
    await useGameStore.getState().recordWin({ winner: 1, discarder: 0, fan: ruleset.minFan });
    const wonEvent = useGameStore.getState().events.find((e) => e.payload.type === 'HandWon')!;
    const originalPayload = wonEvent.payload;
    if (originalPayload.type !== 'HandWon') throw new Error('expected HandWon');

    const newFan = ruleset.minFan + 1;
    const newPayments = settle({
      winner: 1,
      discarder: 0,
      basePoints: basePointsFor(newFan, ruleset),
      model: ruleset.payment,
    });
    await useGameStore.getState().correctHand(wonEvent.id, {
      ...originalPayload,
      fan: newFan,
      payments: newPayments,
    });

    const scores = useGameStore.getState().state.scores;
    expect(scores).toEqual([
      2000 + newPayments[0],
      2000 + newPayments[1],
      2000 + newPayments[2],
      2000 + newPayments[3],
    ]);
  });
});

describe('refused actions', () => {
  it('rollDice, recordWin, and recordDraw refuse (append nothing) before the game starts playing', async () => {
    const gameId = await useGameStore
      .getState()
      .createGame({ playerNames: ['A', 'B', 'C', 'D'], presetId: ruleset.id });
    const playerIds = useGameStore.getState().state.playerIds;
    const seatOf = Object.fromEntries(playerIds.map((id, i) => [id, i as Seat]));
    await useGameStore.getState().assignSeats(seatOf);
    // Deliberately not calling chooseFirstDealer: status stays 'setup'.
    expect(useGameStore.getState().state.status).toBe('setup');

    const eventsBefore = useGameStore.getState().events.length;

    await useGameStore.getState().rollDice();
    expect(useGameStore.getState().error).toBeTruthy();
    expect(useGameStore.getState().events).toHaveLength(eventsBefore);

    await useGameStore.getState().recordWin({ winner: 0, discarder: 1, fan: ruleset.minFan });
    expect(useGameStore.getState().error).toBeTruthy();
    expect(useGameStore.getState().events).toHaveLength(eventsBefore);

    await useGameStore.getState().recordDraw();
    expect(useGameStore.getState().error).toBeTruthy();
    expect(useGameStore.getState().events).toHaveLength(eventsBefore);

    const stored = await loadEvents(gameId);
    expect(stored).toHaveLength(eventsBefore);
  });

  it('refuses when no game has been created or loaded', async () => {
    await useGameStore.getState().assignSeats({});
    expect(useGameStore.getState().error).toBeTruthy();
    expect(useGameStore.getState().events).toHaveLength(0);
  });

  it('assignSeats and chooseFirstDealer refuse (append nothing) once the game has left setup', async () => {
    const gameId = await setupPlayingGame();
    expect(useGameStore.getState().state.status).toBe('playing');
    const eventsBefore = useGameStore.getState().events.length;
    const stateBefore = useGameStore.getState().state;

    const playerIds = useGameStore.getState().state.playerIds;
    const seatOf = Object.fromEntries(playerIds.map((id, i) => [id, i as Seat]));

    await useGameStore.getState().assignSeats(seatOf);
    expect(useGameStore.getState().error).toBeTruthy();
    expect(useGameStore.getState().events).toHaveLength(eventsBefore);
    expect(useGameStore.getState().state).toEqual(stateBefore);

    await useGameStore.getState().chooseFirstDealer(2);
    expect(useGameStore.getState().error).toBeTruthy();
    expect(useGameStore.getState().events).toHaveLength(eventsBefore);
    expect(useGameStore.getState().state).toEqual(stateBefore);

    const stored = await loadEvents(gameId);
    expect(stored).toHaveLength(eventsBefore);
  });
});

describe('GameRow.status sync', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates the games row when chooseFirstDealer moves status setup -> playing, but not on assignSeats', async () => {
    const db = getDb();
    const setGameStatusSpy = vi.spyOn(dbModule, 'setGameStatus');

    const gameId = await useGameStore
      .getState()
      .createGame({ playerNames: ['Alice', 'Bob', 'Cara', 'Dee'], presetId: ruleset.id });
    const playerIds = useGameStore.getState().state.playerIds;
    const seatOf = Object.fromEntries(playerIds.map((id, i) => [id, i as Seat]));

    // assignSeats does not change status: no redundant write to the games row.
    await useGameStore.getState().assignSeats(seatOf);
    expect(useGameStore.getState().state.status).toBe('setup');
    expect((await db.games.get(gameId))?.status).toBe('setup');
    expect(setGameStatusSpy).not.toHaveBeenCalled();

    // chooseFirstDealer moves setup -> playing: the games row must follow.
    await useGameStore.getState().chooseFirstDealer(0);
    expect(useGameStore.getState().state.status).toBe('playing');
    expect((await db.games.get(gameId))?.status).toBe('playing');
    expect(setGameStatusSpy).toHaveBeenCalledExactlyOnceWith(gameId, 'playing');
  });

  it('does not call setGameStatus again for actions that leave status unchanged (e.g. mid-game recordWin)', async () => {
    const gameId = await setupPlayingGame();
    const db = getDb();
    const setGameStatusSpy = vi.spyOn(dbModule, 'setGameStatus');

    await useGameStore.getState().rollDice();
    await useGameStore.getState().recordWin({ winner: 1, discarder: 0, fan: ruleset.minFan });

    expect(useGameStore.getState().state.status).toBe('playing');
    expect((await db.games.get(gameId))?.status).toBe('playing');
    expect(setGameStatusSpy).not.toHaveBeenCalled();
  });

  it('updates the games row to "ended" after endGame, driven through a full game', async () => {
    const gameId = await setupPlayingGame();
    const db = getDb();

    await playToComplete();
    expect(useGameStore.getState().state.status).toBe('complete');
    expect((await db.games.get(gameId))?.status).toBe('complete');

    await useGameStore.getState().endGame('completed');
    expect(useGameStore.getState().state.status).toBe('ended');
    expect((await db.games.get(gameId))?.status).toBe('ended');
  });
});

describe('setGameStatus failure isolation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('still commits the event and advances status when setGameStatus rejects, without setting error', async () => {
    const gameId = await useGameStore
      .getState()
      .createGame({ playerNames: ['Alice', 'Bob', 'Cara', 'Dee'], presetId: ruleset.id });
    const playerIds = useGameStore.getState().state.playerIds;
    const seatOf = Object.fromEntries(playerIds.map((id, i) => [id, i as Seat]));
    await useGameStore.getState().assignSeats(seatOf);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = new Error('boom: games row write failed');
    vi.spyOn(dbModule, 'setGameStatus').mockRejectedValueOnce(boom);

    const eventsBefore = useGameStore.getState().events.length;

    // chooseFirstDealer moves status setup -> playing, which triggers the
    // (now-failing) setGameStatus call inside commit().
    await expect(useGameStore.getState().chooseFirstDealer(0)).resolves.toBeUndefined();

    // The event was durably appended and the derived state correctly advanced,
    // despite the games-row sync failing.
    expect(useGameStore.getState().events).toHaveLength(eventsBefore + 1);
    expect(useGameStore.getState().state.status).toBe('playing');
    expect(useGameStore.getState().state.dealer).toBe(0);

    // The failure must not surface as a store error: a caller doing
    // `try { await chooseFirstDealer(...); goToNextScreen(); } catch { showError(); }`
    // should still navigate.
    expect(useGameStore.getState().error).toBeNull();

    expect(consoleErrorSpy).toHaveBeenCalled();

    const stored = await loadEvents(gameId);
    expect(stored).toHaveLength(eventsBefore + 1);
  });
});

describe('duplicate seq retry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reloads events and retries once when appendEvent loses the seq race', async () => {
    await setupPlayingGame();
    const eventsBefore = useGameStore.getState().events.length;

    const db = getDb();
    vi.spyOn(db.events, 'add').mockRejectedValueOnce(
      new Dexie.ConstraintError('Key already exists in the object store.'),
    );

    await useGameStore.getState().recordDraw();

    expect(useGameStore.getState().error).toBeNull();
    expect(useGameStore.getState().events).toHaveLength(eventsBefore + 1);
    expect(useGameStore.getState().state.handsPlayed).toBe(1);

    const gameId = useGameStore.getState().gameId!;
    const stored = await loadEvents(gameId);
    expect(stored).toHaveLength(eventsBefore + 1);
  });

  it('propagates a non-duplicate error from appendEvent unchanged', async () => {
    await setupPlayingGame();
    const db = getDb();
    const boom = new Error('boom');
    vi.spyOn(db.events, 'add').mockRejectedValueOnce(boom);

    await expect(useGameStore.getState().recordDraw()).rejects.toThrow(boom);
    expect(useGameStore.getState().error).toBe('boom');
  });
});
