import type { Seat } from '@/lib/tiles';
import type { StoredEvent } from './events';
import { nextSeat } from './seats';
import type { GameState } from './reducer';

export interface StandingRow {
  seat: Seat;
  score: number;
  /** Points gained or lost against the starting points. */
  net: number;
  /** 1-based; tied scores share a rank and the next rank is skipped (1, 1, 3, 4). */
  rank: number;
}

/** Final standings, highest score first, ties kept in seat order (PD-19). */
export function computeStandings(
  scores: GameState['scores'],
  startingPoints: number,
): StandingRow[] {
  const rows = scores
    .map((score, seat) => ({ seat: seat as Seat, score, net: score - startingPoints }))
    .sort((a, b) => b.score - a.score || a.seat - b.seat);
  // Tied scores are adjacent after sorting, so a row's rank is the position of the first equal score.
  return rows.map((row) => ({ ...row, rank: rows.findIndex((r) => r.score === row.score) + 1 }));
}

/** The starting points the game was created with, or null if the log has no creation event. */
export function startingPointsOf(events: readonly StoredEvent[]): number | null {
  for (const event of events) {
    if (event.payload.type === 'GameCreated') return event.payload.startingPoints;
  }
  return null;
}

export interface RematchPlan {
  /** Player ids in seat order (index = seat), so a new game seats everyone as before. */
  playerIdsBySeat: string[];
  /** The previous first dealer's neighbour deals first. */
  firstDealer: Seat;
}

/** Plans a rematch with the same four players, or null if the game never had seats assigned. */
export function planRematch(state: GameState): RematchPlan | null {
  const playerIdsBySeat: string[] = [];
  for (const [playerId, seat] of Object.entries(state.seatOf)) {
    playerIdsBySeat[seat] = playerId;
  }
  const seated = [0, 1, 2, 3].every((seat) => playerIdsBySeat[seat] !== undefined);
  if (!seated) return null;
  return { playerIdsBySeat, firstDealer: nextSeat(state.firstDealer) };
}
