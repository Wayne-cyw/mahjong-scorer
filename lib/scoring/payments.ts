import type { Seat } from '@/lib/tiles';
import type { PaymentModel } from './ruleset';

const SEATS: readonly Seat[] = [0, 1, 2, 3];

/**
 * Per-seat point changes for a won hand. The winner is positive, payers are
 * negative, every amount is an integer and the four amounts sum to exactly 0.
 * Throws if the model and base points cannot settle in whole points.
 */
export function settle(args: {
  winner: Seat;
  discarder?: Seat;
  basePoints: number;
  model: PaymentModel;
}): [number, number, number, number] {
  const { winner, discarder, basePoints, model } = args;
  if (discarder === winner) throw new Error('The discarder cannot be the winner');

  const payments: [number, number, number, number] = [0, 0, 0, 0];
  for (const seat of SEATS) {
    if (seat === winner) continue;
    let multiple: number;
    if (discarder === undefined) multiple = model.selfDraw.each;
    else multiple = seat === discarder ? model.discard.discarder : model.discard.others;
    const owed = multiple * basePoints;
    if (!Number.isInteger(owed)) {
      throw new Error(`Payment of ${owed} for seat ${seat} is not a whole number of points`);
    }
    // `|| 0` keeps a zero payment as +0 rather than -0.
    payments[seat] = -owed || 0;
    payments[winner] -= payments[seat];
  }

  const total = payments.reduce((a, b) => a + b, 0);
  if (total !== 0) throw new Error(`Payments sum to ${total}, expected 0`);
  return payments;
}
