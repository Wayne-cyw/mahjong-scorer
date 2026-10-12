import type { Seat } from '@/lib/tiles';

/** Display name per seat (index 0-3), falling back to "Player N" when a name is unknown. */
export function seatNames(
  seatOf: Record<string, Seat>,
  playerNames: Record<string, string>,
): string[] {
  const names = [0, 1, 2, 3].map((seat) => `Player ${seat + 1}`);
  for (const [playerId, seat] of Object.entries(seatOf)) {
    const name = playerNames[playerId];
    if (name) names[seat] = name;
  }
  return names;
}
