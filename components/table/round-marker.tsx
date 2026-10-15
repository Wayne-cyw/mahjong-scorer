'use client';

import { AnimatePresence, m } from 'motion/react';
import type { Wind } from '@/lib/tiles';
import { WIND_LABEL } from './seat-card';

export interface RoundMarkerProps {
  prevailing: Wind;
  hand: number;
  repeat: number;
}

/**
 * The marker at the middle of the table: the prevailing wind on a lacquer block, like the wind
 * indicator that sits in the centre of a real mahjong table, with the hand counter beneath.
 */
export function RoundMarker({ prevailing, hand, repeat }: RoundMarkerProps) {
  const label = WIND_LABEL[prevailing];
  return (
    <div className="bg-ivory text-lacquer relative flex size-full flex-col items-center justify-center overflow-hidden rounded-md">
      <span
        className="trim-canvas anim-stripe-run absolute inset-x-0 top-0 h-2"
        aria-hidden="true"
      />
      <span
        className="trim-canvas anim-stripe-run absolute inset-x-0 bottom-0 h-2"
        aria-hidden="true"
      />
      <div className="font-display relative grid h-[4.25rem] place-items-center text-[4.25rem] leading-none font-black">
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={prevailing}
            aria-hidden="true"
            initial={{ rotateX: 90, opacity: 0, scale: 0.6 }}
            animate={{ rotateX: 0, opacity: 1, scale: 1 }}
            exit={{ rotateX: -90, opacity: 0, scale: 0.6 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          >
            {label.zh}
          </m.span>
        </AnimatePresence>
      </div>
      <p className="mt-1 text-base leading-none font-bold" data-testid="hand-counter">
        Hand {hand}
        {repeat > 0 ? <span className="text-green"> ×{repeat}</span> : null}
      </p>
    </div>
  );
}
