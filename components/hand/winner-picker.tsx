'use client';

import { useState } from 'react';
import type { Seat } from '@/lib/tiles';
import { Button } from '@/components/ui/button';

export interface WinnerPickerResult {
  winner: Seat;
  discarder?: Seat;
}

export interface WinnerPickerProps {
  seats: readonly Seat[];
  seatLabel: (seat: Seat) => string;
  onComplete: (result: WinnerPickerResult) => void;
}

type SubStep = 'winner' | 'method' | 'discarder';

/**
 * The fixed-order winner/discarder picker (PD-09): tap the winner, then
 * self-drawn or discard, then (only for a discard win) who discarded — the
 * discarder can never be the winner. Calls `onComplete` exactly once, as
 * soon as enough is known to settle the hand.
 */
export function WinnerPicker({ seats, seatLabel, onComplete }: WinnerPickerProps) {
  const [winner, setWinner] = useState<Seat | null>(null);
  const [subStep, setSubStep] = useState<SubStep>('winner');

  const chooseWinner = (seat: Seat): void => {
    setWinner(seat);
    setSubStep('method');
  };

  const chooseSelfDrawn = (): void => {
    if (winner === null) return;
    onComplete({ winner });
  };

  const chooseDiscard = (): void => {
    setSubStep('discarder');
  };

  const chooseDiscarder = (seat: Seat): void => {
    if (winner === null) return;
    onComplete({ winner, discarder: seat });
  };

  return (
    <div className="flex flex-col gap-4">
      {subStep === 'winner' && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-lg font-semibold">Who won?</legend>
          <div className="grid grid-cols-2 gap-3">
            {seats.map((seat) => (
              <Button
                key={seat}
                type="button"
                onClick={() => chooseWinner(seat)}
                className="h-12 px-4 text-base"
              >
                {seatLabel(seat)}
              </Button>
            ))}
          </div>
        </fieldset>
      )}

      {subStep === 'method' && winner !== null && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-lg font-semibold">{seatLabel(winner)} won by…</legend>
          <div className="flex gap-3">
            <Button type="button" onClick={chooseSelfDrawn} className="h-12 flex-1 px-4 text-base">
              Self-drawn
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={chooseDiscard}
              className="h-12 flex-1 px-4 text-base"
            >
              Discard
            </Button>
          </div>
        </fieldset>
      )}

      {subStep === 'discarder' && winner !== null && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-lg font-semibold">Who discarded?</legend>
          <div className="grid grid-cols-2 gap-3">
            {seats
              .filter((seat) => seat !== winner)
              .map((seat) => (
                <Button
                  key={seat}
                  type="button"
                  onClick={() => chooseDiscarder(seat)}
                  className="h-12 px-4 text-base"
                >
                  {seatLabel(seat)}
                </Button>
              ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
