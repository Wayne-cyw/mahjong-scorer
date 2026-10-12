import type { Seat, Wind } from '@/lib/tiles';
import { WINDS } from '@/lib/tiles';

/** Winds derive from the dealer: the dealer is always East (see "Dice and the wall"). */
export const seatWind = (seat: Seat, dealer: Seat): Wind => {
  const wind = WINDS[(seat - dealer + 4) % 4];
  if (wind === undefined) throw new RangeError(`Unknown wind for seat ${seat}, dealer ${dealer}`);
  return wind;
};

/** The next seat in play order; seat indices increase and wrap around (0-3). */
export const nextSeat = (seat: Seat): Seat => ((seat + 1) % 4) as Seat;
