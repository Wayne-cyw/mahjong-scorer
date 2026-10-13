import { describe, expect, it } from 'vitest';
import { initialState, type GameState, type StoredEvent } from './index';
import { computeStandings, planRematch, startingPointsOf } from './standings';

const state = (over: Partial<GameState> = {}): GameState => ({
  ...initialState,
  status: 'ended',
  playerIds: ['a', 'b', 'c', 'd'],
  seatOf: { a: 0, b: 1, c: 2, d: 3 },
  scores: [2000, 2000, 2000, 2000],
  ...over,
});

describe('computeStandings', () => {
  it('ranks by score, highest first, with net result against the starting points', () => {
    const rows = computeStandings([1900, 2300, 1700, 2100], 2000);
    expect(rows.map((r) => r.seat)).toEqual([1, 3, 0, 2]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(rows.map((r) => r.net)).toEqual([300, 100, -100, -300]);
  });

  it('shows tied scores as a shared rank and skips the next rank', () => {
    const rows = computeStandings([2200, 2200, 1800, 1800], 2000);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3, 3]);
    expect(rows.map((r) => r.seat)).toEqual([0, 1, 2, 3]);
  });

  it('ranks everyone first when nobody has moved', () => {
    const rows = computeStandings([2000, 2000, 2000, 2000], 2000);
    expect(rows.every((r) => r.rank === 1 && r.net === 0)).toBe(true);
  });

  it('nets sum to zero when scores conserve points', () => {
    const rows = computeStandings([2600, 1400, 2100, 1900], 2000);
    expect(rows.reduce((sum, r) => sum + r.net, 0)).toBe(0);
  });
});

describe('startingPointsOf', () => {
  const created = (startingPoints: number): StoredEvent => ({
    id: 'e0',
    gameId: 'g',
    seq: 0,
    v: 1,
    at: 0,
    payload: {
      type: 'GameCreated',
      playerIds: ['a', 'b', 'c', 'd'],
      // The ruleset is irrelevant here; only the event type and points are read.
      ruleset: {} as never,
      startingPoints,
    },
  });

  it('reads the starting points from the game-created event', () => {
    expect(startingPointsOf([created(500)])).toBe(500);
  });

  it('is null when the log has no game-created event', () => {
    expect(startingPointsOf([])).toBeNull();
  });
});

describe('planRematch', () => {
  it("keeps every player in their seat and deals first to the previous first dealer's neighbour", () => {
    const plan = planRematch(state({ firstDealer: 1 }));
    expect(plan).toEqual({ playerIdsBySeat: ['a', 'b', 'c', 'd'], firstDealer: 2 });
  });

  it('wraps from the last seat back to seat 0', () => {
    expect(planRematch(state({ firstDealer: 3 }))?.firstDealer).toBe(0);
  });

  it('follows the seating, not the order players were listed in', () => {
    const plan = planRematch(
      state({
        playerIds: ['a', 'b', 'c', 'd'],
        seatOf: { a: 2, b: 0, c: 3, d: 1 },
        firstDealer: 0,
      }),
    );
    expect(plan?.playerIdsBySeat).toEqual(['b', 'd', 'a', 'c']);
  });

  it('is null when seats were never assigned', () => {
    expect(planRematch(state({ seatOf: {} }))).toBeNull();
  });
});
