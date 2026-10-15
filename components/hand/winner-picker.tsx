'use client';

import { useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import type { Seat, Wind } from '@/lib/tiles';
import { Compass, SLOTS, seatAtSlot, type Slot } from '@/components/hk/compass';
import { Button } from '@/components/ui/button';
import { GlyphTile } from '@/components/hk/glyph-tile';
import { cn } from '@/lib/utils';
import { WIND_LABEL } from '@/components/table/seat-card';

export interface WinnerPickerResult {
  winner: Seat;
  discarder?: Seat;
}

export interface WinnerPickerProps {
  seatLabel: (seat: Seat) => string;
  /** The seat's wind this hand, shown on its tile so players find themselves at a glance. */
  windOf?: (seat: Seat) => Wind;
  onComplete: (result: WinnerPickerResult) => void;
}

type SubStep = 'winner' | 'method' | 'discarder';

const stepMotion = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -28 },
  transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
} as const;

/**
 * The fixed-order winner/discarder picker (PD-09): tap the winner, then
 * self-drawn or discard, then (only for a discard win) who discarded — the
 * discarder can never be the winner. Calls `onComplete` exactly once, as
 * soon as enough is known to settle the hand.
 *
 * Seats are tapped where they sit: the compass puts each player's tile on their own edge of the
 * table, turned to face them.
 */
export function WinnerPicker({ seatLabel, windOf, onComplete }: WinnerPickerProps) {
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

  const seatTile = (seat: Seat, onPick: (seat: Seat) => void, blocked: boolean): ReactNode => {
    const glyph = windOf ? WIND_LABEL[windOf(seat)].zh : null;
    const inner = (
      <>
        {glyph && <GlyphTile glyph={glyph} size="md" />}
        <span className="font-display min-w-0 truncate text-lg font-black">{seatLabel(seat)}</span>
      </>
    );
    if (blocked) {
      return (
        <div
          className={cn(
            'bg-cream-deep text-ink-dim flex size-full items-center justify-start gap-2.5 rounded-md px-3',
          )}
        >
          {inner}
        </div>
      );
    }
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => onPick(seat)}
        className="size-full justify-start gap-2.5 px-3 text-lg"
      >
        {inner}
      </Button>
    );
  };

  const compassFor = (onPick: (seat: Seat) => void, blockedSeat: Seat | null) => {
    const slots = Object.fromEntries(
      SLOTS.map((slot) => {
        const seat = seatAtSlot(slot, 0);
        return [slot, seatTile(seat, onPick, seat === blockedSeat)];
      }),
    ) as Record<Slot, ReactNode>;
    return slots;
  };

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence mode="wait" initial={false}>
        {subStep === 'winner' && (
          <m.fieldset key="winner" {...stepMotion} className="flex flex-col gap-3">
            <legend className="font-display mb-3 text-xl font-black">Who won?</legend>
            <Compass
              slots={compassFor(chooseWinner, null)}
              center={<PromptBlock glyph="胡" caption="Tap the winner" />}
            />
          </m.fieldset>
        )}

        {subStep === 'method' && winner !== null && (
          <m.fieldset key="method" {...stepMotion} className="flex flex-col gap-3">
            <legend className="font-display mb-3 text-xl leading-tight font-black">
              {seatLabel(winner)} won by…
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                onClick={chooseSelfDrawn}
                className="h-28 flex-col gap-1 text-xl"
              >
                <span aria-hidden="true" className="font-display text-4xl leading-none font-black">
                  自摸
                </span>
                Self-drawn
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={chooseDiscard}
                className="h-28 flex-col gap-1 text-xl"
              >
                <span aria-hidden="true" className="font-display text-4xl leading-none font-black">
                  出銃
                </span>
                Discard
              </Button>
            </div>
          </m.fieldset>
        )}

        {subStep === 'discarder' && winner !== null && (
          <m.fieldset key="discarder" {...stepMotion} className="flex flex-col gap-3">
            <legend className="font-display mb-3 text-xl font-black">Who discarded?</legend>
            <Compass
              slots={compassFor(chooseDiscarder, winner)}
              center={<PromptBlock glyph="銃" caption="Tap the discarder" />}
            />
          </m.fieldset>
        )}
      </AnimatePresence>
    </div>
  );
}

function PromptBlock({ glyph, caption }: { glyph: string; caption: string }) {
  return (
    <div className="bg-ivory text-lacquer flex size-full flex-col items-center justify-center gap-1 rounded-md">
      <span aria-hidden="true" className="font-display text-[3.75rem] leading-none font-black">
        {glyph}
      </span>
      <span className="text-sm font-bold">{caption}</span>
    </div>
  );
}
